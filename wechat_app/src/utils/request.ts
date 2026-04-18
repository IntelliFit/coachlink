import Taro from '@tarojs/taro'

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
      const message = bodyMessage || `请求失败: ${response.statusCode}`
      const errResult = { success: false, message }
      showErrorToast(message, showErrorToastOpt)
      return errResult
    }

    const result = response.data as ApiResponse<T>
    // 当 API 返回 success:false 时自动显示错误提示
    if (result && typeof result === 'object' && 'success' in result && !result.success) {
      showErrorToast(result.message || '操作失败', showErrorToastOpt)
    }
    return result
  } catch (error: any) {
    const errMsg = error?.errMsg || error?.message || '网络请求失败'
    const errHint = errMsg.includes('url not in domain list') || errMsg.includes('不在以下 request 合法域名列表中')
      ? '（请在微信开发者工具 详情→本地设置 中勾选「不校验合法域名」）'
      : errMsg.includes('fail') && !errMsg.includes('timeout')
        ? '（请确认后端已启动且 API 地址正确，开发时 urlCheck 需为 false）'
        : ''
    const fullMsg = errMsg + errHint
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

