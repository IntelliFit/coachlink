// 提交生活记录请求和响应的类型定义

export interface LifestyleLogPayload {
    log_date: string;
    sleep_hours?: number;
    sleep_quality?: number; // 1..5
    diet_notes?: string;
    meal_photos?: string[];
}

export interface SubmitLifestyleLogDto {
    userId: string;
    payload: LifestyleLogPayload;
}

export interface SubmitLifestyleLogResponseDto {
    success: boolean;
    message: string;
    data: any;
}