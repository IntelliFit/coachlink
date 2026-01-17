// 提交视频URL请求和响应的类型定义
import { TrainingVideo, VideoUploadContext } from '@/types/video';

export type { TrainingVideo, VideoUploadContext };

export interface SubmitVideoUrlDto {
    videoUrl: string;
    context: VideoUploadContext;
    /**
     * Optional: when the URL points to our own Storage public URL.
     * Used for quota accounting and better metadata.
     */
    fileSizeBytes?: number;
    metadata?: Record<string, any>;
}

export type SubmitVideoUrlResponseDto = TrainingVideo;