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

    // fetch resolves even for 401/500. Surface non-2xx responses so a missing
    // cron secret, wrong base URL, or failed settlement endpoint is visible in
    // the pod logs instead of silently leaving due settlements at attempts=0.
    if (!response.ok) {
        const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 500);
        throw new Error(`${path} returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }
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

/**
 * 全局媒体 URL 兼容层：patch 全局 Response.json，使所有 API 响应在序列化前
 * 把历史 Supabase Storage URL 就地转成 CDN URL（迁移保留 key 路径，1:1 转换；
 * 非媒体字符串原样保留）。一处接入、不漏任何接口，前端不再访问 supabase。
 *
 * 之所以 patch 全局 Response.json 而非 NextResponse.json：
 * - NextResponse.json(body, init) 内部委托给全局 Response.json（见 next 源码）；
 * - 全局 Response 是 Node 运行时单例，所有 Turbopack bundle 共享同一对象，patch 必然命中；
 *   而经 instrumentation 直接 patch NextResponse 因模块被独立打包，路由侧拿到的是另一份，patch 不生效。
 */
async function patchResponseJson() {
    const flag = "__coachlinkMediaJsonPatched";
    const g = globalThis as unknown as Record<string, boolean>;
    if (g[flag]) return;

    const { resolveMediaDeep } = await import("@/lib/storageUrl");

    const ResponseCtor = (globalThis as unknown as { Response: { json: (body: unknown, init?: ResponseInit) => Response } }).Response;
    const originalJson = ResponseCtor.json;
    Object.defineProperty(ResponseCtor, "json", {
        value: (body: unknown, init?: ResponseInit) => originalJson.call(ResponseCtor, resolveMediaDeep(body), init),
        writable: true,
        configurable: true,
    });

    g[flag] = true;
    console.log("[MediaCompat] 全局 Response.json 已接入 Supabase→CDN 兼容层");
}

export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;

    await patchResponseJson();

    const key = "__coachlinkBackgroundJobsStarted";
    if ((globalThis as unknown as Record<string, boolean>)[key]) return;
    (globalThis as unknown as Record<string, boolean>)[key] = true;

    const baseUrl =
        process.env.NEXTAUTH_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000";

    // Keep scheduler credentials as runtime reads. Apollo config is loaded only
    // when the Node process starts, so these values must not rely on build-time
    // environment replacement; trim also keeps the request header consistent
    // with the endpoint's credential comparison.
    const runtimeEnv = process.env as Record<string, string | undefined>;
    const readRuntimeSecret = (name: string) => String(runtimeEnv[name] || "").trim();
    const sharedSecret = readRuntimeSecret("CRON_SECRET");
    const alipaySecret = readRuntimeSecret("ALIPAY_SYNC_SECRET") || sharedSecret;
    const huifuSecret = readRuntimeSecret("HUIFU_SETTLEMENT_CRON_SECRET") || sharedSecret;

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
