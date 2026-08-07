import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { resolveCoachLinkAppRole } from '@coachlink/core'
import { Alert, Image, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useNavigation, useRoute } from '@react-navigation/native'
import * as Clipboard from 'expo-clipboard'
import * as ImagePicker from 'expo-image-picker'
import { API_BASE_URL, APP_VERSION } from '../../config'
import { apiClient, getStoredToken, persistSession } from '../../api'
import { IconFont, type IconFontName } from '../../components/IconFont'
import { useAuth } from '../../providers/AuthProvider'
import { colors, radius, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'
import {
  AnyRecord,
  Card,
  EmptyState,
  FormField,
  InlineAvatar,
  LoadingState,
  MenuRow,
  ScreenShell,
  SolidButton,
  asText,
  confirm,
  errorMessage,
  pickList,
  safeRequest,
} from './MeShared'

type NavProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>
type ListRoute = keyof RootStackParamList
type MembershipTier = 'free' | 'basic' | 'premium' | 'trial'
type MembershipTab = 'membership' | 'addon'
type CartItem = {
  id: string
  productId?: string
  productName?: string
  productTier?: string
  coachId?: string
  coachName?: string
  durationMonths?: number
  price?: number
}
type PurchaseItem = {
  id: string | number
  orderType?: string
  subject?: string
  productName?: string
  coachName?: string
  coachId?: string
  subscriptionId?: string
  amount?: number
  price?: number
  durationMonths?: number
  status?: string
  createdAt?: string
  created_at?: string
  paidAt?: string
  paid_at?: string
}
type ReferralData = {
  code: string
  inviteLink: string
  shareText: string
  totalReferrals: number
  totalRewards: {
    ai_import: number
    storage_mb: number
  }
}
type FitnessProfile = {
  nickname?: string | null
  avatar_url?: string | null
  gender?: string | null
  height?: number | null
  weight?: number | null
  fitness_goal?: string | null
  fitness_level?: string | null
}
type FitnessAnswers = {
  flow_version?: string
  fitness_goals?: string[]
  interest_tags?: string[]
  equipment?: string[]
  weekly_frequency?: number
  session_duration?: number
  target_body_parts?: string[]
}
type FitnessCardData = {
  profile: FitnessProfile
  answers: FitnessAnswers
}
type FitnessFieldKey =
  | 'nickname'
  | 'gender'
  | 'height'
  | 'weight'
  | 'fitness_goals'
  | 'fitness_level'
  | 'target_body_parts'
  | 'weekly_frequency'
  | 'equipment'
  | 'session_duration'
type StudentActionItem = {
  id: string
  name: string
  reference_1rm?: number | null
  includesBodyWeight?: boolean
}
type ActionDetailData = {
  id?: string
  name?: string
  action_name?: string
  detail?: string | null
  description?: string | null
  positions?: string[] | null
  attrs?: string[] | null
  type?: string | null
  url?: string | null
  video_url?: string | null
  reference_1rm?: number | null
}
type CoachActionItem = ActionDetailData & {
  id: string
  isAdded?: boolean
  is_added?: boolean
}
type E1RMHistoryPoint = {
  date: string
  e1rm?: number
  value?: number
  isPR?: boolean
  source?: string
  weight?: number
  reps?: number
}
type TrainingCalendarDay = {
  date: string
  sessions: number
}
type TrainingMonthStats = {
  month?: string
  totalSessions?: number
  trainingDays?: number
  totalSets?: number
  sourceBreakdown?: {
    impromptu?: number
    selfPlan?: number
    coachPlan?: number
  }
}
type TrainingDayHistoryItem = {
  id: string
  sourceType: 'IMPROMPTU' | 'SELF_PLAN' | 'COACH_PLAN'
  status: string
  startedAt: string
  completedAt?: string | null
  totalSets: number
  completedSets: number
  title: string
  actionSummaries?: Array<{
    actionName: string
    completedSets: number
    totalSets: number
  }>
}
type CoachSubscription = {
  id: string
  coach_id: string
  student_id?: string
  status?: string | null
  start_date?: string | null
  end_date?: string | null
  lifecycle_status?: string | null
  entitlement_remaining_credits?: number | null
  has_plan_instance?: boolean
  latest_plan_instance_id?: string | null
  coach?: {
    user_id?: string | null
    nickname?: string | null
    name?: string | null
    avatar_url?: string | null
    avatar?: string | null
    title?: string | null
    bio?: string | null
    specialties?: string[] | null
  } | null
}
type CoachAggregatedInfo = {
  contentCount?: number
  studentCount?: number
  reviewCount?: number
  averageRating?: number
  specialties?: string[]
  coach?: {
    id?: string
    name?: string | null
    avatar_url?: string | null
    bio?: string | null
    title?: string | null
    specialties?: string[] | null
  } | null
}
type CoachStatusKey = 'active' | 'preparing' | 'not_started' | 'expired' | 'expiring' | 'waiting' | 'inactive'
type ChatMessage = {
  id: string
  chatUserId?: string
  chatUserProfile?: {
    name?: string | null
    avatar?: string | null
  } | null
  messageType?: string
  content?: string | null
  mediaUrl?: string | null
  createdAt?: string
  isMine?: boolean
}
type FriendItem = {
  userId: string
  nickname?: string | null
  avatarUrl?: string | null
  friendsSince?: string | null
}
type FriendRequestItem = {
  friendshipId: string
  userId?: string
  nickname?: string | null
  avatarUrl?: string | null
  requester?: {
    userId: string
    nickname?: string | null
    avatarUrl?: string | null
  }
  createdAt?: string | null
  message?: string | null
}
type UserSearchResult = {
  id: string
  nickname?: string | null
  avatarUrl?: string | null
  searchId?: string | null
}
type FriendActivityItem = {
  id: string
  userId?: string
  nickname?: string
  avatarUrl?: string
  type?: string
  content?: string
  created_at?: string
  user?: {
    userId: string
    nickname?: string | null
    avatarUrl?: string | null
  }
  execution?: {
    executionId: string
    planName?: string | null
    dayIndex?: number | null
    totalVolume?: number | null
    durationMinutes?: number | null
    completedAt?: string | null
    shareToken?: string | null
    highlight?: {
      actionName?: string
      weight?: number
      reps?: number
    } | null
  }
}
type ChatroomListItem = {
  id: string
  chatUserId?: string
  chatUserProfile?: {
    name?: string | null
    avatar?: string | null
  } | null
  lastMessage?: string | null
  lastMessageAt?: string | null
  unreadCount?: number
  unreadMembers?: string[]
  isArchived?: boolean
}
type PlanTrainingDayDetail = {
  type?: string
  dayIndex?: number
  day_index?: number
  week?: number
  weekIndex?: number
  title?: string
  note?: string
  actionSets?: Array<{
    actionName?: string
    name?: string
    sets?: number
    reps?: number
    params?: Record<string, unknown>
  }>
}
type PlanInstanceDetail = {
  id: string
  name?: string | null
  description?: string | null
  execution_notice?: string | null
  status?: string | null
  source?: string | null
  start_date?: string | null
  end_date?: string | null
  start_execution_day?: number | null
  total_days?: number | null
  training_days?: PlanTrainingDayDetail[] | null
}
type PlanHistoryListItem = {
  id: string
  name?: string | null
  description?: string | null
  status?: string | null
  source?: string | null
  start_date?: string | null
  end_date?: string | null
  total_days?: number | null
  total_training_days?: number | null
  plan_span_days?: number | null
  completed_days?: number | null
  completion_rate?: number | null
}
type PlanFavoriteItem = {
  id: string
  name?: string | null
  description?: string | null
  training_days?: PlanTrainingDayDetail[] | null
  tags?: string[] | null
  suitable_for?: string | null
  updated_at?: string | null
}
type PlanActionLite = {
  id: string
  name: string
  type?: string | null
  attrs?: string[] | null
  enableAutoWeightCompute?: boolean | null
  enable_auto_weight_compute?: boolean | null
}
type PlanInstanceResponse = {
  instance?: PlanInstanceDetail | null
  totalTrainingDays?: number
  resolvedTrainingDays?: number
  derivedStatus?: string
}
type LeaderboardItem = {
  id: string
  title?: string | null
  description?: string | null
  start_at?: string | null
  end_at?: string | null
  rank_by_field?: string | null
  sort_order?: string | null
  type?: string | null
  remarks?: string | null
  created_at?: string | null
  creator_id?: string | null
  statusCount?: number | null
}
type LeaderboardRule = {
  detail?: string
  status?: string
}
type LeaderboardFormInput = {
  name: string
  type?: 'number' | 'text' | 'video' | 'option' | string
  required?: boolean
  options?: string[]
  userInput?: unknown
}
type LeaderboardDetail = LeaderboardItem & {
  rules?: LeaderboardRule[] | null
  form_schema?: LeaderboardFormInput[] | null
  initiator?: string | null
  needReview?: boolean
}
type LeaderboardEntry = {
  id: string
  score?: number | null
  evidence_url?: string | null
  form_data?: LeaderboardFormInput[] | null
  extra_data?: Record<string, unknown> | null
  created_at?: string | null
  userProfile?: {
    name?: string | null
    avatar?: string | null
  } | null
}
type CoachApplicationMaterialCategory = 'achievement' | 'case' | 'credential' | 'media'
type CoachApplicationMaterial = {
  id: string
  category: CoachApplicationMaterialCategory
  title: string
  summary?: string | null
  detail?: string | null
  isPublic: boolean
  media: Array<{
    id: string
    type: 'image' | 'video'
    url: string
    thumbnailUrl?: string | null
    fileName?: string | null
  }>
  links: Array<{ id: string; label?: string | null; url: string }>
}
type CoachApplicationForm = {
  id?: string
  name: string
  title: string
  bio: string
  yearsExperience: string
  teachingPhilosophy: string
  contactEmail: string
  contactPhone: string
  specialties: string[]
  applicationMaterials: CoachApplicationMaterial[]
  socialLinks: Array<{ name: string; url: string }>
  coachTrack: string
  serviceModes: string[]
  targetStudentLevels: string[]
  supportFocus: string
  province: string
  city: string
  county: string
  address: string
}
type CoachApplicationRow = {
  id: string
  status?: string | null
  review_notes?: string | null
  reviewed_at?: string | null
  name?: string | null
  title?: string | null
  bio?: string | null
  years_experience?: number | null
  teaching_philosophy?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  specialties?: string[] | null
  achievements?: string[] | null
  case_studies?: string[] | null
  credentials?: Array<{ name?: string | null; url?: string | null }> | null
  application_materials?: CoachApplicationMaterial[] | null
  social_links?: Record<string, string> | null
  coach_track?: string | null
  service_modes?: string[] | null
  target_student_levels?: string[] | null
  support_focus?: string | null
  province?: string | null
  city?: string | null
  county?: string | null
  address?: string | null
}

const STUDENT_BETA_GROUP_IMAGE = 'https://cdn-assets.coachlink.fit/beta-groups/student-wechat-group.png'

const FITNESS_FIELD_LABELS: Record<FitnessFieldKey, string> = {
  nickname: '昵称',
  gender: '性别',
  height: '身高',
  weight: '体重',
  fitness_goals: '健身目标',
  fitness_level: '训练水平',
  target_body_parts: '目标部位',
  weekly_frequency: '每周训练频率',
  equipment: '常用器械',
  session_duration: '单次训练时长',
}

const GENDER_OPTIONS = [
  { label: '男性', value: 'male' },
  { label: '女性', value: 'female' },
  { label: '暂时不填', value: 'unknown' },
]

const FITNESS_GOAL_OPTIONS = ['减脂', '增肌', '力量提升', '体能改善', '体态矫正', '运动恢复', '综合体适能', '灵活柔韧']
const FITNESS_LEVEL_OPTIONS = [
  { label: '零基础', value: 'beginner' },
  { label: '入门', value: 'novice' },
  { label: '进阶', value: 'intermediate' },
  { label: '高阶', value: 'advanced' },
  { label: '精英 / 职业', value: 'elite' },
]
const TARGET_BODY_PART_OPTIONS = ['胸部', '背部', '肩部', '大臂', '小臂', '腹部 / 核心', '腰部', '臀部', '大腿', '小腿', '全身']
const EQUIPMENT_OPTIONS = ['徒手', '单杠', '双杠', '哑铃', '杠铃 / 杠铃片', '壶铃', '弹力带 / 拉力器', '固定器械 / 器械区']
const WEEKLY_FREQUENCY_OPTIONS = [1, 2, 3, 4, 5, 6]
const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90]
const COACH_TRACK_OPTIONS = [
  { value: 'buddy', label: '训练搭子', desc: '适合带新手熟悉器械、环境和基础动作' },
  { value: 'growth', label: '进阶教练', desc: '适合已有训练经验的学员做计划调整和动作修正' },
  { value: 'professional', label: '专业教练', desc: '适合周期化训练、专项表现和高客单服务' },
]
const SERVICE_MODE_OPTIONS = [
  { value: 'online', label: '线上指导' },
  { value: 'offline', label: '线下带练' },
  { value: 'hybrid', label: '线上+线下' },
]
const TARGET_STUDENT_LEVEL_OPTIONS = [
  { value: 'beginner', label: '小白入门' },
  { value: 'intermediate', label: '进阶提升' },
  { value: 'advanced', label: '高阶表现' },
]
const MATERIAL_CATEGORY_OPTIONS: Array<{ value: CoachApplicationMaterialCategory; label: string }> = [
  { value: 'achievement', label: '成就' },
  { value: 'case', label: '案例' },
  { value: 'credential', label: '证书' },
  { value: 'media', label: '媒体' },
]
const SOCIAL_PLATFORM_OPTIONS = ['抖音', '小红书', '知乎', 'B站', '快手', '其他网站']

const MEMBERSHIP_PLANS: Array<{
  id: string
  name: string
  price: string
  duration: string
  tab: MembershipTab
  tier?: MembershipTier
  features: string[]
}> = [
  {
    id: 'monthly_basic',
    name: '基础会员',
    price: '19.9',
    duration: '月',
    tab: 'membership',
    tier: 'basic',
    features: ['每月 10 次智能计划生成', '1GB 云存储空间', '无限历史数据查询'],
  },
  {
    id: 'monthly_premium',
    name: '高级会员',
    price: '39.9',
    duration: '月',
    tab: 'membership',
    tier: 'premium',
    features: ['智能计划生成不限次数', '5GB 云存储空间', '专属高级训练分析'],
  },
  {
    id: 'ai_pack_basic',
    name: 'AI 导入加油包',
    price: '2.0',
    duration: '3次',
    tab: 'addon',
    features: ['当月度配额不足时可补充', '购买后立即到账', '永久有效'],
  },
  {
    id: 'storage_pack_basic',
    name: '存储扩容包',
    price: '9.9',
    duration: '1GB',
    tab: 'addon',
    features: ['扩展视频/训练记录空间', '购买后立即扩容', '永久有效'],
  },
]

const TIER_TEXT: Record<MembershipTier, string> = {
  free: '免费用户',
  basic: '基础会员',
  premium: '高级会员',
  trial: '试用会员',
}

const AI_HINT_BY_TIER: Record<MembershipTier, string> = {
  free: '用于生成个性化训练计划',
  basic: '用于生成个性化训练计划',
  premium: '高级会员无限量使用',
  trial: '试用期间按活动规则使用',
}

const legalDocs = {
  About: {
    title: '关于我们',
    body: ['教链 CoachLink 是面向训练者与教练的训练管理平台。', 'APP 端延续小程序的训练、计划、动作库、会员、订单和消息能力。'],
  },
  Contact: {
    title: '联系我们',
    body: ['如需反馈产品问题、合作或服务咨询，可通过平台反馈入口提交。', '我们会在工作日尽快处理。'],
  },
  Disclaimer: {
    title: '免责声明',
    body: ['平台内容不构成医疗诊断或治疗建议。', '训练应结合自身健康状态、教练指导与必要的医学建议谨慎执行。'],
  },
  Terms: {
    title: '用户服务协议',
    body: ['使用 CoachLink 即表示你同意遵守平台服务规则。', '请妥善保管账号、密码、验证码和登录凭证，对账号下发生的操作承担相应责任。'],
  },
  Privacy: {
    title: '隐私政策',
    body: ['我们会在登录、训练记录、教练服务、支付订单、客服反馈等场景收集必要信息。', '我们仅在提供服务、安全风控和法律法规允许范围内使用这些信息。'],
  },
  PlatformAgreement: {
    title: '平台协议',
    body: ['本协议规范教练入驻、服务发布、订单履约、资金结算及售后处理等合作事项。', '教练应提供真实资料并遵守平台规则。'],
  },
  ProtectionOfConsumer: {
    title: '消费者保障',
    body: ['平台消费者权益保障制度与用户协议、商户入驻协议、隐私政策和订单规则共同构成服务保障体系。', '如法律法规有强制规定，平台将按规定执行。'],
  },
} satisfies Record<string, { title: string; body: string[] }>

function useProtectedNavigation(navigation: any) {
  const { isAuthenticated, isGuest } = useAuth()
  return {
    isAuthenticated,
    isGuest,
    open(route: ListRoute, params?: object, requiresAuth = true) {
      if (requiresAuth && !isAuthenticated) {
        navigation.navigate('Login')
        return
      }
      navigation.navigate(route as never, params as never)
    },
  }
}

async function requestMaybe<T>(path: string, options?: { method?: 'GET' | 'POST'; body?: unknown }) {
  try {
    return await safeRequest<T>(path, options)
  } catch (error) {
    console.warn('[mobile me] request failed', path, error)
    throw error
  }
}

function labelFromItem(item: AnyRecord, keys: string[], fallback = '未命名') {
  for (const key of keys) {
    const value = item[key]
    if (value != null && String(value).trim()) return String(value)
  }
  return fallback
}

function secondaryFromItem(item: AnyRecord, keys: string[]) {
  return keys.map((key) => item[key]).filter((value) => value != null && String(value).trim()).join(' · ')
}

function tierLabel(tier?: string) {
  const labels: Record<string, string> = {
    basic: '特惠基础版',
    standard: '专业指导版',
    vip: '全能指导版',
  }
  return labels[String(tier || '')] || asText(tier, '订阅套餐')
}

function statusConfig(status?: string) {
  const key = String(status || '').toLowerCase()
  const configs: Record<string, { label: string; color: string; bg: string }> = {
    paid: { label: '已支付', color: '#10B981', bg: '#DFF7EC' },
    pending: { label: '待支付', color: '#F59E0B', bg: '#FFF3D8' },
    failed: { label: '支付失败', color: '#EF4444', bg: '#FDECEC' },
    closed: { label: '已关闭', color: '#6B7280', bg: '#F3F4F6' },
    cancelled: { label: '已取消', color: '#6B7280', bg: '#F3F4F6' },
    refunded: { label: '已退款', color: '#EF4444', bg: '#FDECEC' },
  }
  return configs[key] || { label: asText(status, '未知状态'), color: '#6B7280', bg: '#F3F4F6' }
}

const COACH_STATUS_THEME: Record<CoachStatusKey, { bg: string; text: string; label: string }> = {
  active: { bg: '#D1FAE5', text: '#059669', label: '已激活' },
  preparing: { bg: '#FEF3C7', text: '#D97706', label: '制定中' },
  not_started: { bg: '#F3F4F6', text: '#6B7280', label: '未开始' },
  expired: { bg: '#E5E7EB', text: '#6B7280', label: '已过期' },
  expiring: { bg: '#FEF3C7', text: '#D97706', label: '即将到期' },
  waiting: { bg: '#FEF3C7', text: '#D97706', label: '待确认' },
  inactive: { bg: '#FEE2E2', text: '#DC2626', label: '待支付' },
}

function getCoachStatusKey(sub: CoachSubscription): CoachStatusKey {
  if (sub.status === 'inactive') return 'inactive'
  if (sub.status === 'waiting') return 'waiting'
  if (sub.status === 'active') {
    const remainingCredits = Number(sub.entitlement_remaining_credits ?? Number.NaN)
    const hasRemainingCredits = Number.isFinite(remainingCredits) && remainingCredits > 0
    if (sub.lifecycle_status === 'expired_grace' && !hasRemainingCredits) return 'expiring'
    if (sub.lifecycle_status === 'expired_cancelled' && !hasRemainingCredits) return 'expired'
    if (sub.has_plan_instance === false) return 'preparing'
    if (!sub.start_date) return 'not_started'
    if (hasRemainingCredits) return 'active'
    if (!sub.end_date) return 'active'
  }
  if (!sub.end_date) return 'active'
  const days = Math.ceil((new Date(sub.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'expired'
  if (days <= 7) return 'expiring'
  return 'active'
}

function coachDisplayName(sub: CoachSubscription, aggregated?: CoachAggregatedInfo | null) {
  return asText(sub.coach?.name || sub.coach?.nickname || aggregated?.coach?.name, '未知教练')
}

function coachAvatar(sub: CoachSubscription, aggregated?: CoachAggregatedInfo | null) {
  return sub.coach?.avatar_url || sub.coach?.avatar || aggregated?.coach?.avatar_url || null
}

function coachSubtitle(sub: CoachSubscription, aggregated?: CoachAggregatedInfo | null) {
  const raw = sub.coach?.title || aggregated?.coach?.title || sub.coach?.bio || aggregated?.coach?.bio || ''
  const text = String(raw || '').replace(/\s+/g, ' ').trim()
  return text ? `${text.slice(0, 32)}${text.length > 32 ? '...' : ''}` : '专业认证教练'
}

function coachSpecialties(sub: CoachSubscription, aggregated?: CoachAggregatedInfo | null) {
  return (aggregated?.specialties?.length ? aggregated.specialties : sub.coach?.specialties || aggregated?.coach?.specialties || []).filter(Boolean)
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : []
}

function optionLabel(options: Array<{ label: string; value: string }>, value?: string | null) {
  if (!value) return ''
  return options.find((item) => item.value === value)?.label || value
}

function fitnessFieldValue(data: FitnessCardData | null, field: FitnessFieldKey) {
  if (!data) return '未填写'
  if (field === 'nickname') return asText(data.profile.nickname)
  if (field === 'gender') return optionLabel(GENDER_OPTIONS, data.profile.gender) || '未填写'
  if (field === 'height') return data.profile.height ? `${data.profile.height} cm` : '未填写'
  if (field === 'weight') return data.profile.weight ? `${data.profile.weight} kg` : '未填写'
  if (field === 'fitness_goals') {
    const goals = normalizeStringArray(data.answers.fitness_goals?.length ? data.answers.fitness_goals : data.profile.fitness_goal ? [data.profile.fitness_goal] : [])
    return goals.length ? goals.join('、') : '未填写'
  }
  if (field === 'fitness_level') return optionLabel(FITNESS_LEVEL_OPTIONS, data.profile.fitness_level) || '未填写'
  if (field === 'target_body_parts') {
    const list = normalizeStringArray(data.answers.target_body_parts)
    return list.length ? list.join('、') : '未填写'
  }
  if (field === 'weekly_frequency') {
    const value = Number(data.answers.weekly_frequency || 0)
    if (!value) return '未填写'
    return value >= 6 ? '6 天及以上' : `${value} 天`
  }
  if (field === 'equipment') {
    const list = normalizeStringArray(data.answers.equipment)
    return list.length ? list.join('、') : '未填写'
  }
  if (field === 'session_duration') return data.answers.session_duration ? `${data.answers.session_duration} 分钟` : '未填写'
  return '未填写'
}

function getFitnessFieldRawValue(data: FitnessCardData | null, field: FitnessFieldKey) {
  if (!data) return ''
  if (field === 'fitness_goals') return normalizeStringArray(data.answers.fitness_goals?.length ? data.answers.fitness_goals : data.profile.fitness_goal ? [data.profile.fitness_goal] : [])
  if (field === 'target_body_parts') return normalizeStringArray(data.answers.target_body_parts)
  if (field === 'equipment') return normalizeStringArray(data.answers.equipment)
  if (field === 'weekly_frequency') return String(data.answers.weekly_frequency || '')
  if (field === 'session_duration') return String(data.answers.session_duration || '')
  return String(data.profile[field as keyof FitnessProfile] ?? '')
}

const RECOMMENDED_FITNESS_FIELDS: FitnessFieldKey[] = [
  'nickname',
  'gender',
  'height',
  'weight',
  'fitness_goals',
  'fitness_level',
  'weekly_frequency',
  'session_duration',
]

function fitnessProfileMissingCount(data: FitnessCardData | null) {
  return RECOMMENDED_FITNESS_FIELDS.filter((field) => fitnessFieldValue(data, field) === '未填写').length
}

function deriveInterestTags(goals: string[]) {
  const map: Record<string, string> = {
    减脂: '减脂燃脂',
    体态矫正: '体态纠正',
    灵活柔韧: '灵活性',
    力量提升: '力量举',
    体能改善: '心肺有氧',
  }
  return goals.map((goal) => map[goal]).filter(Boolean)
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function buildMonthGrid(date: Date) {
  const month = getMonthKey(date)
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const cells: Array<{ day: number | null; dateKey: string | null }> = []
  for (let i = 0; i < first.getDay(); i += 1) cells.push({ day: null, dateKey: null })
  for (let day = 1; day <= daysInMonth; day += 1) cells.push({ day, dateKey: `${month}-${String(day).padStart(2, '0')}` })
  return cells
}

function sourceLabel(sourceType?: string) {
  if (sourceType === 'IMPROMPTU') return '即兴'
  if (sourceType === 'SELF_PLAN') return '我的计划'
  return '教练计划'
}

function messageTypeLabel(type?: string) {
  const labels: Record<string, string> = {
    image: '[图片]',
    video: '[视频]',
    voice: '[语音]',
    file: '[文件]',
    video_reference: '[视频引用]',
  }
  return labels[String(type || '')] || '[消息]'
}

function formatTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN')
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('zh-CN')
}

function planStatusLabel(status?: string | null) {
  if (status === 'active') return '进行中'
  if (status === 'completed') return '已完成'
  if (status === 'archived') return '已归档'
  if (status === 'paused') return '已暂停'
  if (status === 'scheduled') return '待开始'
  return status || '-'
}

function planSourceLabel(source?: string | null) {
  return source === 'coach' ? '教练指派' : '我的计划'
}

function formatPlanDateRange(start?: string | null, end?: string | null) {
  if (!start) return '-'
  return `${formatDate(start)} - ${end ? formatDate(end) : '至今'}`
}

function countPlanTrainingDays(days?: PlanTrainingDayDetail[] | null) {
  if (!Array.isArray(days)) return 0
  return days.filter((day) => day?.type === 'training').length
}

function getPlanDayIndex(day: PlanTrainingDayDetail, fallback: number) {
  return Number(day.dayIndex ?? day.day_index ?? fallback + 1)
}

function normalizeFavoriteTrainingDays(input: any[] | undefined | null): PlanTrainingDayDetail[] {
  if (!Array.isArray(input)) return []
  return input.map((day: any, index: number) => {
    const actionSets = Array.isArray(day.actionSets)
      ? day.actionSets
      : Array.isArray(day.actions)
        ? day.actions.map((action: any, actionIndex: number) => ({
          actionId: action.actionId,
          actionName: action.actionName || action.name,
          setName: action.actionName || action.name || `动作 ${actionIndex + 1}`,
          itemType: action.itemType || 'STRENGTH',
          sets: action.sets,
          reps: action.reps,
          params: action.params || {
            组数: action.sets,
            次数: action.reps,
            休息时间: action.restSeconds,
          },
        }))
        : []
    return {
      ...day,
      dayIndex: Number(day.dayIndex ?? day.day_index ?? index + 1),
      type: day.type === 'rest' ? 'rest' : 'training',
      note: day.note || day.dayNote || '',
      actionSets,
    }
  })
}

function rankingTypeIcon(type?: string | null): IconFontName {
  if (type === 'time') return 'icon-time'
  if (type === 'weight') return 'icon-dumbbell'
  if (type === 'reps') return 'icon-strength'
  return 'icon-ranking'
}

function formatScore(value?: unknown) {
  const num = Number(value)
  if (!Number.isFinite(num)) return asText(value, '--')
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '')
}

function isValidHttpUrl(value?: string) {
  if (!value?.trim()) return true
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function extractEntryCoreValue(entry: LeaderboardEntry, rankByField?: string | null) {
  const formData = Array.isArray(entry.form_data) ? entry.form_data : []
  const core = formData.find((item) => item.name === rankByField)
  return core?.userInput ?? entry.score ?? '--'
}

function formatLastMessagePreview(raw?: string | null) {
  if (!raw?.trim()) return '暂无消息'
  const firstLine = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map((line) => line.trim()).find(Boolean)
  if (!firstLine) return '暂无消息'
  return firstLine.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim() || '暂无消息'
}

function formatConversationTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString('zh-CN')
}

function makeLocalId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function createEmptyCoachMaterial(category: CoachApplicationMaterialCategory = 'achievement'): CoachApplicationMaterial {
  return { id: makeLocalId('material'), category, title: '', summary: '', detail: '', isPublic: true, media: [], links: [] }
}

function normalizeCoachApplicationMaterials(input: unknown, legacy?: { achievements?: string[] | null; caseStudies?: string[] | null; credentials?: Array<{ name?: string | null; url?: string | null }> | null }): CoachApplicationMaterial[] {
  const source = Array.isArray(input) && input.length > 0
    ? input
    : [
        ...(legacy?.achievements || []).map((title) => ({ category: 'achievement', title })),
        ...(legacy?.caseStudies || []).map((title) => ({ category: 'case', title })),
        ...(legacy?.credentials || []).filter((item) => item?.name).map((item) => ({ category: 'credential', title: item.name, links: item.url ? [{ label: '证书链接', url: item.url }] : [] })),
      ]
  return source.map((raw: any) => {
    const title = String(raw?.title || raw?.name || '').trim()
    if (!title) return null
    const category: CoachApplicationMaterialCategory = ['achievement', 'case', 'credential', 'media'].includes(raw?.category) ? raw.category : 'media'
    return {
      id: String(raw?.id || makeLocalId('material')),
      category,
      title: title.slice(0, 120),
      summary: String(raw?.summary || '').trim() || null,
      detail: String(raw?.detail || raw?.description || '').trim() || null,
      isPublic: raw?.isPublic === false || raw?.is_public === false ? false : true,
      media: Array.isArray(raw?.media) ? raw.media.filter((item: any) => item?.url).map((item: any) => ({
        id: String(item.id || makeLocalId('media')),
        type: item.type === 'video' ? 'video' : 'image',
        url: String(item.url),
        thumbnailUrl: item.thumbnailUrl || item.thumbnail_url || null,
        fileName: item.fileName || item.file_name || null,
      })).slice(0, 8) : [],
      links: Array.isArray(raw?.links) ? raw.links.filter((item: any) => item?.url).map((item: any) => ({
        id: String(item.id || makeLocalId('link')),
        label: String(item.label || item.name || '相关链接'),
        url: String(item.url),
      })).slice(0, 8) : [],
    } satisfies CoachApplicationMaterial
  }).filter(Boolean) as CoachApplicationMaterial[]
}

function deriveLegacyFieldsFromMaterials(materials: CoachApplicationMaterial[]) {
  return {
    achievements: materials.filter((item) => item.category === 'achievement').map((item) => item.summary ? `${item.title}：${item.summary}` : item.title),
    caseStudies: materials.filter((item) => item.category === 'case').map((item) => item.summary ? `${item.title}：${item.summary}` : item.title),
    credentials: materials.filter((item) => item.category === 'credential').map((item) => ({ name: item.title, url: item.links[0]?.url || item.media[0]?.url || undefined })),
  }
}

function socialLinksToObject(links: Array<{ name: string; url: string }>) {
  const keyMap: Record<string, string> = { 抖音: 'douyin', 小红书: 'xiaohongshu', 知乎: 'zhihu', B站: 'bilibili', 快手: 'kuaishou', 其他网站: 'other' }
  const out: Record<string, string> = {}
  links.forEach((link) => {
    const key = keyMap[link.name]
    if (key && link.url.trim()) out[key] = link.url.trim()
  })
  return out
}

function socialObjectToLinks(value?: Record<string, string> | null) {
  if (!value) return []
  const labelMap: Record<string, string> = { douyin: '抖音', xiaohongshu: '小红书', zhihu: '知乎', bilibili: 'B站', kuaishou: '快手', other: '其他网站' }
  return Object.entries(value).map(([key, url]) => ({ name: labelMap[key] || key, url: String(url) }))
}

function coachApplicationStatusMeta(status?: string | null) {
  const map: Record<string, { text: string; color: string; bg: string }> = {
    pending: { text: '待审核', color: '#B7791F', bg: '#FFFBEB' },
    reviewing: { text: '审核中', color: '#B7791F', bg: '#FFFBEB' },
    needs_info: { text: '待补充材料', color: '#C05621', bg: '#FFF7ED' },
    approved: { text: '已通过', color: colors.success, bg: '#ECFDF5' },
    rejected: { text: '已拒绝', color: colors.danger, bg: '#FEF2F2' },
  }
  return map[String(status || '')] || { text: '未申请', color: colors.textSecondary, bg: colors.surfaceMuted }
}

function emptyCoachApplicationForm(user?: any): CoachApplicationForm {
  return {
    name: user?.nickname || user?.name || '',
    title: '',
    bio: '',
    yearsExperience: '',
    teachingPhilosophy: '',
    contactEmail: user?.email || '',
    contactPhone: user?.phone || '',
    specialties: [],
    applicationMaterials: [],
    socialLinks: [],
    coachTrack: '',
    serviceModes: [],
    targetStudentLevels: [],
    supportFocus: '',
    province: '',
    city: '',
    county: '',
    address: '',
  }
}

function normalizeMembershipTier(value?: string): MembershipTier {
  return value === 'basic' || value === 'premium' || value === 'trial' ? value : 'free'
}

function tierToneStyle(tier: MembershipTier) {
  if (tier === 'basic') return local.tierToneInfo
  if (tier === 'premium') return local.tierTonePremium
  if (tier === 'trial') return local.tierToneTrial
  return local.tierToneNeutral
}

function actionTypeLabel(type?: string | null) {
  const normalized = String(type || '').toUpperCase()
  if (normalized === 'CARDIO') return '有氧'
  if (normalized === 'FLEXIBILITY') return '柔韧'
  if (normalized === 'MOBILITY') return '灵活性'
  if (normalized === 'SKILL') return '技术'
  if (normalized === 'STRENGTH') return '力量'
  return type ? String(type) : '力量'
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || '').trim()).filter(Boolean)
}

