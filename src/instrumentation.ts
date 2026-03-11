/**
 * Next.js 会在 Node 运行时启动时调用 register()。
 * 在此启动支付宝 pending 订单的进程内定时同步，无需外部 cron。
 */
// 强制使用 Node 运行时，避免 Edge/Webpack 打包缺少 Node 内置模块
export const runtime = "nodejs";
export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;

    const secret = process.env.ALIPAY_SYNC_SECRET || process.env.CRON_SECRET;
    if (!secret) {
        console.warn(
            "[Alipay SyncPending] missing ALIPAY_SYNC_SECRET/CRON_SECRET, skip background sync"
        );
        return;
    }

    // 未设置时默认 10 分钟；设为 0 可关闭定时同步
    const intervalMs = parseInt(
        process.env.ALIPAY_SYNC_INTERVAL_MS || "600000",
        10
    );
    if (intervalMs <= 0) {
        console.log("[Alipay SyncPending] ALIPAY_SYNC_INTERVAL_MS=0，已关闭进程内定时同步");
        return;
    }

    const key = "__alipaySyncIntervalStarted";
    if ((globalThis as unknown as Record<string, boolean>)[key]) return;
    (globalThis as unknown as Record<string, boolean>)[key] = true;

    const baseUrl =
        process.env.NEXTAUTH_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000";

    const run = () => {
        fetch(`${baseUrl}/api/payment/alipay/sync-pending`, {
            method: "POST",
            headers: {
                "x-cron-secret": secret,
            },
        }).catch((e) => {
            console.error("[Alipay SyncPending] background run error:", e);
        });
    };

    run(); // 启动时立即执行一次
    setInterval(run, intervalMs);

    console.log(
        `[Alipay SyncPending] 进程内定时同步已启动，首次已立即执行，之后每 ${intervalMs}ms 执行`
    );

    // 激活延迟的计划实例（每1分钟检查一次）
    const activatePendingPlansIntervalMs = 60 * 1000; // 1分钟
    const activatePendingPlans = () => {
        fetch(`${baseUrl}/api/plan-lib/activate-pending-plans`, {
            method: "POST",
            headers: {
                "x-cron-secret": secret,
            },
        }).catch((e) => {
            console.error("[ActivatePendingPlans] background run error:", e);
        });
    };

    activatePendingPlans(); // 启动时立即执行一次
    setInterval(activatePendingPlans, activatePendingPlansIntervalMs);

    console.log(
        `[ActivatePendingPlans] 定时激活任务已启动，首次已立即执行，之后每 ${activatePendingPlansIntervalMs}ms 执行`
    );
}
