// 完成训练请求和响应的类型定义

export interface FinishTrainingDto {
    training_record_id: string;
    notes?: string;
}

export interface FinishTrainingResponseDto {
    record: {
        id: string;
        user_id: string;
        plan_id: string;
        training_date: string;
        week_number: number;
        day_number: number;
        exercises: any[];
        total_sets: number;
        completed_sets: number;
        skipped_sets: number;
        started_at: string;
        completed_at: string;
        duration_minutes: number;
        status: 'completed';
        notes?: string;
        created_at: string;
        updated_at: string;
    };
}