function actionName(action?: ActionDetailData | null) {
  return asText(action?.name || action?.action_name, '动作详情')
}

function actionDetailText(action?: ActionDetailData | null) {
  return asText(action?.detail || action?.description, '暂无描述')
}

function actionVideoUrl(action?: ActionDetailData | null) {
  return asText(action?.url || action?.video_url, '')
}

function DataListScreen({
  title,
  subtitle,
  path,
  method = 'POST',
  body,
  listKeys,
  icon,
  emptyTitle,
  renderItem,
}: {
  title: string
  subtitle?: string
  path: string
  method?: 'GET' | 'POST'
  body?: unknown
  listKeys: string[]
  icon: IconFontName
  emptyTitle: string
  renderItem?: (item: AnyRecord, index: number) => ReactNode
}) {
  const navigation = useNavigationAny()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [items, setItems] = useState<AnyRecord[]>([])
  const [error, setError] = useState('')

  async function load(silent = false) {
    if (!silent) setLoading(true)
    setError('')
    try {
      const data = await requestMaybe<unknown>(path, { method, body })
      setItems(pickList(data, listKeys) as AnyRecord[])
    } catch (err) {
      setError(errorMessage(err))
      setItems([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void load()
  }, [path])

  return (
    <ScreenShell title={title} subtitle={subtitle} onBack={navigation.goBack}>
      {loading ? <LoadingState /> : null}
      {!loading && error ? <EmptyState title="加载失败" desc={error} icon="icon-wenhao" /> : null}
      {!loading && !error && items.length === 0 ? <EmptyState title={emptyTitle} icon={icon} /> : null}
      {!loading && !error && items.length > 0 ? (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true) }} />} scrollEnabled={false}>
          <Card>
            {items.map((item, index) => (
              <View key={String(item.id || item.roomId || item.orderId || index)} style={local.itemBlock}>
                {renderItem ? renderItem(item, index) : (
                  <>
                    <Text style={local.itemTitle}>{labelFromItem(item, ['name', 'title', 'label', 'coachName', 'product_name', 'order_title'])}</Text>
                    <Text style={local.itemMeta}>{secondaryFromItem(item, ['description', 'status', 'created_at', 'updated_at']) || '已同步到 APP'}</Text>
                  </>
                )}
              </View>
            ))}
          </Card>
        </ScrollView>
      ) : null}
    </ScreenShell>
  )
}

function useNavigationAny() {
  return useNavigation<any>()
}

function useRouteAny<T extends keyof RootStackParamList>() {
  return useRoute<NavProps<T>['route']>()
}

