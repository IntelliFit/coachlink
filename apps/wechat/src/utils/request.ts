import Taro from '@tarojs/taro'
import { AUTH_SESSION_INVALID_EVENT } from '../services/authSessionEvents'
import { resolveApiBaseUrl } from './apiBaseUrl'
import { isXPayTrialClient } from './xpayTrial'
import { WECHAT_PURCHASE_PAUSED_MESSAGE, isWechatPurchasePaused, wechatReleaseHeaders, wechatCoachPurchaseHeaders } from '@coachlink/core'

// 同一个上传包按微信 develop/trial/release 运行环境选择对应 API。
export const API_BASE_URL = resolveApiBaseUrl()

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: Record<string, string>
  /** 当 success 为 false 时是否自动显示错误提示，默认 true */
  showErrorToast?: boolean
}

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
}

/**
 * 显示错误提示（当 API 返回 success:false 或请求异常时）
 */
function showErrorToast(message: string, showErrorToastOpt = true) {
  if (showErrorToastOpt && message) {
    Taro.showToast({
      title: message,
      icon: 'none',
      duration: 2500
    })
  }
}

let lastAuthInvalidToastAt = 0
type AuthTokenStatus = 'valid' | 'invalid' | 'unknown'

let authTokenValidationPromise: Promise<AuthTokenStatus> | null = null
let wechatSessionRecoveryPromise: Promise<string | null> | null = null

function clearInvalidAuthSession(message: string) {
  try {
    Taro.removeStorageSync('user')
    Taro.removeStorageSync('token')
    Taro.eventCenter.trigger(AUTH_SESSION_INVALID_EVENT, { message })
  } catch (error) {
    console.debug('清理失效登录态失败:', error)
  }
}

function isAuthInvalidMessage(message?: string) {
  return Boolean(message && (
    message.includes('\u7528\u6237\u672a\u767b\u5f55') ||
    message.toLowerCase().includes('unauthorized')
  ))
}

async function validateAuthToken(token: string): Promise<AuthTokenStatus> {
  if (authTokenValidationPromise) return authTokenValidationPromise

  authTokenValidationPromise = (async () => {
    try {
      const response = await Taro.request({
        url: `${API_BASE_URL}/api/miniapp/session`,
        method: 'GET',
        header: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        timeout: 10000
      })

      if (response.statusCode === 200 && response.data?.success === true) return 'valid'
      if (response.statusCode === 401) return 'invalid'
      return 'unknown'
    } catch (error) {
      console.warn('[auth-session] token validation unavailable:', error)
      return 'unknown'
    }
  })()

  try {
    return await authTokenValidationPromise
  } finally {
    authTokenValidationPromise = null
  }
}

async function recoverWechatSession(rejectedToken: string): Promise<string | null> {
  // Never replace a selected debug identity with the operator's WeChat account.
  if (rejectedToken.startsWith('cldev.')) return null
  if (wechatSessionRecoveryPromise) return wechatSessionRecoveryPromise

  wechatSessionRecoveryPromise = (async () => {
    try {
      const storedUser = Taro.getStorageSync('user')
      const storedToken = String(Taro.getStorageSync('token') || '').trim()
      const storedUserId = storedUser?.id ? String(storedUser.id) : ''

      // Another concurrent request may already have refreshed this session.
      if (storedToken && storedToken !== rejectedToken) return storedToken

      // Password-only accounts cannot be silently mapped to a WeChat identity.
      if (!storedUserId || !storedUser?.wechat_openid) return null

      const loginResult = await Taro.login()
      if (!loginResult.code) return null

      const response = await Taro.request({
        url: `${API_BASE_URL}/api/miniapp/wechat-login`,
        method: 'POST',
        data: { code: loginResult.code, phoneCode: null },
        header: { 'Content-Type': 'application/json' },
        timeout: 15000
      })
      const nextToken = String(response.data?.data?.token || '').trim()
      const nextUser = response.data?.data?.user
      const nextUserId = nextUser?.id ? String(nextUser.id) : ''

      if (response.statusCode !== 200 || response.data?.success !== true || !nextToken || nextUserId !== storedUserId) {
        console.warn('[auth-session] silent WeChat recovery rejected', {
          statusCode: response.statusCode,
          sameUser: !!nextUserId && nextUserId === storedUserId
        })
        return null
      }

      Taro.setStorageSync('token', nextToken)
      Taro.setStorageSync('user', nextUser)
      console.info('[auth-session] WeChat session silently recovered')
      return nextToken
    } catch (error) {
      console.warn('[auth-session] silent WeChat recovery unavailable:', error)
      return null
    }
  })()

  try {
    return await wechatSessionRecoveryPromise
  } finally {
    wechatSessionRecoveryPromise = null
  }
}

