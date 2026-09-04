import { apiClient } from '../../api'
import type { RootStackParamList } from '../../navigation/types'

type PaymentWaitingParams = NonNullable<RootStackParamList['PaymentWaiting']>

type CreateCoachAlipayPaymentResponse = {
  order: {
    id: string
    out_trade_no: string
    total_amount: number
    status: string
  }
  paymentInfo: {
    paymentUrl?: string
    payInfo?: unknown
    provider?: string
    tradeType?: string
  }
  paymentParams?: unknown
}

export function subscriptionAmountYuan(subscription: any, fallback = 0) {
  const raw = Number(subscription?.monthly_price ?? 0)
  if (!Number.isFinite(raw) || raw <= 0) return fallback
  return raw / 100
}

function extractPaymentTarget(payInfo: unknown) {
  if (!payInfo) return ''
  if (typeof payInfo === 'string') return payInfo.trim()
  if (typeof payInfo !== 'object') return ''
  const value = payInfo as Record<string, unknown>
  const target = value.qr_code
    ?? value.qrcode
    ?? value.qrCode
    ?? value.code_url
    ?? value.codeUrl
    ?? value.pay_url
    ?? value.payUrl
    ?? value.url
    ?? value.paymentUrl
  return typeof target === 'string' ? target.trim() : ''
}

export async function createCoachPaymentWaitingParams(params: {
  coachId: string
  coachName?: string
  subscriptionId: string
  amount?: number
  renew?: boolean
  renewAdditionalWeeks?: number
}): Promise<PaymentWaitingParams> {
  const amount = Number(params.amount || 0)
  if (!params.subscriptionId) {
    return {
      amount,
      coachId: params.coachId,
      provider: 'alipay',
      target: 'coach',
      message: '订阅资料已保存，但没有拿到可创建支付单的订阅 ID，请返回教练主页重试。',
    }
  }

  try {
    const payment = await apiClient.request<CreateCoachAlipayPaymentResponse>('/api/payment/alipay/create', {
      method: 'POST',
      timeoutMs: 15000,
      body: {
        subject: `${params.renew ? '续费' : '订阅'}教练 ${params.coachName || ''}`.trim(),
        totalAmount: amount,
        orderType: params.renew ? 'subscription_renew' : 'subscription',
        orderData: {
          coachId: params.coachId,
          subscriptionId: params.subscriptionId,
          renewAdditionalWeeks: params.renew ? params.renewAdditionalWeeks : undefined,
        },
        returnUrlOnly: true,
        isMobile: true,
      },
    })
    const paymentTarget = payment.paymentInfo?.paymentUrl
      || extractPaymentTarget(payment.paymentInfo?.payInfo)

    return {
      orderId: payment.order?.id || payment.order?.out_trade_no,
      amount: Number(payment.order?.total_amount ?? amount),
      paymentUrl: paymentTarget || undefined,
      coachId: params.coachId,
      provider: 'alipay',
      target: 'coach',
      message: paymentTarget ? undefined : '支付订单已创建，但未返回可打开的支付宝地址。',
    }
  } catch (err) {
    return {
      amount,
      coachId: params.coachId,
      provider: 'alipay',
      target: 'coach',
      message: err instanceof Error ? err.message : '创建支付单失败，请稍后重试',
    }
  }
}
