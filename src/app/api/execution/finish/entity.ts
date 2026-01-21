// 请求参数的接口类型
export interface FinishTrainingDto {
    executionId: string;
    sessionNotes?: string;
}

// 返回参数的接口类型
export interface FinishTrainingResponseDto {
    id: string;
    status: string;
    completed_at: string;
    completed_sets: number;
    total_sets: number;
}