export function ProfileScreen() {
  const navigation = useNavigationAny()
  const { user, isAuthenticated, logout, refreshUser, switchRole } = useAuth()
  const { open } = useProtectedNavigation(navigation)
  const [stats, setStats] = useState({ actions: 0, plans: 0, trainingActions: 0 })
  const [membership, setMembership] = useState<any>(null)
  const [profileMissingCount, setProfileMissingCount] = useState(0)
  const [roleSwitching, setRoleSwitching] = useState(false)

  async function loadStats() {
    if (!isAuthenticated) return
    const [actions, plans, history, membershipStatus, profileStatus] = await Promise.allSettled([
      requestMaybe<any>('/api/student/action-lib/list-actions', { body: { page: 1, limit: 1, search: '' } }),
      requestMaybe<any>('/api/student/plan-lib/list-favorites', { body: { page: 1, limit: 1, search: '' } }),
      requestMaybe<any>('/api/training-history/summary', { method: 'GET' }),
      requestMaybe<any>('/api/membership/get-status', { method: 'GET' }),
      requestMaybe<{ profile?: FitnessProfile | null; questionnaire?: { answers?: FitnessAnswers } | null }>('/api/user/get-student-profile', {
        body: user?.id ? { userId: user.id } : {},
      }),
    ])
    setStats({
      actions: actions.status === 'fulfilled' ? Number(actions.value?.totalCount ?? actions.value?.actions?.length ?? 0) : 0,
      plans: plans.status === 'fulfilled' ? Number(plans.value?.totalCount ?? plans.value?.total ?? plans.value?.favorites?.length ?? 0) : 0,
      trainingActions: history.status === 'fulfilled' ? Number(history.value?.totalActions ?? 0) : 0,
    })
    if (membershipStatus.status === 'fulfilled') setMembership(membershipStatus.value)
    if (profileStatus.status === 'fulfilled') {
      setProfileMissingCount(fitnessProfileMissingCount({
        profile: profileStatus.value?.profile || {},
        answers: profileStatus.value?.questionnaire?.answers || {},
      }))
    } else {
      setProfileMissingCount(0)
    }
  }

  useEffect(() => {
    void refreshUser()
    void loadStats()
  }, [isAuthenticated])

  const displayName = isAuthenticated ? asText(user?.nickname || user?.name || user?.phone, 'CoachLink 学员') : '未登录'
  const subtitle = isAuthenticated ? asText(user?.phone || user?.email, '训练、服务和消息会在这里持续沉淀') : '登录后同步训练记录、会员、订单和消息'

  async function enterCoachMode() {
    try {
      setRoleSwitching(true)
      await switchRole('coach')
      navigation.getParent()?.reset({ index: 0, routes: [{ name: 'MainTabs' }] })
    } catch (error) {
      Alert.alert('切换失败', errorMessage(error))
    } finally {
      setRoleSwitching(false)
    }
  }

  function confirmCoachMode() {
    Alert.alert('进入教练端', '将切换到教练工作台。你的个人训练记录和学员身份会继续保留。', [
      { text: '取消', style: 'cancel' },
      { text: '确认切换', onPress: () => void enterCoachMode() },
    ])
  }

  const topMenus = [
    { label: '我的动作库', value: stats.actions, unit: '项', icon: 'icon-dumbbell' as IconFontName, route: 'ActionLibrary' as ListRoute },
    { label: '我的计划库', value: stats.plans, unit: '项', icon: 'icon-a-Trainingplan' as IconFontName, route: 'PlanLibrary' as ListRoute },
    { label: '训练记录', value: stats.trainingActions, unit: '个动作', icon: 'icon-training_history' as IconFontName, route: 'TrainingHistory' as ListRoute },
  ]

  return (
    <ScreenShell title="我的" subtitle="账号、训练资料和应用设置。">
      <Card style={local.profileCard}>
        <View style={local.profileTop}>
          <InlineAvatar uri={user?.avatar_url || user?.avatar} label={displayName} size={72} />
          <View style={{ flex: 1 }}>
            <Text style={local.profileName}>{displayName}</Text>
            <Text style={local.profileSubtitle}>{subtitle}</Text>
            <Pressable onPress={() => open('ProfileEdit')}>
              <Text style={local.profileLink}>{isAuthenticated ? '编辑资料' : '点击登录'} · {isAuthenticated ? `${user?.primary_role === 'coach' ? '教练身份' : '学员身份'}` : '游客模式'}</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => Alert.alert('主题', 'APP 端主题切换会随系统设置自动生效。')} style={local.roundIcon}>
            <IconFont name="icon-zaoshang" size={24} color={colors.brand} />
          </Pressable>
        </View>
        <View style={local.statsRow}>
          {topMenus.map((item) => (
            <Pressable key={item.label} style={local.statItem} onPress={() => open(item.route)}>
              <IconFont name={item.icon} size={24} color={colors.brand} />
              <Text style={local.statValue}>{item.value}</Text>
              <Text style={local.statLabel}>{item.label}</Text>
              <Text style={local.statUnit}>{item.unit}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {!isAuthenticated ? (
        <Card>
          <Text style={local.noticeTitle}>先逛逛也可以</Text>
          <Text style={local.noticeDesc}>公开教练、知识和工具可先浏览；需要保存训练、订单和消息时再登录。</Text>
        </Card>
      ) : null}

      <Card>
        <MenuRow
          label="健身资料卡"
          icon="icon-account-settings-variant"
          iconBg="#CF6D4E"
          badge={profileMissingCount > 0 ? `待完善 ${profileMissingCount}` : undefined}
          onPress={() => open('FitnessCard')}
        />
        <MenuRow label="全部计划" icon="icon-a-Trainingplan" iconBg="#29C3A3" onPress={() => open('PlanHistory')} />
        <MenuRow label="排行榜" icon="icon-ranking" iconBg="#CF6D4E" onPress={() => open('Ranking')} />
        <MenuRow label="我的教练" icon="icon-coachline_line" iconBg="#5C8DFF" onPress={() => open('MyCoaches')} />
        <MenuRow label="我的会员" desc={membership?.membership?.name || membership?.level || '查看会员状态'} icon="icon-vips" iconBg="#FFA940" onPress={() => open('Membership')} />
        <MenuRow label="消息中心" icon="icon-messages" iconBg="#26A69A" onPress={() => open('Messages')} />
        <MenuRow label="我的主页" icon="icon-user" iconBg="#8FD3FE" onPress={() => open('UserHome')} />
        <MenuRow label="购买记录" icon="icon-goumaijilu" iconBg="#722ed1" onPress={() => open('PurchaseHistory')} />
        <MenuRow label="购物车" icon="icon-goumaijilu" iconBg="#B37FEB" onPress={() => open('Cart')} />
        <MenuRow label="我的朋友" icon="icon-friends-o" iconBg="#29C3A3" onPress={() => open('Friends')} />
        <MenuRow label="加入内测群" icon="icon-messages" iconBg="#CF6D4E" onPress={() => Linking.openURL(STUDENT_BETA_GROUP_IMAGE)} />
      </Card>

      <Card>
        {!isAuthenticated ? (
          <>
            <MenuRow label="立即登录" icon="icon-login" iconBg="#29C3A3" badge="推荐" onPress={() => navigation.navigate('Login')} />
            <MenuRow label="注册账号" icon="icon-account-settings-variant" iconBg="#5C8DFF" onPress={() => navigation.navigate('Register')} />
          </>
        ) : (
          <>
            {user?.is_coach ? (
              <MenuRow label="切换到教练端" desc="进入学员、计划、视频与经营工作台" icon="icon-dashboard" iconBg="#CF6D4E" badge={roleSwitching ? '切换中' : '教练身份'} onPress={roleSwitching ? undefined : confirmCoachMode} />
            ) : (
              <MenuRow label="申请成为教练" icon="icon-shenqingquanxian" iconBg="#FFD700" onPress={() => open('CoachApplication')} />
            )}
            <MenuRow label="账户设置" icon="icon-account-settings-variant" iconBg="#B0BEC5" onPress={() => open('Settings')} />
            <Pressable onPress={() => confirm('退出登录', '确定要退出当前账号吗？', () => void logout())} style={local.logoutRow}>
              <IconFont name="icon-exit" size={20} color={colors.danger} />
              <Text style={local.logoutText}>退出登录</Text>
            </Pressable>
          </>
        )}
      </Card>
    </ScreenShell>
  )
}

export function ProfileDetailScreen() {
  const navigation = useNavigationAny()
  const { user } = useAuth()
  return (
    <ScreenShell title="个人资料" subtitle="账号基础信息和训练身份。" onBack={navigation.goBack}>
      <Card>
        <View style={local.center}>
          <InlineAvatar uri={user?.avatar_url || user?.avatar} label={user?.nickname || user?.phone} size={96} />
          <Text style={local.profileName}>{asText(user?.nickname || user?.name || user?.phone, 'CoachLink 学员')}</Text>
          <Text style={local.profileSubtitle}>{asText(user?.phone || user?.email, '未绑定联系方式')}</Text>
        </View>
        <InfoLine label="身份" value={user?.primary_role === 'coach' ? '教练' : '学员'} />
        <InfoLine label="用户 ID" value={user?.id || '-'} />
      </Card>
    </ScreenShell>
  )
}

export function ProfileEditScreen() {
  const navigation = useNavigationAny()
  const { user, setLocalUser } = useAuth()
  const [nickname, setNickname] = useState(asText(user?.nickname || user?.name, ''))
  const [age, setAge] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [fitnessGoal, setFitnessGoal] = useState('')
  const [loading, setLoading] = useState(false)

  async function save() {
    setLoading(true)
    try {
      const data = await safeRequest<any>('/api/user/update-profile', {
        body: {
          nickname: nickname.trim(),
          age: age ? Number(age) : undefined,
          height: height ? Number(height) : undefined,
          weight: weight ? Number(weight) : undefined,
          fitness_goal: fitnessGoal.trim() || undefined,
        },
      })
      const nextUser = { ...(user || {}), nickname: nickname.trim() || user?.nickname }
      const token = await getStoredToken()
      if (user?.id && token) await persistSession({ user: nextUser as any, token })
      setLocalUser(nextUser as any)
      Alert.alert('已保存', data?.message || '个人资料已更新')
    } catch (error) {
      Alert.alert('保存失败', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  async function uploadAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.82 })
    if (result.canceled || !result.assets[0]?.uri) return
    const token = await getStoredToken()
    const form = new FormData()
    form.append('file', { uri: result.assets[0].uri, name: 'avatar.jpg', type: 'image/jpeg' } as any)
    const response = await fetch(`${API_BASE_URL}/api/upload/avatar`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: form })
    const json = await response.json()
    if (!response.ok || !json?.success || !json?.data?.url) throw new Error(json?.message || '头像上传失败')
    await safeRequest('/api/user/update-profile', { body: { avatar_url: json.data.url } })
    const nextUser = { ...(user || {}), avatar_url: json.data.url }
    if (user?.id && token) await persistSession({ user: nextUser as any, token })
    setLocalUser(nextUser as any)
  }

  return (
    <ScreenShell title="编辑资料" subtitle="与小程序资料编辑保持同一账号资料。" onBack={navigation.goBack}>
      <Card>
        <Pressable style={local.center} onPress={() => void uploadAvatar().catch((e) => Alert.alert('头像上传失败', errorMessage(e)))}>
          <InlineAvatar uri={user?.avatar_url || user?.avatar} label={nickname || user?.phone} size={88} />
          <Text style={local.profileLink}>更换头像</Text>
        </Pressable>
        <FormField label="昵称" value={nickname} onChangeText={setNickname} />
        <FormField label="年龄" value={age} onChangeText={setAge} keyboardType="numeric" />
        <FormField label="身高 cm" value={height} onChangeText={setHeight} keyboardType="numeric" />
        <FormField label="体重 kg" value={weight} onChangeText={setWeight} keyboardType="numeric" />
        <FormField label="训练目标" value={fitnessGoal} onChangeText={setFitnessGoal} multiline />
        <SolidButton label="保存资料" loading={loading} onPress={save} />
      </Card>
    </ScreenShell>
  )
}

export function FitnessCardScreen() {
  const navigation = useNavigationAny()
  const { user, refreshUser } = useAuth()
  const [data, setData] = useState<FitnessCardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingField, setEditingField] = useState<FitnessFieldKey | null>(null)
  const [draftValue, setDraftValue] = useState('')
  const [draftList, setDraftList] = useState<string[]>([])
  const fields: FitnessFieldKey[] = ['nickname', 'gender', 'height', 'weight', 'fitness_goals', 'fitness_level', 'target_body_parts', 'weekly_frequency', 'equipment', 'session_duration']
  const missingRecommendedCount = fitnessProfileMissingCount(data)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const profile = await apiClient.request<{ profile?: FitnessProfile | null; questionnaire?: { answers?: FitnessAnswers } | null }>('/api/user/get-student-profile', {
        method: 'POST',
        body: user?.id ? { userId: user.id } : {},
        timeoutMs: 12000,
      })
      const answers = profile.questionnaire?.answers || {}
      setData({
        profile: profile.profile || {},
        answers: {
          flow_version: String(answers.flow_version || 'registration_unified_v2'),
          fitness_goals: normalizeStringArray(answers.fitness_goals || profile.profile?.fitness_goal ? answers.fitness_goals || [profile.profile?.fitness_goal] : []),
          interest_tags: normalizeStringArray(answers.interest_tags),
          equipment: normalizeStringArray(answers.equipment),
          weekly_frequency: Number(answers.weekly_frequency || 0) || undefined,
          session_duration: Number(answers.session_duration || 0) || undefined,
          target_body_parts: normalizeStringArray(answers.target_body_parts),
        },
      })
    } catch (err) {
      setError(errorMessage(err))
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [user?.id])

  function openField(field: FitnessFieldKey) {
    const raw = getFitnessFieldRawValue(data, field)
    setEditingField(field)
    if (Array.isArray(raw)) {
      setDraftList(raw)
      setDraftValue('')
    } else {
      setDraftValue(String(raw || ''))
      setDraftList([])
    }
  }

  function closeEditor() {
    setEditingField(null)
    setDraftValue('')
    setDraftList([])
  }

  async function saveField(value: string | string[] = draftValue) {
    if (!editingField || !data) return
    setSaving(true)
    try {
      if (editingField === 'nickname' || editingField === 'gender' || editingField === 'height' || editingField === 'weight' || editingField === 'fitness_level') {
        const payload: Record<string, unknown> = {}
        if (editingField === 'height' || editingField === 'weight') {
          const parsed = Number(value)
          payload[editingField] = Number.isFinite(parsed) && parsed > 0 ? parsed : null
        } else {
          payload[editingField] = String(value || '').trim()
        }
        const updated = await apiClient.request<FitnessProfile>('/api/user/update-profile', { method: 'POST', body: payload, timeoutMs: 12000 })
        setData((prev) => prev ? { ...prev, profile: { ...prev.profile, ...updated } } : prev)
        if (editingField === 'nickname') void refreshUser()
      } else if (editingField === 'fitness_goals') {
        const goals = normalizeStringArray(value)
        if (goals.length === 0) throw new Error('请至少选择一个健身目标')
        const profilePayload = { fitness_goal: goals[0] }
        await apiClient.request('/api/user/update-profile', { method: 'POST', body: profilePayload, timeoutMs: 12000 })
        const answers = { ...data.answers, flow_version: 'registration_unified_v2', fitness_goals: goals, interest_tags: deriveInterestTags(goals) }
        await apiClient.request('/api/user/submit-onboarding', { method: 'POST', body: { answers, baseline_video_urls: [] }, timeoutMs: 12000 })
        setData((prev) => prev ? { ...prev, profile: { ...prev.profile, ...profilePayload }, answers } : prev)
      } else {
        const normalizedValue = editingField === 'weekly_frequency' || editingField === 'session_duration'
          ? Number(value || 0)
          : normalizeStringArray(value)
        const answers = { ...data.answers, flow_version: 'registration_unified_v2', [editingField]: normalizedValue }
        await apiClient.request('/api/user/submit-onboarding', { method: 'POST', body: { answers, baseline_video_urls: [] }, timeoutMs: 12000 })
        setData((prev) => prev ? { ...prev, answers } : prev)
      }
      closeEditor()
      Alert.alert('已保存', '健身资料已更新')
    } catch (err) {
      Alert.alert('保存失败', errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScreenShell title="健身资料卡" subtitle="保留注册引导里填过的完整健身档案，点击任意一项单独修改。" onBack={navigation.goBack}>
      {loading ? <LoadingState /> : null}
      {!loading && error ? (
        <>
          <EmptyState title="资料加载失败" desc={error} icon="icon-account-settings-variant" />
          <SolidButton label="重试" variant="secondary" onPress={() => void load()} />
        </>
      ) : null}
      {!loading && !error ? (
        <>
          <Card style={local.fitnessPreview}>
            <View style={local.fitnessAvatarRow}>
              <InlineAvatar uri={data?.profile.avatar_url || undefined} label={data?.profile.nickname || user?.nickname || 'C'} size={72} />
              <View style={local.fitnessPreviewText}>
                <View style={local.fitnessTitleRow}>
                  <Text style={local.fitnessPreviewTitle}>{data?.profile.nickname || user?.nickname || 'CoachLink 用户'}</Text>
                  <View style={[local.fitnessCompletionBadge, missingRecommendedCount === 0 && local.fitnessCompletionBadgeDone]}>
                    <Text style={[local.fitnessCompletionBadgeText, missingRecommendedCount === 0 && local.fitnessCompletionBadgeTextDone]}>
                      {missingRecommendedCount > 0 ? `待完善 ${missingRecommendedCount} 项` : '已完善'}
                    </Text>
                  </View>
                </View>
                <Text style={local.fitnessPreviewDesc}>资料越完整，训练计划和教练沟通越准确。</Text>
              </View>
            </View>
            {missingRecommendedCount > 0 ? (
              <View style={local.fitnessCompletionHint}>
                <Text style={local.fitnessCompletionHintText}>注册已完成，不影响使用；点击下方未填写项目即可随时补充。</Text>
              </View>
            ) : null}
          </Card>
          <Card style={local.fitnessFieldList}>
            {fields.map((field) => {
              const value = fitnessFieldValue(data, field)
              return (
                <Pressable key={field} onPress={() => openField(field)} style={local.fitnessFieldRow}>
                  <View style={local.fitnessFieldMain}>
                    <Text style={local.fitnessFieldLabel}>{FITNESS_FIELD_LABELS[field]}</Text>
                    <Text style={[local.fitnessFieldValue, value === '未填写' && local.fitnessFieldEmpty]}>{value}</Text>
                  </View>
                  <IconFont name="icon-right-arrow" color={colors.textMuted} size={18} />
                </Pressable>
              )
            })}
          </Card>
        </>
      ) : null}
      <FitnessFieldModal
        field={editingField}
        value={draftValue}
        list={draftList}
        saving={saving}
        onChangeValue={setDraftValue}
        onChangeList={setDraftList}
        onClose={closeEditor}
        onSave={saveField}
      />
    </ScreenShell>
  )
}

export function E1RMChartScreen() {
  const navigation = useNavigationAny()
  const [actions, setActions] = useState<StudentActionItem[]>([])
  const [selectedActionId, setSelectedActionId] = useState('')
  const [history, setHistory] = useState<E1RMHistoryPoint[]>([])
  const [currentPR, setCurrentPR] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadActions() {
    setLoading(true)
    setError('')
    try {
      const data = await apiClient.request<{ actions?: StudentActionItem[] }>('/api/student/action-lib/list-actions', {
        method: 'POST',
        body: { page: 1, limit: 100, search: '' },
        timeoutMs: 12000,
      })
      const list = data.actions || []
      setActions(list)
      if (!selectedActionId && list[0]?.id) setSelectedActionId(list[0].id)
      if (list.length === 0) setLoading(false)
    } catch (err) {
      setError(errorMessage(err))
      setLoading(false)
    }
  }

  async function loadHistory(actionId: string) {
    const action = actions.find((item) => item.id === actionId)
    if (!action) return
    setLoading(true)
    setError('')
    try {
      const data = await apiClient.request<{ history?: E1RMHistoryPoint[]; currentPR?: number }>('/api/student/get-e1rm-history', {
        method: 'POST',
        body: { actionId: action.id, actionName: action.name, limit: 100 },
        timeoutMs: 15000,
      })
      setHistory(data.history || [])
      setCurrentPR(data.currentPR)
    } catch (err) {
      setError(errorMessage(err))
      setHistory([])
      setCurrentPR(undefined)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadActions()
  }, [])

  useEffect(() => {
    if (selectedActionId) void loadHistory(selectedActionId)
  }, [selectedActionId, actions.length])

  const values = history.map((item) => Number(item.e1rm ?? item.value ?? 0)).filter((item) => item > 0)
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 0
  const latest = values[values.length - 1]

  return (
    <ScreenShell title="力量进步曲线" subtitle="从计划训练和即兴训练同步的 e1RM 记录。" onBack={navigation.goBack}>
      <Card style={local.e1rmSelectorCard}>
        <Text style={local.sectionTitle}>选择动作</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={local.e1rmActionList}>
          {actions.map((action) => (
            <Pressable key={action.id} onPress={() => setSelectedActionId(action.id)} style={[local.e1rmActionChip, selectedActionId === action.id && local.e1rmActionChipActive]}>
              <Text style={[local.e1rmActionText, selectedActionId === action.id && local.e1rmActionTextActive]}>{action.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Card>
      {loading ? <LoadingState /> : null}
      {!loading && error ? <EmptyState title="加载失败" desc={error} icon="icon-strength" /> : null}
      {!loading && !error && actions.length === 0 ? <EmptyState title="暂无动作" desc="先去动作库添加常练动作，完成训练后会自动生成曲线。" icon="icon-strength" /> : null}
      {!loading && !error && actions.length > 0 ? (
        <>
          <Card style={local.e1rmChartCard}>
            <View style={local.e1rmStatsRow}>
              <View><Text style={local.metricLabel}>当前 PR</Text><Text style={local.metricValue}>{currentPR ? `${currentPR}kg` : '-'}</Text></View>
              <View><Text style={local.metricLabel}>最新</Text><Text style={local.metricValue}>{latest ? `${latest}kg` : '-'}</Text></View>
              <View><Text style={local.metricLabel}>记录数</Text><Text style={local.metricValue}>{history.length}</Text></View>
            </View>
            {history.length >= 2 ? (
              <View style={local.e1rmBars}>
                {history.map((point, index) => {
                  const value = Number(point.e1rm ?? point.value ?? 0)
                  const ratio = max === min ? 0.5 : (value - min) / Math.max(1, max - min)
                  return (
                    <View key={`${point.date}-${index}`} style={local.e1rmBarItem}>
                      <Text style={local.e1rmBarValue}>{Math.round(value)}</Text>
                      <View style={[local.e1rmBar, { height: 40 + ratio * 104 }, point.isPR && local.e1rmBarPr]} />
                      <Text style={local.e1rmBarDate}>{String(point.date).slice(5)}</Text>
                    </View>
                  )
                })}
              </View>
            ) : (
              <EmptyState title="数据不足，无法绘制图表" desc="至少完成两次同动作有效训练后展示趋势。" icon="icon-strength" />
            )}
          </Card>
          <Card style={local.prListCard}>
            <Text style={local.sectionTitle}>PR 记录</Text>
            {history.filter((item) => item.isPR).length === 0 ? <Text style={local.itemMeta}>暂无 PR 记录</Text> : null}
            {history.filter((item) => item.isPR).map((item, index) => (
              <View key={`${item.date}-${index}`} style={local.prRow}>
                <View>
                  <Text style={local.prAction}>{actions.find((action) => action.id === selectedActionId)?.name || '动作'}</Text>
                  <Text style={local.itemMeta}>{item.date} · {item.source || 'training'}</Text>
                </View>
                <Text style={local.prValue}>{Math.round(Number(item.e1rm ?? item.value ?? 0))} kg</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </ScreenShell>
  )
}

export function ActionLibraryScreen() {
  const navigation = useNavigationAny()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actions, setActions] = useState<ActionDetailData[]>([])
  const [error, setError] = useState('')

  async function load(silent = false) {
    if (!silent) setLoading(true)
    setError('')
    try {
      const data = await requestMaybe<unknown>('/api/student/action-lib/list-actions', { body: { page: 1, limit: 80, search: '' } })
      setActions(pickList(data, ['actions', 'items', 'data']) as ActionDetailData[])
    } catch (err) {
      setError(errorMessage(err))
      setActions([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <ScreenShell title="我的动作库" subtitle="管理个人动作、参考 1RM 和演示链接。" onBack={navigation.goBack}>
      <Card>
        <MenuRow label="从教练复制动作" desc="选择已订阅教练分享的动作，一键添加到我的动作库。" icon="icon-coachline_line" iconBg="#5C8DFF" onPress={() => navigation.navigate('CopyCoachActions')} />
        <SolidButton label="新增动作" variant="secondary" onPress={() => navigation.navigate('ActionEdit')} />
      </Card>
      {loading ? <LoadingState /> : null}
      {!loading && error ? (
        <>
          <EmptyState title="加载失败" desc={error} icon="icon-wenhao" />
          <SolidButton label="重试" onPress={() => void load()} />
        </>
      ) : null}
      {!loading && !error && actions.length === 0 ? <EmptyState title="暂无动作" desc="先新增动作，或从已订阅教练的动作库复制。" icon="icon-dumbbell" /> : null}
      {!loading && !error && actions.length > 0 ? (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true) }} />} scrollEnabled={false}>
          <Card>
            {actions.map((item, index) => (
              <View key={String(item.id || item.name || index)} style={local.itemBlock}>
                <Pressable onPress={() => navigation.navigate('ActionDetail', { id: item.id, action: item, source: 'mine' })} style={local.actionListItem}>
                  <View style={local.actionListMain}>
                    <Text style={local.itemTitle}>{actionName(item)}</Text>
                    <Text style={local.itemMeta}>{secondaryFromItem(item as AnyRecord, ['type', 'detail']) || `参考 1RM：${asText(item.reference_1rm, '未设置')}`}</Text>
                  </View>
                  <IconFont name="icon-right-arrow" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </Card>
        </ScrollView>
      ) : null}
    </ScreenShell>
  )
}

export function ActionDetailScreen() {
  const navigation = useNavigationAny()
  const route = useRouteAny<'ActionDetail'>()
  const id = route.params?.id || route.params?.action?.id
  const source = route.params?.source || 'mine'
  const [action, setAction] = useState<ActionDetailData | null>(route.params?.action || null)
  const [loading, setLoading] = useState(!route.params?.action && Boolean(id))
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      if (route.params?.action || !id) return
      setLoading(true)
      setError('')
      try {
        const data = await requestMaybe<unknown>('/api/student/action-lib/list-actions', { body: { page: 1, limit: 100, search: '' } })
        const list = pickList(data, ['actions', 'items', 'data']) as ActionDetailData[]
        const found = list.find((item) => String(item.id) === String(id))
        if (alive) setAction(found || null)
      } catch (err) {
        if (alive) setError(errorMessage(err, '加载动作详情失败'))
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [id, route.params?.action])

  const positions = normalizeStringList(action?.positions)
  const attrs = normalizeStringList(action?.attrs)
  const videoUrl = actionVideoUrl(action)

  async function copyVideoUrl() {
    if (!videoUrl) {
      Alert.alert('暂无可复制内容', '这个动作还没有配置演示视频链接。')
      return
    }
    await Clipboard.setStringAsync(videoUrl)
    Alert.alert('链接已复制')
  }

  return (
    <ScreenShell title={actionName(action)} subtitle={source === 'coach' ? '教练动作详情' : '动作详情'} onBack={navigation.goBack}>
      {loading ? <LoadingState title="正在加载动作详情" /> : null}
      {!loading && error ? <EmptyState title="加载失败" desc={error} icon="icon-wenhao" /> : null}
      {!loading && !error && !action ? (
        <EmptyState title="未找到动作详情" desc={id ? `动作 ID：${id}` : '请返回动作库重新进入。'} icon="icon-dumbbell" />
      ) : null}
      {!loading && !error && action ? (
        <Card>
          <View style={local.actionDetailHeader}>
            <Text style={local.actionDetailTitle}>{actionName(action)}</Text>
            <Text style={local.typePill}>{actionTypeLabel(action.type)}</Text>
          </View>
          <View style={local.detailSection}>
            <Text style={local.sectionTitle}>动作说明</Text>
            <Text style={local.itemMeta}>{actionDetailText(action)}</Text>
          </View>
          {positions.length > 0 ? (
            <View style={local.detailSection}>
              <Text style={local.sectionTitle}>训练部位</Text>
              <View style={local.tagWrap}>
                {positions.map((item, index) => <Text key={`${item}-${index}`} style={local.actionTag}>{item}</Text>)}
              </View>
            </View>
          ) : null}
          {attrs.length > 0 ? (
            <View style={local.detailSection}>
              <Text style={local.sectionTitle}>动作属性</Text>
              <View style={local.tagWrap}>
                {attrs.map((item, index) => <Text key={`${item}-${index}`} style={local.actionTag}>{item}</Text>)}
              </View>
            </View>
          ) : null}
          {videoUrl ? (
            <View style={local.detailSection}>
              <Text style={local.sectionTitle}>演示视频链接</Text>
              <Text selectable style={local.videoUrl}>{videoUrl}</Text>
              <SolidButton label="复制视频链接" variant="secondary" onPress={copyVideoUrl} />
            </View>
          ) : null}
          {source === 'mine' ? <SolidButton label="编辑动作" onPress={() => navigation.navigate('ActionEdit', { id: action.id || id })} /> : null}
        </Card>
      ) : null}
    </ScreenShell>
  )
}

export function CopyCoachActionsScreen() {
  const navigation = useNavigationAny()
  const [actions, setActions] = useState<CoachActionItem[]>([])
  const [coachName, setCoachName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copyingId, setCopyingId] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await requestMaybe<unknown>('/api/student/action-lib/list-coach-actions', { body: {} })
      const record = data && typeof data === 'object' ? data as AnyRecord : {}
      setActions(pickList(record, ['actions', 'items', 'data']) as CoachActionItem[])
      setCoachName(asText(record.coachName || record.coach?.name, ''))
    } catch (err) {
      setError(errorMessage(err, '加载教练动作库失败'))
      setActions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function copyCoachAction(action: CoachActionItem) {
    if (action.isAdded || action.is_added || copyingId) return
    setCopyingId(action.id)
    try {
      await safeRequest('/api/student/action-lib/copy-coach-action', { body: { coachActionId: action.id } })
      setActions((prev) => prev.map((item) => item.id === action.id ? { ...item, isAdded: true, is_added: true } : item))
      Alert.alert('已添加到我的动作库')
    } catch (err) {
      Alert.alert('添加失败', errorMessage(err))
    } finally {
      setCopyingId('')
    }
  }

  return (
    <ScreenShell title="从教练复制动作" subtitle="选择你订阅的教练分享的动作，一键复制到我的动作库。" onBack={navigation.goBack}>
      {loading ? <LoadingState title="正在加载教练动作" /> : null}
      {!loading && error ? (
        <>
          <EmptyState title="加载失败" desc={error} icon="icon-wenhao" />
          <SolidButton label="重试" onPress={() => void load()} />
        </>
      ) : null}
      {!loading && !error && actions.length === 0 ? (
        <EmptyState title="暂无教练动作" desc="订阅教练后，可在此处添加教练分享的动作。" icon="icon-coachline_line" />
      ) : null}
      {!loading && !error && actions.length > 0 ? (
        <>
          {coachName ? <Text style={local.coachHint}>教练：{coachName}</Text> : null}
          {actions.map((item) => {
            const isAdded = Boolean(item.isAdded || item.is_added)
            const isCopying = copyingId === item.id
            const positions = normalizeStringList(item.positions).slice(0, 4)
            return (
              <Card key={item.id}>
                <Pressable onPress={() => navigation.navigate('ActionDetail', { id: item.id, action: item, source: 'coach' })}>
                  <View style={local.actionDetailHeader}>
                    <Text style={local.actionCardName}>{actionName(item)}</Text>
                    <Text style={local.typePill}>{actionTypeLabel(item.type)}</Text>
                  </View>
                  <Text style={local.itemMeta}>{actionDetailText(item)}</Text>
                  {positions.length > 0 ? (
                    <View style={local.tagWrap}>
                      {positions.map((pos, index) => <Text key={`${item.id}-${pos}-${index}`} style={local.actionTag}>{pos}</Text>)}
                    </View>
                  ) : null}
                </Pressable>
                <SolidButton label={isAdded ? '已添加' : isCopying ? '添加中...' : '复制到我的动作库'} disabled={isAdded || isCopying || Boolean(copyingId && !isCopying)} loading={isCopying} onPress={() => void copyCoachAction(item)} />
              </Card>
            )
          })}
        </>
      ) : null}
    </ScreenShell>
  )
}

export function ActionEditScreen() {
  const navigation = useNavigationAny()
  const route = useRouteAny<'ActionEdit'>()
  const id = route.params?.id
  const [name, setName] = useState('')
  const [detail, setDetail] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  async function save() {
    setLoading(true)
    try {
      await safeRequest(id ? '/api/student/action-lib/update-action' : '/api/student/action-lib/add-action', { body: { id, name, detail, url } })
      Alert.alert('已保存', '动作库已同步')
      navigation.goBack()
    } catch (error) {
      Alert.alert('保存失败', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScreenShell title={id ? '编辑动作' : '新增动作'} subtitle="演示视频链接和动作描述与小程序共用。" onBack={navigation.goBack}>
      <Card>
        <FormField label="动作名称" value={name} onChangeText={setName} />
        <FormField label="动作说明" value={detail} onChangeText={setDetail} multiline />
        <FormField label="演示链接" value={url} onChangeText={setUrl} />
        <SolidButton label="保存动作" loading={loading} disabled={!name.trim()} onPress={save} />
      </Card>
    </ScreenShell>
  )
}

export function PlanLibraryScreen() {
  const navigation = useNavigationAny()
  const [favorites, setFavorites] = useState<PlanFavoriteItem[]>([])
  const [actions, setActions] = useState<PlanActionLite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [applyingId, setApplyingId] = useState('')
  const [oneRMFavorite, setOneRMFavorite] = useState<PlanFavoriteItem | null>(null)
  const [oneRMConfig, setOneRMConfig] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [favoriteRes, actionRes] = await Promise.all([
        requestMaybe<unknown>('/api/student/plan-lib/list-favorites', { body: { page: 1, limit: 50, search: '' } }),
        requestMaybe<unknown>('/api/student/action-lib/list-actions', { body: { page: 1, limit: 500, search: '' } }),
      ])
      setFavorites(pickList(favoriteRes, ['favorites', 'items', 'data']) as PlanFavoriteItem[])
      setActions((pickList(actionRes, ['actions', 'items', 'data']) as PlanActionLite[]).map((item) => ({
        ...item,
        enableAutoWeightCompute: item.enableAutoWeightCompute ?? item.enable_auto_weight_compute ?? normalizeStringList(item.attrs).includes('强度'),
      })))
    } catch (err) {
      setError(errorMessage(err, '加载计划库失败'))
      setFavorites([])
      setActions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function relevantOneRMActions(favorite: PlanFavoriteItem) {
    const used = new Set<string>()
    for (const day of favorite.training_days || []) {
      for (const set of day.actionSets || []) {
        const actionId = String((set as any).actionId || (set as any).action_id || '').trim()
        if (actionId) used.add(actionId)
      }
    }
    return actions.filter((action) => used.has(action.id) && (action.enableAutoWeightCompute || normalizeStringList(action.attrs).includes('强度')))
  }

  function applyFavorite(favorite: PlanFavoriteItem) {
    const needed = relevantOneRMActions(favorite)
    if (needed.length > 0) {
      setOneRMConfig({})
      setOneRMFavorite(favorite)
      return
    }
    void doApplyFavorite(favorite.id)
  }

  async function doApplyFavorite(favoriteId: string, oneRM?: Record<string, number>) {
    setApplyingId(favoriteId)
    try {
      await safeRequest('/api/student/plan-lib/apply-favorite', { body: { favoriteId, oneRMConfig: oneRM } })
      Alert.alert('计划已激活', '已进入当前训练计划。', [
        { text: '去训练', onPress: () => navigation.navigate('MainTabs', { screen: 'TrainingTab' }) },
        { text: '留在此页', style: 'cancel' },
      ])
    } catch (err) {
      Alert.alert('应用失败', errorMessage(err))
    } finally {
      setApplyingId('')
      setOneRMFavorite(null)
      setOneRMConfig({})
    }
  }

  function confirmOneRMApply() {
    if (!oneRMFavorite) return
    const payload: Record<string, number> = {}
    Object.entries(oneRMConfig).forEach(([key, value]) => {
      const parsed = Number(value)
      if (Number.isFinite(parsed) && parsed > 0) payload[key] = parsed
    })
    void doApplyFavorite(oneRMFavorite.id, payload)
  }

  function deleteFavorite(id: string) {
    confirm('删除确认', '确定要删除此训练模板吗？', async () => {
      try {
        await safeRequest('/api/student/plan-lib/delete-favorite', { body: { id } })
        setFavorites((prev) => prev.filter((item) => item.id !== id))
      } catch (err) {
        Alert.alert('删除失败', errorMessage(err))
      }
    })
  }

  const oneRMActions = oneRMFavorite ? relevantOneRMActions(oneRMFavorite) : []

  return (
    <ScreenShell title="我的计划库" subtitle="学员自建和收藏的常用计划。" onBack={navigation.goBack}>
      <Card>
        <SolidButton label="新建计划" onPress={() => navigation.navigate('PlanEdit')} />
        <Text style={local.noticeDesc}>计划库模板可反复编辑，也可以一键应用为当前执行计划。</Text>
      </Card>
      {loading ? <LoadingState title="正在加载计划库" /> : null}
      {!loading && error ? (
        <>
          <EmptyState title="加载失败" desc={error} icon="icon-wenhao" />
          <SolidButton label="重试" onPress={() => void load()} />
        </>
      ) : null}
      {!loading && !error && favorites.length === 0 ? (
        <>
          <EmptyState title="空空如也" desc="还没有收藏任何训练计划模板。" icon="icon-a-Trainingplan" />
          <SolidButton label="创建第一个计划" onPress={() => navigation.navigate('PlanEdit')} />
        </>
      ) : null}
      {!loading && !error && favorites.length > 0 ? (
        favorites.map((favorite) => {
          const dayCount = Array.isArray(favorite.training_days) ? favorite.training_days.length : 0
          const isApplying = applyingId === favorite.id
          return (
            <Card key={favorite.id} style={local.planHistoryCard}>
              <Pressable onPress={() => navigation.navigate('PlanEdit', { id: favorite.id })}>
                <Text style={local.planHistoryName}>{favorite.name || '未命名计划'}</Text>
                <Text style={local.planHistoryDesc} numberOfLines={2}>{favorite.description || '无描述文本'}</Text>
                <View style={local.planHistoryInfo}>
                  <View style={local.inlineMetaRow}>
                    <IconFont name="icon-a-Trainingplan" size={14} color={colors.textMuted} />
                    <Text style={local.itemMeta}>{dayCount} 训练日</Text>
                  </View>
                  <View style={local.inlineMetaRow}>
                    <IconFont name="icon-time" size={14} color={colors.textMuted} />
                    <Text style={local.itemMeta}>{favorite.updated_at ? formatDate(favorite.updated_at) : '未同步更新时间'}</Text>
                  </View>
                </View>
              </Pressable>
              <View style={local.rowActions}>
                <SolidButton label={isApplying ? '应用中...' : '应用'} loading={isApplying} disabled={Boolean(applyingId && !isApplying)} onPress={() => applyFavorite(favorite)} />
                <SolidButton label="删除" variant="danger" disabled={Boolean(applyingId)} onPress={() => deleteFavorite(favorite.id)} />
              </View>
            </Card>
          )
        })
      ) : null}
      <Modal visible={Boolean(oneRMFavorite)} transparent animationType="fade" onRequestClose={() => setOneRMFavorite(null)}>
        <View style={local.modalMask}>
          <View style={local.modalCard}>
            <Text style={local.modalTitle}>应用计划 - 1RM 配置</Text>
            <Text style={local.itemMeta}>在应用「{oneRMFavorite?.name || '计划'}」前，请先设置以下动作的 1RM 值，用于自动计算训练负荷。</Text>
            <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: spacing.sm }}>
              {oneRMActions.map((action) => (
                <View key={action.id} style={local.onermRow}>
                  <Text style={local.onermName}>{action.name}</Text>
                  <View style={local.onermInputWrap}>
                    <TextInput value={oneRMConfig[action.id] || ''} onChangeText={(value) => setOneRMConfig((prev) => ({ ...prev, [action.id]: value }))} keyboardType="decimal-pad" placeholder="1RM" placeholderTextColor={colors.textMuted} style={local.onermInput} />
                    <Text style={local.itemMeta}>kg</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={local.modalActions}>
              <SolidButton label="跳过" variant="secondary" onPress={() => oneRMFavorite && void doApplyFavorite(oneRMFavorite.id)} />
              <SolidButton label="确认应用" onPress={confirmOneRMApply} />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  )
}

export function PlanEditScreen() {
  const navigation = useNavigationAny()
  const route = useRouteAny<'PlanEdit'>()
  const id = route.params?.id
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [suitableFor, setSuitableFor] = useState('beginner')
  const [days, setDays] = useState<PlanTrainingDayDetail[]>([])
  const [importText, setImportText] = useState('')
  const [loading, setLoading] = useState(false)
  const [bootLoading, setBootLoading] = useState(Boolean(id))
  const [parsing, setParsing] = useState(false)
  const [actions, setActions] = useState<PlanActionLite[]>([])

  async function loadInitial() {
    setBootLoading(true)
    try {
      const [actionRes, favoriteRes] = await Promise.all([
        requestMaybe<unknown>('/api/student/action-lib/list-actions', { body: { page: 1, limit: 1000, search: '' } }).catch(() => null),
        id ? requestMaybe<{ favorite?: PlanFavoriteItem }>('/api/student/plan-lib/get-favorite', { body: { id } }) : Promise.resolve(null),
      ])
      setActions((pickList(actionRes, ['actions', 'items', 'data']) as PlanActionLite[]).map((action) => ({
        ...action,
        enableAutoWeightCompute: action.enableAutoWeightCompute ?? action.enable_auto_weight_compute ?? normalizeStringList(action.attrs).includes('强度'),
      })))
      const favorite = favoriteRes?.favorite
      if (favorite) {
        setName(favorite.name || '')
        setDescription(favorite.description || '')
        setTagsText((favorite.tags || []).join('、'))
        setSuitableFor(favorite.suitable_for || 'beginner')
        setDays(normalizeFavoriteTrainingDays(favorite.training_days))
      }
    } catch (err) {
      Alert.alert('计划加载失败', errorMessage(err))
      navigation.goBack()
    } finally {
      setBootLoading(false)
    }
  }

  useEffect(() => {
    void loadInitial()
  }, [id])

  async function generateDraft() {
    setParsing(true)
    try {
      const data = await requestMaybe<any>('/api/student/plan-lib/generate-ai-draft-from-profile', { body: { days: 7 } })
      if (data?.name) setName(data.name)
      if (data?.description) setDescription(data.description)
      const nextDays = normalizeFavoriteTrainingDays(data?.trainingDays || data?.training_days)
      if (nextDays.length > 0) setDays(nextDays)
    } catch (err) {
      Alert.alert('生成失败', errorMessage(err))
    } finally {
      setParsing(false)
    }
  }

  async function parseImportText() {
    if (!importText.trim()) {
      Alert.alert('请输入计划文本')
      return
    }
    setParsing(true)
    try {
      const data = await requestMaybe<any>('/api/student/plan-lib/parse-template', {
        body: {
          text: importText,
          actions: actions.map((action) => ({ id: action.id, name: action.name, type: action.type || undefined, attrs: action.attrs || undefined })),
        },
      })
      const nextDays = normalizeFavoriteTrainingDays(data?.trainingDays || data?.training_days)
      if (nextDays.length > 0) setDays(nextDays)
      if (data?.globalDescription && !description.trim()) setDescription(data.globalDescription)
      Alert.alert('已解析', `已生成 ${nextDays.length} 个训练日。`)
    } catch (err) {
      Alert.alert('解析失败', errorMessage(err))
    } finally {
      setParsing(false)
    }
  }

  function addTrainingDay(type: 'training' | 'rest' = 'training') {
    setDays((prev) => [...prev, { dayIndex: prev.length + 1, type, note: type === 'rest' ? '休息与恢复' : '', actionSets: [] }])
  }

  function removeTrainingDay(index: number) {
    setDays((prev) => prev.filter((_, i) => i !== index).map((day, dayIndex) => ({ ...day, dayIndex: dayIndex + 1 })))
  }

  async function save() {
    setLoading(true)
    try {
      const payload = {
        name,
        description: description || null,
        tags: tagsText.split(/[、,，\s]+/).map((item) => item.trim()).filter(Boolean),
        suitable_for: suitableFor,
        training_days: days.map((day, index) => ({
          ...day,
          dayIndex: getPlanDayIndex(day, index),
          actionSetsCount: Array.isArray(day.actionSets) ? day.actionSets.length : 0,
        })),
      }
      await safeRequest(id ? '/api/student/plan-lib/update-favorite' : '/api/student/plan-lib/save-favorite', { body: id ? { id, ...payload } : payload })
      Alert.alert('已保存', '计划库已同步')
      navigation.goBack()
    } catch (error) {
      Alert.alert('保存失败', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScreenShell title={id ? '编辑常用计划' : '创建常用计划'} subtitle="支持 AI 草稿、智能导入和结构化训练日。" onBack={navigation.goBack}>
      {bootLoading ? <LoadingState title="正在加载计划" /> : null}
      <Card>
        <FormField label="计划名称" value={name} onChangeText={setName} />
        <FormField label="计划描述" value={description} onChangeText={setDescription} multiline />
        <FormField label="标签" value={tagsText} onChangeText={setTagsText} placeholder="例如：增肌、上肢、入门" />
        <FormField label="适合人群" value={suitableFor} onChangeText={setSuitableFor} placeholder="beginner / intermediate / advanced" />
      </Card>
      <Card>
        <Text style={local.sectionTitle}>智能导入</Text>
        <FormField label="粘贴计划文本" value={importText} onChangeText={setImportText} multiline placeholder="粘贴一段训练计划，系统会按动作库解析成训练日。" />
        <View style={local.rowActions}>
          <SolidButton label="AI 草稿" variant="secondary" loading={parsing} onPress={generateDraft} />
          <SolidButton label="解析文本" loading={parsing} onPress={parseImportText} />
        </View>
      </Card>
      <Card>
        <View style={local.planDayHeader}>
          <Text style={local.sectionTitle}>训练日</Text>
          <View style={local.rowActions}>
            <SolidButton label="训练日" variant="secondary" onPress={() => addTrainingDay('training')} />
            <SolidButton label="休息日" variant="secondary" onPress={() => addTrainingDay('rest')} />
          </View>
        </View>
        {days.length === 0 ? <Text style={local.emptyInline}>暂无训练日，可添加训练日或使用智能导入。</Text> : null}
        {days.map((day, index) => {
          const actionSets = Array.isArray(day.actionSets) ? day.actionSets : []
          return (
            <View key={`${index}-${day.type}`} style={local.planLibEditDay}>
              <View style={local.planDayHeader}>
                <Text style={local.planDayTitle}>第 {getPlanDayIndex(day, index)} 天 · {day.type === 'rest' ? '休息' : '训练'}</Text>
                <Pressable onPress={() => removeTrainingDay(index)}><Text style={local.expiringLink}>删除</Text></Pressable>
              </View>
              <Text style={local.itemMeta}>{day.note || (day.type === 'rest' ? '休息与恢复' : '按计划执行')}</Text>
              <Text style={local.itemMeta}>{actionSets.length} 个动作</Text>
              {actionSets.slice(0, 4).map((set, actionIndex) => (
                <View key={`${index}-${actionIndex}`} style={local.planActionRow}>
                  <IconFont name="icon-dumbbell" color={colors.textMuted} size={16} />
                  <Text style={local.planActionName}>{(set as any).actionName || (set as any).setName || (set as any).name || `动作 ${actionIndex + 1}`}</Text>
                  <Text style={local.planActionMeta}>{(set as any).itemType || 'STRENGTH'}</Text>
                </View>
              ))}
            </View>
          )
        })}
        <SolidButton label={id ? '保存更新' : '保存计划'} loading={loading} disabled={!name.trim() || days.length === 0} onPress={save} />
      </Card>
    </ScreenShell>
  )
}

export function PlanHistoryScreen() {
  const navigation = useNavigationAny()
  const [plans, setPlans] = useState<PlanHistoryListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<'all' | 'coach' | 'student'>('all')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [error, setError] = useState('')
  const limit = 10

  async function load(targetPage = 1, targetSource = sourceFilter) {
    if (targetPage === 1) setLoading(true)
    else setLoadingMore(true)
    setError('')
    try {
      const data = await requestMaybe<unknown>('/api/student/plan-lib/list-history', { body: { page: targetPage, limit, source: targetSource } })
      const record = data && typeof data === 'object' ? data as AnyRecord : {}
      const next = pickList(record, ['plans', 'instances', 'history']) as PlanHistoryListItem[]
      setPlans((prev) => targetPage === 1 ? next : [...prev, ...next])
      setTotalCount(Number(record.totalCount ?? record.total ?? next.length))
      setPage(targetPage)
    } catch (err) {
      setError(errorMessage(err, '加载历史计划失败'))
      if (targetPage === 1) setPlans([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    void load(1, sourceFilter)
  }, [sourceFilter])

  function changeSource(next: 'all' | 'coach' | 'student') {
    if (next === sourceFilter) return
    setSourceFilter(next)
    setPage(1)
  }

  const hasMore = plans.length < totalCount

  return (
    <ScreenShell title="全部计划" subtitle="当前计划、历史计划和教练分配计划。" onBack={navigation.goBack}>
      <Card>
        <MenuRow label="训练记录" desc="查看日历、完成记录与训练分享。" icon="icon-training_history" iconBg="#10B981" onPress={() => navigation.navigate('TrainingHistory')} />
        <MenuRow label="我的计划库" desc="查看收藏、自建和可复用的计划模板。" icon="icon-a-Trainingplan" iconBg="#5C8DFF" onPress={() => navigation.navigate('PlanLibrary')} />
      </Card>

      <View style={local.planFilterBar}>
        {([
          ['all', '全部计划'],
          ['coach', '教练指派'],
          ['student', '我的计划'],
        ] as const).map(([key, label]) => (
          <Pressable key={key} onPress={() => changeSource(key)} style={[local.planFilterItem, sourceFilter === key && local.planFilterItemActive]}>
            <Text style={[local.planFilterText, sourceFilter === key && local.planFilterTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? <LoadingState title="正在加载计划" /> : null}
      {!loading && error ? (
        <>
          <EmptyState title="加载失败" desc={error} icon="icon-wenhao" />
          <SolidButton label="重试" onPress={() => void load(1, sourceFilter)} />
        </>
      ) : null}
      {!loading && !error && plans.length === 0 ? (
        <>
          <EmptyState title="暂无计划" desc="全部计划会显示在这里。" icon="icon-a-Trainingplan" />
          <SolidButton label="去今日训练" onPress={() => navigation.navigate('MainTabs', { screen: 'TrainingTab' })} />
          <SolidButton label="去我的计划库" variant="secondary" onPress={() => navigation.navigate('PlanLibrary')} />
        </>
      ) : null}
      {!loading && !error && plans.length > 0 ? (
        <>
          <Text style={local.coachHint}>共 {totalCount || plans.length} 个计划</Text>
          {plans.map((plan) => (
            <Pressable key={String(plan.id)} onPress={() => navigation.navigate('PlanHistoryDetail', { id: plan.id })} style={({ pressed }) => [pressed && local.pressedCard]}>
              <Card style={local.planHistoryCard}>
                <View style={local.planHistoryHeader}>
                  <Text style={local.planHistoryName}>{plan.name || '未命名计划'}</Text>
                  <View style={local.planBadgeRow}>
                    <Text style={[local.planStatusBadge, plan.status === 'active' && local.statusActive, plan.status === 'completed' && local.statusCompleted, plan.status === 'archived' && local.statusArchived]}>{planStatusLabel(plan.status)}</Text>
                    <Text style={local.planSourceBadge}>{planSourceLabel(plan.source)}</Text>
                  </View>
                </View>
                <View style={local.planHistoryInfo}>
                  <View style={local.inlineMetaRow}>
                    <IconFont name="icon-time" size={14} color={colors.textMuted} />
                    <Text style={local.itemMeta}>{formatPlanDateRange(plan.start_date, plan.end_date)}</Text>
                  </View>
                  <View style={local.inlineMetaRow}>
                    <IconFont name="icon-a-Trainingplan" size={14} color={colors.textMuted} />
                    <Text style={local.itemMeta}>共 {Number(plan.total_training_days ?? plan.total_days ?? 0) || '-'} 个训练日</Text>
                  </View>
                </View>
                {plan.completion_rate != null ? (
                  <View style={local.planProgressBlock}>
                    <View style={local.planProgressHeader}>
                      <Text style={local.metricLabel}>完成度</Text>
                      <Text style={local.metricLabel}>{Math.round(Number(plan.completion_rate))}%</Text>
                    </View>
                    <View style={local.planProgressTrack}>
                      <View style={[local.planProgressFill, { width: `${Math.max(0, Math.min(100, Number(plan.completion_rate)))}%` }]} />
                    </View>
                  </View>
                ) : null}
                {plan.description ? <Text style={local.planHistoryDesc} numberOfLines={2}>{plan.description}</Text> : null}
              </Card>
            </Pressable>
          ))}
          {hasMore ? (
            <SolidButton label={loadingMore ? '加载中...' : '加载更多'} loading={loadingMore} onPress={() => void load(page + 1, sourceFilter)} />
          ) : (
            <Text style={local.loadMoreText}>已加载全部 {totalCount || plans.length} 条记录</Text>
          )}
        </>
      ) : null}
    </ScreenShell>
  )
}

export function PlanHistoryDetailScreen() {
  const navigation = useNavigationAny()
  const route = useRouteAny<'PlanHistoryDetail'>()
  const id = route.params?.id
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<PlanInstanceDetail | null>(null)
  const [totalTrainingDays, setTotalTrainingDays] = useState(0)
  const [resolvedTrainingDays, setResolvedTrainingDays] = useState(0)
  const [error, setError] = useState('')

  async function load() {
    if (!id) {
      setPlan(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await apiClient.request<PlanInstanceResponse>('/api/plan-lib/get-instance', { method: 'POST', body: { id }, timeoutMs: 15000 })
      const instance = data.instance || null
      setPlan(instance ? { ...instance, status: data.derivedStatus || instance.status } : null)
      setTotalTrainingDays(data.totalTrainingDays ?? countPlanTrainingDays(instance?.training_days))
      setResolvedTrainingDays(data.resolvedTrainingDays ?? 0)
    } catch (err) {
      setError(errorMessage(err))
      setPlan(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [id])

  const completionRate = totalTrainingDays > 0 ? Math.round((resolvedTrainingDays / totalTrainingDays) * 100) : undefined
  const trainingDays = (plan?.training_days || []).filter((day) => day?.type === 'training')
  const effectiveStatus = plan?.status || ''
  const canStartTraining = Boolean(plan?.id && effectiveStatus === 'active' && (completionRate == null || completionRate < 100))
  const firstTrainingDayIndex = trainingDays.length > 0 ? getPlanDayIndex(trainingDays[0], 0) : Number(plan?.start_execution_day || 1)

  function showExecutionNotice() {
    Alert.alert('执行须知', plan?.execution_notice || '该计划暂无额外执行须知。')
  }

  return (
    <ScreenShell title="计划详情" subtitle={id ? `计划 ID：${id}` : '缺少计划 ID'} onBack={navigation.goBack}>
      {loading ? <LoadingState /> : null}
      {!loading && error ? <EmptyState title="加载失败" desc={error} icon="icon-wenhao" /> : null}
      {!loading && !error && !plan ? <EmptyState title="计划不存在" desc="该计划可能已删除，或当前账号暂无查看权限。" icon="icon-a-Trainingplan" /> : null}
      {!loading && !error && plan ? (
        <>
          <Card style={local.planDetailHeader}>
            <View style={local.planDetailTitleRow}>
              <View style={local.planDetailIcon}><IconFont name="icon-a-Trainingplan" color={colors.brand} size={26} /></View>
              <View style={{ flex: 1 }}>
                <Text style={local.planDetailName}>{plan.name || '未命名计划'}</Text>
                <Text style={local.planDetailDesc}>{plan.description || '无描述'}</Text>
              </View>
            </View>
          </Card>

          <Card style={local.planInfoCard}>
            <InfoLine label="状态" value={planStatusLabel(plan.status)} />
            <InfoLine label="来源" value={planSourceLabel(plan.source)} />
            {plan.start_date ? <InfoLine label="开始时间" value={formatDate(plan.start_date)} /> : null}
            {plan.end_date ? <InfoLine label="结束时间" value={formatDate(plan.end_date)} /> : null}
            <InfoLine label="训练日" value={`${totalTrainingDays || countPlanTrainingDays(plan.training_days)} 个训练日`} />
            {completionRate !== undefined ? <InfoLine label="完成度" value={`${completionRate}%`} /> : null}
            {completionRate !== undefined ? (
              <View style={local.planProgressBlock}>
                <View style={local.planProgressTrack}>
                  <View style={[local.planProgressFill, { width: `${Math.max(0, Math.min(100, completionRate))}%` }]} />
                </View>
              </View>
            ) : null}
          </Card>

          <Card style={local.noticeCard}>
            <View style={local.noticeLine}>
              <IconFont name="icon-wenhao" color="#92400E" size={18} />
              <Text style={local.noticeText}>计划详情已同步到 APP，可查看训练日概览并进入训练执行。</Text>
            </View>
            <View style={local.planDetailActions}>
              <SolidButton label="执行须知" variant="secondary" onPress={showExecutionNotice} />
              {canStartTraining ? <SolidButton label="开始训练" onPress={() => navigation.navigate('TrainingExecution', { instanceId: plan.id, dayIndex: firstTrainingDayIndex })} /> : null}
            </View>
          </Card>

          {trainingDays.length > 0 ? (
            <View style={local.planDayList}>
              <Text style={local.sectionTitle}>训练日概览</Text>
              {trainingDays.map((day, index) => {
                const dayIndex = getPlanDayIndex(day, index)
                const actionSets = Array.isArray(day.actionSets) ? day.actionSets : []
                return (
                  <Card key={`${dayIndex}-${index}`} style={local.planDayCard}>
                    <View style={local.planDayHeader}>
                      <Text style={local.planDayTitle}>{day.title || `第 ${dayIndex} 天`}</Text>
                      <Text style={local.planDayBadge}>{actionSets.length} 个动作</Text>
                    </View>
                    {day.note ? <Text style={local.planDayNote}>{day.note}</Text> : null}
                    {actionSets.slice(0, 5).map((set, actionIndex) => (
                      <View key={`${set.actionName || set.name || actionIndex}`} style={local.planActionRow}>
                        <IconFont name="icon-dumbbell" color={colors.textMuted} size={16} />
                        <Text style={local.planActionName}>{set.actionName || set.name || '未命名动作'}</Text>
                        <Text style={local.planActionMeta}>{[set.sets ? `${set.sets} 组` : '', set.reps ? `${set.reps} 次` : ''].filter(Boolean).join(' / ') || '按计划执行'}</Text>
                      </View>
                    ))}
                    {actionSets.length > 5 ? <Text style={local.planDayMore}>还有 {actionSets.length - 5} 个动作</Text> : null}
                  </Card>
                )
              })}
            </View>
          ) : null}
        </>
      ) : null}
    </ScreenShell>
  )
}

export function TrainingHistoryScreen() {
  const navigation = useNavigationAny()
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [days, setDays] = useState<Record<string, number>>({})
  const [stats, setStats] = useState<TrainingMonthStats | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [dayItems, setDayItems] = useState<TrainingDayHistoryItem[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingDay, setLoadingDay] = useState(false)
  const [error, setError] = useState('')
  const monthKey = getMonthKey(currentMonth)
  const monthGrid = buildMonthGrid(currentMonth)

  async function loadMonth() {
    setLoading(true)
    setError('')
    try {
      const [calendar, monthStats] = await Promise.all([
        apiClient.request<{ days?: TrainingCalendarDay[] }>('/api/training-history/calendar', { method: 'POST', body: { month: monthKey }, timeoutMs: 12000 }),
        apiClient.request<TrainingMonthStats>('/api/training-history/month-share', { method: 'POST', body: { month: monthKey }, timeoutMs: 12000 }),
      ])
      const next: Record<string, number> = {}
      ;(calendar.days || []).forEach((item) => { next[item.date] = item.sessions })
      setDays(next)
      setStats(monthStats)
      if (!selectedDate) {
        const today = new Date().toISOString().slice(0, 10)
        if (today.startsWith(monthKey)) void loadDay(today)
      }
    } catch (err) {
      setError(errorMessage(err))
      setDays({})
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadDay(date: string) {
    setLoadingDay(true)
    setSelectedDate(date)
    setExpandedId(null)
    try {
      const data = await apiClient.request<{ items?: TrainingDayHistoryItem[] }>('/api/training-history/day', {
        method: 'POST',
        body: { date },
        timeoutMs: 12000,
      })
      setDayItems(data.items || [])
    } catch (err) {
      Alert.alert('当天记录加载失败', errorMessage(err))
      setDayItems([])
    } finally {
      setLoadingDay(false)
    }
  }

  useEffect(() => {
    void loadMonth()
  }, [monthKey])

  return (
    <ScreenShell title="训练记录" subtitle="按训练日同步的完成记录。" onBack={navigation.goBack}>
      <View style={local.trainingHistoryHead}>
        <SolidButton label="即兴锻炼" variant="secondary" onPress={() => navigation.navigate('ImpromptuTraining')} />
      </View>
      {loading ? <LoadingState /> : null}
      {!loading && error ? (
        <>
          <EmptyState title="训练记录加载失败" desc={error} icon="icon-training_history" />
          <SolidButton label="重试" variant="secondary" onPress={() => void loadMonth()} />
        </>
      ) : null}
      {!loading && !error ? (
        <>
          <Card style={local.calendarCard}>
            <View style={local.calendarNav}>
              <Text style={local.calendarMonth}>{monthKey}</Text>
              <View style={local.calendarNavButtons}>
                <Pressable onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} style={local.calendarNavButton}><Text style={local.calendarNavText}>‹</Text></Pressable>
                <Pressable onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} style={local.calendarNavButton}><Text style={local.calendarNavText}>›</Text></Pressable>
              </View>
            </View>
            <View style={local.calendarGrid}>
              {['日', '一', '二', '三', '四', '五', '六'].map((item) => <Text key={item} style={local.weekdayCell}>{item}</Text>)}
              {monthGrid.map((cell, index) => (
                <Pressable key={`${cell.dateKey || 'blank'}-${index}`} disabled={!cell.dateKey} onPress={() => cell.dateKey && void loadDay(cell.dateKey)} style={[local.dayCell, !cell.dateKey && local.dayCellEmpty, selectedDate === cell.dateKey && local.dayCellSelected]}>
                  {cell.day ? <Text style={local.dayNum}>{cell.day}</Text> : null}
                  {cell.dateKey && days[cell.dateKey] > 0 ? <Text style={local.daySessions}>{days[cell.dateKey]}次</Text> : null}
                </Pressable>
              ))}
            </View>
          </Card>
          {stats ? (
            <Card style={local.historyStatsCard}>
              <View style={local.historyStatsRow}>
                <View style={local.historyStatItem}><Text style={local.metricLabel}>训练天数</Text><Text style={local.metricValue}>{stats.trainingDays || 0}</Text></View>
                <View style={local.historyStatItem}><Text style={local.metricLabel}>训练次数</Text><Text style={local.metricValue}>{stats.totalSessions || 0}</Text></View>
                <View style={local.historyStatItem}><Text style={local.metricLabel}>完成组数</Text><Text style={local.metricValue}>{stats.totalSets || 0}</Text></View>
              </View>
              <Text style={local.itemMeta}>即兴 {stats.sourceBreakdown?.impromptu || 0} / 我的 {stats.sourceBreakdown?.selfPlan || 0} / 教练 {stats.sourceBreakdown?.coachPlan || 0}</Text>
            </Card>
          ) : null}
          <Card style={local.historyDetailCard}>
            <Text style={local.sectionTitle}>{selectedDate ? `${selectedDate} 训练明细` : '选择日期查看训练明细'}</Text>
            {loadingDay ? <LoadingState /> : null}
            {!loadingDay && dayItems.length === 0 ? <Text style={local.emptyInline}>暂无训练记录</Text> : null}
            {!loadingDay && dayItems.map((item) => (
              <Pressable key={`${item.sourceType}-${item.id}`} onPress={() => setExpandedId((prev) => prev === item.id ? null : item.id)} style={local.historyItem}>
                <View style={local.historyItemHeader}>
                  <View style={local.flexOne}>
                    <Text style={local.historyItemTitle}>{item.title}</Text>
                    <Text style={local.itemMeta}>{formatTime(item.startedAt)}</Text>
                  </View>
                  <View style={local.historyTags}>
                    <Text style={local.historyTagSource}>{sourceLabel(item.sourceType)}</Text>
                    <Text style={local.historyTagSets}>{item.completedSets}/{item.totalSets}组</Text>
                  </View>
                </View>
                {expandedId === item.id ? (
                  <View style={local.historyExpand}>
                    {item.actionSummaries?.length ? item.actionSummaries.map((action, index) => (
                      <View key={`${action.actionName}-${index}`} style={local.actionSummaryRow}>
                        <Text style={local.actionSummaryName}>{action.actionName}</Text>
                        <Text style={local.itemMeta}>{action.completedSets}/{action.totalSets}组</Text>
                      </View>
                    )) : <Text style={local.emptyInline}>暂无动作明细</Text>}
                    {item.status === 'completed' ? <SolidButton label="分享本次训练" variant="secondary" onPress={() => navigation.navigate('TrainingShare', { executionId: item.id })} /> : null}
                  </View>
                ) : null}
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}
    </ScreenShell>
  )
}

export function MembershipScreen() {
  const navigation = useNavigationAny()
  const [membership, setMembership] = useState<any>(null)
  const [quota, setQuota] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function loadMembership() {
    setLoading(true)
    try {
      const [statusRes, quotaRes] = await Promise.allSettled([
        apiClient.request<any>('/api/membership/get-status', { method: 'POST', body: {}, timeoutMs: 10000 }),
        apiClient.request<any>('/api/membership/get-quota', { method: 'POST', body: {}, timeoutMs: 10000 }),
      ])
      setMembership(statusRes.status === 'fulfilled' ? statusRes.value : null)
      setQuota(quotaRes.status === 'fulfilled' ? quotaRes.value : null)
    } catch {
      setMembership(null)
      setQuota(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMembership()
  }, [])

  const tier = normalizeMembershipTier(membership?.tier)
  const isFree = tier === 'free'
  const isPremium = tier === 'premium'
  const aiRemaining = Math.max(0, Number(quota?.ai_import_balance || 0))
  const storageUsed = Math.max(0, Number(quota?.storage_used_mb || 0))
  const storageTotal = Math.max(1, Number(quota?.storage_total_mb || 0))
  const storagePercent = Math.min(100, Math.round((storageUsed / storageTotal) * 100))
  const endDateText = membership?.status === 'active' && membership?.end_date ? `有效期至：${new Date(membership.end_date).toLocaleDateString()}` : ''

  return (
    <ScreenShell title="我的会员" subtitle="会员状态、AI 配额和续费入口。" onBack={navigation.goBack}>
      {loading ? <LoadingState title="正在加载会员数据" /> : null}
      {!loading ? (
        <>
          <Card style={local.membershipHero}>
            <View style={local.membershipHeroHead}>
              <View>
                <Text style={local.membershipHeroTitle}>当前等级</Text>
                <Text style={local.membershipHeroSub}>您的会员权益状态</Text>
              </View>
              <View style={[local.membershipMark, tierToneStyle(tier)]}>
                <Text style={local.membershipMarkText}>会</Text>
              </View>
            </View>
            <View style={local.membershipStateRow}>
              <Text style={[local.tierPill, tierToneStyle(tier)]}>{TIER_TEXT[tier]}</Text>
              {endDateText ? <Text style={local.statusDate}>{endDateText}</Text> : null}
            </View>
            {isFree ? (
              <View style={local.upgradePanel}>
                <Text style={local.noticeDesc}>升级会员解锁更多智能生成次数和存储空间，提升训练效率。</Text>
                <SolidButton label="立即升级" onPress={() => navigation.navigate('MembershipSubscribe', { tab: 'membership' })} />
              </View>
            ) : (
              <SolidButton label="续费/升级" variant="secondary" onPress={() => navigation.navigate('MembershipSubscribe', { tab: 'membership' })} />
            )}
          </Card>

          <Card style={local.quotaCard}>
            <View style={local.quotaHead}>
              <Text style={local.quotaTitle}>智能导入次数</Text>
              <Text style={local.quotaBadge}>AI</Text>
            </View>
            <View style={local.quotaValueRow}>
              <Text style={local.quotaValue}>{aiRemaining}</Text>
              <Text style={local.quotaUnit}>次</Text>
            </View>
            <Text style={local.itemMeta}>{AI_HINT_BY_TIER[tier]}</Text>
            {!isPremium ? <Pressable onPress={() => navigation.navigate('MembershipSubscribe', { tab: 'addon' })}><Text style={local.profileLink}>购买加油包</Text></Pressable> : null}
          </Card>

          <Card style={local.quotaCard}>
            <View style={local.quotaHead}>
              <Text style={local.quotaTitle}>云存储空间</Text>
              <Text style={local.quotaBadge}>MB</Text>
            </View>
            <View style={local.quotaValueRow}>
              <Text style={local.quotaValue}>{storageUsed.toFixed(1)}</Text>
              <Text style={local.quotaUnit}>/ {storageTotal.toFixed(0)} MB</Text>
            </View>
            <View style={local.progressTrack}>
              <View style={[local.progressFill, { width: `${storagePercent}%` }]} />
            </View>
            <Text style={local.itemMeta}>用于存储训练视频和动态</Text>
            <Pressable onPress={() => navigation.navigate('MembershipSubscribe', { tab: 'addon' })}><Text style={local.profileLink}>扩容空间</Text></Pressable>
          </Card>

          <Card style={local.referralCard}>
            <Text style={local.referralTitle}>邀请好友，免费领会员</Text>
            <Text style={local.referralText}>每邀请一位好友注册，双方各获 AI 导入 +2 次 和 存储 +200MB 奖励。</Text>
            <SolidButton label="去邀请" variant="secondary" onPress={() => navigation.navigate('MembershipReferral')} />
          </Card>

          <Pressable onPress={() => void loadMembership()} style={local.refreshLink}>
            <Text style={local.profileLink}>刷新会员状态</Text>
          </Pressable>
        </>
      ) : null}
    </ScreenShell>
  )
}

export function MembershipSubscribeScreen() {
  const navigation = useNavigationAny()
  const route = useRouteAny<'MembershipSubscribe'>()
  const [activeTab, setActiveTab] = useState<MembershipTab>(route.params?.tab === 'addon' ? 'addon' : 'membership')
  const [currentTier, setCurrentTier] = useState<MembershipTier>('free')
  const [loading, setLoading] = useState(true)
  const [payingPlanId, setPayingPlanId] = useState('')
  const plans = MEMBERSHIP_PLANS.filter((item) => item.tab === activeTab)

  async function loadStatus() {
    setLoading(true)
    try {
      const status = await apiClient.request<any>('/api/membership/get-status', { method: 'GET', timeoutMs: 10000 })
      const tier = String(status?.tier || status?.membership?.tier || 'free') as MembershipTier
      setCurrentTier(['basic', 'premium', 'trial'].includes(tier) ? tier : 'free')
    } catch {
      setCurrentTier('free')
    } finally {
      setLoading(false)
    }
  }

  async function subscribe(plan: (typeof MEMBERSHIP_PLANS)[number]) {
    if (payingPlanId) return
    if (plan.tier && (currentTier === plan.tier || (currentTier === 'trial' && plan.tier === 'premium'))) {
      Alert.alert('当前已是该会员等级', '无需重复购买同一会员方案。')
      return
    }

    setPayingPlanId(plan.id)
    try {
      const payment = await apiClient.request<{ orderId?: string; amount?: number; paymentProvider?: 'wechat' }>('/api/payment/wechat/membership/create', {
        method: 'POST',
        timeoutMs: 15000,
        body: { productKey: plan.id },
      })
      navigation.navigate('PaymentWaiting', {
        orderId: payment.orderId,
        amount: Number(payment.amount ?? plan.price),
        provider: 'wechat',
        target: 'membership',
        membershipTab: activeTab,
      })
    } catch (error) {
      navigation.navigate('PaymentWaiting', {
        amount: Number(plan.price),
        provider: 'wechat',
        target: 'membership',
        membershipTab: activeTab,
        message: errorMessage(error, '创建支付单失败，请稍后重试'),
      })
    } finally {
      setPayingPlanId('')
    }
  }

  useEffect(() => {
    void loadStatus()
  }, [])

  useEffect(() => {
    if (route.params?.tab === 'addon' || route.params?.tab === 'membership') setActiveTab(route.params.tab)
  }, [route.params?.tab])

  const currentLabel = currentTier === 'premium' ? '高级会员' : currentTier === 'basic' ? '基础会员' : currentTier === 'trial' ? '试用会员' : '免费用户'

  return (
    <ScreenShell title="会员订阅" subtitle="会员套餐、AI 加油包和存储扩容包。" onBack={navigation.goBack}>
      <Card style={local.membershipStatus}>
        <Text style={local.itemMeta}>当前等级</Text>
        <Text style={local.membershipTier}>{loading ? '正在加载...' : currentLabel}</Text>
      </Card>

      <View style={local.segmented}>
        <Pressable onPress={() => setActiveTab('membership')} style={[local.segment, activeTab === 'membership' && local.segmentActive]}>
          <Text style={[local.segmentText, activeTab === 'membership' && local.segmentTextActive]}>会员套餐</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab('addon')} style={[local.segment, activeTab === 'addon' && local.segmentActive]}>
          <Text style={[local.segmentText, activeTab === 'addon' && local.segmentTextActive]}>加油包</Text>
        </Pressable>
      </View>

      {plans.map((plan) => {
        const isCurrent = Boolean(plan.tier && (currentTier === plan.tier || (currentTier === 'trial' && plan.tier === 'premium')))
        const isPaying = payingPlanId === plan.id
        return (
          <Card key={plan.id} style={local.planCard}>
            <View style={local.planHeader}>
              <View style={{ flex: 1 }}>
                <View style={local.planNameRow}>
                  <Text style={local.planName}>{plan.name}</Text>
                  {isCurrent ? <Text style={local.planBadge}>当前方案</Text> : null}
                </View>
                <Text style={local.planMeta}>{activeTab === 'membership' ? '会员权益升级' : '独立加购，即买即用'}</Text>
              </View>
              <View style={local.planPrice}>
                <Text style={local.priceSymbol}>¥</Text>
                <Text style={local.priceAmount}>{plan.price}</Text>
                <Text style={local.priceUnit}>/{plan.duration}</Text>
              </View>
            </View>
            <View style={local.featureList}>
              {plan.features.map((feature) => (
                <View key={feature} style={local.featureRow}>
                  <View style={local.featureIcon}>
                    <IconFont name="icon-goumaijilu" size={13} color="#FFFFFF" />
                  </View>
                  <Text style={local.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
            <SolidButton label={isPaying ? '创建支付单中...' : '立即购买'} loading={isPaying} disabled={isCurrent} onPress={() => void subscribe(plan)} />
          </Card>
        )
      })}

      <Card>
        <Text style={local.noticeDesc}>提示：APP 端当前会创建平台微信支付订单并进入支付等待页；原生微信 SDK 拉起支付仍在迁移中。</Text>
      </Card>
    </ScreenShell>
  )
}

export function MembershipReferralScreen() {
  const navigation = useNavigationAny()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReferralData | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [inviteRes, statsRes] = await Promise.allSettled([
        apiClient.request<any>('/api/membership/referral/create-invite', { method: 'POST', body: {}, timeoutMs: 15000 }),
        apiClient.request<any>('/api/membership/referral/stats', { method: 'POST', body: {}, timeoutMs: 10000 }),
      ])
      const invite = inviteRes.status === 'fulfilled' ? inviteRes.value : null
      const stats = statsRes.status === 'fulfilled' ? statsRes.value : null
      if (!invite && !stats) throw new Error('加载邀请数据失败')
      setData({
        code: invite?.inviteCode || '',
        inviteLink: invite?.inviteLink || '',
        shareText: invite?.shareText || '',
        totalReferrals: Number(stats?.invites || 0),
        totalRewards: {
          ai_import: Number(stats?.rewardedAi || 0),
          storage_mb: Number(stats?.rewardedStorageMb || 0),
        },
      })
    } catch (error) {
      Alert.alert('加载失败', errorMessage(error, '请稍后重试'))
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  async function copyText(value: string, successText: string, emptyText = '暂无可复制内容') {
    if (!value.trim()) {
      Alert.alert(emptyText)
      return
    }
    await Clipboard.setStringAsync(value)
    Alert.alert(successText)
  }

  const shareContent = data?.inviteLink ? `${data.shareText || '一起加入 CoachLink 训练'}\n${data.inviteLink}` : (data?.shareText || data?.code || '')

  useEffect(() => {
    void load()
  }, [])

  return (
    <ScreenShell title="邀请好友" subtitle="每邀请一位好友注册，双方各获奖励。" onBack={navigation.goBack}>
      {loading ? <LoadingState /> : null}
      {!loading && !data ? <EmptyState title="暂无邀请数据" desc="请稍后刷新重试" icon="icon-share" /> : null}
      {!loading && data ? (
        <>
          <Card style={local.referralCodeCard}>
            <Text style={local.referralCodeLabel}>我的邀请码</Text>
            <View style={local.referralCodeBox}>
              <Text style={local.referralCodeText}>{data.code || '---'}</Text>
            </View>
            {data.inviteLink ? (
              <View style={local.inviteLinkBox}>
                <Text style={local.inviteLinkLabel}>邀请链接</Text>
                <Text style={local.inviteLinkText}>{data.inviteLink}</Text>
              </View>
            ) : null}
            <View style={local.referralActions}>
              <SolidButton label="复制邀请码" variant="secondary" onPress={() => void copyText(data.code, '邀请码已复制')} />
              <SolidButton label="复制邀请链接" variant="secondary" onPress={() => void copyText(data.inviteLink, '邀请链接已复制', '暂无可复制的邀请链接')} />
            </View>
            <SolidButton label="复制分享文案" onPress={() => void copyText(shareContent, '邀请内容已复制，可直接粘贴分享')} />
          </Card>

          <Card>
            <Text style={local.rewardTitle}>邀请奖励</Text>
            <View style={local.rewardItem}>
              <View style={local.rewardIcon}><IconFont name="icon-star" size={22} color="#FFFFFF" /></View>
              <View style={{ flex: 1 }}>
                <Text style={local.itemTitle}>AI 导入次数</Text>
                <Text style={local.rewardValue}>+2 次</Text>
              </View>
            </View>
            <View style={local.rewardItem}>
              <View style={local.rewardIcon}><IconFont name="icon-goumaijilu" size={22} color="#FFFFFF" /></View>
              <View style={{ flex: 1 }}>
                <Text style={local.itemTitle}>云存储空间</Text>
                <Text style={local.rewardValue}>+200MB</Text>
              </View>
            </View>
            <Text style={local.timeText}>* 每邀请一位好友注册，双方各获得以上奖励</Text>
          </Card>

          <Card>
            <Text style={local.rewardTitle}>邀请统计</Text>
            <View style={local.referralStatsGrid}>
              <ReferralStat value={String(data.totalReferrals)} label="已邀请好友" />
              <ReferralStat value={String(data.totalRewards.ai_import)} label="累计 AI 次数" />
              <ReferralStat value={`${data.totalRewards.storage_mb}MB`} label="累计存储" />
            </View>
            <Text style={local.timeText}>* 当前奖励口径：每次有效邀请双方各得 AI +2 次、存储 +200MB</Text>
          </Card>

          <Pressable onPress={() => void load()} style={local.refreshLink}>
            <Text style={local.profileLink}>刷新邀请数据</Text>
          </Pressable>
        </>
      ) : null}
    </ScreenShell>
  )
}

function ReferralStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={local.referralStatItem}>
      <Text style={local.referralStatValue}>{value}</Text>
      <Text style={local.referralStatLabel}>{label}</Text>
    </View>
  )
}

export function CartScreen() {
  const navigation = useNavigationAny()
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [removingId, setRemovingId] = useState('')

  async function load(silent = false) {
    if (!silent) setLoading(true)
    try {
      const payload = await safeRequest<{ items?: CartItem[]; total?: number }>('/api/cart/list', { method: 'POST' })
      setItems(Array.isArray(payload?.items) ? payload.items : [])
    } catch (error) {
      Alert.alert('加载失败', errorMessage(error, '获取购物车失败'))
      setItems([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function remove(itemId: string) {
    setRemovingId(itemId)
    try {
      await safeRequest('/api/cart/remove', { method: 'POST', body: { itemId } })
      setItems((prev) => prev.filter((item) => item.id !== itemId))
    } catch (error) {
      Alert.alert('移除失败', errorMessage(error))
    } finally {
      setRemovingId('')
    }
  }

  async function clear() {
    try {
      await safeRequest('/api/cart/clear', { method: 'POST' })
      setItems([])
    } catch (error) {
      Alert.alert('清空失败', errorMessage(error))
    }
  }

  function continueSubscribe(item: CartItem) {
    if (!item.coachId) {
      Alert.alert('缺少教练信息', '无法继续发起订阅。')
      return
    }
    navigation.navigate('CoachProfile', { id: item.coachId })
  }

  useEffect(() => {
    void load()
  }, [])

  const totalPrice = items.reduce((sum, item) => sum + Number(item.price || 0), 0)

  return (
    <ScreenShell title="待结算订阅" subtitle={items.length > 0 ? `共 ${items.length} 项待结算订阅` : '这里只保留还没完成支付的订阅清单'} onBack={navigation.goBack}>
      <Card style={local.roleNotice}>
        <Text style={local.roleNoticeTitle}>这里和购买记录不是一回事</Text>
        <Text style={local.roleNoticeDesc}>这里放的是还没完成支付的订阅清单；购买记录里才是已下单、已支付或已退款的订单历史。</Text>
        <SolidButton label="查看购买记录" variant="secondary" onPress={() => navigation.navigate('PurchaseHistory')} />
      </Card>

      {loading ? <LoadingState /> : null}
      {!loading && items.length === 0 ? (
        <EmptyState title="暂无待结算订阅" desc="如果你已经完成支付，请去购买记录查看；如果还没选服务，可以继续去发现。" icon="icon-goumaijilu" />
      ) : null}
      {!loading && items.length > 0 ? (
        <>
          {items.map((item) => (
            <Card key={item.id} style={local.cartItem}>
              <Text style={local.itemTitle}>{asText(item.productName, '订阅服务')}</Text>
              <Text style={local.tierBadge}>{tierLabel(item.productTier)}</Text>
              <Text style={local.itemMeta}>教练：{asText(item.coachName, '教练')}</Text>
              <Text style={local.itemMeta}>时长：{Number(item.durationMonths || 0)} 个月</Text>
              <View style={local.priceLine}>
                <Text style={local.priceLabel}>价格：</Text>
                <Text style={local.priceValue}>¥{Number(item.price || 0).toFixed(2)}</Text>
              </View>
              <View style={local.rowActions}>
                <SolidButton label="立即订阅" onPress={() => continueSubscribe(item)} />
                <SolidButton label={removingId === item.id ? '删除中...' : '删除'} variant="secondary" loading={removingId === item.id} onPress={() => void remove(item.id)} />
              </View>
            </Card>
          ))}
          <Card>
            <View style={local.summaryRow}>
              <Text style={local.itemMeta}>共 {items.length} 项待结算订阅</Text>
              <Text style={local.summaryTotal}>总计：¥{totalPrice.toFixed(2)}</Text>
            </View>
            <Text style={local.noticeDesc}>点击购买后会进入教练主页，继续完成问卷、订阅与平台支付。</Text>
            <SolidButton label="清空购物车" variant="secondary" onPress={() => confirm('清空购物车', '确定要移除所有待结算订阅吗？', () => void clear())} />
          </Card>
        </>
      ) : null}
      <Pressable onPress={() => { setRefreshing(true); void load(true) }} style={local.refreshLink}>
        <Text style={local.profileLink}>{refreshing ? '刷新中...' : '刷新购物车'}</Text>
      </Pressable>
    </ScreenShell>
  )
}

export function PurchaseHistoryScreen() {
  const navigation = useNavigationAny()
  const [orders, setOrders] = useState<PurchaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const limit = 10

  async function load(nextPage = 1) {
    if (nextPage === 1) setLoading(true)
    else setLoadingMore(true)
    try {
      const payload = await apiClient.request<{ orders?: PurchaseItem[]; total?: number }>(`/api/purchase-history/list?page=${nextPage}&limit=${limit}`, { method: 'GET', timeoutMs: 10000 })
      const list = Array.isArray(payload?.orders) ? payload.orders : []
      setOrders((prev) => nextPage === 1 ? list : [...prev, ...list])
      setTotal(Number(payload?.total || list.length))
      setPage(nextPage)
    } catch (error) {
      Alert.alert('加载失败', errorMessage(error, '获取购买记录失败'))
      if (nextPage === 1) setOrders([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    void load(1)
  }, [])

  return (
    <ScreenShell title="购买记录" subtitle="会员、知识、教练服务等订单。" onBack={navigation.goBack}>
      {loading ? <LoadingState /> : null}
      {!loading && orders.length === 0 ? <EmptyState title="暂无购买记录" desc="您还没有任何购买记录" icon="icon-goumaijilu" /> : null}
      {!loading && orders.length > 0 ? (
        <>
          {orders.map((order) => {
            const status = statusConfig(order.status)
            const time = order.paidAt || order.paid_at || order.createdAt || order.created_at
            return (
              <Card key={String(order.id)} style={local.purchaseItem}>
                <View style={local.purchaseHeader}>
                  <Text style={local.purchaseName}>{asText(order.productName || order.subject, '订单')}</Text>
                  <Text style={[local.statusBadge, { color: status.color, backgroundColor: status.bg }]}>{status.label}</Text>
                </View>
                {order.coachName ? <Text style={local.itemMeta}>教练：{order.coachName}</Text> : null}
                {Number(order.durationMonths || 0) > 0 ? <Text style={local.itemMeta}>时长：{Number(order.durationMonths)} 个月</Text> : null}
                <View style={local.priceLine}>
                  <Text style={local.priceLabel}>金额：</Text>
                  <Text style={local.priceValue}>¥{Number(order.amount ?? order.price ?? 0).toFixed(2)}</Text>
                </View>
                <Text style={local.timeText}>{order.paidAt || order.paid_at ? '支付时间' : '创建时间'}：{formatTime(time)}</Text>
              </Card>
            )
          })}
          {orders.length < total ? (
            <SolidButton label={loadingMore ? '加载中...' : '加载更多'} variant="secondary" loading={loadingMore} onPress={() => void load(page + 1)} />
          ) : total > 0 ? (
            <Text style={local.loadedAll}>已加载全部 {total} 条记录</Text>
          ) : null}
        </>
      ) : null}
    </ScreenShell>
  )
}

export function SettingsScreen() {
  const navigation = useNavigationAny()
  const { user, logout, switchRole, clearLocalCache, deleteAccount } = useAuth()
  const [switchingRole, setSwitchingRole] = useState<'student' | 'coach' | null>(null)
  const [clearingCache, setClearingCache] = useState(false)
  const [cacheFeedback, setCacheFeedback] = useState('')
  const [deleteVisible, setDeleteVisible] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const activeRole = resolveCoachLinkAppRole(user)
  const targetRole = activeRole === 'coach' ? 'student' : 'coach'
  const canSwitch = targetRole === 'student' || user?.is_coach === true

  async function applyRoleSwitch() {
    try {
      setSwitchingRole(targetRole)
      await switchRole(targetRole)
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })
    } catch (error) {
      Alert.alert('切换失败', errorMessage(error))
    } finally {
      setSwitchingRole(null)
    }
  }

  function confirmRoleSwitch() {
    const label = targetRole === 'coach' ? '教练端' : '学员端'
    Alert.alert(`切换到${label}`, `切换后将返回${label}首页，账号资料和历史数据不会改变。`, [
      { text: '取消', style: 'cancel' },
      { text: '确认切换', onPress: () => void applyRoleSwitch() },
    ])
  }

  async function clearCache() {
    try {
      setClearingCache(true)
      setCacheFeedback('')
      const removed = await clearLocalCache()
      setCacheFeedback(removed > 0 ? `已清理 ${removed} 项本地缓存，登录状态保持不变。` : '本地缓存已经是干净的。')
    } catch (error) {
      Alert.alert('清理失败', errorMessage(error))
    } finally {
      setClearingCache(false)
    }
  }

  function confirmClearCache() {
    Alert.alert('清理本地缓存', '将删除今日训练快照、训练执行快照和计算器草稿。云端记录与登录状态不会受影响。', [
      { text: '取消', style: 'cancel' },
      { text: '确认清理', onPress: () => void clearCache() },
    ])
  }

  function closeDeleteModal() {
    if (deleting) return
    setDeleteVisible(false)
    setDeleteConfirmation('')
  }

  async function submitDeleteAccount() {
    if (deleteConfirmation.trim() !== '注销账号') {
      Alert.alert('确认文字不正确', '请输入“注销账号”后再继续。')
      return
    }
    try {
      setDeleting(true)
      await deleteAccount(deleteConfirmation.trim())
      setDeleteVisible(false)
      setDeleteConfirmation('')
    } catch (error) {
      Alert.alert('注销失败', errorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ScreenShell title="账户设置" subtitle={`CoachLink APP ${APP_VERSION}`} onBack={navigation.goBack}>
      <Card>
        <Text style={local.settingsSectionTitle}>使用身份</Text>
        <View style={local.settingsSummary}>
          <View style={local.settingsSummaryIcon}>
            <IconFont name={activeRole === 'coach' ? 'icon-coachline_line' : 'icon-user'} size={24} color={colors.brand} />
          </View>
          <View style={local.settingsSummaryMain}>
            <Text style={local.settingsSummaryTitle}>{activeRole === 'coach' ? '当前使用教练端' : '当前使用学员端'}</Text>
            <Text style={local.settingsHelp}>{activeRole === 'coach' ? '管理学员、计划、视频和经营数据。' : '记录训练、发现教练并使用知识和工具。'}</Text>
          </View>
          <View style={local.settingsRoleBadge}>
            <Text style={local.settingsRoleBadgeText}>{activeRole === 'coach' ? '教练' : '学员'}</Text>
          </View>
        </View>
        {canSwitch ? (
          <SolidButton
            label={targetRole === 'coach' ? '切换到教练端' : '切换到学员端'}
            variant="secondary"
            loading={switchingRole === targetRole}
            onPress={confirmRoleSwitch}
          />
        ) : (
          <Text style={local.settingsHelp}>当前账号还没有教练资格，可在“我的”页面提交教练申请。</Text>
        )}
      </Card>

      <Card>
        <Text style={local.settingsSectionTitle}>存储与安全</Text>
        <MenuRow label="重置登录密码" desc="通过手机号验证码设置新密码" icon="icon-setting" iconBg="#5C8DFF" onPress={() => navigation.navigate('ResetPassword')} />
        <SolidButton label="清理本地缓存" variant="secondary" loading={clearingCache} onPress={confirmClearCache} />
        {cacheFeedback ? <Text style={local.settingsFeedback}>{cacheFeedback}</Text> : null}
      </Card>

      <Card>
        <Text style={local.settingsSectionTitle}>协议与帮助</Text>
        <MenuRow label="用户服务协议" icon="icon-jhk" iconBg="#5C8DFF" onPress={() => navigation.navigate('Terms')} />
        <MenuRow label="隐私政策" icon="icon-account-settings-variant" iconBg="#29C3A3" onPress={() => navigation.navigate('Privacy')} />
        <MenuRow label="免责声明" icon="icon-wenhao" iconBg="#FFA940" onPress={() => navigation.navigate('Disclaimer')} />
        <MenuRow label="法律文档目录" icon="icon-knowledge" iconBg="#8FD3FE" onPress={() => navigation.navigate('LegalDocs')} />
        <MenuRow label="反馈" icon="icon-pinglun" iconBg="#CF6D4E" onPress={() => navigation.navigate('Feedback')} />
      </Card>

      <Card style={local.dangerZone}>
        <Text style={local.dangerTitle}>账户操作</Text>
        <Text style={local.dangerText}>退出登录可以重新登录；注销账号会停用登录凭据、清空个人公开资料并结束当前教练订阅关系。</Text>
        <SolidButton label="退出登录" variant="danger" onPress={() => confirm('退出登录', '确定要退出当前账号吗？本地缓存也会一并清理。', () => void logout())} />
        <SolidButton label="注销账号" variant="secondary" onPress={() => setDeleteVisible(true)} />
      </Card>

      <Modal transparent animationType="slide" visible={deleteVisible} onRequestClose={closeDeleteModal}>
        <View style={local.modalMask}>
          <View style={local.modalCard}>
            <Text style={local.modalTitle}>注销账号</Text>
            <Text style={local.dangerText}>这是不可恢复操作。请输入下方确认文字后继续：</Text>
            <Text style={local.dangerToken}>注销账号</Text>
            <TextInput
              value={deleteConfirmation}
              editable={!deleting}
              onChangeText={setDeleteConfirmation}
              placeholder="请输入“注销账号”"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="注销账号确认文字"
              style={local.modalInput}
            />
            <SolidButton label="取消" variant="secondary" disabled={deleting} onPress={closeDeleteModal} />
            <SolidButton label="确认注销" variant="danger" loading={deleting} disabled={deleteConfirmation.trim() !== '注销账号'} onPress={() => void submitDeleteAccount()} />
          </View>
        </View>
      </Modal>
    </ScreenShell>
  )
}

export function FriendsScreen() {
  const navigation = useNavigationAny()
  const route = useRouteAny<'Friends'>()
  const [friends, setFriends] = useState<FriendItem[]>([])
  const [requests, setRequests] = useState<FriendRequestItem[]>([])
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [activeTab, setActiveTab] = useState(route.params?.tab === 'requests' ? 'requests' : 'friends')
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [friendsData, requestsData] = await Promise.all([
        apiClient.request<{ friends?: FriendItem[]; total?: number }>('/api/user/friends', { method: 'GET', timeoutMs: 12000 }),
        apiClient.request<{ requests?: FriendRequestItem[]; total?: number }>('/api/user/friends/pending', { method: 'GET', timeoutMs: 12000 }),
      ])
      setFriends(friendsData.friends || [])
      setRequests(requestsData.requests || [])
    } catch (err) {
      setError(errorMessage(err))
      setFriends([])
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  async function search(query = searchText) {
    const keyword = query.trim()
    if (!keyword) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    try {
      const data = await apiClient.request<UserSearchResult[]>(`/api/user/search?query=${encodeURIComponent(keyword)}`, { method: 'GET', timeoutMs: 12000 })
      setSearchResults(Array.isArray(data) ? data : [])
    } catch (err) {
      Alert.alert('搜索失败', errorMessage(err))
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  async function sendRequest(targetUserId: string) {
    setActionLoading(true)
    try {
      await apiClient.request('/api/user/friends/request', { method: 'POST', body: { targetUserId }, timeoutMs: 12000 })
      Alert.alert('请求已发送')
      setSearchResults((prev) => prev.filter((item) => item.id !== targetUserId))
    } catch (err) {
      Alert.alert('发送失败', errorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  async function respond(friendshipId: string, action: 'accept' | 'reject') {
    setActionLoading(true)
    try {
      await apiClient.request('/api/user/friends/respond', { method: 'POST', body: { friendshipId, action }, timeoutMs: 12000 })
      Alert.alert(action === 'accept' ? '已添加好友' : '已拒绝请求')
      await load()
    } catch (err) {
      Alert.alert('操作失败', errorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  function removeFriend(friendId: string) {
    confirm('删除确认', '确定要删除这位好友吗？', async () => {
      setActionLoading(true)
      try {
        await apiClient.request(`/api/user/friends/${encodeURIComponent(friendId)}`, { method: 'DELETE', timeoutMs: 12000 })
        setFriends((prev) => prev.filter((item) => item.userId !== friendId))
        Alert.alert('已删除好友')
      } catch (err) {
        Alert.alert('删除失败', errorMessage(err))
      } finally {
        setActionLoading(false)
      }
    })
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <ScreenShell title="我的朋友" subtitle="好友、申请和训练动态关系。" onBack={navigation.goBack}>
      <Card style={local.friendSearchCard}>
        <View style={local.searchInputWrap}>
          <IconFont name="icon-search" color={colors.textMuted} size={18} />
          <TextInput
            value={searchText}
            onChangeText={(value) => {
              setSearchText(value)
              if (!value.trim()) setSearchResults([])
            }}
            onSubmitEditing={() => void search()}
            returnKeyType="search"
            placeholder="搜索用户昵称或ID..."
            placeholderTextColor={colors.textMuted}
            style={local.friendSearchInput}
          />
        </View>
        <SolidButton label={searchLoading ? '搜索中...' : '搜索'} loading={searchLoading} disabled={!searchText.trim()} onPress={() => void search()} />
      </Card>

      {searchResults.length > 0 ? (
        <Card style={local.searchResultCard}>
          <Text style={local.resultTitle}>搜索结果</Text>
          {searchResults.map((user) => (
            <View key={user.id} style={local.friendRow}>
              <FriendAvatar uri={user.avatarUrl || undefined} name={user.nickname || 'U'} />
              <View style={local.friendBody}>
                <Text style={local.friendName}>{user.nickname || '未知用户'}</Text>
                {user.searchId ? <Text style={local.friendMeta}>ID：{user.searchId}</Text> : null}
              </View>
              <Pressable disabled={actionLoading} onPress={() => void sendRequest(user.id)} style={local.addFriendButton}>
                <Text style={local.addFriendText}>添加</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      ) : null}

      <View style={local.friendTabs}>
        <Pressable onPress={() => setActiveTab('friends')} style={[local.friendTab, activeTab === 'friends' && local.friendTabActive]}>
          <Text style={[local.friendTabText, activeTab === 'friends' && local.friendTabTextActive]}>好友列表</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab('requests')} style={[local.friendTab, activeTab === 'requests' && local.friendTabActive]}>
          <Text style={[local.friendTabText, activeTab === 'requests' && local.friendTabTextActive]}>新请求{requests.length > 0 ? ` ${requests.length}` : ''}</Text>
        </Pressable>
      </View>

      {loading ? <LoadingState /> : null}
      {!loading && error ? <EmptyState title="加载失败" desc={error} icon="icon-wenhao" /> : null}

      {!loading && !error && activeTab === 'friends' ? (
        friends.length === 0 ? (
          <EmptyState title="还没有好友" desc="去搜索添加一些健身伙伴吧！" icon="icon-friends-o" />
        ) : (
          <View style={local.friendList}>
            {friends.map((friend) => (
              <Card key={friend.userId} style={local.friendItemCard}>
                <Pressable style={local.friendTapArea} onPress={() => navigation.navigate('UserHome')}>
                  <FriendAvatar uri={friend.avatarUrl || undefined} name={friend.nickname || 'F'} />
                  <View style={local.friendBody}>
                    <Text style={local.friendName}>{friend.nickname || '未知好友'}</Text>
                    <Text style={local.friendMeta}>成为好友：{formatDate(friend.friendsSince)}</Text>
                  </View>
                </Pressable>
                <Pressable disabled={actionLoading} onPress={() => removeFriend(friend.userId)} style={local.removeFriendButton}>
                  <Text style={local.removeFriendText}>删除</Text>
                </Pressable>
              </Card>
            ))}
          </View>
        )
      ) : null}

      {!loading && !error && activeTab === 'requests' ? (
        requests.length === 0 ? (
          <EmptyState title="暂无新请求" icon="icon-friends-o" />
        ) : (
          <View style={local.friendList}>
            {requests.map((request) => {
              const requester = request.requester || request
              return (
                <Card key={request.friendshipId} style={local.friendItemCard}>
                  <View style={local.friendTapArea}>
                    <FriendAvatar uri={requester.avatarUrl || undefined} name={requester.nickname || 'U'} />
                    <View style={local.friendBody}>
                      <Text style={local.friendName}>{requester.nickname || '未知用户'}</Text>
                      <Text style={local.friendMeta}>{request.message || '请求添加你为好友'}</Text>
                    </View>
                  </View>
                  <View style={local.requestActions}>
                    <Pressable disabled={actionLoading} onPress={() => void respond(request.friendshipId, 'accept')} style={local.acceptButton}><Text style={local.acceptText}>接受</Text></Pressable>
                    <Pressable disabled={actionLoading} onPress={() => void respond(request.friendshipId, 'reject')} style={local.rejectButton}><Text style={local.rejectText}>拒绝</Text></Pressable>
                  </View>
                </Card>
              )
            })}
          </View>
        )
      ) : null}
    </ScreenShell>
  )
}

export function FriendActivityScreen() {
  const navigation = useNavigationAny()
  const [activities, setActivities] = useState<FriendActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await apiClient.request<{ activities?: FriendActivityItem[] }>('/api/user/friends/activity?limit=20', { method: 'GET', timeoutMs: 12000 })
      setActivities(data.activities || [])
    } catch (err) {
      setError(errorMessage(err))
      setActivities([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <ScreenShell title="好友动态" subtitle="查看好友的训练动态和成就。" onBack={navigation.goBack}>
      {loading ? <LoadingState /> : null}
      {!loading && error ? <EmptyState title="加载失败" desc={error} icon="icon-wenhao" /> : null}
      {!loading && !error && activities.length === 0 ? <EmptyState title="暂无好友动态" desc="好友的动态会在这里显示。" icon="icon-messages" /> : null}
      {!loading && !error && activities.length > 0 ? (
        <View style={local.activityList}>
          {activities.map((activity) => {
            const user = activity.user || { nickname: activity.nickname, avatarUrl: activity.avatarUrl, userId: activity.userId || '' }
            const execution = activity.execution
            const highlight = execution?.highlight
            const content = activity.content || `${execution?.planName || '训练计划'} 第 ${execution?.dayIndex || 0} 天训练已完成`
            return (
              <Card key={activity.id} style={local.activityCard}>
                <View style={local.activityHeader}>
                  <FriendAvatar uri={user.avatarUrl || undefined} name={user.nickname || 'U'} />
                  <View style={local.activityUser}>
                    <Text style={local.friendName}>{user.nickname || '未知用户'}</Text>
                    <Text style={local.friendMeta}>{formatTime(execution?.completedAt || activity.created_at)}</Text>
                  </View>
                  <View style={local.activityIcon}><IconFont name="icon-training_history" color={colors.brand} size={20} /></View>
                </View>
                <Text style={local.activityContent}>{content}</Text>
                {execution ? (
                  <View style={local.activityStats}>
                    <View style={local.activityStat}><Text style={local.activityStatValue}>{Math.round(Number(execution.totalVolume || 0))}</Text><Text style={local.activityStatLabel}>容量 kg</Text></View>
                    <View style={local.activityStat}><Text style={local.activityStatValue}>{Number(execution.durationMinutes || 0)}</Text><Text style={local.activityStatLabel}>分钟</Text></View>
                    <View style={local.activityStat}><Text style={local.activityStatValue}>{execution.dayIndex || 0}</Text><Text style={local.activityStatLabel}>训练日</Text></View>
                  </View>
                ) : null}
                {highlight ? <Text style={local.activityHighlight}>亮点：{highlight.actionName} {highlight.weight}kg × {highlight.reps}</Text> : null}
              </Card>
            )
          })}
        </View>
      ) : null}
    </ScreenShell>
  )
}

export function MessagesScreen() {
  const navigation = useNavigationAny()
  const [chatrooms, setChatrooms] = useState<ChatroomListItem[]>([])
  const [requests, setRequests] = useState<FriendRequestItem[]>([])
  const [searchText, setSearchText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [roomData, requestData] = await Promise.all([
        apiClient.request<{ chatRooms?: ChatroomListItem[]; total?: number }>('/api/chat/list-chatrooms?page=1&limit=50', { method: 'GET', timeoutMs: 12000 }),
        apiClient.request<{ requests?: FriendRequestItem[]; total?: number }>('/api/user/friends/pending', { method: 'GET', timeoutMs: 12000 }),
      ])
      setChatrooms([...(roomData.chatRooms || [])].sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()))
      setRequests(requestData.requests || [])
    } catch (err) {
      setError(errorMessage(err))
      setChatrooms([])
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = searchText.trim()
    ? chatrooms.filter((room) => {
        const keyword = searchText.trim().toLowerCase()
        return String(room.chatUserProfile?.name || '').toLowerCase().includes(keyword) || String(room.lastMessage || '').toLowerCase().includes(keyword)
      })
    : chatrooms

  return (
    <ScreenShell title="消息中心" subtitle="教练、学员和系统会话。" onBack={navigation.goBack}>
      <Pressable onPress={() => navigation.navigate('Friends', requests.length > 0 ? { tab: 'requests' } : undefined)} style={local.messagesFriendsEntry}>
        <View style={local.messagesFriendsLeft}>
          <Text style={local.messagesFriendsTitle}>好友</Text>
          {requests.length > 0 ? <View style={local.messagesBadge}><Text style={local.messagesBadgeText}>{requests.length > 99 ? '99+' : requests.length}</Text></View> : null}
        </View>
        <Text style={local.messagesFriendsHint} numberOfLines={1}>{requests.length > 0 ? `${requests.length} 条好友申请待处理 · ${(requests[0].requester || requests[0]).nickname || '用户'} 等` : '添加好友、查看好友申请与列表'}</Text>
        <IconFont name="icon-right-arrow" color={colors.textMuted} size={18} />
      </Pressable>

      <Card style={local.messageSearchCard}>
        <IconFont name="icon-search" color={colors.textMuted} size={18} />
        <TextInput value={searchText} onChangeText={setSearchText} placeholder="搜索联系人或聊天内容" placeholderTextColor={colors.textMuted} style={local.messageSearchInput} />
      </Card>

      <View style={local.listSectionHeader}>
        <Text style={local.sectionTitle}>会话</Text>
        <View style={local.listSectionTag}>
          <IconFont name="icon-messages" color={colors.brand} size={14} />
          <Text style={local.listSectionTagText}>消息列表</Text>
        </View>
      </View>

      {loading ? <LoadingState /> : null}
      {!loading && error ? <EmptyState title="加载失败" desc={error} icon="icon-wenhao" /> : null}
      {!loading && !error && filtered.length === 0 ? <EmptyState title="暂无会话" desc="下拉刷新，或从上方进入好友页添加联系人。" icon="icon-messages" /> : null}
      {!loading && !error && filtered.length > 0 ? (
        <View style={local.chatroomList}>
          {filtered.map((room, index) => {
            const name = room.chatUserProfile?.name || '未知用户'
            return (
              <Pressable key={room.id} onPress={() => navigation.navigate('Chat', { roomId: room.id })} style={local.chatroomItem}>
                <FriendAvatar uri={room.chatUserProfile?.avatar || undefined} name={name} toneIndex={index} square />
                <View style={local.chatroomContent}>
                  <View style={local.chatroomHeader}>
                    <Text style={local.chatroomName} numberOfLines={1}>{name}</Text>
                    <Text style={local.chatroomTime}>{formatConversationTime(room.lastMessageAt || undefined)}</Text>
                  </View>
                  <View style={local.chatroomFooter}>
                    <View style={local.chatroomMessageRow}>
                      <IconFont name="icon-messages" color={colors.textMuted} size={14} />
                      <Text style={local.chatroomMessage} numberOfLines={1}>{formatLastMessagePreview(room.lastMessage)}</Text>
                    </View>
                    {Number(room.unreadCount || 0) > 0 ? <View style={local.unreadBadge}><Text style={local.unreadText}>{Number(room.unreadCount) > 99 ? '99+' : room.unreadCount}</Text></View> : null}
                  </View>
                </View>
              </Pressable>
            )
          })}
        </View>
      ) : null}
    </ScreenShell>
  )
}

export function ChatScreen() {
  const route = useRouteAny<'Chat'>()
  const navigation = useNavigationAny()
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const roomId = route.params?.roomId

  async function loadMessages() {
    if (!roomId) {
      setLoading(false)
      setMessages([])
      setError('缺少会话 ID')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await apiClient.request<{ messages?: ChatMessage[] }>('/api/chat/list-messages', {
        method: 'POST',
        body: { roomId, page: 1, limit: 50 },
        timeoutMs: 12000,
      })
      setMessages(data.messages || [])
    } catch (err) {
      setError(errorMessage(err))
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMessages()
  }, [roomId])

  async function send() {
    if (!roomId || !message.trim()) return
    setSending(true)
    try {
      await apiClient.request('/api/chat/send-message', {
        method: 'POST',
        body: { roomId, messageType: 'text', content: message.trim() },
        timeoutMs: 12000,
      })
      setMessage('')
      await loadMessages()
    } catch (error) {
      Alert.alert('发送失败', errorMessage(error))
    } finally {
      setSending(false)
    }
  }
  return (
    <ScreenShell title="聊天" subtitle={`会话：${roomId || '-'}`} onBack={navigation.goBack}>
      {loading ? <LoadingState /> : null}
      {!loading && error ? (
        <>
          <EmptyState title="加载失败" desc={error} icon="icon-messages" />
          <SolidButton label="重试" variant="secondary" onPress={() => void loadMessages()} />
        </>
      ) : null}
      {!loading && !error && messages.length === 0 ? <EmptyState title="暂无消息" desc="发送第一条消息，与教练保持同步。" icon="icon-messages" /> : null}
      {!loading && !error && messages.length > 0 ? (
        <Card style={local.chatListCard}>
          {messages.map((item) => (
            <View key={item.id} style={[local.chatBubbleRow, item.isMine && local.chatBubbleRowMine]}>
              <View style={[local.chatBubble, item.isMine && local.chatBubbleMine]}>
                {!item.isMine ? <Text style={local.chatSender}>{item.chatUserProfile?.name || '对方'}</Text> : null}
                <Text style={[local.chatContent, item.isMine && local.chatContentMine]}>{item.content || messageTypeLabel(item.messageType)}</Text>
                <Text style={[local.chatTime, item.isMine && local.chatTimeMine]}>{formatTime(item.createdAt)}</Text>
              </View>
            </View>
          ))}
        </Card>
      ) : null}
      <Card>
        <FormField label="发送消息" value={message} onChangeText={setMessage} multiline />
        <SolidButton label="发送" loading={sending} onPress={send} disabled={!roomId || !message.trim()} />
      </Card>
    </ScreenShell>
  )
}

export function MyCoachesScreen() {
  const navigation = useNavigationAny()
  const { user, isAuthenticated } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [subscriptions, setSubscriptions] = useState<CoachSubscription[]>([])
  const [aggregatedMap, setAggregatedMap] = useState<Record<string, CoachAggregatedInfo>>({})
  const [error, setError] = useState('')

  async function load(silent = false) {
    if (!isAuthenticated) {
      setLoading(false)
      setSubscriptions([])
      setError('请先登录')
      return
    }
    if (!silent) setLoading(true)
    setError('')
    try {
      const data = await apiClient.request<{ subscriptions: CoachSubscription[] }>('/api/subscription/list-subscriptions', {
        method: 'POST',
        body: { studentId: user?.id, page: 1, limit: 50 },
        timeoutMs: 12000,
      })
      const list = data.subscriptions || []
      setSubscriptions(list)
      const entries = await Promise.all(list.map(async (sub) => {
        try {
          const info = await apiClient.request<CoachAggregatedInfo>('/api/coach/get-aggregated-info', {
            method: 'POST',
            body: { coachId: sub.coach_id },
            timeoutMs: 12000,
          })
          return [sub.coach_id, info] as const
        } catch {
          return [sub.coach_id, null] as const
        }
      }))
      const next: Record<string, CoachAggregatedInfo> = {}
      entries.forEach(([coachId, info]) => {
        if (info) next[coachId] = info
      })
      setAggregatedMap(next)
    } catch (err) {
      setError(errorMessage(err))
      setSubscriptions([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void load()
  }, [isAuthenticated, user?.id])

  async function openChat(sub: CoachSubscription) {
    const coachUserId = sub.coach?.user_id
    if (!user?.id || !coachUserId) {
      Alert.alert('暂无法联系', '缺少教练账号信息')
      return
    }
    if (coachUserId === user.id) {
      Alert.alert('无法发起会话', '不能与自己发起会话')
      return
    }
    try {
      const data = await apiClient.request<{ chatroom: { id: string } | null }>('/api/chat/get-chatroom', {
        method: 'POST',
        body: { members: [user.id, coachUserId] },
        timeoutMs: 12000,
      })
      navigation.navigate('Chat', { roomId: data.chatroom?.id || undefined })
    } catch (err) {
      Alert.alert('打开会话失败', errorMessage(err))
    }
  }

  return (
    <ScreenShell title="我的教练" subtitle="订阅过或正在服务你的教练。" onBack={navigation.goBack}>
      <View style={local.myCoachHeader}>
        <View>
          <Text style={local.myCoachHeaderTitle}>教练服务</Text>
          <Text style={local.myCoachHeaderSub}>查看订阅状态、联系教练或继续续费。</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('MainTabs', { screen: 'CoachesTab' })} style={local.discoveryButton}>
          <Text style={local.discoveryButtonText}>发现更多</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={local.coachSkeletonList}>
          {[1, 2, 3].map((item) => (
            <Card key={item} style={local.coachSkeletonCard}>
              <View style={local.coachSkeletonAvatar} />
              <View style={local.coachSkeletonContent}>
                <View style={[local.coachSkeletonLine, { width: '42%' }]} />
                <View style={[local.coachSkeletonLine, { width: '68%' }]} />
                <View style={[local.coachSkeletonLine, { width: '86%' }]} />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {!loading && error ? (
        <>
          <EmptyState title={error === '请先登录' ? '请先登录' : '加载失败'} desc={error} icon="icon-coachline_line" />
          <SolidButton label={error === '请先登录' ? '去登录' : '重试'} variant="secondary" onPress={() => error === '请先登录' ? navigation.navigate('Login') : void load()} />
        </>
      ) : null}

      {!loading && !error && subscriptions.length === 0 ? (
        <>
          <EmptyState title="暂无订阅的教练" desc="去发现页订阅你喜欢的教练，订阅状态会显示在这里。" icon="icon-coachline_line" />
          <SolidButton label="发现教练" variant="secondary" onPress={() => navigation.navigate('MainTabs', { screen: 'CoachesTab' })} />
        </>
      ) : null}

      {!loading && !error && subscriptions.length > 0 ? (
        <ScrollView
          scrollEnabled={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true) }} />}
          contentContainerStyle={local.coachCardList}
        >
          {subscriptions.map((sub) => (
            <CoachServiceCard
              key={sub.id}
              subscription={sub}
              aggregated={aggregatedMap[sub.coach_id]}
              onDetail={() => navigation.navigate('CoachProfile', { id: sub.coach_id })}
              onRenew={() => navigation.navigate('CoachProfile', { id: sub.coach_id })}
              onConsult={() => void openChat(sub)}
            />
          ))}
        </ScrollView>
      ) : null}
    </ScreenShell>
  )
}

function CoachServiceCard({
  subscription,
  aggregated,
  onDetail,
  onRenew,
  onConsult,
}: {
  subscription: CoachSubscription
  aggregated?: CoachAggregatedInfo
  onDetail: () => void
  onRenew: () => void
  onConsult: () => void
}) {
  const statusKey = getCoachStatusKey(subscription)
  const theme = COACH_STATUS_THEME[statusKey]
  const name = coachDisplayName(subscription, aggregated)
  const avatar = coachAvatar(subscription, aggregated)
  const subtitle = coachSubtitle(subscription, aggregated)
  const tags = coachSpecialties(subscription, aggregated)
  const daysLeft = subscription.end_date ? Math.ceil((new Date(subscription.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
  const showDaysBadge = statusKey === 'active' && daysLeft !== null
  const isExpiring = statusKey === 'expiring'
  const bio = String(subscription.coach?.bio || aggregated?.coach?.bio || '').trim()

  return (
    <Card style={local.coachServiceCard}>
      <View style={local.coachCardHeader}>
        <View style={local.coachIdentity}>
          <View style={local.coachAvatarWrap}>
            <InlineAvatar uri={avatar || undefined} label={name} size={72} />
            <View style={[local.coachStatusDot, statusKey === 'active' && local.coachStatusDotActive]} />
          </View>
          <View style={local.coachTextBlock}>
            <Text style={local.coachCardName} numberOfLines={1}>{name}</Text>
            <Text style={local.coachCardTitle} numberOfLines={2}>{subtitle}</Text>
          </View>
        </View>
        <View style={[local.coachStatusTag, { backgroundColor: theme.bg }]}>
          {showDaysBadge ? (
            <>
              <Text style={[local.coachStatusSmall, { color: theme.text }]}>剩余</Text>
              <Text style={[local.coachStatusDays, { color: theme.text }]}>{daysLeft}天</Text>
            </>
          ) : (
            <Text style={[local.coachStatusText, { color: theme.text }]}>{theme.label}</Text>
          )}
        </View>
      </View>

      <View style={local.coachMetrics}>
        <View style={local.coachMetricItem}><Text style={local.coachMetricLabel}>内容</Text><Text style={local.coachMetricValue}>{aggregated?.contentCount ?? 0}</Text></View>
        <View style={local.coachMetricItem}><Text style={local.coachMetricLabel}>学员</Text><Text style={local.coachMetricValue}>{aggregated?.studentCount ?? 0}</Text></View>
        <View style={local.coachMetricItem}><Text style={local.coachMetricLabel}>评分</Text><Text style={[local.coachMetricValue, local.coachMetricRating]}>{aggregated?.averageRating?.toFixed(1) ?? '0.0'}</Text></View>
      </View>

      {tags.length > 0 ? (
        <View style={local.coachTags}>
          {tags.slice(0, 4).map((tag, index) => <Text key={`${tag}-${index}`} style={local.coachTag}>{tag}</Text>)}
        </View>
      ) : null}

      {bio ? <Text style={local.coachBio} numberOfLines={2}>{bio}</Text> : null}

      <View style={local.coachActions}>
        <Pressable onPress={onConsult} style={local.coachConsultButton}>
          <IconFont name="icon-messages" color={colors.textSecondary} size={20} />
        </Pressable>
        <Pressable onPress={onDetail} style={local.coachDetailButton}>
          <Text style={local.coachDetailText}>查看详情</Text>
          <IconFont name="icon-right-arrow" color="#FFFFFF" size={15} />
        </Pressable>
      </View>

      {isExpiring && daysLeft !== null ? (
        <View style={local.expiringTip}>
          <Text style={local.expiringText}>即将于 {daysLeft} 天后到期，续费可继续享受专业指导。</Text>
          <Pressable onPress={onRenew}><Text style={local.expiringLink}>立即续费</Text></Pressable>
        </View>
      ) : null}
    </Card>
  )
}

export function PaymentWaitingScreen() {
  return <SimpleInfoScreen title="等待支付" subtitle="支付状态会自动同步到订单和会员。" icon="icon-time" message="APP 端支付承接会根据订单类型跳转原生或网页支付。当前可返回购买记录查看状态。" />
}

export function PaymentWebviewScreen() {
  return <SimpleInfoScreen title="网页支付" subtitle="APP 内网页支付承接页。" icon="icon-goumaijilu" message="如后端返回支付链接，APP 将使用系统浏览器打开并回到订单状态页。" />
}

export function PaymentWechatScreen() {
  return <SimpleInfoScreen title="微信支付" subtitle="微信宿主能力在 APP 中需要原生支付 SDK。" icon="icon-goumaijilu" message="当前保留支付状态页；真实支付接入时在这里承接原生微信支付结果。" />
}

export function RankingScreen() {
  const navigation = useNavigationAny()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<LeaderboardItem[]>([])
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await apiClient.request<{ leaderboards?: LeaderboardItem[] }>('/api/ranking/list-leaderboard', { method: 'POST', body: { page: 1, limit: 20, countStatus: 'approved' }, timeoutMs: 12000 })
      const sorted = [...(data.leaderboards || [])].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      setItems(sorted)
    } catch (err) {
      setError(errorMessage(err))
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <ScreenShell title="排行榜" subtitle="CoachLink Ranking 挑战榜。" onBack={navigation.goBack}>
      <View style={local.rankingHero}>
        <View style={local.rankingHeroBadge}>
          <IconFont name="icon-ranking" color="#F7B267" size={14} />
          <Text style={local.rankingHeroBadgeText}>挑战已开启</Text>
        </View>
        <Text style={local.rankingHeroTitle}>COACHLINK</Text>
        <Text style={local.rankingHeroAccent}>RANKING</Text>
        <Text style={local.rankingHeroDesc}>记录你的每一次超越。在这个赛场上，汗水是唯一的入场券，实力是最高的话语权。</Text>
      </View>

      {loading ? (
        <View style={local.rankingSkeletonList}>
          {[1, 2, 3].map((item) => <View key={item} style={local.rankingSkeletonCard} />)}
        </View>
      ) : null}
      {!loading && error ? <EmptyState title="加载失败" desc={error} icon="icon-wenhao" /> : null}
      {!loading && !error && items.length === 0 ? <EmptyState title="暂无排行榜" desc="新的挑战开放后会显示在这里。" icon="icon-ranking" /> : null}
      {!loading && !error && items.length > 0 ? (
        <View style={local.rankingList}>
          {items.map((item, index) => (
            <Pressable key={item.id} onPress={() => navigation.navigate('RankingDetail', { id: item.id })}>
              <Card style={[local.rankingCard, index === 1 || (items.length === 1 && index === 0) ? local.rankingCardFeatured : null]}>
                <View style={local.rankingCardTop}>
                  <View style={local.rankingIconWrap}><IconFont name={rankingTypeIcon(item.type)} color={colors.brand} size={24} /></View>
                  <View style={local.rankingStats}>
                    <IconFont name="icon-user" color={colors.textMuted} size={14} />
                    <Text style={local.rankingStatsText}>已参与: {item.statusCount ?? 0}</Text>
                  </View>
                </View>
                <Text style={local.rankingCardTitle}>{item.title || '未命名挑战'}</Text>
                <Text style={local.rankingCardDesc}>{item.description || '暂无描述，参与挑战展现你的实力吧！'}</Text>
                <View style={local.rankingCardFooter}>
                  <Text style={local.rankingCta}>立即挑战</Text>
                  <IconFont name="icon-right-arrow" color={colors.brand} size={18} />
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Text style={local.rankingFootnote}>* 排行榜实时更新，确保您的数据真实有效</Text>
    </ScreenShell>
  )
}

export function RankingDetailScreen() {
  const navigation = useNavigationAny()
  const route = useRouteAny<'RankingDetail'>()
  const id = route.params?.id
  const [leaderboard, setLeaderboard] = useState<LeaderboardDetail | null>(null)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  async function load() {
    if (!id) {
      setLoading(false)
      setLeaderboard(null)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [detail, entryData] = await Promise.all([
        apiClient.request<{ leaderboard?: LeaderboardDetail | null }>('/api/ranking/get-leaderboard', { method: 'POST', body: { id }, timeoutMs: 12000 }),
        apiClient.request<{ entries?: LeaderboardEntry[]; total?: number }>('/api/ranking/list-entries', { method: 'POST', body: { template_id: id, status: 'approved', limit: 100, sort_by: 'score' }, timeoutMs: 12000 }),
      ])
      setLeaderboard(detail.leaderboard || null)
      setEntries(entryData.entries || [])
      setTotal(entryData.total || 0)
    } catch (err) {
      setError(errorMessage(err))
      setLeaderboard(null)
      setEntries([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [id])

  if (loading) {
    return (
      <ScreenShell title="排行榜详情" onBack={navigation.goBack}>
        <LoadingState />
      </ScreenShell>
    )
  }

  if (error || !leaderboard) {
    return (
      <ScreenShell title="排行榜详情" onBack={navigation.goBack}>
        <EmptyState title={error ? '加载失败' : '排行榜不存在'} desc={error || '该挑战可能已关闭或不存在。'} icon="icon-ranking" />
      </ScreenShell>
    )
  }

  const rankByField = leaderboard.rank_by_field || 'score'
  const rules = Array.isArray(leaderboard.rules) ? leaderboard.rules : []
  const formSchema = Array.isArray(leaderboard.form_schema) ? leaderboard.form_schema : []

  return (
    <ScreenShell title="排行榜详情" subtitle="挑战信息、实时排名和成绩提交。" onBack={navigation.goBack}>
      <View style={local.rankingDetailHeader}>
        <Text style={local.rankingDetailEyebrow}>月度排行榜挑战赛</Text>
        <Text style={local.rankingDetailTitle}>{leaderboard.title || '未命名挑战'}</Text>
        <Text style={local.rankingDetailDesc}>{leaderboard.description || '暂无描述'}</Text>
        <View style={local.rankingDetailMetaGrid}>
          <RankingMeta label="开始" value={formatDate(leaderboard.start_at)} />
          <RankingMeta label="结束" value={formatDate(leaderboard.end_at)} />
          <RankingMeta label="记录" value={`${total} 条`} />
          <RankingMeta label="发起" value={leaderboard.initiator || '教链'} />
        </View>
        {leaderboard.needReview ? <Text style={local.rankingReviewBadge}>提交后需审核</Text> : <Text style={local.rankingReviewBadge}>提交后立即入榜</Text>}
        <SolidButton label="提交挑战成绩" onPress={() => setDialogOpen(true)} />
      </View>

      <Card style={local.rankingSection}>
        <View style={local.sectionHeaderRow}>
          <IconFont name="icon-wenhao" color={colors.brand} size={18} />
          <Text style={local.sectionTitle}>活动说明</Text>
        </View>
        <Text style={local.rankingParagraph}>{leaderboard.description || '参与挑战，上传成绩并等待审核。'}</Text>
        {rules.length > 0 ? rules.map((rule, index) => (
          <View key={`${rule.detail || index}`} style={local.ruleRow}>
            <Text style={local.ruleIndex}>{index + 1}</Text>
            <Text style={local.ruleText}>{rule.detail || '-'}</Text>
          </View>
        )) : <Text style={local.rankingMuted}>暂无额外规则</Text>}
      </Card>

      <Card style={local.rankingSection}>
        <View style={local.sectionHeaderRow}>
          <IconFont name="icon-strength" color={colors.brand} size={18} />
          <Text style={local.sectionTitle}>实时排名 / RANKING</Text>
        </View>
        {entries.length === 0 ? <EmptyState title="暂无入榜记录" desc="提交审核通过后会显示在这里。" icon="icon-ranking" /> : null}
        {entries.map((entry, index) => (
          <LeaderboardEntryCard key={entry.id || index} entry={entry} index={index} rankByField={rankByField} />
        ))}
      </Card>

      {leaderboard.remarks ? (
        <Card style={local.noticeCard}>
          <View style={local.noticeLine}>
            <IconFont name="icon-wenhao" color="#92400E" size={18} />
            <Text style={local.noticeText}>{leaderboard.remarks}</Text>
          </View>
        </Card>
      ) : null}

      <RankingSubmissionModal
        visible={dialogOpen}
        templateId={id || ''}
        formSchema={formSchema}
        rankByField={rankByField}
        needReview={!!leaderboard.needReview}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => {
          setDialogOpen(false)
          void load()
        }}
      />
    </ScreenShell>
  )
}

export function CoachApplicationScreen() {
  const navigation = useNavigationAny()
  const { user } = useAuth()
  const [form, setForm] = useState<CoachApplicationForm>(() => emptyCoachApplicationForm(user))
  const [review, setReview] = useState<{ status?: string | null; reviewNotes?: string | null; reviewedAt?: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [specialtyDraft, setSpecialtyDraft] = useState('')
  const [materialDraft, setMaterialDraft] = useState<CoachApplicationMaterial | null>(null)
  const [editingMaterialIndex, setEditingMaterialIndex] = useState<number | null>(null)
  const [materialLink, setMaterialLink] = useState({ label: '', url: '' })
  const [socialDraft, setSocialDraft] = useState({ name: '抖音', url: '' })
  const [showSocialEditor, setShowSocialEditor] = useState(false)

  function patch(next: Partial<CoachApplicationForm>) {
    setForm((prev) => ({ ...prev, ...next }))
  }

  async function load() {
    setLoading(true)
    try {
      const data = await apiClient.request<{ application?: CoachApplicationRow | null }>('/api/coach/get-coach-application', { method: 'POST', body: {}, timeoutMs: 12000 })
      const app = data.application
      if (!app) {
        setForm(emptyCoachApplicationForm(user))
        setReview(null)
        return
      }
      setForm({
        id: app.id,
        name: app.name || '',
        title: app.title || '',
        bio: app.bio || '',
        yearsExperience: app.years_experience ? String(app.years_experience) : '',
        teachingPhilosophy: app.teaching_philosophy || '',
        contactEmail: app.contact_email || '',
        contactPhone: app.contact_phone || '',
        specialties: app.specialties || [],
        applicationMaterials: normalizeCoachApplicationMaterials(app.application_materials, {
          achievements: app.achievements || [],
          caseStudies: app.case_studies || [],
          credentials: app.credentials || [],
        }),
        socialLinks: socialObjectToLinks(app.social_links),
        coachTrack: app.coach_track || '',
        serviceModes: Array.isArray(app.service_modes) ? app.service_modes : [],
        targetStudentLevels: Array.isArray(app.target_student_levels) ? app.target_student_levels : [],
        supportFocus: app.support_focus || '',
        province: app.province || '',
        city: app.city || '',
        county: app.county || '',
        address: app.address || '',
      })
      setReview({ status: app.status, reviewNotes: app.review_notes, reviewedAt: app.reviewed_at })
    } catch (err) {
      Alert.alert('加载失败', errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function toggleArray(field: 'serviceModes' | 'targetStudentLevels', value: string) {
    const list = form[field]
    patch({ [field]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] } as Partial<CoachApplicationForm>)
  }

  function addSpecialty() {
    const value = specialtyDraft.trim()
    if (!value) return
    if (form.specialties.includes(value)) {
      setSpecialtyDraft('')
      return
    }
    patch({ specialties: [...form.specialties, value] })
    setSpecialtyDraft('')
  }

  function openMaterial(category: CoachApplicationMaterialCategory, index?: number) {
    setEditingMaterialIndex(typeof index === 'number' ? index : null)
    setMaterialDraft(typeof index === 'number' ? { ...form.applicationMaterials[index] } : createEmptyCoachMaterial(category))
    setMaterialLink({ label: '', url: '' })
  }

  function saveMaterial() {
    if (!materialDraft?.title.trim()) {
      Alert.alert('请填写材料标题')
      return
    }
    const next = { ...materialDraft, title: materialDraft.title.trim(), summary: materialDraft.summary?.trim() || null, detail: materialDraft.detail?.trim() || null }
    patch({ applicationMaterials: editingMaterialIndex === null ? [...form.applicationMaterials, next] : form.applicationMaterials.map((item, index) => index === editingMaterialIndex ? next : item) })
    setMaterialDraft(null)
    setEditingMaterialIndex(null)
  }

  function addMaterialLink() {
    if (!materialDraft || !materialLink.url.trim()) return
    setMaterialDraft({
      ...materialDraft,
      links: [...materialDraft.links, { id: makeLocalId('link'), label: materialLink.label.trim() || '相关链接', url: materialLink.url.trim() }],
    })
    setMaterialLink({ label: '', url: '' })
  }

  function addSocialLink() {
    if (!socialDraft.url.trim()) return
    patch({ socialLinks: [...form.socialLinks, { name: socialDraft.name, url: socialDraft.url.trim() }] })
    setSocialDraft({ name: '抖音', url: '' })
    setShowSocialEditor(false)
  }

  async function submit() {
    if (!form.name.trim()) {
      Alert.alert('请填写姓名')
      return
    }
    if (!form.coachTrack) {
      Alert.alert('请选择教练层级')
      return
    }
    if (![form.province, form.city, form.county].some(Boolean)) {
      Alert.alert('请填写常住城市')
      return
    }
    setSaving(true)
    try {
      const materials = normalizeCoachApplicationMaterials(form.applicationMaterials)
      const legacy = deriveLegacyFieldsFromMaterials(materials)
      const payload = {
        name: form.name.trim(),
        title: form.title.trim() || null,
        bio: form.bio.trim() || null,
        yearsExperience: form.yearsExperience ? Number(form.yearsExperience) || null : null,
        teachingPhilosophy: form.teachingPhilosophy.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        specialties: form.specialties.length ? form.specialties : null,
        achievements: legacy.achievements.length ? legacy.achievements : null,
        caseStudies: legacy.caseStudies.length ? legacy.caseStudies : null,
        credentials: legacy.credentials.length ? legacy.credentials : null,
        applicationMaterials: materials,
        socialLinks: form.socialLinks.length ? socialLinksToObject(form.socialLinks) : null,
        coachTrack: form.coachTrack,
        serviceModes: form.serviceModes,
        targetStudentLevels: form.targetStudentLevels,
        supportFocus: form.supportFocus.trim() || null,
        province: form.province.trim() || null,
        city: form.city.trim() || null,
        county: form.county.trim() || null,
        address: form.address.trim() || null,
      }
      if (form.id) {
        await apiClient.request('/api/coach/update-coach-application', { method: 'POST', body: { id: form.id, ...payload }, timeoutMs: 15000 })
        Alert.alert('申请已更新')
      } else {
        await apiClient.request('/api/coach/create-coach-application', { method: 'POST', body: payload, timeoutMs: 15000 })
        Alert.alert('申请已提交')
      }
      await load()
    } catch (err) {
      Alert.alert('提交失败', errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const status = coachApplicationStatusMeta(review?.status)

  return (
    <ScreenShell title="申请成为教练" subtitle="提交资料并等待平台审核，通过后可进入教练端。" onBack={navigation.goBack}>
      {loading ? <LoadingState /> : null}
      {!loading ? (
        <>
          {review?.status ? (
            <Card style={local.applicationStatusCard}>
              <Text style={local.applicationStatusLabel}>审核状态</Text>
              <Text style={[local.applicationStatusValue, { color: status.color, backgroundColor: status.bg }]}>{status.text}</Text>
              {review.reviewNotes ? <Text style={local.applicationReviewNotes}>审核意见：{review.reviewNotes}</Text> : null}
            </Card>
          ) : null}

          <Card style={local.applicationSection}>
            <Text style={local.sectionTitle}>教练层级与服务定位</Text>
            <View style={local.trackGrid}>
              {COACH_TRACK_OPTIONS.map((item) => (
                <Pressable key={item.value} onPress={() => patch({ coachTrack: item.value })} style={[local.trackCard, form.coachTrack === item.value && local.trackCardActive]}>
                  <Text style={local.trackTitle}>{item.label}</Text>
                  <Text style={local.trackDesc}>{item.desc}</Text>
                </Pressable>
              ))}
            </View>
            <ChipGroup title="服务方式" options={SERVICE_MODE_OPTIONS} values={form.serviceModes} onToggle={(value) => toggleArray('serviceModes', value)} />
            <ChipGroup title="适合学员阶段" options={TARGET_STUDENT_LEVEL_OPTIONS} values={form.targetStudentLevels} onToggle={(value) => toggleArray('targetStudentLevels', value)} />
            <FormField label="阶段问题聚焦" value={form.supportFocus} onChangeText={(supportFocus) => patch({ supportFocus })} multiline placeholder="例如：新手动作入门、减脂平台期、力量专项突破" />
            <Text style={local.formLabel}>常住城市 *</Text>
            <View style={local.cityGrid}>
              <TextInput value={form.province} onChangeText={(province) => patch({ province })} placeholder="省" placeholderTextColor={colors.textMuted} style={local.cityInput} />
              <TextInput value={form.city} onChangeText={(city) => patch({ city })} placeholder="市" placeholderTextColor={colors.textMuted} style={local.cityInput} />
              <TextInput value={form.county} onChangeText={(county) => patch({ county })} placeholder="区/县" placeholderTextColor={colors.textMuted} style={local.cityInput} />
            </View>
            <FormField label="详细地址" value={form.address} onChangeText={(address) => patch({ address })} />
          </Card>

          <Card style={local.applicationSection}>
            <Text style={local.sectionTitle}>基本信息</Text>
            <FormField label="姓名 *" value={form.name} onChangeText={(name) => patch({ name })} />
            <FormField label="职称" value={form.title} onChangeText={(title) => patch({ title })} placeholder="例如：高级健身教练" />
            <FormField label="简介" value={form.bio} onChangeText={(bio) => patch({ bio })} multiline placeholder="请简要介绍您的专业背景" />
            <FormField label="从业年限" value={form.yearsExperience} onChangeText={(yearsExperience) => patch({ yearsExperience })} keyboardType="numeric" />
            <FormField label="邮箱" value={form.contactEmail} onChangeText={(contactEmail) => patch({ contactEmail })} />
            <FormField label="手机号" value={form.contactPhone} onChangeText={(contactPhone) => patch({ contactPhone })} />
          </Card>

          <Card style={local.applicationSection}>
            <Text style={local.sectionTitle}>专业领域</Text>
            <View style={local.applicationTags}>
              {form.specialties.map((item) => <RemovableChip key={item} label={item} onRemove={() => patch({ specialties: form.specialties.filter((value) => value !== item) })} />)}
            </View>
            <View style={local.inlineAddRow}>
              <TextInput value={specialtyDraft} onChangeText={setSpecialtyDraft} placeholder="输入专业领域" placeholderTextColor={colors.textMuted} style={local.inlineInput} onSubmitEditing={addSpecialty} />
              <Pressable onPress={addSpecialty} style={local.inlineAddButton}><Text style={local.inlineAddText}>添加</Text></Pressable>
            </View>
          </Card>

          <Card style={local.applicationSection}>
            <Text style={local.sectionTitle}>教学理念</Text>
            <FormField label="教学理念和方法" value={form.teachingPhilosophy} onChangeText={(teachingPhilosophy) => patch({ teachingPhilosophy })} multiline />
          </Card>

          <Card style={local.applicationSection}>
            <Text style={local.sectionTitle}>证明材料</Text>
            <Text style={local.sectionDesc}>成就、案例、证书、图片和视频链接都可以放在这里。关闭公开后仅审核可见。</Text>
            <View style={local.materialTypeRow}>
              {MATERIAL_CATEGORY_OPTIONS.map((item) => <Pressable key={item.value} onPress={() => openMaterial(item.value)} style={local.materialTypeChip}><Text style={local.materialTypeText}>+ {item.label}</Text></Pressable>)}
            </View>
            {form.applicationMaterials.length === 0 ? <Text style={local.materialEmpty}>还没有添加材料，建议至少补充 1 个代表案例和 1 个证书或视频链接。</Text> : null}
            {form.applicationMaterials.map((item, index) => (
              <View key={item.id} style={local.materialCard}>
                <View style={local.materialTop}>
                  <Text style={local.materialCategory}>{MATERIAL_CATEGORY_OPTIONS.find((option) => option.value === item.category)?.label || '材料'}</Text>
                  <Text style={[local.materialPublic, item.isPublic ? local.materialPublicOn : local.materialPublicOff]}>{item.isPublic ? '主页公开' : '仅审核'}</Text>
                </View>
                <Text style={local.materialTitle}>{item.title}</Text>
                {item.summary ? <Text style={local.materialSummary}>{item.summary}</Text> : null}
                <Text style={local.materialMeta}>{item.media.length} 个媒体 · {item.links.length} 个链接</Text>
                <View style={local.materialActions}>
                  <Pressable onPress={() => openMaterial(item.category, index)}><Text style={local.materialActionText}>编辑</Text></Pressable>
                  <Pressable onPress={() => patch({ applicationMaterials: form.applicationMaterials.filter((_, i) => i !== index) })}><Text style={local.materialDeleteText}>删除</Text></Pressable>
                </View>
              </View>
            ))}
            {materialDraft ? (
              <View style={local.materialEditor}>
                <ChipGroup title="材料类型" options={MATERIAL_CATEGORY_OPTIONS} values={[materialDraft.category]} single onToggle={(category) => setMaterialDraft({ ...materialDraft, category: category as CoachApplicationMaterialCategory })} />
                <FormField label="材料标题" value={materialDraft.title} onChangeText={(title) => setMaterialDraft({ ...materialDraft, title })} />
                <FormField label="一句话摘要" value={materialDraft.summary || ''} onChangeText={(summary) => setMaterialDraft({ ...materialDraft, summary })} />
                <FormField label="详细说明" value={materialDraft.detail || ''} onChangeText={(detail) => setMaterialDraft({ ...materialDraft, detail })} multiline />
                <Pressable onPress={() => setMaterialDraft({ ...materialDraft, isPublic: !materialDraft.isPublic })} style={local.publicToggle}>
                  <Text style={local.publicToggleText}>公开展示到教练主页</Text>
                  <Text style={[local.publicTogglePill, materialDraft.isPublic && local.publicTogglePillOn]}>{materialDraft.isPublic ? '开启' : '关闭'}</Text>
                </Pressable>
                <View style={local.materialLinks}>
                  {materialDraft.links.map((link) => <RemovableChip key={link.id} label={link.label || '相关链接'} onRemove={() => setMaterialDraft({ ...materialDraft, links: materialDraft.links.filter((item) => item.id !== link.id) })} />)}
                </View>
                <View style={local.inlineAddRow}>
                  <TextInput value={materialLink.label} onChangeText={(label) => setMaterialLink((prev) => ({ ...prev, label }))} placeholder="链接名" placeholderTextColor={colors.textMuted} style={local.inlineInputSmall} />
                  <TextInput value={materialLink.url} onChangeText={(url) => setMaterialLink((prev) => ({ ...prev, url }))} placeholder="https://..." placeholderTextColor={colors.textMuted} style={local.inlineInput} autoCapitalize="none" />
                </View>
                <SolidButton label="添加链接" variant="secondary" onPress={addMaterialLink} disabled={!materialLink.url.trim()} />
                <View style={local.modalActions}>
                  <SolidButton label="取消" variant="secondary" onPress={() => { setMaterialDraft(null); setEditingMaterialIndex(null) }} />
                  <SolidButton label="保存材料" onPress={saveMaterial} />
                </View>
              </View>
            ) : null}
          </Card>

          <Card style={local.applicationSection}>
            <Text style={local.sectionTitle}>社交媒体</Text>
            {form.socialLinks.map((item, index) => (
              <View key={`${item.name}-${index}`} style={local.socialRow}>
                <View style={{ flex: 1 }}>
                  <Text style={local.friendName}>{item.name}</Text>
                  <Text style={local.friendMeta}>{item.url}</Text>
                </View>
                <Pressable onPress={() => patch({ socialLinks: form.socialLinks.filter((_, i) => i !== index) })}><Text style={local.materialDeleteText}>删除</Text></Pressable>
              </View>
            ))}
            {showSocialEditor ? (
              <View style={local.socialEditor}>
                <ChipGroup title="平台" options={SOCIAL_PLATFORM_OPTIONS.map((item) => ({ value: item, label: item }))} values={[socialDraft.name]} single onToggle={(name) => setSocialDraft((prev) => ({ ...prev, name }))} />
                <FormField label="链接地址" value={socialDraft.url} onChangeText={(url) => setSocialDraft((prev) => ({ ...prev, url }))} />
                <View style={local.modalActions}>
                  <SolidButton label="取消" variant="secondary" onPress={() => setShowSocialEditor(false)} />
                  <SolidButton label="保存" disabled={!socialDraft.url.trim()} onPress={addSocialLink} />
                </View>
              </View>
            ) : <SolidButton label="添加社交媒体" variant="secondary" onPress={() => setShowSocialEditor(true)} />}
          </Card>

          <SolidButton label={review?.status === 'pending' ? '更新申请' : '提交申请'} loading={saving} onPress={submit} />
        </>
      ) : null}
    </ScreenShell>
  )
}

const FEEDBACK_CATEGORIES = [
  { value: 'bug', label: '故障问题' },
  { value: 'suggestion', label: '功能建议' },
  { value: 'experience', label: '体验反馈' },
  { value: 'other', label: '其他' },
] as const

const FEEDBACK_FAQS = [
  '如何创建训练计划？',
  '视频上传失败怎么办？',
  '如何添加学员？',
  '订阅功能如何使用？',
  '视频播放卡顿',
  '如何修改个人信息？',
]

export function FeedbackScreen() {
  const navigation = useNavigationAny()
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<'bug' | 'suggestion' | 'experience' | 'other'>('bug')
  const [relatedQuestion, setRelatedQuestion] = useState('')
  const [contact, setContact] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)

  async function chooseScreenshots() {
    if (imageUrls.length >= 4) {
      Alert.alert('截图已满', '每条反馈最多附加 4 张截图。')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.82,
      allowsMultipleSelection: true,
      selectionLimit: 4 - imageUrls.length,
    })
    if (result.canceled) return
    setUploading(true)
    try {
      const token = await getStoredToken()
      for (const [index, asset] of result.assets.entries()) {
        if (asset.fileSize && asset.fileSize > 8 * 1024 * 1024) throw new Error(`第 ${index + 1} 张截图超过 8MB`)
        const type = asset.mimeType || 'image/jpeg'
        const ext = type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
        const formData = new FormData()
        formData.append('file', { uri: asset.uri, name: asset.fileName || `feedback-${Date.now()}-${index}.${ext}`, type } as any)
        const response = await fetch(`${API_BASE_URL}/api/feedback/upload-image`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: formData,
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.success || !payload?.data?.url) throw new Error(payload?.message || '截图上传失败')
        setImageUrls((prev) => [...prev, String(payload.data.url)].slice(0, 4))
      }
    } catch (error) {
      Alert.alert('截图上传失败', errorMessage(error))
    } finally {
      setUploading(false)
    }
  }

  function selectQuestion(question: string) {
    setRelatedQuestion(question)
    setContent((current) => current.trim() ? current : `${question}\n\n`)
  }

  async function submit() {
    const trimmed = content.trim()
    if (!trimmed) {
      Alert.alert('请填写反馈内容')
      return
    }
    if (trimmed.length > 2000) {
      Alert.alert('反馈内容过长', '请控制在 2000 字以内。')
      return
    }
    setLoading(true)
    try {
      await safeRequest('/api/feedback/submit', {
        body: {
          content: trimmed,
          relatedQuestion: relatedQuestion || undefined,
          category,
          contact: contact.trim(),
          pagePath: 'mobile://me/feedback',
          appVersion: APP_VERSION,
          clientInfo: {
            client: 'coachlink-mobile',
            platform: Platform.OS,
            platformVersion: String(Platform.Version),
          },
          recentRequests: [],
          imageUrls,
        },
      })
      Alert.alert('已提交', '感谢反馈，我们已同时记录 App 版本和系统信息，便于排查。')
      navigation.goBack()
    } catch (error) {
      Alert.alert('提交失败', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }
  return (
    <ScreenShell title="意见反馈" subtitle="描述越具体，问题通常越容易复现和解决。" onBack={navigation.goBack}>
      <Card>
        <Text style={local.feedbackSectionTitle}>反馈类型</Text>
        <View style={local.feedbackChipGrid}>
          {FEEDBACK_CATEGORIES.map((item) => (
            <Pressable key={item.value} onPress={() => setCategory(item.value)} style={[local.feedbackChip, category === item.value && local.feedbackChipActive]}>
              <Text style={[local.feedbackChipText, category === item.value && local.feedbackChipTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={local.feedbackSectionTitle}>常见问题</Text>
        <View style={local.feedbackFaqList}>
          {FEEDBACK_FAQS.map((question) => (
            <Pressable key={question} onPress={() => selectQuestion(question)} style={[local.feedbackFaq, relatedQuestion === question && local.feedbackFaqActive]}>
              <Text style={[local.feedbackFaqText, relatedQuestion === question && local.feedbackFaqTextActive]}>{question}</Text>
              <IconFont name="icon-right-arrow" color={relatedQuestion === question ? colors.brand : colors.textMuted} size={14} />
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        {relatedQuestion ? (
          <View style={local.feedbackSelectedRow}>
            <Text style={local.feedbackSelectedText}>已关联：{relatedQuestion}</Text>
            <Pressable onPress={() => setRelatedQuestion('')}><Text style={local.feedbackClearText}>取消关联</Text></Pressable>
          </View>
        ) : null}
        <Text style={local.feedbackSectionTitle}>反馈内容（必填）</Text>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="请写清楚发生了什么、你原本想完成什么，以及是否可以稳定复现…"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={2000}
          textAlignVertical="top"
          style={local.feedbackInput}
        />
        <Text style={local.feedbackCounter}>{content.length} / 2000</Text>
        <TextInput value={contact} onChangeText={setContact} placeholder="联系方式（可选，手机号/邮箱/微信）" placeholderTextColor={colors.textMuted} maxLength={200} style={local.feedbackContactInput} />
      </Card>

      <Card>
        <View style={local.feedbackAttachmentHeader}>
          <View style={local.flexOne}><Text style={local.feedbackSectionTitle}>问题截图（可选）</Text><Text style={local.feedbackHelper}>最多 4 张，单张不超过 8MB；已上传的截图只用于处理本次反馈。</Text></View>
          <Text style={local.feedbackAttachmentCount}>{imageUrls.length}/4</Text>
        </View>
        {imageUrls.length > 0 ? (
          <View style={local.feedbackImageGrid}>
            {imageUrls.map((url, index) => (
              <View key={url} style={local.feedbackImageWrap}>
                <Image source={{ uri: url }} style={local.feedbackImage} />
                <Pressable accessibilityLabel={`删除第 ${index + 1} 张截图`} onPress={() => setImageUrls((prev) => prev.filter((_, itemIndex) => itemIndex !== index))} style={local.feedbackImageRemove}><Text style={local.feedbackImageRemoveText}>×</Text></Pressable>
              </View>
            ))}
          </View>
        ) : null}
        <SolidButton label={uploading ? '截图上传中…' : '选择截图'} variant="secondary" loading={uploading} disabled={uploading || imageUrls.length >= 4} onPress={chooseScreenshots} />
      </Card>

      <Card>
        <Text style={local.feedbackSectionTitle}>自动附带的诊断信息</Text>
        <Text style={local.feedbackHelper}>CoachLink App {APP_VERSION} · {Platform.OS} {String(Platform.Version)}</Text>
        <Text style={local.feedbackHelper}>不包含密码、验证码或训练视频；提交前可直接看到我们附带了什么。</Text>
        <SolidButton label="提交反馈" loading={loading} disabled={!content.trim() || uploading} onPress={submit} />
      </Card>
    </ScreenShell>
  )
}

export function LegalDocsScreen() {
  const navigation = useNavigationAny()
  return (
    <ScreenShell title="法律与说明" subtitle="协议、隐私、免责声明和平台说明。" onBack={navigation.goBack}>
      <Card>
        <MenuRow label="关于我们" icon="icon-knowledge" iconBg="#5C8DFF" onPress={() => navigation.navigate('About')} />
        <MenuRow label="联系我们" icon="icon-messages" iconBg="#29C3A3" onPress={() => navigation.navigate('Contact')} />
        <MenuRow label="免责声明" icon="icon-wenhao" iconBg="#FFA940" onPress={() => navigation.navigate('Disclaimer')} />
        <MenuRow label="用户服务协议" icon="icon-jhk" iconBg="#CF6D4E" onPress={() => navigation.navigate('Terms')} />
        <MenuRow label="隐私政策" icon="icon-account-settings-variant" iconBg="#722ed1" onPress={() => navigation.navigate('Privacy')} />
        <MenuRow label="平台协议" icon="icon-shenqingquanxian" iconBg="#5C8DFF" onPress={() => navigation.navigate('PlatformAgreement')} />
        <MenuRow label="消费者保障" icon="icon-vips" iconBg="#29C3A3" onPress={() => navigation.navigate('ProtectionOfConsumer')} />
      </Card>
    </ScreenShell>
  )
}

export function UserHomeScreen() {
  const navigation = useNavigationAny()
  const { user } = useAuth()
  return (
    <ScreenShell title="我的主页" subtitle="APP 端个人主页承接页。" onBack={navigation.goBack}>
      <Card>
        <View style={local.center}>
          <InlineAvatar uri={user?.avatar_url || user?.avatar} label={user?.phone || user?.id} size={96} />
          <Text style={local.profileName}>{asText(user?.phone || user?.email, 'CoachLink 用户')}</Text>
          <Text style={local.profileSubtitle}>公开主页、训练档案和个人展示信息会在这里沉淀。</Text>
        </View>
        <SolidButton label="编辑资料" onPress={() => navigation.navigate('ProfileEdit')} />
        <SolidButton label="查看资料详情" variant="secondary" onPress={() => navigation.navigate('ProfileDetail')} />
      </Card>
    </ScreenShell>
  )
}

export function LegalDocScreen({ doc }: { doc: keyof typeof legalDocs }) {
  const navigation = useNavigationAny()
  const content = legalDocs[doc]
  return (
    <ScreenShell title={content.title} onBack={navigation.goBack}>
      <Card>
        {content.body.map((line) => <Text key={line} style={local.docText}>{line}</Text>)}
      </Card>
    </ScreenShell>
  )
}

export function AboutScreen() {
  return <LegalDocScreen doc="About" />
}

export function ContactScreen() {
  return <LegalDocScreen doc="Contact" />
}

export function DisclaimerScreen() {
  return <LegalDocScreen doc="Disclaimer" />
}

export function TermsScreen() {
  return <LegalDocScreen doc="Terms" />
}

export function PrivacyScreen() {
  return <LegalDocScreen doc="Privacy" />
}

export function PlatformAgreementScreen() {
  return <LegalDocScreen doc="PlatformAgreement" />
}

export function ProtectionOfConsumerScreen() {
  return <LegalDocScreen doc="ProtectionOfConsumer" />
}

function SimpleInfoScreen({ title, subtitle, icon, message }: { title: string; subtitle?: string; icon: IconFontName; message: string }) {
  const navigation = useNavigationAny()
  return (
    <ScreenShell title={title} subtitle={subtitle} onBack={navigation.goBack}>
      <EmptyState title={title} desc={message} icon={icon} />
    </ScreenShell>
  )
}

function DataListInline({ path, method = 'POST', body, empty }: { path: string; method?: 'GET' | 'POST'; body?: unknown; empty: string }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    safeRequest(path, { method, body }).then(setData).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false))
  }, [path])
  if (loading) return <LoadingState />
  if (error) return <EmptyState title="加载失败" desc={error} />
  if (!data || (Array.isArray(data) && data.length === 0)) return <EmptyState title={empty} />
  return (
    <Card>
      <Text style={local.itemMeta}>{JSON.stringify(data, null, 2).slice(0, 1200)}</Text>
    </Card>
  )
}

function FitnessFieldModal({
  field,
  value,
  list,
  saving,
  onChangeValue,
  onChangeList,
  onClose,
  onSave,
}: {
  field: FitnessFieldKey | null
  value: string
  list: string[]
  saving: boolean
  onChangeValue: (value: string) => void
  onChangeList: (value: string[]) => void
  onClose: () => void
  onSave: (value?: string | string[]) => void
}) {
  if (!field) return null
  const title = `编辑${FITNESS_FIELD_LABELS[field]}`
  const isMulti = field === 'fitness_goals' || field === 'target_body_parts' || field === 'equipment'
  const isPicker = field === 'gender' || field === 'fitness_level' || field === 'weekly_frequency' || field === 'session_duration'
  const options =
    field === 'fitness_goals'
      ? FITNESS_GOAL_OPTIONS.map((item) => ({ label: item, value: item }))
      : field === 'target_body_parts'
        ? TARGET_BODY_PART_OPTIONS.map((item) => ({ label: item, value: item }))
        : field === 'equipment'
          ? EQUIPMENT_OPTIONS.map((item) => ({ label: item, value: item }))
          : field === 'gender'
            ? GENDER_OPTIONS
            : field === 'fitness_level'
              ? FITNESS_LEVEL_OPTIONS
              : field === 'weekly_frequency'
                ? WEEKLY_FREQUENCY_OPTIONS.map((item) => ({ label: item >= 6 ? '6 天及以上' : `${item} 天`, value: String(item) }))
                : DURATION_OPTIONS.map((item) => ({ label: `${item} 分钟`, value: String(item) }))

  function toggle(item: string) {
    if (list.includes(item)) {
      onChangeList(list.filter((value) => value !== item))
      return
    }
    if (field === 'fitness_goals' && list.length >= 3) {
      Alert.alert('最多选择 3 个健身目标')
      return
    }
    onChangeList([...list, item])
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={local.modalMask}>
        <View style={local.modalCard}>
          <Text style={local.modalTitle}>{title}</Text>
          {isMulti ? (
            <>
              <Text style={local.modalHint}>可多选，再点一次取消</Text>
              <View style={local.modalChipGrid}>
                {options.map((option) => (
                  <Pressable key={option.value} onPress={() => toggle(option.value)} style={[local.modalChip, list.includes(option.value) && local.modalChipActive]}>
                    <Text style={[local.modalChipText, list.includes(option.value) && local.modalChipTextActive]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : isPicker ? (
            <View style={local.modalChipGrid}>
              {options.map((option) => (
                <Pressable key={option.value} onPress={() => onChangeValue(option.value)} style={[local.modalChip, value === option.value && local.modalChipActive]}>
                  <Text style={[local.modalChipText, value === option.value && local.modalChipTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <TextInput
              value={value}
              onChangeText={onChangeValue}
              placeholder={`请输入${FITNESS_FIELD_LABELS[field]}`}
              placeholderTextColor={colors.textMuted}
              keyboardType={field === 'height' || field === 'weight' ? 'numeric' : 'default'}
              style={local.modalInput}
            />
          )}
          <View style={local.modalActions}>
            <SolidButton label="取消" variant="secondary" onPress={onClose} />
            <SolidButton label={saving ? '保存中...' : '保存'} loading={saving} onPress={() => onSave(isMulti ? list : value)} />
          </View>
        </View>
      </View>
    </Modal>
  )
}

function InfoLine({ label, value }: { label: string; value: unknown }) {
  return (
    <View style={local.infoLine}>
      <Text style={local.infoLabel}>{label}</Text>
      <Text style={local.infoValue}>{asText(value)}</Text>
    </View>
  )
}

function FriendAvatar({ uri, name, toneIndex = 0, square = false }: { uri?: string; name?: string | null; toneIndex?: number; square?: boolean }) {
  if (uri) {
    return <Image source={{ uri }} style={[local.friendAvatar, square && local.friendAvatarSquare]} />
  }
  const tones = [local.friendAvatarPeach, local.friendAvatarBlue, local.friendAvatarMint]
  return (
    <View style={[local.friendAvatar, square && local.friendAvatarSquare, tones[toneIndex % tones.length]]}>
      <Text style={local.friendAvatarText}>{String(name || 'U').charAt(0).toUpperCase()}</Text>
    </View>
  )
}

function ChipGroup({
  title,
  options,
  values,
  onToggle,
  single,
}: {
  title: string
  options: Array<{ value: string; label: string }>
  values: string[]
  onToggle: (value: string) => void
  single?: boolean
}) {
  return (
    <View style={local.chipGroup}>
      <Text style={local.formLabel}>{title}</Text>
      <View style={local.choiceChipList}>
        {options.map((option) => {
          const active = values.includes(option.value)
          return (
            <Pressable key={option.value} onPress={() => { if (!single || !active) onToggle(option.value) }} style={[local.choiceChip, active && local.choiceChipActive]}>
              <Text style={[local.choiceChipText, active && local.choiceChipTextActive]}>{option.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View style={local.removableChip}>
      <Text style={local.removableChipText}>{label}</Text>
      <Pressable onPress={onRemove}><Text style={local.removableChipRemove}>x</Text></Pressable>
    </View>
  )
}

function RankingMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={local.rankingMetaBox}>
      <Text style={local.rankingMetaValue} numberOfLines={1}>{value}</Text>
      <Text style={local.rankingMetaLabel}>{label}</Text>
    </View>
  )
}

function LeaderboardEntryCard({ entry, index, rankByField }: { entry: LeaderboardEntry; index: number; rankByField?: string | null }) {
  const profile = entry.userProfile || {}
  const formData = Array.isArray(entry.form_data) ? entry.form_data : []
  const meta = formData.filter((item) => item.name !== rankByField && !(typeof item.userInput === 'string' && item.userInput.trim().startsWith('http'))).slice(0, 3)
  const links = [
    ...formData
      .map((item) => (typeof item.userInput === 'string' ? item.userInput.trim() : ''))
      .filter((value) => value.startsWith('http')),
    entry.evidence_url?.trim() || '',
  ].filter(Boolean)
  const rankStyle = index === 0 ? local.entryRankGold : index === 1 ? local.entryRankSilver : index === 2 ? local.entryRankBronze : null

  return (
    <View style={local.entryCard}>
      <View style={[local.entryRank, rankStyle]}>
        <Text style={local.entryRankText}>{index + 1}</Text>
      </View>
      <InlineAvatar uri={profile.avatar || undefined} label={profile.name || '未知用户'} size={42} />
      <View style={local.entryBody}>
        <View style={local.entryTop}>
          <Text style={local.entryName} numberOfLines={1}>{profile.name || '未知用户'}</Text>
          <Text style={local.entryScore}>{formatScore(extractEntryCoreValue(entry, rankByField))}</Text>
        </View>
        <View style={local.entryMetaWrap}>
          {meta.map((item) => <Text key={item.name} style={local.entryMeta}>{item.name}: {asText(item.userInput, '-')}</Text>)}
          {links.length > 0 ? <Text style={local.entryMeta}>VIDEO: {links.length} 个</Text> : null}
        </View>
        <Text style={local.entryTime}>{formatTime(entry.created_at || undefined)}</Text>
      </View>
    </View>
  )
}

function RankingSubmissionModal({
  visible,
  templateId,
  formSchema,
  rankByField,
  needReview,
  onClose,
  onSuccess,
}: {
  visible: boolean
  templateId: string
  formSchema: LeaderboardFormInput[]
  rankByField: string
  needReview: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!visible) return
    const next: Record<string, string> = {}
    formSchema.forEach((field) => { next[field.name] = '' })
    setValues(next)
  }, [visible, formSchema])

  function setField(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  async function submit() {
    if (!templateId) return
    for (const field of formSchema) {
      const value = values[field.name]
      if (field.required && (!value || !value.trim())) {
        Alert.alert('请补全信息', `${field.name} 是必填项`)
        return
      }
      if (field.type === 'number' && value && Number.isNaN(Number(value))) {
        Alert.alert('格式错误', `${field.name} 需要填写数字`)
        return
      }
      if (field.type === 'video' && value && !isValidHttpUrl(value)) {
        Alert.alert('格式错误', '请输入有效的视频链接')
        return
      }
    }
    const scoreValue = values[rankByField]
    if (!scoreValue || Number.isNaN(Number(scoreValue))) {
      Alert.alert('请补全信息', `${rankByField} 是排名数值，不能为空`)
      return
    }
    setLoading(true)
    try {
      const formatted = formSchema.map((field) => ({
        ...field,
        userInput: field.type === 'number' ? (parseFloat(values[field.name]) || 0) : (values[field.name] ?? ''),
      }))
      const firstVideo = formSchema.find((field) => field.type === 'video')
      await apiClient.request('/api/ranking/create-entry', {
        method: 'POST',
        body: {
          template_id: templateId,
          form_data: formatted,
          score: parseFloat(scoreValue) || 0,
          evidence_url: firstVideo ? (values[firstVideo.name] || null) : null,
          status: 'pending',
        },
        timeoutMs: 12000,
      })
      Alert.alert(needReview ? '已提交审核' : '提交成功')
      onSuccess()
    } catch (err) {
      Alert.alert('提交失败', errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={local.modalMask}>
        <View style={local.rankingSubmitCard}>
          <Text style={local.modalTitle}>提交挑战成绩</Text>
          <ScrollView style={local.rankingSubmitScroll} keyboardShouldPersistTaps="handled">
            {formSchema.length === 0 ? <Text style={local.rankingMuted}>该榜单暂无提交表单配置。</Text> : null}
            {formSchema.map((field) => (
              <View key={field.name} style={local.submitField}>
                <Text style={local.submitLabel}>{field.name}{field.required ? ' *' : ''}</Text>
                {field.type === 'option' ? (
                  <View style={local.submitOptions}>
                    {(field.options || []).map((option) => (
                      <Pressable key={option} onPress={() => setField(field.name, option)} style={[local.submitOption, values[field.name] === option && local.submitOptionActive]}>
                        <Text style={[local.submitOptionText, values[field.name] === option && local.submitOptionTextActive]}>{option}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <TextInput
                    value={values[field.name] || ''}
                    onChangeText={(value) => setField(field.name, value)}
                    placeholder={field.type === 'video' ? '粘贴视频链接...' : field.type === 'number' ? '0.00' : `输入${field.name}`}
                    placeholderTextColor={colors.textMuted}
                    keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
                    autoCapitalize="none"
                    style={local.submitInput}
                  />
                )}
              </View>
            ))}
          </ScrollView>
          <View style={local.modalActions}>
            <SolidButton label="取消" variant="secondary" onPress={onClose} />
            <SolidButton label={needReview ? '提交审核' : '立即提交'} loading={loading} disabled={formSchema.length === 0} onPress={submit} />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const local = StyleSheet.create({
  profileCard: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    shadowOpacity: 0,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  profileName: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '900',
  },
  profileSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  profileLink: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  roundIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  statUnit: {
    color: colors.textMuted,
    fontSize: 11,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  noticeDesc: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  settingsSectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  settingsSummary: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
  settingsSummaryIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
  },
  settingsSummaryMain: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  settingsSummaryTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  settingsHelp: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  settingsRoleBadge: {
    minHeight: 32,
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.brandSoft,
  },
  settingsRoleBadgeText: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '900',
  },
  settingsFeedback: {
    color: colors.success,
    fontSize: 13,
    lineHeight: 20,
  },
  dangerZone: {
    borderColor: '#F3C7C5',
    backgroundColor: '#FFF8F7',
  },
  dangerTitle: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '900',
  },
  dangerText: {
    color: '#8C4744',
    fontSize: 13,
    lineHeight: 20,
  },
  dangerToken: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.danger,
    backgroundColor: '#FDECEC',
    fontSize: 15,
    fontWeight: '900',
  },
  logoutRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  logoutText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '900',
  },
  itemBlock: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  itemMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 4,
  },
  actionListItem: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionListMain: {
    flex: 1,
    minWidth: 0,
  },
  actionDetailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actionDetailTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 30,
  },
  actionCardName: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 24,
  },
  detailSection: {
    gap: spacing.xs,
  },
  typePill: {
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.brandSoft,
    color: colors.brand,
    fontSize: 12,
    fontWeight: '900',
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actionTag: {
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.surfaceMuted,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  videoUrl: {
    color: colors.brand,
    fontSize: 13,
    lineHeight: 20,
  },
  coachHint: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  flexOne: {
    flex: 1,
    minWidth: 0,
  },
  emptyInline: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  metricValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
  fitnessPreview: {
    backgroundColor: colors.surface,
  },
  fitnessAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fitnessPreviewText: {
    flex: 1,
    minWidth: 0,
  },
  fitnessTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  fitnessPreviewTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  fitnessCompletionBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    backgroundColor: colors.brandSoft,
  },
  fitnessCompletionBadgeDone: {
    backgroundColor: '#EAF7F1',
  },
  fitnessCompletionBadgeText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '800',
  },
  fitnessCompletionBadgeTextDone: {
    color: '#2F7D68',
  },
  fitnessPreviewDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  fitnessCompletionHint: {
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: '#FFF8F5',
  },
  fitnessCompletionHintText: {
    color: '#8A4B38',
    fontSize: 13,
    lineHeight: 20,
  },
  fitnessFieldList: {
    paddingVertical: 0,
  },
  fitnessFieldRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  fitnessFieldMain: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  fitnessFieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  fitnessFieldValue: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  fitnessFieldEmpty: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  modalMask: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(18, 18, 18, 0.38)',
  },
  modalCard: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  modalHint: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  modalInput: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    backgroundColor: '#F9FAFB',
    fontSize: 16,
  },
  modalChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  modalChip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  modalChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  modalChipTextActive: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  e1rmSelectorCard: {
    gap: spacing.xs,
  },
  e1rmActionList: {
    gap: spacing.xs,
    paddingRight: spacing.sm,
  },
  e1rmActionChip: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: colors.border,
  },
  e1rmActionChipActive: {
    backgroundColor: '#EAF3FF',
    borderColor: '#8FD3FE',
  },
  e1rmActionText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  e1rmActionTextActive: {
    color: '#1677C8',
  },
  e1rmChartCard: {
    gap: spacing.sm,
  },
  e1rmStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  e1rmBars: {
    minHeight: 184,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  e1rmBarItem: {
    flex: 1,
    minWidth: 34,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  e1rmBarValue: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
  },
  e1rmBar: {
    width: '72%',
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    backgroundColor: '#8FD3FE',
  },
  e1rmBarPr: {
    backgroundColor: colors.brand,
  },
  e1rmBarDate: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  prListCard: {
    gap: spacing.xs,
  },
  prRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  prAction: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  prValue: {
    color: '#1677C8',
    fontSize: 18,
    fontWeight: '900',
  },
  trainingHistoryHead: {
    alignItems: 'flex-end',
  },
  calendarCard: {
    gap: spacing.sm,
  },
  calendarNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarMonth: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  calendarNavButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  calendarNavButton: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF3FF',
  },
  calendarNavText: {
    color: '#1677C8',
    fontSize: 24,
    fontWeight: '900',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  weekdayCell: {
    width: '13.2%',
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  dayCell: {
    width: '13.2%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  dayCellEmpty: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  dayCellSelected: {
    backgroundColor: '#EAF3FF',
    borderColor: '#1677C8',
  },
  dayNum: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  daySessions: {
    color: '#1677C8',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 2,
  },
  historyStatsCard: {
    gap: spacing.xs,
  },
  historyStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  historyStatItem: {
    flex: 1,
  },
  historyDetailCard: {
    gap: spacing.xs,
  },
  historyItem: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  historyItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  historyItemTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  historyTags: {
    alignItems: 'flex-end',
    gap: 4,
  },
  historyTagSource: {
    overflow: 'hidden',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    color: '#1677C8',
    backgroundColor: '#EAF3FF',
    fontSize: 11,
    fontWeight: '900',
  },
  historyTagSets: {
    overflow: 'hidden',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    color: colors.textSecondary,
    backgroundColor: '#F5F5F5',
    fontSize: 11,
    fontWeight: '900',
  },
  historyExpand: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  actionSummaryRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actionSummaryName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  center: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  infoLabel: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  docText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 26,
  },
  membershipStatus: {
    backgroundColor: colors.brandSoft,
    borderColor: '#E9C7B7',
  },
  membershipTier: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  membershipHero: {
    gap: spacing.sm,
  },
  membershipHeroHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  membershipHeroTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  membershipHeroSub: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  membershipMark: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  membershipMarkText: {
    fontSize: 22,
    fontWeight: '900',
  },
  membershipStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tierPill: {
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 13,
    fontWeight: '900',
  },
  tierToneNeutral: {
    color: '#6D6258',
    backgroundColor: '#F1EDE8',
  },
  tierToneInfo: {
    color: '#315EA8',
    backgroundColor: '#E8F0FF',
  },
  tierTonePremium: {
    color: '#A45A18',
    backgroundColor: '#F9EAD6',
  },
  tierToneTrial: {
    color: '#B65050',
    backgroundColor: '#FDECEC',
  },
  statusDate: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  upgradePanel: {
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: '#F7F3EE',
    borderWidth: 1,
    borderColor: '#EEE3D8',
    gap: spacing.sm,
  },
  quotaCard: {
    gap: spacing.xs,
  },
  quotaHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  quotaTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  quotaBadge: {
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    color: colors.textSecondary,
    backgroundColor: '#F1EDE8',
    fontSize: 11,
    fontWeight: '900',
  },
  quotaValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  quotaValue: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '900',
  },
  quotaUnit: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: '#EFE7DD',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  referralCard: {
    backgroundColor: '#FFF3E8',
    borderColor: '#F1D5BF',
  },
  referralTitle: {
    color: '#7C4327',
    fontSize: 18,
    fontWeight: '900',
  },
  referralText: {
    color: '#9B674A',
    fontSize: 14,
    lineHeight: 22,
  },
  referralCodeCard: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  referralCodeLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '800',
  },
  referralCodeBox: {
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  referralCodeText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 2,
  },
  inviteLinkBox: {
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  inviteLinkLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  inviteLinkText: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 18,
  },
  referralActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  rewardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  rewardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
  },
  rewardValue: {
    color: '#F97316',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 4,
  },
  referralStatsGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  referralStatItem: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: '#F9FAFB',
  },
  referralStatValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  referralStatLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  segmented: {
    minHeight: 48,
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    gap: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: colors.brand,
  },
  planCard: {
    gap: spacing.sm,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  planName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  planBadge: {
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    color: '#FFFFFF',
    backgroundColor: colors.brand,
    fontSize: 11,
    fontWeight: '900',
  },
  planMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  planPrice: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceSymbol: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: '900',
  },
  priceAmount: {
    color: colors.brand,
    fontSize: 32,
    fontWeight: '900',
  },
  priceUnit: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  featureList: {
    gap: spacing.xs,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  featureIcon: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  featureText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  roleNotice: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  roleNoticeTitle: {
    color: '#9A3412',
    fontSize: 14,
    fontWeight: '900',
  },
  roleNoticeDesc: {
    color: '#7C2D12',
    fontSize: 12,
    lineHeight: 20,
  },
  cartItem: {
    gap: spacing.xs,
  },
  tierBadge: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    color: '#3B82F6',
    backgroundColor: '#DBEAFE',
    fontSize: 11,
    fontWeight: '900',
  },
  priceLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: spacing.xs,
  },
  priceLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  priceValue: {
    color: colors.brand,
    fontSize: 20,
    fontWeight: '900',
  },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  summaryTotal: {
    color: colors.brand,
    fontSize: 20,
    fontWeight: '900',
  },
  refreshLink: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseItem: {
    gap: spacing.xs,
  },
  purchaseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  purchaseName: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  planStatusBadge: {
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '900',
  },
  timeText: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  loadedAll: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  myCoachHeader: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  myCoachHeaderTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  myCoachHeaderSub: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  discoveryButton: {
    minHeight: 40,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  discoveryButtonText: {
    color: '#F97316',
    fontSize: 13,
    fontWeight: '900',
  },
  chatListCard: {
    gap: spacing.xs,
  },
  chatBubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  chatBubbleRowMine: {
    justifyContent: 'flex-end',
  },
  chatBubble: {
    maxWidth: '82%',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: '#F7F3EE',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chatBubbleMine: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  chatSender: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  chatContent: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  chatContentMine: {
    color: '#FFFFFF',
  },
  chatTime: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  chatTimeMine: {
    color: 'rgba(255,255,255,0.72)',
  },
  coachSkeletonList: {
    gap: spacing.sm,
  },
  coachSkeletonCard: {
    minHeight: 112,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  coachSkeletonAvatar: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  coachSkeletonContent: {
    flex: 1,
    gap: spacing.xs,
  },
  coachSkeletonLine: {
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  coachCardList: {
    gap: spacing.sm,
  },
  coachServiceCard: {
    gap: spacing.sm,
  },
  coachCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  coachIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  coachAvatarWrap: {
    position: 'relative',
  },
  coachStatusDot: {
    position: 'absolute',
    left: 2,
    bottom: 2,
    width: 14,
    height: 14,
    borderRadius: radius.pill,
    backgroundColor: '#D1D5DB',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  coachStatusDotActive: {
    backgroundColor: '#34D399',
  },
  coachTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  coachCardName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  coachCardTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  coachStatusTag: {
    minWidth: 56,
    minHeight: 36,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachStatusText: {
    fontSize: 11,
    fontWeight: '900',
  },
  coachStatusSmall: {
    fontSize: 10,
    fontWeight: '800',
  },
  coachStatusDays: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  coachMetrics: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    backgroundColor: '#F9FAFB',
  },
  coachMetricItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRightWidth: 1,
    borderRightColor: colors.surfaceMuted,
  },
  coachMetricLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  coachMetricValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  coachMetricRating: {
    color: '#F97316',
  },
  coachTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  coachTag: {
    overflow: 'hidden',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 5,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  coachBio: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
  },
  coachActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  coachConsultButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.border,
  },
  coachDetailButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.brand,
  },
  coachDetailText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  expiringTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  expiringText: {
    flex: 1,
    color: '#92400E',
    fontSize: 12,
    lineHeight: 18,
  },
  expiringLink: {
    color: '#F97316',
    fontSize: 12,
    fontWeight: '900',
  },
  planFilterBar: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planFilterItem: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  planFilterItemActive: {
    backgroundColor: colors.brand,
  },
  planFilterText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  planFilterTextActive: {
    color: colors.surface,
  },
  pressedCard: {
    opacity: 0.82,
  },
  planHistoryCard: {
    gap: spacing.sm,
  },
  planHistoryHeader: {
    gap: spacing.xs,
  },
  planHistoryName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 24,
  },
  planBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  statusBadge: {
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.surfaceMuted,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '900',
  },
  statusActive: {
    backgroundColor: '#DCFCE7',
    color: '#15803D',
  },
  statusCompleted: {
    backgroundColor: '#DBEAFE',
    color: '#1D4ED8',
  },
  statusArchived: {
    backgroundColor: '#FEF3C7',
    color: '#B45309',
  },
  planSourceBadge: {
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.surfaceMuted,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
  },
  planHistoryInfo: {
    gap: spacing.xs,
  },
  inlineMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  planProgressBlock: {
    gap: spacing.xs,
  },
  planProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  planProgressTrack: {
    height: 6,
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  planProgressFill: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  planHistoryDesc: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  onermRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
  onermName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  onermInputWrap: {
    width: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  onermInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  planLibEditDay: {
    gap: spacing.xs,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
  loadMoreText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  planDetailHeader: {
    backgroundColor: colors.surface,
  },
  planDetailTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  planDetailIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
  },
  planDetailName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  planDetailDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  planInfoCard: {
    paddingVertical: spacing.xs,
  },
  noticeCard: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  noticeLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  noticeText: {
    flex: 1,
    color: '#92400E',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  planDetailActions: {
    gap: spacing.xs,
  },
  planDayList: {
    gap: spacing.sm,
  },
  planDayCard: {
    gap: spacing.xs,
  },
  planDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  planDayTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  planDayBadge: {
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    color: colors.brand,
    backgroundColor: '#FFF7ED',
    fontSize: 11,
    fontWeight: '900',
  },
  planDayNote: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  planActionRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
    paddingTop: spacing.xs,
  },
  planActionName: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  planActionMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  planDayMore: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '900',
  },
  rankingHero: {
    minHeight: 192,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: '#1F2937',
    gap: spacing.xs,
  },
  rankingHeroBadge: {
    alignSelf: 'flex-start',
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  rankingHeroBadgeText: {
    color: '#F7B267',
    fontSize: 12,
    fontWeight: '900',
  },
  rankingHeroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  rankingHeroAccent: {
    color: '#F7B267',
    fontSize: 28,
    fontWeight: '900',
  },
  rankingHeroDesc: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    lineHeight: 20,
  },
  rankingSkeletonList: {
    gap: spacing.sm,
  },
  rankingSkeletonCard: {
    minHeight: 144,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  rankingList: {
    gap: spacing.sm,
  },
  rankingCard: {
    gap: spacing.sm,
  },
  rankingCardFeatured: {
    borderColor: '#F7B267',
    backgroundColor: '#FFFBF5',
  },
  rankingCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rankingIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
  },
  rankingStats: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surfaceMuted,
  },
  rankingStatsText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  rankingCardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  rankingCardDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  rankingCardFooter: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
    paddingTop: spacing.sm,
  },
  rankingCta: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '900',
  },
  rankingFootnote: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingBottom: spacing.sm,
  },
  rankingDetailHeader: {
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.brand,
    gap: spacing.sm,
  },
  rankingDetailEyebrow: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '900',
  },
  rankingDetailTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  rankingDetailDesc: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 13,
    lineHeight: 20,
  },
  rankingDetailMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  rankingMetaBox: {
    minWidth: '47%',
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  rankingMetaValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  rankingMetaLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    marginTop: 2,
  },
  rankingReviewBadge: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.18)',
    fontSize: 12,
    fontWeight: '900',
  },
  rankingSection: {
    gap: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rankingParagraph: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  rankingMuted: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  ruleIndex: {
    width: 22,
    height: 22,
    overflow: 'hidden',
    borderRadius: radius.pill,
    textAlign: 'center',
    lineHeight: 22,
    color: '#FFFFFF',
    backgroundColor: colors.brand,
    fontSize: 12,
    fontWeight: '900',
  },
  ruleText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  entryCard: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    padding: spacing.xs,
    backgroundColor: colors.surfaceMuted,
  },
  entryRank: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1D5DB',
  },
  entryRankGold: {
    backgroundColor: '#F59E0B',
  },
  entryRankSilver: {
    backgroundColor: '#9CA3AF',
  },
  entryRankBronze: {
    backgroundColor: '#B45309',
  },
  entryRankText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  entryBody: {
    flex: 1,
    minWidth: 0,
  },
  entryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  entryName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  entryScore: {
    color: colors.brand,
    fontSize: 18,
    fontWeight: '900',
  },
  entryMetaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 3,
  },
  entryMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  entryTime: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 3,
  },
  rankingSubmitCard: {
    maxHeight: '78%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  rankingSubmitScroll: {
    maxHeight: 420,
  },
  submitField: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  submitLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  submitInput: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    fontSize: 14,
  },
  submitOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  submitOption: {
    minHeight: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  submitOptionActive: {
    borderColor: colors.brand,
    backgroundColor: '#FFF7ED',
  },
  submitOptionText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  submitOptionTextActive: {
    color: colors.brand,
  },
  friendSearchCard: {
    gap: spacing.sm,
  },
  searchInputWrap: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
  friendSearchInput: {
    flex: 1,
    minHeight: 48,
    color: colors.text,
    fontSize: 14,
  },
  searchResultCard: {
    gap: spacing.xs,
  },
  resultTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '900',
  },
  friendTabs: {
    minHeight: 48,
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  friendTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  friendTabActive: {
    backgroundColor: colors.brand,
  },
  friendTabText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
  },
  friendTabTextActive: {
    color: '#FFFFFF',
  },
  friendList: {
    gap: spacing.sm,
  },
  friendItemCard: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  friendTapArea: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
  },
  friendAvatarSquare: {
    borderRadius: radius.md,
  },
  friendAvatarPeach: {
    backgroundColor: '#FFF7ED',
  },
  friendAvatarBlue: {
    backgroundColor: '#EFF6FF',
  },
  friendAvatarMint: {
    backgroundColor: '#F0FDF4',
  },
  friendAvatarText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  friendRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
    paddingTop: spacing.xs,
  },
  friendBody: {
    flex: 1,
    minWidth: 0,
  },
  friendName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  friendMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  addFriendButton: {
    minHeight: 36,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  addFriendText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  removeFriendButton: {
    minHeight: 36,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  removeFriendText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '900',
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  acceptButton: {
    minHeight: 36,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  acceptText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  rejectButton: {
    minHeight: 36,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  rejectText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '900',
  },
  activityList: {
    gap: spacing.sm,
  },
  activityCard: {
    gap: spacing.sm,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activityUser: {
    flex: 1,
    minWidth: 0,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
  },
  activityContent: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  activityStats: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
  },
  activityStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRightWidth: 1,
    borderRightColor: colors.surfaceMuted,
  },
  activityStatValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  activityStatLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  activityHighlight: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '900',
  },
  messagesFriendsEntry: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    backgroundColor: colors.surface,
  },
  messagesFriendsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  messagesFriendsTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  messagesBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  messagesBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  messagesFriendsHint: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
  },
  messageSearchCard: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  messageSearchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  listSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  listSectionTag: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    backgroundColor: '#FFF7ED',
  },
  listSectionTagText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '900',
  },
  chatroomList: {
    gap: spacing.sm,
  },
  chatroomItem: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    backgroundColor: colors.surface,
  },
  chatroomContent: {
    flex: 1,
    minWidth: 0,
  },
  chatroomHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  chatroomName: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  chatroomTime: {
    color: colors.textMuted,
    fontSize: 11,
  },
  chatroomFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chatroomMessageRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chatroomMessage: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    backgroundColor: colors.brand,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  applicationStatusCard: {
    gap: spacing.xs,
  },
  applicationStatusLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  applicationStatusValue: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    fontSize: 13,
    fontWeight: '900',
  },
  applicationReviewNotes: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  applicationSection: {
    gap: spacing.sm,
  },
  sectionDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  trackGrid: {
    gap: spacing.xs,
  },
  trackCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  trackCardActive: {
    borderColor: colors.brand,
    backgroundColor: '#FFF7ED',
  },
  trackTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  trackDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  chipGroup: {
    gap: spacing.xs,
  },
  formLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  choiceChipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  choiceChip: {
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  choiceChipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  choiceChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  choiceChipTextActive: {
    color: '#FFFFFF',
  },
  cityGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  cityInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xs,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
  applicationTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  removableChip: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surfaceMuted,
  },
  removableChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  removableChipRemove: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '900',
  },
  inlineAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  inlineInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xs,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
  inlineInputSmall: {
    width: 88,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xs,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
  inlineAddButton: {
    minHeight: 44,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  inlineAddText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  materialTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  materialTypeChip: {
    minHeight: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.brand,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  materialTypeText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '900',
  },
  materialEmpty: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    padding: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  materialCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  materialTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  materialCategory: {
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    color: colors.brand,
    backgroundColor: '#FFF7ED',
    fontSize: 11,
    fontWeight: '900',
  },
  materialPublic: {
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '900',
  },
  materialPublicOn: {
    color: colors.success,
    backgroundColor: '#ECFDF5',
  },
  materialPublicOff: {
    color: colors.warning,
    backgroundColor: '#FFFBEB',
  },
  materialTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  materialSummary: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  materialMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  materialActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  materialActionText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '900',
  },
  materialDeleteText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '900',
  },
  materialEditor: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    gap: spacing.sm,
  },
  publicToggle: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.surface,
  },
  publicToggleText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  publicTogglePill: {
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  publicTogglePillOn: {
    color: '#FFFFFF',
    backgroundColor: colors.brand,
  },
  materialLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  socialRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
  socialEditor: {
    gap: spacing.sm,
  },
  feedbackSectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  feedbackChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  feedbackChip: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feedbackChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  feedbackChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '900',
  },
  feedbackChipTextActive: {
    color: '#FFFFFF',
  },
  feedbackFaqList: {
    gap: spacing.xs,
  },
  feedbackFaq: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feedbackFaqActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  feedbackFaqText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  feedbackFaqTextActive: {
    color: colors.brandDark,
  },
  feedbackSelectedRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.brandSoft,
  },
  feedbackSelectedText: {
    flex: 1,
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '800',
  },
  feedbackClearText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '900',
  },
  feedbackInput: {
    minHeight: 160,
    borderRadius: radius.md,
    padding: spacing.sm,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feedbackCounter: {
    alignSelf: 'flex-end',
    color: colors.textMuted,
    fontSize: 12,
  },
  feedbackContactInput: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontSize: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feedbackAttachmentHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  feedbackAttachmentCount: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '900',
  },
  feedbackHelper: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  feedbackImageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  feedbackImageWrap: {
    width: 72,
    height: 72,
  },
  feedbackImage: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  feedbackImageRemove: {
    position: 'absolute',
    right: -4,
    top: -4,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
  feedbackImageRemoveText: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '900',
  },
})
