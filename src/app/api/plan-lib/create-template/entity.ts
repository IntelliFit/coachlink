import { CoachPlanTemplateRow } from "@/types";
import { TrainingOptionQuestion } from "@/types/questionnaires";

// 训练日和动作里混有问卷题、动作数组这类 interface 值，归不进 Json 索引签名；额外字段本来就不限类型。
export interface CoachPlanAction {
    // action-lib 中的编号
    type: 'no-filter';
    actionId: string
    setName: string
    params: any;
    [key: string]: any
}

export interface CoachPlanActionWithOneFilter {
    type: 'one-filter';
    question: Omit<TrainingOptionQuestion, ''>;
    actions: CoachPlanAction[];
    dayIndex: number;
    [key: string]: any
}

// 计划日创建信息，包含动作组
export interface CoachPlanTrainingDay {
    type: 'training' | 'rest';
    note?: string;
    actionSets?: (CoachPlanAction | CoachPlanActionWithOneFilter)[];
    dayIndex: number;
    [key: string]: any
}

export interface CoachPlanTrainingImplementationDay {
    type: 'training' | 'rest';
    note?: string;
    actionSets?: CoachPlanAction[];
    dayIndex: number;
    [key: string]: any
}

// 请求参数的接口类型
export interface AddTemplateDto {
    name: string;
    description?: string | null;
    executionNotice?: string | null;
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
    actionSets?: (CoachPlanAction | CoachPlanActionWithOneFilter)[];
}
