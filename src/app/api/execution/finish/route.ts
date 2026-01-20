import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import type { FinishTrainingDto, FinishTrainingResponseDto } from "../entity";
import { computeCreditsScope, computeUsedCredits, estimateRemainingDays } from "@/lib/subscriptionCredits";

/**
 * 更新订阅的预计完成日期（B1：按训练日 credits 消耗）
 * - totalCredits：计划前 subscribed_weeks 周范围内的 training 日数量（从 start_execution_day 起算）
 * - usedCredits：已完成的 training 日数量（去重 day_index）
 * - end_date：用于 UI 展示的“预计完成日”（简单用 today + remainingCredits 天）
 * - status：当 credits 用完时标记为 expired
 */
async function updateEstimatedEndDate(instanceId: string) {
    try {
        // 1. 获取计划实例信息
        const { data: instance } = await supabase
            .from("coach_plan_instances")
            .select("coach_subscription_id, training_days, start_execution_day")
            .eq("id", instanceId)
            .single();

        if (!instance?.coach_subscription_id || !instance.training_days) {
            return;
        }

        // 2. 读取订阅信息（subscribed_weeks 决定 credits 作用范围）
        const { data: subscription } = await supabase
            .from("coach_subscriptions")
            .select("id, subscribed_weeks, status")
            .eq("id", instance.coach_subscription_id)
            .maybeSingle();

        const subscribedWeeks = Number((subscription as any)?.subscribed_weeks || 0);
        if (!Number.isFinite(subscribedWeeks) || subscribedWeeks <= 0) {
            return;
        }

        const scope = computeCreditsScope({
            trainingDays: (instance.training_days as any[]) || [],
            startExecutionDay: Number((instance as any).start_execution_day || 1),
            subscribedWeeks,
        });

        // 3. 获取已完成的训练天数
        const { data: completedExecutions } = await supabase
            .from("plan_instance_executions")
            .select("day_index, status")
            .eq("instance_id", instanceId)
            .eq("status", "completed");

        const usedCredits = computeUsedCredits({
            eligibleTrainingDayIndexSet: scope.eligibleTrainingDayIndexSet,
            executions: (completedExecutions as any[]) || [],
            startExecutionDay: Number((instance as any).start_execution_day || 1),
        });
        const totalCredits = scope.totalCredits;
        const remainingCredits = Math.max(0, totalCredits - usedCredits);

        // 4. 计算新的预计完成日期（显示“剩余天数”更友好）
        // 将 remainingCredits 映射为“预计还需要多少自然日”，按计划节奏推算：
        // plannedCreditsPerWeek = totalCredits / subscribedWeeks
        // remainingDays ≈ remainingCredits / plannedCreditsPerWeek * 7
        const remainingDaysEstimate = estimateRemainingDays({
            subscribedWeeks,
            totalCredits,
            remainingCredits,
            fallbackCreditsPerWeek: 3,
        });

        const newEndDate = new Date();
        newEndDate.setDate(newEndDate.getDate() + remainingDaysEstimate);

        // 5. 更新订阅
        const updateData: any = {
            end_date: newEndDate.toISOString(),
        };

        // B1: 是否“到期/结束”由 credits 消耗决定，但 DB 的 status 受约束（不强制写入新的枚举值）。
        // 我们用 end_date（预计完成日；当 remainingDaysEstimate=0 时约等于“已到期”）驱动前端展示。

        await supabase
            .from("coach_subscriptions")
            .update(updateData)
            .eq("id", instance.coach_subscription_id);

        console.log(
            `Updated subscription ${instance.coach_subscription_id}: ` +
                `${usedCredits}/${totalCredits} credits, ` +
                `remainingDays≈${remainingDaysEstimate}, end_date: ${newEndDate.toISOString()}`,
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
