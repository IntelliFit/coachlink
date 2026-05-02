/**
 * 我的教练 - 类型定义（与网页端 coach-subscriptions / CoachList 对齐）
 * 字段来源：coachlink API subscription/coach-subscriptions、coach/get-aggregated-info
 */

/** 教练行（coaches 表） */
export interface CoachRow {
  id: string
  user_id?: string | null
  name: string
  avatar_url?: string | null
  bio?: string | null
  title?: string | null
  specialties?: string[] | null
  /** TODO: 网页端还有 rating/total_students/years_experience 等 */
}

/** 订阅行（coach_subscriptions 表）基础字段 */
export interface CoachSubscriptionRow {
  id: string
  coach_id: string
  student_id: string
  status: string | null
  start_date: string | null
  end_date: string | null
  tier: number
  subscribed_weeks?: number | null
  /** TODO: monthly_price, product_name, payment_confirmed_at 等 */
}

/** 查询我的教练列表 - 单条（API 返回的 subscriptions[i]） */
export interface QueryCoachSubscription extends CoachSubscriptionRow {
  coach: CoachRow | null
  /** 是否已分配计划实例（教练已制定计划） */
  has_plan_instance?: boolean
  /** TODO: latest_plan_instance_id */
}

/** 获取我的教练列表 - 请求 */
export interface CoachSubscriptionGetDto {
  studentId?: string
  coachId?: string
  onlyActive?: boolean
  /** TODO: computePauseAwareEndDate */
}

/** 获取我的教练列表 - 响应 */
export interface CoachSubscriptionGetResponseDto {
  subscriptions: QueryCoachSubscription[]
  studentId?: string
  coachId?: string
}

/** 教练聚合信息（用于卡片内容数/学员数/评分） */
export interface GetAggregatedInfoResponseDto {
  coach: CoachRow
  contentCount: number
  studentCount: number
  reviewCount: number
  averageRating: number
  specialties: string[]
}

/** 状态主题（与网页 CoachList STATUS_THEME 一致） */
export type StatusThemeKey =
  | 'active'
  | 'preparing'
  | 'not_started'
  | 'expired'
  | 'expiring'
  | 'waiting'
  | 'inactive'

export interface StatusTheme {
  bg: string
  text: string
  label: string
}
