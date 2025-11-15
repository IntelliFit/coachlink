// 更新训练提醒请求和响应的类型定义

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

export interface UpdateTrainingReminderDto {
    id: string;
    updates: Partial<{
        reminder_type: 'daily' | 'weekly' | 'custom';
        reminder_time: string;
        days_of_week: string[];
        is_active: boolean;
    }>;
}

export interface UpdateTrainingReminderResponseDto {
    reminder: TrainingReminder;
}