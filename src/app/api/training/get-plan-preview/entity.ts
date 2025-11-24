/**
 * 获取训练计划预览的 DTO 定义
 */

export interface GetPlanPreviewDto {
    training_plan_id: string;
}

export interface ExercisePreview {
    name: string;
    sets: number | string;
    reps: number | string;
    load_type?: string;
    load_value?: number;
    rest_sec?: number;
    notes?: string;
}

export interface SessionPreview {
    day: string;  // "Mon", "Tue", "Wed", etc.
    focus: string;
    main: ExercisePreview[];
    accessories: ExercisePreview[];
    notes?: string;
}

export interface WeekPreview {
    week: number;
    sessions: SessionPreview[];
}

export interface PlanMeta {
    title: string;
    description?: string;
    duration_weeks: number;
    frequency_per_week: number;
    experience_level: string;
}

export interface PlanPreview {
    meta: PlanMeta;
    weeks: WeekPreview[];
}

export interface GetPlanPreviewResponseDto {
    success: boolean;
    data: PlanPreview | null;
    message?: string;
}




