import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import type { FinishTrainingDto, FinishTrainingResponseDto } from "../entity";

/**
 * POST /api/execution/finish
 *
 * 完成训练
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json<FinishTrainingResponseDto>(
                { success: false, message: "未登录" },
                { status: 401 },
            );
        }

        const userId = session.user.id;
        const body: FinishTrainingDto = await request.json();
        const { executionId, sessionNotes } = body;

        if (!executionId) {
            return NextResponse.json<FinishTrainingResponseDto>(
                { success: false, message: "缺少执行ID" },
                { status: 400 },
            );
        }

        // 验证权限
        const { data: execution } = await supabase
            .from("plan_instance_executions")
            .select("student_id, completed_sets, total_sets")
            .eq("id", executionId)
            .single();

        if (!execution || execution.student_id !== userId) {
            return NextResponse.json<FinishTrainingResponseDto>(
                { success: false, message: "无权限" },
                { status: 403 },
            );
        }

        // 更新状态
        const { data, error } = await supabase
            .from("plan_instance_executions")
            .update({
                status: "completed",
                completed_at: new Date().toISOString(),
                session_notes: sessionNotes || null,
            })
            .eq("id", executionId)
            .select()
            .single();

        if (error) {
            console.error("完成训练失败:", error);
            return NextResponse.json<FinishTrainingResponseDto>(
                { success: false, message: "更新失败" },
                { status: 500 },
            );
        }

        return NextResponse.json<FinishTrainingResponseDto>({
            success: true,
            data: {
                id: data.id,
                status: data.status,
                completed_at: data.completed_at,
                completed_sets: data.completed_sets,
                total_sets: data.total_sets,
            },
        });
    } catch (error) {
        console.error("完成训练失败:", error);
        return NextResponse.json<FinishTrainingResponseDto>(
            { success: false, message: "服务器错误" },
            { status: 500 },
        );
    }
}
