import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { cosRemove } from "@/lib/cos";
import { getTrainingVideoSizeError } from "@/lib/trainingVideoLimits";
import { mergeImpromptuSetVideos } from "@/lib/impromptuSetVideos";

export class ImpromptuSetVideoError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
        this.name = "ImpromptuSetVideoError";
    }
}

export type PreparedImpromptuSetVideo = {
    userId: string;
    executionId: string;
    actionId: string | null;
    actionIndex: number;
    setNumber: number;
    fileSizeBytes: number;
    exerciseName: string | null;
    existingVideoId: string | null;
    existingStoragePath: string | null;
    existingFileSizeBytes: number;
};

export type ImpromptuSetVideoResponse = {
    id: string;
    execution_id: string;
    action_id: string | null;
    action_index: number;
    set_number: number;
    video_url: string;
    storage_path: string;
};

function positiveInteger(value: unknown) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function nonNegativeInteger(value: unknown) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : -1;
}

function normalizeActions(value: unknown): any[] {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function isManagedStoragePath(value: string | null) {
    return !!value && !value.startsWith("external/");
}

export async function prepareImpromptuSetVideo(params: {
    userId: string;
    executionId: string;
    actionId?: string | null;
    actionIndex: unknown;
    setNumber: unknown;
    fileSizeBytes: number;
    external?: boolean;
}): Promise<PreparedImpromptuSetVideo> {
    const actionIndex = nonNegativeInteger(params.actionIndex);
    const setNumber = positiveInteger(params.setNumber);
    if (!params.executionId || actionIndex < 0 || !setNumber) {
        throw new ImpromptuSetVideoError("缺少训练组参数", 400);
    }

    const fileSizeBytes = Math.round(Number(params.fileSizeBytes || 0));
    if (!params.external && (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0)) {
        throw new ImpromptuSetVideoError("上传内容为空，请重新选择视频", 400);
    }
    if (params.external && (!Number.isFinite(fileSizeBytes) || fileSizeBytes !== 0)) {
        throw new ImpromptuSetVideoError("外部链接不能计入本地文件大小", 400);
    }
    if (!params.external) {
        const sizeError = getTrainingVideoSizeError(fileSizeBytes);
        if (sizeError) throw new ImpromptuSetVideoError(sizeError, 413);
    }

    const { data: execution } = await (supabase as any)
        .from("impromptu_executions")
        .select("student_id, action_executions")
        .eq("id", params.executionId)
        .maybeSingle();
    if (!execution || execution.student_id !== params.userId) {
        throw new ImpromptuSetVideoError("无权限", 403);
    }

    const actions = normalizeActions(execution.action_executions);
    const action = actions[actionIndex];
    const sets = Array.isArray(action?.sets) ? action.sets : [];
    const setExists = sets.some((item: any, index: number) =>
        Number(item?.set_number ?? item?.setNumber ?? index + 1) === setNumber
    );
    if (!action || !setExists) {
        throw new ImpromptuSetVideoError("训练组不存在，请刷新后重试", 400);
    }

    const storedActionId = String(action?.action_id || action?.actionId || "").trim() || null;
    const requestedActionId = String(params.actionId || "").trim() || null;
    if (storedActionId && requestedActionId && storedActionId !== requestedActionId) {
        throw new ImpromptuSetVideoError("动作信息已变化，请刷新后重试", 409);
    }

    const { data: existing } = await (supabase as any)
        .from("impromptu_execution_set_videos")
        .select("id, storage_path, file_size_bytes")
        .eq("execution_id", params.executionId)
        .eq("action_index", actionIndex)
        .eq("set_number", setNumber)
        .maybeSingle();
    const existingFileSizeBytes = Math.max(0, Number(existing?.file_size_bytes || 0));

    const additionalBytes = Math.max(0, fileSizeBytes - existingFileSizeBytes);
    if (additionalBytes > 0) {
        const { checkStorageAvailable } = await import("@/lib/membershipLimit");
        const quotaCheck = await checkStorageAvailable(params.userId, additionalBytes);
        if (!quotaCheck.success) {
            throw new ImpromptuSetVideoError(quotaCheck.message || "存储空间不足", 403);
        }
    }

    return {
        userId: params.userId,
        executionId: params.executionId,
        actionId: storedActionId || requestedActionId,
        actionIndex,
        setNumber,
        fileSizeBytes,
        exerciseName: String(action?.action_name || action?.actionName || action?.name || "").trim() || null,
        existingVideoId: existing?.id || null,
        existingStoragePath: existing?.storage_path || null,
        existingFileSizeBytes,
    };
}

export async function persistImpromptuSetVideo(params: {
    prepared: PreparedImpromptuSetVideo;
    videoUrl: string;
    storagePath: string;
    storageBucket?: "videos" | "external";
}): Promise<ImpromptuSetVideoResponse> {
    const { prepared } = params;
    const row = {
        execution_id: prepared.executionId,
        action_id: prepared.actionId,
        action_index: prepared.actionIndex,
        set_number: prepared.setNumber,
        video_url: params.videoUrl,
        storage_path: params.storagePath,
        storage_bucket: params.storageBucket || "videos",
        file_size_bytes: prepared.fileSizeBytes,
        upload_status: "uploaded",
        updated_at: new Date().toISOString(),
    };

    try {
        const operation = prepared.existingVideoId
            ? (supabase as any)
                .from("impromptu_execution_set_videos")
                .update(row)
                .eq("id", prepared.existingVideoId)
            : (supabase as any)
                .from("impromptu_execution_set_videos")
                .insert(row);
        const { data, error } = await operation.select("*").single();
        if (error || !data) {
            console.error("[impromptu-set-video] persist failed:", error);
            throw new ImpromptuSetVideoError("保存视频失败", 500);
        }

        if (
            isManagedStoragePath(prepared.existingStoragePath) &&
            prepared.existingStoragePath !== params.storagePath
        ) {
            await cosRemove("videos", [prepared.existingStoragePath!]).catch((error) =>
                console.error("[impromptu-set-video] delete old video failed:", error)
            );
        }

        const usageDelta = prepared.fileSizeBytes - prepared.existingFileSizeBytes;
        if (usageDelta !== 0) {
            const { incrementStorageUsage } = await import("@/lib/membershipLimit");
            await incrementStorageUsage(prepared.userId, usageDelta).catch((error) =>
                console.error("[impromptu-set-video] update storage usage failed:", error)
            );
        }

        return {
            id: data.id,
            execution_id: data.execution_id,
            action_id: data.action_id || null,
            action_index: data.action_index,
            set_number: data.set_number,
            video_url: data.video_url,
            storage_path: data.storage_path,
        };
    } catch (error) {
        if (isManagedStoragePath(params.storagePath)) {
            await cosRemove("videos", [params.storagePath]).catch((removeError) =>
                console.error("[impromptu-set-video] cleanup upload failed:", removeError)
            );
        }
        throw error;
    }
}

export async function attachImpromptuSetVideos<T extends { id?: unknown; action_executions?: unknown }>(
    execution: T,
): Promise<T> {
    const executionId = String(execution?.id || "").trim();
    if (!executionId) return execution;

    const { data, error } = await (supabase as any)
        .from("impromptu_execution_set_videos")
        .select("id, action_index, set_number, video_url")
        .eq("execution_id", executionId)
        .eq("upload_status", "uploaded");
    if (error) {
        // During a rolling deploy the API can run briefly before the migration.
        // Training data must remain readable even when video metadata is unavailable.
        console.warn("[impromptu-set-video] attach skipped:", error.message);
        return execution;
    }

    return mergeImpromptuSetVideos(execution, data || []);
}
