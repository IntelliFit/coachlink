import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import {
    markSettlementWalletCredited,
    reconcileProcessingBalancePayment,
    updateTransactionAndWallet,
} from "@/app/api/payment/alipay/fulfillPaidOrder";

export const dynamic = "force-dynamic";

function requireAdmin(session: Awaited<ReturnType<typeof getServerSession>>) {
    if (!session?.user?.id) return { ok: false as const, status: 401, message: "未登录" };
    if (!(session.user as { is_admin?: boolean })?.is_admin) {
        return { ok: false as const, status: 403, message: "无权限" };
    }
    return { ok: true as const };
}

function isCoachSubscriptionOrderType(orderType: unknown) {
    return orderType === "coach_subscription" || orderType === "coach_subscription_renew";
}

type ReconcileSettlementResponse = {
    orderId: string;
    splitStatus: string;
    walletCredited: boolean;
    message?: string;
};

/**
 * Admin-only reconciliation for Huifu split rows stuck at processing.
 *
 * This endpoint queries the prior Huifu balance-payment request and never
 * starts a new transfer. Use retry only after reconciliation marks a row as
 * split_failed or the operator has otherwise confirmed no transfer happened.
 */
export async function POST(req: Request) {
    const session = await getServerSession();
    const auth = requireAdmin(session);
    if (!auth.ok) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: auth.message, data: null },
            { status: auth.status },
        );
    }

    const body = await req.json().catch(() => ({})) as {
        orderId?: string;
        confirm?: string;
    };
    const orderId = String(body.orderId || "").trim();

    if (!orderId) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "缺少订单 ID", data: null },
            { status: 400 },
        );
    }

    if (body.confirm !== "QUERY_HUIFU_SPLIT") {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "缺少确认标记：QUERY_HUIFU_SPLIT", data: null },
            { status: 400 },
        );
    }

    const { data: order, error } = await serviceRoleSupabase
        .from("alipay_orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();

    if (error) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: error.message, data: null },
            { status: 500 },
        );
    }

    if (!order) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "订单不存在", data: null },
            { status: 404 },
        );
    }

    if (!isCoachSubscriptionOrderType(order.order_type)) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "该订单不是教练订阅订单，不能执行分账查询", data: null },
            { status: 400 },
        );
    }

    if (order.status !== "paid") {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "订单尚未支付成功，不能执行分账查询", data: null },
            { status: 400 },
        );
    }

    const splitResult = await reconcileProcessingBalancePayment(order);
    let walletCredited = false;

    if (splitResult.shouldCreditWallet) {
        walletCredited = await updateTransactionAndWallet(order, splitResult.splitInfo);
        if (walletCredited) {
            await markSettlementWalletCredited(order.id);
        }
    }

    return NextResponse.json<ApiData<ReconcileSettlementResponse>>({
        success:
            splitResult.status === "split_success" ||
            splitResult.status === "wallet_credited" ||
            splitResult.status === "processing" ||
            splitResult.status === "split_failed",
        message: splitResult.message || "分账查询已处理",
        data: {
            orderId: order.id,
            splitStatus: splitResult.status,
            walletCredited,
            message: splitResult.message,
        },
    });
}
