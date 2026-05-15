/**
 * 同步「仍为 pending 的订单」到支付宝实际状态并履约（与 notify/query 共用履约逻辑，幂等）。
 * 供进程内定时器与 HTTP 接口共用。
 * 只处理「创建时间在最近 N 小时内」的 pending 订单，避免运行很久后仍去查一年前的单。
 */
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { createAlipaySdk } from "@/lib/alipaySdk";
import { yuanToFen } from "@/lib/moneyUtils";
import {
    fulfillPaidSubscriptionOrder,
    isHuifuBackedPaymentOrder,
    isSubscriptionOrderType,
} from "@/app/api/payment/alipay/fulfillPaidOrder";

// 只拉取最近 N 小时内的 pending 订单；超出的订单留在库里但不查支付宝（可配 ALIPAY_SYNC_PENDING_WINDOW_HOURS，默认 48）
const PENDING_WINDOW_HOURS =
    parseInt(process.env.ALIPAY_SYNC_PENDING_WINDOW_HOURS || "48", 10) || 48;

async function queryAlipayTradeStatus(orderId: string): Promise<{
    tradeStatus: string | null;
    tradeNo: string | null;
    amountFen: number | null;
}> {
    const alipaySdk = createAlipaySdk();
    const response = await alipaySdk.exec("alipay.trade.query", {
        bizContent: { out_trade_no: orderId },
    });
    return {
        tradeStatus: (response?.tradeStatus as string) ?? null,
        tradeNo: (response?.tradeNo as string) ?? null,
        amountFen: response?.totalAmount || response?.total_amount
            ? yuanToFen(String(response.totalAmount || response.total_amount))
            : null,
    };
}

export type SyncPendingResult = {
    checked: number;
    updated: number;
    errors: string[];
};

export async function syncPendingAlipayOrders(): Promise<SyncPendingResult> {
    const since = new Date();
    since.setHours(since.getHours() - PENDING_WINDOW_HOURS);
    const sinceIso = since.toISOString();

    const { data: pendingOrders, error: listError } = await serviceRoleSupabase
        .from("alipay_orders")
        .select("id, user_id, order_type, order_data, total_amount, subject, payment_provider")
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
            if (isHuifuBackedPaymentOrder(row)) {
                continue;
            }

            const { tradeStatus, tradeNo, amountFen } = await queryAlipayTradeStatus(row.id);
            const isPaid =
                tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED";
            const isClosed = tradeStatus === "TRADE_CLOSED";

            if (!isPaid && !isClosed) continue;
            if (isPaid && (!amountFen || amountFen !== Math.round(Number(row.total_amount || 0)))) {
                errors.push(`order ${row.id}: amount mismatch local=${row.total_amount} gateway=${amountFen ?? "missing"}`);
                continue;
            }

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
                if (isSubscriptionOrderType(order.order_type)) {
                    await fulfillPaidSubscriptionOrder(order, userId);
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
