/**
 * Node-only startup for observability, media URL compatibility, and local
 * background jobs. This module is dynamically imported by instrumentation.ts.
 */
function readIntervalMs(envName: string, fallbackMs: number) {
    const raw = process.env[envName];
    if (raw == null || raw === "") return fallbackMs;
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return fallbackMs;
    return parsed;
}

async function postCronEndpoint(
    baseUrl: string,
    path: string,
    secret: string,
    body?: Record<string, unknown>,
) {
    const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-cron-secret": secret,
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 500);
        throw new Error(`${path} returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }
}

function startIntervalJob(name: string, intervalMs: number, run: () => void) {
    if (intervalMs <= 0) {
        console.log(`[${name}] disabled; interval=${intervalMs}ms`);
        return;
    }

    run();
    setInterval(run, intervalMs);
    console.log(`[${name}] started; interval=${intervalMs}ms`);
}

async function patchResponseJson() {
    const flag = "__coachlinkMediaJsonPatched";
    const globals = globalThis as unknown as Record<string, boolean>;
    if (globals[flag]) return;

    const [
        { resolveMediaDeep },
        { appendActiveTraceHeaders },
        { recordApiJsonResponse },
    ] = await Promise.all([
        import("@/lib/storageUrl"),
        import("@/lib/observability/requestContext"),
        import("@/lib/observability/metrics"),
    ]);

    const ResponseCtor = (
        globalThis as unknown as {
            Response: {
                json: (body: unknown, init?: ResponseInit) => Response;
            };
        }
    ).Response;
    const originalJson = ResponseCtor.json;
    Object.defineProperty(ResponseCtor, "json", {
        value: (body: unknown, init?: ResponseInit) => {
            const resolvedBody = resolveMediaDeep(body);
            const response = originalJson.call(ResponseCtor, resolvedBody, init);
            try {
                appendActiveTraceHeaders(response.headers);
            } catch {
                // Some Response instances may have immutable headers; telemetry headers are best-effort.
            }
            try {
                const success = typeof resolvedBody === "object"
                    && resolvedBody !== null
                    && "success" in resolvedBody
                    ? String(Boolean((resolvedBody as { success?: unknown }).success))
                    : String(response.status >= 200 && response.status < 400);
                recordApiJsonResponse(response.status, success, JSON.stringify(resolvedBody).length);
            } catch {
                recordApiJsonResponse(response.status, "unknown", 0);
            }
            return response;
        },
        writable: true,
        configurable: true,
    });

    globals[flag] = true;
    console.log("[MediaCompat] 全局 Response.json 已接入 Supabase→CDN 兼容层");
}

export async function registerNodeRuntime() {
    const { initObservability } = await import("@/lib/observability/init");
    initObservability();

    const { installConsoleLogCorrelation } = await import("@/lib/observability/logger");
    installConsoleLogCorrelation();

    await patchResponseJson();

    if (process.env.NODE_ENV === 'development' && process.env.COACHLINK_LOCAL_DEBUG_LOGIN === '1') {
        console.info('[BackgroundJobs] disabled for isolated local debug login');
        return;
    }

    const key = "__coachlinkBackgroundJobsStarted";
    if ((globalThis as unknown as Record<string, boolean>)[key]) return;
    (globalThis as unknown as Record<string, boolean>)[key] = true;

    const baseUrl =
        process.env.NEXTAUTH_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000";

    const runtimeEnv = process.env as Record<string, string | undefined>;
    const readRuntimeSecret = (name: string) => String(runtimeEnv[name] || "").trim();
    const sharedSecret = readRuntimeSecret("CRON_SECRET");
    const alipaySecret = readRuntimeSecret("ALIPAY_SYNC_SECRET") || sharedSecret;
    const huifuSecret = readRuntimeSecret("HUIFU_SETTLEMENT_CRON_SECRET") || sharedSecret;
    const mobilePushSecret = readRuntimeSecret("MOBILE_PUSH_CRON_SECRET") || sharedSecret;

    if (alipaySecret) {
        startIntervalJob(
            "Alipay SyncPending",
            readIntervalMs("ALIPAY_SYNC_INTERVAL_MS", 10 * 60 * 1000),
            () => {
                postCronEndpoint(baseUrl, "/api/payment/alipay/sync-pending", alipaySecret).catch((error) => {
                    console.error("[Alipay SyncPending] background run error:", error);
                });
            },
        );
        startIntervalJob(
            "ActivatePendingPlans",
            readIntervalMs("ACTIVATE_PENDING_PLANS_INTERVAL_MS", 60 * 1000),
            () => {
                postCronEndpoint(baseUrl, "/api/plan-lib/activate-pending-plans", alipaySecret).catch((error) => {
                    console.error("[ActivatePendingPlans] background run error:", error);
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
                ).catch((error) => {
                    console.error("[HuifuSettlements] process due background run error:", error);
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
                ).catch((error) => {
                    console.error("[HuifuSettlements] reconcile background run error:", error);
                });
            },
        );
    } else {
        console.warn("[BackgroundJobs] missing HUIFU_SETTLEMENT_CRON_SECRET/CRON_SECRET; skip Huifu settlement jobs");
    }

    if (mobilePushSecret) {
        startIntervalJob(
            "MobilePush Drain",
            readIntervalMs("MOBILE_PUSH_DRAIN_INTERVAL_MS", 15 * 1000),
            () => {
                postCronEndpoint(
                    baseUrl,
                    "/api/internal/mobile-push/drain?limit=100",
                    mobilePushSecret,
                ).catch((error) => {
                    console.error("[MobilePush] drain background run error:", error);
                });
            },
        );
    } else {
        console.warn("[BackgroundJobs] missing MOBILE_PUSH_CRON_SECRET/CRON_SECRET; skip mobile push job");
    }

    // Subscription expiry used to be fired from every signed-in visitor's
    // browser. It now runs here, in-process, so it needs no cron secret. It is
    // opt-in (set SUBSCRIPTION_EXPIRY_CHECK_INTERVAL_MS, e.g. 3600000, in the
    // deployment only): local dev and local production builds use the live
    // database and must never cancel subscriptions on their own.
    // The same run first closes workouts left unconfirmed for over 5 hours, so a
    // student opening the app later sees the settled state instead of having
    // the timeout land in the middle of their own action.
    startIntervalJob(
        "SubscriptionExpiry Check",
        readIntervalMs("SUBSCRIPTION_EXPIRY_CHECK_INTERVAL_MS", 0),
        () => {
            import("@/lib/planExecutionLifecycle")
                .then(({ expireTimedOutPlanExecutions }) => expireTimedOutPlanExecutions())
                .then((expired) => {
                    if (expired.length > 0) console.log(`[ExecutionTimeout] closed ${expired.length} unconfirmed workouts`);
                })
                .catch((error) => {
                    console.error("[ExecutionTimeout] background run error:", error);
                })
                .then(() => import("@/lib/subscriptionExpiryCheck"))
                .then(({ runSubscriptionExpiryCheckOnce }) => runSubscriptionExpiryCheckOnce())
                .then((result) => {
                    if (result.ok === false) {
                        console.error("[SubscriptionExpiry] run aborted:", result.stage, result.message);
                    }
                })
                .catch((error) => {
                    console.error("[SubscriptionExpiry] background run error:", error);
                });
        },
    );
}
