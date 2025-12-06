import { CoachPlanInstanceRow } from "@/types";

// GET /api/plan-lib/get-instance
export interface GetInstanceRequestDto {
    id?: string;
    subscriptionId?: string;
}

export interface GetInstanceResponseDto {
    instance: any; // CoachPlanInstance
    actions?: Record<string, any>; // Map of action_id -> action details
}
