import { CoachPlanTemplateRow } from "@/types";

export interface ListTemplatesDto {
    search?: string;
    type?: string; // 训练类型筛选: beginner(新手), strength(力量), custom(自定义)
    page: number;
    limit: number;
}

export interface CoachPlansPreview {
    id: string;
    name: string;
    description: string | null;
    tags: string[];
    suitableFor: string;
    restDaysCount: number;
    trainingDaysCount: number;
    containedOptions: string[];
    weekDays: number[];
    globalAnswers: Record<string, number> | null;

    createdAt: string;
    updatedAt: string;
}

export interface ListTemplatesResponseDto {
    templates: CoachPlansPreview[];
    totalCount: number;
    page: number;
    limit: number;
}
