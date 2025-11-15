// 更新视频信息请求和响应的类型定义
import { TrainingVideo } from '@/types/video';

export type { TrainingVideo };

export interface UpdateVideoDto {
    videoId: string;
    userId: string;
    updates: Partial<Pick<TrainingVideo, 'user_notes' | 'tags' | 'requires_review'>>;
}

export type UpdateVideoResponseDto = TrainingVideo;