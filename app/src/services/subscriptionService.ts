import { BaseService } from '../utils/request'

interface GetCoachSubscriptionsDto {
  studentId?: string
  coachId?: string
  onlyActive?: boolean
}

/** 响应与网页端 CoachSubscriptionGetResponseDto 一致：{ subscriptions: QueryCoachSubscription[] } */

interface GetCoachReviewsDto {
  studentId?: string
  coachId?: string
}

class SubscriptionService extends BaseService {
  /**
   * 获取教练订阅列表
   */
  async getCoachSubscriptions(params: GetCoachSubscriptionsDto) {
    const res = await this.post('coach-subscriptions', params)
    
    if (res.success && res.data) {
      return res.data
    }
    
    return null
  }

  /**
   * 获取教练评价
   */
  async getCoachReviews(params: GetCoachReviewsDto) {
    const res = await this.post('get-coach-reviews', params)
    
    if (res.success && res.data) {
      return res.data
    }
    
    return null
  }

  /**
   * 更新订阅信息（用于更新问卷等）
   */
  async updateSubscription(reqData: { id: string; subscribe_data?: any; [key: string]: any }) {
    const res = await this.post('update-subscription', reqData)
    
    if (res.success && res.data) {
      return res.data
    }
    
    return null
  }

  /**
   * 续费订阅
   */
  async renewSubscription(reqData: {
    subscriptionId: string
    renewType: 'extend'
    additionalWeeks: number
    amount: number
    orderId?: string
  }) {
    const res = await this.post('renew-subscription', reqData)
    if (res.success && res.data) return res.data
    return null
  }

  /**
   * 创建订阅
   */
  async createSubscription(reqData: {
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
    const res = await this.post('create-subscription', reqData)
    
    if (res.success && res.data) {
      return res.data
    }
    
    return null
  }
}

export const subscriptionService = new SubscriptionService('/api/subscription')

