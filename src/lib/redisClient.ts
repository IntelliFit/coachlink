import { createClient } from "redis";

type AppRedisClient = ReturnType<typeof createClient>;

const CONNECT_TIMEOUT_MS = 10_000;

let client: AppRedisClient | null = null;
let connectPromise: Promise<AppRedisClient> | null = null;
let hasLoggedConnectionError = false;
let hasLoggedSkip = false;

function buildRedisUrl(): string | undefined {
    const rawUrl = process.env.REDIS_URL?.trim();
    if (!rawUrl) return undefined;

    const password = process.env.REDIS_PASSWORD?.trim();
    if (!password) return rawUrl;

    try {
        const parsed = new URL(rawUrl);
        if (parsed.password) return rawUrl;
        parsed.password = password;
        return parsed.toString();
    } catch {
        return rawUrl;
    }
}

function sanitizeUrlForLog(url: string): string {
    try {
        const parsed = new URL(url);
        const user = parsed.username ? `${parsed.username}:****@` : parsed.password ? ":****@" : "";
        const port = parsed.port || (parsed.protocol === "rediss:" ? "6380" : "6379");
        return `${parsed.protocol}//${user}${parsed.hostname}:${port}${parsed.pathname === "/" ? "" : parsed.pathname}`;
    } catch {
        return "(invalid REDIS_URL)";
    }
}

function logRedisConnectionError(prefix: string, err: unknown) {
    if (hasLoggedConnectionError) return;
    hasLoggedConnectionError = true;
    console.error(prefix, err);
}

async function connectRedisClient(): Promise<AppRedisClient> {
    const url = buildRedisUrl();
    if (!url) {
        if (!hasLoggedSkip) {
            hasLoggedSkip = true;
            console.warn("[Redis] REDIS_URL not set, skipping connection");
        }
        throw new Error("[Redis] REDIS_URL not set");
    }

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch (err) {
        logRedisConnectionError("[Redis] Invalid REDIS_URL:", err);
        throw err;
    }

    console.log(
        `[Redis] Connecting to ${sanitizeUrlForLog(url)} (host=${parsed.hostname}, port=${parsed.port || "6379"})`,
    );

    const nextClient = createClient({
        url,
        disableOfflineQueue: true,
        socket: {
            reconnectStrategy: false,
            connectTimeout: CONNECT_TIMEOUT_MS,
            // K8s Service DNS may resolve to IPv6 first while Redis only listens on IPv4.
            family: 4,
        },
    });

    nextClient.on("error", (err) => {
        logRedisConnectionError("[Redis] Error:", err);
    });

    await nextClient.connect();
    console.log("[Redis] Connected");
    return nextClient;
}

/** Lazy singleton — reads env and connects on first use, not at module import. */
export async function getRedisClient(): Promise<AppRedisClient> {
    if (client?.isOpen) return client;
    if (!connectPromise) {
        connectPromise = connectRedisClient()
            .then((connected) => {
                client = connected;
                return connected;
            })
            .catch((err) => {
                connectPromise = null;
                logRedisConnectionError("[Redis] Connection Error:", err);
                throw err;
            });
    }
    return connectPromise;
}

function bindRedisMethod<K extends keyof Pick<AppRedisClient, "get" | "setEx" | "del">>(
    method: K,
): AppRedisClient[K] {
    const bound = (async (...args: Parameters<AppRedisClient[K]>) => {
        const activeClient = await getRedisClient();
        const fn = activeClient[method] as (...params: Parameters<AppRedisClient[K]>) => ReturnType<AppRedisClient[K]>;
        return fn.apply(activeClient, args);
    }) as AppRedisClient[K];
    return bound;
}

export const redis = {
    get: bindRedisMethod("get"),
    setEx: bindRedisMethod("setEx"),
    del: bindRedisMethod("del"),
};

export default redis;
