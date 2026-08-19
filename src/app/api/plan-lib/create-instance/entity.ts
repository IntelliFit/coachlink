import { CoachPlanInstanceRow } from "@/types";
import { Json } from "@/types/database.types";

// 请求参数的接口类型
export interface CreateInstanceDto {
    subscriptionId: string;
    templateId?: string | null;

    name: string;
    description?: string | null;    
    executionNotice?: string | null;
    tags?: string[] | null;
    type?: string | null;
    suitableFor?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    status?: string | null;

    /**
     * When present, this create is a content revision of the given current
     * instance. The server preserves the original D1 and derives the next
     * executable training day from that instance's real execution history.
     */
    revisionOfInstanceId?: string | null;

    /**
     * Optional: if the student is migrating mid-cycle, specify where they should start.
     * startExecutionDay will be computed as (startWeek - 1) * 7 + startDay.
     */
    startWeek?: number;
    startDay?: number;
    trainingDays: Json;
}

// 返回参数的接口类型
export interface CreateInstanceResponseDto {
    instance: CoachPlanInstanceRow;
}
