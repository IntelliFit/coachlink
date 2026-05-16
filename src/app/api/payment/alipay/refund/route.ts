import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import { createAlipaySdk } from "@/lib/alipaySdk";
import type { ApiData } from "@/types/api";
import type { RefundAlipayOrderDto, RefundAlipayOrderResponseDto } from "./entity";
import { fenToYuan, subtractFen, ensureNonNegativeFen, formatYuanFromFen } from "@/lib/moneyUtils";

function isCoachSubscriptionOrderType(orderType: unknown) {
    return (
        orderType === "subscription" ||
        orderType === "subscription_renew" ||
        orderType === "coach_subscription" ||
        orderType === "coach_subscription_renew"
    );
}

function coachNetAmountFromGross(totalFen: number) {
    const platformFee = Math.floor((totalFen * 20) / 100);
    return totalFen - platformFee;
}

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

    const { data: order, error: orderErr } = await serviceRoleSupabase
        .from("alipay_orders")
        .select("id, status, total_amount, order_type, order_data, user_id, subject")
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

    const isAdmin = Boolean((session.user as { is_admin?: boolean })?.is_admin);
    const orderData = (order.order_data || {}) as Record<string, unknown>;
    const orderCoachId = orderData.coachId as string | undefined;

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

    const refundAmountFen = Math.round(Number(order.total_amount));
    if (!(refundAmountFen > 0)) {
        return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>({
            success: false,
            message: "订单金额异常",
            data: null,
        }, { status: 400 });
    }

    const isCoachSubscriptionOrder = isCoachSubscriptionOrderType(order.order_type);
    let coachWalletRefundFen = refundAmountFen;
    let incomeTx: { id: string; amount: number | null } | null = null;

    if (orderCoachId && isCoachSubscriptionOrder) {
        const incomeTxRes = await serviceRoleSupabase
            .from("wallet_transactions")
            .select("id, amount")
            .eq("wallet_id", orderCoachId)
            .eq("alipay_order_id", orderId)
            .eq("type", "income")
            .maybeSingle();
        incomeTx = incomeTxRes.data as { id: string; amount: number | null } | null;
        coachWalletRefundFen =
            incomeTx?.amount != null
                ? Math.round(Number(incomeTx.amount))
                : coachNetAmountFromGross(refundAmountFen);
    }

    if (orderCoachId) {
        let { data: wallet } = await serviceRoleSupabase
            .from("coach_wallets")
            .select("balance, total_income")
            .eq("coach_id", orderCoachId)
            .maybeSingle();

        if (!wallet) {
            const { data: newWallet } = await serviceRoleSupabase
                .from("coach_wallets")
                .insert({
                    coach_id: orderCoachId,
                    balance: 0,
                    total_income: 0,
                    frozen_amount: 0,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .select("balance, total_income")
                .single();
            wallet = newWallet;
        }

        const currentBalanceFen = Number(wallet?.balance ?? 0);
        if (isAdmin && currentBalanceFen < coachWalletRefundFen) {
            return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>({
                success: false,
                message: `教练钱包余额不足，当前余额：￥${formatYuanFromFen(currentBalanceFen)}，需扣教练实收：￥${formatYuanFromFen(coachWalletRefundFen)}`,
                data: null,
            }, { status: 400 });
        }
    }

    const alipaySdk = createAlipaySdk();
    try {
        const refundAmountYuanStr = fenToYuan(refundAmountFen).toFixed(2);
        const response = await alipaySdk.exec("alipay.trade.refund", {
            bizContent: {
                out_trade_no: orderId,
                refund_amount: refundAmountYuanStr,
                refund_reason: body.refundReason || "用户申请退款",
                out_request_no: `${orderId}_refund`,
            },
        });

        const code = response?.code as string | undefined;
        const msg = (response?.msg as string) || "";
        if (code !== "10000") {
            console.error("[Alipay Refund] refund failed", code, msg, response);
            return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>({
                success: false,
                message: msg || "支付宝退款失败",
                data: null,
            }, { status: 400 });
        }
    } catch (error) {
        console.error("[Alipay Refund] request failed", error);
        return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>({
            success: false,
            message: error instanceof Error ? error.message : "退款请求失败",
            data: null,
        }, { status: 500 });
    }

    const { error: updateOrderErr } = await serviceRoleSupabase
        .from("alipay_orders")
        .update({
            status: "refunded",
            updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .select("id")
        .single();

    if (updateOrderErr) {
        console.error("[Alipay Refund] update order failed", updateOrderErr);
        return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>({
            success: false,
            message: "退款成功但更新订单状态失败，请联系管理员",
            data: null,
        }, { status: 500 });
    }

    if (isCoachSubscriptionOrder) {
        const subscriptionId = orderData.subscriptionId as string | undefined;
        const subscriptionUpdate = {
            status: "cancelled",
            end_date: new Date().toISOString(),
            order_id: null,
            last_payment_order_id: null,
            payment_method: null,
            payment_confirmed_at: null,
            payment_confirmed_by: null,
            cancellation_reason: isAdmin ? "管理员操作退款" : "用户申请退款",
            updated_at: new Date().toISOString(),
        };

        if (subscriptionId) {
            await serviceRoleSupabase
                .from("coach_subscriptions")
                .update(subscriptionUpdate)
                .eq("id", subscriptionId);
        } else {
            await serviceRoleSupabase
                .from("coach_subscriptions")
                .update(subscriptionUpdate)
                .or(`last_payment_order_id.eq.${orderId},order_id.eq.${orderId}`);
        }
    }

    if (orderCoachId) {
        let { data: wallet } = await serviceRoleSupabase
            .from("coach_wallets")
            .select("balance, total_income")
            .eq("coach_id", orderCoachId)
            .maybeSingle();

        if (!wallet) {
            const { data: newWallet } = await serviceRoleSupabase
                .from("coach_wallets")
                .insert({
                    coach_id: orderCoachId,
                    balance: 0,
                    total_income: 0,
                    frozen_amount: 0,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .select("balance, total_income")
                .single();
            wallet = newWallet;
        }

        const currentBalanceFen = Number(wallet?.balance ?? 0);
        const newBalanceFen = ensureNonNegativeFen(subtractFen(currentBalanceFen, coachWalletRefundFen));

        await serviceRoleSupabase
            .from("coach_wallets")
            .update({
                balance: newBalanceFen,
                updated_at: new Date().toISOString(),
            })
            .eq("coach_id", orderCoachId);

        if (!incomeTx) {
            const incomeTxRes = await serviceRoleSupabase
                .from("wallet_transactions")
                .select("id, amount")
                .eq("wallet_id", orderCoachId)
                .eq("alipay_order_id", orderId)
                .eq("type", "income")
                .maybeSingle();
            incomeTx = incomeTxRes.data as { id: string; amount: number | null } | null;
        }

        const { data: existingRefundTx } = await serviceRoleSupabase
            .from("wallet_transactions")
            .select("id")
            .eq("alipay_order_id", orderId)
            .eq("type", "refund")
            .maybeSingle();

        if (!existingRefundTx) {
            const originalDesc =
                (orderData.subject as string) ||
                order.subject ||
                "支付订单";
            const { error: insertRefundErr } = await serviceRoleSupabase.from("wallet_transactions").insert({
                wallet_id: orderCoachId,
                amount: coachWalletRefundFen,
                type: "refund",
                alipay_order_id: orderId,
                related_income_tx_id: incomeTx?.id ?? null,
                description: `已退款：${originalDesc}`,
                created_at: new Date().toISOString(),
            });
            if (insertRefundErr) {
                console.error("[Alipay Refund] insert refund transaction failed", insertRefundErr);
            }
        }

        const { data: updatedIncome, error: updateRefundedErr } = await serviceRoleSupabase
            .from("wallet_transactions")
            .update({ refunded_at: new Date().toISOString() } as Record<string, unknown>)
            .eq("wallet_id", orderCoachId)
            .eq("alipay_order_id", orderId)
            .eq("type", "income")
            .select("id");
        if (updateRefundedErr) {
            console.error("[Alipay Refund] mark income refunded failed", updateRefundedErr);
        } else if (!updatedIncome?.length) {
            console.warn("[Alipay Refund] income transaction not found", orderId, orderCoachId);
        }
    }

    return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>({
        success: true,
        message: "退款成功",
        data: { success: true, message: "退款成功" },
    });
}
