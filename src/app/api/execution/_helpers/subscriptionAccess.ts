import supabase from "@/lib/supabaseClient";
import { evaluateSubscriptionPlanAccess } from "@/lib/subscriptionAccess";
import { getSubscriptionCarryoverSummary } from "@/lib/subscriptionCarryover";

export type ExecutionSubscriptionAccess = {
    allowed: boolean;
    status: number;
    message?: string;
    reason?: "SUBSCRIPTION_EXPIRED" | "PLAN_OUT_OF_SCOPE";
    maxAccessibleDayIndex: number | null;
};

export async function validateExecutionSubscriptionAccess(params: {
    instanceId: string;
    studentId: string;
    dayIndex?: number | null;
}): Promise<ExecutionSubscriptionAccess> {
    const { instanceId, studentId, dayIndex } = params;

    const { data: instance, error: instanceError } = await supabase
        .from("coach_plan_instances")
        .select("student_id, coach_subscription_id, training_days, start_execution_day, created_at")
        .eq("id", instanceId)
        .maybeSingle();

    if (instanceError) {
        return {
            allowed: false, status: 503,
            message: "暂时无法核对计划权限，请稍后重试",
            maxAccessibleDayIndex: null,
        };
    }
    if (!instance) {
        return {
            allowed: false,
            status: 404,
            message: "计划实例不存在",
            maxAccessibleDayIndex: null,
        };
    }

    const subscriptionId = (instance as any).coach_subscription_id as
        | string
        | null;
    if (!subscriptionId) {
        if ((instance as any).student_id !== studentId) {
            return { allowed: false, status: 403, message: '无权访问此计划', maxAccessibleDayIndex: null };
        }
        return {
            allowed: true,
            status: 200,
            maxAccessibleDayIndex: null,
        };
    }

    const { data: subscription, error: subscriptionError } = await supabase
        .from("coach_subscriptions")
        .select("id, student_id, status, start_date, end_date, subscribed_weeks")
        .eq("id", subscriptionId)
        .eq("student_id", studentId)
        .maybeSingle();

    if (subscriptionError) {
        return {
            allowed: false, status: 503,
            message: "暂时无法核对订阅权益，请稍后重试",
            maxAccessibleDayIndex: null,
        };
    }
    if (!subscription) {
        return {
            allowed: false,
            status: 403,
            message: "无权访问此计划",
            maxAccessibleDayIndex: null,
        };
    }

    const { data: completedExecutions, error: completedExecutionsError } = await supabase
        .from("plan_instance_executions")
        .select("day_index, status")
        .eq("instance_id", instanceId)
        .eq("status", "completed");
    if (completedExecutionsError) {
        return {
            allowed: false, status: 503,
            message: "暂时无法核对已用权益，请稍后重试",
            maxAccessibleDayIndex: null,
        };
    }

    let carryover;
    try {
        carryover = await getSubscriptionCarryoverSummary({
            subscriptionId,
            subscribedWeeks: Number(subscription.subscribed_weeks || 0),
            excludeInstanceId: instanceId,
            createdBefore: (instance as any)?.created_at || null,
            subscriptionStartDate: (subscription as any)?.start_date || null,
        });
    } catch (error) {
        console.error("[execution-access] cannot verify carryover", error);
        return {
            allowed: false, status: 503,
            message: "暂时无法核对历史权益，请稍后重试",
            maxAccessibleDayIndex: null,
        };
    }

    const decision = evaluateSubscriptionPlanAccess({
        subscription,
        requestedDayIndex: dayIndex ?? null,
        trainingDays: Array.isArray((instance as any)?.training_days)
            ? ((instance as any).training_days as any[])
            : [],
        executions: (completedExecutions || []).map((exec: any) => ({
            day_index: Number(exec?.day_index ?? 0),
            status: exec?.status || "completed",
        })),
        startExecutionDay: Number((instance as any)?.start_execution_day || 1),
        effectiveSubscribedWeeks: carryover.remainingWeeks,
    });

    if (!decision.allowed) {
        if (decision.reason === "SUBSCRIPTION_EXPIRED") {
            return {
                allowed: false,
                status: 403,
                reason: decision.reason,
                message: "订阅已过期，请续费后继续训练",
                maxAccessibleDayIndex: decision.maxAccessibleDayIndex,
            };
        }

        return {
            allowed: false,
            status: 403,
            reason: decision.reason,
            message: "当前训练日不在订阅范围内",
            maxAccessibleDayIndex: decision.maxAccessibleDayIndex,
        };
    }

    return {
        allowed: true,
        status: 200,
        maxAccessibleDayIndex: decision.maxAccessibleDayIndex,
    };
}

