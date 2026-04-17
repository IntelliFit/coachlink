const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const readline = require('readline')

const rootDir = path.join(__dirname, '..')
const taroBin = path.join(
  rootDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'taro.cmd' : 'taro'
)

let taroProcess = null
let fixProcess = null
let fixing = false
let rerunFixes = false
let buildCount = 0
let fixTimer = null

function log(message) {
  console.log(`[dev:weapp] ${message}`)
}

function runCommand(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      env: process.env,
      shell: false
    })

    fixProcess = child

    child.on('error', reject)
    child.on('exit', (code, signal) => {
      fixProcess = null
      if (signal) {
        reject(new Error(`${label} exited with signal ${signal}`))
        return
      }
      if (code !== 0) {
        reject(new Error(`${label} exited with code ${code}`))
        return
      }
      resolve()
    })
  })
}

async function applyFixes() {
  if (fixing) {
    rerunFixes = true
    return
  }

  fixing = true
  try {
    log(`build #${buildCount} completed, applying WeChat fixes...`)
    await runCommand(process.execPath, [path.join(__dirname, 'fix-comp-path.js')], 'fix-comp-path')
    await runCommand(process.execPath, [path.join(__dirname, 'fix-wxml-placeholder.js')], 'fix-wxml-placeholder')
    log('fixes applied, you can switch back to WeChat DevTools to inspect the result')
  } catch (error) {
    console.error(`[dev:weapp] ${error.message}`)
  } finally {
    fixing = false
    if (rerunFixes) {
      rerunFixes = false
      applyFixes()
    }
  }
}

function scheduleFixes() {
  if (fixTimer) {
    clearTimeout(fixTimer)
  }

  // In watch mode, some flat page WXML files appear slightly after
  // Taro prints "built in ...", so wait a bit before patching dist.
  fixTimer = setTimeout(() => {
    fixTimer = null
    applyFixes()
  }, 1500)
}

function handleBuildOutput(line) {
  if (!line) return
  if (!line.includes('built in ')) return

  buildCount += 1
  scheduleFixes()
}

function stopAll(exitCode) {
  if (fixTimer) {
    clearTimeout(fixTimer)
    fixTimer = null
  }

  const processes = [fixProcess, taroProcess].filter(Boolean)
  if (processes.length === 0) {
    process.exit(exitCode)
    return
  }

  for (const child of processes) {
    try {
      child.kill('SIGINT')
    } catch (error) {
      // ignore shutdown errors
    }
  }

  setTimeout(() => process.exit(exitCode), 300)
}

function wireStream(stream, writer) {
  const rl = readline.createInterface({ input: stream })
  rl.on('line', (line) => {
    writer(line)
    handleBuildOutput(line)
  })
}

function spawnTaroWatch() {
  if (process.platform === 'win32') {
    return spawn(taroBin, ['build', '--type', 'weapp', '--watch'], {
      cwd: rootDir,
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true
    })
  }

  return spawn(taroBin, ['build', '--type', 'weapp', '--watch'], {
    cwd: rootDir,
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: false
  })
}

function start() {
  if (!fs.existsSync(taroBin)) {
    console.error(`[dev:weapp] Missing Taro executable: ${taroBin}`)
    process.exit(1)
  }

  log('starting Taro watch mode...')
  taroProcess = spawnTaroWatch()

  taroProcess.stdout.on('error', () => {})
  taroProcess.stderr.on('error', () => {})

  wireStream(taroProcess.stdout, (line) => process.stdout.write(`${line}\n`))
  wireStream(taroProcess.stderr, (line) => process.stderr.write(`${line}\n`))

  taroProcess.on('error', (error) => {
    console.error(`[dev:weapp] Failed to start Taro watch: ${error.message}`)
    stopAll(1)
  })

  taroProcess.on('exit', (code, signal) => {
    taroProcess = null
    if (signal === 'SIGINT') {
      process.exit(0)
      return
    }
    if (signal) {
      console.error(`[dev:weapp] Taro watch exited with signal ${signal}`)
      process.exit(1)
      return
    }
    if (code !== 0) {
      console.error(`[dev:weapp] Taro watch exited with code ${code}`)
      process.exit(code || 1)
      return
    }
    process.exit(0)
  })
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))

start()
