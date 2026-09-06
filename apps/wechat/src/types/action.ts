/**
 * 动作库类型定义（从 pages/action-lib 迁移）
 */

export type ItemType = 'STRENGTH' | 'DIET' | 'CARDIO' | 'HABIT'

/** 我的动作库单条 */
export interface StudentActionRow {
  id: string
  user_id: string
  name: string
  detail: string | null
  positions: string[] | null
  attrs: string[] | null
  url: string | null
  type?: ItemType
  item_schema?: Record<string, unknown> | null
  suggested_time?: string | null
  enableAutoWeightCompute?: boolean
  includesBodyWeight?: boolean
  canonical_action_id?: string | null
  category?: string | null
  reference_image_url?: string | null
  created_at: string
  updated_at: string
}

/** 公共动作库贡献者 */
export interface PublicActionContributorDto {
  userId: string
  nickname: string | null
  avatarUrl: string | null
}

/** 公共动作库单条 */
export interface PublicActionItemDto {
  id: string
  contributor_user_id: string
  name: string
  detail: string | null
  positions: string[] | null
  attrs: string[] | null
  url: string | null
  type: string | null
  item_schema: unknown
  suggested_time: string | null
  enableAutoWeightCompute?: boolean | null
  includesBodyWeight?: boolean | null
  canonical_action_id?: string | null
  category?: string | null
  reference_image_url?: string | null
  like_count: number
  created_at: string | null
  updated_at: string | null
  isLiked: boolean
  isAdded: boolean
  contributor: PublicActionContributorDto | null
}

/** 我的动作库列表响应 */
export interface ListMyActionsRes {
  actions: StudentActionRow[]
  totalCount: number
  page: number
  limit: number
}

/** 公共动作库列表响应 */
export interface ListPublicActionsRes {
  actions: PublicActionItemDto[]
  totalCount: number
  page: number
  limit: number
}

/** 加入我的动作库响应 */
export interface AddToMyLibRes {
  success?: boolean
}

/** 点赞响应 */
export interface ToggleLikeRes {
  liked: boolean
  likeCount: number
}

/** 贡献我的动作到公共动作库 */
export interface PublishFromMyActionRes {
  publicAction?: PublicActionItemDto | null
}

/** 提交公共动作编辑建议 */
export interface SubmitPublicActionEditInput {
  actionId: string
  name?: string | null
  detail?: string | null
  positions?: string[] | null
  attrs?: string[] | null
  url?: string | null
  type?: string | null
  item_schema?: Record<string, unknown> | null
  suggested_time?: string | null
  enableAutoWeightCompute?: boolean | null
  includesBodyWeight?: boolean | null
  canonical_action_id?: string | null
}

/** 教练动作（带是否已添加标记） */
export interface CoachActionWithAdded {
  id: string
  name: string
  detail: string | null
  positions: string[] | null
  attrs: string[] | null
  url: string | null
  type: string | null
  isAdded: boolean
}

/** 新增动作请求 */
export interface StudentActionInsert {
  name: string
  detail?: string | null
  positions?: string[] | null
  attrs?: string[] | null
  url?: string | null
  type?: ItemType | null
  item_schema?: Record<string, unknown> | null
  suggested_time?: string | null
  enableAutoWeightCompute?: boolean
  includesBodyWeight?: boolean
}
