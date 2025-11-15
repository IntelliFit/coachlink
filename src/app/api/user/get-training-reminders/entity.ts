// 训练提醒相关请求和响应的类型定义

// 基础训练提醒类型
export interface TrainingReminder {
    id?: string;
    user_id: string;
    training_plan_id: string;
    reminder_type: 'daily' | 'weekly' | 'custom';
    reminder_time: string;
    days_of_week?: string[];
    is_active: boolean;
    created_at?: string;
}

// 获取训练提醒请求和响应类型
export interface GetTrainingRemindersDto {
    training_plan_id: string;
}

export interface GetTrainingRemindersResponseDto {
    reminders: TrainingReminder[];
}