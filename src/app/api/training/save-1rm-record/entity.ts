// 保存1RM记录的接口类型

// 请求参数的接口类型
export interface Save1RMRecordDto {
    exercise_name: string;
    weight: number; // Training weight
    reps?: number; // Training reps (default 1)
    action_id?: string; // Optional action ID for linking
    notes?: string;
}

// 返回参数的接口类型
export interface Save1RMRecordResponseDto {
    record_id: string;
    is_new_record: boolean;
    e1rm?: number; // Calculated e1RM
}
