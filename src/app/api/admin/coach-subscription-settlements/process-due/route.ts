import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import {
    executeBalancePayment,
    markSettlementWalletCredited,
    updateTransactionAndWallet,
} from "@/app/api/payment/alipay/fulfillPaidOrder";

export const dynamic = "force-dynamic";

function isAuthorized(req: Request, session: Awaited<ReturnType<typeof getServerSession>>) {
    const secret = String(process.env.CRON_SECRET || process.env.HUIFU_SETTLEMENT_CRON_SECRET || "").trim();
    const authHeader = req.headers.get("authorization") || "";
    const headerSecret = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
    const explicitSecret = req.headers.get("x-cron-secret") || "";
    if (secret && (headerSecret === secret || explicitSecret === secret)) {
        return { ok: true as const, mode: "secret" as const };
    }
    if ((session?.user as { is_admin?: boolean } | undefined)?.is_admin) {
        return { ok: true as const, mode: "admin" as const };
    }
    return { ok: false as const };
}

type ProcessResult = {
    orderId: string;
    settlementId: string;
    status: string;
    walletCredited: boolean;
    message?: string;
};

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
    const auth = isAuthorized(req, session);
    if (!auth.ok) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "无权访问", data: null },
            { status: session?.user?.id ? 403 : 401 },
        );
    }

    const body = await req.json().catch(() => ({})) as {
        limit?: number;
        dryRun?: boolean;
        force?: boolean;
        confirm?: string;
    };

    const force = body.force === true;
    if ((auth.mode === "admin" || force) && body.confirm !== "PROCESS_DUE_HUIFU_SETTLEMENTS") {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "缺少确认标记：PROCESS_DUE_HUIFU_SETTLEMENTS", data: null },
            { status: 400 },
        );
    }

    const limit = Math.min(Math.max(Math.round(Number(body.limit || 50)), 1), 100);
    const nowIso = new Date().toISOString();

    let query = (serviceRoleSupabase as any)
        .from("coach_subscription_settlements")
        .select("*")
        .in("status", ["pending", "split_failed"])
        .order("eligible_at", { ascending: true })
        .limit(limit);

    if (!force) {
        query = query.lte("eligible_at", nowIso);
    }

    const { data: settlements, error } = await query;
    if (error) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: error.message, data: null },
            { status: 500 },
        );
    }

    const rows = (settlements || []) as Record<string, any>[];
    if (body.dryRun) {
        return NextResponse.json<ApiData<{ due: Record<string, any>[] }>>({
            success: true,
            message: "待处理结算列表",
            data: { due: rows },
        });
    }

    const orders = await fetchOrderMap(rows.map((row) => String(row.alipay_order_id || "")));
    const results: ProcessResult[] = [];

    for (const settlement of rows) {
        const orderId = String(settlement.alipay_order_id || "");
        const order = orders.get(orderId);
        if (!order || order.status !== "paid") {
            results.push({
                orderId,
                settlementId: String(settlement.id),
                status: "skipped",
                walletCredited: false,
                message: "Source order is missing or not paid",
            });
            continue;
        }

        const splitResult = await executeBalancePayment(order, { force });
        let walletCredited = false;
        if (splitResult.shouldCreditWallet) {
            walletCredited = await updateTransactionAndWallet(order, splitResult.splitInfo);
            if (walletCredited) {
                await markSettlementWalletCredited(order.id);
            }
        }

        results.push({
            orderId,
            settlementId: String(settlement.id),
            status: splitResult.status,
            walletCredited,
            message: splitResult.message,
        });
    }

    return NextResponse.json<ApiData<{ processed: ProcessResult[] }>>({
        success: true,
        message: `已处理 ${results.length} 条到期分账`,
        data: { processed: results },
    });
}
