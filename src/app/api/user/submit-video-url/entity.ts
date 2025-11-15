// 提交视频URL请求和响应的类型定义
import { TrainingVideo, VideoUploadContext } from '@/types/video';

export type { TrainingVideo, VideoUploadContext };

export interface SubmitVideoUrlDto {
    userId: string;
    videoUrl: string;
    context: VideoUploadContext;
}

export interface SubmitVideoUrlResponseDto {
    success: boolean;
    message: string;
    data: TrainingVideo;
}