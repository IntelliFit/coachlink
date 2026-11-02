import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  from: vi.fn(),
  signedUpload: vi.fn(),
}));

vi.mock('@/app/api/auth/[...nextauth]/auth', () => ({ getServerSession: mocks.session }));
vi.mock('@/lib/taskqueue/factory', () => ({ publishTask: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => {
  const client = {
    from: mocks.from,
    storage: {
      from: () => ({
        remove: async () => ({ data: null, error: null }),
        createSignedUploadUrl: mocks.signedUpload,
      }),
    },
  };
  return { default: client, serviceRoleSupabase: client };
});

function chain(result: unknown) {
  const query: any = new Proxy({}, {
    get(_target, key) {
      if (key === 'then') return (resolve: (value: unknown) => void) => resolve(result);
      if (key === 'single' || key === 'maybeSingle') return () => Promise.resolve(result);
      return () => query;
    },
  });
  return query;
}

const JOB = {
  id: 'job-1',
  user_id: 'user-1',
  status: 'awaiting_upload',
  payment_status: 'free',
  payment_order_id: null,
  input_storage_path: 'in.mp4',
  expires_at: new Date(Date.now() + 3_600_000).toISOString(),
};

async function cancel() {
  const { POST } = await import('@/app/api/toolbox/motion-effects/jobs/[id]/cancel/route');
  return POST(new Request('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: 'job-1' }) });
}

/** 依次回答路由对 tool_video_render_jobs 的每次查询或更新。 */
function answerQueries(...results: unknown[]) {
  results.forEach((result) => mocks.from.mockImplementationOnce(() => chain(result)));
}

describe('cancelling a motion effect job', () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.session.mockResolvedValue({ user: { id: 'user-1' } });
    process.env.MOTION_EFFECTS_COMMERCE_SECRET = 'test-secret';
  });

  it('frees the slot of a job that never finished uploading', async () => {
    answerQueries(
      { data: JOB, error: null },
      { data: { ...JOB, status: 'failed', error_message: '已取消' }, error: null },
    );
    const response = await cancel();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.status).toBe('failed');
  }, 30_000);

  it('reports a database failure as a server error the client can retry, without leaking it', async () => {
    answerQueries(
      { data: JOB, error: null },
      { data: null, error: { message: 'connection to db.internal refused' } },
    );
    const response = await cancel();
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.message).not.toContain('db.internal');
  });

  it('hands back the job when it got queued between the read and the update', async () => {
    answerQueries(
      { data: JOB, error: null },
      { data: null, error: null },
      { data: { ...JOB, status: 'queued' }, error: null },
    );
    const response = await cancel();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.status).toBe('queued');
  });

  it('still refuses a job that started a payment, since that one frees itself', async () => {
    answerQueries({ data: { ...JOB, status: 'awaiting_payment', payment_order_id: 'order-1' }, error: null });
    const response = await cancel();
    expect(response.status).toBe(409);
  });
});

describe('creating a motion effect job', () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.signedUpload.mockResolvedValue({ data: { token: 'upload-token' }, error: null });
    process.env.MOTION_EFFECTS_COMMERCE_SECRET = 'test-secret';
    mocks.from.mockImplementation(() => chain({ data: JOB, error: null, count: 0 }));
  });

  async function create() {
    const { POST } = await import('@/app/api/toolbox/motion-effects/create-upload-url/route');
    const response = await POST(new Request('http://localhost/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.9' },
      body: JSON.stringify({ originalFilename: 'hands.mp4', contentType: 'video/mp4', fileSizeBytes: 1024, durationSeconds: 5 }),
    }));
    return response.json();
  }

  it('tells the page which account owns the job, so it files the record under that account', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'user-1' } });
    const body = await create();
    expect(body.data.ownerUserId).toBe('user-1');
    expect(body.data.ownerToken).toBeUndefined();
  }, 30_000);

  it('gives a guest an owner token and no account', async () => {
    mocks.session.mockResolvedValue(null);
    const body = await create();
    expect(body.data.ownerUserId).toBeNull();
    expect(body.data.ownerToken).toBeTruthy();
  });
});
