/**
 * 鏀粯鐩稿叧锛氬悓鏃朵繚鐣欐棫鏀粯瀹濊烦杞兘鍔涳紝骞舵柊澧炲皬绋嬪簭鍐呭師鐢熷井淇℃敮浠樿兘鍔涖€?
 */
import { request } from '@/utils/request'
import Taro from '@tarojs/taro'
import {
  isVirtualPaymentCancellation,
  requestVirtualPaymentAndWait,
  virtualPaymentErrorMessage,
  type VirtualPaymentRequestOptions
} from '@/utils/virtual-payment'

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
  /** 涓?true 鏃舵帴鍙ｈ繑鍥?paymentUrl锛屼笉杩斿洖 formHtml */
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
 * 鍒涘缓鏀粯瀹濊鍗曞苟杩斿洖鏀粯璺宠浆 URL锛堝皬绋嬪簭閴存潈锛?
 * 渚涘皬绋嬪簭鍐呯户缁彂璧锋敮浠樺疂鏀粯鎴栬烦杞敮浠樼洿杈鹃〉浣跨敤
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

/** 璁㈠崟鐘舵€侊細涓?web payment/[id] 涓€鑷?*/
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'cancelled'

export interface QueryPaymentOrderResponse {
  order: { id: string; total_amount: number; status: string; order_data?: Record<string, unknown> }
  tradeStatus: string
}

export interface CoachWechatPaymentParams {
  appId: string
  timeStamp: string
  nonceStr: string
  package: string
  signType: 'RSA'
  paySign: string
}

/** 平台自营虚拟商品（会员、加油包、动作特效）使用的 XPay 参数。 */
export type WechatPaymentParams = VirtualPaymentRequestOptions

export interface CreateCoachWechatPaymentResponse {
  orderId: string
  outTradeNo: string
  paymentProvider: 'wechat'
  amount: number
  paymentParams: CoachWechatPaymentParams
}

export interface CreateMembershipWechatPaymentResponse {
  orderId: string
  outTradeNo: string
  paymentProvider: 'wechat_xpay'
  amount: number
  paymentParams: WechatPaymentParams
}

export interface QueryCoachWechatPaymentResponse {
  status: PaymentStatus
  amount: number
  order: {
    id: string
    total_amount: string
    status: string
  }
}

/**
 * 鏌ヨ鏀粯璁㈠崟鐘舵€侊紙杞鐢紝灏忕▼搴忛壌鏉冿級
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
  testAmountFen?: number
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

export async function createMembershipWechatPayment(params: {
  productKey: string
}): Promise<{ success: boolean; data?: CreateMembershipWechatPaymentResponse; message?: string }> {
  const login = await Taro.login()
  if (!login.code) {
    return { success: false, message: '获取微信登录状态失败，请重试' }
  }
  const res = await request<CreateMembershipWechatPaymentResponse>({
    url: '/api/payment/wechat/membership/create',
    method: 'POST',
    data: { ...params, loginCode: login.code },
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

export async function requestCoachWechatPayment(params: CoachWechatPaymentParams): Promise<{
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
    const cancelled = errMsg.toLowerCase().includes('cancel') || errMsg.includes('用户取消')

    return {
      success: false,
      status: cancelled ? 'cancelled' : 'failed',
      message: errMsg || (cancelled ? '用户取消支付' : '拉起微信支付失败')
    }
  }
}

export async function requestWechatPayment(params: WechatPaymentParams) {
  try {
    await requestVirtualPaymentAndWait((Taro as any).requestVirtualPayment, params)
    return { success: true, status: 'success' as const }
  } catch (error: any) {
    const errMsg = virtualPaymentErrorMessage(error)
    const cancelled = isVirtualPaymentCancellation(error)
    return {
      success: false,
      status: cancelled ? 'cancelled' as const : 'failed' as const,
      message: errMsg || (cancelled ? '用户取消支付' : '拉起微信虚拟支付失败')
    }
  }
}

export async function refundAlipayOrder(params: {
  orderId: string
  refundReason?: string
  showErrorToast?: boolean
}): Promise<{ success: boolean; message?: string }> {
  const res = await request({
    url: '/api/payment/alipay/refund',
    method: 'POST',
    data: {
      orderId: params.orderId,
      refundReason: params.refundReason || '鐢ㄦ埛鐢宠閫€娆?'
    },
    showErrorToast: params.showErrorToast ?? true
  })
  if (!res.success) {
    return { success: false, message: res.message }
  }
  return { success: true, message: res.message }
}
