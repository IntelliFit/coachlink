import * as FileSystem from 'expo-file-system/legacy'
import { getStoredToken } from './api'
import { API_BASE_URL } from './config'
import { readUploadResult, type UploadResult } from './uploadResult'
import { withTimeout } from './withTimeout'

const DEFAULT_TIMEOUT_MS = 180_000

/**
 * 把本地文件以 multipart 字段 file 传给接口。文件名取自 URI，选图和选文件得到的都是「UUID.扩展名」。
 *
 * 不能用 fetch + FormData：Expo 56 换掉了全局 fetch，FormData 里的 { uri, name, type } 会直接抛
 * Unsupported FormDataPart implementation，请求发不出去。
 */
export async function uploadFile(path: string, file: { uri: string; mimeType: string }, options?: { parameters?: Record<string, string>; timeoutMs?: number }): Promise<UploadResult> {
  const token = await getStoredToken()
  const response = await withTimeout(FileSystem.uploadAsync(`${API_BASE_URL.replace(/\/+$/, '')}${path}`, file.uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    mimeType: file.mimeType,
    parameters: options?.parameters,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
  }), options?.timeoutMs ?? DEFAULT_TIMEOUT_MS, '上传超时，请检查网络后重试')
  return readUploadResult(response.status, response.body)
}
