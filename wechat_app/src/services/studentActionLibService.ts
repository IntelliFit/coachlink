import Taro from '@tarojs/taro'
import { API_BASE_URL, BaseService } from '../utils/request'
import type { ItemType } from '@/types/action'

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

interface BootstrapStudentActionsFromProfileDto {
  minActions?: number
  importLimit?: number
}

interface BootstrapWorkoutDraftItemDto {
  actionId: string
  actionName: string
  itemType: ItemType
  params: Record<string, unknown>
  note?: string | null
}

interface BootstrapStudentActionsFromProfileResponseDto {
  existingCount: number
  importedCount: number
  totalCount: number
  recommendedActionIds: string[]
  workoutDraft: BootstrapWorkoutDraftItemDto[]
  skipped: boolean
}

class StudentActionLibService extends BaseService {
  async listActions(params: ListStudentActionsDto) {
    const res = await this.post<ListStudentActionsResponseDto>('list-actions', {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      search: params.search ?? ''
    })
    if (res.success && res.data) return res.data
    return null
  }

  async addAction(data: {
    name: string
    detail?: string | null
    url?: string | null
    positions?: string[] | null
    attrs?: string[] | null
    type?: string | null
  }) {
    const res = await this.post('add-action', data)
    if (res.success && res.data) return res.data
    return null
  }

  async updateAction(data: {
    id: string
    name?: string
    detail?: string | null
    url?: string | null
    positions?: string[] | null
    attrs?: string[] | null
    type?: string | null
  }) {
    const res = await this.post('update-action', data)
    if (res.success && res.data) return res.data
    return null
  }

  async deleteAction(data: { id: string }) {
    const res = await this.post('delete-action', data)
    if (res.success && res.data) return res.data
    return null
  }

  async mergeActions(sourceId: string, targetId: string) {
    const res = await this.post('merge-actions', { sourceId, targetId })
    if (res.success && res.data) return res.data
    return null
  }

  async getActionReferences(actionId: string) {
    const res = await this.post<{ references: Array<{ planId: string; planName: string; dayIndex: number }> }>('get-action-references', { actionId })
    if (res.success && res.data) return res.data
    return null
  }

  async batchUpdate1RM(updates: Array<{ actionId: string; reference1RM: number | null }>) {
    const res = await this.post<{ updated: number }>('batch-update-1rm', { updates })
    if (res.success && res.data) return res.data
    return null
  }

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

  async bootstrapFromProfile(params: BootstrapStudentActionsFromProfileDto = {}) {
    const res = await this.post<BootstrapStudentActionsFromProfileResponseDto>('bootstrap-from-profile', params)
    if (res.success && res.data) return res.data
    return null
  }

  async getCurrent1RM() {
    const res = await this.post<{ actions: Array<{ id: string; name: string; reference_1rm: number | null }> }>('get-current-1rm', {})
    if (res.success && res.data) return res.data
    return null
  }

  async uploadDemoVideo(
    filePath: string,
    onProgress?: (progress: number) => void
  ): Promise<{ url?: string; storage_bucket?: string; storage_path?: string } | null> {
    const token = Taro.getStorageSync('token') || ''

    return await new Promise((resolve) => {
      const uploadTask = Taro.uploadFile({
        url: `${API_BASE_URL}/api/student/action-lib/upload-demo-video`,
        filePath,
        name: 'file',
        header: {
          Authorization: token ? `Bearer ${token}` : ''
        },
        success: (res: any) => {
          try {
            const parsed = JSON.parse(res.data)
            if (parsed?.success && parsed?.data) {
              resolve(parsed.data)
              return
            }
            resolve(null)
          } catch (error) {
            console.error('parse upload demo video response failed:', error)
            resolve(null)
          }
        },
        fail: (error) => {
          console.error('upload demo video failed:', error)
          resolve(null)
        }
      })

      if (onProgress && uploadTask && typeof uploadTask.onProgressUpdate === 'function') {
        uploadTask.onProgressUpdate((event: any) => {
          onProgress(Math.max(0, Math.min(100, Number(event?.progress) || 0)))
        })
      }
    })
  }
}

export const studentActionLibService = new StudentActionLibService('/api/student/action-lib')
