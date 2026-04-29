import { NextRequest, NextResponse } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { parseHuifuNotifyContent } from "@/lib/huifuMiniProgramPay";
import {
    fulfillSubscriptionOnPaid,
    updateTransactionAndWallet,
} from "@/app/api/payment/alipay/fulfillPaidOrder";
import { fulfillStudentMembershipOrderOnPaid } from "@/app/api/payment/studentMembershipFulfillment";

export const runtime = "nodejs";

function mapNotifyStatus(transStat: string | undefined) {
    if (transStat === "S") return "paid";
    if (transStat === "F") return "failed";
    return "pending";
}

export async function POST(request: NextRequest) {
    const rawBody = await request.text();

    try {
        let sign = "";
        let content = "";

        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("application/x-www-form-urlencoded")) {
            const params = new URLSearchParams(rawBody);
            sign = String(params.get("sign") || "").trim();
            content = String(params.get("resp_data") || "").trim();
        } else {
            const parsed = JSON.parse(rawBody) as { sign?: string; resp_data?: string; data?: string };
            sign = String(parsed.sign || "").trim();
            content = String(parsed.resp_data || parsed.data || "").trim();
        }

        if (!sign || !content) {
            return new Response("", { status: 400 });
        }

        const notifyData = parseHuifuNotifyContent(content, sign) as Record<string, any>;
        const reqSeqId = String(notifyData.req_seq_id || "").trim();

        if (!reqSeqId) {
            return new Response("", { status: 400 });
        }

        const nextStatus = mapNotifyStatus(String(notifyData.trans_stat || ""));
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
                payment_provider: "wechat",
                updated_at: new Date().toISOString(),
            })
            .eq("id", reqSeqId)
            .select()
            .single();

        if (updateError || !updatedOrder) {
            console.error("[Huifu Wechat Notify] update order failed:", updateError);
            return new Response("", { status: 500 });
        }

        if (
            nextStatus === "paid" &&
            (updatedOrder.order_type === "subscription" || updatedOrder.order_type === "subscription_renew")
        ) {
            await fulfillSubscriptionOnPaid(
                updatedOrder,
                updatedOrder.id,
                String(updatedOrder.user_id || ""),
                "wechat",
            );
            await updateTransactionAndWallet(updatedOrder);
        }

        if (nextStatus === "paid" && updatedOrder.order_type === "student_membership") {
            const orderData = (updatedOrder.order_data || {}) as Record<string, any>;
            await fulfillStudentMembershipOrderOnPaid({
                relatedOrderId: String(orderData.related_order_id || ""),
                productKey: String(orderData.product_key || ""),
                userId: String(updatedOrder.user_id || ""),
            });
        }

        return new Response(`RECV_ORD_ID_${reqSeqId}`, {
            status: 200,
            headers: {
                "Content-Type": "text/plain; charset=UTF-8",
            },
        });
    } catch (error) {
        console.error("[Huifu Wechat Notify] failed:", error);
        return new Response("", { status: 500 });
    }
}
