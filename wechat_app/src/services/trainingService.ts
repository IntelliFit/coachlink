import { request, BaseService } from '../utils/request'

interface GetInstanceParams {
  /** 计划实例 id，用于直接按 id 获取（如补练跳转） */
  id?: string
  subscriptionId?: string
  fetchSelf?: boolean
}

interface GetNextTrainingDayParams {
  instanceId: string
}

interface PlanInstance {
  id: string
  name: string
  source: 'coach' | 'self'
  status: string
  training_days: TrainingDay[]
  start_date?: string
  start_execution_day?: number
  execution_notice?: string | null
  executionNotice?: string | null
}

interface TrainingDay {
  dayIndex: number
  type: 'training' | 'rest'
  actionSets?: ActionSet[]
}

interface ActionSet {
  action_id?: string
  actionId?: string
  set_name?: string
  sets?: number
  reps?: number
  intensity?: number
  rest_seconds?: number
  itemType?: string
  params?: {
    组数?: number
    次数?: number
    强度?: number
    休息时间?: number
    load?: number
    custom_data?: any
  }
}

interface NextTrainingDayData {
  nextDayIndex: number
  todayCompleted: boolean
  completedDays: number[]
  totalTrainingDays: number
  completionDates: Record<number, string>
}

class TrainingService extends BaseService {
  /**
   * 获取计划实例
   */
  async getInstance(params: GetInstanceParams) {
    const res = await this.post<{ instance: PlanInstance; actions: Record<string, any> }>('get-instance', params)
    
    if (res.success && res.data) {
      return res.data
    }
    
    return null
  }

  /**
   * 获取下一个训练日信息
   */
  async getNextTrainingDay(params: GetNextTrainingDayParams): Promise<NextTrainingDayData | null> {
    console.log('[trainingService] 调用 getNextTrainingDay, instanceId:', params.instanceId)
    
    const res = await request<NextTrainingDayData>({
      url: `/api/execution/get-next-training-day`,
      method: 'POST',
      data: {
        instanceId: params.instanceId
      }
    })
    
    console.log('[trainingService] getNextTrainingDay 响应:', res)
    
    if (res.success && res.data) {
      console.log('[trainingService] 成功获取训练日数据:', res.data)
      return res.data
    }
    
    console.warn('[trainingService] getNextTrainingDay 失败:', res.message || '未知错误')
    return null
  }

  /**
   * 删除计划实例
   */
  async deleteInstance(params: { id: string }) {
    const res = await this.post('delete-instance', params)

    if (res.success) {
      return res.data ?? true
    }

    return null
  }
}

export const trainingService = new TrainingService('/api/plan-lib')

export type { PlanInstance, TrainingDay, ActionSet, NextTrainingDayData }

