/**
 * 支付宝订单支付成功后的统一履约逻辑（订阅确认 + 教练钱包入账）。
 * 供 notify（支付宝服务器异步通知）、return（同步跳转）、query（前端轮询）共用。
 * 所有操作均幂等：以 last_payment_order_id / related_order_id 防重。
 */
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { sendSystemMessage } from "@/lib/chat";
import { addFen } from "@/lib/moneyUtils";

/** 教练钱包入账 + 流水记录，按 related_order_id 幂等 */
export async function updateTransactionAndWallet(order: {
    id: string;
    order_data?: unknown;
    total_amount?: number | string | null;
    amount?: number | string | null;
    subject?: string | null;
}): Promise<void> {
    try {
        const orderData = (order.order_data && typeof order.order_data === "object" ? order.order_data : {}) as Record<string, unknown>;
        const coachId = orderData?.coachId as string | undefined;
        // alipay_orders.total_amount 在 DB 中已存为分（整数），直接使用
        const amountFen = Math.round(Number(order.total_amount ?? order.amount ?? orderData?.amount ?? 0));
        if (!coachId || !amountFen || amountFen <= 0) return;

        const { data: existTx } = await serviceRoleSupabase
            .from("wallet_transactions")
            .select("id")
            .eq("related_order_id", order.id)
            .single();
        if (existTx) return;

        const { data: wallet } = await serviceRoleSupabase
            .from("coach_wallets")
            .select("*")
            .eq("coach_id", coachId)
            .single();

        if (!wallet) {
            // 新钱包：直接存储分（整数）
            await serviceRoleSupabase.from("coach_wallets").insert({
                coach_id: coachId,
                balance: amountFen,
                total_income: amountFen,
                frozen_amount: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
        } else {
            // 现有钱包：DB 中 balance/total_income 已是分，直接整数相加
            const currentBalanceFen = Number(wallet.balance ?? 0);
            const currentTotalIncomeFen = Number(wallet.total_income ?? 0);
            const newBalanceFen = addFen(currentBalanceFen, amountFen);
            const newTotalIncomeFen = addFen(currentTotalIncomeFen, amountFen);

            await serviceRoleSupabase
                .from("coach_wallets")
                .update({
                    balance: newBalanceFen,
                    total_income: newTotalIncomeFen,
                    updated_at: new Date().toISOString(),
                })
                .eq("coach_id", coachId);
        }

        const desc =
            (orderData?.subject as string) ||
            (order.subject as string) ||
            `支付宝订单 ${order.id}`;
        // 流水记录也存储分（整数）；重复 related_order_id 由 DB 唯一约束拦截
        const { error: insertErr } = await serviceRoleSupabase.from("wallet_transactions").insert({
            wallet_id: coachId,
            amount: amountFen,
            type: "income",
            related_order_id: order.id,
            description: desc,
            created_at: new Date().toISOString(),
        });
        // 唯一约束冲突：说明 notify/return/query 已入账过，幂等成功
        if (insertErr?.code === "23505") return;
        if (insertErr) throw insertErr;
    } catch (e) {
        console.error("[Alipay fulfillPaidOrder] updateTransactionAndWallet:", e);
    }
}

/** 订阅/续费确认 + 教练站内信，按 last_payment_order_id 幂等 */
export async function fulfillSubscriptionOnPaid(
    order: {
        id: string;
        order_type?: string | null;
        order_data?: unknown;
        user_id?: string | null;
    },
    orderId: string,
    userId: string
): Promise<void> {
    const orderData = (order.order_data && typeof order.order_data === "object" ? order.order_data : {}) as Record<string, unknown>;
    const subscriptionId = orderData?.subscriptionId as string | undefined;
    const coachId = orderData?.coachId as string | undefined;

    if (!subscriptionId) return;

    const { data: sub } = await serviceRoleSupabase
        .from("coach_subscriptions")
        .select(
            "id, student_id, coach_id, status, start_date, end_date, subscribed_weeks, last_payment_order_id"
        )
        .eq("id", subscriptionId)
        .single();

    if (!sub || sub.student_id !== userId) return;
    if (coachId && sub.coach_id !== coachId) return;
    if (sub.last_payment_order_id === order.id) return;

    const nowIso = new Date().toISOString();
    const update: Record<string, unknown> = {
        payment_method: "platform_alipay",
        payment_confirmed_by: "system",
        payment_confirmed_at: nowIso,
        coach_seen_at: null,
        last_payment_order_id: order.id,
        order_id: order.id,
    };

    if (order.order_type === "subscription") {
        update.status = "active";
    }

    if (order.order_type === "subscription_renew") {
        const weeks = Number(orderData?.renewAdditionalWeeks ?? 0);
        if (weeks > 0) {
            update.subscribed_weeks = Number(sub.subscribed_weeks || 0) + weeks;
            if (sub.end_date) {
                const base = new Date(sub.end_date);
                const now = new Date();
                const effectiveBase =
                    base.getTime() < now.getTime() ? now : base;
                effectiveBase.setDate(effectiveBase.getDate() + weeks * 7);
                update.end_date = effectiveBase.toISOString();
            }
        }
    }

    await serviceRoleSupabase
        .from("coach_subscriptions")
        .update(update)
        .eq("id", subscriptionId);

    try {
        const { data: coach } = await serviceRoleSupabase
            .from("coaches")
            .select("user_id")
            .eq("id", sub.coach_id)
            .single();
        if (coach?.user_id) {
            await sendSystemMessage(coach.user_id, {
                content: `新的学员订阅通过【平台支付】完成，系统已自动确认。请前往 [我的学员](/dashboard/students) 查看。`,
            });
        }
    } catch (e) {
        console.error(
            "[Alipay fulfillPaidOrder] send coach system message:",
            e
        );
    }
}
