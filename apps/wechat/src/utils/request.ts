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
}

export interface RecentRequestTrace {
  id: string
  method: string
  url: string
  status: number | string | null
  success: boolean
  duration_ms: number
  started_at: string
  request_id: string
  trace_id: string
  message?: string
}

export const RECENT_REQUEST_TRACE_LIMIT = 50
const RECENT_REQUEST_TRACE_STORAGE_KEY = 'recent_request_traces_v1'

function randomTraceId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function createClientTraceHeaders() {
  const clientTraceId = randomTraceId('trace')
  const clientRequestId = randomTraceId('req')
  return {
    clientTraceId,
    clientRequestId,
    headers: {
      'X-Client-Trace-Id': clientTraceId,
      'X-Client-Request-Id': clientRequestId
    }
  }
}

function readRecentRequestTraces(): RecentRequestTrace[] {
  try {
    const value = Taro.getStorageSync(RECENT_REQUEST_TRACE_STORAGE_KEY)
    return Array.isArray(value) ? value.slice(-RECENT_REQUEST_TRACE_LIMIT) : []
  } catch {
    return []
  }
}

function appendRecentRequestTrace(trace: RecentRequestTrace) {
  try {
    const traces = readRecentRequestTraces()
    traces.push(trace)
    Taro.setStorageSync(RECENT_REQUEST_TRACE_STORAGE_KEY, traces.slice(-RECENT_REQUEST_TRACE_LIMIT))
  } catch {
    // diagnostics are best-effort only
  }
}

export function recordRecentRequestTrace(trace: RecentRequestTrace) {
  appendRecentRequestTrace(trace)
}

export function getRecentRequestTraces(limit = RECENT_REQUEST_TRACE_LIMIT) {
  return readRecentRequestTraces().slice(-Math.min(RECENT_REQUEST_TRACE_LIMIT, Math.max(0, limit)))
}

export function getHeaderValue(headers: unknown, name: string) {
  if (!headers || typeof headers !== 'object') return ''
  const target = name.toLowerCase()
  const found = Object.entries(headers as Record<string, unknown>).find(([key]) => key.toLowerCase() === target)
  return typeof found?.[1] === 'string' ? found[1] : ''
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
  const startedAtMs = Date.now()
  const startedAt = new Date(startedAtMs).toISOString()
  const { clientTraceId, clientRequestId, headers: traceHeaders } = createClientTraceHeaders()
  Object.assign(requestHeaders, traceHeaders)
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
    const duration = Date.now() - startedAtMs
    const responseHeaders = response.header || {}
    const responseTraceId = getHeaderValue(responseHeaders, 'x-trace-id') || clientTraceId
    const responseRequestId = getHeaderValue(responseHeaders, 'x-request-id') || clientRequestId

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
      const errResult = { success: false, message }
      appendRecentRequestTrace({
        id: clientRequestId,
        method,
        url,
        status: response.statusCode,
        success: false,
        duration_ms: duration,
        started_at: startedAt,
        request_id: responseRequestId,
        trace_id: responseTraceId,
        message
      })
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
    appendRecentRequestTrace({
      id: clientRequestId,
      method,
      url,
      status: response.statusCode,
      success: Boolean(result?.success),
      duration_ms: duration,
      started_at: startedAt,
      request_id: responseRequestId,
      trace_id: responseTraceId,
      message: result?.message
    })
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
    const duration = Date.now() - startedAtMs
    const errMsg = error?.errMsg || error?.message || '网络请求失败'
    const errHint = errMsg.includes('url not in domain list') || errMsg.includes('不在以下 request 合法域名列表中')
      ? '（请在微信开发者工具 详情→本地设置 中勾选「不校验合法域名」）'
      : errMsg.includes('fail') && !errMsg.includes('timeout')
        ? '（请确认后端已启动且 API 地址正确，开发时 urlCheck 需为 false）'
        : ''
    const fullMsg = errMsg + errHint
    appendRecentRequestTrace({
      id: clientRequestId,
      method,
      url,
      status: 'network_error',
      success: false,
      duration_ms: duration,
      started_at: startedAt,
      request_id: clientRequestId,
      trace_id: clientTraceId,
      message: fullMsg
    })
    console.error('❌ 请求错误:', error, '→', fullMsg)
    showErrorToast(fullMsg, showErrorToastOpt)
    return {
      success: false,
      message: fullMsg
    }
  }
}

/**
 * BaseService 基类
 */
export class BaseService {
  constructor(protected baseUrl: string) {}

  protected async post<T = any>(name: string, data?: any): Promise<ApiResponse<T>> {
    return request<T>({
      url: `${this.baseUrl}/${name}`,
      method: 'POST',
      data
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
