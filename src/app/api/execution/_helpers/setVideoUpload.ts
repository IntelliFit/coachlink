import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { cosRemove } from "@/lib/cos";
import { getTrainingVideoSizeError } from "@/lib/trainingVideoLimits";
import type { UploadSetVideoResponseDto } from "../upload-set-video/entity";

export class SetVideoUploadError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
        this.name = "SetVideoUploadError";
    }
}

export interface PreparedSetVideoUpload {
    userId: string;
    executionId: string;
    actionId: string;
    setNumber: number;
    fileSizeBytes: number;
    exerciseName: string | null;
    existingVideoId: string | null;
    existingStoragePath: string | null;
}

function normalizeSetNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function resolveExerciseName(actionExecutionsValue: unknown, actionId: string) {
    try {
        let actionExecutions: unknown = actionExecutionsValue;
        if (typeof actionExecutions === "string") {
            actionExecutions = JSON.parse(actionExecutions);
        }
        if (!Array.isArray(actionExecutions)) return null;

        const matched = actionExecutions.find(
            (item: any) => item?.action_id === actionId || item?.id === actionId,
        ) as any;
        return matched?.action_name || matched?.name || null;
    } catch (error) {
        console.warn(
            "[set-video-upload] Failed to parse action_executions for exercise_name:",
            error,
        );
        return null;
    }
}

export async function prepareSetVideoUpload(params: {
    userId: string;
    executionId: string;
    actionId: string;
    setNumber: unknown;
    fileSizeBytes: number;
}): Promise<PreparedSetVideoUpload> {
    const setNumber = normalizeSetNumber(params.setNumber);
    if (!params.executionId || !params.actionId || !setNumber) {
        throw new SetVideoUploadError("缺少参数", 400);
    }

    const fileSizeBytes = Math.round(Number(params.fileSizeBytes || 0));
    if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
        throw new SetVideoUploadError("上传内容为空，请重新选择视频", 400);
    }

    const sizeError = getTrainingVideoSizeError(fileSizeBytes);
    if (sizeError) {
        throw new SetVideoUploadError(sizeError, 413);
    }

    const { checkStorageAvailable } = await import("@/lib/membershipLimit");
    const quotaCheck = await checkStorageAvailable(params.userId, fileSizeBytes);
    if (!quotaCheck.success) {
        throw new SetVideoUploadError(quotaCheck.message || "存储空间不足", 403);
    }

    const { data: execution } = await supabase
        .from("plan_instance_executions")
        .select("student_id, action_executions")
        .eq("id", params.executionId)
        .single();

    if (!execution || execution.student_id !== params.userId) {
        throw new SetVideoUploadError("无权限", 403);
    }

    const exerciseName = resolveExerciseName(
        (execution as any).action_executions,
        params.actionId,
    );

    const { data: existing } = await supabase
        .from("execution_set_videos")
        .select("id, storage_path")
        .eq("execution_id", params.executionId)
        .eq("action_id", params.actionId)
        .eq("set_number", setNumber)
        .maybeSingle();

    return {
        userId: params.userId,
        executionId: params.executionId,
        actionId: params.actionId,
        setNumber,
        fileSizeBytes,
        exerciseName,
        existingVideoId: existing?.id || null,
        existingStoragePath: existing?.storage_path || null,
    };
}

function isCosStoragePath(value: string | null) {
    return !!value && !value.startsWith("external/");
}

export async function persistSetVideoUpload(params: {
    prepared: PreparedSetVideoUpload;
    videoUrl: string;
    storagePath: string;
}): Promise<UploadSetVideoResponseDto> {
    const { prepared } = params;

    try {
        if (prepared.existingVideoId) {
            const { data, error } = await supabase
                .from("execution_set_videos")
                .update({
                    video_url: params.videoUrl,
                    storage_path: params.storagePath,
                    storage_bucket: "videos",
                    exercise_name: prepared.exerciseName ?? undefined,
                    file_size_bytes: prepared.fileSizeBytes,
                    upload_status: "uploaded",
                })
                .eq("id", prepared.existingVideoId)
                .select()
                .single();

            if (error || !data) {
                console.error("[set-video-upload] update failed:", error);
                throw new SetVideoUploadError("更新失败", 500);
            }

            if (
                isCosStoragePath(prepared.existingStoragePath) &&
                prepared.existingStoragePath !== params.storagePath
            ) {
                await cosRemove("videos", [prepared.existingStoragePath!]).catch((error) =>
                    console.error("[set-video-upload] delete old video failed:", error)
                );
            }

            await incrementSetVideoStorageUsage(prepared.userId, prepared.fileSizeBytes);
            return mapUploadResponse(data);
        }

        const { data, error } = await supabase
            .from("execution_set_videos")
            .insert({
                execution_id: prepared.executionId,
                action_id: prepared.actionId,
                set_number: prepared.setNumber,
                video_url: params.videoUrl,
                storage_path: params.storagePath,
                storage_bucket: "videos",
                exercise_name: prepared.exerciseName ?? undefined,
                file_size_bytes: prepared.fileSizeBytes,
                upload_status: "uploaded",
            })
            .select()
            .single();

        if (error || !data) {
            console.error("[set-video-upload] insert failed:", error);
            throw new SetVideoUploadError("保存失败", 500);
        }

        await incrementSetVideoStorageUsage(prepared.userId, prepared.fileSizeBytes);
        return mapUploadResponse(data);
    } catch (error) {
        await cosRemove("videos", [params.storagePath]).catch((removeError) =>
            console.error("[set-video-upload] cleanup new upload failed:", removeError)
        );
        throw error;
    }
}

async function incrementSetVideoStorageUsage(userId: string, fileSizeBytes: number) {
    const { incrementStorageUsage } = await import("@/lib/membershipLimit");
    await incrementStorageUsage(userId, fileSizeBytes).catch((error) =>
        console.error("[set-video-upload] Failed to update storage usage", error)
    );
}

function mapUploadResponse(row: any): UploadSetVideoResponseDto {
    return {
        id: row.id,
        execution_id: row.execution_id,
        action_id: row.action_id,
        set_number: row.set_number,
        video_url: row.video_url,
        storage_path: row.storage_path,
    };
}
