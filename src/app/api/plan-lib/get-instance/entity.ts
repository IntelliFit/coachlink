import { CoachPlanInstanceRow } from "@/types";

// GET /api/plan-lib/get-instance
export interface GetInstanceDto {
    id?: string;
    subscriptionId?: string;
    fetchSelf?: boolean;
}

export interface GetInstanceResponseDto {
    instance: any; // CoachPlanInstance
    actions?: Record<string, any>; // Map of action_id -> action details
}
