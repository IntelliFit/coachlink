// Run Taro weapp watch and apply fixes only after each completed build.
const { spawn, execSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const readline = require('readline')
const { getWeappOutputRoot } = require('./weapp-output-root')

const root = path.join(__dirname, '..')
const mode = process.argv[2] || 'local'
const { ensureRootCompArtifacts } = require('./ensure-root-comp-artifacts')

function getWatchEnv(watchMode) {
  const env = { ...process.env }

  if (watchMode === 'lan') {
    delete env.USE_LOCALHOST
    env.NODE_ENV = 'development'
    env.USE_LAN = '1'
    env.WEAPP_OUTPUT_ROOT = process.env.WEAPP_OUTPUT_ROOT || 'dist'
    return env
  }

  delete env.USE_LAN
  env.NODE_ENV = 'development'
  env.USE_LOCALHOST = '1'
  env.WEAPP_OUTPUT_ROOT = process.env.WEAPP_OUTPUT_ROOT || 'dist'
  return env
}

const watchEnv = getWatchEnv(mode)
const outputRoot = watchEnv.WEAPP_OUTPUT_ROOT || getWeappOutputRoot()
const distAppJson = path.join(root, outputRoot, 'app.json')

let isFixing = false
let pendingFix = false
let debounceTimer = null
let buildCount = 0

function runFixScripts(reason = 'build') {
  if (isFixing) {
    pendingFix = true
    return
  }
  isFixing = true

  console.log(`\n[dev-weapp] Running fix scripts (${reason})...`)

  try {
    ensureRootCompArtifacts(path.join(root, outputRoot))
    execSync('node scripts/fix-weapp-wxml.js', { cwd: root, stdio: 'inherit' })
    execSync('node scripts/fix-weapp-comp-path.js', { cwd: root, stdio: 'inherit' })
    execSync('node scripts/copy-comp-to-subpackages.js', { cwd: root, stdio: 'inherit' })
    console.log('[dev-weapp] All fixes applied.')
  } catch (error) {
    console.error('[dev-weapp] Fix scripts error:', error.message)
  } finally {
    isFixing = false
    if (pendingFix) {
      pendingFix = false
      runFixScripts('queued')
    }
  }
}

function scheduleFix(reason) {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    runFixScripts(reason)
  }, 400)
}

function handleBuildLine(line) {
  if (!line) return
  if (!/(built in |编译完成|build complete)/i.test(line)) return
  buildCount += 1
  scheduleFix(`build #${buildCount}`)
}

function wireStream(stream, writer) {
  const rl = readline.createInterface({ input: stream })
  rl.on('line', (line) => {
    writer(line + '\n')
    handleBuildLine(line)
  })
}

console.log(`[dev-weapp] Starting Taro watch (mode: ${mode}, output: ${outputRoot})...`)
if (fs.existsSync(distAppJson)) {
  ensureRootCompArtifacts(path.join(root, outputRoot))
}
const taro = spawn('npx', ['taro', 'build', '--type', 'weapp', '--watch'], {
  cwd: root,
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
  env: { ...watchEnv, FORCE_COLOR: '1' }
})

taro.stdout.on('error', () => {})
taro.stderr.on('error', () => {})
wireStream(taro.stdout, (msg) => process.stdout.write(msg))
wireStream(taro.stderr, (msg) => process.stderr.write(msg))

// If dist already exists (warm start), run one initial fix once.
if (fs.existsSync(distAppJson)) {
  scheduleFix('initial')
}

taro.on('close', (code) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  console.log('[dev-weapp] Taro closed:', code)
  process.exit(code || 0)
})
