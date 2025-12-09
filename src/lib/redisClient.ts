import { createClient } from 'redis'; // 从版本 4.x 开始，导入方式已改变[citation:8]

export const redis = createClient({
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
});

redis.on('error', (err) => {
    console.error('[Redis] Error:', err);
});

redis.connect().catch(console.error);

export default redis;