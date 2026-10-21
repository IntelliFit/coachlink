#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { execFileSync, execSync } = require('child_process')

const ci = require('miniprogram-ci')

const PROJECT_DIR = path.resolve(__dirname, '..')
const ROOT_DIR = path.resolve(PROJECT_DIR, '..')
const PROJECT_CONFIG_PATH = path.join(PROJECT_DIR, 'project.config.json')
const DEFAULT_ENV_FILE = path.join(PROJECT_DIR, '.env.weapp-release.local')
const DEFAULT_AUDIT_CONFIG = path.join(PROJECT_DIR, 'release.weapp.json')
const RELEASE_DIR = path.resolve(PROJECT_DIR, process.env.WEAPP_RELEASE_DIR || 'dist-release')
const DEPLOY_DIR = path.join(PROJECT_DIR, 'deploy_versions')
const LATEST_DEPLOY_PATH = path.join(DEPLOY_DIR, 'latest-weapp-release.json')

const AUDIT_STATUS = {
  0: 'passed',
  1: 'rejected',
  2: 'auditing',
  3: 'withdrawn',
  4: 'delayed',
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const index = line.indexOf('=')
    if (index <= 0) continue
    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

function getArgs() {
  const args = process.argv.slice(2)
  const command = args.find((arg) => !arg.startsWith('-')) || 'help'
  const options = {}

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (!arg.startsWith('--')) continue
    const eq = arg.indexOf('=')
    if (eq > 0) {
      options[arg.slice(2, eq)] = arg.slice(eq + 1)
      continue
    }
    const key = arg.slice(2)
    const next = args[i + 1]
    if (next && !next.startsWith('--')) {
      options[key] = next
      i += 1
    } else {
      options[key] = true
    }
  }

  return { command, options }
}

function getEnv(name, fallback = '') {
  const value = process.env[name]
  return value == null || value === '' ? fallback : value
}

function boolValue(value) {
  return value === true || value === '1' || String(value).toLowerCase() === 'true'
}

