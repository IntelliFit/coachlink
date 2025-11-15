// 提交训练日志请求和响应的类型定义

export interface WorkoutLogPayload {
    userId?: string;
    training_session_id?: string;
    training_plan_id?: string;
    week_number?: number;
    day_of_week?: string;
    log_date?: string;
    entries?: any;
    notes?: string;
    video_urls?: string[];
}

export interface SubmitWorkoutLogDto {
    userId: string;
    payload: WorkoutLogPayload;
}

export interface SubmitWorkoutLogResponseDto {
    success: boolean;
    message: string;
    data: any;
}