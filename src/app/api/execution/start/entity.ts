// 请求参数的接口类型
export interface StartExecutionDto {
    instanceId: string;
    dayIndex: number;
}

// 返回参数的接口类型
export interface StartExecutionResponseDto {
    id: string;
    instance_id: string;
    student_id: string;
    day_index: number;
    status: string;
    action_executions: any[];
    total_sets: number;
    completed_sets: number;
    started_at: string;
}
