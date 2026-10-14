/**
 * 教练详情页 - 接口调用（与 PC coach/profile/[id] 对齐）
 * Token 由 request 基类自动注入。
 */

import { coachService } from '@/services/coach/coachService'
import {
  createCoachWechatPayment as createCoachWechatPaymentRequest,
  queryCoachPaymentOrder as queryCoachPaymentOrderRequest,
  requestCoachWechatPayment
} from '@/services/paymentService'
import { subscriptionService } from '@/services/subscriptionService'
import type {
  CoachRow,
  GetAggregatedInfoResponseDto,
  QueryCoachSubscription,
  Product,
  CoachContentRow,
  PublicCoachReview
} from './types'

export async function fetchCoach(coachId: string): Promise<CoachRow | null> {
  const res = await coachService.getCoach({ id: coachId })
  return res?.coach ?? null
}

export async function fetchAggregatedInfo(coachId: string): Promise<GetAggregatedInfoResponseDto | null> {
  return coachService.getAggregatedInfo({ coachId })
}

export async function fetchMySubscriptions(studentId: string): Promise<QueryCoachSubscription[]> {
  const res = await subscriptionService.getCoachSubscriptions({ studentId, onlyActive: false })
  const list = (res as any)?.subscriptions
  return Array.isArray(list) ? list : []
}

export async function fetchPricing(coachId: string): Promise<Product[]> {
  const res = await coachService.getPricing({ coachId })
  const products = res?.products
  return Array.isArray(products) ? products : []
}

export async function fetchContents(coachId: string, offset: number, limit: number): Promise<{ contents: CoachContentRow[]; total: number }> {
  const res = await coachService.getContents({ coachId, offset, limit })
  return {
    contents: Array.isArray(res?.contents) ? res.contents : [],
    total: res?.total ?? 0
  }
}

export async function fetchPublicReviews(coachId: string): Promise<PublicCoachReview[] | null> {
  const res = await coachService.getPublicReviews({ coachId })
  return Array.isArray(res?.reviews) ? res.reviews : null
}

export async function updateSubscriptionSubscribeData(subscriptionId: string, subscribeData: any): Promise<boolean> {
  const res = await subscriptionService.updateSubscription({ id: subscriptionId, subscribe_data: subscribeData })
  return !!(res as any)?.subscription
}

export async function createSubscription(reqData: {
  coachId: string
  tier: number
  monthlyPrice: number
  status?: string
  subscribeData?: any[]
  productId?: string
  productName?: string
  productTier?: string
  subscribedWeeks?: number
}) {
  const res = await subscriptionService.createSubscription(reqData)
  return (res as any)?.subscription ?? null
}

export async function fetchQuestionnaires(coachId: string): Promise<any[]> {
  const res = await coachService.getQuestionnaires({ coachId })
  const list = (res as any)?.questionnaires
  return Array.isArray(list) ? list : []
}

export async function createCoachWechatPayment(reqData: {
  coachId: string
  subscriptionId: string
  amount?: number
  renew?: boolean
  renewAdditionalWeeks?: number
  testAmountFen?: number
  subject?: string
  productId?: string
  months?: number
}) {
  const res = await createCoachWechatPaymentRequest(reqData)
  if (!res.success) {
    return { message: res.message || '创建支付单失败' }
  }
  return res.data ?? null
}

export async function queryCoachPaymentOrder(orderId: string) {
  return queryCoachPaymentOrderRequest(orderId)
}

export { requestCoachWechatPayment }
