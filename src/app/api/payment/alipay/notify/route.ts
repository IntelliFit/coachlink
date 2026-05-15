import { NextResponse } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { createAlipaySdk } from "@/lib/alipaySdk";
import { yuanToFen } from "@/lib/moneyUtils";
import {
    fulfillPaidSubscriptionOrder,
    isSubscriptionOrderType,
} from "@/app/api/payment/alipay/fulfillPaidOrder";
import { fulfillContentPurchasePaid } from "../contentPurchaseFulfillment";
import { fulfillStudentMembershipOrderOnPaid } from "@/app/api/payment/studentMembershipFulfillment";
import { processHuifuPaymentNotify } from "@/app/api/payment/huifuPaymentNotify";

function alipayNotifyAmountFen(totalAmount: string | undefined) {
    const amountFen = yuanToFen(totalAmount);
    return amountFen > 0 ? amountFen : null;
}

export async function POST(req: Request) {
    const timestamp = new Date().toISOString();
    console.log(`[Alipay Notify] ${timestamp} - 收到支付宝异步通知请求`);
    console.log(`[Alipay Notify] 请求来源: ${req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"}`);
    console.log(`[Alipay Notify] User-Agent: ${req.headers.get("user-agent") || "unknown"}`);
    
    try {
        const text = await req.text();
        console.log(`[Alipay Notify] Raw Body (${text.length} bytes):`, text.substring(0, 500));

        let params: Record<string, string> = {};
        if (
            req.headers.get("content-type")?.includes(
                "application/x-www-form-urlencoded",
            )
        ) {
            const urlParams = new URLSearchParams(text);
            urlParams.forEach((val, key) => {
                params[key] = val;
            });
        } else {
            // Fallback or FormData attempt (though headers usually dictate)
            // If we already read stream as text, we can't read as formData easily.
            // Assume typical Alipay form-urlencoded.
            const urlParams = new URLSearchParams(text);
            urlParams.forEach((val, key) => {
                params[key] = val;
            });
        }

        console.log("[Alipay Notify] Received params:", params);

        if (params.resp_data && params.sign && !params.out_trade_no) {
            const result = await processHuifuPaymentNotify({
                content: params.resp_data,
                sign: params.sign,
                defaultPaymentProvider: "huifu_alipay",
            });
            return new Response(`RECV_ORD_ID_${result.reqSeqId}`, {
                status: 200,
                headers: { "Content-Type": "text/plain; charset=UTF-8" },
            });
        }

        // 安全：必须验签。支付宝用私钥对通知参数签名，我方用公钥校验，伪造请求无法通过
        const { ALIPAY_PUBLIC_KEY } = process.env;
        if (!ALIPAY_PUBLIC_KEY) {
            console.error("[Alipay Notify] ALIPAY_PUBLIC_KEY 未配置，拒绝处理");
            return new Response("fail", { status: 500 });
        }
        const alipaySdk = createAlipaySdk();
        try {
            const valid = alipaySdk.checkNotifySign(params);
            if (!valid) {
                console.error("[Alipay Notify] 验签失败，拒绝处理（可能为伪造请求）");
                return new Response("fail", { status: 400 });
            }
        } catch (err) {
            console.error("[Alipay Notify] 验签异常:", err);
            return new Response("fail", { status: 400 });
        }

        const { out_trade_no, trade_status, trade_no, total_amount } = params;
        console.log(
            `[Alipay Notify] 订单号: ${out_trade_no}, 支付宝交易号: ${trade_no}, 状态: ${trade_status}, 金额: ${total_amount}`,
        );

        if (!out_trade_no) {
            console.error("[Alipay Notify] Missing out_trade_no");
            return NextResponse.json({
                success: false,
                message: "Missing out_trade_no",
            }, { status: 400 });
        }

        const { data: existingOrder, error: existingOrderError } = await serviceRoleSupabase
            .from("alipay_orders")
            .select("id,total_amount")
            .eq("id", out_trade_no)
            .maybeSingle();

        if (existingOrderError || !existingOrder) {
            console.error("[Alipay Notify] order not found before update:", existingOrderError);
            return new Response("fail", { status: 500 });
        }

        // Determine Status
        let orderStatus = "pending";
        if (
            trade_status === "TRADE_SUCCESS" ||
            trade_status === "TRADE_FINISHED"
        ) {
            orderStatus = "paid";
        } else if (trade_status === "TRADE_CLOSED") {
            orderStatus = "closed"; // 数据库约束：pending|paid|failed|closed|refunded
        }

        if (orderStatus === "paid") {
            const notifyAmountFen = alipayNotifyAmountFen(total_amount);
            const localAmountFen = Math.round(Number(existingOrder.total_amount || 0));
            if (!notifyAmountFen || notifyAmountFen !== localAmountFen) {
                console.error("[Alipay Notify] amount mismatch:", {
                    out_trade_no,
                    localAmountFen,
                    notifyAmountFen: notifyAmountFen ?? "missing",
                    total_amount,
                });
                return new Response("fail", { status: 400 });
            }
        }

        // 1. Update `alipay_orders`
        const { data: alipayOrder, error: updateError } = await serviceRoleSupabase
            .from("alipay_orders")
            .update({
                status: orderStatus,
                trade_status: trade_status,
                alipay_trade_no: params.trade_no,
                updated_at: new Date().toISOString(),
            })
            .eq("id", out_trade_no) // Note: create-order uses `id` as out_trade_no
            .select()
            .single();

        if (updateError || !alipayOrder) {
            console.error("Failed to update alipay_orders:", updateError);
            return new Response("fail", { status: 500 });
        }

        // 2. Business Logic Trigger (Fulfillment)
        if (
            orderStatus === "paid" &&
            alipayOrder.order_type === "student_membership"
        ) {
            const orderData = alipayOrder.order_data as any;
            const related_order_id = orderData?.related_order_id;
            const product_key = orderData?.product_key;
            const userId = alipayOrder.user_id;

            if (related_order_id && product_key && userId) {
                try {
                    await fulfillStudentMembershipOrderOnPaid({
                        relatedOrderId: related_order_id,
                        productKey: product_key,
                        userId,
                    });
                } catch (err) {
                    console.error("[Fulfillment] Failed:", err);
                    // Even if fulfillment fails, we might still return success to Alipay to stop retries,
                    // but we should probably log critical error for manual intervention.
                }
            }
        }

        // 3. 订阅/续费确认 + 教练钱包入账（与 query/return 共用逻辑，幂等）
        if (orderStatus === "paid") {
            const orderType = alipayOrder.order_type;
            const orderData = (alipayOrder.order_data || {}) as any;
            const contentId = orderData?.contentId as string | undefined;

            const isSubscriptionOrder = isSubscriptionOrderType(orderType);

            if (isSubscriptionOrder) {
                await fulfillPaidSubscriptionOrder(
                    alipayOrder,
                    alipayOrder.user_id ?? ""
                );
            }

            // Content purchase (single-article unlock + coach wallet credit)
            if (orderType === "content_purchase" && contentId) {
                try {
                    await fulfillContentPurchasePaid({
                        orderId: alipayOrder.id,
                        userId: alipayOrder.user_id,
                        contentId,
                    });
                } catch (e) {
                    // Do not fail the callback; Alipay will retry if we return non-success.
                    console.error("[Alipay Notify] Content purchase fulfill failed:", e);
                }
            }
        }

        console.log(`[Alipay Notify] 订单 ${out_trade_no} 处理成功，返回 success`);
        return new Response("success", {
            status: 200,
            headers: { "Content-Type": "text/plain" },
        });
    } catch (error) {
        console.error(`[Alipay Notify] 处理失败:`, error);
        if (error instanceof Error) {
            console.error(`[Alipay Notify] 错误堆栈:`, error.stack);
        }
        return new Response("fail", { status: 500 });
    }
}
