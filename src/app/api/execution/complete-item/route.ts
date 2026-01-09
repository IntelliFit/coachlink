import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import type { CompleteItemDto } from "../entity";

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

        // 计算完成的项目数（包括力量类型的组和非力量类型的项目）
        let totalCompletedItems = 0;
        let totalItems = 0;

        for (const action of actionExecutions) {
            if (action.sets && Array.isArray(action.sets)) {
                // STRENGTH 类型：统计组数
                totalItems += action.sets.length;
                totalCompletedItems += action.sets.filter(
                    (s: any) => s.status === "completed",
                ).length;
            } else {
                // 非 STRENGTH 类型：作为单个项目
                totalItems += 1;
                if (action.completed || action.status === "completed") {
                    totalCompletedItems += 1;
                }
            }
        }

        // 6. 保存到数据库
        const { error: updateError } = await supabase
            .from("plan_instance_executions")
            .update({
                action_executions: actionExecutions,
                completed_sets: totalCompletedItems,
                last_saved_at: new Date().toISOString(),
            })
            .eq("id", executionId);

        if (updateError) {
            console.error("更新失败:", updateError);
            return NextResponse.json<CompleteItemResponseDto>(
                { success: false, message: "更新失败" },
                { status: 500 },
            );
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
