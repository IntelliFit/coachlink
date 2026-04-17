import { BaseService } from '../../utils/request'

class ActionLibService extends BaseService {
  /** 动作列表 */
  async listActions(params?: { page?: number; limit?: number; search?: string; type?: string }) {
    const res = await this.post<{ actions: any[]; total: number }>('list-actions', {
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      search: params?.search ?? '',
      type: params?.type ?? ''
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** 添加动作 */
  async addAction(reqData: {
    name: string
    detail?: string
    url?: string
    positions?: string[]
    attrs?: string[]
    type?: string
    enableAutoWeightCompute?: boolean
    includesBodyWeight?: boolean
    item_schema?: any
    suggested_time?: string
  }) {
    const res = await this.post<{ success: boolean; message?: string; data?: any }>('add-action', reqData)
    return res
  }

  /** 更新动作 */
  async updateAction(reqData: {
    id: string
    name?: string
    detail?: string
    url?: string
    positions?: string[]
    attrs?: string[]
    type?: string
    enableAutoWeightCompute?: boolean
    includesBodyWeight?: boolean
    item_schema?: any
    suggested_time?: string
  }) {
    const res = await this.post<{ success: boolean; message?: string; data?: any }>('update-action', reqData)
    return res
  }

  /** 删除动作 */
  async deleteAction(reqData: { id: string }) {
    const res = await this.post<{ success: boolean; message?: string }>('delete-action', reqData)
    return res
  }
}

export const actionLibService = new ActionLibService('/api/action-lib')
