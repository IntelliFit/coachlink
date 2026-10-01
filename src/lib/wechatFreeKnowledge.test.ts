import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ free: true, userId: 'u' as string | null, published: true }));
vi.mock('@/lib/wechatFreeRelease', () => ({ isWechatFreeRequest: async () => mocks.free }));
vi.mock('@/lib/auth', () => ({ getAuthUser: async () => ({ userId: mocks.userId, isAuthenticated: !!mocks.userId, user: { is_admin: false } }) }));
vi.mock('@/lib/supabaseClient', () => {
  const db = { from: (table: string) => {
    let publishedOnly = false;
    const query: any = {
      select: () => query, eq: (key: string, value: unknown) => { if (key === 'is_published' && value === true) publishedOnly = true; return query; },
      contains: () => query, limit: () => query, or: () => query,
      order: async () => ({ data: [], error: null }),
      single: async () => ({ data: table === 'knowledge_books' && (!publishedOnly || mocks.published)
        ? { id: 'book', title: 'book', is_free: false, is_published: mocks.published, content: 'licensed body', audio_url: 'audio' }
        : null, error: null }),
    };
    return query;
  } };
  return { default: db, serviceRoleSupabase: db };
});
import { GET } from '@/app/api/knowledge/books/[id]/route';

describe('free platform knowledge access boundaries', () => {
  beforeEach(() => { mocks.free = true; mocks.userId = 'u'; mocks.published = true; });
  const request = new Request('http://localhost/api/knowledge/books/book');
  const context = { params: Promise.resolve({ id: 'book' }) };
  it('opens published books without creating a membership', async () => {
    const response = await GET(request, context);
    expect((await response.json()).data).toMatchObject({ hasAccess: true, book: { content: 'licensed body', audio_url: 'audio' } });
  });
  it('does not expose unpublished books to a free user', async () => {
    mocks.published = false;
    expect((await GET(request, context)).status).toBe(404);
  });
  it('still requires authentication', async () => {
    mocks.userId = null;
    expect((await GET(request, context)).status).toBe(401);
  });
  it('keeps the paywall and removes body/audio for unentitled Web requests', async () => {
    mocks.free = false;
    const payload = await (await GET(request, context)).json();
    expect(payload.data.hasAccess).toBe(false);
    expect(payload.data.book.audio_url).toBeNull();
    expect(payload.data.book.content).not.toBe('licensed body');
  });
});
