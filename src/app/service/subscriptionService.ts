import { BaseService } from "@/lib/baseService";
import type { GetTrainingPlansDto, GetTrainingPlansResponseDto } from "../api/subscription/get-training-plans/entity";
import type { GetVideoStatsDto, GetVideoStatsResponseDto } from "../api/subscription/get-video-stats/entity";
import type { CoachMessagesDto, CoachMessagesResponseDto } from "../api/subscription/coach-messages/entity";
import type { CoachSubscriptionGetDto, CoachSubscriptionGetResponseDto } from "../api/subscription/coach-subscriptions/entity";
import type { CreateSubscriptionDto, CreateSubscriptionResponseDto } from "../api/subscription/create-subscription/entity";
import type { UpdateSubscriptionDto, UpdateSubscriptionResponseDto } from "../api/subscription/update-subscription/entity";
import type { GetCoachReviewsDto, GetCoachReviewsResponseDto } from "../api/subscription/get-coach-reviews/entity";
import type { CreateCoachReviewsDto, CreateCoachReviewsResponseDto } from "../api/subscription/create-coach-reviews/entity";
import type { UpdateCoachReviewsDto, UpdateCoachReviewsResponseDto } from "../api/subscription/update-coach-reviews/entity";
import type { DeleteCoachReviewsDto, DeleteCoachReviewsResponseDto } from "../api/subscription/delete-coach-reviews/entity";

interface SubscriptionStats {
    aiPlans: number;
    videoReviews: number;
    messages: number;
    trainingDays: number;
}

interface Activity {
    time: string;
    text: string;
}

interface GetUserStatsResponse {
    stats: SubscriptionStats;
    activities: Activity[];
}

class SubscriptionService extends BaseService {

    async getTrainingPlans(reqData?: GetTrainingPlansDto) {
        const res = await this.post<GetTrainingPlansResponseDto>('get-training-plans', reqData || {});
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async getVideoStats(reqData?: GetVideoStatsDto) {
        const res = await this.post<GetVideoStatsResponseDto>('get-video-stats', reqData || {});
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async coachMessages(reqData?: CoachMessagesDto) {
        const res = await this.post<CoachMessagesResponseDto>('coach-messages', reqData || {});
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async getCoachSubscriptions(reqData: CoachSubscriptionGetDto) {
        const res = await this.post<CoachSubscriptionGetResponseDto>('coach-subscriptions', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async createSubscription(reqData: CreateSubscriptionDto) {
        const res = await this.post<CreateSubscriptionResponseDto>('create-subscription', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async updateSubscription(reqData: UpdateSubscriptionDto) {
        const res = await this.post<UpdateSubscriptionResponseDto>('update-subscription', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }
    
    // 教练评价相关接口
    
    async getCoachReviews(reqData: GetCoachReviewsDto) {
        const res = await this.post<GetCoachReviewsResponseDto>('get-coach-reviews', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }
    
    async createCoachReview(reqData: CreateCoachReviewsDto) {
        const res = await this.post<CreateCoachReviewsResponseDto>('create-coach-reviews', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }
    
    async updateCoachReview(reqData: UpdateCoachReviewsDto) {
        const res = await this.post<UpdateCoachReviewsResponseDto>('update-coach-reviews', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }
    
    async deleteCoachReview(reqData: DeleteCoachReviewsDto) {
        const res = await this.post<DeleteCoachReviewsResponseDto>('delete-coach-reviews', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }
}

export const subscriptionService = new SubscriptionService('/api/subscription');