/**
 * 获取训练日日期信息的请求参数
 */
export interface GetTrainingDayDateDto {
    training_plan_id: string;
    week_number: number;
    day_number: number;
}

/**
 * 训练日状态
 */
export type TrainingDayStatus = 'past' | 'today' | 'future';

/**
 * 获取训练日日期信息的响应数据
 */
export interface GetTrainingDayDateResponseDto {
    success: boolean;
    data?: {
        training_plan_id: string;
        week_number: number;
        day_number: number;
        planned_date: string; // ISO 8601 格式
        training_day_status: TrainingDayStatus;
        should_be_read_only: boolean;
        has_training_record: boolean;
        training_record_id: string | null;
        training_record_status: string | null;
        training_record_updated_at: string | null;
        training_record_completed_at: string | null;
    };
    error?: string;
}

