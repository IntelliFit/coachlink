// 请求参数的接口类型
export interface GetExecutionDto {
    id: string;
    mode?: string; // 'share' for share card data
}

// 返回参数的接口类型
export interface GetExecutionResponseDto {
    id: string;
    instance_id: string;
    student_id: string;
    dayIndex: number;
    status: string;
    action_executions: any[];
    total_sets: number;
    completed_sets: number;
    session_notes?: string;
    started_at: string;
    completed_at?: string;
    ended_at?: string;
    close_reason?: string;
}
