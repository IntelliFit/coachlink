import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { FinishTrainingDto, FinishTrainingResponseDto } from "./entity";
import { updateEstimatedEndDateForInstance } from "../updateEstimatedEndDate";

/**
 * POST /api/execution/finish
 *
 * 完成训练
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;
        const body: FinishTrainingDto = await request.json();
        const { executionId, sessionNotes } = body;

        if (!executionId) {
            return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
                success: false,
                message: "缺少执行ID",
                data: null,
            }, { status: 400 });
        }

        // 验证权限并获取 instance_id
        const { data: execution } = await supabase
            .from("plan_instance_executions")
            .select("student_id, completed_sets, total_sets, instance_id")
            .eq("id", executionId)
            .single();

        if (!execution || execution.student_id !== userId) {
            return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
                success: false,
                message: "无权限",
                data: null,
            }, { status: 403 });
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
            return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
                success: false,
                message: "更新失败",
                data: null,
            }, { status: 500 });
        }

        // 异步更新订阅的预计完成日期
        if (execution.instance_id) {
            updateEstimatedEndDateForInstance(execution.instance_id);
        }

        return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
            success: true,
            message: "完成训练成功",
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
        return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
