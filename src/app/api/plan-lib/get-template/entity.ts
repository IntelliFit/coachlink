import { CoachPlanTemplateRow, CoachPlanDaysRow, CoachPlanActionSetsRow } from "@/types";

// 请求参数的接口类型
export interface GetTemplateDto {
    id: string;
}

// 计划日详情，包含动作组
export interface CoachPlanDayDetail extends CoachPlanDaysRow {
    action_sets: CoachPlanActionSetsRow[];
}

// 返回参数的接口类型
export interface GetTemplateResponseDto {
    template: CoachPlanTemplateRow;
    days: CoachPlanDayDetail[];
}