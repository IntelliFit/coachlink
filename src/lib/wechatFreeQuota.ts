import { WECHAT_FREE_LIMITS } from '@coachlink/core';
import { getRedisClient } from '@/lib/redisClient';

function quotaKey(userId: string, now = new Date()) {
  // Fixed UTC+8 business month, independent of the server/container timezone.
  const month = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7);
  return `coachlink:wechat-free-v1:ai:${month}:${userId}`;
}

const CONSUME_SCRIPT = `
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
local count = tonumber(ARGV[1])
local cap = tonumber(ARGV[2])
if used + count > cap then return {0, math.max(0, cap - used)} end
local next = redis.call('INCRBY', KEYS[1], count)
redis.call('EXPIRE', KEYS[1], ARGV[3])
return {1, math.max(0, cap - next)}
`;

export async function getWechatFreeAiRemaining(userId: string) {
  const redis = await getRedisClient();
  const used = Number(await redis.get(quotaKey(userId)) || 0);
  if (!Number.isFinite(used) || used < 0) throw new Error('Invalid free quota counter');
  return Math.max(0, WECHAT_FREE_LIMITS.aiImportsMonthly - used);
}

export async function consumeWechatFreeAiQuota(userId: string, count: number) {
  if (!Number.isSafeInteger(count) || count <= 0) {
    return { success: false, remaining: 0, message: '使用次数必须是正整数' };
  }
  try {
    const redis = await getRedisClient();
    const result = await redis.eval(CONSUME_SCRIPT, {
      keys: [quotaKey(userId)],
      arguments: [String(count), String(WECHAT_FREE_LIMITS.aiImportsMonthly), String(40 * 86400)],
    }) as number[];
    if (!Array.isArray(result) || result.length !== 2) throw new Error('Invalid free quota response');
    return {
      success: result[0] === 1,
      remaining: Number(result[1]),
      message: result[0] === 1 ? '免费额度使用成功' : '本月免费智能导入额度已用完，下月自动恢复',
    };
  } catch (error) {
    console.error('[wechat-free/quota] unavailable:', error);
    return { success: false, remaining: 0, message: '免费额度服务暂不可用，请稍后重试' };
  }
}
