import { BaseService } from "@/lib/baseService";

// 导入视频服务相关的类型定义
import type { UploadVideoDto, UploadVideoResponseDto, VideoUploadContext, VideoUploadProgress } from "../api/user/upload-video/entity";
import type { SubmitVideoUrlDto, SubmitVideoUrlResponseDto } from "../api/user/submit-video-url/entity";
import type { GetUserVideosDto, GetUserVideosResponseDto, VideoFilters } from "../api/user/get-user-videos/entity";
import type { GetCoachPendingReviewsDto, GetCoachPendingReviewsResponseDto, ReviewStatus } from "../api/user/get-coach-pending-reviews/entity";
import type { ReviewVideoDto, ReviewVideoResponseDto } from "../api/user/review-video/entity";
import type { DeleteVideoDto, DeleteVideoResponseDto } from "../api/user/delete-video/entity";
import type { UpdateVideoDto, UpdateVideoResponseDto } from "../api/user/update-video/entity";
import type { GetVideoByIdDto, GetVideoByIdResponseDto } from "../api/user/get-video-by-id/entity";

class VideoService extends BaseService {

    // 上传视频文件
    async uploadVideo(reqData: UploadVideoDto) {
        const res = await this.post<UploadVideoResponseDto>('upload-video', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }

    // 以 form-data 上传真实视频文件（组件在用）
    async uploadVideoFile(
        userId: string,
        file: File,
        context: VideoUploadContext,
        onUploadProgress?: (progress: VideoUploadProgress) => void
    ) {
        // 前端直传到 Supabase Storage，避免 Next.js 开发模式偶发的 Request body lock
        onUploadProgress?.({ loaded: 0, total: file.size, percentage: 0 });

        const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
        const filePath = `${userId}/${safeName}`;

        const { error: uploadError } = await supabaseBrowser.storage.from('videos').upload(filePath, file, { upsert: false });
        if (uploadError) {
            throw uploadError as unknown as Error;
        }

        const { data: { publicUrl } } = supabaseBrowser.storage.from('videos').getPublicUrl(filePath);

        // 写入数据库记录，复用 submit-video-url 接口（仅 JSON）
        const res = await this.post<SubmitVideoUrlResponseDto>('submit-video-url', {
            videoUrl: publicUrl,
            context: { ...context, user_id: userId }
        });

        onUploadProgress?.({ loaded: file.size, total: file.size, percentage: 100 });

        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }
    
    // 提交视频URL
    async submitVideoUrl(reqData: SubmitVideoUrlDto) {
        const res = await this.post<SubmitVideoUrlResponseDto>('submit-video-url', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }
    
    // 获取用户视频列表
    async getUserVideos(reqData: GetUserVideosDto) {
        const res = await this.post<GetUserVideosResponseDto>('get-user-videos', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }
    
    // 获取教练待点评视频
    async getCoachPendingReviews(reqData: GetCoachPendingReviewsDto) {
        const res = await this.post<GetCoachPendingReviewsResponseDto>('get-coach-pending-reviews', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }
    
    // 教练点评视频
    async reviewVideo(reqData: ReviewVideoDto) {
        const res = await this.post<ReviewVideoResponseDto>('review-video', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }
    
    // 删除视频（软删除）
    async deleteVideo(reqData: DeleteVideoDto) {
        const res = await this.post<DeleteVideoResponseDto>('delete-video', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }
    
    // 更新视频信息
    async updateVideo(reqData: UpdateVideoDto) {
        const res = await this.post<UpdateVideoResponseDto>('update-video', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }
    
    // 获取单个视频详情
    async getVideoById(reqData: GetVideoByIdDto) {
        const res = await this.post<GetVideoByIdResponseDto>('get-video-by-id', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }
}

export const videoService = new VideoService('/api/user');
