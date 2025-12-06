import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import type { GetExecutionResponseDto } from "../entity";

/**
 * GET /api/execution/get?id={executionId}
 *
 * 获取执行记录
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json<GetExecutionResponseDto>(
                { success: false, message: "未登录" },
                { status: 401 },
            );
        }

        const userId = session.user.id;
        const { searchParams } = new URL(request.url);
        const executionId = searchParams.get("id");

        if (!executionId) {
            return NextResponse.json<GetExecutionResponseDto>(
                { success: false, message: "缺少执行ID" },
                { status: 400 },
            );
        }

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

        // 验证权限
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
                day_index: data.day_index,
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
        return NextResponse.json<GetExecutionResponseDto>(
            { success: false, message: "服务器错误" },
            { status: 500 },
        );
    }
}
