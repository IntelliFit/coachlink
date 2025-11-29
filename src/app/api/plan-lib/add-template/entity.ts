import { CoachPlanTemplateRow } from "@/types";
import { Json } from "@/types/database.types";

export interface CoachPlanAction {
    // action-lib 中的编号
    action_id: string
    intensity: string
    reps: number
    rest_seconds: number
    sets: number
    [key: string]: Json | undefined
}

// 计划日创建信息，包含动作组
export interface CoachPlanTrainingDay {
    type: string;
    note?: string;
    action_sets?: CoachPlanAction[];
    [key: string]: Json | undefined
}

// 请求参数的接口类型
export interface AddTemplateDto {
    name: string;
    description?: string | null;
    tags: string[];
    suitableFor: string;
    trainingDays: CoachPlanTrainingDay[];
}

// 返回参数的接口类型
export interface AddTemplateResponseDto {
    template: CoachPlanTemplateRow;
}