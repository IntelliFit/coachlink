import AsyncStorage from '@react-native-async-storage/async-storage'
import { createCoachLinkApiClient, type ApiClientRequestOptions } from '@coachlink/api-client'
import type { AuthSession } from '@coachlink/core'
import { API_BASE_URL } from './config'

const ACCESS_TOKEN_KEY = 'coachlink_mobile_access_token'
const USER_KEY = 'coachlink_mobile_user'
const USER_ID_KEY = 'coachlink_mobile_user_id'
const MOBILE_CACHE_KEYS = [
  'today_training_page_cache_v1',
  'training_execution_snapshots_v1',
  'training_rest_timers_v1',
  'one_arm_pull_up_assessment_v1',
  'power-analysis-last-downloadable-job-v1',
  'motion-effects-last-job-v1',
  'sl_calc_form_data',
  'sl_calc_last_run',
  'knowledge_home_cache_v1',
] as const
const MOBILE_CACHE_PREFIXES = ['coachlink_mobile_chat_messages_v1:'] as const

function timeoutSignal(timeoutMs?: number): { signal: AbortSignal; cancel: () => void } | undefined {
  if (!timeoutMs || typeof AbortController === 'undefined') return undefined
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  }
}

export async function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
  timeoutMs = 180_000,
): Promise<Response> {
  const timeout = timeoutSignal(timeoutMs)
  try {
    return await fetch(input, {
      ...init,
      signal: timeout?.signal || init?.signal,
    })
  } catch (error) {
    if (timeout?.signal.aborted) throw new Error('请求超时，请检查网络后重试')
    throw error
  } finally {
    timeout?.cancel()
  }
}
async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

function readHeaders(response: Response): Record<string, string> {
  const out: Record<string, string> = {}
  response.headers.forEach((value: string, key: string) => {
    out[key] = value
  })
  return out
}

export const apiClient = createCoachLinkApiClient({
  baseUrl: API_BASE_URL,
  adapters: {
    async request(url: string, options?: ApiClientRequestOptions) {
      const timeout = timeoutSignal(options?.timeoutMs)
      try {
        const response = await fetch(url, {
          method: options?.method || 'GET',
          headers: options?.headers,
          body: options?.body == null ? undefined : JSON.stringify(options.body),
          signal: timeout?.signal,
        })
        return {
          status: response.status,
          data: await parseJsonResponse(response),
          headers: readHeaders(response),
        }
      } finally {
        timeout?.cancel()
      }
    },
    tokenStorage: {
      async getAccessToken() {
        return AsyncStorage.getItem(ACCESS_TOKEN_KEY)
      },
      async setSession(session: AuthSession) {
        await AsyncStorage.multiSet([
          [ACCESS_TOKEN_KEY, session.token],
          [USER_KEY, JSON.stringify(session.user)],
          [USER_ID_KEY, session.user.id],
        ])
      },
      async clearSession() {
        await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, USER_KEY, USER_ID_KEY])
      },
    },
  },
})

export async function hasStoredToken(): Promise<boolean> {
  return Boolean(await AsyncStorage.getItem(ACCESS_TOKEN_KEY))
}

export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY)
}

export async function getStoredUser(): Promise<AuthSession['user'] | null> {
  const raw = await AsyncStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthSession['user']
  } catch {
    return null
  }
}

export async function persistSession(session: AuthSession): Promise<void> {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, session.token],
    [USER_KEY, JSON.stringify(session.user)],
    [USER_ID_KEY, session.user.id],
  ])
}

export async function persistStoredUser(user: AuthSession['user']): Promise<void> {
  await AsyncStorage.multiSet([
    [USER_KEY, JSON.stringify(user)],
    [USER_ID_KEY, user.id],
  ])
}

export async function clearMobileAppCache(): Promise<number> {
  const existingKeys = new Set(await AsyncStorage.getAllKeys())
  const keys = [...existingKeys].filter((key) => (
    MOBILE_CACHE_KEYS.includes(key as (typeof MOBILE_CACHE_KEYS)[number])
    || MOBILE_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))
  ))
  if (keys.length > 0) await AsyncStorage.multiRemove([...keys])
  return keys.length
}
