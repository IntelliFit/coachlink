import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import type { FinishTrainingDto, FinishTrainingResponseDto } from "../entity";

/**
 * 更新订阅的预计完成日期
 * 基于剩余训练天数动态计算
 */
async function updateEstimatedEndDate(instanceId: string) {
    try {
        // 1. 获取计划实例信息
        const { data: instance } = await supabase
            .from("coach_plan_instances")
            .select("coach_subscription_id, training_days")
            .eq("id", instanceId)
            .single();

        if (!instance?.coach_subscription_id || !instance.training_days) {
            return;
        }

        // 2. 计算总训练天数（只算 training 类型的天）
        const trainingDays = (instance.training_days as any[]).filter(
            (d: any) => d.type === "training",
        );
        const totalTrainingDays = trainingDays.length;

        // 3. 获取已完成的训练天数
        const { data: completedExecutions } = await supabase
            .from("plan_instance_executions")
            .select("day_index")
            .eq("instance_id", instanceId)
            .eq("status", "completed");

        const completedDayIndexes = new Set(
            (completedExecutions || []).map((e) => e.day_index),
        );

        // 只计算训练日中已完成的
        const completedTrainingDays = trainingDays.filter((d: any) =>
            completedDayIndexes.has(d.dayIndex)
        ).length;

        const remainingDays = totalTrainingDays - completedTrainingDays;

        // 4. 计算新的预计完成日期
        const newEndDate = new Date();
        newEndDate.setDate(newEndDate.getDate() + remainingDays);

        // 5. 更新订阅
        const updateData: any = {
            end_date: newEndDate.toISOString(),
        };

        // 如果计划全部完成，更新状态
        if (remainingDays === 0) {
            updateData.status = "completed";
        }

        await supabase
            .from("coach_subscriptions")
            .update(updateData)
            .eq("id", instance.coach_subscription_id);

        console.log(
            `Updated subscription ${instance.coach_subscription_id}: ` +
                `${completedTrainingDays}/${totalTrainingDays} days, end_date: ${newEndDate.toISOString()}`,
        );
    } catch (error) {
        console.error("更新预计完成日期失败:", error);
    }
}

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

        // 验证权限并获取 instance_id
        const { data: execution } = await supabase
            .from("plan_instance_executions")
            .select("student_id, completed_sets, total_sets, instance_id")
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

        // 异步更新订阅的预计完成日期
        if (execution.instance_id) {
            updateEstimatedEndDate(execution.instance_id);
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
