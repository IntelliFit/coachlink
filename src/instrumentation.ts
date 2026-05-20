/**
 * Next.js calls register() when the Node.js runtime starts.
 * We use it to run lightweight in-process background jobs when no external
 * cron platform is configured.
 */
export const runtime = "nodejs";

function readIntervalMs(envName: string, fallbackMs: number) {
    const raw = process.env[envName];
    if (raw == null || raw === "") return fallbackMs;
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return fallbackMs;
    return parsed;
}

function postCronEndpoint(
    baseUrl: string,
    path: string,
    secret: string,
    body?: Record<string, unknown>,
) {
    return fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-cron-secret": secret,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
}

function startIntervalJob(
    name: string,
    intervalMs: number,
    run: () => void,
) {
    if (intervalMs <= 0) {
        console.log(`[${name}] disabled; interval=${intervalMs}ms`);
        return;
    }

    run();
    setInterval(run, intervalMs);
    console.log(`[${name}] started; interval=${intervalMs}ms`);
}

export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;

    const key = "__coachlinkBackgroundJobsStarted";
    if ((globalThis as unknown as Record<string, boolean>)[key]) return;
    (globalThis as unknown as Record<string, boolean>)[key] = true;

    const baseUrl =
        process.env.NEXTAUTH_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000";

    const sharedSecret = process.env.CRON_SECRET || "";
    const alipaySecret = process.env.ALIPAY_SYNC_SECRET || sharedSecret;
    const huifuSecret = process.env.HUIFU_SETTLEMENT_CRON_SECRET || sharedSecret;

    if (alipaySecret) {
        startIntervalJob(
            "Alipay SyncPending",
            readIntervalMs("ALIPAY_SYNC_INTERVAL_MS", 10 * 60 * 1000),
            () => {
                postCronEndpoint(baseUrl, "/api/payment/alipay/sync-pending", alipaySecret).catch((e) => {
                    console.error("[Alipay SyncPending] background run error:", e);
                });
            },
        );

        startIntervalJob(
            "ActivatePendingPlans",
            readIntervalMs("ACTIVATE_PENDING_PLANS_INTERVAL_MS", 60 * 1000),
            () => {
                postCronEndpoint(baseUrl, "/api/plan-lib/activate-pending-plans", alipaySecret).catch((e) => {
                    console.error("[ActivatePendingPlans] background run error:", e);
                });
            },
        );
    } else {
        console.warn("[BackgroundJobs] missing ALIPAY_SYNC_SECRET/CRON_SECRET; skip alipay and plan jobs");
    }

    if (huifuSecret) {
        startIntervalJob(
            "HuifuSettlements ProcessDue",
            readIntervalMs("HUIFU_SETTLEMENT_PROCESS_INTERVAL_MS", 60 * 60 * 1000),
            () => {
                postCronEndpoint(
                    baseUrl,
                    "/api/admin/coach-subscription-settlements/process-due",
                    huifuSecret,
                    { limit: 50 },
                ).catch((e) => {
                    console.error("[HuifuSettlements] process due background run error:", e);
                });
            },
        );

        startIntervalJob(
            "HuifuSettlements Reconcile",
            readIntervalMs("HUIFU_SETTLEMENT_RECONCILE_INTERVAL_MS", 60 * 60 * 1000),
            () => {
                postCronEndpoint(
                    baseUrl,
                    "/api/admin/coach-subscription-settlements/reconcile",
                    huifuSecret,
                    { limit: 50 },
                ).catch((e) => {
                    console.error("[HuifuSettlements] reconcile background run error:", e);
                });
            },
        );
    } else {
        console.warn("[BackgroundJobs] missing HUIFU_SETTLEMENT_CRON_SECRET/CRON_SECRET; skip Huifu settlement jobs");
    }
}
