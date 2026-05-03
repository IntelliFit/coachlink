/**
 * 动作库页面接口（从 pages/action-lib/service.ts 迁移）
 *
 * 1) POST /api/student/action-lib/list-actions
 *    请求: { search?: string; page: number; limit: number }
 *    响应: { actions: StudentActionRow[]; totalCount: number; page: number; limit: number }
 *
 * 2) POST /api/public-action-lib/list-actions
 *    请求: { page?: number; limit?: number; search?: string; viewerActionType?: 'student' | 'coach' }
 *    响应: { actions: PublicActionItemDto[]; totalCount: number; page: number; limit: number }
 *
 * 3) POST /api/public-action-lib/add-to-my-lib
 *    请求: { actionId: string }
 *
 * 4) POST /api/public-action-lib/toggle-like
 *    请求: { actionId: string }
 *    响应: { liked: boolean; likeCount: number }
 *
 * 5) POST /api/student/action-lib/list-coach-actions
 *    请求: {} 响应: { actions: CoachActionWithAdded[]; coachId; coachName; totalCount }
 *
 * 6) POST /api/student/action-lib/copy-coach-action
 *    请求: { coachActionId: string }
 *
 * 7) POST /api/student/action-lib/add-action
 *    请求: StudentActionInsert 响应: { action: StudentActionRow }
 */

import Taro from '@tarojs/taro'
import { request } from '@/utils/request'
import type {
  ListMyActionsRes,
  ListPublicActionsRes,
  PublishFromMyActionRes,
  SubmitPublicActionEditInput,
  ToggleLikeRes,
  ListCoachActionsRes,
  StudentActionRow,
  StudentActionInsert
} from '@/types/action'

const STUDENT_BASE = '/api/student/action-lib'
const PUBLIC_BASE = '/api/public-action-lib'

function handleApiError(err: unknown, defaultMsg: string) {
  const msg = (err as Error)?.message || defaultMsg
  if (typeof msg === 'string' && msg.includes('401')) {
    Taro.showToast({ title: '请先登录', icon: 'none' })
    Taro.reLaunch({ url: '/auth/login' })
    return
  }
  Taro.showToast({ title: msg || defaultMsg, icon: 'none' })
}

/** 获取我的动作库列表 */
export async function listMyActions(params: {
  search?: string
  page: number
  limit: number
}): Promise<ListMyActionsRes | null> {
  const res = await request<ListMyActionsRes>({
    url: `${STUDENT_BASE}/list-actions`,
    method: 'POST',
    data: params
  })
  if (!res?.success || res.data == null) {
    throw new Error((res as any)?.message || '获取动作列表失败')
  }
  return res.data
}

/** 获取公共动作库列表 */
export async function listPublicActions(params: {
  page?: number
  limit?: number
  search?: string
  viewerActionType?: 'student' | 'coach'
}): Promise<ListPublicActionsRes | null> {
  const res = await request<ListPublicActionsRes>({
    url: `${PUBLIC_BASE}/list-actions`,
    method: 'POST',
    data: { viewerActionType: 'student', ...params }
  })
  if (!res?.success || res.data == null) {
    throw new Error((res as any)?.message || '获取公共动作库失败')
  }
  return res.data
}

/** 将公共动作加入我的动作库 */
export async function addPublicToMyLib(actionId: string): Promise<void> {
  const res = await request<{ success?: boolean }>({
    url: `${PUBLIC_BASE}/add-to-my-lib`,
    method: 'POST',
    data: { actionId }
  })
  if (!res?.success) {
    throw new Error((res as any)?.message || '加入失败')
  }
}

/** 公共动作点赞/取消点赞 */
export async function togglePublicLike(actionId: string): Promise<ToggleLikeRes> {
  const res = await request<ToggleLikeRes>({
    url: `${PUBLIC_BASE}/toggle-like`,
    method: 'POST',
    data: { actionId }
  })
  if (!res?.success || res.data == null) {
    throw new Error((res as any)?.message || '操作失败')
  }
  const d = res.data
  if (typeof d.liked === 'boolean' && typeof d.likeCount === 'number') {
    return { liked: d.liked, likeCount: d.likeCount }
  }
  throw new Error('响应格式错误')
}

/** 将我的动作贡献到公共动作库 */
export async function publishMyAction(actionId: string, actionType: 'student' | 'coach' = 'student'): Promise<PublishFromMyActionRes | null> {
  const res = await request<PublishFromMyActionRes>({
    url: `${PUBLIC_BASE}/publish-from-my-action`,
    method: 'POST',
    data: { actionId, actionType }
  })
  if (!res?.success) {
    throw new Error((res as any)?.message || '贡献失败')
  }
  return res.data ?? null
}

/** 为公共动作提交编辑建议 */
export async function submitPublicActionEdit(data: SubmitPublicActionEditInput): Promise<void> {
  const res = await request<{ edit?: unknown }>({
    url: `${PUBLIC_BASE}/submit-edit`,
    method: 'POST',
    data
  })
  if (!res?.success) {
    throw new Error((res as any)?.message || '提交编辑建议失败')
  }
}

/** 获取教练分享的动作列表（用于从教练动作库复制） */
export async function listCoachActions(): Promise<ListCoachActionsRes | null> {
  const res = await request<ListCoachActionsRes>({
    url: `${STUDENT_BASE}/list-coach-actions`,
    method: 'POST',
    data: {}
  })
  if (!res?.success || res.data == null) {
    throw new Error((res as any)?.message || '获取教练动作库失败')
  }
  return res.data
}

/** 复制教练动作到我的动作库 */
export async function copyCoachAction(coachActionId: string): Promise<StudentActionRow> {
  const res = await request<{ action: StudentActionRow }>({
    url: `${STUDENT_BASE}/copy-coach-action`,
    method: 'POST',
    data: { coachActionId }
  })
  if (!res?.success || !res.data?.action) {
    throw new Error((res as any)?.message || '复制失败')
  }
  return res.data.action
}

/** 添加新动作到我的动作库 */
export async function addAction(data: StudentActionInsert): Promise<StudentActionRow> {
  const res = await request<{ action: StudentActionRow }>({
    url: `${STUDENT_BASE}/add-action`,
    method: 'POST',
    data
  })
  if (!res?.success || !res.data?.action) {
    throw new Error((res as any)?.message || '添加动作失败')
  }
  return res.data.action
}

export { handleApiError }
