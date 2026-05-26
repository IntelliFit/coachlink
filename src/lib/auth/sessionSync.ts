import type { Session } from "next-auth";
import { getSession } from "next-auth/react";

type WaitForSessionReadyOptions = {
    /**
     * 期望命中的用户 ID（可选）。传入后会确保会话中的 user.id 与之匹配。
     */
    expectedUserId?: string;
    /**
     * 每次重试前的等待时间（毫秒）。
     * 默认值覆盖了「cookie 刚写入但 session 还未可读」的常见窗口。
     */
    retryDelaysMs?: number[];
    /**
     * 整体超时时间（毫秒）。
     */
    timeoutMs?: number;
};

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

function matchesExpectedUser(session: Session | null, expectedUserId?: string): boolean {
    if (!session?.user?.id) return false;
    if (!expectedUserId) return true;
    return session.user.id === expectedUserId;
}

/**
 * 等待客户端 session 同步完成（登录后立即刷新 UI 的关键兜底）。
 */
export async function waitForSessionReady(
    options: WaitForSessionReadyOptions = {},
): Promise<Session | null> {
    if (typeof window === "undefined") {
        return null;
    }

    const {
        expectedUserId,
        retryDelaysMs = [0, 120, 260, 450, 800, 1200, 1800, 2600],
        timeoutMs = 8_000,
    } = options;

    const startTime = Date.now();
    let latestSession: Session | null = null;

    for (const delayMs of retryDelaysMs) {
        if (delayMs > 0) {
            await sleep(delayMs);
        }

        if (Date.now() - startTime > timeoutMs) {
            break;
        }

        try {
            latestSession = await getSession();
            if (matchesExpectedUser(latestSession, expectedUserId)) {
                return latestSession;
            }
        } catch {
            // 静默失败，继续重试直到超时
        }
    }

    if (expectedUserId) {
        return null;
    }

    return latestSession;
}
