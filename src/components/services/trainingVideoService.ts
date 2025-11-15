
import { videoService, type VideoUploadContext, type VideoUploadProgress, type TrainingVideo } from '@/app/service/videoService';
import { studentService } from '@/app/service/studentService';


class TrainingVideoService {
    // 上传视频文件
    async uploadVideoFile(
        userId: string,
        file: File,
        context: VideoUploadContext,
        onProgress?: (progress: VideoUploadProgress) => void
    ): Promise<TrainingVideo> {
        try {
            // 创建 FormData 对象来发送文件
            const formData = new FormData();
            formData.append('file', file);
            formData.append('userId', userId);
            formData.append('context', JSON.stringify(context));

            // 由于这是文件上传，我们需要特殊处理
            // 这里我们模拟上传过程并直接调用 videoService
            if (onProgress && file.size) {
                try {
                    onProgress({ loaded: file.size, total: file.size, percentage: 100 });
                } catch { }
            }

            // 注意：实际的文件上传需要通过 API 路由处理，这里仅为示例
            // 在实际项目中，应该创建一个专门的 API 路由来处理文件上传
            const data = await videoService.uploadVideo({ userId, context });
            
            if (!data) {
                throw new Error('上传失败');
            }

            return data;
        } catch (error) {
            console.error('上传视频文件失败:', error);
            throw error;
        }
    }

    // 提交视频URL
    async submitVideoUrl(
        userId: string,
        videoUrl: string,
        context: VideoUploadContext
    ): Promise<TrainingVideo> {
        try {
            const data = await videoService.submitVideoUrl({ userId, videoUrl, context });
            
            if (!data) {
                throw new Error('提交视频URL失败');
            }

            return data;
        } catch (error) {
            console.error('提交视频URL失败:', error);
            throw error;
        }
    }

    // 获取用户视频列表
    async getUserVideos(
        userId: string,
        filters?: VideoFilters,
        pagination?: { page: number; limit: number }
    ): Promise<{
        videos: TrainingVideo[];
        total: number;
    }> {
        try {
            const data = await videoService.getUserVideos({ userId, filters, pagination });
            
            if (!data) {
                throw new Error('获取视频列表失败');
            }

            return data;
        } catch (error) {
            console.error('获取用户视频失败:', error);
            throw error;
        }
    }

    // 获取教练待点评视频
    async getCoachPendingReviews(
        coachId: string,
        pagination?: { page: number; limit: number },
        reviewStatus?: ReviewStatus
    ): Promise<{
        videos: TrainingVideo[];
        total: number;
    }> {
        try {
            const data = await videoService.getCoachPendingReviews({ coachId, pagination, reviewStatus });
            
            if (!data) {
                throw new Error('获取待点评视频失败');
            }

            return data;
        } catch (error) {
            console.error('获取教练待点评视频失败:', error);
            throw error;
        }
    }

    // 教练点评视频
    async reviewVideo(
        videoId: string,
        coachId: string,
        coachName: string,
        feedback: {
            rating?: number;
            comment?: string;
            tips?: string[];
        }
    ): Promise<TrainingVideo> {
        try {
            const data = await videoService.reviewVideo({ videoId, coachId, coachName, feedback });
            
            if (!data) {
                throw new Error('更新点评失败');
            }

            return data;
        } catch (error) {
            console.error('点评视频失败:', error);
            throw error;
        }
    }

    // 删除视频（软删除）
    async deleteVideo(videoId: string, userId: string): Promise<void> {
        try {
            const data = await videoService.deleteVideo({ videoId, userId });
            
            if (!data) {
                throw new Error('删除视频失败');
            }
        } catch (error) {
            console.error('删除视频失败:', error);
            throw error;
        }
    }

    // 更新视频信息
    async updateVideo(
        videoId: string,
        userId: string,
        updates: Partial<Pick<TrainingVideo, 'user_notes' | 'tags' | 'requires_review'>>
    ): Promise<TrainingVideo> {
        try {
            const data = await videoService.updateVideo({ videoId, userId, updates });
            
            if (!data) {
                throw new Error('更新视频失败');
            }

            return data;
        } catch (error) {
            console.error('更新视频失败:', error);
            throw error;
        }
    }

    // 获取单个视频详情
    async getVideoById(videoId: string): Promise<TrainingVideo | null> {
        try {
            const data = await videoService.getVideoById({ videoId });
            return data;
        } catch (error) {
            console.error('获取视频详情失败:', error);
            throw error;
        }
    }
}

export default new TrainingVideoService();