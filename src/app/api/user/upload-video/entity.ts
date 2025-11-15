// 上传视频文件请求和响应的类型定义
import { TrainingVideo, VideoUploadContext, VideoUploadProgress } from '@/types/video';

export type { TrainingVideo, VideoUploadContext, VideoUploadProgress };

export interface UploadVideoDto {
    userId: string;
    context: VideoUploadContext;
}

export type UploadVideoResponseDto = TrainingVideo;