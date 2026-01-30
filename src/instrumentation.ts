/**
 * Next.js 会在 Node 运行时启动时调用 register()。
 * 在此启动支付宝 pending 订单的进程内定时同步，无需外部 cron。
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;

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

    const { syncPendingAlipayOrders } = await import(
        "@/app/api/payment/alipay/syncPendingOrders"
    );

    const run = () => {
        syncPendingAlipayOrders().catch((e) => {
            console.error("[Alipay SyncPending] background run error:", e);
        });
    };

    run(); // 启动时立即执行一次
    setInterval(run, intervalMs);

    console.log(
        `[Alipay SyncPending] 进程内定时同步已启动，首次已立即执行，之后每 ${intervalMs}ms 执行`
    );
}
