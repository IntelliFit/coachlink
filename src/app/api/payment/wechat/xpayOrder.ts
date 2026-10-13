import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { getWechatXPayConfig } from "@/lib/wechatXPay";
import { fulfillXPayAdminTrial } from '@/lib/wechatXPayAdminTrial';

function asObject(value: unknown): Record<string, any> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, any>
        : {};
}

export async function findXPayOrderByOutTradeNo(outTradeNo: string) {
    const { data, error } = await (serviceRoleSupabase.from("alipay_orders") as any)
        .select("*")
        .eq("payment_provider", "wechat_xpay")
        .eq("order_data->>xpay_out_trade_no", String(outTradeNo || "").trim())
        .maybeSingle();
    if (error) throw error;
    return data as Record<string, any> | null;
}

export function validateXPayOrderMatch(order: Record<string, any>, input: {
    outTradeNo: string;
    openId: string;
    env: number;
    productId?: string;
    quantity?: number;
    originalPrice?: number;
    actualPrice: number;
}) {
    const data = asObject(order.order_data);
    const expectedPrice = Math.round(Number(data.xpay_goods_price ?? order.total_amount ?? 0));
    const config = getWechatXPayConfig();
    const matches =
        String(order.payment_provider || "") === "wechat_xpay" &&
        String(data.xpay_out_trade_no || "") === input.outTradeNo &&
        String(data.xpay_openid || "") === input.openId &&
        Number(data.xpay_env) === input.env &&
        input.env === config.env &&
        (!input.productId || String(data.xpay_product_id || "") === input.productId) &&
        (input.quantity == null || input.quantity === 1) &&
        (input.originalPrice == null || input.originalPrice === expectedPrice) &&
        input.actualPrice === expectedPrice;
    if (!matches) throw new Error("虚拟支付结果与本地订单不一致");
}

export async function fulfillPaidXPayOrder(order: Record<string, any>) {
    const userId = String(order.user_id || "");
    if (!["student_membership", "motion_effect_export"].includes(String(order.order_type || ""))) {
        throw new Error("该订单类型不允许通过微信虚拟支付发货");
    }
    if (order.order_type === "student_membership") {
        const orderData = asObject(order.order_data);
        if (orderData.xpay_admin_trial === true) {
            await fulfillXPayAdminTrial(order);
            return;
        }
        // Grant and idempotency receipt commit together, after verified payment.
        const { error } = await (serviceRoleSupabase as any).rpc('fulfill_wechat_xpay_membership', { p_payment_id: order.id });
        if (error) throw new Error(`虚拟支付权益发放失败：${error.message}`);
    }
    if (order.order_type === "motion_effect_export") {
        const jobId = String(asObject(order.order_data).job_id || "");
        if (jobId) {
            const { error } = await (serviceRoleSupabase.from("tool_video_render_jobs") as any)
                .update({ payment_status: "paid", status: "awaiting_upload" })
                .eq("id", jobId)
                .eq("payment_order_id", order.id)
                .eq("status", "awaiting_payment");
            if (error) throw new Error(`动作特效权益发放失败：${error.message}`);
        }
    }
}

export async function markXPayOrderPaid(order: Record<string, any>, input: {
    transactionId?: string;
    paidAt?: Date;
}) {
    if (order.status === "refunded") throw new Error("虚拟支付订单已经退款");
    if (!["student_membership", "motion_effect_export"].includes(String(order.order_type || ""))) {
        throw new Error("该订单类型不允许通过微信虚拟支付支付");
    }
    let latest = order;
    if (order.status !== "paid") {
        const { data, error } = await (serviceRoleSupabase.from("alipay_orders") as any)
            .update({
                status: "paid",
                trade_status: "XPAY_PAID",
                alipay_trade_no: String(input.transactionId || "") || null,
                payment_provider: "wechat_xpay",
                updated_at: (input.paidAt || new Date()).toISOString(),
            })
            .eq("id", order.id)
            .in("status", ["pending", "paid"])
            .select("*")
            .single();
        if (error || !data) throw error || new Error("更新虚拟支付订单失败");
        latest = data;
    }
    await fulfillPaidXPayOrder(latest);
    return latest;
}

export async function markXPayOrderRefunded(order: Record<string, any>, input: {
    refundedAt?: Date;
    refundFee: number;
    transactionId?: string;
}) {
    const expected = Math.round(Number(order.total_amount || 0));
    if (!Number.isSafeInteger(input.refundFee) || input.refundFee <= 0 || input.refundFee > expected) {
        throw new Error("虚拟支付退款金额与本地订单不一致");
    }
    const fullyRefunded = input.refundFee === expected;
    const refundedAt = input.refundedAt || new Date();
    const orderData = asObject(order.order_data);
    const { error: orderError } = await (serviceRoleSupabase.from("alipay_orders") as any)
        .update({
            status: fullyRefunded ? "refunded" : "paid",
            trade_status: fullyRefunded ? "XPAY_REFUNDED" : "XPAY_PARTIAL_REFUND",
            alipay_trade_no: String(input.transactionId || order.alipay_trade_no || "") || null,
            order_data: {
                ...orderData,
                xpay_refund: {
                    status: fullyRefunded ? "completed" : "partial",
                    refund_fee: input.refundFee,
                    refunded_at: refundedAt.toISOString(),
                    entitlement_status: "manual_review",
                },
            },
            updated_at: refundedAt.toISOString(),
        })
        .eq("id", order.id);
    if (orderError) throw new Error(`更新虚拟支付退款状态失败: ${orderError.message}`);

    // 部分退款不能自动撤销整份权益，保留 paid 并交由运营人工核对。
    if (!fullyRefunded) return { fullyRefunded: false };

    if (order.order_type === "student_membership" && orderData.related_order_id) {
        const { error } = await (serviceRoleSupabase.from("student_membership_orders") as any)
            .update({ status: "refunded" })
            .eq("id", orderData.related_order_id);
        if (error) throw new Error(`更新会员购买单退款状态失败: ${error.message}`);
    }
    if (order.order_type === "motion_effect_export" && orderData.job_id) {
        const { error } = await (serviceRoleSupabase.from("tool_video_render_jobs") as any)
            .update({ payment_status: "refunded", updated_at: refundedAt.toISOString() })
            .eq("id", orderData.job_id)
            .eq("payment_order_id", order.id);
        if (error) throw new Error(`更新动作特效退款状态失败: ${error.message}`);
    }
    return { fullyRefunded: true };
}
