import Taro from '@tarojs/taro'
import { AUTH_SESSION_INVALID_EVENT } from '../services/authSessionEvents'

// API基础URL配置
// TARO_APP_API_URL 通过 defineConstants 在编译时注入
// @ts-ignore
export const API_BASE_URL = TARO_APP_API_URL || 'http://localhost:3000'

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
  code?: string
  errorCode?: string | number
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
    ...header
  };
  
  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  const fullUrl = `${API_BASE_URL}${url}`
  console.log(`🌐 ${method} ${fullUrl}`)
  if (data) {
    console.log('📤 请求数据:', data)
  }
  if (token) {
    console.log('🔑 携带token:', token.substring(0, 20) + '...')
  }

  try {
    const response = await Taro.request({
      url: fullUrl,
      method,
      data,
      header: requestHeaders,
      timeout: 30000
    })

    // 检查HTTP状态码
    if (response.statusCode !== 200) {
      const body = response.data
      const bodyMessage = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
        : ''
      const isUnauthorized = response.statusCode === 401
      const message = isUnauthorized && token
        ? '\u767b\u5f55\u72b6\u6001\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55'
        : (bodyMessage || `Request failed: ${response.statusCode}`)
      const errResult: ApiResponse<T> = body && typeof body === 'object'
        ? { ...body, success: false, message }
        : { success: false, message }
      if (isUnauthorized && token) {
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
      if (token && isAuthInvalidMessage(resultMessage)) {
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
