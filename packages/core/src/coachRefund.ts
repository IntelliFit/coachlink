/**
 * Coach-side refund of a student's subscription payments, shared by Web, the
 * mini-program and the App. The server lists the refundable orders and decides
 * each one's role; clients only render and confirm.
 */

/** in_use: the subscription currently runs on this payment. duplicate: a second first purchase the subscription never used. */
export type CoachRefundOrderRole = 'in_use' | 'duplicate' | 'renewal' | 'other'

export type CoachRefundSubscriptionOutcome = 'cancelled' | 'kept' | 'unknown'

export interface CoachRefundOrder {
  id: string
  amountFen: number
  orderType: string
  paymentProvider: string | null
  createdAt: string | null
  role: CoachRefundOrderRole
  /** Whether refunding this order cancels the subscription (server rule shouldCancelSubscriptionOnRefund). */
  cancelsSubscription: boolean
}

/** Payment methods recorded for subscriptions the platform did not collect money for. */
const OFFLINE_PAYMENT_METHODS = new Set(['offline', 'manual'])

/**
 * Whether a coach client shows the refund entry for a subscription. Both
 * platform WeChat (Huifu) and Alipay payments qualify; the server's order list
 * decides which orders can actually be refunded.
 */
export function canOfferCoachRefund(subscription: {
  payment_method?: string | null
  order_id?: string | null
  last_payment_order_id?: string | null
} | null | undefined): boolean {
  if (!subscription) return false
  if (OFFLINE_PAYMENT_METHODS.has(String(subscription.payment_method || ''))) return false
  return Boolean(subscription.last_payment_order_id || subscription.order_id)
}

/** Shown when the server lists nothing refundable (e.g. unpaid, or WeChat virtual payment). */
export const COACH_REFUND_EMPTY_TEXT = '没有可退款的订单。微信虚拟支付的订单请在小程序虚拟支付商户后台退款。'

/** WeChat's showActionSheet takes at most 6 items. */
export const COACH_REFUND_SHEET_LIMIT = 6
export const COACH_REFUND_SHEET_MORE_TEXT = '更早的订单请到网页端退款'

/**
 * Action-sheet entries for the mini-program: up to 6 items; with more orders the
 * last slot says where the older ones are instead of silently dropping them.
 */
export function coachRefundSheetItems<T>(orders: T[]): { choices: T[]; hasMore: boolean } {
  if (orders.length <= COACH_REFUND_SHEET_LIMIT) return { choices: orders, hasMore: false }
  return { choices: orders.slice(0, COACH_REFUND_SHEET_LIMIT - 1), hasMore: true }
}

const ROLE_LABELS: Record<CoachRefundOrderRole, string> = {
  in_use: '订阅正在用',
  duplicate: '重复扣款',
  renewal: '续费',
  other: '首次购买',
}

export function coachRefundRoleLabel(role: CoachRefundOrderRole): string {
  return ROLE_LABELS[role] || ROLE_LABELS.other
}

/** Payment method label; WeChat virtual payment never reaches the list. */
export function coachRefundProviderLabel(provider: string | null | undefined): string {
  return provider === 'wechat' ? '微信支付' : provider === 'alipay' ? '支付宝' : '平台支付'
}

export function coachRefundConsequence(order: Pick<CoachRefundOrder, 'cancelsSubscription'>): string {
  return order.cancelsSubscription ? '退款后订阅会取消' : '退款后订阅保留'
}

function formatYuan(fen: number): string {
  const yuan = Math.round(Number(fen) || 0) / 100
  return Number.isInteger(yuan) ? String(yuan) : yuan.toFixed(2)
}

export function coachRefundAmountText(order: Pick<CoachRefundOrder, 'amountFen'>): string {
  return `¥${formatYuan(order.amountFen)}`
}

export function coachRefundConfirmText(order: Pick<CoachRefundOrder, 'amountFen' | 'role' | 'cancelsSubscription'>): string {
  const amount = coachRefundAmountText(order)
  const subscription = order.cancelsSubscription
    ? '退款后该学员的订阅会被取消。'
    : '这笔不是订阅正在用的付款，退款后订阅保持不变。'
  return `确定退还这笔 ${amount}（${coachRefundRoleLabel(order.role)}）吗？${subscription}已结算给你的部分会从钱包扣回。`
}

/** Result text from the refund API's subscriptionOutcome; never claims a cancellation the server did not make. */
export function coachRefundResult(outcome: CoachRefundSubscriptionOutcome | null | undefined): {
  title: string
  subscriptionCancelled: boolean
} {
  if (outcome === 'cancelled') return { title: '退款成功，订阅已取消', subscriptionCancelled: true }
  if (outcome === 'kept') return { title: '退款成功，订阅保持不变', subscriptionCancelled: false }
  if (outcome === 'unknown') return { title: '退款成功，订阅状态未同步，请联系平台核对', subscriptionCancelled: false }
  return { title: '退款成功', subscriptionCancelled: false }
}
