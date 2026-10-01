import Taro from '@tarojs/taro'
import { wechatReleaseHeaders } from '@coachlink/core'
import { request, API_BASE_URL } from '../utils/request'

interface PRRecord {
  id: string
  exercise_name: string
  weight: number
  reps: number
  e1rm: number
  load_formula: string
  date_achieved: string
  video_url?: string
  notes?: string
  action_id?: string
  execution_id?: string
  is_auto_calculated: boolean
  created_at: string
}

const SET_VIDEO_CHUNK_SIZE_BYTES = 768 * 1024

interface UploadSetVideoOptions {
  fileSize?: number
  fileName?: string
  contentType?: string
}

interface UploadSetVideoResult {
  video_url?: string
  url?: string
}

function parseApiPayload(raw: any): any {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return raw
}

function createUploadId() {
  const rand = Math.random().toString(36).slice(2, 12)
  return `${Date.now()}_${rand}`
}

function getFileNameFromPath(filePath: string) {
  const cleanPath = String(filePath || '').split('?')[0]
  const name = cleanPath.split(/[\\/]/).pop() || `set-video-${Date.now()}.mp4`
  return /\.[a-z0-9]{1,12}$/i.test(name) ? name : `${name}.mp4`
}

function inferVideoContentType(fileNameOrPath: string) {
  const lower = fileNameOrPath.toLowerCase()
  if (lower.endsWith('.mov')) return 'video/quicktime'
  if (lower.endsWith('.m4v')) return 'video/x-m4v'
  if (lower.endsWith('.webm')) return 'video/webm'
  return 'video/mp4'
}

function binaryStringToArrayBuffer(input: string) {
  const buffer = new ArrayBuffer(input.length)
  const view = new Uint8Array(buffer)
  for (let index = 0; index < input.length; index += 1) {
    view[index] = input.charCodeAt(index) & 0xff
  }
  return buffer
}

function normalizeFileReadData(data: any): ArrayBuffer | null {
  if (!data) return null
  if (data instanceof ArrayBuffer) return data
  if (Object.prototype.toString.call(data) === '[object ArrayBuffer]' || typeof data.byteLength === 'number') {
    return data as ArrayBuffer
  }
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  }
  if (typeof data === 'string') {
    return binaryStringToArrayBuffer(data)
  }
  return null
}

class ExecutionService {
  async recordCompletion(input: import('@coachlink/core/src/completionDate').RecordPlanCompletionInput) {
    const res = await request({ url: '/api/execution/record-completion', method: 'POST', data: input })
    if (!res?.success || !res.data) throw new Error(res?.message || '补记失败')
    return res.data
  }

  private readonly baseUrl = '/api/execution'

  private getAuthHeader() {
    const token = Taro.getStorageSync('token') || ''
    return {
      ...wechatReleaseHeaders(),
      Authorization: token ? `Bearer ${token}` : ''
    }
  }

