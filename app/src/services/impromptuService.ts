import { request } from '../utils/request'

export interface ImpromptuActionInput {
  actionId?: string | null
  actionName: string
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

  /** 完成一组（注意：使用 actionIndex/setIndex，0-based） */
  async completeSet(
    executionId: string,
    actionIndex: number,
    setIndex: number,
    data: {
      actualWeight?: number | null
      actualReps?: number | null
      notes?: string
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
        notes: data.notes
      }
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** 完成即兴训练 */
  async finish(impromptuId: string): Promise<any | null> {
    const res = await request({
      url: `${this.baseUrl}/finish`,
      method: 'POST',
      data: { id: impromptuId }
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** 添加额外组 */
  async addExtraSet(
    executionId: string,
    actionIndex: number,
    params?: { weight?: number | null; reps?: number | null; restSeconds?: number | null }
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
    sets?: Array<{ weight?: number | null; reps?: number | null; restSeconds?: number | null }>
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
