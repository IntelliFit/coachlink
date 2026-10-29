import { BaseService } from '../utils/request'

interface ListStudentActionsDto {
  search?: string
  page: number
  limit: number
}

interface ListStudentActionsResponseDto {
  actions: any[]
  totalCount: number
  page: number
  limit: number
}

class StudentActionLibService extends BaseService {
  /** 获取学员动作列表 */
  async listActions(params: ListStudentActionsDto) {
    const res = await this.post<ListStudentActionsResponseDto>('list-actions', {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      search: params.search ?? ''
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** 添加动作 */
  async addAction(data: {
    name: string
    detail?: string | null
    url?: string | null
    positions?: string[] | null
    attrs?: string[] | null
    type?: string | null
    enableAutoWeightCompute?: boolean
    includesBodyWeight?: boolean
    reference_1rm?: number | null
  }) {
    const res = await this.post('add-action', data)
    if (res.success && res.data) return res.data
    return null
  }

  /** 更新动作 */
  async updateAction(data: {
    id: string
    name?: string
    detail?: string | null
    url?: string | null
    positions?: string[] | null
    attrs?: string[] | null
    type?: string | null
    enableAutoWeightCompute?: boolean
    includesBodyWeight?: boolean
    reference_1rm?: number | null
  }) {
    const res = await this.post('update-action', data)
    if (res.success && res.data) return res.data
    return null
  }

  /** 删除动作 */
  async deleteAction(data: { id: string }) {
    const res = await this.post('delete-action', data)
    if (res.success && res.data) return res.data
    return null
  }

  /** 合并重复动作 */
  async mergeActions(sourceId: string, targetId: string) {
    const res = await this.post('merge-actions', { sourceId, targetId })
    if (res.success && res.data) return res.data
    return null
  }

  /** 获取动作被哪些计划引用 */
  async getActionReferences(actionId: string) {
    // 后端路由是 action-references（参数 actionIds），之前请求的 get-action-references 并不存在
    const res = await this.post<{ instances: Array<{ instanceId: string; name: string; status: string | null; matchCount: number }> }>('action-references', { actionIds: [actionId] })
    if (!res.success || !res.data) return null
    return {
      references: (res.data.instances || []).map((item) => ({
        planId: item.instanceId,
        planName: item.name || '未命名计划',
        matchCount: Number(item.matchCount || 1),
        status: item.status
      }))
    }
  }

  /** 批量更新1RM */
  async batchUpdate1RM(updates: Array<{ actionId: string; reference1RM: number | null }>) {
    // The API reads snake_case reference_1rm; an unknown key is treated as "clear".
    const payload = updates.map(({ actionId, reference1RM }) => ({ actionId, reference_1rm: reference1RM }))
    const res = await this.post<{ updated: number }>('batch-update-1rm', { updates: payload })
    if (res.success && res.data) return res.data
    return null
  }

  /** 批量创建动作 */
  async batchCreate(actions: Array<{
    name: string
    detail?: string | null
    url?: string | null
    positions?: string[] | null
    attrs?: string[] | null
    type?: string | null
  }>) {
    const res = await this.post<{ actions: any[]; created: number }>('batch-create-actions', { actions })
    if (res.success && res.data) return res.data
    return null
  }

  /** 获取当前1RM数据 */
  async getCurrent1RM() {
    const res = await this.post<{ actions: Array<{ id: string; name: string; reference_1rm: number | null }> }>('get-current-1rm', {})
    if (res.success && res.data) return res.data
    return null
  }

}

export const studentActionLibService = new StudentActionLibService('/api/student/action-lib')
