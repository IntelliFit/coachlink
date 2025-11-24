import { CoachPlanTemplateRow, CoachPlanDaysRow, CoachPlanActionSetsRow } from "@/types";

// 计划日创建信息，包含动作组
export interface CoachPlanDayCreate {
    day_index: number;
    type: string; // rest | training
    note?: string | null;
    action_sets?: Omit<CoachPlanActionSetsRow, 'id' | 'day_id' | 'created_at' | 'updated_at'>[];
}

// 请求参数的接口类型
export interface AddTemplateDto {
    name: string;
    description?: string | null;
    type: string; // beginner | strength | custom
    days: CoachPlanDayCreate[];
}

// 返回参数的接口类型
export interface AddTemplateResponseDto {
    template: CoachPlanTemplateRow;
}