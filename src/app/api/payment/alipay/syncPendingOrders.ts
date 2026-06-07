/**
 * 同步「仍为 pending 的订单」到支付宝实际状态并履约（与 notify/query 共用履约逻辑，幂等）。
 * 供进程内定时器与 HTTP 接口共用。
 * 只处理「创建时间在最近 N 小时内」的 pending 订单，避免运行很久后仍去查一年前的单。
 */
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { createAlipaySdk } from "@/lib/alipaySdk";
import {
    updateTransactionAndWallet,
    fulfillSubscriptionAndMaybeCreditWallet,
} from "@/app/api/payment/alipay/fulfillPaidOrder";
import { fulfillContentPurchasePaid } from "@/app/api/payment/alipay/contentPurchaseFulfillment";
import { formatHuifuReqDate, queryHuifuMiniProgramOrder } from "@/lib/huifuMiniProgramPay";

// 只拉取最近 N 小时内的 pending 订单；超出的订单留在库里但不查支付宝（可配 ALIPAY_SYNC_PENDING_WINDOW_HOURS，默认 48）
const PENDING_WINDOW_HOURS =
    parseInt(process.env.ALIPAY_SYNC_PENDING_WINDOW_HOURS || "48", 10) || 48;

async function queryAlipayTradeStatus(orderId: string): Promise<{
    tradeStatus: string | null;
    tradeNo: string | null;
}> {
    const alipaySdk = createAlipaySdk();
    const response = await alipaySdk.exec("alipay.trade.query", {
        bizContent: { out_trade_no: orderId },
    });
    return {
        tradeStatus: (response?.tradeStatus as string) ?? null,
        tradeNo: (response?.tradeNo as string) ?? null,
    };
}

export type SyncPendingResult = {
    checked: number;
    updated: number;
    errors: string[];
};

function isCoachRevenueHuifuCandidate(orderType: string | null | undefined, orderData: Record<string, any>) {
    return (
        orderType === "coach_subscription" ||
        orderType === "coach_subscription_renew"
    ) && Boolean(orderData.coachId || orderData.coach_id);
}

export async function syncPendingAlipayOrders(): Promise<SyncPendingResult> {
    const since = new Date();
    since.setHours(since.getHours() - PENDING_WINDOW_HOURS);
    const sinceIso = since.toISOString();

    const { data: pendingOrders, error: listError } = await serviceRoleSupabase
        .from("alipay_orders")
        .select("id, user_id, order_type, order_data, total_amount, subject, payment_provider, created_at")
        .eq("status", "pending")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(100);

    if (listError) {
        console.error("[Alipay SyncPending] List pending orders error:", listError);
        return { checked: 0, updated: 0, errors: [listError.message] };
    }

    if (!pendingOrders?.length) {
        return { checked: 0, updated: 0, errors: [] };
    }

    let updated = 0;
    const errors: string[] = [];

    for (const row of pendingOrders) {
        try {
            const paymentProvider = String((row as any).payment_provider || "").trim();
            const provider = paymentProvider || "alipay";
            const rowOrderData = ((row as any).order_data || {}) as Record<string, any>;
            const isHuifuGatewayOrder =
                provider === "huifu_alipay" ||
                provider === "wechat" ||
                Boolean(rowOrderData.huifu_req_date) ||
                isCoachRevenueHuifuCandidate(String((row as any).order_type || ""), rowOrderData);

            if (isHuifuGatewayOrder) {
                const huifuReqDate = String(
                    rowOrderData.huifu_req_date || formatHuifuReqDate(new Date((row as any).created_at)),
                ).trim();
                const queryResult = await queryHuifuMiniProgramOrder({
                    orgReqDate: huifuReqDate,
                    orgReqSeqId: String(row.id),
                });
                const orderStatus =
                    queryResult.trans_stat === "S"
                        ? "paid"
                        : queryResult.trans_stat === "F"
                          ? "failed"
                          : "pending";

                if (orderStatus === "pending") {
                    continue;
                }

                const { data: order, error: updateOrderError } =
                    await serviceRoleSupabase
                        .from("alipay_orders")
                        .update({
                            status: orderStatus,
                            trade_status: queryResult.trans_stat || null,
                            alipay_trade_no: queryResult.org_hf_seq_id || null,
                            order_data: rowOrderData.huifu_req_date
                                ? rowOrderData
                                : { ...rowOrderData, huifu_req_date: huifuReqDate },
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", row.id)
                        .select()
                        .single();

                if (updateOrderError || !order) {
                    errors.push(`order ${row.id}: update failed ${updateOrderError?.message}`);
                    continue;
                }

                if (orderStatus === "paid") {
                    const userId = order.user_id ?? "";
                    if (
                        order.order_type === "subscription" ||
                        order.order_type === "subscription_renew" ||
                        order.order_type === "coach_subscription" ||
                        order.order_type === "coach_subscription_renew"
                    ) {
                        await fulfillSubscriptionAndMaybeCreditWallet(
                            order as any,
                            userId,
                            provider === "wechat" ? "wechat" : "alipay",
                        );
                    } else if (order.order_type === "content_purchase") {
                        const orderData = (order.order_data || {}) as Record<string, any>;
                        const contentId = orderData.contentId as string | undefined;
                        if (contentId) {
                            await fulfillContentPurchasePaid({
                                orderId: order.id,
                                userId,
                                contentId,
                            });
                        }
                    } else {
                        await updateTransactionAndWallet(order);
                    }
                    updated++;
                }
                continue;
            }

            const { tradeStatus, tradeNo } = await queryAlipayTradeStatus(row.id);
            const isPaid =
                tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED";
            const isClosed = tradeStatus === "TRADE_CLOSED";

            if (!isPaid && !isClosed) continue;

            const orderStatus = isPaid ? "paid" : "closed"; // 数据库约束：pending|paid|failed|closed|refunded
            const { data: order, error: updateOrderError } =
                await serviceRoleSupabase
                    .from("alipay_orders")
                    .update({
                        status: orderStatus,
                        trade_status: tradeStatus,
                        alipay_trade_no: tradeNo,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", row.id)
                    .select()
                    .single();

            if (updateOrderError || !order) {
                errors.push(`order ${row.id}: update failed ${updateOrderError?.message}`);
                continue;
            }

            if (orderStatus === "paid") {
                const userId = order.user_id ?? "";
                if (
                    order.order_type === "subscription" ||
                    order.order_type === "subscription_renew" ||
                    order.order_type === "coach_subscription" ||
                    order.order_type === "coach_subscription_renew"
                ) {
                    await fulfillSubscriptionAndMaybeCreditWallet(order as any, userId);
                } else {
                    await updateTransactionAndWallet(order);
                }
                updated++;
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`order ${row.id}: ${msg}`);
        }
    }

    if (pendingOrders.length > 0 || updated > 0 || errors.length > 0) {
        console.log(
            `[Alipay SyncPending] checked=${pendingOrders.length}, updated=${updated}, errors=${errors.length}`
        );
        if (errors.length) {
            console.error("[Alipay SyncPending] errors:", errors);
        }
    }

    return {
        checked: pendingOrders.length,
        updated,
        errors,
    };
}
