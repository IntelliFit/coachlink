import { CoachPlanInstanceRow } from "@/types";
import { Json } from "@/types/database.types";

// 请求参数的接口类型
export interface UpdateInstanceDto {
    id: string;
    name?: string;
    description?: string | null;
    coachId?: string | null;
    studentId?: string | null;
    templateId?: string | null;
    tags?: string[] | null;
    type?: string | null;
    suitableFor?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    status?: string | null;

    /**
     * Optional: student migrated mid-cycle. 1-based day index in the plan.
     * If provided, days before it will be treated as "already completed" for navigation/unlock.
     */
    startExecutionDay?: number | null;
    trainingDays?: Json;
}

// 返回参数的接口类型
export interface UpdateInstanceResponseDto {
    instance: CoachPlanInstanceRow;
}