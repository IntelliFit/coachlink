import { CoachPlanTemplateRow, CoachPlanDaysRow, CoachPlanActionSetsRow } from "@/types";

// 请求参数的接口类型
export interface GetTemplateDto {
    id: string;
}

// 计划日详情，包含动作组 - 修改为与CoachPlanDayCreate相同的结构
export interface CoachPlanDayDetail {
    day_index: number;
    type: string; // rest | training
    note?: string | null;
    action_sets?: Omit<CoachPlanActionSetsRow, 'id' | 'day_id' | 'created_at' | 'updated_at'>[];
}

// 返回参数的接口类型
export interface GetTemplateResponseDto {
    template: Omit<CoachPlanTemplateRow, 'days'>; // 排除days字段因为单独返回
    days: CoachPlanDayDetail[];
}