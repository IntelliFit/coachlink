/**
 * 支付宝统一收单交易退款接口
 * 文档：https://opendocs.alipay.com/open/02ekfl（alipay.trade.refund）
 * 退款是独立接口，不需要转账能力；按原支付订单 out_trade_no 退款。
 */
import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import { createAlipaySdk } from "@/lib/alipaySdk";
import type { ApiData } from "@/types/api";
import type { RefundAlipayOrderDto, RefundAlipayOrderResponseDto } from "./entity";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json(
            { success: false, message: "用户未登录", data: null },
            { status: 401 },
        );
    }

    const body = (await req.json()) as RefundAlipayOrderDto;
    const orderId = (body?.orderId ?? "").trim();
    if (!orderId) {
        return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>({
            success: false,
            message: "缺少订单ID",
            data: null,
        }, { status: 400 });
    }

    // 1. 查询订单
    const { data: order, error: orderErr } = await serviceRoleSupabase
        .from("alipay_orders")
        .select("id, status, total_amount, order_type, order_data, user_id")
        .eq("id", orderId)
        .single();

    if (orderErr || !order) {
        return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>({
            success: false,
            message: "订单不存在",
            data: null,
        }, { status: 404 });
    }

    if (order.status !== "paid") {
        return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>({
            success: false,
            message: order.status === "refunded" ? "该订单已退款" : "仅支持对已支付订单退款",
            data: null,
        }, { status: 400 });
    }

    // 2. 权限：教练（须为该订单关联的教练）或管理员
    const isAdmin = !!(session.user as { is_admin?: boolean })?.is_admin;
    const orderData = (order.order_data || {}) as Record<string, unknown>;
    const orderCoachId = orderData?.coachId as string | undefined;

    if (!isAdmin) {
        const { data: coachRow } = await supabase
            .from("coaches")
            .select("id")
            .eq("user_id", session.user.id)
            .single();
        if (!coachRow || orderCoachId !== coachRow.id) {
            return NextResponse.json(
                { success: false, message: "无权对该订单退款", data: null },
                { status: 403 },
            );
        }
    }

    // 3. 调用支付宝退款
    const alipaySdk = createAlipaySdk();
    const refundAmount = Number(order.total_amount);
    if (!(refundAmount > 0)) {
        return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>({
            success: false,
            message: "订单金额异常",
            data: null,
        }, { status: 400 });
    }

    try {
        const response = await alipaySdk.exec("alipay.trade.refund", {
            bizContent: {
                out_trade_no: orderId,
                refund_amount: refundAmount.toFixed(2),
                refund_reason: body.refundReason || "用户申请退款",
                out_request_no: `${orderId}_refund`,
            },
        });

        const code = response?.code as string | undefined;
        const msg = (response?.msg as string) || "";
        if (code !== "10000") {
            console.error("[Alipay Refund] 支付宝返回失败:", code, msg, response);
            return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>({
                success: false,
                message: msg || "支付宝退款失败",
                data: null,
            }, { status: 400 });
        }
    } catch (err) {
        console.error("[Alipay Refund] 调用支付宝异常:", err);
        return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>({
            success: false,
            message: err instanceof Error ? err.message : "退款请求失败",
            data: null,
        }, { status: 500 });
    }

    // 4. 更新订单状态
    await serviceRoleSupabase
        .from("alipay_orders")
        .update({
            status: "refunded",
            updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

    // 5. 取消关联订阅（platform 支付的订阅/续费）
    if (
        order.order_type === "subscription" || order.order_type === "subscription_renew"
    ) {
        const subscriptionId = orderData?.subscriptionId as string | undefined;
        if (subscriptionId) {
            await serviceRoleSupabase
                .from("coach_subscriptions")
                .update({
                    status: "cancelled",
                    order_id: null,
                    last_payment_order_id: null,
                    payment_method: null,
                    payment_confirmed_at: null,
                    payment_confirmed_by: null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", subscriptionId);
        } else {
            await serviceRoleSupabase
                .from("coach_subscriptions")
                .update({
                    status: "cancelled",
                    order_id: null,
                    last_payment_order_id: null,
                    payment_method: null,
                    payment_confirmed_at: null,
                    payment_confirmed_by: null,
                    updated_at: new Date().toISOString(),
                })
                .or(`last_payment_order_id.eq.${orderId},order_id.eq.${orderId}`);
        }
    }

    // 6. 教练钱包冲正：扣减余额并记一笔退款流水
    if (orderCoachId) {
        const { data: incomeTx } = await serviceRoleSupabase
            .from("wallet_transactions")
            .select("id, amount, wallet_id")
            .eq("related_order_id", orderId)
            .eq("type", "income")
            .maybeSingle();

        if (incomeTx) {
            const { data: wallet } = await serviceRoleSupabase
                .from("coach_wallets")
                .select("balance, total_income")
                .eq("coach_id", orderCoachId)
                .single();

            if (wallet) {
                const balance = Number(wallet.balance ?? 0);
                const deduct = refundAmount;
                const newBalance = Math.max(0, balance - deduct);
                await serviceRoleSupabase
                    .from("coach_wallets")
                    .update({
                        balance: newBalance,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("coach_id", orderCoachId);

                await serviceRoleSupabase.from("wallet_transactions").insert({
                    wallet_id: orderCoachId,
                    amount: deduct,
                    type: "refund",
                    related_order_id: orderId,
                    description: `退款：${(orderData?.subject as string) || "支付宝订单"}`,
                    created_at: new Date().toISOString(),
                });
            }
        }
    }

    return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>({
        success: true,
        message: "退款成功",
        data: { success: true, message: "退款成功" },
    });
}
