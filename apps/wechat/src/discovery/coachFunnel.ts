import Taro from '@tarojs/taro'
import {
  COACH_EXIT_CANDIDATE_STORAGE_KEY,
  COACH_EXIT_LAST_ASKED_STORAGE_KEY,
  shouldAskCoachExitReason,
  type CoachExitCandidate,
  type CoachFunnelEvent
} from '@coachlink/core/src/coachFunnel'
import { readMiniProgramEnvVersion } from '@/utils/apiBaseUrl'
import { readAnonId } from '@/utils/pageTrace'
import { API_BASE_URL } from '@/utils/request'

type FunnelPayload = {
  coachId?: string
  reason?: string
  note?: string
  properties?: Record<string, string | number | undefined>
}

function readToken(): string {
  try {
    return String(Taro.getStorageSync('token') || '')
  } catch {
    return ''
  }
}

/** 埋点绝不打扰用户：不弹提示、不阻塞页面，失败就算了。 */
export function trackCoachFunnel(event: CoachFunnelEvent, payload: FunnelPayload = {}): void {
  if (!API_BASE_URL) return
  const token = readToken()
  Taro.request({
    url: `${API_BASE_URL}/api/coach/funnel`,
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    data: {
      event,
      platform: 'weapp',
      anonId: readAnonId(),
      coachId: payload.coachId,
      reason: payload.reason,
      note: payload.note,
      properties: { ...payload.properties, env: readMiniProgramEnvVersion() || 'unknown' }
    },
    timeout: 10000
  }).catch(() => undefined)
}

function readJson<T>(key: string): T | null {
  try {
    return (Taro.getStorageSync(key) as T) || null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    Taro.setStorageSync(key, value)
  } catch {
    // 本地存储失败最多是少问一次
  }
}

export function rememberCoachExitCandidate(candidate: CoachExitCandidate): void {
  write(COACH_EXIT_CANDIDATE_STORAGE_KEY, candidate)
}

export function readCoachExitCandidate(): CoachExitCandidate | null {
  return readJson<CoachExitCandidate>(COACH_EXIT_CANDIDATE_STORAGE_KEY)
}

export function clearCoachExitCandidate(): void {
  try {
    Taro.removeStorageSync(COACH_EXIT_CANDIDATE_STORAGE_KEY)
  } catch {
    // 同上
  }
}

/** 取出这次该问的问题；取出即记为已问，同一次离开不会问两遍。 */
export function takeCoachExitQuestion(match?: (candidate: CoachExitCandidate) => boolean): CoachExitCandidate | null {
  const candidate = readCoachExitCandidate()
  if (!candidate || (match && !match(candidate))) return null
  const now = Date.now()
  const lastAskedAt = Number(readJson<number>(COACH_EXIT_LAST_ASKED_STORAGE_KEY)) || null
  clearCoachExitCandidate()
  if (!shouldAskCoachExitReason({ candidate, now, lastAskedAt })) return null
  write(COACH_EXIT_LAST_ASKED_STORAGE_KEY, now)
  return candidate
}
