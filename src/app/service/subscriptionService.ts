import { BaseService } from "@/lib/baseService";
import type { GetTrainingPlansDto, GetTrainingPlansResponseDto } from "../api/subscription/get-training-plans/entity";
import type { GetVideoStatsDto, GetVideoStatsResponseDto } from "../api/subscription/get-video-stats/entity";
import type { CoachMessagesDto, CoachMessagesResponseDto } from "../api/subscription/coach-messages/entity";
import type { CoachSubscriptionGetDto, CoachSubscriptionGetResponseDto } from "../api/subscription/coach-subscriptions/entity";

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
}

export const subscriptionService = new SubscriptionService('/api/subscription');