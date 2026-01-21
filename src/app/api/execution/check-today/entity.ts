// 请求参数的接口类型
export interface CheckTodayDto {
    instanceId: string;
    dayIndex?: number;
}

// 返回参数的接口类型
export interface CheckTodayResponseDto {
    id?: string;
    status?: string;
    completed_sets?: number;
    total_sets?: number;
    started_at?: string;
    completed_at?: string;
}
