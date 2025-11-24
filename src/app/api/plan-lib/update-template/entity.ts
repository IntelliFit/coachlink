import { CoachPlanTemplateRow, CoachPlanDaysRow, CoachPlanActionSetsRow } from "@/types";

// 计划日更新信息，包含动作组
export interface CoachPlanDayUpdate {
    id?: string; // 如果提供，则更新现有记录，否则创建新记录
    day_index: number;
    type: string; // rest | training
    note?: string | null;
    action_sets?: (Omit<CoachPlanActionSetsRow, 'id' | 'day_id' | 'created_at' | 'updated_at'> & { id?: string })[];
}

// 请求参数的接口类型
export interface UpdateTemplateDto {
    id: string;
    name?: string;
    description?: string | null;
    type?: string; // beginner | strength | custom
    days?: CoachPlanDayUpdate[];
}

// 返回参数的接口类型
export interface UpdateTemplateResponseDto {
    template: CoachPlanTemplateRow;
}