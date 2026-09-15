import { CoachPlanInstanceRow } from "@/types";

// GET /api/plan-lib/get-instance
export interface GetInstanceDto {
    id?: string;
    subscriptionId?: string;
    subscriptionIds?: string[];
    fetchSelf?: boolean;
}

export interface GetInstanceResponseDto {
    instance: any; // CoachPlanInstance
    pendingRevision?: any; // Coach-only draft waiting for the current execution to close
    actions?: Record<string, any>; // Map of action_id -> action details
    aggregated1RM?: Record<string, number>; // 1RM aliases already resolved while calculating loads
    executions?: any[]; // Detailed executions list (if loaded)
    executionsByDayIndex?: Record<number, any>; // Map of day_index -> most relevant execution
    matchedSubscriptionId?: string; // For subscriptionIds[] queries, which subscription the instance belongs to

    // Derived fields (optional, backward-compatible)
    nextDayIndex?: number;
    completedDays?: number[];
    // spec v1 (self-consistent)
    recommendedDayIndex?: number;
    resolvedDays?: number[];
    missingDays?: number[];
    totalTrainingDays?: number;
    todayCompleted?: boolean;
    todayExecutionId?: string;
    completionDates?: Record<number, string>;
    resolvedTrainingDays?: number;
    isLogicallyCompleted?: boolean;
    derivedStatus?: string;
    entitlement?: any;
}