function numberValue(value, fallback) {
  if (value == null || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function requireValue(value, message) {
  if (!value) throw new Error(message)
  return value
}

function sh(command, options = {}) {
  execSync(command, {
    cwd: options.cwd || PROJECT_DIR,
    stdio: options.stdio || 'inherit',
    shell: true,
    env: process.env,
  })
}

function gitShort() {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return 'unknown'
  }
}

function shanghaiParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

function defaultVersion() {
  const parts = shanghaiParts()
  return `${parts.year}.${parts.month}.${parts.day}.${parts.hour}${parts.minute}`
}

function defaultDesc() {
  return `commit ${gitShort()} release via miniprogram-ci`
}

function readLatestDeploy() {
  if (!fs.existsSync(LATEST_DEPLOY_PATH)) return {}
  return readJson(LATEST_DEPLOY_PATH)
}

function updateLatestDeploy(patch) {
  const next = {
    ...readLatestDeploy(),
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  writeJson(LATEST_DEPLOY_PATH, next)
  return next
}

function buildIfNeeded(options) {
  if (boolValue(options['skip-build']) || boolValue(getEnv('WEAPP_RELEASE_SKIP_BUILD'))) {
    console.log('[weapp-release] skip build')
    return
  }
  sh('npm run build:weapp:release')
}

function ensureReleaseArtifacts() {
  const required = ['project.config.json', 'app.json', 'app.js']
  const missing = required.filter((name) => !fs.existsSync(path.join(RELEASE_DIR, name)))
  if (missing.length > 0) {
    throw new Error(
      `Release build is incomplete (${missing.join(', ')} missing). Run npm run build:weapp:release first.`
    )
  }
}

function normalizeReleaseProjectConfig(appid) {
  const releaseConfigPath = path.join(RELEASE_DIR, 'project.config.json')
  const releaseConfig = readJson(releaseConfigPath)
  writeJson(releaseConfigPath, {
    ...releaseConfig,
    appid,
    miniprogramRoot: './',
    srcMiniprogramRoot: './',
  })
}

function resolveDevtoolsCli() {
  const configured = getEnv('WEAPP_DEVTOOLS_CLI_PATH')
  const candidates = [
    configured,
    'D:\\software\\微信web开发者工具\\cli.bat',
    'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',
    'C:\\Program Files\\Tencent\\微信web开发者工具\\cli.bat',
  ].filter(Boolean)
  return candidates.find((candidate) => fs.existsSync(candidate)) || ''
}

function makeProject(appid) {
  const privateKeyPath = getEnv('WEAPP_UPLOAD_PRIVATE_KEY_PATH', getEnv('MINIPROGRAM_PRIVATE_KEY_PATH'))
  const privateKey = getEnv('WEAPP_UPLOAD_PRIVATE_KEY', getEnv('MINIPROGRAM_PRIVATE_KEY'))

  if (!privateKeyPath && !privateKey) {
    throw new Error(
      'Missing upload key. Set WEAPP_UPLOAD_PRIVATE_KEY_PATH or WEAPP_UPLOAD_PRIVATE_KEY in .env.weapp-release.local.'
    )
  }

  return new ci.Project({
    appid,
    type: 'miniProgram',
    projectPath: RELEASE_DIR,
    privateKeyPath: privateKeyPath || undefined,
    privateKey: privateKey || undefined,
    ignores: [
      'node_modules/**/*',
      'src/**/*',
      'scripts/**/*',
      'dist/**/*',
      'dist-sizecheck/**/*',
      'deploy_versions/**/*',
      '.env*',
      '*.key',
    ],
  })
}

async function upload(options, context) {
  buildIfNeeded(options)
  ensureReleaseArtifacts()
  normalizeReleaseProjectConfig(context.appid)

  const version = options.version || getEnv('WEAPP_VERSION') || defaultVersion()
  const desc = options.desc || getEnv('WEAPP_DESC') || defaultDesc()
  const robot = numberValue(options.robot || getEnv('WEAPP_CI_ROBOT'), 1)
  const requestedProvider = options.provider || getEnv('WEAPP_UPLOAD_PROVIDER', 'auto')
  const devtoolsCli = resolveDevtoolsCli()
  const useDevtools =
    requestedProvider === 'devtools' || (requestedProvider === 'auto' && Boolean(devtoolsCli))

  let result
  let provider
  if (useDevtools) {
    requireValue(
      devtoolsCli,
      'WeChat DevTools CLI not found. Set WEAPP_DEVTOOLS_CLI_PATH or use --provider miniprogram-ci.'
    )
    const port = numberValue(options.port || getEnv('WEAPP_DEVTOOLS_CLI_PORT') || 28264, 28264)
    provider = 'devtools'
    console.log(
      `[weapp-release] upload provider=devtools appid=${context.appid} version=${version} port=${port}`
    )
    // shell mode on Windows joins argv unquoted, so paths like "C:\Program Files (x86)" must be quoted.
    const quote = (value) => (process.platform === 'win32' && /\s/.test(value) ? `"${value}"` : value)
    execFileSync(
      quote(devtoolsCli),
      ['upload', '--project', quote(RELEASE_DIR), '--port', String(port), '-v', version, '-d', quote(desc)],
      {
        cwd: PROJECT_DIR,
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: process.env,
      }
    )
    result = { provider, port }
  } else {
    provider = 'miniprogram-ci'
    const project = makeProject(context.appid)
    console.log(
      `[weapp-release] upload provider=miniprogram-ci appid=${context.appid} version=${version} robot=${robot}`
    )
    result = await ci.upload({
      project,
      version,
      desc,
      robot,
      setting: {
        useProjectConfig: true,
      },
      onProgressUpdate: (info) => {
        if (!info) return
        if (typeof info === 'string') console.log(info)
        else if (info.message) console.log(`[weapp-release] ${info.status || ''} ${info.message}`)
      },
    })
  }

  updateLatestDeploy({
    appid: context.appid,
    version,
    desc,
    robot,
    uploadProvider: provider,
    uploadedAt: new Date().toISOString(),
    uploadResult: result,
  })
  console.log('[weapp-release] upload done')
  return { version, desc, robot, result }
}

function readAuditPayload(options) {
  const inline = options['audit-json'] || getEnv('WEAPP_AUDIT_JSON')
  if (inline) return JSON.parse(inline)

  const itemList = options['audit-item-list-json'] || getEnv('WEAPP_AUDIT_ITEM_LIST_JSON')
  if (itemList) return { item_list: JSON.parse(itemList) }

  const configPath = path.resolve(
    PROJECT_DIR,
    options['audit-file'] || getEnv('WEAPP_AUDIT_CONFIG') || DEFAULT_AUDIT_CONFIG
  )
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Missing audit config: ${configPath}. Copy release.weapp.example.json to release.weapp.json and fill real category ids.`
    )
  }

  const payload = readJson(configPath)
  if (payload.audit) return payload.audit
  return payload
}

async function getAccessToken(context) {
  const appSecret = requireValue(
    getEnv('WEAPP_APP_SECRET', getEnv('WECHAT_APP_SECRET')),
    'Missing WEAPP_APP_SECRET in .env.weapp-release.local.'
  )
  const url = new URL('https://api.weixin.qq.com/cgi-bin/token')
  url.searchParams.set('grant_type', 'client_credential')
  url.searchParams.set('appid', context.appid)
  url.searchParams.set('secret', appSecret)

  const response = await fetch(url)
  const json = await response.json()
  if (!response.ok || json.errcode) {
    throw new Error(`get access_token failed: ${JSON.stringify(json)}`)
  }
  return json.access_token
}

async function wechatApi(context, apiPath, body = {}, method = 'POST') {
  const token = await getAccessToken(context)
  const url = new URL(`https://api.weixin.qq.com/${apiPath}`)
  url.searchParams.set('access_token', token)

  const init =
    method === 'GET'
      ? { method }
      : {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body || {}),
        }

  const response = await fetch(url, init)
  const json = await response.json()
  if (!response.ok || (json.errcode && json.errcode !== 0)) {
    throw new Error(`${apiPath} failed: ${JSON.stringify(json)}`)
  }
  return json
}

async function submitAudit(options, context) {
  const payload = readAuditPayload(options)
  if (!Array.isArray(payload.item_list) || payload.item_list.length === 0) {
    throw new Error('Audit payload must contain non-empty item_list.')
  }

  console.log(`[weapp-release] submit audit items=${payload.item_list.length}`)
  const result = await wechatApi(context, 'wxa/submit_audit', payload)
  updateLatestDeploy({
    auditId: result.auditid,
    auditSubmittedAt: new Date().toISOString(),
    auditPayload: payload,
    auditResult: result,
  })
  console.log(`[weapp-release] audit submitted auditId=${result.auditid}`)
  return result
}

async function getAuditStatus(options, context) {
  const latest = readLatestDeploy()
  const auditId = options.auditid || options['audit-id'] || getEnv('WEAPP_AUDIT_ID') || latest.auditId

  if (auditId) {
    const result = await wechatApi(context, 'wxa/get_auditstatus', { auditid: Number(auditId) })
    return { ...result, auditid: Number(auditId) }
  }

  return wechatApi(context, 'wxa/get_latest_auditstatus', {})
}

async function printAuditStatus(options, context) {
  const result = await getAuditStatus(options, context)
  const statusText = AUDIT_STATUS[result.status] || `unknown:${result.status}`
  updateLatestDeploy({
    lastAuditStatus: result.status,
    lastAuditStatusText: statusText,
    lastAuditStatusCheckedAt: new Date().toISOString(),
    lastAuditStatusResult: result,
  })
  console.log(`[weapp-release] audit status=${statusText}`)
  console.log(JSON.stringify(result, null, 2))
  return result
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitAudit(options, context) {
  const intervalMs = numberValue(options.interval || getEnv('WEAPP_AUDIT_POLL_INTERVAL_MS'), 60_000)
  const timeoutMs = numberValue(options.timeout || getEnv('WEAPP_AUDIT_POLL_TIMEOUT_MS'), 2 * 60 * 60 * 1000)
  const start = Date.now()

  while (Date.now() - start <= timeoutMs) {
    const result = await printAuditStatus(options, context)
    if (result.status === 0) return result
    if (result.status === 1 || result.status === 3) {
      throw new Error(`Audit did not pass: ${JSON.stringify(result)}`)
    }
    await wait(intervalMs)
  }

  throw new Error(`Audit polling timed out after ${timeoutMs}ms.`)
}

async function publish(options, context) {
  const grayPercentage = Number(options.gray || getEnv('WEAPP_GRAY_PERCENTAGE') || 0)
  if (grayPercentage > 0) {
    const result = await wechatApi(context, 'wxa/grayrelease', {
      gray_percentage: grayPercentage,
    })
    updateLatestDeploy({
      publishedAt: new Date().toISOString(),
      publishMode: 'grayrelease',
      grayPercentage,
      publishResult: result,
    })
    console.log(`[weapp-release] gray release done percentage=${grayPercentage}`)
    return result
  }

  const result = await wechatApi(context, 'wxa/release', {})
  updateLatestDeploy({
    publishedAt: new Date().toISOString(),
    publishMode: 'release',
    publishResult: result,
  })
  console.log('[weapp-release] release done')
  return result
}

async function categories(context) {
  const result = await wechatApi(context, 'wxa/get_category', {}, 'GET')
  console.log(JSON.stringify(result, null, 2))
  return result
}

async function pages(context) {
  const result = await wechatApi(context, 'wxa/get_page', {}, 'GET')
  console.log(JSON.stringify(result, null, 2))
  return result
}

function help() {
  console.log(`
Usage:
  node scripts/weapp-release.js upload [--version x.y.z] [--desc "..."] [--skip-build]
  node scripts/weapp-release.js audit [--audit-file release.weapp.json]
  node scripts/weapp-release.js status [--audit-id 123]
  node scripts/weapp-release.js wait-audit [--audit-id 123]
  node scripts/weapp-release.js publish [--gray 10]
  node scripts/weapp-release.js auto [--release] [--skip-build]
  node scripts/weapp-release.js categories
  node scripts/weapp-release.js pages

Private config is loaded from .env.weapp-release.local by default.
`)
}

async function main() {
  const { command, options } = getArgs()
  loadEnvFile(path.resolve(PROJECT_DIR, options['env-file'] || getEnv('WEAPP_RELEASE_ENV_FILE') || DEFAULT_ENV_FILE))

  const projectConfig = readJson(PROJECT_CONFIG_PATH)
  const context = {
    appid: options.appid || getEnv('WEAPP_APPID') || projectConfig.appid,
  }
  requireValue(context.appid, 'Missing appid. Set WEAPP_APPID or project.config.json appid.')

  if (command === 'help' || command === '--help' || command === '-h') {
    help()
    return
  }

  if (command === 'upload') {
    await upload(options, context)
  } else if (command === 'audit') {
    await submitAudit(options, context)
  } else if (command === 'status') {
    await printAuditStatus(options, context)
  } else if (command === 'wait-audit') {
    await waitAudit(options, context)
  } else if (command === 'publish') {
    await publish(options, context)
  } else if (command === 'auto') {
    await upload(options, context)
    const audit = await submitAudit(options, context)
    await waitAudit({ ...options, auditid: audit.auditid }, context)
    if (boolValue(options.release) || boolValue(getEnv('WEAPP_AUTO_RELEASE'))) {
      await publish(options, context)
    } else {
      console.log('[weapp-release] audit passed. Set WEAPP_AUTO_RELEASE=1 or pass --release to publish automatically.')
    }
  } else if (command === 'categories') {
    await categories(context)
  } else if (command === 'pages') {
    await pages(context)
  } else {
    help()
    throw new Error(`Unknown command: ${command}`)
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error)
  process.exitCode = 1
})
