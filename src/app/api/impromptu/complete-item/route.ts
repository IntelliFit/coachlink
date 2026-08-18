import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { computeExecutionProgress } from "@/lib/executionProgress";
import type {
    CompleteImpromptuItemDto,
    CompleteImpromptuItemResponseDto,
} from "./entity";

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<CompleteImpromptuItemResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;
        const body: CompleteImpromptuItemDto = await request.json();
        const {
            executionId,
            actionIndex,
            itemType,
            completed,
            photoUrl,
            actualContent,
            actualDistance,
            actualDuration,
            notes,
        } = body;

        if (!executionId || actionIndex === undefined || !itemType) {
            return NextResponse.json<ApiData<CompleteImpromptuItemResponseDto>>({
                success: false,
                message: "缺少必填参数",
                data: null,
            }, { status: 400 });
        }

        const { data: execution, error: fetchError } = await supabase
            .from("impromptu_executions")
            .select("*")
            .eq("id", executionId)
            .single();

        if (fetchError || !execution) {
            return NextResponse.json<ApiData<CompleteImpromptuItemResponseDto>>({
                success: false,
                message: "执行记录不存在",
                data: null,
            }, { status: 404 });
        }

        if (execution.student_id !== userId) {
            return NextResponse.json<ApiData<CompleteImpromptuItemResponseDto>>({
                success: false,
                message: "无权访问此记录",
                data: null,
            }, { status: 403 });
        }

        if (execution.status === "completed") {
            return NextResponse.json<ApiData<CompleteImpromptuItemResponseDto>>({
                success: false,
                message: "训练已完成，不能继续修改",
                data: null,
            }, { status: 400 });
        }

        const actionExecutions = Array.isArray(execution.action_executions)
            ? [...execution.action_executions]
            : [];

        if (!actionExecutions[actionIndex]) {
            return NextResponse.json<ApiData<CompleteImpromptuItemResponseDto>>({
                success: false,
                message: "项目不存在",
                data: null,
            }, { status: 400 });
        }

        const nowIso = new Date().toISOString();
        const currentSets = Array.isArray(actionExecutions[actionIndex]?.sets)
            ? [...actionExecutions[actionIndex].sets]
            : [];

        if (currentSets[0]) {
            currentSets[0] = {
                ...currentSets[0],
                status: completed ? "completed" : "pending",
                completed_at: completed ? nowIso : null,
                notes: notes || "",
                ...(itemType === "DIET"
                    ? {
                        diet_content: actualContent || null,
                        photo_url: photoUrl || null,
                    }
                    : {}),
                ...(itemType === "CARDIO"
                    ? {
                        actual_distance: actualDistance || null,
                        actual_duration: actualDuration || null,
                    }
                    : {}),
            };
        }

        actionExecutions[actionIndex] = {
            ...actionExecutions[actionIndex],
            type: actionExecutions[actionIndex]?.type || itemType,
            status: completed ? "completed" : "pending",
            completed,
            completed_at: completed ? nowIso : null,
            notes: notes || "",
            sets: currentSets,
            completed_sets: completed ? 1 : 0,
            total_sets: Math.max(1, currentSets.length || 1),
        };

        const progress = computeExecutionProgress(actionExecutions);

        const { data: updated, error: updateError } = await supabase
            .from("impromptu_executions")
            .update({
                action_executions: actionExecutions,
                completed_sets: progress.completedItems,
                total_sets: progress.totalItems,
                last_saved_at: nowIso,
            })
            .eq("id", executionId)
            .select("id, action_executions, completed_sets, total_sets")
            .single();

        if (updateError || !updated) {
            return NextResponse.json<ApiData<CompleteImpromptuItemResponseDto>>({
                success: false,
                message: "更新失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<CompleteImpromptuItemResponseDto>>({
            success: true,
            message: "完成项目成功",
            data: {
                executionId,
                completedItems: updated.completed_sets,
                totalItems: updated.total_sets,
                action_executions: updated.action_executions,
            },
        });
    } catch (error) {
        console.error("complete impromptu item error:", error);
        return NextResponse.json<ApiData<CompleteImpromptuItemResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
