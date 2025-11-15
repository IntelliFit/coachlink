// 教练点评视频请求和响应的类型定义
import { TrainingVideo } from '@/types/video';

export type { TrainingVideo };

export interface ReviewVideoDto {
    videoId: string;
    coachId: string;
    coachName: string;
    feedback: {
        rating?: number;
        comment?: string;
        tips?: string[];
    };
}

export interface ReviewVideoResponseDto {
    success: boolean;
    message: string;
    data: TrainingVideo;
}