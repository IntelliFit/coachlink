import { BaseService } from "@/lib/baseService";
import { CoachActionRow } from "@/types";
import { ListActionsDto, ListActionsResponseDto } from "@/app/api/action-lib/list-actions/entity";
import { AddActionDto, AddActionResponseDto } from "@/app/api/action-lib/add-action/entity";
import { UpdateActionRequest, UpdateActionResponse } from "@/app/api/action-lib/update-action/entity";
import { DeleteActionDto, DeleteActionResponseDto } from "@/app/api/action-lib/delete-action/entity";
import { GetActionDto, GetActionResponseDto } from "@/app/api/action-lib/get-action/entity";
import { ListAutoComputeActionsDto, ListAutoComputeActionsResponseDto } from "../api/action-lib/list-auto-compute-actions/entity";
import { UploadDemoVideoResponseDto } from "@/app/api/action-lib/upload-demo-video/entity";
import type {
    CreateDemoVideoUploadUrlResponseDto,
} from "@/app/api/action-lib/create-demo-video-upload-url/entity";
import type {
    ActionReferencesDto,
    ActionReferencesResponseDto,
} from "@/app/api/action-lib/action-references/entity";
import type {
    MergeActionsDto,
    MergeActionsResponseDto,
} from "@/app/api/action-lib/merge-actions/entity";

export class ActionLibService extends BaseService {
    async listActions(reqData: ListActionsDto) {
        const res = await this.post<ListActionsResponseDto>("list-actions", reqData);
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to fetch actions");
        }
        return res.data.data;
    }

    async listAutoComputeActions(reqData: ListAutoComputeActionsDto) {
        const res = await this.post<ListAutoComputeActionsResponseDto>("list-auto-compute-actions", reqData);
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to fetch auto compute actions");
        }
        return res.data.data;
    }

    async getAction(reqData: GetActionDto) {
        const res = await this.post<GetActionResponseDto>("get-action", reqData);
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to fetch action");
        }
        return res.data.data;
    }

    async addAction(reqData: AddActionDto) {
        const res = await this.post<AddActionResponseDto>("add-action", reqData);
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to add action");
        }
        return res.data.data;
    }

    async updateAction(reqData: UpdateActionRequest) {
        const res = await this.post<UpdateActionResponse>("update-action", reqData);
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to update action");
        }
        return res.data.data;
    }

    async deleteAction(reqData: DeleteActionDto) {
        const res = await this.post<DeleteActionResponseDto>("delete-action", reqData);
        if (!res || !res.data.success) {
            throw new Error(res.data.message || "Failed to delete action");
        }
        return res.data.data;
    }

    async getActionReferences(reqData: ActionReferencesDto) {
        const res = await this.post<ActionReferencesResponseDto>(
            "action-references",
            reqData,
        );
        if (!res || !res.data.success) {
            throw new Error(res?.data?.message || "获取动作引用失败");
        }
        return res.data.data;
    }

    async mergeActions(reqData: MergeActionsDto) {
        const res = await this.post<MergeActionsResponseDto>("merge-actions", reqData);
        if (!res || !res.data.success) {
            throw new Error(res?.data?.message || "合并动作失败");
        }
        return res.data.data;
    }

    private buildSignedUploadUrl(bucket: string, path: string, token: string) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        if (!supabaseUrl) {
            throw new Error(
                "缺少 NEXT_PUBLIC_SUPABASE_URL，无法进行直传（请检查环境变量）",
            );
        }

        // encode each segment but keep slashes
        const encodedPath = path
            .split("/")
            .map((seg) => encodeURIComponent(seg))
            .join("/");

        // Supabase signed upload endpoint (used internally by supabase-js uploadToSignedUrl)
        return `${supabaseUrl}/storage/v1/object/upload/sign/${bucket}/${encodedPath}?token=${encodeURIComponent(
            token,
        )}`;
    }

    private async putWithProgress(
        url: string,
        file: File,
        onProgress?: (percentage: number) => void,
    ) {
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
        const contentType = file.type || "application/octet-stream";

        return await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", url);
            xhr.setRequestHeader("Content-Type", contentType);

            // Some environments require apikey/Authorization headers even with token
            if (anonKey) {
                xhr.setRequestHeader("apikey", anonKey);
                xhr.setRequestHeader("Authorization", `Bearer ${anonKey}`);
            }

            xhr.upload.onprogress = (evt) => {
                if (!evt.lengthComputable) return;
                const percentage = Math.min(
                    99,
                    Math.max(0, Math.round((evt.loaded / evt.total) * 100)),
                );
                onProgress?.(percentage);
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    onProgress?.(100);
                    resolve();
                    return;
                }

                // Best-effort parse error
                const detail = xhr.responseText
                    ? `（${xhr.status}）${xhr.responseText}`
                    : `（${xhr.status}）上传失败`;
                reject(new Error(detail));
            };
            xhr.onerror = () => reject(new Error("网络错误：上传中断"));
            xhr.onabort = () => reject(new Error("上传已取消"));

            xhr.send(file);
        });
    }

    /**
     * 动作演示视频：对齐其它视频上传的“直传”方案
     * 1) 向服务端申请 signed token
     * 2) 浏览器直传 Supabase Storage（可拿到真实进度）
     * 3) 返回 publicUrl，用于回填 action.url
     */
    async uploadDemoVideo(file: File, onProgress?: (percentage: number) => void) {
        if (!file) throw new Error("缺少文件");
        if (!file.type?.startsWith("video/")) throw new Error("仅支持上传视频文件");

        const maxSizeBytes = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSizeBytes) throw new Error("视频过大，单个视频请小于 100MB");

        onProgress?.(0);

        const signRes = await this.post<CreateDemoVideoUploadUrlResponseDto>(
            "create-demo-video-upload-url",
            {
                originalFilename: file.name,
                contentType: file.type || "application/octet-stream",
                fileSizeBytes: file.size,
            },
        );

        if (!signRes?.data?.success || !signRes.data.data?.token) {
            throw new Error(signRes?.data?.message || "创建上传链接失败");
        }

        const { bucket, path, token, publicUrl } = signRes.data.data;
        const signedUploadUrl = this.buildSignedUploadUrl(bucket, path, token);
        await this.putWithProgress(signedUploadUrl, file, onProgress);

        return {
            url: publicUrl,
            storage_bucket: bucket,
            storage_path: path,
        } satisfies UploadDemoVideoResponseDto;
    }
}

export const actionLibService = new ActionLibService('/api/action-lib');