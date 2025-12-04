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
    startDate?: string | null;
    endDate?: string | null;
    status?: string | null;
    trainingDays?: Json;
}

// 返回参数的接口类型
export interface UpdateInstanceResponseDto {
    instance: CoachPlanInstanceRow;
}