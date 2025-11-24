// 保存训练记录请求和响应的类型定义

import type { ExerciseRecord, TrainingStatus } from '@/types/training-execution';

export interface SaveTrainingRecordDto {
    training_record_id?: string; // 如果提供则更新，否则创建
    training_plan_id: string;
    week_number: number;
    day_number: number;
    training_date: string;
    exercises: ExerciseRecord[];
    status?: TrainingStatus;
    notes?: string;
}

export interface SaveTrainingRecordResponseDto {
    record: {
        id: string;
        user_id: string;
        plan_id: string;
        training_date: string;
        week_number: number;
        day_number: number;
        exercises: ExerciseRecord[];
        total_sets: number;
        completed_sets: number;
        skipped_sets: number;
        started_at: string;
        completed_at?: string;
        duration_minutes?: number;
        status: TrainingStatus;
        notes?: string;
        rpe?: number;
        energy_level?: number;
        created_at: string;
        updated_at: string;
    };
}