  private async getFileSize(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      Taro.getFileInfo({
        filePath,
        success: (res: any) => resolve(Number(res.size || 0)),
        fail: (err: any) => reject(new Error(err?.errMsg || '无法读取视频文件信息'))
      })
    })
  }

  private async readFileChunk(filePath: string, position: number, length: number): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const fs = Taro.getFileSystemManager()
      ;(fs as any).readFile({
        filePath,
        position,
        length,
        success: (res: any) => {
          const data = normalizeFileReadData(res.data)
          if (data) {
            resolve(data)
            return
          }
          reject(new Error('读取视频分片失败'))
        },
        fail: (err: any) => reject(new Error(err?.errMsg || '读取视频分片失败'))
      })
    })
  }

  private async requestJson<T = any>(url: string, data: any, timeout = 300000): Promise<T | null> {
    const response: any = await Taro.request({
      url,
      method: 'POST',
      data,
      header: {
        ...this.getAuthHeader(),
        'Content-Type': 'application/json'
      },
      timeout
    } as any)
    const payload = parseApiPayload(response.data)
    if (response.statusCode !== 200 || !payload?.success) {
      throw new Error(payload?.message || `请求失败: ${response.statusCode}`)
    }
    return payload.data || null
  }

  private async uploadChunk(url: string, chunk: ArrayBuffer) {
    const response: any = await Taro.request({
      url,
      method: 'POST',
      data: chunk,
      header: {
        ...this.getAuthHeader(),
        'Content-Type': 'application/octet-stream'
      },
      timeout: 120000
    } as any)
    const payload = parseApiPayload(response.data)
    if (response.statusCode !== 200 || !payload?.success) {
      throw new Error(payload?.message || `分片上传失败: ${response.statusCode}`)
    }
  }

  private async uploadSetVideoByChunks(
    filePath: string,
    fileSize: number,
    executionId: string,
    actionId: string,
    setNumber: number,
    options?: UploadSetVideoOptions
  ): Promise<UploadSetVideoResult | null> {
    const uploadId = createUploadId()
    const totalChunks = Math.ceil(fileSize / SET_VIDEO_CHUNK_SIZE_BYTES)
    const fileName = options?.fileName || getFileNameFromPath(filePath)
    const contentType = options?.contentType || inferVideoContentType(fileName)

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const position = chunkIndex * SET_VIDEO_CHUNK_SIZE_BYTES
      const length = Math.min(SET_VIDEO_CHUNK_SIZE_BYTES, fileSize - position)
      const chunk = await this.readFileChunk(filePath, position, length)
      const query = [
        ['action', 'chunk'],
        ['uploadId', uploadId],
        ['chunkIndex', String(chunkIndex)],
        ['totalChunks', String(totalChunks)]
      ]
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&')
      await this.uploadChunk(`${API_BASE_URL}${this.baseUrl}/upload-set-video-chunk?${query}`, chunk)
    }

    return this.requestJson<UploadSetVideoResult>(
      `${API_BASE_URL}${this.baseUrl}/upload-set-video-chunk?action=complete`,
      {
        uploadId,
        executionId,
        actionId,
        setNumber,
        fileName,
        contentType,
        totalSize: fileSize,
        totalChunks
      }
    )
  }

  /**
   * 开始或恢复训练
   */
  async startExecution(
    instanceId: string,
    dayIndex: number,
    options?: { restartTimedOut?: boolean }
  ): Promise<any> {
    const res = await request({
      url: `${this.baseUrl}/start`,
      method: 'POST',
      data: { instanceId, dayIndex, restartTimedOut: !!options?.restartTimedOut }
    })
    if (res.success && res.data) return res.data
    return null
  }

  /**
   * 完成一组
   * @param executionId 执行记录ID
   * @param actionIndex 动作在列表中的索引（从0开始）
   * @param setIndex 组的索引（从0开始）
   * @param data 其他参数
   */
  async completeSet(
    executionId: string,
    actionIndex: number,
    setIndex: number,
    data: {
      actualWeight?: number | null
      actualReps?: number | null
      rpe?: number | null
      notes?: string
      videoUrl?: string
      isPR?: boolean
      actionId?: string
      hasVideo?: boolean
    }
  ): Promise<any> {
    const res = await request({
      url: `${this.baseUrl}/complete-set`,
      method: 'POST',
      data: {
        executionId,
        actionIndex,
        setIndex,
        actualWeight: data.actualWeight,
        actualReps: data.actualReps,
        rpe: data.rpe,
        notes: data.notes || undefined,
        videoUrl: data.videoUrl || undefined,
        isPR: data.isPR,
        is_pr: data.isPR,
        actionId: data.actionId,
        has_video: data.hasVideo || !!data.videoUrl
      }
    })
    if (res.success && res.data) return res.data
    return null
  }

  /**
   * 完成非力量项目（饮食/有氧/习惯）
   * 与网站 API 对齐：actionIndex, itemType, completed, actualContent, actualDistance, actualDuration
   */
  async completeItem(params: {
    executionId: string
    actionIndex: number
    itemType: 'DIET' | 'CARDIO' | 'HABIT'
    completed: boolean
    actualContent?: string
    actualDistance?: number
    actualDuration?: number
    notes?: string
  }): Promise<{ completedItems: number; totalItems: number } | null> {
    const res = await request({
      url: `${this.baseUrl}/complete-item`,
      method: 'POST',
      data: params
    })
    if (res.success && res.data) return res.data
    return null
  }

  /**
   * 添加额外组
   */
  async addExtraSet(
    executionId: string,
    actionIndex: number,
    params?: { weight?: number | string | null; reps?: number | string | null; restSeconds?: number | null }
  ): Promise<{ newSetIndex: number; totalSets: number } | null> {
    const res = await request({
      url: `${this.baseUrl}/extra-content/add-extra-set`,
      method: 'POST',
      data: { executionId, actionIndex, ...params }
    })
    if (res.success && res.data) return res.data
    return null
  }

  /**
   * 删除额外组（仅限 source: student_extra）
   */
  async deleteExtraSet(
    executionId: string,
    actionIndex: number,
    setIndex: number
  ): Promise<{ totalSets: number } | null> {
    const res = await request({
      url: `${this.baseUrl}/extra-content/delete-extra-set`,
      method: 'POST',
      data: { executionId, actionIndex, setIndex }
    })
    if (res.success && res.data) return res.data as { totalSets: number }
    return null
  }

  /**
   * 删除额外动作（仅限 source: student_extra）
   */
  async deleteExtraExercise(executionId: string, actionIndex: number): Promise<{ totalSets: number } | null> {
    const res = await request({
      url: `${this.baseUrl}/extra-content/delete-extra-exercise`,
      method: 'POST',
      data: { executionId, actionIndex }
    })
    if (res.success && res.data) return res.data as { totalSets: number }
    return null
  }

  /**
   * 添加额外动作
   */
  async addExtraExercise(
    executionId: string,
    actionId: string,
    actionName: string,
    options?: {
      sets?: Array<{ weight?: number | string | null; reps?: number | string | null; restSeconds?: number | null }>
      customData?: Record<string, any>
      suggestedTime?: string
      notes?: string
    }
  ): Promise<{ newActionIndex: number; totalSets: number } | null> {
    const res = await request({
      url: `${this.baseUrl}/extra-content/add-extra-exercise`,
      method: 'POST',
      data: {
        executionId,
        actionId,
        actionName,
        sets: options?.sets || [{ weight: null, reps: null }],
        customData: options?.customData,
        suggestedTime: options?.suggestedTime,
        notes: options?.notes
      }
    })
    if (res.success && res.data) return res.data
    return null
  }

  /**
   * 完成训练
   */
  async finishTraining(
    executionIdOrParams:
      | string
      | {
          executionId: string
          sessionNotes?: string
          mode?: 'quick'
        }
  ): Promise<any> {
    const data =
      typeof executionIdOrParams === 'string'
        ? { executionId: executionIdOrParams }
        : executionIdOrParams

    const res = await request({
      url: `${this.baseUrl}/finish`,
      method: 'POST',
      data
    })
    if (res.success) return res.data
    return null
  }

  /**
   * 取消误打开且尚未记录任何完成内容的计划训练
   */
  async cancelExecution(executionId: string): Promise<{ executionId: string; instanceId: string; dayIndex: number } | null> {
    const res = await request<{ executionId: string; instanceId: string; dayIndex: number }>({
      url: `${this.baseUrl}/cancel`,
      method: 'POST',
      data: { executionId }
    })
    if (res.success && res.data) return res.data
    return null
  }

  /**
   * 提交训练反馈（给教练）
   */
  async submitFeedback(params: {
    executionId: string
    content: string
    difficultyRating?: number
  }): Promise<{ id: string; created_at: string } | null> {
    const res = await request<{ id: string; created_at: string }>({
      url: `${this.baseUrl}/submit-feedback`,
      method: 'POST',
      data: params
    })
    if (res.success && res.data) return res.data
    return null
  }

  /**
   * 获取执行记录
   */
  async getExecution(executionId: string): Promise<any> {
    const res = await request({
      url: `${this.baseUrl}/get`,
      method: 'POST',
      data: { executionId }
    })
    if (res.success && res.data) return res.data
    return null
  }

  /**
   * 检查今天是否有执行记录
   */
  async checkToday(instanceId: string, dayIndex: number = 1): Promise<any> {
    const res = await request({
      url: `${this.baseUrl}/check-today`,
      method: 'POST',
      data: { instanceId, dayIndex }
    })
    if (res.success && res.data) return res.data
    return null
  }

  /**
   * 跳过当天训练
   */
  async skipDay(instanceId: string, dayIndex: number): Promise<boolean> {
    const res = await request({
      url: `${this.baseUrl}/skip-day`,
      method: 'POST',
      data: { instanceId, dayIndex }
    })
    return !!res.success
  }

  /**
   * 获取训练分享信息（包含 shareToken）
   */
  async getShareInfo(executionId: string): Promise<any | null> {
    const res = await request({
      url: `${this.baseUrl}/share-info`,
      method: 'POST',
      data: { id: executionId },
      showErrorToast: false
    })
    if (res.success && res.data) return res.data
    return null
  }

  /**
   * 上传组视频
   * 返回 video_url（与后端 API 字段一致）
   */
  async uploadSetVideo(
    filePath: string,
    executionId: string,
    actionId: string,
    setNumber: number,
    options?: UploadSetVideoOptions
  ): Promise<UploadSetVideoResult | null> {
    const providedFileSize = Number(options?.fileSize || 0)
    const fileSize = providedFileSize > 0 ? providedFileSize : await this.getFileSize(filePath)
    // 微信客户端的 multipart 请求在部分机型/网络链路会丢失 boundary，导致服务端
    // 无法解析 FormData。训练视频统一分片上传，避免短视频回退到该不稳定路径。
    return this.uploadSetVideoByChunks(filePath, fileSize, executionId, actionId, setNumber, options)
  }

  /**
   * 直接粘贴视频链接
   */
  async addSetVideoLink(
    executionId: string,
    actionId: string,
    setNumber: number,
    videoUrl: string
  ): Promise<{ video_url?: string } | null> {
    const res = await request({
      url: `${this.baseUrl}/add-set-video-link`,
      method: 'POST',
      data: { executionId, actionId, setNumber, videoUrl }
    })
    if (res.success && res.data) return res.data
    return null
  }

  /**
   * 计算 e1RM
   */
  async calculateE1RM(weight: number, reps: number, formula?: string): Promise<{ e1rm?: number } | null> {
    const res = await request({
      url: `${this.baseUrl}/calculate-e1rm`,
      method: 'POST',
      data: { weight, reps, formula }
    })
    if (res.success && res.data) return res.data
    return null
  }

  /**
   * 创建 PR 记录（需关联执行记录，训练中标记进步组时使用）
   */
  async createPR(data: {
    executionId: string
    actionId: string
    actionName: string
    setNumber: number
    weight: number
    reps: number
    rpe?: number
    notes?: string
    videoId?: string
  }): Promise<any | null> {
    const res = await request({
      url: `${this.baseUrl}/create-pr`,
      method: 'POST',
      data
    })
    if (res.success && res.data) return res.data
    return null
  }

  /**
   * 删除 PR 记录
   */
  async deletePRRecord(recordId: string): Promise<boolean> {
    const res = await request({
      url: `${this.baseUrl}/delete-pr-record`,
      method: 'POST',
      data: { recordId }
    })
    return !!res.success
  }

  /**
   * 获取PR记录
   */
  async getPRRecords(limit: number = 20, offset: number = 0, userId?: string): Promise<PRRecord[] | null> {
    const res = await request<{ records: PRRecord[]; total: number }>({
      url: `${this.baseUrl}/get-pr-records`,
      method: 'POST',
      data: { limit, offset, userId },
      showErrorToast: false
    })
    if (res.success && res.data) return res.data.records
    return null
  }
}

export const executionService = new ExecutionService()