function responseIndicatesInvalidAuth(response: any, hasToken: boolean) {
  if (!hasToken) return false
  if (response?.statusCode === 401) return true
  const result = response?.data
  return Boolean(
    response?.statusCode === 200 &&
    result &&
    typeof result === 'object' &&
    result.success === false &&
    isAuthInvalidMessage(result.message)
  )
}

/**
 * 微信会把底层网络栈错误（例如 ERR_ADDRESS_UNREACHABLE）原样放进 errMsg。
 * 这些信息只保留在控制台用于诊断，用户端统一显示简短、可操作的中文提示。
 */
function getNetworkFailureMessage(error: any) {
  const rawMessage = String(error?.errMsg || error?.message || '').trim()
  const normalized = rawMessage.toLowerCase()

  if (normalized.includes('timeout')) {
    return '网络请求超时，请稍后重试'
  }

  if (
    normalized.includes('err_address_unreachable') ||
    normalized.includes('address unreachable') ||
    normalized.includes('network is unreachable')
  ) {
    return '无法连接服务器，请切换网络后重试'
  }

  if (
    normalized.includes('err_name_not_resolved') ||
    normalized.includes('name resolution') ||
    normalized.includes('dns')
  ) {
    return '网络解析失败，请切换网络后重试'
  }

  if (
    normalized.includes('url not in domain list') ||
    normalized.includes('不在以下 request 合法域名列表中')
  ) {
    return '当前版本网络配置异常，请更新后重试'
  }

  return '网络连接失败，请检查网络后重试'
}

/**
 * 封装的请求方法
 * 当 API 返回 success:false 或请求异常时，会自动通过 Taro.showToast 显示错误信息（可通过 showErrorToast: false 关闭）
 */
