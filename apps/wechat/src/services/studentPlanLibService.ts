import { BaseService } from '../utils/request'

interface ParseActionsResult {
  actions: any[]
}

interface ParseTemplateResult {
  weeks: number
  trainingDays: any[]
  globalDescription?: string | null
}

interface SaveFavoritePayload {
  name: string
  description?: string | null
  tags?: string[] | null
  suitable_for?: string | null
  training_days: any
}

class StudentPlanLibService extends BaseService {
  /**
   * 解析训练计划文本中的动作信息
   * 对应接口：POST /api/student/plan-lib/parse-actions
   */
  async parseActions(text: string) {
    const res = await this.post<ParseActionsResult>('parse-actions', { text })
    if (res.success && res.data) {
      return res.data
    }
    return null
  }

  /**
   * 基于学员动作库 + 文本解析出周训练模板
   * 对应接口：POST /api/student/plan-lib/parse-template
   *
   * @param text  原始训练计划文本
   * @param actions  动作列表（至少需要 id/name/type/attrs 字段）
   */
  async parseTemplate(
    text: string,
    actions: Array<{ id: string; name: string; type?: string; attrs?: string[] }>
  ) {
    const res = await this.post<ParseTemplateResult>('parse-template', {
      text,
      actions
    })
    if (res.success && res.data) {
      return res.data
    }
    return null
  }

  /**
   * 保存学员常用计划
   * 对应接口：POST /api/student/plan-lib/save-favorite
   */
  async saveFavorite(payload: SaveFavoritePayload) {
    const res = await this.post<{ favorite: any }>('save-favorite', payload)
    if (res.success && res.data) {
      return res.data
    }
    return null
  }

  /**
   * 获取学员常用计划列表
   * 对应接口：POST /api/student/plan-lib/list-favorites
   */
  async listFavorites(params?: { page?: number; limit?: number; search?: string }) {
    const res = await this.post<{ favorites: any[]; total?: number; totalCount?: number }>('list-favorites', {
      page: params?.page ?? 1,
      limit: params?.limit ?? 50,
      search: params?.search ?? ''
    })
    if (res.success && res.data) {
      return res.data
    }
    return null
  }

  /**
   * 获取单个常用计划详情
   * 对应接口：POST /api/student/plan-lib/get-favorite
   */
  async getFavorite(favoriteId: string) {
    const res = await this.post<{ favorite: any }>('get-favorite', { id: favoriteId })
    if (res.success && res.data) {
      return res.data
    }
    return null
  }

  /**
   * 更新常用计划
   * 对应接口：POST /api/student/plan-lib/update-favorite
   */
  async updateFavorite(favoriteId: string, payload: SaveFavoritePayload) {
    const res = await this.post<{ favorite: any }>('update-favorite', {
      id: favoriteId,
      ...payload
    })
    if (res.success && res.data) {
      return res.data
    }
    return null
  }

  /**
   * 删除常用计划
   * 对应接口：POST /api/student/plan-lib/delete-favorite
   */
  async deleteFavorite(favoriteId: string) {
    const res = await this.post('delete-favorite', { id: favoriteId })
    if (res.success && res.data) {
      return res.data
    }
    return null
  }

  /**
   * 应用常用计划（激活为当前执行计划）
   * 对应接口：POST /api/student/plan-lib/apply-favorite
   */
  async applyFavorite(
    favoriteId: string,
    options?: {
      oneRMConfig?: Record<string, number>
      startDate?: string
    } | Record<string, number>
  ) {
    const isLegacyOneRMConfig =
      options &&
      typeof options === 'object' &&
      !Array.isArray(options) &&
      !('oneRMConfig' in options) &&
      !('startDate' in options)
    const res = await this.post<{ instanceId?: string; message?: string }>('apply-favorite', { 
      favoriteId,
      oneRMConfig: isLegacyOneRMConfig ? options : (options as { oneRMConfig?: Record<string, number> } | undefined)?.oneRMConfig,
      startDate: isLegacyOneRMConfig ? undefined : (options as { startDate?: string } | undefined)?.startDate
    })
    if (res.success && res.data) {
      return res.data
    }
    return null
  }

  /**
   * 基于学员档案生成 AI 计划草稿
   * 对应接口：POST /api/student/plan-lib/generate-ai-draft-from-profile
   */
  async generateAiDraftFromProfile(params?: { days?: number }) {
    const res = await this.post<{
      name?: string
      description?: string
      trainingDays?: any[]
    }>('generate-ai-draft-from-profile', params || {})
    if (res.success && res.data) {
      return res.data
    }
    return null
  }
}

export const studentPlanLibService = new StudentPlanLibService('/api/student/plan-lib')

