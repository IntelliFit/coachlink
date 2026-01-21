// 请求参数的接口类型
export interface GetPRRecordsDto {
    userId?: string; // Optional, for coaches to view their student's records
    limit?: number; // Max records to return (default 20)
    offset?: number; // Pagination offset (default 0)
    includeState?: boolean; // Include AUTO_STATE records
}

// 返回参数的接口类型
export interface PRRecord {
    id: string;
    exercise_name: string;
    weight: number; // Training weight
    reps: number; // Training reps
    e1rm: number; // Calculated e1RM
    load_formula: string;
    date_achieved: string;
    notes?: string;
    video_url?: string;
    action_id?: string;
    execution_id?: string;
    is_auto_calculated: boolean;
    created_at: string;
}

export interface GetPRRecordsResponseDto {
    records: PRRecord[];
    total: number;
}
