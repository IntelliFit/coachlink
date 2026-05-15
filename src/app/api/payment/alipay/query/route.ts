import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import { createAlipaySdk } from "@/lib/alipaySdk";
import {
    fulfillPaidSubscriptionOrder,
    isHuifuBackedPaymentOrder,
    isSubscriptionOrderType,
} from "@/app/api/payment/alipay/fulfillPaidOrder";
import type { ApiData } from "@/types/api";
import type { QueryAlipayOrderDto, QueryAlipayOrderResponseDto, TradeStatus } from "./entity";
import { fenToYuan, yuanToFen } from "@/lib/moneyUtils";
import { fulfillContentPurchasePaid } from "../contentPurchaseFulfillment";
import { formatHuifuReqDate, queryHuifuMiniProgramOrder } from "@/lib/huifuMiniProgramPay";

type LocalOrderStatus = "pending" | "paid" | "closed";

function mapGatewayStatus(tradeStatus: string | null): LocalOrderStatus {
    if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") return "paid";
    if (tradeStatus === "TRADE_CLOSED") return "closed";
    return "pending";
}

function mapHuifuStatus(transStat: string | null | undefined): {
    orderStatus: LocalOrderStatus;
    responseTradeStatus: TradeStatus;
} {
    if (transStat === "S") {
        return { orderStatus: "paid", responseTradeStatus: "TRADE_SUCCESS" };
    }
    if (transStat === "F") {
        return { orderStatus: "closed", responseTradeStatus: "TRADE_CLOSED" };
    }
    return { orderStatus: "pending", responseTradeStatus: "WAIT_BUYER_PAY" };
}

async function queryAlipayTradeStatus(orderId: string): Promise<{
    traceNo: string | null;
    rawTradeStatus: string | null;
    responseTradeStatus: TradeStatus;
    orderStatus: LocalOrderStatus;
    gatewayAmountFen: number | null;
}> {
    const alipaySdk = createAlipaySdk();
    const response = await alipaySdk.exec("alipay.trade.query", {
        bizContent: { out_trade_no: orderId },
    });

    if (response?.code !== "10000") {
        console.error(`[Alipay Query] alipay.trade.query failed: ${JSON.stringify(response)}`);
        throw new Error(`[Alipay Query] alipay.trade.query failed: ${response?.msg}`);
    }

    const traceNo = (response?.traceId as string | null) || (response?.tradeNo as string | null) || null;
    const rawTradeStatus = (response?.tradeStatus as string | null) || null;
    const responseAmount =
        response?.totalAmount ??
        response?.total_amount ??
        response?.buyerPayAmount ??
        response?.buyer_pay_amount;
    return {
        traceNo,
        rawTradeStatus,
        responseTradeStatus: (rawTradeStatus as TradeStatus) || "WAIT_BUYER_PAY",
        orderStatus: mapGatewayStatus(rawTradeStatus),
        gatewayAmountFen: responseAmount ? yuanToFen(String(responseAmount)) : null,
    };
}

async function queryHuifuTradeStatus(order: Record<string, any>): Promise<{
    traceNo: string | null;
    rawTradeStatus: string | null;
    responseTradeStatus: TradeStatus;
    orderStatus: LocalOrderStatus;
    gatewayAmountFen: number | null;
}> {
    const orderData = (order.order_data || {}) as Record<string, any>;
    const queryResult = await queryHuifuMiniProgramOrder({
        orgReqDate: String(orderData.huifu_req_date || formatHuifuReqDate(new Date(order.created_at))),
        orgReqSeqId: order.id,
    });
    const mapped = mapHuifuStatus(queryResult.trans_stat);
    return {
        traceNo: queryResult.org_hf_seq_id || null,
        rawTradeStatus: queryResult.trans_stat || null,
        responseTradeStatus: mapped.responseTradeStatus,
        orderStatus: mapped.orderStatus,
        gatewayAmountFen: queryResult.trans_amt || queryResult.pay_amt
            ? yuanToFen(String(queryResult.trans_amt || queryResult.pay_amt))
            : null,
    };
}

function paidGatewayAmountMatches(order: Record<string, any>, gatewayAmountFen: number | null) {
    const localAmountFen = Math.round(Number(order.total_amount ?? 0));
    return Boolean(gatewayAmountFen && gatewayAmountFen === localAmountFen);
}

