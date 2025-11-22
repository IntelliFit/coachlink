// 获取训练记录请求和响应的类型定义

export interface GetTrainingRecordDto {
    training_plan_id: string;
    week_number: number;
    day_number: number;
    training_date?: string; // 可选，如果不提供则使用今天
    read_only?: boolean; // 是否只读模式（查看历史记录）
}

export interface GetTrainingRecordResponseDto {
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
        completed_at?: string;
        duration_minutes?: number;
        status: 'in_progress' | 'completed' | 'abandoned';
        notes?: string;
        rpe?: number;
        energy_level?: number;
        created_at: string;
        updated_at: string;
    } | null;
}


