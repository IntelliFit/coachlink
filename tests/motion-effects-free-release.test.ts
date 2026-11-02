import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WECHAT_FREE_RELEASE_HEADER, WECHAT_FREE_RELEASE_ID, isWechatPurchasePaused } from '@coachlink/core';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  from: vi.fn(),
  publishTask: vi.fn(),
  storageInfo: vi.fn(),
  signedUpload: vi.fn(),
}));

vi.mock('@/app/api/auth/[...nextauth]/auth', () => ({ getServerSession: mocks.session }));
vi.mock('@/lib/taskqueue/factory', () => ({ publishTask: mocks.publishTask }));
vi.mock('@/lib/supabaseClient', () => {
  const client = {
    from: mocks.from,
    storage: { from: () => ({ info: mocks.storageInfo, createSignedUploadUrl: mocks.signedUpload }) },
  };
  return { default: client, serviceRoleSupabase: client };
});

const FREE_HEADERS = { [WECHAT_FREE_RELEASE_HEADER]: WECHAT_FREE_RELEASE_ID };

function chain(result: unknown, record?: (method: string, args: unknown[]) => void) {
  const query: any = new Proxy({}, {
    get(_target, key) {
      if (key === 'then') return (resolve: (value: unknown) => void) => resolve(result);
      if (key === 'single' || key === 'maybeSingle') return () => Promise.resolve(result);
      return (...args: unknown[]) => {
        record?.(String(key), args);
        return query;
      };
    },
  });
  return query;
}

function uploadRequest(path: string, overrides: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api/toolbox/motion-effects/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.9', ...headers },
    body: JSON.stringify({
      originalFilename: 'hands.mp4',
      contentType: 'video/mp4',
      fileSizeBytes: 1024,
      durationSeconds: 5,
      ...overrides,
    }),
  });
}

describe('motion effects are free on every client', () => {
  let inserted: Record<string, any> | null;

  beforeEach(() => {
    vi.clearAllMocks();
    inserted = null;
    process.env.MOTION_EFFECTS_COMMERCE_SECRET = 'test-secret';
    mocks.signedUpload.mockResolvedValue({ data: { token: 'upload-token' }, error: null });
    mocks.session.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.from.mockImplementation(() => chain(
      { data: { id: 'job-1', status: 'awaiting_upload', payment_status: 'free' }, error: null, count: 0 },
      (method, args) => { if (method === 'insert') inserted = args[0] as Record<string, any>; },
    ));
  });

  it('keeps the mini-program entry open while the old paid paths stay paused', () => {
    expect(isWechatPurchasePaused('/api/toolbox/motion-effects/free-upload-url')).toBe(false);
    expect(isWechatPurchasePaused('/api/toolbox/motion-effects/create-upload-url')).toBe(true);
    expect(isWechatPurchasePaused('/api/toolbox/motion-effects/jobs/id/order')).toBe(true);
  });

  it('asks the mini-program user to sign in first', async () => {
    mocks.session.mockResolvedValue(null);
    const { POST } = await import('@/app/api/toolbox/motion-effects/free-upload-url/route');
    expect((await POST(uploadRequest('free-upload-url'))).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each([
    ['mini-program', 'free-upload-url', () => import('@/app/api/toolbox/motion-effects/free-upload-url/route')],
    ['Web and APP', 'create-upload-url', () => import('@/app/api/toolbox/motion-effects/create-upload-url/route')],
  ])('creates a free job with the chosen quality from %s', async (_name, path, load) => {
    const { POST } = await load();
    const response = await POST(uploadRequest(path, { exportQuality: 'hd', queueTier: 'priority' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(inserted).toMatchObject({
      payment_status: 'free',
      price_cents: 0,
      export_quality: 'hd',
      queue_tier: 'standard',
    });
    expect(body.data.prices).toEqual({ standardCents: 0, hdCents: 0, priorityAddonCents: 0 });
  }, 30_000);

  it('quotes zero so installed APPs and stale pages skip checkout', async () => {
    const { GET } = await import('@/app/api/toolbox/motion-effects/quote/route');
    const body = await (await GET(new Request('http://localhost/x'))).json();
    expect(body.data.prices).toEqual({ standardCents: 0, hdCents: 0, priorityAddonCents: 0 });
  });

  it('no longer creates orders', async () => {
    const { POST } = await import('@/app/api/toolbox/motion-effects/jobs/[id]/order/route');
    const response = await POST(
      new Request('http://localhost/x', { method: 'POST' }),
      { params: Promise.resolve({ id: 'job-1' }) },
    );
    expect(response.status).toBe(410);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each([
    ['a job created as free', 'free', 'free'],
    ['an unpaid job from before the change', 'unpaid', 'free'],
    ['a paid job, which stays paid', 'paid', undefined],
  ])('enqueue queues %s without payment', async (_name, paymentStatus, written) => {
    const job = {
      id: 'job-1', user_id: 'user-1', status: 'awaiting_upload', payment_status: paymentStatus,
      export_quality: 'hd', queue_tier: 'standard', metadata: {},
      original_file_size_bytes: 100, input_storage_path: 'in.mp4',
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    };
    let update: Record<string, unknown> | null = null;
    mocks.storageInfo.mockResolvedValue({ data: { size: 100 }, error: null });
    mocks.publishTask.mockResolvedValue(undefined);
    const tables: string[] = [];
    mocks.from.mockImplementation((table: string) => {
      tables.push(table);
      return chain(
        { data: { ...job, status: 'queued' }, error: null, count: 0 },
        (method, args) => { if (method === 'update') update = args[0] as Record<string, unknown>; },
      );
    });
    mocks.from.mockImplementationOnce(() => chain({ data: job, error: null }));

    const { POST } = await import('@/app/api/toolbox/motion-effects/jobs/[id]/enqueue/route');
    const response = await POST(
      new Request('http://localhost/x', { method: 'POST', headers: FREE_HEADERS }),
      { params: Promise.resolve({ id: 'job-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.publishTask).toHaveBeenCalledTimes(1);
    expect(update).toMatchObject({ status: 'queued' });
    expect((update as unknown as Record<string, unknown>).payment_status).toBe(written);
    expect(tables).not.toContain('tool_motion_effect_free_exports');
  }, 30_000);
});
