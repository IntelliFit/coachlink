import { TrainingVideoRow, ExecutionSetVideoRow } from '@/types';
import { BaseService } from '@/lib/baseService';
import type { GetPendingReviewVideosDto, GetPendingReviewVideosResponseDto } from '@/app/api/coach/video/coach-pending/entity';
import type { GetExecutionSetVideosDto, GetExecutionSetVideosResponseDto, ExecutionSetVideoWithDetails } from '@/app/api/coach/video/execution-videos-pending/entity';
import type { ReviewExecutionVideoResponseDto } from '@/app/api/coach/video/execution-review/entity';

/**
 * 教练端视频服务
 * 注意：只包含教练专属功能（查看待点评列表、点评视频）
 * 其他视频操作（上传、删除、更新）请使用 videoService（/api/user）
 */
class CoachVideoService extends BaseService {

    // 获取教练待点评视频列表（旧版 training_videos）
    async getCoachPendingReviews(reqData: GetPendingReviewVideosDto) {
        try {
            const res = await this.post<GetPendingReviewVideosResponseDto>('coach-pending', reqData);
            return res.data.data;
        } catch (err) {
            console.error('获取教练待点评视频失败:', err);
            return null;
        }
    }

    // 获取教练待点评视频列表（新版 execution_set_videos）
    async getExecutionSetVideos(reqData: GetExecutionSetVideosDto) {
        try {
            const res = await this.post<GetExecutionSetVideosResponseDto>('execution-videos-pending', reqData);
            return res.data.data;
        } catch (err) {
            console.error('获取教练待点评视频失败:', err);
            return null;
        }
    }

    // 教练点评视频（旧版 training_videos）
    async reviewVideo(
        videoId: string,
        feedback: { rating?: number; comment?: string; tips?: string[] }
    ): Promise<TrainingVideoRow | null> {
        try {
            const res = await this.post('review', {
                videoId,
                feedback,
            });
            return res.data.data || null;
        } catch (err) {
            console.error('点评视频失败:', err);
            return null;
        }
    }

    // 教练点评视频（新版 execution_set_videos）
    async reviewExecutionVideo(
        videoId: string,
        feedback: { rating?: number; comment?: string; tips?: string[] }
    ): Promise<ExecutionSetVideoRow | null> {
        try {
            const res = await this.post<ReviewExecutionVideoResponseDto>('execution-review', {
                videoId,
                feedback,
            });
            return res.data.data || null;
        } catch (err) {
            console.error('点评视频失败:', err);
            return null;
        }
    }
}

export const coachVideoService = new CoachVideoService('/api/coach/video');
