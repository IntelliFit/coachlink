import type { GetInstanceResponseDto } from "../get-instance/entity";

// POST /api/plan-lib/get-today-training-instance
export interface GetTodayTrainingInstanceDto {
    subscriptionIds?: string[]; // 活跃订阅ID列表
}

export interface GetTodayTrainingInstanceResponseDto {
    // 教练计划（如果有）
    coachPlan: GetInstanceResponseDto | null;
    // 自建计划（如果有）
    selfPlan: GetInstanceResponseDto | null;
}
