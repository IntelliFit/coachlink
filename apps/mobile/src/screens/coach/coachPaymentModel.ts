/**
 * 教练「待支付确认」的纯逻辑，与 Web `dashboard/students/PaymentConfirmationDialog.tsx` 保持一致：
 * 新订单（record_kind = subscription_order）走订单接口，旧订阅记录走 update-subscription。
 */

export type CoachPaymentRecord = {
  id: string
  record_kind?: 'subscription_order' | 'legacy_subscription' | null
  student_id?: string | null
  tier?: number | null
  monthly_price?: number | null
  subscribed_weeks?: number | null
  status?: string | null
  payment_confirmed_by?: string | null
  payment_confirmed_at?: string | null
  payment_data?: Record<string, any> | null
  remind_coach_note?: string | null
  product_name?: string | null
  end_date?: string | null
  created_at?: string | null
}

export type PaymentRecordKind = 'manual' | 'system' | 'history'

export type PaymentRequest = { path: string; body: Record<string, unknown> }

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function tierLabel(tier: unknown) {
  const value = Number(tier)
  if (value === 3) return '全能指导'
  if (value === 2) return '专业指导'
  return '特惠版'
}

/** 金额默认按「分」解释，显式 amount_unit = 'yuan' 时按元。 */
export function moneyYuanText(value: unknown, unit?: string | null) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount <= 0) return ''
  const fen = unit === 'yuan' ? Math.round(amount * 100) : Math.round(amount)
  return `¥${(fen / 100).toFixed(2)}`
}

export function extractReceiptInfo(rawNote: unknown) {
  const note = String(rawNote || '').trim()
  if (!note) return { cleanNote: '', receiptUrl: '' }
  const match = note.match(/付款凭证[:：]\s*(https?:\/\/[^\s]+)/)
  if (!match) return { cleanNote: note, receiptUrl: '' }
  return {
    cleanNote: note.replace(/付款凭证[:：]\s*https?:\/\/[^\s]+/g, '').trim(),
    receiptUrl: String(match[1] || '').trim(),
  }
}

export function paymentTypeLabel(record: CoachPaymentRecord, kind: PaymentRecordKind) {
  if (kind === 'system') return String(record.status || '') === 'inactive' ? '平台待支付' : '平台已确认'
  return record.payment_data?.offline_payment ? '线下已支付' : '扫码支付'
}

function buildLegacyConfirmUpdate(record: CoachPaymentRecord, now: Date) {
  const paymentData = record.payment_data
  const offlinePayment = paymentData?.offline_payment
  const pendingRenew = paymentData?.pending_renew
  const update: Record<string, unknown> = { id: record.id, status: 'active' }

  if (offlinePayment?.expires_at) update.end_date = offlinePayment.expires_at

  const weeks = Number(pendingRenew?.additional_weeks || 0)
  if (weeks > 0) {
    update.subscribed_weeks = Number(record.subscribed_weeks || 0) + weeks
    const base = record.end_date ? new Date(record.end_date).getTime() : now.getTime()
    const effectiveBase = Number.isFinite(base) && base > now.getTime() ? base : now.getTime()
    // 按整周毫秒累加：不受设备所在时区夏令时影响（北京时间下与 Web 的 setDate 结果相同）。
    update.end_date = new Date(effectiveBase + weeks * WEEK_MS).toISOString()
  }

  if (weeks <= 0 && !offlinePayment?.expires_at && record.end_date && new Date(record.end_date).getTime() <= now.getTime()) {
    update.end_date = null
  }

  if (paymentData && typeof paymentData === 'object' && !Array.isArray(paymentData)) {
    update.payment_data = { ...paymentData, pending_renew: null }
  }
  return update
}

export function buildConfirmRequest(record: CoachPaymentRecord, now = new Date()): PaymentRequest {
  if (record.record_kind === 'subscription_order') {
    return { path: '/api/subscription/confirm-subscription-order', body: { orderId: record.id } }
  }
  return { path: '/api/subscription/update-subscription', body: buildLegacyConfirmUpdate(record, now) }
}

export function buildDismissRequest(record: CoachPaymentRecord, now = new Date()): PaymentRequest {
  const seenAt = now.toISOString()
  if (record.record_kind === 'subscription_order') {
    return { path: '/api/subscription/update-subscription-order', body: { id: record.id, coachSeenAt: seenAt } }
  }
  return { path: '/api/subscription/update-subscription', body: { id: record.id, coach_seen_at: seenAt } }
}
