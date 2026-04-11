/**
 * 我的教练 - 接口清单（与网页端对齐）
 *
 * 1) POST /api/subscription/coach-subscriptions
 *    请求: { studentId: string }（可选 coachId, onlyActive）
 *    响应: { subscriptions: QueryCoachSubscription[] }
 *    说明: 网页端 subscriptionService.getCoachSubscriptions({ studentId: session.user.id })
 *
 * 2) POST /api/coach/get-aggregated-info
 *    请求: { coachId: string }
 *    响应: { coach, contentCount, studentCount, reviewCount, averageRating, specialties }
 *    说明: 网页端 coachService.getAggregatedInfo({ coachId }) 用于卡片内容数/学员数/评分
 */

import { subscriptionService } from '@/services/subscriptionService'
import { coachService } from '@/services/coach/coachService'
import type {
  QueryCoachSubscription,
  CoachSubscriptionGetResponseDto,
  GetAggregatedInfoResponseDto
} from './types'

/** 拉取当前用户的教练订阅列表（需传入 studentId = 当前用户 id） */
export async function fetchMyCoachSubscriptions(studentId: string): Promise<QueryCoachSubscription[]> {
  const res = await subscriptionService.getCoachSubscriptions({ studentId })
  const data = res as CoachSubscriptionGetResponseDto | null
  if (!data || !Array.isArray(data.subscriptions)) return []
  return data.subscriptions
}

/** 拉取某教练的聚合信息（内容数、学员数、评分等） */
export async function fetchCoachAggregatedInfo(coachId: string): Promise<GetAggregatedInfoResponseDto | null> {
  return coachService.getAggregatedInfo({ coachId })
}
