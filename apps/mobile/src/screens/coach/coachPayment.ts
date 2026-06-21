import { apiClient } from '../../api'
import type { RootStackParamList } from '../../navigation/types'

type PaymentWaitingParams = NonNullable<RootStackParamList['PaymentWaiting']>

type CreateCoachWechatPaymentResponse = {
  orderId?: string
  outTradeNo?: string
  paymentProvider?: 'wechat'
  amount?: number
  paymentParams?: unknown
}

export function subscriptionAmountYuan(subscription: any, fallback = 0) {
  const raw = Number(subscription?.monthly_price ?? 0)
  if (!Number.isFinite(raw) || raw <= 0) return fallback
  return raw / 100
}

export async function createCoachPaymentWaitingParams(params: {
  coachId: string
  coachName?: string
  subscriptionId: string
  amount?: number
}): Promise<PaymentWaitingParams> {
  const amount = Number(params.amount || 0)
  if (!params.subscriptionId) {
    return {
      amount,
      coachId: params.coachId,
      provider: 'wechat',
      target: 'coach',
      message: '订阅资料已保存，但没有拿到可创建支付单的订阅 ID，请返回教练主页重试。',
    }
  }

  try {
    const payment = await apiClient.request<CreateCoachWechatPaymentResponse>('/api/payment/wechat/coach/create', {
      method: 'POST',
      timeoutMs: 15000,
      body: {
        coachId: params.coachId,
        subscriptionId: params.subscriptionId,
        amount,
        subject: `订阅教练 ${params.coachName || ''}`.trim(),
      },
    })

    return {
      orderId: payment.orderId,
      amount: Number(payment.amount ?? amount),
      coachId: params.coachId,
      provider: 'wechat',
      target: 'coach',
    }
  } catch (err) {
    return {
      amount,
      coachId: params.coachId,
      provider: 'wechat',
      target: 'coach',
      message: err instanceof Error ? err.message : '创建支付单失败，请稍后重试',
    }
  }
}
