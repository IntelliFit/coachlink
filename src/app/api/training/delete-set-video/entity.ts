// 删除组视频的请求和响应类型定义

export interface DeleteSetVideoDto {
    video_id: string;
}

export interface DeleteSetVideoResponseDto {
    success: boolean;
    message?: string;
}

