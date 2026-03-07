import supabase from "@/lib/supabaseClient";
import { createAiInstanceForSubscription } from "../create-ai-instance/service";

export interface AutoMatchPlanResult {
    success: boolean;
    reason?: string;
    error?: string;
}

/**
 * 自动为订阅匹配并生成计划（后台任务）
 * 如果匹配失败，静默处理，不抛出错误
 * 
 * @param subscriptionId 订阅ID
 * @param actorUserId 操作者用户ID（用于通知）
 * @param actorCoachId 操作者教练ID
 */
export async function autoMatchPlanForSubscription(
    subscriptionId: string,
    actorUserId: string,
    actorCoachId: string,
): Promise<AutoMatchPlanResult> {
    try {
        // 检查订阅是否存在且为活跃状态
        const { data: subscription, error: subError } = await supabase
            .from("coach_subscriptions")
            .select("id, status, subscribe_data, student_id, coach_id")
            .eq("id", subscriptionId)
            .single();

        if (subError || !subscription) {
            console.warn(`[auto-match-plan] 订阅不存在: ${subscriptionId}`, subError);
            return { success: false, reason: "订阅不存在" };
        }

        if (subscription.status !== "active") {
            console.warn(`[auto-match-plan] 订阅非活跃状态: ${subscriptionId}, status=${subscription.status}`);
            return { success: false, reason: "订阅非活跃状态" };
        }

        // 检查是否已有计划实例
        const { data: existingInstance } = await supabase
            .from("coach_plan_instances")
            .select("id")
            .eq("coach_subscription_id", subscriptionId)
            .maybeSingle();

        if (existingInstance) {
            console.log(`[auto-match-plan] 订阅 ${subscriptionId} 已有计划实例，跳过自动匹配`);
            return { success: false, reason: "已有计划实例" };
        }

        // 检查是否有问卷数据
        const subscribeData = subscription.subscribe_data;
        if (!subscribeData || (Array.isArray(subscribeData) && subscribeData.length === 0)) {
            console.warn(`[auto-match-plan] 订阅 ${subscriptionId} 无问卷数据，跳过自动匹配`);
            return { success: false, reason: "无问卷数据" };
        }

        // 尝试自动匹配并生成计划（延迟2分钟激活）
        await createAiInstanceForSubscription({
            actorUserId,
            actorCoachId,
            subscriptionId,
            startWeek: 1,
            startDay: 1,
            delayedActivation: true, // 延迟2分钟激活
        });

        console.log(`[auto-match-plan] 成功为订阅 ${subscriptionId} 自动匹配并生成计划`);
            return { success: true };
    } catch (error: any) {
        // 静默处理错误，不抛出异常
        console.error(`[auto-match-plan] 自动匹配失败 (订阅ID: ${subscriptionId}):`, error?.message || error);
        return { 
            success: false, 
            reason: error?.message || "匹配失败",
            error: error instanceof Error ? error.message : String(error),
        };
    }
}



