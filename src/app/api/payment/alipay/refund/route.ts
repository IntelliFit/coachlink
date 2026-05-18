import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import { createAlipaySdk } from "@/lib/alipaySdk";
import type { ApiData } from "@/types/api";
import type { RefundAlipayOrderDto, RefundAlipayOrderResponseDto } from "./entity";
import {
    ensureNonNegativeFen,
    fenToYuan,
    formatYuan,
    formatYuanFromFen,
    subtractFen,
} from "@/lib/moneyUtils";
import {
    formatHuifuReqDate,
    generateReqSeqId,
    refundBalancePayment,
    refundHuifuPaymentOrder,
} from "@/lib/huifuMiniProgramPay";
import { markSettlementRefunded } from "@/app/api/payment/alipay/fulfillPaidOrder";

function asObject(value: unknown): Record<string, any> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, any>)
        : {};
}

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

function isAcceptedHuifuResult(result: Record<string, any>) {
    if (!result) return false;
    if (result.trans_stat === "F") return false;
    return result.resp_code === "00000000" || result.resp_code === "00000100";
}

function isHuifuOrder(order: Record<string, any>, orderData: Record<string, any>) {
    const provider = String(order.payment_provider || "").trim();
    return provider === "wechat" || provider === "huifu_alipay" || Boolean(orderData.huifu_req_date);
}

function getOrderHuifuReqDate(order: Record<string, any>, orderData: Record<string, any>) {
    const saved = String(orderData.huifu_req_date || "").trim();
    if (saved) return saved;
    return formatHuifuReqDate(new Date(order.created_at || order.updated_at || Date.now()));
}

async function fetchSettlement(orderId: string) {
    const { data, error } = await (serviceRoleSupabase as any)
        .from("coach_subscription_settlements")
        .select("*")
        .eq("alipay_order_id", orderId)
        .maybeSingle();
    if (error) throw error;
    return data as Record<string, any> | null;
}

