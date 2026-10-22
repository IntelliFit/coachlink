import Taro, { useDidShow } from '@tarojs/taro'
import { readMiniProgramEnvVersion } from './apiBaseUrl'
import { API_BASE_URL } from './request'

/**
 * Minimal mini-program page-enter tracing, written to the same admin_trace_events
 * table as the Web TraceReporter (event_type = page_enter).
 *
 * - path is the bare mini-program route (no query string, so no ids or user input);
 *   url is `weapp://<envVersion>/<route>` so develop/trial/release can be told apart
 *   and Web paths never collide with mini-program ones.
 * - Fires on every page show (first open, back navigation, return from background).
 * - Fire-and-forget: never toasts, never blocks navigation, never touches the login state.
 *   The server drops events outside production, so local and trial builds write nothing.
 */
const ANON_ID_KEY = 'trace_anon_id_v1'
const REPEAT_WINDOW_MS = 3000

const sessionId = randomId()
let lastTracked: { path: string; at: number } | null = null

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function readAnonId(): string {
  try {
    const stored = Taro.getStorageSync(ANON_ID_KEY)
    if (typeof stored === 'string' && stored) return stored
    const created = randomId()
    Taro.setStorageSync(ANON_ID_KEY, created)
    return created
  } catch {
    return 'anon'
  }
}

function readToken(): string {
  try {
    return String(Taro.getStorageSync('token') || '')
  } catch {
    return ''
  }
}

function readRoutes(): { path: string; fromPath: string | null } | null {
  const pages = Taro.getCurrentPages()
  const current = pages[pages.length - 1]
  if (!current?.route) return null
  const previous = pages[pages.length - 2]
  return {
    path: `/${current.route}`,
    fromPath: previous?.route ? `/${previous.route}` : null
  }
}

export function trackPageEnter(): void {
  if (!API_BASE_URL) return
  const routes = readRoutes()
  if (!routes) return

  const now = Date.now()
  if (lastTracked && lastTracked.path === routes.path && now - lastTracked.at < REPEAT_WINDOW_MS) return
  lastTracked = { path: routes.path, at: now }

  const token = readToken()
  const envVersion = readMiniProgramEnvVersion() || 'unknown'
  Taro.request({
    url: `${API_BASE_URL}/api/trace`,
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    data: {
      events: [{
        event_type: 'page_enter',
        path: routes.path,
        url: `weapp://${envVersion}${routes.path}`,
        from_path: routes.fromPath,
        anon_id: readAnonId(),
        session_id: sessionId,
        trace_id: randomId(),
        method: 'GET'
      }]
    },
    timeout: 10000
  }).catch(() => {
    // tracing must never surface errors to the user
  })
}

/** Call once at the top of a page component. */
export function usePageEnterTrace(): void {
  useDidShow(trackPageEnter)
}
