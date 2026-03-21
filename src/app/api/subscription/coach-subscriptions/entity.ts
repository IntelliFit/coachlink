import { CoachesRow, CoachSubscriptionRow } from "@/types";

export interface CoachSubscriptionGetDto {
    studentId?: string;
    coachId?: string;
    onlyActive?: boolean;
    /**
     * Whether to compute pause-aware end_date (may require extra queries).
     * Defaults to true for backward compatibility.
     */
    computePauseAwareEndDate?: boolean;
}

export interface CoachSubscriptionGetResponseDto {
    subscriptions: QueryCoachSubscription[];
    studentId?: string;
    coachId?: string;
}

export interface QueryCoachSubscription extends CoachSubscriptionRow {
    coach: CoachesRow | null;
    subscribed_weeks?: number | null;
    /** Whether a plan instance has been assigned under this subscription (coach_plan_instances exists) */
    has_plan_instance?: boolean;
    /** Latest plan instance id (for debugging / deep links) */
    latest_plan_instance_id?: string | null;
    /** Derived lifecycle status for student UX (active / grace expired / auto-cancelled) */
    lifecycle_status?: "active" | "expired_grace" | "expired_cancelled";
    /** Whether currently in the 14-day renewal grace period */
    is_in_grace_period?: boolean;
    /** Remaining grace days before auto-cancel */
    grace_days_left?: number;
    /** ISO datetime when grace period ends */
    grace_deadline_at?: string | null;
}
