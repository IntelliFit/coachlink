import { describe, expect, it, vi } from 'vitest';
vi.mock('@coachlink/core', async importOriginal => ({
  ...await importOriginal<typeof import('@coachlink/core')>(), WECHAT_FREE_RELEASE: false,
}));
import { WECHAT_FREE_RELEASE_HEADER, WECHAT_FREE_RELEASE_ID } from '@coachlink/core';
import { isWechatFreeRequest, rejectWechatPurchase } from './wechatFreeRelease';

describe('restoring a paid release is explicit', () => {
  it('restores paid policy for new clients but keeps old free clients unable to charge', async () => {
    const paid = new Request('http://localhost');
    const oldFree = new Request('http://localhost', { headers: { [WECHAT_FREE_RELEASE_HEADER]: WECHAT_FREE_RELEASE_ID } });
    expect(await isWechatFreeRequest(oldFree)).toBe(false);
    expect(rejectWechatPurchase(paid, { wechatOnly: true })).toBeNull();
    expect(rejectWechatPurchase(oldFree, { wechatOnly: true })?.status).toBe(403);
  });
});
