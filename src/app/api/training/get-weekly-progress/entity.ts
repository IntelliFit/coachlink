// 获取周进度请求和响应的类型定义

export interface GetWeeklyProgressDto {
    training_plan_id: string;
    time_range: 'week' | 'month' | 'all';
}

export interface WeeklyProgress {
    week: number;
    completed: number;
    total: number;
    percentage: number;
}

export interface GetWeeklyProgressResponseDto {
    weeklyProgress: WeeklyProgress[];
}

