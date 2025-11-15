// 删除视频请求和响应的类型定义

export interface DeleteVideoDto {
    videoId: string;
    userId: string;
}

export interface DeleteVideoResponseDto {
    success: boolean;
    message: string;
    data: null;
}