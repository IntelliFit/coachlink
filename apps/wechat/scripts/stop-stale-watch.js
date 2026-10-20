// Stop Taro watch processes left behind by an earlier dev:weapp in this checkout.
// On Windows, stopping dev:weapp (closing the terminal, killing the task) can leave the
// `taro build --watch` child running. Several watchers then write the same dist/ and WeChat
// DevTools keeps recompiling half-written output. Only processes whose command line points
// at this checkout's node_modules and contains --watch are touched.
const { execSync } = require('child_process')
const path = require('path')

function listProcesses() {
  if (process.platform === 'win32') {
    const script = "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ForEach-Object { \"$($_.ProcessId)`t$($_.CommandLine)\" }"
    return execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, { encoding: 'utf8' })
  }
  return execSync('ps -axo pid=,command=', { encoding: 'utf8' }).replace(/^\s*(\d+)\s+/gm, '$1\t')
}

function stopStaleTaroWatch(appRoot) {
  const repoNodeModules = path.join(path.resolve(appRoot, '..', '..'), 'node_modules') + path.sep
  let output = ''
  try {
    output = listProcesses()
  } catch (error) {
    console.warn('[dev-weapp] Could not list processes, skip stale watch check:', error.message)
    return 0
  }
  const stale = output.split(/\r?\n/)
    .map((line) => line.split('\t'))
    .filter(([pid, command]) => pid && command && Number(pid) !== process.pid)
    .filter(([, command]) => command.includes(repoNodeModules) && command.includes('@tarojs') && command.includes('--watch'))
  for (const [pid] of stale) {
    try {
      if (process.platform === 'win32') execSync(`taskkill /T /F /PID ${pid}`, { stdio: 'ignore' })
      else process.kill(Number(pid), 'SIGTERM')
      console.log(`[dev-weapp] Stopped leftover Taro watch (pid ${pid}) from an earlier run`)
    } catch {
      // Already gone.
    }
  }
  return stale.length
}

module.exports = { stopStaleTaroWatch }
