import { BaseService } from "@/lib/baseService";
import type {
    GetTrainingPlansDto,
    GetTrainingPlansResponseDto,
} from "../api/subscription/get-training-plans/entity";
import type {
    GetVideoStatsDto,
    GetVideoStatsResponseDto,
} from "../api/subscription/get-video-stats/entity";
import type {
    CoachMessagesDto,
    CoachMessagesResponseDto,
} from "../api/subscription/coach-messages/entity";
import type {
    CoachSubscriptionGetDto,
    CoachSubscriptionGetResponseDto,
} from "../api/subscription/coach-subscriptions/entity";
import type {
    CreateSubscriptionDto,
    CreateSubscriptionResponseDto,
} from "../api/subscription/create-subscription/entity";
import type {
    CreateSubscriptionOrderDto,
    CreateSubscriptionOrderResponseDto,
} from "../api/subscription/create-subscription-order/entity";
import type {
    UpdateSubscriptionDto,
    UpdateSubscriptionResponseDto,
} from "../api/subscription/update-subscription/entity";
import type {
    UpdateSubscriptionOrderDto,
    UpdateSubscriptionOrderResponseDto,
} from "../api/subscription/update-subscription-order/entity";
import type {
    ConfirmSubscriptionOrderDto,
    ConfirmSubscriptionOrderResponseDto,
} from "../api/subscription/confirm-subscription-order/entity";
import type {
    GetCoachReviewsDto,
    GetCoachReviewsResponseDto,
} from "../api/subscription/get-coach-reviews/entity";
import type {
    CreateCoachReviewsDto,
    CreateCoachReviewsResponseDto,
} from "../api/subscription/create-coach-reviews/entity";
import type {
    UpdateCoachReviewsDto,
    UpdateCoachReviewsResponseDto,
} from "../api/subscription/update-coach-reviews/entity";
import type {
    DeleteCoachReviewsDto,
    DeleteCoachReviewsResponseDto,
} from "../api/subscription/delete-coach-reviews/entity";
import type {
    GetSubscriptionDto,
    GetSubscriptionResponseDto,
} from "../api/subscription/get-subscription/entity";
import type {
    ListSubscriptionGetDto,
    ListSubscriptionGetResponseDto,
} from "../api/subscription/list-subscriptions/entity";
import type {
    RenewSubscriptionDto,
    RenewSubscriptionResponseDto,
} from "../api/subscription/renew-subscription/entity";
import type { UpdateQuestionnairesDto, UpdateQuestionnairesResponseDto } from "../api/subscription/update-questionnaire/entity";
import type {
    CheckSubscriptionDto,
    CheckSubscriptionResponseDto,
} from "../api/subscription/check-subscription/entity";
import type {
    CheckExpiredSubscriptionsDto,
    CheckExpiredSubscriptionsResponseDto,
} from "../api/subscription/check-expired-subscriptions/entity";

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
        const res = await this.post<GetTrainingPlansResponseDto>(
            "get-training-plans",
            reqData || {},
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async getVideoStats(reqData?: GetVideoStatsDto) {
        const res = await this.post<GetVideoStatsResponseDto>(
            "get-video-stats",
            reqData || {},
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async coachMessages(reqData?: CoachMessagesDto) {
        const res = await this.post<CoachMessagesResponseDto>(
            "coach-messages",
            reqData || {},
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async getCoachSubscriptions(reqData: CoachSubscriptionGetDto) {
        const res = await this.post<CoachSubscriptionGetResponseDto>(
            "coach-subscriptions",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async createSubscription(reqData: CreateSubscriptionDto) {
        const res = await this.post<CreateSubscriptionResponseDto>(
            "create-subscription",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async createSubscriptionOrder(reqData: CreateSubscriptionOrderDto) {
        const res = await this.post<CreateSubscriptionOrderResponseDto>(
            "create-subscription-order",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async updateSubscription(reqData: UpdateSubscriptionDto) {
        const res = await this.post<UpdateSubscriptionResponseDto>(
            "update-subscription",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async updateSubscriptionOrder(reqData: UpdateSubscriptionOrderDto) {
        const res = await this.post<UpdateSubscriptionOrderResponseDto>(
            "update-subscription-order",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async confirmSubscriptionOrder(reqData: ConfirmSubscriptionOrderDto) {
        const res = await this.post<ConfirmSubscriptionOrderResponseDto>(
            "confirm-subscription-order",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    // 教练评价相关接口

    async getCoachReviews(reqData: GetCoachReviewsDto) {
        const res = await this.post<GetCoachReviewsResponseDto>(
            "get-coach-reviews",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async createCoachReview(reqData: CreateCoachReviewsDto) {
        const res = await this.post<CreateCoachReviewsResponseDto>(
            "create-coach-reviews",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async updateCoachReview(reqData: UpdateCoachReviewsDto) {
        const res = await this.post<UpdateCoachReviewsResponseDto>(
            "update-coach-reviews",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async deleteCoachReview(reqData: DeleteCoachReviewsDto) {
        const res = await this.post<DeleteCoachReviewsResponseDto>(
            "delete-coach-reviews",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async getSubscription(reqData: GetSubscriptionDto) {
        const res = await this.post<GetSubscriptionResponseDto>(
            "get-subscription",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async listSubscriptions(reqData: ListSubscriptionGetDto) {
        const res = await this.post<ListSubscriptionGetResponseDto>(
            "list-subscriptions",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async renewSubscription(reqData: RenewSubscriptionDto) {
        const res = await this.post<RenewSubscriptionResponseDto>(
            "renew-subscription",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async updateQuestionnaire(reqData: UpdateQuestionnairesDto) {
        const res = await this.post<UpdateQuestionnairesResponseDto>(
            "update-questionnaire",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async checkSubscription(reqData: CheckSubscriptionDto) {
        const res = await this.post<CheckSubscriptionResponseDto>(
            "check-subscription",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async checkExpiredSubscriptions(reqData?: CheckExpiredSubscriptionsDto) {
        const res = await this.post<CheckExpiredSubscriptionsResponseDto>(
            "check-expired-subscriptions",
            reqData || {},
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }
}

export const subscriptionService = new SubscriptionService("/api/subscription");
