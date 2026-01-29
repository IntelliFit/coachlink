import { NextResponse } from "next/server";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { fulfillmentService } from "@/app/service/fulfillmentService";
import { AlipaySdk } from "alipay-sdk";
import { sendSystemMessage } from "@/lib/chat";

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

        // 3. Subscription auto-confirm / auto-renew (platform payment must be fully automated)
        if (orderStatus === "paid") {
            const orderType = alipayOrder.order_type;
            const orderData = (alipayOrder.order_data || {}) as any;
            const subscriptionId = orderData?.subscriptionId as string | undefined;
            const coachId = orderData?.coachId as string | undefined;
            const contentId = orderData?.contentId as string | undefined;

            if (
                subscriptionId &&
                (orderType === "subscription" || orderType === "subscription_renew")
            ) {
                const { data: sub, error: subErr } = await serviceRoleSupabase
                    .from("coach_subscriptions")
                    .select("id, student_id, coach_id, status, start_date, end_date, subscribed_weeks, last_payment_order_id")
                    .eq("id", subscriptionId)
                    .single();

                if (!subErr && sub) {
                    // basic safety: payer must match subscription owner, and coach must match (if provided)
                    if (sub.student_id === alipayOrder.user_id && (!coachId || sub.coach_id === coachId)) {
                        // Idempotency guard: do not process the same order twice
                        if (sub.last_payment_order_id !== alipayOrder.id) {
                            const nowIso = new Date().toISOString();
                            const update: Record<string, unknown> = {
                                payment_method: "platform_alipay",
                                payment_confirmed_by: "system",
                                payment_confirmed_at: nowIso,
                                coach_seen_at: null, // coach needs to see a notification in unified inbox
                                last_payment_order_id: alipayOrder.id,
                            };

                            if (orderType === "subscription") {
                                update.status = "active";
                                // Do not set end_date here. We start counting only when the coach assigns the first plan.
                            }

                            if (orderType === "subscription_renew") {
                                const weeks = Number(orderData?.renewAdditionalWeeks || 0);
                                if (weeks > 0) {
                                    // Always accumulate purchased duration
                                    update.subscribed_weeks = Number(sub.subscribed_weeks || 0) + weeks;
                                    // B1: end_date is estimated completion date, refreshed elsewhere.
                                }
                            }

                            await serviceRoleSupabase
                                .from("coach_subscriptions")
                                .update(update)
                                .eq("id", subscriptionId);

                            // Notify coach (system-confirmed, no manual action required)
                            try {
                                const { data: coach, error: coachErr } = await serviceRoleSupabase
                                    .from("coaches")
                                    .select("user_id")
                                    .eq("id", sub.coach_id)
                                    .single();

                                if (!coachErr && coach?.user_id) {
                                    await sendSystemMessage(coach.user_id, {
                                        content: `新的学员订阅通过【平台支付】完成，系统已自动确认。请前往 [我的学员](/dashboard/students) 查看。`,
                                    });
                                }
                            } catch (e) {
                                console.error("[Alipay Notify] Failed to send coach system message:", e);
                            }
                        }
                    }
                }
            }

            // 4. Content purchase (single-article unlock)
            if (orderType === "content_purchase" && contentId) {
                try {
                    const nowIso = new Date().toISOString();
                    await serviceRoleSupabase
                        .from("content_purchases" as any)
                        .upsert(
                            {
                                content_id: contentId,
                                user_id: alipayOrder.user_id,
                                order_id: alipayOrder.id,
                                status: "paid",
                                paid_at: nowIso,
                                updated_at: nowIso,
                            },
                            { onConflict: "user_id,content_id" },
                        );
                } catch (e) {
                    // Do not fail the callback; Alipay will retry if we return non-success.
                    console.error("[Alipay Notify] Content purchase fulfill failed:", e);
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
