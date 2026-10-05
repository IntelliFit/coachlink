import { NextRequest, NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import { getApiUserId } from "@/lib/getApiUserId";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { fenToYuan } from "@/lib/moneyUtils";
import { formatHuifuReqDate } from "@/lib/huifuMiniProgramPay";
import { assertHuifuWebPaymentAmount, isHuifuWebPayment, queryHuifuPaymentOrder } from "@/lib/huifuWebPayment";
import {
    fulfillSubscriptionOnPaid,
    updateTransactionAndWallet,
    executeBalancePayment,
    markSettlementWalletCredited,
} from "@/app/api/payment/alipay/fulfillPaidOrder";
import { fulfillStudentMembershipOrderOnPaid } from "@/app/api/payment/studentMembershipFulfillment";
import { fulfillContentPurchasePaid } from "@/app/api/payment/alipay/contentPurchaseFulfillment";
import { queryWechatXPayOrder } from "@/lib/wechatXPay";
import {
    fulfillPaidXPayOrder,
    markXPayOrderPaid,
    markXPayOrderRefunded,
    validateXPayOrderMatch,
} from "@/app/api/payment/wechat/xpayOrder";

export const runtime = "nodejs";

type PaymentStatus = "pending" | "success" | "failed" | "cancelled";

interface QueryWechatPaymentResponse {
    status: PaymentStatus;
    amount: number;
    order: {
        id: string;
        total_amount: number;
        status: string;
    };
}

function mapHuifuTransStatus(value: string | null | undefined): PaymentStatus {
    if (value === "S") return "success";
    if (value === "F") return "failed";
    if (value === "C") return "cancelled";
    return "pending";
}

async function fulfillPaidWechatOrder(latestOrder: any, userId: string) {
    const isSubscriptionOrder =
        latestOrder.order_type === "subscription" ||
        latestOrder.order_type === "subscription_renew" ||
        latestOrder.order_type === "coach_subscription" ||
        latestOrder.order_type === "coach_subscription_renew";

    if (isSubscriptionOrder) {
        await fulfillSubscriptionOnPaid(latestOrder, latestOrder.id, userId, "wechat");

        const isCoachSub =
            latestOrder.order_type === "coach_subscription" ||
            latestOrder.order_type === "coach_subscription_renew";
        if (isCoachSub) {
            const splitResult = await executeBalancePayment(latestOrder);
            if (splitResult.shouldCreditWallet) {
                const walletUpdated = await updateTransactionAndWallet(latestOrder, splitResult.splitInfo);
                if (walletUpdated) {
                    await markSettlementWalletCredited(latestOrder.id);
                }
            }
        } else {
            await updateTransactionAndWallet(latestOrder);
        }
    }

    if (latestOrder.order_type === "student_membership") {
        const orderData = (latestOrder.order_data || {}) as Record<string, any>;
        await fulfillStudentMembershipOrderOnPaid({
            relatedOrderId: String(orderData.related_order_id || ""),
            productKey: String(orderData.product_key || ""),
            userId,
        });
    }

    if (latestOrder.order_type === "content_purchase") {
        const orderData = (latestOrder.order_data || {}) as Record<string, any>;
        const contentId = String(orderData.contentId || orderData.content_id || "");
        if (contentId) {
            await fulfillContentPurchasePaid({
                orderId: latestOrder.id,
                userId,
                contentId,
            });
        }
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = await getApiUserId(request);
        if (!userId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "请先登录", data: null },
                { status: 401 },
            );
        }

        const body = (await request.json()) as { orderId?: string; paymentId?: string };
        const orderId = String(body.orderId || body.paymentId || "").trim();
        if (!orderId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "订单ID不能为空", data: null },
                { status: 400 },
            );
        }

        const { data: order, error: orderError } = await serviceRoleSupabase
            .from("alipay_orders")
            .select("*")
            .eq("id", orderId)
            .single();

        if (orderError || !order) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "订单不存在", data: null },
                { status: 404 },
            );
        }

        if (order.user_id !== userId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "无权查看此订单", data: null },
                { status: 403 },
            );
        }

        let latestOrder = order;
        let paymentStatus: PaymentStatus =
            order.status === "paid"
                ? "success"
                : order.status === "closed"
                  ? "cancelled"
                  : order.status === "failed" || order.status === "refunded"
                    ? "failed"
                    : "pending";

        if (String(order.payment_provider || "") === "wechat_xpay") {
            const orderData = (order.order_data || {}) as Record<string, any>;
            if (paymentStatus === "pending") {
                const xpayOrder = await queryWechatXPayOrder({
                    openId: String(orderData.xpay_openid || ""),
                    outTradeNo: String(orderData.xpay_out_trade_no || ""),
                });
                const xpayStatus = Number(xpayOrder?.status ?? 0);
                if ([2, 3, 4].includes(xpayStatus)) {
                    validateXPayOrderMatch(order as any, {
                        outTradeNo: String(orderData.xpay_out_trade_no || ""),
                        openId: String(orderData.xpay_openid || ""),
                        env: Number(orderData.xpay_env),
                        actualPrice: Math.round(Number(xpayOrder?.paid_fee || 0)),
                    });
                    latestOrder = await markXPayOrderPaid(order as any, {
                        paidAt: Number(xpayOrder?.paid_time) > 0
                            ? new Date(Number(xpayOrder?.paid_time) * 1000)
                            : new Date(),
                        transactionId: String(xpayOrder?.wxpay_order_id || xpayOrder?.wx_order_id || ""),
                    });
                    paymentStatus = "success";
                } else if ([5, 8].includes(xpayStatus)) {
                    const refundResult = await markXPayOrderRefunded(order as any, {
                        refundFee: Math.round(Number(xpayOrder?.refund_fee || order.total_amount || 0)),
                        transactionId: String(xpayOrder?.wxpay_order_id || ""),
                    });
                    paymentStatus = refundResult.fullyRefunded ? "failed" : "success";
                    latestOrder = {
                        ...order,
                        status: refundResult.fullyRefunded ? "refunded" : "paid",
                    };
                } else if (xpayStatus === 6) {
                    await (serviceRoleSupabase.from("alipay_orders") as any)
                        .update({ status: "closed", trade_status: "XPAY_CLOSED", updated_at: new Date().toISOString() })
                        .eq("id", order.id)
                        .eq("status", "pending");
                    paymentStatus = "cancelled";
                    latestOrder = { ...order, status: "closed" };
                } else if (xpayStatus === 7) {
                    paymentStatus = "failed";
                }
            } else if (paymentStatus === "success") {
                await fulfillPaidXPayOrder(order as any);
            }

            return NextResponse.json<ApiData<QueryWechatPaymentResponse>>({
                success: true,
                message: "虚拟支付状态",
                data: {
                    status: paymentStatus,
                    amount: fenToYuan(latestOrder.total_amount ?? 0),
                    order: {
                        id: latestOrder.id,
                        total_amount: fenToYuan(latestOrder.total_amount ?? 0),
                        status: latestOrder.status,
                    },
                },
            });
        }

        if (paymentStatus === "pending") {
            const orderData = (order.order_data || {}) as Record<string, any>;
            const queryResult = await queryHuifuPaymentOrder(order, {
                orgReqDate: String(orderData.huifu_req_date || formatHuifuReqDate(new Date(order.created_at))),
                orgReqSeqId: order.id,
            });

            const mappedStatus = mapHuifuTransStatus(queryResult.trans_stat);
            assertHuifuWebPaymentAmount(order, queryResult);
            const nextDbStatus =
                mappedStatus === "success"
                    ? "paid"
                    : mappedStatus === "failed"
                      ? "failed"
                      : mappedStatus === "cancelled"
                        ? "closed"
                      : "pending";

            let updateQuery = (serviceRoleSupabase
                .from("alipay_orders") as any)
                .update({
                    status: nextDbStatus,
                    trade_status: queryResult.trans_stat || null,
                    alipay_trade_no: queryResult.org_hf_seq_id || null,
                    payment_provider: "wechat",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", order.id);
            if (isHuifuWebPayment(order) && nextDbStatus !== "paid") {
                updateQuery = updateQuery.neq("status", "paid");
            }
            const { data: updatedOrder, error: updateError } = await updateQuery
                .select()
                .single();

            if (updateError) {
                return NextResponse.json<ApiData<null>>(
                    { success: false, message: updateError.message, data: null },
                    { status: 500 },
                );
            }

            latestOrder = updatedOrder || latestOrder;
            paymentStatus = mappedStatus;

            if (paymentStatus === "success") {
                await fulfillPaidWechatOrder(latestOrder, userId);
            }
        } else if (paymentStatus === "success") {
            await fulfillPaidWechatOrder(latestOrder, userId);
        }

        return NextResponse.json<ApiData<QueryWechatPaymentResponse>>({
            success: true,
            message: "支付状态",
            data: {
                status: paymentStatus,
                amount: fenToYuan(latestOrder.total_amount ?? 0),
                order: {
                    id: latestOrder.id,
                    total_amount: fenToYuan(latestOrder.total_amount ?? 0),
                    status: latestOrder.status,
                },
            },
        });
    } catch (error: any) {
        console.error("[Huifu Wechat Query] error:", error);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: error?.message || "查询支付状态失败", data: null },
            { status: 500 },
        );
    }
}
