import { CoachesRow, CoachSubscriptionRow } from "@/types";

export interface CoachSubscriptionGetDto {
    studentId?: string;
    coachId?: string;
}

export interface CoachSubscriptionGetResponseDto {
    subscriptions: QueryCoachSubscription[];
    studentId?: string;
    coachId?: string;
}

export interface QueryCoachSubscription extends CoachSubscriptionRow {
    coach: CoachesRow | null;
}