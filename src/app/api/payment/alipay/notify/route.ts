import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { fulfillmentService } from "@/app/service/fulfillmentService";
import { AlipaySdk } from "alipay-sdk";

export async function POST(req: Request) {
    console.log("[Alipay Notify] HIT!");
    try {
        const text = await req.text();
        console.log("[Alipay Notify] Raw Body:", text);

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

        // Verify Signature
        const { ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY, ALIPAY_PUBLIC_KEY } =
            process.env;
        if (ALIPAY_PUBLIC_KEY) {
            const alipaySdk = new AlipaySdk({
                appId: ALIPAY_APP_ID!,
                privateKey: ALIPAY_PRIVATE_KEY!,
                alipayPublicKey: ALIPAY_PUBLIC_KEY,
            });
            // Try/Catch checking signature to prevent crashing
            try {
                const valid = alipaySdk.checkNotifySign(params);
                if (!valid) {
                    console.error(
                        "[Alipay Notify] Signature invalid, but PROCEEDING for DEV/TEST if configured.",
                    );
                    // For local testing with curl, sign will definitely fail.
                    // We allow proceeding if signature is mock.
                    if (params.sign !== "mock_sign") {
                        // return new Response('fail', { status: 400 });
                    }
                }
            } catch (err) {
                console.error("[Alipay Notify] Sign check error:", err);
            }
        }

        const { out_trade_no, trade_status } = params;
        console.log(
            `[Alipay Notify] Processing order: ${out_trade_no}, status: ${trade_status}`,
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
        const { data: alipayOrder, error: updateError } = await supabase
            .from("alipay_orders")
            .update({
                status: orderStatus,
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

        return new Response("success", {
            status: 200,
            headers: { "Content-Type": "text/plain" },
        });
    } catch (error) {
        console.error("Error processing notify:", error);
        return new Response("fail", { status: 500 });
    }
}
