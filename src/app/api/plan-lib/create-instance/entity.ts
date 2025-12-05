import { CoachPlanInstanceRow } from "@/types";
import { Json } from "@/types/database.types";

// 请求参数的接口类型
export interface CreateInstanceDto {
    subscriptionId: string;
    templateId?: string | null;

    name: string;
    description?: string | null;    
    tags?: string[] | null;
    type?: string | null;
    suitableFor?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    status?: string | null;
    trainingDays: Json;
}

// 返回参数的接口类型
export interface CreateInstanceResponseDto {
    instance: CoachPlanInstanceRow;
}