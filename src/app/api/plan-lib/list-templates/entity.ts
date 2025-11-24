import { CoachPlanTemplateRow } from "@/types";

export interface ListTemplatesDto {
    search?: string;
    type?: string; // 训练类型筛选: beginner(新手), strength(力量), custom(自定义)
    page: number;
    limit: number;
}

export interface ListTemplatesResponseDto {
    templates: CoachPlanTemplateRow[];
    totalCount: number;
    page: number;
    limit: number;
}