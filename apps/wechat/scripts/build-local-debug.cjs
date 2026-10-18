const { spawnSync } = require('node:child_process')
const path = require('node:path')
const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log('npm run weapp:debug-login -- --port 3003（固定输出 apps/wechat/dist-local-debug）')
  process.exit(0)
}
if (args.length && !(args.length === 2 && args[0] === '--port') && !(args.length === 1 && /^\d+$/.test(args[0]))) throw new Error('只支持 --port 参数')
const port = Number(args[1] || args[0] || 3003)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('端口无效')
const root = path.resolve(__dirname, '..')
const env = { ...process.env, NODE_ENV: 'development', USE_LOCALHOST: '1', USE_LAN: '0',
  TARO_APP_API_URL: `http://127.0.0.1:${port}`, TARO_APP_API_BASE_URL_OVERRIDE: `http://127.0.0.1:${port}`,
  WEAPP_OUTPUT_ROOT: 'dist-local-debug' }
function run(file, extra = []) {
  const result = spawnSync(process.execPath, [file, ...extra], { cwd: root, env, stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}
console.log(`CoachLink 本地模拟包：${env.TARO_APP_API_URL} → ${env.WEAPP_OUTPUT_ROOT}（不上传）`)
run(require.resolve('@tarojs/cli/bin/taro'), ['build', '--type', 'weapp'])
for (const script of ['fix-weapp-wxml.js', 'fix-weapp-comp-path.js', 'copy-comp-to-subpackages.js']) run(path.join(__dirname, script))
console.log(`开发者工具导入：${path.join(root, env.WEAPP_OUTPUT_ROOT)}；进入 auth/login。`)
