import { CoachesRow, CoachSubscriptionRow } from "@/types";

export interface CoachSubscriptionGetDto {
    studentId?: string;
    coachId?: string;
    onlyActive?: boolean;
}

export interface CoachSubscriptionGetResponseDto {
    subscriptions: QueryCoachSubscription[];
    studentId?: string;
    coachId?: string;
}

export interface QueryCoachSubscription extends CoachSubscriptionRow {
    coach: CoachesRow | null;
    subscribed_weeks?: number | null;
}
