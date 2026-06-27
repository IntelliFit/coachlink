import Taro from '@tarojs/taro'
import { authService } from '@/services/authService'
import {
  API_BASE_URL,
  RECENT_REQUEST_TRACE_LIMIT,
  createClientTraceHeaders,
  getHeaderValue,
  getRecentRequestTraces,
  recordRecentRequestTrace,
  request
} from '@/utils/request'
import {
  CONSOLE_LOG_BUFFER_LIMIT,
  getRecentConsoleLogs
} from '@/utils/console-log-buffer'

export type FeedbackCategory = 'bug' | 'suggestion' | 'experience' | 'other'

export const FEEDBACK_MAX_IMAGES = 4

export interface SubmitFeedbackInput {
  category: FeedbackCategory
  content: string
  contact?: string
  attachRecentRequests?: boolean
  imageUrls?: string[]
}

export interface SubmitFeedbackResult {
  success: boolean
  message: string
  feedbackId?: string
  id?: string
}

function getAppVersion() {
  try {
    const accountInfo = Taro.getAccountInfoSync()
    const miniProgram = accountInfo?.miniProgram
    return [miniProgram?.version, miniProgram?.envVersion].filter(Boolean).join(' / ')
  } catch {
    return ''
  }
}

export function getCurrentPagePath() {
  try {
    const pages = ((Taro as any).getCurrentPages?.() || []) as any[]
    const current = pages[pages.length - 1] as any
    if (!current) return ''
    const route = current.route || ''
    const options = current.options || {}
    const query = Object.keys(options)
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(options[key]))}`)
      .join('&')
    return query ? `/${route}?${query}` : `/${route}`
  } catch {
    return ''
  }
}

export function getClientInfo(includeDiagnostics: boolean) {
  let systemInfo: Record<string, unknown> = {}
  try {
    systemInfo = Taro.getSystemInfoSync() as unknown as Record<string, unknown>
  } catch {
    systemInfo = {}
  }

  const host = systemInfo.host && typeof systemInfo.host === 'object'
    ? systemInfo.host as Record<string, unknown>
    : {}

  return {
    app_version: getAppVersion(),
    env_version: host.env || '',
    platform: systemInfo.platform || '',
    system: systemInfo.system || '',
    model: systemInfo.model || '',
    brand: systemInfo.brand || '',
    sdk_version: systemInfo.SDKVersion || '',
    page_path: getCurrentPagePath(),
    console_logs: includeDiagnostics ? getRecentConsoleLogs(CONSOLE_LOG_BUFFER_LIMIT) : []
  }
}

export async function uploadFeedbackImage(localPath: string) {
  const token = authService.getToken()
  if (!token) {
    throw new Error('请先登录后再上传截图')
  }

  const url = '/api/feedback/upload-image'
  const fullUrl = `${API_BASE_URL}${url}`
  const startedAtMs = Date.now()
  const startedAt = new Date(startedAtMs).toISOString()
  const { clientTraceId, clientRequestId, headers: traceHeaders } = createClientTraceHeaders()
  let response: Taro.uploadFile.SuccessCallbackResult

  try {
    response = await Taro.uploadFile({
      url: fullUrl,
      filePath: localPath,
      name: 'file',
      header: {
        Authorization: `Bearer ${token}`,
        ...traceHeaders
      }
    })
  } catch (error: any) {
    const message = error?.errMsg || error?.message || '上传失败'
    recordRecentRequestTrace({
      id: clientRequestId,
      method: 'POST',
      url,
      status: 'network_error',
      success: false,
      duration_ms: Date.now() - startedAtMs,
      started_at: startedAt,
      request_id: clientRequestId,
      trace_id: clientTraceId,
      message
    })
    throw new Error(message)
  }

  let parsed: any = null
  let parseError = false
  try {
    parsed = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
  } catch {
    parseError = true
  }

  const responseTraceId = getHeaderValue(response.header, 'x-trace-id') || clientTraceId
  const responseRequestId = getHeaderValue(response.header, 'x-request-id') || clientRequestId
  const responseMessage = parsed?.message || (parseError ? '上传响应解析失败' : '')
  recordRecentRequestTrace({
    id: clientRequestId,
    method: 'POST',
    url,
    status: response.statusCode,
    success: response.statusCode >= 200 && response.statusCode < 300 && Boolean(parsed?.success),
    duration_ms: Date.now() - startedAtMs,
    started_at: startedAt,
    request_id: responseRequestId,
    trace_id: responseTraceId,
    message: responseMessage
  })

  if (parseError) {
    throw new Error('上传响应解析失败')
  }

  if (response.statusCode < 200 || response.statusCode >= 300 || !parsed?.success) {
    throw new Error(parsed?.message || `上传失败：${response.statusCode}`)
  }

  const imageUrl = parsed?.data?.imageUrl || parsed?.data?.url
  if (!imageUrl) {
    throw new Error('上传成功但未返回图片地址')
  }
  return { imageUrl: String(imageUrl) }
}

export async function submitFeedback(input: SubmitFeedbackInput) {
  const includeDiagnostics = Boolean(input.attachRecentRequests)
  const res = await request<SubmitFeedbackResult>({
    url: '/api/feedback',
    method: 'POST',
    data: {
      category: input.category,
      content: input.content,
      contact: input.contact || '',
      page_path: getCurrentPagePath(),
      app_version: getAppVersion(),
      client_info: getClientInfo(includeDiagnostics),
      recent_requests: includeDiagnostics ? getRecentRequestTraces(RECENT_REQUEST_TRACE_LIMIT) : [],
      image_urls: (input.imageUrls || []).slice(0, FEEDBACK_MAX_IMAGES)
    }
  })

  if (!res.success) {
    throw new Error(res.message || '提交失败')
  }

  return res.data || {
    success: true,
    message: res.message || '反馈提交成功'
  }
}
