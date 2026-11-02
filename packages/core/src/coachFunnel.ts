/**
 * 教练转化埋点与「为什么没订阅」问题：Web、小程序和后台报表共用同一份定义。
 * 事件写入 coach_funnel_events，只统计真实打开页面的行为（不含列表预加载）。
 */

export const COACH_FUNNEL_EVENTS = [
  'list_view',
  'profile_view',
  'pricing_view',
  'buy_click',
  'payment_start',
  'payment_cancel',
  'payment_fail',
  'exit_reason',
  'exit_skip'
] as const

export type CoachFunnelEvent = (typeof COACH_FUNNEL_EVENTS)[number]

export const COACH_FUNNEL_PLATFORMS = ['weapp', 'web'] as const
export type CoachFunnelPlatform = (typeof COACH_FUNNEL_PLATFORMS)[number]

/** 点了购买却走不下去的原因，记在 buy_click 的 properties.blocked 上。 */
export type CoachBuyBlockedReason = 'login_required' | 'account_not_ready' | 'processing' | 'already_subscribed'

export const COACH_EXIT_REASONS = [
  { value: 'just_browsing', label: '只是先看看，还没想好' },
  { value: 'price', label: '价格不合适' },
  { value: 'no_fit', label: '没有适合我目标的教练或方案' },
  { value: 'need_proof', label: '想先多了解教练水平和学员案例' },
  { value: 'want_consult', label: '想先和教练聊聊再决定' },
  { value: 'cannot_buy', label: '这位教练暂时买不了' },
  { value: 'self_training', label: '自己练或用免费计划就够了' },
  { value: 'payment_issue', label: '付款时遇到了问题' },
  { value: 'other', label: '其他' }
] as const

export type CoachExitReason = (typeof COACH_EXIT_REASONS)[number]['value']

export const COACH_EXIT_NOTE_MAX_LENGTH = 200

export type CoachExitTrigger = 'list_return' | 'payment_cancel'

export type CoachExitCandidate = {
  coachId: string
  coachName: string
  leftAt: number
  trigger: CoachExitTrigger
  /** 该教练当前能否下单；未知时不传，两类选项都展示。 */
  canBuy?: boolean
}

const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * MINUTE_MS

/** 停留太短多半是误触，不打扰。 */
export const COACH_EXIT_MIN_DWELL_MS = 8 * 1000
/** 离开太久再问就对不上当时的想法了。 */
export const COACH_EXIT_CANDIDATE_TTL_MS = 15 * MINUTE_MS
export const COACH_EXIT_COOLDOWN_MS = 7 * DAY_MS
/** 取消付款的意向最强，可以比普通离开问得勤一些。 */
export const COACH_EXIT_PAYMENT_COOLDOWN_MS = DAY_MS

export const COACH_EXIT_CANDIDATE_STORAGE_KEY = 'coach_exit_candidate_v1'
export const COACH_EXIT_LAST_ASKED_STORAGE_KEY = 'coach_exit_last_asked_v1'

const SETTLED_SUBSCRIPTION_STATUSES = new Set(['active', 'expired', 'near_expiry', 'waiting'])

/** 已经是这位教练的学员（或订单在处理中）就不算「没订阅」。 */
export function isSettledCoachSubscription(status: string | null | undefined): boolean {
  return Boolean(status && SETTLED_SUBSCRIPTION_STATUSES.has(status))
}

export function buildCoachExitCandidate(params: {
  coachId: string
  coachName?: string | null
  enteredAt: number
  now: number
  subscriptionStatus?: string | null
  canBuy?: boolean
  isOwnProfile?: boolean
}): CoachExitCandidate | null {
  if (!params.coachId || params.isOwnProfile) return null
  if (isSettledCoachSubscription(params.subscriptionStatus)) return null
  if (params.now - params.enteredAt < COACH_EXIT_MIN_DWELL_MS) return null
  return {
    coachId: params.coachId,
    coachName: params.coachName || '',
    leftAt: params.now,
    trigger: 'list_return',
    canBuy: params.canBuy
  }
}

export function shouldAskCoachExitReason(params: {
  candidate: CoachExitCandidate | null | undefined
  now: number
  lastAskedAt?: number | null
}): boolean {
  const { candidate, now, lastAskedAt } = params
  if (!candidate?.coachId || !Number.isFinite(candidate.leftAt)) return false
  if (now - candidate.leftAt > COACH_EXIT_CANDIDATE_TTL_MS) return false
  if (!lastAskedAt) return true
  const cooldown = candidate.trigger === 'payment_cancel' ? COACH_EXIT_PAYMENT_COOLDOWN_MS : COACH_EXIT_COOLDOWN_MS
  return now - lastAskedAt >= cooldown
}

/** 买不了的教练不问价格和付款，能买的教练不显示「买不了」。 */
export function coachExitReasonsFor(canBuy?: boolean) {
  return COACH_EXIT_REASONS.filter((reason) => {
    if (canBuy === true) return reason.value !== 'cannot_buy'
    if (canBuy === false) return reason.value !== 'price' && reason.value !== 'payment_issue'
    return true
  })
}

export function isCoachFunnelEvent(value: unknown): value is CoachFunnelEvent {
  return typeof value === 'string' && (COACH_FUNNEL_EVENTS as readonly string[]).includes(value)
}

export function isCoachExitReason(value: unknown): value is CoachExitReason {
  return typeof value === 'string' && COACH_EXIT_REASONS.some((reason) => reason.value === value)
}

export function coachExitReasonLabel(value: string): string {
  return COACH_EXIT_REASONS.find((reason) => reason.value === value)?.label || value
}