export async function request<T = any>(options: RequestOptions): Promise<ApiResponse<T>> {
  const { url, method = 'GET', data, header = {}, showErrorToast: showErrorToastOpt = true } = options
  const adminTrialRequest = url === '/api/payment/wechat/membership/create'
    && header['x-coachlink-xpay-admin-trial'] === '1' && isXPayTrialClient()
  if (method === 'POST' && isWechatPurchasePaused(url) && !adminTrialRequest) {
    showErrorToast(WECHAT_PURCHASE_PAUSED_MESSAGE, showErrorToastOpt)
    return { success: false, message: WECHAT_PURCHASE_PAUSED_MESSAGE }
  }
  
  // 从本地存储获取token，自动添加到请求头
  let token: string | null = null;
  try {
    token = Taro.getStorageSync('token');
  } catch (error) {
    console.debug('获取token失败:', error);
  }
  
  // 如果存在token，自动添加到Authorization header
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...header,
    ...wechatReleaseHeaders(),
    ...wechatCoachPurchaseHeaders()
  };
  
  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  const fullUrl = `${API_BASE_URL}${url}`
  console.log(`🌐 ${method} ${fullUrl}`)
  if (data) {
    console.log('📤 请求数据:', data)
  }
  if (token) console.log('🔑 已携带登录凭证')

  try {
    const executeRequest = (authToken: string | null) => Taro.request({
      url: fullUrl,
      method,
      data,
      header: {
        ...requestHeaders,
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
      },
      timeout: 30000
    })

    let activeToken = token
    let authTokenStatus: AuthTokenStatus | null = null
    let response = await executeRequest(activeToken)

    // A request from the previous account must not retry under, or clear, the
    // newly selected debug identity (or the restored original identity).
    if (String(Taro.getStorageSync('token') || '') !== String(activeToken || '')) {
      return { success: false, message: '账号已切换，请在当前页面重试' }
    }

    if (activeToken && responseIndicatesInvalidAuth(response, true)) {
      authTokenStatus = await validateAuthToken(activeToken)

      if (authTokenStatus === 'invalid') {
        const recoveredToken = await recoverWechatSession(activeToken)
        if (recoveredToken) {
          activeToken = recoveredToken
          authTokenStatus = 'valid'
          response = await executeRequest(activeToken)
        }
      }
    }

    // 检查HTTP状态码
    if (response.statusCode !== 200) {
      const body = response.data
      const bodyMessage = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
        : ''
      const isUnauthorized = response.statusCode === 401
      const message = isUnauthorized && activeToken && authTokenStatus === 'invalid'
        ? '\u767b\u5f55\u72b6\u6001\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55'
        : isUnauthorized && activeToken && authTokenStatus === 'unknown'
          ? '\u767b\u5f55\u72b6\u6001\u6821\u9a8c\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5'
          : (bodyMessage || `Request failed: ${response.statusCode}`)
      const errResult: ApiResponse<T> = body && typeof body === 'object'
        ? { ...body, success: false, message }
        : { success: false, message }
      if (isUnauthorized && activeToken && authTokenStatus === 'invalid') {
        clearInvalidAuthSession(message)
        const now = Date.now()
        if (now - lastAuthInvalidToastAt > 3000) {
          lastAuthInvalidToastAt = now
          showErrorToast(message, showErrorToastOpt)
        }
      } else {
        showErrorToast(message, showErrorToastOpt)
      }
      return errResult
    }

    const result = response.data as ApiResponse<T>
    // 当 API 返回 success:false 时自动显示错误提示
    if (result && typeof result === 'object' && 'success' in result && !result.success) {
      const resultMessage = result.message || '????'
      if (activeToken && isAuthInvalidMessage(resultMessage) && authTokenStatus === 'invalid') {
        clearInvalidAuthSession('\u767b\u5f55\u72b6\u6001\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55')
      }
      showErrorToast(resultMessage, showErrorToastOpt)
    }
    return result
  } catch (error: any) {
    const userMessage = getNetworkFailureMessage(error)
    console.error('❌ 请求错误:', error, '→', {
      method,
      url: fullUrl,
      userMessage
    })
    showErrorToast(userMessage, showErrorToastOpt)
    return {
      success: false,
      message: userMessage
    }
  }
}

/**
 * BaseService 基类
 */
export class BaseService {
  constructor(protected baseUrl: string) {}

  protected async post<T = any>(
    name: string,
    data?: any,
    options: { showErrorToast?: boolean } = {}
  ): Promise<ApiResponse<T>> {
    return request<T>({
      url: `${this.baseUrl}/${name}`,
      method: 'POST',
      data,
      showErrorToast: options.showErrorToast
    })
  }

  protected async get<T = any>(name: string): Promise<ApiResponse<T>> {
    return request<T>({
      url: `${this.baseUrl}/${name}`,
      method: 'GET'
    })
  }

  protected async put<T = any>(name: string, data?: any): Promise<ApiResponse<T>> {
    return request<T>({
      url: `${this.baseUrl}/${name}`,
      method: 'PUT',
      data
    })
  }

  protected async delete<T = any>(name: string): Promise<ApiResponse<T>> {
    return request<T>({
      url: `${this.baseUrl}/${name}`,
      method: 'DELETE'
    })
  }
}
