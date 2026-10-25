import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  viewerId: null as string | null,
  view: vi.fn(),
}));

vi.mock('@/lib/getApiUserId', () => ({ getApiUserId: async () => mocks.viewerId }));
vi.mock('@/lib/bojiScores', () => ({ getBojiChallengeView: (...args: unknown[]) => mocks.view(...args) }));

import { GET } from './route';

const ID = '11111111-1111-4111-8111-111111111111';

function get(id = ID) {
  return GET(new Request(`http://localhost/api/toolbox/boji/challenge/${id}`) as any, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  mocks.viewerId = null;
  mocks.view.mockReset();
});

describe('GET /api/toolbox/boji/challenge/[id]', () => {
  it('returns the card and passes the viewer', async () => {
    mocks.viewerId = 'owner';
    mocks.view.mockResolvedValue({ card: { id: ID }, isOwner: true, responses: [] });
    const res = await get();
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ card: { id: ID }, isOwner: true });
    expect(mocks.view).toHaveBeenCalledWith({ id: ID, viewerId: 'owner' });
  });

  it('returns 404 for an unknown PK', async () => {
    mocks.view.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });

  it('returns 500 without leaking the error', async () => {
    mocks.view.mockRejectedValue(new Error('secret db detail'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await get();
      expect(res.status).toBe(500);
      expect(JSON.stringify(await res.json())).not.toContain('secret');
    } finally {
      spy.mockRestore();
    }
  });
});
