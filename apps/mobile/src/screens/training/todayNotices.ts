import { getBeijingDateParts } from '@coachlink/core/src/beijingTime'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 教练服务宽限期提示，与小程序 today-training isExpiredGrace 一致：
 * 只在生命周期是 expired_grace、且剩余天数和剩余课次都已用完时出现。
 */
export function graceRenewalNotice(subscription: any, now = Date.now()): { daysLeft: number; deadlineLabel: string; coachId: string } | null {
  if (!subscription || String(subscription.lifecycle_status || 'active') !== 'expired_grace') return null
  const endTs = subscription.end_date ? new Date(subscription.end_date).getTime() : NaN
  const remainingDays = Number.isFinite(endTs) ? Math.ceil((endTs - now) / DAY_MS) : null
  if (remainingDays === null || remainingDays > 0) return null
  const credits = Number(subscription.entitlement_remaining_credits ?? NaN)
  if (Number.isFinite(credits) && credits > 0) return null
  const deadline = subscription.grace_deadline_at ? getBeijingDateParts(subscription.grace_deadline_at) : null
  return {
    daysLeft: Math.max(0, Number(subscription.grace_days_left || 0)),
    deadlineLabel: deadline ? `${deadline.month}/${deadline.day}` : '',
    coachId: String(subscription.coach_id || subscription.coach?.id || ''),
  }
}
