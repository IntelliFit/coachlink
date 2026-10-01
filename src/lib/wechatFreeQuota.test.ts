import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ client: { get: vi.fn(), eval: vi.fn() }, connect: vi.fn() }));
vi.mock('@/lib/redisClient', () => ({ getRedisClient: mocks.connect }));
import { consumeWechatFreeAiQuota, getWechatFreeAiRemaining } from './wechatFreeQuota';

describe('separate free AI budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T16:00:00.000Z'));
    mocks.connect.mockResolvedValue(mocks.client);
  });
  afterEach(() => vi.useRealTimers());
  it('reads the UTC+8 month without reading or writing membership balances', async () => {
    mocks.client.get.mockResolvedValue('7');
    expect(await getWechatFreeAiRemaining('user-one')).toBe(23);
    expect(mocks.client.get).toHaveBeenCalledWith('coachlink:wechat-free-v1:ai:2026-10:user-one');
  });
  it('uses a single atomic Redis script and a bounded TTL', async () => {
    mocks.client.eval.mockResolvedValue([1, 29]);
    expect(await consumeWechatFreeAiQuota('user-one', 1)).toMatchObject({ success: true, remaining: 29 });
    const [script, options] = mocks.client.eval.mock.calls[0];
    expect(script).toContain("redis.call('INCRBY'");
    expect(script).toContain('used + count > cap');
    expect(options).toEqual({ keys: ['coachlink:wechat-free-v1:ai:2026-10:user-one'], arguments: ['1', '30', '3456000'] });
  });
  it('does not suggest payment when the free allowance is exhausted', async () => {
    mocks.client.eval.mockResolvedValue([0, 0]);
    const result = await consumeWechatFreeAiQuota('user-one', 1);
    expect(result.success).toBe(false);
    expect(result.message).toContain('下月自动恢复');
    expect(result.message).not.toMatch(/购买|升级|会员/);
  });
  it.each([0, -1, 1.1, NaN, Infinity])('rejects invalid consumption %s', async count => {
    expect((await consumeWechatFreeAiQuota('user-one', count)).success).toBe(false);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
  it('fails closed when Redis is unavailable', async () => {
    mocks.connect.mockRejectedValue(new Error('offline'));
    expect(await consumeWechatFreeAiQuota('user-one', 1)).toMatchObject({ success: false, remaining: 0 });
  });
});
