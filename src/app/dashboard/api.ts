import { TrainingVideo } from '@/types';
import { ReviewStatus, VideoUploadContext } from '@/types/coach';
import axios from 'axios';

class CoachVideoService {
    // 获取视频详情
    async getVideoById(videoId: string): Promise<TrainingVideo | null> {
        try {
            const res = await axios.get(`/api/coach/video/${videoId}`);
            return res.data || null;
        } catch (err) {
            console.error('获取视频详情失败:', err);
            return null;
        }
    }

    // 获取教练待点评视频
    async getCoachPendingReviews(
        page?: number,
        limit?: number,
        reviewStatus?: ReviewStatus
    ): Promise<{ videos: TrainingVideo[]; total: number }> {
        try {
            const res = await axios.post(`/api/coach/video/coach-pending`, {
                pagination: { page, limit },
                reviewStatus,
            });
            return res.data || { videos: [], total: 0 };
        } catch (err) {
            console.error('获取教练待点评视频失败:', err);
            return { videos: [], total: 0 };
        }
    }

    // 获取用户视频列表
    async getUserVideos(userId: string, filters?: any, pagination?: { page: number; limit: number }) {
        try {
            const res = await axios.post(`/api/coach/video/list`, {
                userId,
                filters,
                pagination,
            });
            return res.data || { videos: [], total: 0 };
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

            const res = await axios.post(`/api/coach/video/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress,
            });

            return res.data || null;
        } catch (err) {
            console.error('上传视频失败:', err);
            return null;
        }
    }

    // 提交视频 URL
    async submitVideoUrl(videoUrl: string, context: VideoUploadContext): Promise<TrainingVideo | null> {
        try {
            const res = await axios.post(`/api/coach/video/submit-url`, {
                videoUrl,
                context,
            });
            return res.data || null;
        } catch (err) {
            console.error('提交视频URL失败:', err);
            return null;
        }
    }

    // 教练点评视频
    async reviewVideo(
        videoId: string,
        coachId: string,
        coachName: string,
        feedback: { rating?: number; comment?: string; tips?: string[] }
    ): Promise<TrainingVideo | null> {
        try {
            const res = await axios.post(`/api/coach/video/review`, {
                videoId,
                coachId,
                coachName,
                feedback,
            });
            return res.data || null;
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
            const res = await axios.post(`/api/coach/video/update`, {
                videoId,
                updates,
            });
            return res.data || null;
        } catch (err) {
            console.error('更新视频失败:', err);
            return null;
        }
    }

    // 删除视频（软删除）
    async deleteVideo(videoId: string): Promise<boolean> {
        try {
            const res = await axios.post(`/api/coach/video/delete`, { videoId });
            return !!res.data;
        } catch (err) {
            console.error('删除视频失败:', err);
            return false;
        }
    }
}

export const coachVideoService = new CoachVideoService();
