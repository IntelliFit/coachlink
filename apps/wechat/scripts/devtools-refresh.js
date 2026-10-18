// Ask WeChat DevTools to rebuild its file watcher and recompile after the shared templates change.
// DevTools compiles while Taro and the fix scripts are still rewriting base.wxml / comp.* in every
// subpackage, and it does not always recompile once the tree is consistent again, leaving the
// simulator on "编译 .wxml 文件错误" until someone clicks 编译. Opt out with WEAPP_DEVTOOLS_REFRESH=0.
const { spawn } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const DEFAULT_CLI_PATHS = [
  'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',
  'C:\\Program Files\\Tencent\\微信web开发者工具\\cli.bat',
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
]
const WATCHED_FILES = ['app.json', 'base.wxml', 'comp.json', 'utils.wxs']

function findDevtoolsCli() {
  const candidates = [process.env.WEAPP_DEVTOOLS_CLI, ...DEFAULT_CLI_PATHS].filter(Boolean)
  return candidates.find((candidate) => fs.existsSync(candidate)) || null
}

function fingerprint(distDir) {
  const hash = crypto.createHash('sha1')
  for (const file of WATCHED_FILES) {
    const full = path.join(distDir, file)
    hash.update(file)
    hash.update(fs.existsSync(full) ? fs.readFileSync(full) : '')
  }
  return hash.digest('hex')
}

function createDevtoolsRefresher({ projectDir, distDir }) {
  const enabled = process.env.WEAPP_DEVTOOLS_REFRESH !== '0'
  const cli = enabled ? findDevtoolsCli() : null
  let lastFingerprint = fs.existsSync(distDir) ? fingerprint(distDir) : null
  let running = false

  return function refreshIfTemplatesChanged() {
    if (!cli) return
    const next = fingerprint(distDir)
    if (next === lastFingerprint) return
    lastFingerprint = next
    if (running) return
    running = true

    console.log('[dev-weapp] Shared templates changed, asking DevTools to recompile...')
    const child = spawn(`"${cli}" reset-fileutils --project "${projectDir}"`, {
      shell: true,
      stdio: 'ignore',
      windowsHide: true
    })
    const done = (code) => {
      running = false
      if (code !== 0) {
        console.log('[dev-weapp] DevTools recompile skipped (is DevTools open with 服务端口 enabled?)')
      }
    }
    child.on('error', () => done(1))
    child.on('close', done)
  }
}

module.exports = { createDevtoolsRefresher }
