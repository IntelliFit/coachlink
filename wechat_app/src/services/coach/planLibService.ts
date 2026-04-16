import { BaseService } from '../../utils/request'

class PlanLibService extends BaseService {
  /** 计划模板列表 */
  async listTemplates(params?: { page?: number; limit?: number; search?: string; type?: string }) {
    const res = await this.post<{ templates: any[]; total: number }>('list-templates', {
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      search: params?.search ?? '',
      type: params?.type ?? ''
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** 单个模板 */
  async getTemplate(templateIdOrData: string | { id: string }) {
    const id = typeof templateIdOrData === 'string' ? templateIdOrData : templateIdOrData.id
    const res = await this.post<{ template: any; days: any[] }>('get-template', { id })
    if (res.success && res.data) return res.data
    return null
  }

  /** 创建模板 */
  async createTemplate(data: {
    name: string
    description?: string | null
    tags?: string[]
    suitableFor?: string
    type?: string | null
    weekDays?: number[]
    globalAnswers?: Record<string, number>
    trainingDays?: any[]
  }) {
    const res = await this.post<{ template: any }>('create-template', {
      name: data.name,
      description: data.description || null,
      tags: data.tags || [],
      suitableFor: data.suitableFor || 'beginner',
      type: data.type || null,
      weekDays: data.weekDays || [],
      globalAnswers: data.globalAnswers || {},
      trainingDays: data.trainingDays || []
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** 更新模板 */
  async updateTemplate(data: {
    id: string
    name?: string
    description?: string | null
    tags?: string[]
    suitableFor?: string
    type?: string | null
    weekDays?: number[]
    globalAnswers?: Record<string, number>
    trainingDays?: any[]
  }) {
    const res = await this.post<{ template: any }>('update-template', {
      id: data.id,
      name: data.name,
      description: data.description || null,
      tags: data.tags || [],
      suitableFor: data.suitableFor,
      type: data.type || null,
      weekDays: data.weekDays || [],
      globalAnswers: data.globalAnswers || {},
      trainingDays: data.trainingDays || []
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** 删除模板 */
  async deleteTemplate(data: { id: string }) {
    const res = await this.post<{ success?: boolean }>('delete-template', data)
    if (res.success) return res.data ?? true
    return null
  }

  /** 复制模板 */
  async copyTemplate(data: { id: string }) {
    const res = await this.post<{ template?: any }>('copy-template', data)
    if (res.success && res.data) return res.data
    return null
  }

  /** 模板标签集合 */
  async getUniqueTemplateTags(data?: { search?: string; type?: string }) {
    const res = await this.post<{ tags?: string[] }>('get-unique-template-tags', {
      search: data?.search ?? '',
      type: data?.type ?? ''
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** 获取计划实例（教练查看学员计划） */
  async getInstance(params: { subscriptionId: string }) {
    const res = await this.post<{
      instance: {
        id: string
        name: string
        description: string
        status: string
        progress: number
        current_day: number
        total_days: number
        start_date: string
        training_days: any[]
      }
      actions: Record<string, any>
    }>('get-instance', params)
    if (res.success && res.data) return res.data
    return null
  }

  /** 创建计划实例（为学员分配计划） */
  async createInstance(data: {
    templateId?: string
    subscriptionId: string
    name: string
    description?: string | null
    tags?: string[] | null
    type?: string | null
    trainingDays?: any[]
    suitableFor?: string | null
    startDate?: string
    startWeek?: number
    startDay?: number
  }) {
    let trainingDays = data.trainingDays

    // 后端 create-instance 需要明确的 trainingDays；当仅传 templateId 时先拉取模板详情补齐。
    if ((!Array.isArray(trainingDays) || trainingDays.length === 0) && data.templateId) {
      const templateRes = await this.getTemplate(data.templateId)
      if (Array.isArray(templateRes?.days)) {
        trainingDays = templateRes.days
      }
    }

    if (!Array.isArray(trainingDays)) {
      return null
    }

    const res = await this.post<{ instance: any }>('create-instance', {
      ...data,
      trainingDays
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** 更新计划实例 */
  async updateInstance(data: {
    id: string
    name?: string
    description?: string | null
    tags?: string[] | null
    type?: string | null
    templateId?: string
    suitableFor?: string | null
    startExecutionDay?: number
    trainingDays?: any[]
  }) {
    const res = await this.post<{ instance: any }>('update-instance', data)
    if (res.success && res.data) return res.data
    return null
  }

  /** 获取计划实例（含执行记录） */
  async getWithExecutions(params: { subscriptionId?: string; instanceId?: string }) {
    const res = await this.post<{
      instance: any
      training_days: any[]
      executions: Record<number, any>
      actions: Record<string, any>
    }>('get-with-executions', params)
    if (res.success && res.data) return res.data
    return null
  }

  /** 暂停计划 */
  async pauseInstance(instanceId: string) {
    // 后端无独立 pause-instance 路由，统一通过 update-instance 更新状态
    const res = await this.post<{ instance?: any }>('update-instance', {
      id: instanceId,
      status: 'paused'
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** AI 快速生成计划实例（单个学员） */
  async createAiInstance(data: {
    subscriptionId: string
    startWeek?: number
    startDay?: number
    keepOriginalIndex?: boolean
  }) {
    const res = await this.post<{ template: any }>('create-ai-instance', {
      subscriptionId: data.subscriptionId,
      startWeek: data.startWeek ?? 1,
      startDay: data.startDay ?? 1,
      keepOriginalIndex: data.keepOriginalIndex ?? true
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** AI 批量快速生成（默认针对未配置计划学员） */
  async bulkCreateAiInstances(data?: {
    mode?: 'explicit' | 'no_plan'
    subscriptionIds?: string[]
    excludedSubscriptionIds?: string[]
    startWeek?: number
    startDay?: number
    keepOriginalIndex?: boolean
  }) {
    const res = await this.post<{
      total: number
      successCount: number
      failedCount: number
      results: Array<{
        subscriptionId: string
        success: boolean
        template?: any | null
        error?: string
      }>
    }>('bulk-create-ai-instances', {
      mode: data?.mode ?? 'no_plan',
      subscriptionIds: data?.subscriptionIds ?? [],
      excludedSubscriptionIds: data?.excludedSubscriptionIds ?? [],
      startWeek: data?.startWeek ?? 1,
      startDay: data?.startDay ?? 1,
      keepOriginalIndex: data?.keepOriginalIndex ?? true
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** 恢复/继续计划 */
  async resumeInstance(instanceId: string) {
    // 后端无独立 resume-instance 路由，统一通过 update-instance 更新状态
    const res = await this.post<{ instance?: any }>('update-instance', {
      id: instanceId,
      status: 'active'
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** 删除实例 */
  async deleteInstance(data: { id: string }) {
    const res = await this.post('delete-instance', data)
    if (res.success) return res.data ?? true
    return null
  }

  /** 归档实例 */
  async archiveInstance(data: { id: string }) {
    const res = await this.post('archive-instance', data)
    if (res.success) return res.data ?? true
    return null
  }
}

export const planLibService = new PlanLibService('/api/plan-lib')
