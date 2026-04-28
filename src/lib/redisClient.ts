import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL?.trim();
const redisPassword = process.env.REDIS_PASSWORD?.trim();
let hasLoggedConnectionError = false;

const logRedisConnectionError = (prefix: string, err: unknown) => {
    if (hasLoggedConnectionError) return;
    hasLoggedConnectionError = true;
    console.error(prefix, err);
};

export const redis = createClient({
    url: redisUrl || undefined,
    password: redisPassword || undefined,
    disableOfflineQueue: true,
    socket: {
        reconnectStrategy: false,
    },
});

redis.on("error", (err) => {
    logRedisConnectionError("[Redis] Error:", err);
});

if (redisUrl) {
    redis.connect().catch((err) => {
        logRedisConnectionError("[Redis] Connection Error:", err);
    });
} else {
    console.warn("[Redis] REDIS_URL not set, skipping connection");
}

export default redis;
