// 获取训练中心数据的请求和响应类型定义

export interface GetHubDataDto {
    training_plan_id: string;
}

export interface TrainingRecord {
    id: string;
    week_number: number;
    day_number: number;
    completed_sets: number;
    total_sets: number;
    status: string;
    training_date?: string;
}

export interface WeekDay {
    day_of_week: string;
    session_focus: string;
    order_index: number;
}

export interface GetHubDataResponseDto {
    current_week: number;
    today_record: TrainingRecord | null;
    today_week_days: WeekDay[];
    training_plan: {
        id: string;
        title: string;
        description: string;
        duration_weeks: number;
        difficulty_level: string;
        ai_generated: boolean;
        coach_reviewed: boolean;
        created_at: string;
    } | null;
}








