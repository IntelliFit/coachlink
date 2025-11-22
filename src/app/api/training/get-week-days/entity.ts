// 获取训练日的请求和响应类型定义

export interface GetWeekDaysDto {
    training_plan_id: string;
    week_number: number;
}

export interface WeekDay {
    day_of_week: string;
    session_focus: string;
    order_index: number;
}

export interface GetWeekDaysResponseDto {
    week_days: WeekDay[];
}








