/**
 * 教练详情页 - 类型定义（与 PC coach/profile/[id] 对齐）
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
  achievements?: string[] | null
  years_experience?: number | null
  profile?: Record<string, any> | null
  is_featured?: boolean | null
  huifu_open_status?: string | null
  huifu_open_msg?: string | null
}

/** 教练聚合信息 */
export interface GetAggregatedInfoResponseDto {
  coach: CoachRow
  contentCount: number
  studentCount: number
  reviewCount: number
  averageRating: number
  specialties: string[]
}

/** 订阅行（用于当前用户对该教练的订阅状态） */
export interface QueryCoachSubscription {
  id: string
  coach_id: string
  student_id: string
  status: string | null
  start_date?: string | null
  end_date?: string | null
  tier?: number
  subscribe_data?: any
  coach?: CoachRow | null
  product_id?: string | null
  product_name?: string | null
  product_tier?: string | null
  monthly_price?: number | null
  queued_packages?: Array<{ id: string; product_name: string; purchased_weeks: number }>
}

/** 定价 - 时长选项 */
export interface DurationOption {
  months: number
  price: number
  is_recommend?: boolean
}

/** 定价 - 产品/套餐 */
export interface Product {
  id: string
  tier: string
  type: string
  name: string
  description?: string
  duration_options: DurationOption[]
}

/** 内容行 */
export interface CoachContentRow {
  id: string
  coach_id: string
  title?: string | null
  content_type?: string | null
  thumbnail_url?: string | null
  required_tier?: number | null
  [key: string]: any
}

/** 教练主页公开展示的学员评价 */
export interface PublicCoachReview {
  id: string
  studentId: string
  studentName: string
  studentAvatarUrl: string | null
  comment: string
  rating: number | null
  createdAt: string | null
}

/** 关于面板 - profile 扩展 */
export interface CoachProfileDetail {
  teachingPhilosophy?: string
  achievements?: string[]
  credentials?: Array<{ name?: string; url?: string }>
  caseStudies?: string[]
  applicationMaterials?: any[]
  contactEmail?: string
  contactPhone?: string
  socialLinks?: Record<string, string>
}
