/**
 * 启动 Expo Mobile 开发服务，自动选择局域网 IP 并注入真机调试所需环境变量。
 */
const { execSync, spawn } = require('child_process')
const net = require('net')
const os = require('os')
const path = require('path')

const mobileDir = path.join(__dirname, '..', 'apps', 'mobile')
const apiPort = Number(process.env.MOBILE_DEV_API_PORT || process.env.PORT || 3000)
const preferredMetroPort = Number(process.env.MOBILE_DEV_METRO_PORT || 8081)

const SKIP_INTERFACE_PATTERNS = [
  /loopback/i,
  /docker/i,
  /vethernet/i,
  /vmware/i,
  /virtualbox/i,
  /hyper-v/i,
  /wsl/i,
  /npcap/i,
  /hamachi/i,
  /bluetooth/i,
  /pseudo/i,
  /tunnel/i,
  /teredo/i,
  /clash/i,
  /sing-box/i,
]

const PREFERRED_INTERFACE_PATTERNS = [/wi-?fi/i, /wlan/i, /无线/i, /以太网/i, /ethernet/i, /eth/i, /en\d/i]

/**
 * 短暂等待端口释放。
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 通过 bind 探测端口是否可监听。
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function canBindPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.once('error', () => resolve(false))
    server.listen(port, '0.0.0.0', () => {
      server.close(() => resolve(true))
    })
  })
}

/**
 * 读取 Windows 上监听指定端口的进程 PID 列表。
 * @param {number} port
 * @returns {number[]}
 */
function getWindowsListeningPids(port) {
  if (process.platform !== 'win32') {
    return []
  }

  try {
    const output = execSync('cmd /c netstat -ano | findstr LISTENING', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })

    const portPattern = new RegExp(`:${port}\\s`)
    const pids = new Set()

    for (const line of output.split(/\r?\n/)) {
      if (!portPattern.test(line)) {
        continue
      }

      const parts = line.trim().split(/\s+/)
      const pid = Number(parts[parts.length - 1])
      if (Number.isFinite(pid) && pid > 0) {
        pids.add(pid)
      }
    }

    return [...pids]
  } catch {
    return []
  }
}

/**
 * 读取 Unix 上监听指定端口的进程 PID 列表。
 * @param {number} port
 * @returns {number[]}
 */
function getUnixListeningPids(port) {
  try {
    const output = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()

    if (!output) {
      return []
    }

    return output
      .split(/\r?\n/)
      .map((value) => Number(value.trim()))
      .filter((pid) => Number.isFinite(pid) && pid > 0)
  } catch {
    return []
  }
}

/**
 * 获取监听端口的进程 PID。
 * @param {number} port
 * @returns {number[]}
 */
function getListeningPids(port) {
  return process.platform === 'win32' ? getWindowsListeningPids(port) : getUnixListeningPids(port)
}

/**
 * 结束进程。
 * @param {number} pid
 * @returns {boolean}
 */
function killPid(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
    } else {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' })
    }
    return true
  } catch {
    return false
  }
}

/**
 * 判断端口是否空闲。
 * @param {number} port
 * @returns {Promise<boolean>}
 */
async function isPortFree(port) {
  if (getListeningPids(port).length > 0) {
    return false
  }

  return canBindPort(port)
}

/**
 * 清理占用端口的旧进程。
 * @param {number} port
 * @returns {Promise<void>}
 */
async function clearPortListeners(port) {
  const pids = getListeningPids(port).filter((pid) => pid !== process.pid)
  if (pids.length === 0) {
    return
  }

  for (const pid of pids) {
    console.log(`[mobile-dev] 结束占用端口 ${port} 的进程 (PID ${pid})...`)
    killPid(pid)
  }

  await sleep(1000)
}

/**
 * 解析最终使用的 Metro 端口，尽量避免 Expo 交互式询问后退出。
 * @param {number} preferredPort
 * @returns {Promise<number>}
 */
async function resolveMetroPort(preferredPort) {
  await clearPortListeners(preferredPort)

  if (await isPortFree(preferredPort)) {
    return preferredPort
  }

  for (let offset = 1; offset < 10; offset += 1) {
    const candidatePort = preferredPort + offset
    await clearPortListeners(candidatePort)

    if (await isPortFree(candidatePort)) {
      console.log(
        `[mobile-dev] 警告: 端口 ${preferredPort} 仍被占用，自动改用 ${candidatePort}（无需手动确认）。`
      )
      return candidatePort
    }
  }

  throw new Error(`未能找到可用 Metro 端口（从 ${preferredPort} 起连续 10 个端口均被占用）。`)
}

