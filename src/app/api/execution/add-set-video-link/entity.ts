// 请求参数的接口类型
export interface AddSetVideoLinkDto {
    executionId: string;
    actionId: string;
    setNumber: number;
    videoUrl: string;
}

// 返回参数的接口类型
export interface AddSetVideoLinkResponseDto {
    id: string;
    execution_id: string;
    action_id: string;
    set_number: number;
    video_url: string;
    storage_path: string;
}
