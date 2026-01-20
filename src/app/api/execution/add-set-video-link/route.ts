import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { AddSetVideoLinkDto, AddSetVideoLinkResponseDto } from "./entity";

export const runtime = "nodejs";
export const maxDuration = 60;

function isProbablyUrl(url: string) {
    try {
        const u = new URL(url);
        return u.protocol === "http:" || u.protocol === "https:";
    } catch {
        return false;
    }
}

/**
 * POST /api/execution/add-set-video-link
 *
 * Attach an external video link to an execution set (no storage usage).
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<AddSetVideoLinkResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        if (
            !process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY &&
            !process.env.SUPABASE_SERVICE_ROLE_KEY
        ) {
            console.error(
                "[add-set-video-link] Missing service role key env. Expect one of NEXT_SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY.",
            );
            return NextResponse.json<ApiData<AddSetVideoLinkResponseDto>>({
                success: false,
                message:
                    "服务器配置缺失：未设置 Supabase Service Role Key，无法保存视频链接",
                data: null,
            }, { status: 500 });
        }

        const userId = session.user.id;

        const body = (await req.json()) as AddSetVideoLinkDto;
        const { executionId, actionId, setNumber, videoUrl } = body;

        if (!executionId || !actionId || !setNumber || !videoUrl) {
            return NextResponse.json<ApiData<AddSetVideoLinkResponseDto>>({
                success: false,
                message: "缺少参数",
                data: null,
            }, { status: 400 });
        }
        if (!isProbablyUrl(videoUrl)) {
            return NextResponse.json<ApiData<AddSetVideoLinkResponseDto>>({
                success: false,
                message: "链接格式不正确",
                data: null,
            }, { status: 400 });
        }

        // Verify permission and infer exercise_name from action_executions
        const { data: execution } = await supabase
            .from("plan_instance_executions")
            .select("student_id, action_executions")
            .eq("id", executionId)
            .single();

        if (!execution || execution.student_id !== userId) {
            return NextResponse.json<ApiData<AddSetVideoLinkResponseDto>>({
                success: false,
                message: "无权限",
                data: null,
            }, { status: 403 });
        }

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
                "[add-set-video-link] Failed to parse action_executions for exercise_name:",
                e,
            );
        }

        // storage_path is NOT NULL in schema; use a synthetic placeholder for external links
        const storagePath = `external/${userId}/executions/${executionId}/${actionId}/${setNumber}`;

        // Upsert by (execution_id, action_id, set_number)
        const { data, error } = await supabase
            .from("execution_set_videos")
            .upsert(
                {
                    execution_id: executionId,
                    action_id: actionId,
                    set_number: setNumber,
                    video_url: videoUrl,
                    storage_bucket: "external",
                    storage_path: storagePath,
                    file_size_bytes: 0,
                    upload_status: "uploaded",
                    exercise_name: exerciseName ?? undefined,
                },
                { onConflict: "execution_id,action_id,set_number" },
            )
            .select()
            .single();

        if (error || !data) {
            console.error("[add-set-video-link] upsert failed:", error);
            return NextResponse.json<ApiData<AddSetVideoLinkResponseDto>>({
                success: false,
                message: "保存失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<AddSetVideoLinkResponseDto>>({
            success: true,
            message: "添加视频链接成功",
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
        console.error("[add-set-video-link] error:", error);
        return NextResponse.json<ApiData<AddSetVideoLinkResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}

