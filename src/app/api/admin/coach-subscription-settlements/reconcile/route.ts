import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import {
    markSettlementWalletCredited,
    reconcileBalancePaymentSettlement,
    updateTransactionAndWallet,
} from "@/app/api/payment/alipay/fulfillPaidOrder";

export const dynamic = "force-dynamic";

function isAuthorized(req: Request, session: Awaited<ReturnType<typeof getServerSession>>) {
    const runtimeEnv = process.env as Record<string, string | undefined>;
    const secrets = new Set(
        [runtimeEnv["HUIFU_SETTLEMENT_CRON_SECRET"], runtimeEnv["CRON_SECRET"]]
            .map((value) => String(value || "").trim())
            .filter(Boolean),
    );
    const authHeader = req.headers.get("authorization") || "";
    const headerSecret = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
    const explicitSecret = req.headers.get("x-cron-secret") || "";
    if (secrets.has(headerSecret) || secrets.has(explicitSecret)) return true;
    return Boolean((session?.user as { is_admin?: boolean } | undefined)?.is_admin);
}

async function fetchOrderMap(orderIds: string[]) {
    const uniqueIds = Array.from(new Set(orderIds.filter(Boolean)));
    if (!uniqueIds.length) return new Map<string, Record<string, any>>();
    const { data, error } = await (serviceRoleSupabase as any)
        .from("alipay_orders")
        .select("*")
        .in("id", uniqueIds);
    if (error) throw error;
    return new Map<string, Record<string, any>>(
        (data || []).map((row: Record<string, any>) => [String(row.id), row]),
    );
}

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!isAuthorized(req, session)) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "无权访问", data: null },
            { status: session?.user?.id ? 403 : 401 },
        );
    }

    const body = await req.json().catch(() => ({})) as { limit?: number; orderId?: string };
    const limit = Math.min(Math.max(Math.round(Number(body.limit || 50)), 1), 100);
    const orderId = String(body.orderId || "").trim();

    let query = (serviceRoleSupabase as any)
        .from("coach_subscription_settlements")
        .select("*")
        .eq("status", "processing")
        .not("req_date", "is", null)
        .not("req_seq_id", "is", null)
        .order("last_attempt_at", { ascending: true })
        .limit(limit);

    if (orderId) {
        query = query.eq("alipay_order_id", orderId);
    }

    const { data: settlements, error } = await query;
    if (error) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: error.message, data: null },
            { status: 500 },
        );
    }

    const rows = (settlements || []) as Record<string, any>[];
    const orders = await fetchOrderMap(rows.map((row) => String(row.alipay_order_id || "")));
    const results: Array<{ orderId: string; status: string; walletCredited: boolean; message?: string }> = [];

    for (const settlement of rows) {
        const sourceOrderId = String(settlement.alipay_order_id || "");
        const order = orders.get(sourceOrderId);
        if (!order || order.status !== "paid") {
            results.push({
                orderId: sourceOrderId,
                status: "skipped",
                walletCredited: false,
                message: "Source order is missing or not paid",
            });
            continue;
        }

        const splitResult = await reconcileBalancePaymentSettlement(settlement as any, order);
        let walletCredited = false;
        if (splitResult.shouldCreditWallet) {
            walletCredited = await updateTransactionAndWallet(order, splitResult.splitInfo);
            if (walletCredited) {
                await markSettlementWalletCredited(order.id);
            }
        }
        results.push({
            orderId: sourceOrderId,
            status: splitResult.status,
            walletCredited,
            message: splitResult.message,
        });
    }

    return NextResponse.json<ApiData<{ reconciled: typeof results }>>({
        success: true,
        message: `已对账 ${results.length} 条处理中分账`,
        data: { reconciled: results },
    });
}
