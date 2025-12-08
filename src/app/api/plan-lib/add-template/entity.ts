import { CoachPlanTemplateRow } from "@/types";
import { Json } from "@/types/database.types";

export interface CoachPlanAction {
    // action-lib 中的编号
    actionId: string
    setName: string
    params: any;
    [key: string]: Json | undefined
}

// 计划日创建信息，包含动作组
export interface CoachPlanTrainingDay {
    type: string;
    note?: string;
    actionSets?: CoachPlanAction[];
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

export interface FormPlanTrainingDay {
    dayIndex: number;
    actionSetsCount?: number;
    type: 'training' | 'rest';
    note: string;
    actionSets?: CoachPlanAction[];
}