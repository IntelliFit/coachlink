// 获取单个视频详情请求和响应的类型定义
import { TrainingVideo } from '@/types/video';

export type { TrainingVideo };

export interface GetVideoByIdDto {
    videoId: string;
}

export type GetVideoByIdResponseDto = TrainingVideo;