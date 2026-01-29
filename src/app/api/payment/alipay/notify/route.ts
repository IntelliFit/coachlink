import { NextResponse } from "next/server";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { fulfillmentService } from "@/app/service/fulfillmentService";
import { createAlipaySdk } from "@/lib/alipaySdk";
import {
    updateTransactionAndWallet,
    fulfillSubscriptionOnPaid,
} from "@/app/api/payment/alipay/fulfillPaidOrder";

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

        // Determine Status
        let orderStatus = "pending";
        if (
            trade_status === "TRADE_SUCCESS" ||
            trade_status === "TRADE_FINISHED"
        ) {
            orderStatus = "paid";
        } else if (trade_status === "TRADE_CLOSED") {
            orderStatus = "cancelled";
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
                // Update the student_membership_order status too
                await supabase.from("student_membership_orders" as any)
                    .update({
                        status: "paid",
                        paid_at: new Date().toISOString(),
                    })
                    .eq("id", related_order_id);

                // Execute fulfillment
                try {
                    await fulfillmentService.fulfillOrder(
                        related_order_id,
                        product_key,
                        userId,
                    );
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
            const subscriptionId = orderData?.subscriptionId as string | undefined;

            if (
                subscriptionId &&
                (orderType === "subscription" || orderType === "subscription_renew")
            ) {
                await fulfillSubscriptionOnPaid(
                    alipayOrder,
                    alipayOrder.id,
                    alipayOrder.user_id ?? ""
                );
            }
            await updateTransactionAndWallet(alipayOrder);
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
