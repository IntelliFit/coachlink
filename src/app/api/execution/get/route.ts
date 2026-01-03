import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import type { GetExecutionResponseDto, ShareInfoResponseDto } from "../entity";
import { buildShareInfo } from "../share-helper";

/**
 * GET /api/execution/get?id={executionId}&mode=share
 *
 * 获取执行记录 (mode=share 返回分享卡片数据)
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "未登录" },
                { status: 401 },
            );
        }

        const userId = session.user.id;
        const { searchParams } = new URL(request.url);
        const executionId = searchParams.get("id");
        const mode = searchParams.get("mode"); // 'share' for share card data

        if (!executionId) {
            return NextResponse.json(
                { success: false, message: "缺少执行ID" },
                { status: 400 },
            );
        }

        // Share mode - return data for share card
        if (mode === "share") {
            const result = await buildShareInfo(executionId, userId);
            return NextResponse.json<ShareInfoResponseDto>(result.body, {
                status: result.status,
            });
        }

        // Default mode - return basic execution data
        const { data, error } = await supabase
            .from("plan_instance_executions")
            .select("*")
            .eq("id", executionId)
            .single();

        if (error || !data) {
            return NextResponse.json<GetExecutionResponseDto>(
                { success: false, message: "记录不存在" },
                { status: 404 },
            );
        }

        if (data.student_id !== userId) {
            return NextResponse.json<GetExecutionResponseDto>(
                { success: false, message: "无权限" },
                { status: 403 },
            );
        }

        return NextResponse.json<GetExecutionResponseDto>({
            success: true,
            data: {
                id: data.id,
                instance_id: data.instance_id,
                student_id: data.student_id,
                dayIndex: data.dayIndex,
                status: data.status,
                action_executions: data.action_executions,
                total_sets: data.total_sets,
                completed_sets: data.completed_sets,
                session_notes: data.session_notes,
                started_at: data.started_at,
                completed_at: data.completed_at,
            },
        });
    } catch (error) {
        console.error("获取执行记录失败:", error);
        return NextResponse.json(
            { success: false, message: "服务器错误" },
            { status: 500 },
        );
    }
}
