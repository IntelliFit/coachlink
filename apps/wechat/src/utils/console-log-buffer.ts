import Taro from '@tarojs/taro'

export const CONSOLE_LOG_BUFFER_LIMIT = 80

type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

export interface ConsoleLogEntry {
  level: ConsoleLevel
  message: string
  timestamp: string
}

const STORAGE_KEY = 'recent_console_logs_v1'
const METHODS: ConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug']
let installed = false

function readLogs(): ConsoleLogEntry[] {
  try {
    const value = Taro.getStorageSync(STORAGE_KEY)
    return Array.isArray(value) ? value.slice(-CONSOLE_LOG_BUFFER_LIMIT) : []
  } catch {
    return []
  }
}

function writeLogs(logs: ConsoleLogEntry[]) {
  try {
    Taro.setStorageSync(STORAGE_KEY, logs.slice(-CONSOLE_LOG_BUFFER_LIMIT))
  } catch {
    // ignore storage pressure while preserving the original console behavior
  }
}

function stringifyArg(value: unknown): string {
  if (value instanceof Error) {
    return value.stack || value.message
  }
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function appendLog(level: ConsoleLevel, args: unknown[]) {
  const message = args.map(stringifyArg).join(' ')
  const logs = readLogs()
  logs.push({
    level,
    message: message.slice(0, 1200),
    timestamp: new Date().toISOString()
  })
  writeLogs(logs)
}

export function installConsoleLogCapture() {
  if (installed) return
  installed = true

  METHODS.forEach((level) => {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      appendLog(level, args)
    }
  })
}

export function getRecentConsoleLogs(limit = CONSOLE_LOG_BUFFER_LIMIT) {
  return readLogs().slice(-Math.min(CONSOLE_LOG_BUFFER_LIMIT, Math.max(0, limit)))
}

export function clearRecentConsoleLogs() {
  writeLogs([])
}
