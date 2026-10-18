import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    CompleteInstanceDto,
    CompleteInstanceResponseDto,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { schedulePlanCompletionAutomation } from "@/lib/planCompletionAutomation";
import { resolvePlanInstanceAccess } from "@/lib/planInstanceAccess";
import { summarizePlanCompletion } from "@/lib/planInstanceCompletion";
import { buildPlanDayFacts } from "@/lib/planDayFacts";
import { deriveEffectiveStartExecutionDay } from "@/lib/planProgress";

/**
 * Whether every training day from the plan's effective start day has been
 * completed or skipped — the same rule the today-training view uses to show
 * a plan as finished.
 */
async function hasResolvedEveryTrainingDay(instance: any) {
    const { data: executions, error } = await supabase
        .from("plan_instance_executions")
        .select("day_index, status, close_reason, started_at, completed_at, updated_at")
        .eq("instance_id", instance.id);
    if (error) return { finished: false, error };

    let subscriptionStartDate: string | null = null;
    if (instance.coach_subscription_id) {
        const { data: subscription } = await supabase
            .from("coach_subscriptions")
            .select("start_date")
            .eq("id", instance.coach_subscription_id)
            .maybeSingle();
        subscriptionStartDate = subscription?.start_date || null;
    }

    const planDays = Array.isArray(instance.training_days) ? instance.training_days : [];
    const startExecutionDay = deriveEffectiveStartExecutionDay({
        storedStartExecutionDay: instance.start_execution_day,
        planDays,
        executionsByDayIndex: buildPlanDayFacts(executions || []),
        planStartDate: instance.start_date,
        subscriptionStartDate,
    });
    const summary = summarizePlanCompletion({
        trainingDays: planDays,
        startExecutionDay,
        executions: executions || [],
    });
    return { finished: summary.isLogicallyCompleted, error: null };
}

/**
 * 完成计划实例
 *
 * 将指定计划的 status 设为 'completed'
 * 通常在学员完成计划最后一天训练时调用
 *
 * 权限：教练可随时结束自己的计划；学员可随时结束自建计划，
 * 但教练计划只有在所有训练日都已完成或跳过后才能由学员标记完成
 * （完成会触发下一阶段自动化）。
 */
export async function POST(req: Request) {
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    const { instanceId } = await req.json() as CompleteInstanceDto;

    if (!instanceId) {
        return NextResponse.json({
            success: false,
            message: "缺少 instanceId 参数",
        }, { status: 400 });
    }

    // 获取计划实例
    const { data: instance, error: fetchError } = await supabase
        .from("coach_plan_instances")
        .select("id, student_id, coach_id, coach_subscription_id, source, status, name, training_days, start_execution_day, start_date")
        .eq("id", instanceId)
        .single();

    if (fetchError || !instance) {
        return NextResponse.json({
            success: false,
            message: "计划不存在",
        }, { status: 404 });
    }

    // 权限检查：学员本人或教练
    const access = await resolvePlanInstanceAccess({ client: supabase, instance, userId });
    const isEnrolledStudent = instance.student_id === userId &&
        !access.isCoachOwner &&
        !access.isSelfPlanOwner;

    if (!access.isCoachOwner && !access.isSelfPlanOwner && !isEnrolledStudent) {
        return NextResponse.json({
            success: false,
            message: "权限不足",
        }, { status: 403 });
    }

    const currentStatus = String(instance.status || "").trim().toLowerCase();
    if (currentStatus === "completed") {
        return NextResponse.json<ApiData<CompleteInstanceResponseDto>>({
            success: true,
            message: `计划"${instance.name}"已完成`,
            data: { success: true, instance: instance as any },
        });
    }
    if (currentStatus !== "active" && currentStatus !== "paused") {
        return NextResponse.json({
            success: false,
            message: "该计划已归档或尚未发布，不能标记完成",
        }, { status: 409 });
    }

    if (isEnrolledStudent) {
        const progress = await hasResolvedEveryTrainingDay(instance);
        if (progress.error) {
            console.error("Error reading plan progress before completion:", progress.error);
            return NextResponse.json({
                success: false,
                message: "暂时无法核对训练进度，请稍后再试",
            }, { status: 503 });
        }
        if (!progress.finished) {
            return NextResponse.json({
                success: false,
                message: "计划还有未完成的训练日，暂不能标记完成",
            }, { status: 409 });
        }
    }

    // Only the request that moves the plan out of active/paused starts the
    // next-phase automation; repeated taps and concurrent readers do not.
    const { data: updated, error: updateError } = await supabase
        .from("coach_plan_instances")
        .update({
            status: "completed",
            end_date: new Date().toISOString().split("T")[0],
            updated_at: new Date().toISOString(),
        })
        .eq("id", instanceId)
        .in("status", ["active", "paused"])
        .select()
        .maybeSingle();

    if (updateError) {
        console.error("Error completing instance:", updateError);
        return NextResponse.json({
            success: false,
            message: `完成计划失败: ${updateError.message}`,
        }, { status: 500 });
    }

    if (updated) {
        schedulePlanCompletionAutomation(instanceId);
    }

    return NextResponse.json<ApiData<CompleteInstanceResponseDto>>({
        success: true,
        message: `恭喜！计划"${instance.name}"已完成`,
        data: {
            success: true,
            instance: updated || { ...instance, status: "completed" } as any,
        },
    });
}
