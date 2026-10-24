import { request } from '../utils/request'

export interface ImpromptuActionInput {
  actionId?: string | null
  actionName: string
  itemType?: 'STRENGTH' | 'CARDIO'
  attrs?: string[] | null
  category?: string | null
  itemSchema?: Record<string, unknown> | null
  suggestedTime?: string | null
  sets: number
  reps?: number | string | null
  weight?: number | string | null
  restSeconds?: number | null
}

export interface StartImpromptuDto {
  actions: ImpromptuActionInput[]
}

export interface StartImpromptuResponseDto {
  id: string
  student_id: string
  status: string
  action_executions: any[]
  total_sets: number
  completed_sets: number
  started_at: string
}

export interface FinishImpromptuOptions {
  mode?: 'quick'
  sessionNotes?: string
}

class ImpromptuService {
  private readonly baseUrl = '/api/impromptu'

  /** 开始即兴训练 */
  async start(actions: ImpromptuActionInput[]): Promise<StartImpromptuResponseDto | null> {
    const res = await request({
      url: `${this.baseUrl}/start`,
      method: 'POST',
      data: { actions }
    })
    if (res.success && res.data) return res.data as StartImpromptuResponseDto
    return null
  }

  /** 获取即兴执行详情 */
  async get(impromptuId: string): Promise<any | null> {
    const res = await request({
      url: `${this.baseUrl}/get`,
      method: 'POST',
      data: { id: impromptuId }
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** 获取当前仍在进行中的即兴训练；没有时返回 null。 */
  async getCurrent(): Promise<StartImpromptuResponseDto | null> {
    const res = await request<StartImpromptuResponseDto | null>({
      url: `${this.baseUrl}/current`,
      method: 'GET',
      showErrorToast: false
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** 按历史训练频次返回当前学员的常用动作；无历史时返回最近维护的动作。 */
  async listFrequentActions(): Promise<any[]> {
    const res = await request<{ actions: any[] }>({
      url: `${this.baseUrl}/list-actions`,
      method: 'POST',
      data: {},
      showErrorToast: false
    })
    if (res.success && Array.isArray(res.data?.actions)) return res.data.actions
    return []
  }

  /** 完成一组（注意：使用 actionIndex/setIndex，0-based） */
  async completeSet(
    executionId: string,
    actionIndex: number,
    setIndex: number,
    data: {
      actualWeight?: number | null
      actualReps?: number | null
      actualDuration?: number | null
      weightUnit?: 'kg' | 'lbs'
      weightInput?: number | null
      notes?: string
      rpe?: number | null
      isPR?: boolean
    }
  ): Promise<any | null> {
    const res = await request({
      url: `${this.baseUrl}/complete-set`,
      method: 'POST',
      data: {
        executionId,
        actionIndex,
        setIndex,
        actualWeight: data.actualWeight,
        actualReps: data.actualReps,
        actualDuration: data.actualDuration,
        weightUnit: data.weightUnit,
        weightInput: data.weightInput,
        notes: data.notes,
        rpe: data.rpe,
        isPR: data.isPR
      }
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** 完成即兴训练 */
  async finish(impromptuId: string, options?: FinishImpromptuOptions): Promise<any | null> {
    const res = await request({
      url: `${this.baseUrl}/finish`,
      method: 'POST',
      data: {
        executionId: impromptuId,
        ...options
      }
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** 添加额外组 */
  async addExtraSet(
    executionId: string,
    actionIndex: number,
    params?: { weight?: number | string | null; weightUnit?: 'kg' | 'lbs'; weightInput?: number | null; reps?: number | string | null; restSeconds?: number | null }
  ): Promise<{ newSetIndex: number; totalSets: number } | null> {
    const res = await request({
      url: `${this.baseUrl}/extra-content/add-extra-set`,
      method: 'POST',
      data: {
        executionId,
        actionIndex,
        ...params
      }
    })
    if (res.success && res.data) return res.data as any
    return null
  }

  /** 删除额外组 */
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
    if (res.success && res.data) return res.data as any
    return null
  }

  /** 添加额外动作 */
  async addExtraExercise(
    executionId: string,
    actionId: string,
    actionName: string,
    sets?: Array<{ weight?: number | string | null; reps?: number | string | null; restSeconds?: number | null }>
  ): Promise<{ newActionIndex: number; totalSets: number } | null> {
    const res = await request({
      url: `${this.baseUrl}/extra-content/add-extra-exercise`,
      method: 'POST',
      data: {
        executionId,
        actionId,
        actionName,
        sets: sets || [{ weight: null, reps: null }]
      }
    })
    if (res.success && res.data) return res.data as any
    return null
  }

  /** 删除额外动作 */
  async deleteExtraExercise(
    executionId: string,
    actionIndex: number
  ): Promise<{ totalSets: number } | null> {
    const res = await request({
      url: `${this.baseUrl}/extra-content/delete-extra-exercise`,
      method: 'POST',
      data: { executionId, actionIndex }
    })
    if (res.success && res.data) return res.data as any
    return null
  }
}

export const impromptuService = new ImpromptuService()