/**
 * 判断是否为私有 IPv4 地址。
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateIPv4(ip) {
  if (!ip || ip.includes(':')) {
    return false
  }

  if (ip.startsWith('127.') || ip.startsWith('169.254.')) {
    return false
  }

  if (ip.startsWith('192.168.')) {
    return true
  }

  if (ip.startsWith('10.')) {
    return true
  }

  const parts = ip.split('.').map((part) => Number(part))
  return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31
}

/**
 * 为网卡候选地址打分，分数越高越优先。
 * @param {string} name
 * @param {string} ip
 * @returns {number}
 */
function scoreCandidate(name, ip) {
  let score = 0

  if (PREFERRED_INTERFACE_PATTERNS.some((pattern) => pattern.test(name))) {
    score += 100
  }

  if (ip.startsWith('192.168.')) {
    score += 50
  } else if (ip.startsWith('10.')) {
    score += 30
  } else {
    score += 10
  }

  return score
}

/**
 * 从本机网卡中选择最适合手机扫码的局域网 IPv4。
 * @returns {string | null}
 */
function detectLanIPv4() {
  const interfaces = os.networkInterfaces()
  const candidates = []

  for (const [name, entries] of Object.entries(interfaces)) {
    if (!entries || SKIP_INTERFACE_PATTERNS.some((pattern) => pattern.test(name))) {
      continue
    }

    for (const entry of entries) {
      if (!entry || entry.family !== 'IPv4' || entry.internal || !isPrivateIPv4(entry.address)) {
        continue
      }

      candidates.push({
        name,
        ip: entry.address,
        score: scoreCandidate(name, entry.address),
      })
    }
  }

  candidates.sort((left, right) => right.score - left.score)
  return candidates[0]?.ip ?? null
}

/**
 * 解析最终使用的局域网 IP，支持手动覆盖。
 * @returns {string}
 */
function resolveLanIP() {
  const manualIP = String(process.env.MOBILE_DEV_LAN_IP || '').trim()
  if (manualIP) {
    return manualIP
  }

  const detectedIP = detectLanIPv4()
  if (!detectedIP) {
    console.log('[mobile-dev] 未检测到局域网 IPv4，自动使用 localhost。真机调试可设置 MOBILE_DEV_LAN_IP=你的局域网IP。')
    return '127.0.0.1'
  }

  return detectedIP
}

async function main() {
  const lanIP = resolveLanIP()
  const metroPort = await resolveMetroPort(preferredMetroPort)
  const apiBaseUrl = `http://${lanIP}:${apiPort}`
  const expoUrl = `exp://${lanIP}:${metroPort}`
  const expoMode = lanIP.startsWith('127.') ? '--localhost' : '--lan'
  const expoPackagePath = [
    path.join(mobileDir, 'node_modules/expo/package.json'),
    path.join(__dirname, '..', 'node_modules/expo/package.json'),
  ].find((candidatePath) => {
    try {
      require.resolve(candidatePath)
      return true
    } catch {
      return false
    }
  })

  const expoSdkMajor = expoPackagePath
    ? String(require(expoPackagePath).version).split('.')[0]
    : '56'

  console.log('')
  console.log('[mobile-dev] 已选择开发主机:', lanIP)
  console.log('[mobile-dev] Metro 端口:', metroPort)
  console.log('[mobile-dev] 需要 Expo Go SDK:', expoSdkMajor)
  console.log('[mobile-dev] API 地址:', apiBaseUrl)
  console.log('[mobile-dev] 手机请扫下方二维码，或手动打开:', expoUrl)
  console.log('[mobile-dev] 请确保手机 Expo Go 为 SDK', `${expoSdkMajor}（https://expo.dev/go）`)
  console.log('[mobile-dev] 请确保后端已启动: npm run dev:backend')
  console.log('[mobile-dev] 说明: localhost 模式适合本机模拟器；真机调试请设置 MOBILE_DEV_LAN_IP。')
  console.log('')

  const child = spawn('npx', ['expo', 'start', expoMode, '--port', String(metroPort)], {
    cwd: mobileDir,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      REACT_NATIVE_PACKAGER_HOSTNAME: lanIP,
      RCT_METRO_PORT: String(metroPort),
      EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
    },
  })

  child.on('exit', (code) => process.exit(code ?? 0))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
