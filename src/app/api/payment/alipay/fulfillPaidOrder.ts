/**
 * 平台支付订单支付成功后的统一履约逻辑（订阅确认 + 教练钱包入账）。
 * 当前供支付宝与微信小程序支付共用。
 * 所有操作均幂等：以 last_payment_order_id / alipay_order_id 防重。
 */
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { sendSystemMessage } from "@/lib/chat";
import { addFen } from "@/lib/moneyUtils";
import { autoMatchPlanForSubscription } from "@/app/api/plan-lib/auto-match-plan/service";

type PaymentProvider = "alipay" | "wechat";

function getPaymentMethod(provider: PaymentProvider) {
    return provider === "wechat" ? "platform_wechat" : "platform_alipay";
}

function getPaymentLabel(provider: PaymentProvider) {
    return provider === "wechat" ? "微信支付" : "平台支付";
}

/** 教练钱包入账 + 流水记录，按 alipay_order_id 幂等。同一支付宝订单只允许一条收入流水，先查再插，插入成功后才更新钱包，避免 notify/return/query 并发重复入账。 */
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

        // 应用层“先查再插”只是优化，无法解决并发：两个进程可能同时查到“没有”再同时写入。
        // 真正的同步由 DB 唯一约束（idx_wallet_transactions_alipay_order_id_income）保证：只有一个 insert 能成功，
        // 另一个会得到 23505，我们视为幂等成功；且只有插入成功的那次才更新钱包，故不会重复加余额。
        const { data: existRows } = await serviceRoleSupabase
            .from("wallet_transactions")
            .select("id")
            .eq("alipay_order_id", order.id)
            .limit(1);
        if (existRows && existRows.length > 0) return;

        // wallet_transactions.wallet_id 外键引用 coach_wallets(coach_id)，必须先有钱包行才能插流水。
        // 先确保教练钱包存在（不存在则插入余额 0），不改余额；插流水成功后再更新余额。
        await serviceRoleSupabase.from("coach_wallets").upsert(
            {
                coach_id: coachId,
                balance: 0,
                total_income: 0,
                frozen_amount: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            { onConflict: "coach_id", ignoreDuplicates: true }
        );

        const desc =
            (orderData?.subject as string) ||
            (order.subject as string) ||
            `支付宝订单 ${order.id}`;
        const { error: insertErr } = await serviceRoleSupabase.from("wallet_transactions").insert({
            wallet_id: coachId,
            amount: amountFen,
            type: "income",
            alipay_order_id: order.id,
            description: desc,
            created_at: new Date().toISOString(),
        });
        if (insertErr?.code === "23505") return; // 并发时第二个 insert 被唯一约束拒绝，幂等成功
        if (insertErr) throw insertErr;

        // 仅当流水插入成功后再更新钱包余额（原子加，避免并发重复加）
        const { data: wallet } = await serviceRoleSupabase
            .from("coach_wallets")
            .select("balance, total_income")
            .eq("coach_id", coachId)
            .single();
        if (wallet) {
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
    userId: string,
    provider: PaymentProvider = "alipay",
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
        payment_method: getPaymentMethod(provider),
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
                content: `新的学员订阅通过【${getPaymentLabel(provider)}】完成，系统已自动确认。请前往 [我的学员](/dashboard/students) 查看。`,
            });

            // 新订阅激活后自动尝试匹配计划；失败时给教练明确提示手动创建。
            if (order.order_type === "subscription") {
                const matchRes = await autoMatchPlanForSubscription(
                    subscriptionId,
                    coach.user_id,
                    sub.coach_id,
                );
                const matchMsg = matchRes.success
                    ? "系统已自动匹配训练计划，学员将在约2分钟后看到计划。"
                    : `自动匹配失败（${matchRes.reason || "未知原因"}），请前往 [我的学员](/dashboard/students) 手动创建计划。`;
                await sendSystemMessage(coach.user_id, {
                    content: `该学员订阅的计划分配结果：${matchMsg}`,
                });
            }
        }
    } catch (e) {
        console.error(
            "[Alipay fulfillPaidOrder] send coach system message:",
            e
        );
    }
}
