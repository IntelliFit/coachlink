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
import { fenToYuan, subtractFen, ensureNonNegativeFen, formatYuanFromFen } from "@/lib/moneyUtils";

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

    // alipay_orders.total_amount 在 DB 中已存为分（整数）
    const refundAmountFen = Math.round(Number(order.total_amount));
    if (!(refundAmountFen > 0)) {
        return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>({
            success: false,
            message: "订单金额异常",
            data: null,
        }, { status: 400 });
    }

    // 3. 检查教练钱包余额（如果有教练ID）
    if (orderCoachId) {
        // 查询或创建钱包
        let { data: wallet } = await serviceRoleSupabase
            .from("coach_wallets")
            .select("balance, total_income")
            .eq("coach_id", orderCoachId)
            .maybeSingle();

        // 如果钱包不存在，创建一个（余额为0）
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

        if (wallet) {
            // 钱包余额在 DB 中已存为分（整数）
            const currentBalanceFen = Number(wallet.balance ?? 0);
            // 检查余额是否足够（管理员退款时）
            if (isAdmin && currentBalanceFen < refundAmountFen) {
                return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>({
                    success: false,
                    message: `教练钱包余额不足，当前余额：¥${formatYuanFromFen(currentBalanceFen)}，退款金额：¥${formatYuanFromFen(refundAmountFen)}`,
                    data: null,
                }, { status: 400 });
            }
        }
    }

    // 4. 调用支付宝退款
    const alipaySdk = createAlipaySdk();

    try {
        // 支付宝接口需要元（字符串，保留两位小数）
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

    // 5. 更新订单状态（管理员/教练账单列表均依赖此状态显示「已退款」）
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
        console.error("[Alipay Refund] 更新订单状态失败:", updateOrderErr);
        return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>({
            success: false,
            message: "退款成功但更新订单状态失败，请联系管理员",
            data: null,
        }, { status: 500 });
    }

    // 6. 取消关联订阅（platform 支付的订阅/续费）
    if (
        order.order_type === "subscription" || order.order_type === "subscription_renew"
    ) {
        const subscriptionId = orderData?.subscriptionId as string | undefined;
        if (subscriptionId) {
            await serviceRoleSupabase
                .from("coach_subscriptions")
                .update({
                    status: "cancelled",
                    end_date: new Date().toISOString(), // 立即结束订阅
                    order_id: null,
                    last_payment_order_id: null,
                    payment_method: null,
                    payment_confirmed_at: null,
                    payment_confirmed_by: null,
                    cancellation_reason: isAdmin ? "管理员操作退款" : "用户申请退款",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", subscriptionId);
        } else {
            // 如果没有subscriptionId，通过订单ID查找订阅
            await serviceRoleSupabase
                .from("coach_subscriptions")
                .update({
                    status: "cancelled",
                    end_date: new Date().toISOString(), // 立即结束订阅
                    order_id: null,
                    last_payment_order_id: null,
                    payment_method: null,
                    payment_confirmed_at: null,
                    payment_confirmed_by: null,
                    cancellation_reason: isAdmin ? "管理员操作退款" : "用户申请退款",
                    updated_at: new Date().toISOString(),
                })
                .or(`last_payment_order_id.eq.${orderId},order_id.eq.${orderId}`);
        }
    }

    // 7. 教练钱包冲正：扣减余额并记一笔退款流水
    if (orderCoachId) {
        // 查询或创建钱包
        let { data: wallet } = await serviceRoleSupabase
            .from("coach_wallets")
            .select("balance, total_income")
            .eq("coach_id", orderCoachId)
            .maybeSingle();

        // 如果钱包不存在，创建一个（余额为0）
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

        if (wallet) {
            // 钱包余额在 DB 中已存为分（整数）
            const currentBalanceFen = Number(wallet.balance ?? 0);
            const newBalanceFen = ensureNonNegativeFen(subtractFen(currentBalanceFen, refundAmountFen));
            
            // 更新钱包余额（存储分）
            await serviceRoleSupabase
                .from("coach_wallets")
                .update({
                    balance: newBalanceFen,
                    updated_at: new Date().toISOString(),
                })
                .eq("coach_id", orderCoachId);

            // 查询对应收入流水 id，用于插入退款流水时填写 related_income_tx_id（退款流水可据此找到原始流水）
            const incomeTxRes = await serviceRoleSupabase
                .from("wallet_transactions")
                .select("id")
                .eq("wallet_id", orderCoachId)
                .eq("alipay_order_id", orderId)
                .eq("type", "income")
                .maybeSingle();
            const incomeTx = incomeTxRes.data as { id: string } | null;

            // 检查是否已存在退款记录（防止重复插入）
            const { data: existingRefundTx } = await serviceRoleSupabase
                .from("wallet_transactions")
                .select("id")
                .eq("alipay_order_id", orderId)
                .eq("type", "refund")
                .maybeSingle();

            // 插入退款流水记录（如果不存在）：type=refund，alipay_order_id 关联支付宝账单，related_income_tx_id 指向原始收入流水
            if (!existingRefundTx) {
                const orderSubject = (order as { subject?: string | null }).subject;
                const originalDesc = (orderData?.subject as string) || orderSubject || "支付宝订单";
                const { error: insertRefundErr } = await serviceRoleSupabase.from("wallet_transactions").insert({
                    wallet_id: orderCoachId,
                    amount: refundAmountFen, // 存储分（整数）
                    type: "refund",
                    alipay_order_id: orderId,
                    related_income_tx_id: incomeTx?.id ?? null,
                    description: `已退款：${originalDesc}`,
                    created_at: new Date().toISOString(),
                });
                if (insertRefundErr) {
                    console.error("[Alipay Refund] 插入退款流水失败:", insertRefundErr);
                }
            }

            // 始终将对应收入流水标记为已退款，教练端列表才能显示「已退款」且与余额一致（refunded_at 见 migration 20260130_wallet_transactions_refunded_at）
            const { data: updatedIncome, error: updateRefundedErr } = await serviceRoleSupabase
                .from("wallet_transactions")
                .update({ refunded_at: new Date().toISOString() } as Record<string, unknown>)
                .eq("wallet_id", orderCoachId)
                .eq("alipay_order_id", orderId)
                .eq("type", "income")
                .select("id");
            if (updateRefundedErr) {
                console.error("[Alipay Refund] 标记收入流水已退款失败:", updateRefundedErr);
            } else if (!updatedIncome?.length) {
                console.warn("[Alipay Refund] 未找到需标记的收入流水:", orderId, orderCoachId);
            }
        }
    }

    return NextResponse.json<ApiData<RefundAlipayOrderResponseDto>>({
        success: true,
        message: "退款成功",
        data: { success: true, message: "退款成功" },
    });
}
