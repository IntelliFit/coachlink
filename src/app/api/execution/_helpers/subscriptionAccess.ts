import supabase from "@/lib/supabaseClient";
import { evaluateSubscriptionPlanAccess } from "@/lib/subscriptionAccess";

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
        .select("coach_subscription_id")
        .eq("id", instanceId)
        .maybeSingle();

    if (instanceError || !instance) {
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
        return {
            allowed: true,
            status: 200,
            maxAccessibleDayIndex: null,
        };
    }

    const { data: subscription } = await supabase
        .from("coach_subscriptions")
        .select("id, student_id, status, end_date, subscribed_weeks")
        .eq("id", subscriptionId)
        .eq("student_id", studentId)
        .maybeSingle();

    if (!subscription) {
        return {
            allowed: false,
            status: 403,
            message: "无权访问此计划",
            maxAccessibleDayIndex: null,
        };
    }

    const decision = evaluateSubscriptionPlanAccess({
        subscription,
        requestedDayIndex: dayIndex ?? null,
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

