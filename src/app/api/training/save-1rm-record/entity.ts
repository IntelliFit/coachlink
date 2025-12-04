// 保存1RM记录的接口类型

// 请求参数的接口类型
export interface Save1RMRecordDto {
    exercise_name: string;
    max_weight: number;
    max_reps?: number;
    notes?: string;
}

// 返回参数的接口类型
export interface Save1RMRecordResponseDto {
    record_id: string;
    is_new_record: boolean;
}

