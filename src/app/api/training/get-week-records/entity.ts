// 获取某周训练记录的请求和响应类型定义

export interface GetWeekRecordsDto {
    training_plan_id: string;
    week_number: number;
}

export interface WeekDayRecord {
    day_of_week: string;
    status: 'in_progress' | 'completed' | 'abandoned' | null;
    completed_sets: number;
    total_sets: number;
    training_date: string;
}

export interface GetWeekRecordsResponseDto {
    records: WeekDayRecord[];
}

