import { NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import type { CheckExpiredSubscriptionsResponseDto } from "./entity";
import { authorizeMaintenanceRequest } from "@/lib/maintenanceAuth";
import { runSubscriptionExpiryCheckOnce } from "@/lib/subscriptionExpiryCheck";

const SECRET_ENV = "SUBSCRIPTION_EXPIRY_CRON_SECRET";

/**
 * Manual trigger for the subscription expiry job. Scheduled runs happen
 * in-process (src/instrumentation-node.ts), never from a visitor's page.
 * Only a signed-in admin (or a caller holding the cron secret) may run it.
 */
export async function POST(req: Request) {
    const auth = await authorizeMaintenanceRequest(req, SECRET_ENV);
    if (auth.ok === false) {
        return NextResponse.json({ success: false, message: auth.message, data: null }, { status: auth.status });
    }

    const result = await runSubscriptionExpiryCheckOnce();
    if (result.ok === false) {
        return NextResponse.json({
            success: false,
            message: result.stage === "write" ? result.message : `暂时无法核对订阅数据，未调整订阅（${result.message}）`,
            data: null,
        }, { status: result.stage === "write" ? 500 : 503 });
    }

    return NextResponse.json<ApiData<CheckExpiredSubscriptionsResponseDto>>({
        success: true,
        message: result.expiredCount + result.refreshedCount === 0
            ? "没有发现过期的订阅"
            : `成功处理了 ${result.expiredCount} 个订阅（进入宽限 ${result.expiredCount}，刷新 ${result.refreshedCount} 个预计完成日，自动取消 ${result.cancelledCount}，待人工核对 ${result.heldForReviewIds.length}）`,
        data: {
            expiredCount: result.expiredCount,
            refreshedCount: result.refreshedCount,
            expiredSubscriptionIds: result.expiredSubscriptionIds,
        },
    });
}
