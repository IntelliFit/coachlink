import { TrainingVideo } from '@/types';
import { ReviewStatus, VideoUploadContext } from '@/types/coach';
import { BaseService } from '@/lib/baseService';
import type { GetPendingReviewVideosDto, GetPendingReviewVideosResponseDto } from '@/app/api/coach/video/coach-pending/entity';

class CoachVideoService extends BaseService {

    // 获取视频详情
    async getVideoById(videoId: string): Promise<TrainingVideo | null> {
        
        try {
            const res = await this.post(videoId);
            return res.data.data || null;
        } catch (err) {
            console.error('获取视频详情失败:', err);
            return null;
        }
    }

    // 获取教练待点评视频
    async getCoachPendingReviews(reqData: GetPendingReviewVideosDto) {
        try {
            const res = await this.post<GetPendingReviewVideosResponseDto>('coach-pending', reqData);
            return res.data.data;
        } catch (err) {
            console.error('获取教练待点评视频失败:', err);
            return null;
        }
    }

    // 获取用户视频列表
    async getUserVideos(userId: string, filters?: any, pagination?: { page: number; limit: number }) {
        try {
            const res = await this.post('list', {
                userId,
                filters,
                pagination,
            });
            return res.data.data || { videos: [], total: 0 };
        } catch (err) {
            console.error('获取用户视频失败:', err);
            return { videos: [], total: 0 };
        }
    }

    // 上传视频文件
    async uploadVideoFile(
        file: File,
        context: VideoUploadContext,
        onUploadProgress?: (progressEvent: ProgressEvent) => void
    ): Promise<TrainingVideo | null> {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('context', JSON.stringify(context));

            const res = await this.post('upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (evt) => {
                    // 手动转换为类似 ProgressEvent 的对象结构
                    if (onUploadProgress) {
                        onUploadProgress(evt as unknown as ProgressEvent);
                    }
                },
            });


            return res.data.data || null;
        } catch (err) {
            console.error('上传视频失败:', err);
            return null;
        }
    }

    // 提交视频 URL
    async submitVideoUrl(videoUrl: string, context: VideoUploadContext): Promise<TrainingVideo | null> {
        try {
            const res = await this.post('submit-url', {
                videoUrl,
                context,
            });
            return res.data.data || null;
        } catch (err) {
            console.error('提交视频URL失败:', err);
            return null;
        }
    }

    // 教练点评视频
    async reviewVideo(
        videoId: string,
        feedback: { rating?: number; comment?: string; tips?: string[] }
    ): Promise<TrainingVideo | null> {
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

    // 更新视频信息
    async updateVideo(
        videoId: string,
        updates: Partial<Pick<TrainingVideo, 'user_notes' | 'tags' | 'requires_review'>>
    ): Promise<TrainingVideo | null> {
        try {
            const res = await this.post('update', {
                videoId,
                updates,
            });
            return res.data.data || null;
        } catch (err) {
            console.error('更新视频失败:', err);
            return null;
        }
    }

    // 删除视频（软删除）
    async deleteVideo(videoId: string): Promise<boolean> {
        try {
            const res = await this.post('delete', { videoId });
            return res.data.data;
        } catch (err) {
            console.error('删除视频失败:', err);
            return false;
        }
    }


}

export const coachVideoService = new CoachVideoService('/api/coach/video');
