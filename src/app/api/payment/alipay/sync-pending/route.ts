/**
 * 兜底：同步「仍为 pending 的订单」到支付宝实际状态并履约。
 * 与 notify/query 共用 fulfillPaidOrder，幂等。
 *
 * 调用方式：
 * 1. 进程内定时器（推荐）：应用启动后自动按间隔执行，无需外部调用。
 * 2. 手动/外部 cron：GET/POST 本接口，请求头带 x-cron-secret 或 Authorization: Bearer <ALIPAY_SYNC_SECRET>。
 */
import { NextResponse } from "next/server";
import { syncPendingAlipayOrders } from "@/app/api/payment/alipay/syncPendingOrders";

function checkAuth(req: Request): boolean {
    const secret = process.env.ALIPAY_SYNC_SECRET || process.env.CRON_SECRET;
    if (!secret) return false;
    const authHeader = req.headers.get("authorization");
    const cronSecret = req.headers.get("x-cron-secret");
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.slice(7) === secret;
    }
    return cronSecret === secret;
}

export async function GET(req: Request) {
    if (!checkAuth(req)) {
        return NextResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 }
        );
    }
    const result = await syncPendingAlipayOrders();
    return NextResponse.json({
        success: true,
        ...result,
        errors: result.errors.length ? result.errors : undefined,
    });
}

export async function POST(req: Request) {
    return GET(req);
}