async function refundTransferredCoachShare(params: {
    orderId: string;
    settlement: Record<string, any>;
}) {
    const settlement = params.settlement;
    if (String(settlement.status || "") === "processing") {
        throw new Error("教练分账仍在处理中，请先完成汇付分账对账后再退款");
    }
    if (!["split_success", "wallet_credited"].includes(String(settlement.status || ""))) {
        return null;
    }

    const existingStatus = String(settlement.balance_refund_status || "");
    if (existingStatus === "accepted" || existingStatus === "success") {
        return settlement;
    }

    if (!settlement.req_date || !settlement.req_seq_id) {
        throw new Error("缺少原余额支付流水，无法冲回教练分账");
    }

    const reqDate = String(settlement.balance_refund_req_date || formatHuifuReqDate());
    const reqSeqId = String(settlement.balance_refund_req_seq_id || generateReqSeqId());
    const coachAmountFen = Math.round(Number(settlement.coach_amount || 0));
    if (coachAmountFen <= 0) {
        throw new Error("教练分账金额异常，无法退款");
    }

    await (serviceRoleSupabase as any)
        .from("coach_subscription_settlements")
        .update({
            balance_refund_req_date: reqDate,
            balance_refund_req_seq_id: reqSeqId,
            balance_refund_status: "processing",
            balance_refund_error_message: null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", settlement.id);

    const result = await refundBalancePayment({
        reqDate,
        reqSeqId,
        orgReqDate: String(settlement.req_date),
        orgReqSeqId: String(settlement.req_seq_id),
        orgHfSeqId: settlement.huifu_hf_seq_id ? String(settlement.huifu_hf_seq_id) : undefined,
        refundAmtYuan: formatYuan(fenToYuan(coachAmountFen)),
    });

    if (!isAcceptedHuifuResult(result as any)) {
        const message = result.resp_desc || "汇付余额支付退款失败";
        await (serviceRoleSupabase as any)
            .from("coach_subscription_settlements")
            .update({
                balance_refund_status: "failed",
                balance_refund_error_message: message,
                updated_at: new Date().toISOString(),
            })
            .eq("id", settlement.id);
        throw new Error(message);
    }

    await (serviceRoleSupabase as any)
        .from("coach_subscription_settlements")
        .update({
            balance_refund_huifu_hf_seq_id: result.hf_seq_id || null,
            balance_refund_status: result.trans_stat === "S" ? "success" : "accepted",
            balance_refund_error_message: null,
            balance_refund_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", settlement.id);

    return result;
}

async function refundHuifuCollection(params: {
    order: Record<string, any>;
    orderData: Record<string, any>;
    refundReason?: string;
}) {
    const order = params.order;
    const orderData = params.orderData;
    const refundMeta = asObject(orderData.huifu_refund);
    const reqDate = String(refundMeta.req_date || formatHuifuReqDate());
    const reqSeqId = String(refundMeta.req_seq_id || generateReqSeqId());
    const refundAmountFen = Math.round(Number(order.total_amount || 0));

    const result = await refundHuifuPaymentOrder({
        reqDate,
        reqSeqId,
        orgReqDate: getOrderHuifuReqDate(order, orderData),
        orgReqSeqId: String(order.id),
        refundAmtYuan: formatYuan(fenToYuan(refundAmountFen)),
        remark: params.refundReason || "user refund",
    });

    if (!isAcceptedHuifuResult(result as any)) {
        throw new Error(result.resp_desc || "汇付原路退款失败");
    }

    const nextOrderData = {
        ...orderData,
        huifu_refund: {
            req_date: reqDate,
            req_seq_id: reqSeqId,
            hf_seq_id: result.hf_seq_id || null,
            status: result.trans_stat === "S" ? "success" : "accepted",
            resp_code: result.resp_code,
            resp_desc: result.resp_desc,
        },
    };

    await serviceRoleSupabase
        .from("alipay_orders")
        .update({ order_data: nextOrderData as any })
        .eq("id", order.id);

    return result;
}

async function refundAlipayCollection(orderId: string, refundAmountFen: number, refundReason?: string) {
    const alipaySdk = createAlipaySdk();
    const response = await alipaySdk.exec("alipay.trade.refund", {
        bizContent: {
            out_trade_no: orderId,
            refund_amount: fenToYuan(refundAmountFen).toFixed(2),
            refund_reason: refundReason || "用户申请退款",
            out_request_no: `${orderId}_refund`,
        },
    });

    const code = response?.code as string | undefined;
    const msg = (response?.msg as string) || "";
    if (code !== "10000") {
        console.error("[Payment Refund] Alipay refund failed", code, msg, response);
        throw new Error(msg || "支付宝退款失败");
    }
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
    const orderId = String(body?.orderId || "").trim();
    if (!orderId) {
        return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>(
            { success: false, message: "缺少订单ID", data: null },
            { status: 400 },
        );
    }

    const { data: order, error: orderErr } = await (serviceRoleSupabase as any)
        .from("alipay_orders")
        .select("id, status, total_amount, order_type, order_data, user_id, subject, payment_provider, created_at, updated_at")
        .eq("id", orderId)
        .single();

    if (orderErr || !order) {
        return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>(
            { success: false, message: "订单不存在", data: null },
            { status: 404 },
        );
    }

    if (order.status !== "paid") {
        return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>(
            {
                success: false,
                message: order.status === "refunded" ? "该订单已退款" : "仅支持对已支付订单退款",
                data: null,
            },
            { status: 400 },
        );
    }

    const isAdmin = Boolean((session.user as { is_admin?: boolean })?.is_admin);
    const orderData = asObject(order.order_data);
    const orderCoachId = String(orderData.coachId || "").trim();

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
        return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>(
            { success: false, message: "订单金额异常", data: null },
            { status: 400 },
        );
    }

    const isCoachSubscriptionOrder = isCoachSubscriptionOrderType(order.order_type);
    const huifuOrder = isHuifuOrder(order, orderData);
    let settlement: Record<string, any> | null = null;
    let incomeTx: { id: string; amount: number | null } | null = null;
    let coachWalletRefundFen = orderCoachId ? refundAmountFen : 0;

    if (orderCoachId && isCoachSubscriptionOrder) {
        settlement = await fetchSettlement(orderId);
        const incomeTxRes = await serviceRoleSupabase
            .from("wallet_transactions")
            .select("id, amount")
            .eq("wallet_id", orderCoachId)
            .eq("alipay_order_id", orderId)
            .eq("type", "income")
            .maybeSingle();
        incomeTx = incomeTxRes.data as { id: string; amount: number | null } | null;
        if (incomeTx?.amount != null) {
            coachWalletRefundFen = Math.round(Number(incomeTx.amount));
        } else {
            coachWalletRefundFen = huifuOrder ? 0 : coachNetAmountFromGross(refundAmountFen);
        }
    }

    if (orderCoachId && coachWalletRefundFen > 0) {
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
            return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>(
                {
                    success: false,
                    message: `教练钱包余额不足，当前余额：${formatYuanFromFen(currentBalanceFen)}，需扣教练实收：${formatYuanFromFen(coachWalletRefundFen)}`,
                    data: null,
                },
                { status: 400 },
            );
        }
    }

    try {
        if (huifuOrder) {
            if (isCoachSubscriptionOrder && settlement) {
                await refundTransferredCoachShare({ orderId, settlement });
            }
            await refundHuifuCollection({
                order,
                orderData,
                refundReason: body.refundReason || "用户申请退款",
            });
        } else {
            await refundAlipayCollection(orderId, refundAmountFen, body.refundReason);
        }
    } catch (error: any) {
        console.error("[Payment Refund] request failed", error);
        return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>(
            { success: false, message: error?.message || "退款请求失败", data: null },
            { status: 500 },
        );
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
        console.error("[Payment Refund] update order failed", updateOrderErr);
        return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>(
            { success: false, message: "退款成功但更新订单状态失败，请联系管理员", data: null },
            { status: 500 },
        );
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

    if (orderCoachId && coachWalletRefundFen > 0) {
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

        const { data: existingRefundTx } = await serviceRoleSupabase
            .from("wallet_transactions")
            .select("id")
            .eq("alipay_order_id", orderId)
            .eq("type", "refund")
            .maybeSingle();

        if (!existingRefundTx) {
            const originalDesc = (orderData.subject as string) || order.subject || "支付订单";
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
                console.error("[Payment Refund] insert refund transaction failed", insertRefundErr);
            }
        }

        const { error: updateRefundedErr } = await serviceRoleSupabase
            .from("wallet_transactions")
            .update({ refunded_at: new Date().toISOString() } as Record<string, unknown>)
            .eq("wallet_id", orderCoachId)
            .eq("alipay_order_id", orderId)
            .eq("type", "income")
            .select("id");
        if (updateRefundedErr) {
            console.error("[Payment Refund] mark income refunded failed", updateRefundedErr);
        }
    }

    if (isCoachSubscriptionOrder && orderCoachId) {
        await (serviceRoleSupabase as any)
            .from("platform_revenue")
            .delete()
            .eq("source_order_id", orderId);

        await markSettlementRefunded(orderId, {
            refund_status: huifuOrder ? "accepted" : "local",
            refund_completed_at: new Date().toISOString(),
        });
    }

    return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>({
        success: true,
        message: "退款成功",
        data: { success: true, message: "退款成功" },
    });
}
