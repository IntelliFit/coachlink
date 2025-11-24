import { TrainingPlanRow } from "@/types";

export interface ListPlansDto {
    search?: string;
    type?: string; // 训练类型筛选: strength(力量), endurance(耐力), flexibility(柔韧性), other(其他)
    page: number;
    limit: number;
}

export interface ListPlansResponseDto {
    plans: TrainingPlanRow[];
    totalCount: number;
    page: number;
    limit: number;
}