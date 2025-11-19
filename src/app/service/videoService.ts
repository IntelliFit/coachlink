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
        file: File,
        context: VideoUploadContext,
        onUploadProgress?: (progress: VideoUploadProgress) => void
    ) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('context', JSON.stringify(context));

        const res = await this.post<UploadVideoResponseDto>('upload-video', formData, {
            onUploadProgress: (progressEvent) => {
                if (onUploadProgress && progressEvent.lengthComputable && progressEvent.total) {
                    const progress: VideoUploadProgress = {
                        loaded: progressEvent.loaded,
                        total: progressEvent.total,
                        percentage: Math.round((progressEvent.loaded / progressEvent.total) * 100)
                    };
                    onUploadProgress(progress);
                }
            }
        });

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
