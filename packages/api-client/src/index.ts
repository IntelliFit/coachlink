import type { ApiResponse, AuthSession, CoachLinkUser } from '@coachlink/core'

export type ApiClientRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: unknown
  timeoutMs?: number
}

export type ApiClientResponse<T = unknown> = {
  status: number
  data: T
  headers?: Record<string, string>
}

export type TokenStorage = {
  getAccessToken: () => Promise<string | null>
  setSession: (session: AuthSession) => Promise<void>
  clearSession: () => Promise<void>
}

export type ApiClientAdapters = {
  request: (url: string, options?: ApiClientRequestOptions) => Promise<ApiClientResponse>
  tokenStorage: TokenStorage
}

export type CoachLinkApiClientOptions = {
  baseUrl: string
  adapters: ApiClientAdapters
}

export type LoginWithPasswordInput = {
  phoneOrEmail: string
  password: string
}

export type LoginWithCodeInput = {
  phoneOrEmail: string
  verifyCode: string
}

export type RegisterInput = {
  phoneOrEmail: string
  password: string
  verifyCode: string
  ref?: string
  shareId?: string
  invitationCode?: string
  invitationMode?: 'exclusive' | 'open'
}

export type SendSmsCodeInput = {
  phoneNumber: string
  captchaToken?: string
}

type LoginPayload = {
  user: CoachLinkUser
  token?: string
}

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

function responseMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = String((data as { message?: unknown }).message || '').trim()
    if (message) return message
  }
  return fallback
}

function normalizeApiData<T>(data: unknown): ApiResponse<T> {
  if (data && typeof data === 'object' && 'success' in data) {
    return data as ApiResponse<T>
  }
  return { success: true, data: data as T }
}

export function createCoachLinkApiClient({ baseUrl, adapters }: CoachLinkApiClientOptions) {
  async function request<T>(path: string, options?: ApiClientRequestOptions): Promise<T> {
    const token = await adapters.tokenStorage.getAccessToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await adapters.request(joinUrl(baseUrl, path), {
      ...options,
      headers,
    })

    const result = normalizeApiData<T>(response.data)
    if (response.status < 200 || response.status >= 300 || result.success === false) {
      throw new Error(responseMessage(response.data, `Request failed: ${response.status}`))
    }

    return result.data as T
  }

  async function persistLoginPayload(payload: LoginPayload): Promise<AuthSession> {
    if (!payload?.user?.id || !payload.token) {
      throw new Error('登录结果异常，请重新登录')
    }

    const session = { user: payload.user, token: payload.token }
    await adapters.tokenStorage.setSession(session)
    return session
  }

  async function loginWithPassword(input: LoginWithPasswordInput) {
    const payload = await request<LoginPayload>('/api/miniapp/login', {
      method: 'POST',
      body: {
        phoneOrEmail: input.phoneOrEmail,
        password: input.password,
      },
    })
    return persistLoginPayload(payload)
  }

  async function loginWithCode(input: LoginWithCodeInput) {
    const payload = await request<LoginPayload>('/api/miniapp/login', {
      method: 'POST',
      body: {
        phoneOrEmail: input.phoneOrEmail,
        verifyCode: input.verifyCode,
      },
    })
    return persistLoginPayload(payload)
  }

  return {
    request,
    clearSession: adapters.tokenStorage.clearSession,
    loginWithPassword,
    loginWithCode,
    async register(input: RegisterInput) {
      await request<{ user: CoachLinkUser }>('/api/auth/register', {
        method: 'POST',
        body: input,
      })
      return loginWithPassword({
        phoneOrEmail: input.phoneOrEmail,
        password: input.password,
      })
    },
    async sendSmsCode(input: SendSmsCodeInput) {
      return request('/api/sms/send-verification-code', {
        method: 'POST',
        body: input,
      })
    },
  }
}
