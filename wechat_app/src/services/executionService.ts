import Taro from '@tarojs/taro'
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

class ExecutionService {
  private readonly baseUrl = '/api/execution'

  /**
   * 开始或恢复训练
   */
  async startExecution(instanceId: string, dayIndex: number): Promise<any> {
    const res = await request({
      url: `${this.baseUrl}/start`,
      method: 'POST',
      data: { instanceId, dayIndex }
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
      data: { id: executionId }
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
    setNumber: number
  ): Promise<{ video_url?: string; url?: string } | null> {
    const token = Taro.getStorageSync('token') || ''
    return new Promise((resolve) => {
      Taro.uploadFile({
        url: `${API_BASE_URL}${this.baseUrl}/upload-set-video`,
        filePath,
        name: 'file',
        formData: {
          executionId,
          actionId,
          setNumber: String(setNumber)
        },
        header: {
          Authorization: token ? `Bearer ${token}` : ''
        },
        success: (uploadRes: any) => {
          try {
            const data = JSON.parse(uploadRes.data)
            if (data.success && data.data) resolve(data.data)
            else resolve(null)
          } catch {
            resolve(null)
          }
        },
        fail: () => resolve(null)
      })
    })
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
