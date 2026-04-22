import { NextRequest, NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import { getApiUserId } from "@/lib/getApiUserId";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { fenToYuan } from "@/lib/moneyUtils";
import { formatHuifuReqDate, queryHuifuMiniProgramOrder } from "@/lib/huifuMiniProgramPay";
import {
    fulfillSubscriptionOnPaid,
    updateTransactionAndWallet,
} from "@/app/api/payment/alipay/fulfillPaidOrder";

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
    return "pending";
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

        if (paymentStatus === "pending") {
            const orderData = (order.order_data || {}) as Record<string, any>;
            const queryResult = await queryHuifuMiniProgramOrder({
                orgReqDate: String(orderData.huifu_req_date || formatHuifuReqDate(new Date(order.created_at))),
                orgReqSeqId: order.id,
            });

            const mappedStatus = mapHuifuTransStatus(queryResult.trans_stat);
            const nextDbStatus =
                mappedStatus === "success"
                    ? "paid"
                    : mappedStatus === "failed"
                      ? "failed"
                      : "pending";

            const { data: updatedOrder, error: updateError } = await (serviceRoleSupabase
                .from("alipay_orders") as any)
                .update({
                    status: nextDbStatus,
                    trade_status: queryResult.trans_stat || null,
                    alipay_trade_no: queryResult.org_hf_seq_id || null,
                    payment_provider: "wechat",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", order.id)
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

            if (
                paymentStatus === "success" &&
                (latestOrder.order_type === "subscription" || latestOrder.order_type === "subscription_renew")
            ) {
                await fulfillSubscriptionOnPaid(latestOrder, latestOrder.id, userId, "wechat");
                await updateTransactionAndWallet(latestOrder);
            }
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