async function fulfillPaidOrder(order: Record<string, any>, userId: string) {
    if (isSubscriptionOrderType(order.order_type)) {
        await fulfillPaidSubscriptionOrder(
            order,
            userId,
            String(order.payment_provider || "").trim() === "wechat" ? "wechat" : "alipay",
        );
        return;
    }

    if (order.order_type === "content_purchase") {
        const orderData = (order.order_data || {}) as Record<string, any>;
        const contentId = orderData?.contentId as string | undefined;
        if (contentId) {
            await fulfillContentPurchasePaid({
                orderId: order.id,
                userId,
                contentId,
            });
        }
    }
}

function toOrderWithYuan(order: Record<string, any> | null) {
    return order
        ? {
            ...order,
            total_amount: fenToYuan(order.total_amount ?? 0),
        }
        : order;
}

export async function POST(req: Request) {
    const session = await getServerSession();
    const userId = session?.user?.id || "";

    const body = await req.json() as (QueryAlipayOrderDto & { paymentId?: string });
    const orderId = body.orderId || body.paymentId;
    if (!orderId) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "订单ID不能为空",
            data: null,
        }, { status: 400 });
    }

    const dbClient = userId ? supabase : serviceRoleSupabase;
    const { data: existOrder, error: existOrderError } = await dbClient
        .from("alipay_orders")
        .select("*")
        .eq("id", orderId)
        .single();

    if (existOrderError || !existOrder) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "订单不存在",
            data: null,
        }, { status: 404 });
    }

    if (!userId && existOrder?.order_type !== "guest_content_purchase") {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    if (existOrder.status === "paid") {
        if (userId) {
            await fulfillPaidOrder(existOrder as Record<string, any>, userId);
        }
        return NextResponse.json<ApiData<QueryAlipayOrderResponseDto>>({
            success: true,
            message: "订单已支付",
            data: {
                order: toOrderWithYuan(existOrder as Record<string, any>) as any,
                tradeStatus: "TRADE_SUCCESS",
            },
        });
    }

    let queryResult: {
        traceNo: string | null;
        rawTradeStatus: string | null;
        responseTradeStatus: TradeStatus;
        orderStatus: LocalOrderStatus;
        gatewayAmountFen: number | null;
    };

    try {
        queryResult = isHuifuBackedPaymentOrder(existOrder as Record<string, any>)
            ? await queryHuifuTradeStatus(existOrder as Record<string, any>)
            : await queryAlipayTradeStatus(orderId);
    } catch (error) {
        console.error("[Alipay Query] gateway query failed, returning local order status", error);
        return NextResponse.json<ApiData<QueryAlipayOrderResponseDto>>({
            success: true,
            message: "支付网关暂不可用，显示本地订单状态",
            data: {
                order: toOrderWithYuan(existOrder as Record<string, any>) as any,
                tradeStatus: ((existOrder.trade_status as TradeStatus) || "WAIT_BUYER_PAY"),
            },
        });
    }

    if (
        queryResult.orderStatus === "paid" &&
        !paidGatewayAmountMatches(existOrder as Record<string, any>, queryResult.gatewayAmountFen)
    ) {
        console.error("[Alipay Query] amount mismatch:", {
            orderId,
            localAmountFen: Math.round(Number((existOrder as any).total_amount ?? 0)),
            gatewayAmountFen: queryResult.gatewayAmountFen,
        });
        return NextResponse.json<ApiData<QueryAlipayOrderResponseDto>>(
            {
                success: false,
                message: "支付网关返回金额与本地订单金额不一致，已拒绝确认支付",
                data: {
                    order: toOrderWithYuan(existOrder as Record<string, any>) as any,
                    tradeStatus: "WAIT_BUYER_PAY",
                },
            },
            { status: 409 },
        );
    }

    const { data: order, error: orderError } = await (dbClient
        .from("alipay_orders") as any)
        .update({
            status: queryResult.orderStatus,
            trade_status: queryResult.rawTradeStatus,
            alipay_trade_no: queryResult.traceNo,
            updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .select()
        .single();

    if (orderError) {
        return NextResponse.json({
            success: false,
            message: orderError.message,
        });
    }

    if (queryResult.orderStatus === "paid" && order && userId) {
        try {
            await fulfillPaidOrder(order as Record<string, any>, userId);
        } catch (e) {
            console.error("[Alipay Query] paid order fulfillment failed:", e);
        }
    }

    return NextResponse.json<ApiData<QueryAlipayOrderResponseDto>>({
        success: true,
        message: "支付状态",
        data: {
            order: toOrderWithYuan(order as Record<string, any>) as any,
            tradeStatus: queryResult.responseTradeStatus,
        },
    });
}
