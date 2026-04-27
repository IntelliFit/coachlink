/**
 * 支付相关：同时保留旧支付宝跳转能力，并新增小程序内原生微信支付能力。
 */
import { request } from '@/utils/request'
import Taro from '@tarojs/taro'

const WEB_BASE = 'https://coachlink.fit'

export interface CreateAlipayOrderParams {
  subject: string
  totalAmount: number
  orderType: 'subscription' | 'subscription_renew'
  orderData: {
    coachId: string
    subscriptionId: string
    renewAdditionalWeeks?: number
  }
  /** 为 true 时接口返回 paymentUrl，不返回 formHtml */
  returnUrlOnly?: boolean
  isMobile?: boolean
}

export interface CreateAlipayOrderResponse {
  order: { id: string; out_trade_no: string; subject: string; total_amount: number; status: string; created_at: string }
  paymentInfo: { formHtml?: string; description?: string; paymentUrl?: string }
}

export function buildCoachSubscriptionPaymentStartUrl(params: {
  coachId: string
  subscriptionId: string
  amount: number
  subject: string
  renew?: boolean
  renewAdditionalWeeks?: number
}): string {
  const search = new URLSearchParams()
  search.set('subscriptionId', params.subscriptionId)
  search.set('coachId', params.coachId)
  search.set('amount', String(params.amount))
  search.set('subject', params.subject)
  if (params.renew) {
    search.set('renew', 'true')
    if (params.renewAdditionalWeeks != null) {
      search.set('renewAdditionalWeeks', String(params.renewAdditionalWeeks))
    }
  }
  return `${WEB_BASE}/payment/start?${search.toString()}`
}

/**
 * 创建支付宝订单并返回支付跳转 URL（小程序鉴权）
 * 供小程序内继续发起支付宝支付或跳转支付直达页使用
 */
export async function createAlipayOrder(
  params: CreateAlipayOrderParams & { showErrorToast?: boolean }
): Promise<{ success: boolean; paymentUrl?: string; orderId?: string; message?: string }> {
  const { showErrorToast = true, ...rest } = params
  const res = await request<CreateAlipayOrderResponse>({
    url: '/api/payment/alipay/create',
    method: 'POST',
    data: {
      subject: rest.subject,
      totalAmount: rest.totalAmount,
      orderType: rest.orderType,
      orderData: rest.orderData,
      returnUrlOnly: rest.returnUrlOnly ?? true,
      isMobile: rest.isMobile ?? true
    },
    showErrorToast
  })
  if (!res.success || !res.data) {
    return { success: false, message: res.message }
  }
  const paymentUrl = res.data.paymentInfo?.paymentUrl
  const orderId = res.data.order?.id
  return { success: true, paymentUrl, orderId }
}

/** 订单状态：与 web payment/[id] 一致 */
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'cancelled'

export interface QueryPaymentOrderResponse {
  order: { id: string; total_amount: number; status: string; order_data?: Record<string, unknown> }
  tradeStatus: string
}

export interface WechatPaymentParams {
  appId: string
  timeStamp: string
  nonceStr: string
  package: string
  signType: 'RSA'
  paySign: string
}

export interface CreateCoachWechatPaymentResponse {
  orderId: string
  outTradeNo: string
  paymentProvider: 'wechat'
  amount: number
  paymentParams: WechatPaymentParams
}

export interface QueryCoachWechatPaymentResponse {
  status: PaymentStatus
  amount: number
  order: {
    id: string
    total_amount: number
    status: string
  }
}

/**
 * 查询支付订单状态（轮询用，小程序鉴权）
 */
export async function queryPaymentOrder(orderId: string): Promise<{
  success: boolean
  status?: PaymentStatus
  amount?: number
  message?: string
}> {
  const res = await request<QueryPaymentOrderResponse>({
    url: '/api/payment/alipay/query',
    method: 'POST',
    data: { orderId },
    showErrorToast: false
  })
  if (!res.success || !res.data) {
    return { success: false, message: res.message }
  }
  const order = res.data.order
  const ts = res.data.tradeStatus
  let status: PaymentStatus = 'pending'
  if (order?.status === 'paid' || ts === 'TRADE_SUCCESS' || ts === 'TRADE_FINISHED') {
    status = 'success'
  } else if (order?.status === 'closed' || order?.status === 'cancelled' || ts === 'TRADE_CLOSED') {
    status = 'cancelled'
  } else if (order?.status === 'failed' || order?.status === 'refunded') {
    status = 'failed'
  }
  const amount = order?.total_amount != null ? Number(order.total_amount) : undefined
  return { success: true, status, amount }
}

export async function createCoachWechatPayment(params: {
  coachId: string
  subscriptionId: string
  amount?: number
  renew?: boolean
  renewAdditionalWeeks?: number
  subject?: string
}): Promise<{ success: boolean; data?: CreateCoachWechatPaymentResponse; message?: string }> {
  const res = await request<CreateCoachWechatPaymentResponse>({
    url: '/api/payment/wechat/coach/create',
    method: 'POST',
    data: params,
  })

  if (!res.success || !res.data) {
    return { success: false, message: res.message }
  }

  return {
    success: true,
    data: res.data
  }
}

export async function queryCoachPaymentOrder(orderId: string): Promise<{
  success: boolean
  status?: PaymentStatus
  amount?: number
  message?: string
}> {
  const res = await request<QueryCoachWechatPaymentResponse>({
    url: '/api/payment/wechat/query',
    method: 'POST',
    data: { orderId },
    showErrorToast: false
  })

  if (!res.success || !res.data) {
    return { success: false, message: res.message }
  }

  return {
    success: true,
    status: res.data.status,
    amount: Number(res.data.amount || 0)
  }
}

export async function requestCoachWechatPayment(params: WechatPaymentParams): Promise<{
  success: boolean
  status: 'success' | 'cancelled' | 'failed'
  message?: string
}> {
  try {
    await Taro.requestPayment({
      timeStamp: params.timeStamp,
      nonceStr: params.nonceStr,
      package: params.package,
      signType: params.signType,
      paySign: params.paySign,
    })
    return { success: true, status: 'success' }
  } catch (error: any) {
    const errMsg = String(error?.errMsg || error?.message || '')
    const cancelled =
      errMsg.includes('cancel') ||
      errMsg.includes('cancelled') ||
      errMsg.includes('用户取消')

    return {
      success: false,
      status: cancelled ? 'cancelled' : 'failed',
      message: errMsg || (cancelled ? '用户取消支付' : '拉起微信支付失败')
    }
  }
}
