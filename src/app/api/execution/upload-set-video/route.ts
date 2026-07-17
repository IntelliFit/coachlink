import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { cosUpload, cosRemove, buildDatedKey } from "@/lib/cos";
import type { ApiData } from "@/types/api";
import type { UploadSetVideoResponseDto } from "./entity";
import { getTrainingVideoSizeError } from "@/lib/trainingVideoLimits";

// 运行在 Node.js，以避免 Edge 运行时的流式限制
export const runtime = "nodejs";
// 明确提升单请求体大小限制，默认仅 ~10MB
export const maxDuration = 300;
export const preferredRegion = "auto";

/**
 * POST /api/execution/upload-set-video
 *
 * 上传组视频（复用Supabase Storage）
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<UploadSetVideoResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;

        // 解析FormData
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const executionId = formData.get("executionId") as string;
        const actionId = formData.get("actionId") as string;
        const setNumber = parseInt(formData.get("setNumber") as string);

        if (!file || !executionId || !actionId || !setNumber) {
            return NextResponse.json<ApiData<UploadSetVideoResponseDto>>({
                success: false,
                message: "缺少参数",
                data: null,
            }, { status: 400 });
        }

        // 防止超大文件导致请求体截断或锁定（Next 默认 10MB）
        const sizeError = getTrainingVideoSizeError(file.size);
        if (sizeError) {
            return NextResponse.json<ApiData<UploadSetVideoResponseDto>>({
                success: false,
                message: sizeError,
                data: null,
            }, { status: 413 });
        }

        // --- STORAGE QUOTA CHECK ---
        const { checkStorageAvailable, incrementStorageUsage } = await import(
            "@/lib/membershipLimit"
        );
        const quotaCheck = await checkStorageAvailable(userId, file.size);
        if (!quotaCheck.success) {
            return NextResponse.json<ApiData<UploadSetVideoResponseDto>>({
                success: false,
                message: quotaCheck.message || "存储空间不足",
                data: null,
            }, { status: 403 });
        }
        // --- STORAGE QUOTA CHECK END ---

        // 验证执行记录权限 & 获取动作名称（用于教练端列表展示）
        const { data: execution } = await supabase
            .from("plan_instance_executions")
            .select("student_id, action_executions")
            .eq("id", executionId)
            .single();

        if (!execution || execution.student_id !== userId) {
            return NextResponse.json<ApiData<UploadSetVideoResponseDto>>({
                success: false,
                message: "无权限",
                data: null,
            }, { status: 403 });
        }

        // Try to determine exercise name from JSONB action_executions
        let exerciseName: string | null = null;
        try {
            let actionExecutions: any = (execution as any).action_executions;
            if (typeof actionExecutions === "string") {
                actionExecutions = JSON.parse(actionExecutions);
            }
            if (Array.isArray(actionExecutions)) {
                const ae = actionExecutions.find(
                    (x: any) => x?.action_id === actionId || x?.id === actionId,
                );
                exerciseName = ae?.action_name || ae?.name || null;
            }
        } catch (e) {
            console.warn(
                "[upload-set-video] Failed to parse action_executions for exercise_name:",
                e,
            );
        }

        // 上传到 COS
        const ext = file.name.split(".").pop() || "mp4";
        const filePath = buildDatedKey(ext, userId, "executions");

        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        let publicUrl: string;
        try {
            const uploaded = await cosUpload("videos", filePath, uint8Array, {
                contentType: file.type,
            });
            publicUrl = uploaded.url;
        } catch (uploadError: any) {
            console.error("上传失败:", uploadError);
            return NextResponse.json<ApiData<UploadSetVideoResponseDto>>({
                success: false,
                message: uploadError?.message || "上传失败",
                data: null,
            }, { status: 500 });
        }

        // --- UPDATE QUOTA ---
        await incrementStorageUsage(userId, file.size).catch((e) =>
            console.error("Failed to update storage usage", e)
        );
        // --------------------

        // 检查是否已存在视频
        const { data: existing } = await supabase
            .from("execution_set_videos")
            .select("id, storage_path")
            .eq("execution_id", executionId)
            .eq("action_id", actionId)
            .eq("set_number", setNumber)
            .maybeSingle();

        if (existing) {
            // 删除旧视频
            if (existing.storage_path) {
                await cosRemove("videos", [existing.storage_path]).catch((e) =>
                    console.error("删除旧视频失败:", e)
                );
            }

            // 更新记录
            const { data, error: updateError } = await supabase
                .from("execution_set_videos")
                .update({
                    video_url: publicUrl,
                    storage_path: filePath,
                    exercise_name: exerciseName ?? undefined,
                    file_size_bytes: file.size,
                    upload_status: "uploaded",
                })
                .eq("id", existing.id)
                .select()
                .single();

            if (updateError || !data) {
                console.error("更新视频记录失败:", updateError);
                return NextResponse.json<ApiData<UploadSetVideoResponseDto>>({
                    success: false,
                    message: "更新失败",
                    data: null,
                }, { status: 500 });
            }

            return NextResponse.json<ApiData<UploadSetVideoResponseDto>>({
                success: true,
                message: "上传视频成功",
                data: {
                    id: data.id,
                    execution_id: data.execution_id,
                    action_id: data.action_id,
                    set_number: data.set_number,
                    video_url: data.video_url,
                    storage_path: data.storage_path,
                },
            });
        }

        // 插入新视频记录
        const { data, error: insertError } = await supabase
            .from("execution_set_videos")
            .insert({
                execution_id: executionId,
                action_id: actionId,
                set_number: setNumber,
                video_url: publicUrl,
                storage_path: filePath,
                storage_bucket: "videos",
                exercise_name: exerciseName ?? undefined,
                file_size_bytes: file.size,
                upload_status: "uploaded",
            })
            .select()
            .single();

        if (insertError) {
            console.error("保存视频记录失败:", insertError);
            return NextResponse.json<ApiData<UploadSetVideoResponseDto>>({
                success: false,
                message: "保存失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<UploadSetVideoResponseDto>>({
            success: true,
            message: "上传视频成功",
            data: {
                id: data.id,
                execution_id: data.execution_id,
                action_id: data.action_id,
                set_number: data.set_number,
                video_url: data.video_url,
                storage_path: data.storage_path,
            },
        });
    } catch (error) {
        console.error("上传视频失败:", error);
        return NextResponse.json<ApiData<UploadSetVideoResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
