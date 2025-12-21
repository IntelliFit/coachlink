import { CoachesRow, CoachSubscriptionRow, UserProfilesRow } from "@/types";

export interface ListSubscriptionGetDto {
    studentId?: string;
    coachId?: string;
    tier?: 1 | 2 | 3;
    status?: string;
    page?: number;
    limit?: number;
}

export interface ListSubscriptionGetResponseDto {
    subscriptions: QueryCoachSubscription[];
    studentId?: string;
    coachId?: string;
    total?: number;
    page?: number;
    limit?: number;
}

export interface QueryCoachSubscription extends CoachSubscriptionRow {
    coach: CoachesRow | null;
    studentProfile?: UserProfilesRow | null;
    coachProfile?: UserProfilesRow | null;
}