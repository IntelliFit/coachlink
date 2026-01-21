import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import type { CompleteItemDto } from "../entity";
import { computeExecutionProgress } from "@/lib/executionProgress";
import { updateEstimatedEndDateForInstance } from "../updateEstimatedEndDate";

interface CompleteItemResponseDto {
    success: boolean;
    data?: {
        executionId: string;
        completedItems: number;
        totalItems: number;
    };
    message?: string;
}

/**
 * POST /api/execution/complete-item
 *
 * 完成一个非力量类型的项目（饮食/有氧/习惯）
 */
export async function POST(request: NextRequest) {
    try {
        // 1. 验证用户身份
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json<CompleteItemResponseDto>(
                { success: false, message: "未登录" },
                { status: 401 },
            );
        }

        const userId = session.user.id;

        // 2. 解析请求参数
        const body: CompleteItemDto = await request.json();
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
            return NextResponse.json<CompleteItemResponseDto>(
                { success: false, message: "缺少必填参数" },
                { status: 400 },
            );
        }

        // 3. 获取执行记录
        const { data: execution, error: fetchError } = await supabase
            .from("plan_instance_executions")
            .select("*")
            .eq("id", executionId)
            .single();

        if (fetchError || !execution) {
            return NextResponse.json<CompleteItemResponseDto>(
                { success: false, message: "执行记录不存在" },
                { status: 404 },
            );
        }

        // 4. 验证权限
        if (execution.student_id !== userId) {
            return NextResponse.json<CompleteItemResponseDto>(
                { success: false, message: "无权访问此记录" },
                { status: 403 },
            );
        }

        // 5. 更新 JSONB 数据
        const actionExecutions = execution.action_executions as any[];

        if (!actionExecutions[actionIndex]) {
            return NextResponse.json<CompleteItemResponseDto>(
                { success: false, message: "项目不存在" },
                { status: 400 },
            );
        }

        // 更新项目数据 - 根据类型保存不同字段
        const itemExecution: Record<string, unknown> = {
            status: completed ? "completed" : "pending",
            completed,
            completed_at: completed ? new Date().toISOString() : null,
            notes: notes || "",
        };

        // DIET 特有字段
        if (itemType === "DIET") {
            itemExecution.photo_url = photoUrl || null;
            itemExecution.actual_content = actualContent || null;
        }

        // CARDIO 特有字段
        if (itemType === "CARDIO") {
            itemExecution.actual_distance = actualDistance || null;
            itemExecution.actual_duration = actualDuration || null;
        }

        // 合并到 actionExecutions
        actionExecutions[actionIndex] = {
            ...actionExecutions[actionIndex],
            ...itemExecution,
        };

        const progress = computeExecutionProgress(actionExecutions as any[]);
        const totalCompletedItems = progress.completedItems;
        const totalItems = progress.totalItems;

        // 6. 保存到数据库
        const nowIso = new Date().toISOString();
        const shouldAutoComplete = totalItems > 0 && totalCompletedItems >= totalItems;

        const { error: updateError } = await supabase
            .from("plan_instance_executions")
            .update({
                action_executions: actionExecutions,
                completed_sets: totalCompletedItems,
                total_sets: totalItems,
                status: shouldAutoComplete ? "completed" : execution.status,
                completed_at: shouldAutoComplete ? nowIso : execution.completed_at,
                last_saved_at: nowIso,
            })
            .eq("id", executionId);

        if (updateError) {
            console.error("更新失败:", updateError);
            return NextResponse.json<CompleteItemResponseDto>(
                { success: false, message: "更新失败" },
                { status: 500 },
            );
        }

        if (shouldAutoComplete && execution.instance_id) {
            updateEstimatedEndDateForInstance(execution.instance_id);
        }

        return NextResponse.json<CompleteItemResponseDto>({
            success: true,
            data: {
                executionId,
                completedItems: totalCompletedItems,
                totalItems,
            },
        });
    } catch (error) {
        console.error("完成项目失败:", error);
        return NextResponse.json<CompleteItemResponseDto>(
            { success: false, message: "服务器错误" },
            { status: 500 },
        );
    }
}
