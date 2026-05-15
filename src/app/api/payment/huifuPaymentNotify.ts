import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { yuanToFen } from "@/lib/moneyUtils";
import { parseHuifuNotifyContent } from "@/lib/huifuMiniProgramPay";
import {
    fulfillPaidSubscriptionOrder,
    isSubscriptionOrderType,
} from "@/app/api/payment/alipay/fulfillPaidOrder";
import { fulfillStudentMembershipOrderOnPaid } from "@/app/api/payment/studentMembershipFulfillment";

type StoredPaymentProvider = "wechat" | "huifu_alipay";

function mapNotifyStatus(transStat: string | undefined) {
    if (transStat === "S") return "paid";
    if (transStat === "F") return "failed";
    return "pending";
}

function fallbackProviderForStoredProvider(provider: string) {
    return provider === "huifu_alipay" ? "alipay" : "wechat";
}

function huifuNotifyAmountFen(notifyData: Record<string, any>) {
    const rawAmount = notifyData.trans_amt ?? notifyData.pay_amt ?? notifyData.total_amount;
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return yuanToFen(amount);
}

function assertPaidAmountMatches(order: Record<string, any>, notifyData: Record<string, any>) {
    const notifyAmountFen = huifuNotifyAmountFen(notifyData);
    const localAmountFen = Math.round(Number(order.total_amount ?? 0));
    if (!notifyAmountFen || notifyAmountFen !== localAmountFen) {
        throw new Error(
            `Huifu notify amount mismatch: order=${order.id}, localFen=${localAmountFen}, notifyFen=${notifyAmountFen ?? "missing"}`,
        );
    }
}

export async function processHuifuPaymentNotify(params: {
    content: string;
    sign: string;
    defaultPaymentProvider: StoredPaymentProvider;
}) {
    const notifyData = parseHuifuNotifyContent(params.content, params.sign) as Record<string, any>;
    const reqSeqId = String(notifyData.req_seq_id || "").trim();

    if (!reqSeqId) {
        throw new Error("Huifu notify missing req_seq_id");
    }

    const nextStatus = mapNotifyStatus(String(notifyData.trans_stat || ""));

    const { data: existingOrder, error: existingOrderError } = await (serviceRoleSupabase
        .from("alipay_orders") as any)
        .select("*")
        .eq("id", reqSeqId)
        .maybeSingle();

    if (existingOrderError) {
        throw existingOrderError;
    }
    if (!existingOrder) {
        throw new Error(`Huifu notify order not found: ${reqSeqId}`);
    }

    if (nextStatus === "paid") {
        assertPaidAmountMatches(existingOrder, notifyData);
    }

    const paymentProvider =
        String(existingOrder.payment_provider || "").trim() ||
        params.defaultPaymentProvider;

    const { data: updatedOrder, error: updateError } = await (serviceRoleSupabase
        .from("alipay_orders") as any)
        .update({
            status: nextStatus,
            trade_status: notifyData.trans_stat || null,
            alipay_trade_no:
                notifyData.org_hf_seq_id ||
                notifyData.out_trans_id ||
                notifyData.party_order_id ||
                null,
            payment_provider: paymentProvider,
            updated_at: new Date().toISOString(),
        })
        .eq("id", reqSeqId)
        .select()
        .single();

    if (updateError || !updatedOrder) {
        throw updateError || new Error(`Huifu notify order update failed: ${reqSeqId}`);
    }

    if (nextStatus === "paid" && isSubscriptionOrderType(updatedOrder.order_type)) {
        await fulfillPaidSubscriptionOrder(
            updatedOrder,
            String(updatedOrder.user_id || ""),
            fallbackProviderForStoredProvider(paymentProvider),
        );
    }

    if (nextStatus === "paid" && updatedOrder.order_type === "student_membership") {
        const orderData = (updatedOrder.order_data || {}) as Record<string, any>;
        await fulfillStudentMembershipOrderOnPaid({
            relatedOrderId: String(orderData.related_order_id || ""),
            productKey: String(orderData.product_key || ""),
            userId: String(updatedOrder.user_id || ""),
        });
    }

    return { reqSeqId, status: nextStatus };
}
