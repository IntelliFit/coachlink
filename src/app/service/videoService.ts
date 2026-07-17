import { BaseService } from "@/lib/baseService";
import { prepareVideoForUpload } from "@/lib/videoCompression";
import axios from "axios";

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
    private emitUploadProgress(
        onUploadProgress: ((progress: VideoUploadProgress) => void) | undefined,
        progress: Partial<VideoUploadProgress> & Pick<VideoUploadProgress, "percentage">,
    ) {
        onUploadProgress?.({
            loaded: progress.loaded ?? 0,
            total: progress.total ?? 0,
            percentage: progress.percentage,
            phase: progress.phase,
            statusText: progress.statusText,
            originalSizeBytes: progress.originalSizeBytes,
            finalSizeBytes: progress.finalSizeBytes,
            compressed: progress.compressed,
        });
    }

    /** 直传：仅使用服务端下发的 uploadUrl，不携带任何 key */
    private async putWithProgress(
        uploadUrl: string,
        file: File,
        onUploadProgress?: (progress: VideoUploadProgress) => void,
    ) {
        const contentType = file.type || "application/octet-stream";

        return await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", uploadUrl);
            xhr.setRequestHeader("Content-Type", contentType);

            xhr.upload.onprogress = (evt) => {
                if (!evt.lengthComputable) return;
                const total = evt.total || file.size || 0;
                const loaded = evt.loaded || 0;
                const percentage = total
                    ? Math.min(99, Math.max(0, Math.round((loaded / total) * 100)))
                    : 0;
                onUploadProgress?.({ loaded, total, percentage });
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    onUploadProgress?.({
                        loaded: file.size,
                        total: file.size,
                        percentage: 100,
                    });
                    resolve();
                    return;
                }
                const detail = xhr.responseText
                    ? `（${xhr.status}）${xhr.responseText}`
                    : `（${xhr.status}）直传失败`;
                reject(new Error(detail));
            };
            xhr.onerror = () => reject(new Error("网络错误：上传中断"));
            xhr.onabort = () => reject(new Error("上传已取消"));

            xhr.send(file);
        });
    }

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

            let lastPercentage = 0;
            const emitProgress = (
                progress: Partial<VideoUploadProgress> & Pick<VideoUploadProgress, "percentage">,
            ) => {
                const nextPercentage = Math.min(
                    100,
                    Math.max(lastPercentage, Math.round(progress.percentage)),
                );
                lastPercentage = nextPercentage;
                this.emitUploadProgress(onUploadProgress, {
                    ...progress,
                    percentage: nextPercentage,
                });
            };

            emitProgress({
                loaded: 0,
                total: file.size,
                percentage: 0,
                phase: "preparing",
                statusText: "准备处理视频…",
                originalSizeBytes: file.size,
                finalSizeBytes: file.size,
                compressed: false,
            });

            const prepared = await prepareVideoForUpload(file, {
                onProgress: (progress) => {
                    const mappedPercentage = progress.phase === "compressing"
                        ? Math.round(10 + progress.percentage * 0.45)
                        : Math.round(progress.percentage * 0.1);

                    emitProgress({
                        loaded: 0,
                        total: file.size,
                        percentage: mappedPercentage,
                        phase: progress.phase,
                        statusText: progress.statusText,
                        originalSizeBytes: file.size,
                        finalSizeBytes: file.size,
                        compressed: false,
                    });
                },
            });

            const uploadFile = prepared.file;

            const signRes = await this.post<CreateVideoUploadUrlResponseDto>(
                "create-video-upload-url",
                {
                    originalFilename: uploadFile.name,
                    contentType: uploadFile.type || "application/octet-stream",
                    fileSizeBytes: uploadFile.size,
                },
            );

            if (!signRes.data?.success || !signRes.data?.data?.uploadUrl) {
                throw new Error(signRes.data?.message || "创建上传链接失败");
            }

            const { path, publicUrl, uploadUrl } = signRes.data.data;
            const uploadStartPercentage = prepared.compressed
                ? Math.max(lastPercentage, 55)
                : Math.max(lastPercentage, 10);

            emitProgress({
                loaded: 0,
                total: uploadFile.size,
                percentage: uploadStartPercentage,
                phase: "uploading",
                statusText: prepared.compressed ? "压缩完成，开始上传…" : "开始上传视频…",
                originalSizeBytes: prepared.originalFileSizeBytes,
                finalSizeBytes: prepared.finalFileSizeBytes,
                compressed: prepared.compressed,
            });

            // 直传：仅使用服务端下发的 uploadUrl，不暴露 key
            await this.putWithProgress(uploadUrl, uploadFile, (progress) => {
                const percentage = uploadStartPercentage +
                    (progress.percentage * (100 - uploadStartPercentage)) / 100;

                emitProgress({
                    loaded: progress.loaded,
                    total: progress.total,
                    percentage,
                    phase: "uploading",
                    statusText: "正在上传视频…",
                    originalSizeBytes: prepared.originalFileSizeBytes,
                    finalSizeBytes: prepared.finalFileSizeBytes,
                    compressed: prepared.compressed,
                });
            });

            // 写入数据库记录（并进行配额扣减/记录元数据）
            const record = await this.submitVideoUrl({
                videoUrl: publicUrl,
                context,
                fileSizeBytes: uploadFile.size,
                metadata: {
                    storage_bucket: "videos",
                    storage_path: path,
                    original_filename: prepared.originalFileName,
                    uploaded_filename: uploadFile.name,
                    mime_type: uploadFile.type || "application/octet-stream",
                    submission_source: "direct_signed_upload",
                    compression: {
                        applied: prepared.compressed,
                        original_size_bytes: prepared.originalFileSizeBytes,
                        uploaded_size_bytes: prepared.finalFileSizeBytes,
                        original_mime_type: prepared.originalMimeType,
                        uploaded_mime_type: prepared.finalMimeType,
                        duration_seconds: prepared.durationSeconds,
                        width: prepared.width,
                        height: prepared.height,
                        strategy: prepared.compressed ? "browser_media_recorder_v1" : "passthrough",
                    },
                },
            } satisfies SubmitVideoUrlDto);

            emitProgress({
                loaded: uploadFile.size,
                total: uploadFile.size,
                percentage: 100,
                phase: "uploading",
                statusText: prepared.compressed ? "压缩并上传完成" : "上传完成",
                originalSizeBytes: prepared.originalFileSizeBytes,
                finalSizeBytes: prepared.finalFileSizeBytes,
                compressed: prepared.compressed,
            });

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
