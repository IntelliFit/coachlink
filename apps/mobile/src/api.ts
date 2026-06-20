import AsyncStorage from '@react-native-async-storage/async-storage'
import { createCoachLinkApiClient, type ApiClientRequestOptions } from '@coachlink/api-client'
import type { AuthSession } from '@coachlink/core'
import { API_BASE_URL } from './config'

const ACCESS_TOKEN_KEY = 'coachlink_mobile_access_token'
const USER_KEY = 'coachlink_mobile_user'
const USER_ID_KEY = 'coachlink_mobile_user_id'

function timeoutSignal(timeoutMs?: number): AbortSignal | undefined {
  if (!timeoutMs || typeof AbortController === 'undefined') return undefined
  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
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
      const response = await fetch(url, {
        method: options?.method || 'GET',
        headers: options?.headers,
        body: options?.body == null ? undefined : JSON.stringify(options.body),
        signal: timeoutSignal(options?.timeoutMs),
      })
      return {
        status: response.status,
        data: await parseJsonResponse(response),
        headers: readHeaders(response),
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
