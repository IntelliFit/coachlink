import { BaseService } from "@/lib/baseService";
import axios from "axios";
import { supabaseBrowser } from "@/lib/supabaseBrowserClient";

// 导入视频服务相关的类型定义
import type { UploadVideoDto, UploadVideoResponseDto, VideoUploadContext, VideoUploadProgress } from "../api/user/upload-video/entity";
import type { SubmitVideoUrlDto, SubmitVideoUrlResponseDto } from "../api/user/submit-video-url/entity";
import type { GetUserVideosDto, GetUserVideosResponseDto, VideoFilters } from "../api/user/get-user-videos/entity";
import type { GetCoachPendingReviewsDto, GetCoachPendingReviewsResponseDto, ReviewStatus } from "../api/user/get-coach-pending-reviews/entity";
import type { ReviewVideoDto, ReviewVideoResponseDto } from "../api/user/review-video/entity";
import type { DeleteVideoDto, DeleteVideoResponseDto } from "../api/user/delete-video/entity";
import type { UpdateVideoDto, UpdateVideoResponseDto } from "../api/user/update-video/entity";
import type { GetVideoByIdDto, GetVideoByIdResponseDto } from "../api/user/get-video-by-id/entity";
import type { AddVideoToCollectionDto, AddVideoToCollectionResponseDto } from "../api/user/add-video-to-collection/entity";
import type { ListVideoCollectionsDto, ListVideoCollectionsResponseDto } from "../api/user/list-video-collections/entity";
import type { UpdateVideoCollectionDto, UpdateVideoCollectionResponseDto } from "../api/user/update-video-collection/entity";
import type { DeleteVideoCollectionDto, DeleteVideoCollectionResponseDto } from "../api/user/delete-video-collection/entity";
import type { CreateVideoUploadUrlResponseDto } from "../api/user/create-video-upload-url/entity";

function getApiErrorMessage(err: unknown): string | null {
    if (axios.isAxiosError(err)) {
        const data: any = err.response?.data;
        return data?.message || err.message || null;
    }
    if (err instanceof Error) return err.message;
    return null;
}

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
        try {
            // 直传方案：
            // 1) 先向服务端申请 signed upload token（小请求，不承载视频数据）
            // 2) 直接把视频上传到 Supabase Storage（绕开宝塔/Nginx/Next 的大文件限制）
            // 3) 再调用 submit-video-url 写入数据库记录（并更新配额）

            if (!supabaseBrowser) {
                throw new Error("Supabase 客户端未初始化（缺少 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY）");
            }

            // best-effort progress for UI (no chunk progress with signed upload in SDK)
            onUploadProgress?.({ loaded: 0, total: file.size, percentage: 0 });

            const signRes = await this.post<CreateVideoUploadUrlResponseDto>(
                "create-video-upload-url",
                {
                    originalFilename: file.name,
                    contentType: file.type || "application/octet-stream",
                    fileSizeBytes: file.size,
                },
            );

            if (!signRes.data?.success || !signRes.data?.data?.token) {
                throw new Error(signRes.data?.message || "创建上传链接失败");
            }

            const { path, token, publicUrl } = signRes.data.data;

            const { error: uploadErr } = await supabaseBrowser.storage
                .from("videos")
                // @ts-expect-error: SDK typing differs across versions; runtime method exists in supabase-js v2
                .uploadToSignedUrl(path, token, file, {
                    contentType: file.type || "application/octet-stream",
                    upsert: false,
                });

            if (uploadErr) {
                throw new Error(uploadErr.message || "直传失败");
            }

            onUploadProgress?.({ loaded: file.size, total: file.size, percentage: 100 });

            // 写入数据库记录（并进行配额扣减/记录元数据）
            const record = await this.submitVideoUrl({
                videoUrl: publicUrl,
                context,
                fileSizeBytes: file.size,
                metadata: {
                    storage_bucket: "videos",
                    storage_path: path,
                    original_filename: file.name,
                    mime_type: file.type || "application/octet-stream",
                    submission_source: "direct_signed_upload",
                },
            } satisfies SubmitVideoUrlDto);

            return record as any;
        } catch (err) {
            throw new Error(getApiErrorMessage(err) || "上传失败");
        }
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

    async addVideoToCollection(reqData: AddVideoToCollectionDto) {
        const res = await this.post<AddVideoToCollectionResponseDto>('add-video-to-collection', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async listVideoCollections(reqData: ListVideoCollectionsDto) {
        const res = await this.post<ListVideoCollectionsResponseDto>('list-video-collections', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async updateVideoCollection(reqData: UpdateVideoCollectionDto) {
        const res = await this.post<UpdateVideoCollectionResponseDto>('update-video-collection', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async deleteVideoCollection(reqData: DeleteVideoCollectionDto) {
        const res = await this.post<DeleteVideoCollectionResponseDto>('delete-video-collection', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }
}

export const videoService = new VideoService('/api/user');
