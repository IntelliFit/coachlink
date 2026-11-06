import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PENDING_JOB_KEY,
  beatUploadHeartbeat,
  fetchViewerId,
  findRememberedJob,
  followMotionJob,
  forgetPendingJob,
  hasRememberedJob,
  holdUploadLock,
  isUploadingElsewhere,
  missingJobMeaning,
  motionFollowMessage,
  motionJobDetail,
  motionJobProgress,
  motionPollNote,
  parsePendingJob,
  pendingJobKey,
  readPendingJob,
  rememberPendingJob,
  type MotionJobFollowDeps,
  type PendingMotionJob,
} from '../src/app/toolbox/motion-effects/jobRestore';
import { motionRestorePlan as sharedPlan } from '@coachlink/core/src/motionEffectJobRestore';
import { motionRestorePlan as weappPlan } from '../apps/wechat/src/toolbox/motion-effects/jobRestore';

const GUEST: PendingMotionJob = { jobId: 'job-1', ownerToken: 'owner-token', userId: '' };
const ACCOUNT: PendingMotionJob = { jobId: 'job-1', ownerToken: '', userId: 'user-a' };

function job(status: string, extra: Record<string, unknown> = {}) {
  return { id: 'job-1', status, progress: 0, canDownload: false, errorMessage: null, ...extra };
}

function ok(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), { status: 200 });
}

function refused(status: number, message: string) {
  return new Response(JSON.stringify({ success: false, message, data: null }), { status });
}

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    get length() { return items.size; },
    key: (index: number) => [...items.keys()][index] ?? null,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

type Reply = Response | Error;

/** 按顺序回答页面发出的请求，并记下每一次请求，方便断言发了什么。 */
function stubFetch(replies: Reply[]) {
  const calls: { url: string; method: string; headers: Record<string, string>; cache?: string }[] = [];
  const queue = [...replies];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({
      url,
      method: init.method || 'GET',
      headers: (init.headers || {}) as Record<string, string>,
      cache: init.cache,
    });
    const reply = queue.shift();
    if (!reply) throw new Error(`no reply left for ${url}`);
    if (reply instanceof Error) throw reply;
    return reply;
  }));
  return calls;
}

function deps(overrides: Partial<MotionJobFollowDeps> = {}) {
  const seen: { status: string }[] = [];
  const retries: number[] = [];
  const sleeps: number[] = [];
  const merged: MotionJobFollowDeps = {
    isStale: () => false,
    onJob: (value) => seen.push(value),
    onRetrying: (failures) => retries.push(failures),
    getViewerId: async () => '',
    isUploadingElsewhere: async () => false,
    sleep: async (ms) => void sleeps.push(ms),
    ...overrides,
  };
  return { merged, seen, retries, sleeps };
}

describe('web motion effect pending job record', () => {
  it('reads what older pages saved, which had no account on it', () => {
    expect(parsePendingJob(JSON.stringify({ jobId: 'job-1', ownerToken: 'abc' }))).toEqual({
      jobId: 'job-1',
      ownerToken: 'abc',
      userId: '',
    });
  });

  it('reads the account a job was created under', () => {
    expect(parsePendingJob(JSON.stringify({ jobId: 'job-1', ownerToken: '', userId: 'user-a' }))?.userId).toBe('user-a');
  });

  it('ignores anything it cannot trust', () => {
    expect(parsePendingJob(null)).toBeNull();
    expect(parsePendingJob('')).toBeNull();
    expect(parsePendingJob('not json')).toBeNull();
    expect(parsePendingJob('null')).toBeNull();
    expect(parsePendingJob(JSON.stringify({ ownerToken: 'abc' }))).toBeNull();
    expect(parsePendingJob(JSON.stringify({ jobId: '' }))).toBeNull();
    expect(parsePendingJob(JSON.stringify({ jobId: 42 }))).toBeNull();
  });

  describe('in browser storage', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('remembers and reads back a job', () => {
      vi.stubGlobal('localStorage', memoryStorage());
      rememberPendingJob(GUEST);
      expect(readPendingJob('')).toEqual(GUEST);
    });

    it('only forgets the job it was told to, not a newer one', () => {
      vi.stubGlobal('localStorage', memoryStorage());
      rememberPendingJob({ ...GUEST, jobId: 'newer-job' });
      forgetPendingJob(GUEST);
      expect(readPendingJob('')?.jobId).toBe('newer-job');
      forgetPendingJob({ ...GUEST, jobId: 'newer-job' });
      expect(readPendingJob('')).toBeNull();
    });

    it("keeps one record per account, so a new job never replaces someone else's", () => {
      vi.stubGlobal('localStorage', memoryStorage());
      rememberPendingJob(ACCOUNT);
      rememberPendingJob({ jobId: 'guest-job', ownerToken: 'token', userId: '' });
      rememberPendingJob({ jobId: 'b-job', ownerToken: '', userId: 'user-b' });
      expect(readPendingJob('user-a')).toEqual(ACCOUNT);
      expect(readPendingJob('')?.jobId).toBe('guest-job');
      expect(readPendingJob('user-b')?.jobId).toBe('b-job');
      forgetPendingJob({ jobId: 'b-job', ownerToken: '', userId: 'user-b' });
      expect(readPendingJob('user-a')).toEqual(ACCOUNT);
    });

    it('still finds a record an older page saved under the plain key', () => {
      vi.stubGlobal('localStorage', memoryStorage({ [PENDING_JOB_KEY]: JSON.stringify({ jobId: 'job-1', ownerToken: 'abc' }) }));
      expect(readPendingJob('')?.ownerToken).toBe('abc');
      expect(hasRememberedJob()).toBe(true);
    });

    it('notices a record kept for an account', () => {
      vi.stubGlobal('localStorage', memoryStorage());
      expect(hasRememberedJob()).toBe(false);
      rememberPendingJob(ACCOUNT);
      expect(hasRememberedJob()).toBe(true);
    });

    it('keeps the page working when storage is blocked', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => { throw new Error('blocked'); },
        setItem: () => { throw new Error('blocked'); },
        removeItem: () => { throw new Error('blocked'); },
      });
      expect(() => rememberPendingJob(GUEST)).not.toThrow();
      expect(readPendingJob('')).toBeNull();
      expect(hasRememberedJob()).toBe(false);
      expect(() => forgetPendingJob(GUEST)).not.toThrow();
    });
  });
});

describe('web motion effect rules stay the same as the mini-program', () => {
  it('uses one shared plan', () => {
    expect(weappPlan).toBe(sharedPlan);
  });
});

describe('what a missing job means', () => {
  it('means gone when a guest token could not find it', () => {
    expect(missingJobMeaning(GUEST, '')).toBe('gone');
    expect(missingJobMeaning(GUEST, 'user-b')).toBe('gone');
  });

  it('asks for sign-in when the owner is signed out, since the server answers the same way', () => {
    expect(missingJobMeaning(ACCOUNT, '')).toBe('sign_in');
  });

  it('leaves the record alone for another account', () => {
    expect(missingJobMeaning(ACCOUNT, 'user-b')).toBe('other_account');
  });

  it('means gone when the owner itself cannot find it', () => {
    expect(missingJobMeaning(ACCOUNT, 'user-a')).toBe('gone');
  });

  it('trusts a signed-in answer for records saved before accounts were noted', () => {
    expect(missingJobMeaning({ jobId: 'job-1', ownerToken: '', userId: '' }, 'user-b')).toBe('gone');
    expect(missingJobMeaning({ jobId: 'job-1', ownerToken: '', userId: '' }, '')).toBe('sign_in');
  });
});

describe('what the page says about a job', () => {
  it('leaves room for the upload at the start of the progress bar and never overflows', () => {
    expect(motionJobProgress({ status: 'queued', progress: 0 })).toBe(35);
    expect(motionJobProgress({ status: 'processing', progress: 50 })).toBe(68);
    expect(motionJobProgress({ status: 'processing', progress: 400 })).toBe(100);
    expect(motionJobProgress({ status: 'processing', progress: -5 })).toBe(35);
    expect(motionJobProgress({ status: 'done', progress: 0 })).toBe(100);
  });

  it('shows how many jobs are ahead in the queue', () => {
    expect(motionJobDetail(job('queued', { queueInfo: { jobsAhead: 3 } }) as never)).toContain('前方还有 3 个');
  });

  it('tells the user they can leave while the video is generating', () => {
    expect(motionJobDetail(job('processing', { progress: 40 }) as never)).toContain('可以离开');
  });

  it('passes on why a job failed and has a fallback', () => {
    expect(motionJobDetail(job('failed', { errorMessage: '任务长时间没有进展' }) as never)).toBe('任务长时间没有进展');
    expect(motionJobDetail(job('failed') as never)).toContain('重新');
  });

  it('warns that results do not last', () => {
    expect(motionJobDetail(job('done', { canDownload: true }) as never)).toContain('24 小时');
    expect(motionJobDetail(job('expired') as never)).toContain('重新上传');
  });

  it('only mentions the network once failures keep happening', () => {
    expect(motionPollNote(1)).toBe('');
    expect(motionPollNote(2)).toBe('');
    expect(motionPollNote(3)).toContain('网络不稳定');
  });

  it('reports the end of a job generated on this page', () => {
    expect(motionFollowMessage({ outcome: 'done', job: job('done') as never })).toContain('可以直接下载');
    expect(motionFollowMessage({ outcome: 'ended', job: job('failed', { errorMessage: '生成失败了' }) as never })).toBe('生成失败了');
    expect(motionFollowMessage({ outcome: 'unreleasable', message: '不能取消' })).toBe('不能取消');
    expect(motionFollowMessage({ outcome: 'forgotten' })).toContain('不存在');
    expect(motionFollowMessage({ outcome: 'other_account' })).toContain('原账号');
    expect(motionFollowMessage({ outcome: 'released' })).toBe('');
    expect(motionFollowMessage({ outcome: 'sign_in' })).toBe('');
  });
});

describe('following a remembered job', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage({ [PENDING_JOB_KEY]: JSON.stringify(GUEST) }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('asks for the job with the owner token and without any cache', async () => {
    const calls = stubFetch([ok(job('done', { canDownload: true }))]);
    await followMotionJob(GUEST, deps().merged);
    expect(calls[0]).toMatchObject({
      url: '/api/toolbox/motion-effects/jobs/job-1',
      method: 'GET',
      cache: 'no-store',
      headers: { 'x-motion-owner-token': 'owner-token' },
    });
  });

  it('sends no owner token header for an account job', async () => {
    const calls = stubFetch([ok(job('done', { canDownload: true }))]);
    await followMotionJob(ACCOUNT, deps().merged);
    expect(calls[0].headers).toEqual({});
  });

  it('keeps polling and reporting a running job until it is done', async () => {
    const calls = stubFetch([
      ok(job('queued', { queueInfo: { jobsAhead: 2 } })),
      ok(job('processing', { progress: 40 })),
      ok(job('done', { canDownload: true, progress: 100 })),
    ]);
    const { merged, seen, sleeps } = deps();
    const result = await followMotionJob(GUEST, merged);
    expect(result.outcome).toBe('done');
    expect(seen.map((item) => item.status)).toEqual(['queued', 'processing', 'done']);
    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([1800, 1800]);
  });

  it('keeps the record of a finished video so a refresh still finds the download', async () => {
    stubFetch([ok(job('done', { canDownload: true }))]);
    const result = await followMotionJob(GUEST, deps().merged);
    expect(result.outcome).toBe('done');
    expect(readPendingJob('')).toEqual(GUEST);
  });

  it('forgets a finished video that can no longer be downloaded', async () => {
    stubFetch([ok(job('done', { canDownload: false }))]);
    const { merged, seen } = deps();
    expect((await followMotionJob(GUEST, merged)).outcome).toBe('forgotten');
    expect(readPendingJob('')).toBeNull();
    expect(seen).toEqual([]);
  });

  it.each(['failed', 'expired'])('reports a %s job once by clearing the record', async (status) => {
    stubFetch([ok(job(status, { errorMessage: '任务长时间没有进展' }))]);
    const { merged, seen } = deps();
    const result = await followMotionJob(GUEST, merged);
    expect(result.outcome).toBe('ended');
    expect(seen.map((item) => item.status)).toEqual([status]);
    expect(readPendingJob('')).toBeNull();
  });

  it('does not report a job the user cancelled as a failure', async () => {
    stubFetch([ok(job('failed', { errorMessage: '已取消' }))]);
    const { merged, seen } = deps();
    expect((await followMotionJob(GUEST, merged)).outcome).toBe('forgotten');
    expect(seen).toEqual([]);
    expect(readPendingJob('')).toBeNull();
  });

  it.each(['awaiting_upload', 'awaiting_payment'])('frees the job slot of a %s job that cannot be continued', async (status) => {
    const calls = stubFetch([ok(job(status)), ok(job('failed', { errorMessage: '已取消' }))]);
    const { merged, seen } = deps();
    expect((await followMotionJob(GUEST, merged)).outcome).toBe('released');
    expect(calls[1]).toMatchObject({
      url: '/api/toolbox/motion-effects/jobs/job-1/cancel',
      method: 'POST',
      headers: { 'x-motion-owner-token': 'owner-token' },
    });
    expect(readPendingJob('')).toBeNull();
    expect(seen).toEqual([]);
  });

  it('keeps following a job that got queued just before the cancel, which leaves it untouched', async () => {
    const calls = stubFetch([
      ok(job('awaiting_upload')),
      ok(job('queued')),
      ok(job('done', { canDownload: true })),
    ]);
    const { merged } = deps();
    expect((await followMotionJob(GUEST, merged)).outcome).toBe('done');
    expect(calls.map((call) => call.method)).toEqual(['GET', 'POST', 'GET']);
    expect(readPendingJob('')).toEqual(GUEST);
  });

  it('waits before asking again when the cancel left the job waiting for its upload', async () => {
    stubFetch([
      ok(job('awaiting_upload')),
      ok(job('awaiting_upload')),
      ok(job('failed', { errorMessage: '已取消' })),
    ]);
    const { merged, sleeps } = deps();
    expect((await followMotionJob(GUEST, merged)).outcome).toBe('forgotten');
    expect(sleeps).toEqual([1800]);
  });

  it('keeps the record when the cancel answers with a server error', async () => {
    stubFetch([
      ok(job('awaiting_upload')),
      refused(500, '取消失败，请稍后再试'),
      ok(job('awaiting_upload')),
      ok(job('failed', { errorMessage: '已取消' })),
    ]);
    const records: (PendingMotionJob | null)[] = [];
    const { merged } = deps({ onRetrying: () => records.push(readPendingJob('')) });
    expect((await followMotionJob(GUEST, merged)).outcome).toBe('released');
    expect(records).toEqual([GUEST]);
  });

  it('keeps the record and tries again when freeing the slot hits a network failure', async () => {
    const calls = stubFetch([
      ok(job('awaiting_upload')),
      new TypeError('Failed to fetch'),
      ok(job('awaiting_upload')),
      ok(job('failed', { errorMessage: '已取消' })),
    ]);
    const records: (PendingMotionJob | null)[] = [];
    const { merged } = deps({ onRetrying: () => records.push(readPendingJob('')) });
    expect((await followMotionJob(GUEST, merged)).outcome).toBe('released');
    expect(calls).toHaveLength(4);
    expect(records).toEqual([GUEST]);
    expect(readPendingJob('')).toBeNull();
  });

  it('drops the record when the job vanished before it could be freed', async () => {
    stubFetch([ok(job('awaiting_upload')), refused(404, '任务不存在')]);
    expect((await followMotionJob(GUEST, deps().merged)).outcome).toBe('forgotten');
    expect(readPendingJob('')).toBeNull();
  });

  it('stops trying when the server refuses to cancel, since that job frees itself', async () => {
    const message = '这个任务已发起付款，不能取消；未付款的话最多 1 小时后自动释放';
    const calls = stubFetch([ok(job('awaiting_payment')), refused(409, message)]);
    const result = await followMotionJob(GUEST, deps().merged);
    expect(result).toEqual({ outcome: 'unreleasable', message });
    expect(calls).toHaveLength(2);
    expect(readPendingJob('')).toBeNull();
  });

  it('never cancels a job another tab is still uploading', async () => {
    const calls = stubFetch([ok(job('awaiting_upload')), ok(job('queued')), ok(job('done', { canDownload: true }))]);
    const { merged, sleeps } = deps({ isUploadingElsewhere: async () => true });
    expect((await followMotionJob(GUEST, merged)).outcome).toBe('done');
    expect(calls.every((call) => call.method === 'GET')).toBe(true);
    expect(sleeps[0]).toBe(5000);
    expect(readPendingJob('')).toEqual(GUEST);
  });

  it('does not treat a failed poll as a failed job', async () => {
    const calls = stubFetch([
      ok(job('processing', { progress: 10 })),
      new TypeError('Failed to fetch'),
      refused(500, '服务器开小差了'),
      ok(job('done', { canDownload: true })),
    ]);
    const { merged, seen, retries, sleeps } = deps();
    expect((await followMotionJob(GUEST, merged)).outcome).toBe('done');
    expect(calls).toHaveLength(4);
    expect(seen.map((item) => item.status)).toEqual(['processing', 'done']);
    expect(retries).toEqual([1, 2]);
    expect(sleeps).toEqual([1800, 3600, 7200]);
    expect(readPendingJob('')).toEqual(GUEST);
  });

  it('keeps retrying a dead network from the first request without losing the record', async () => {
    stubFetch([new TypeError('Failed to fetch'), new TypeError('Failed to fetch'), ok(job('done', { canDownload: true }))]);
    const records: (PendingMotionJob | null)[] = [];
    const { merged } = deps({ onRetrying: () => records.push(readPendingJob('')) });
    await followMotionJob(GUEST, merged);
    expect(records).toEqual([GUEST, GUEST]);
  });

  it('never waits longer than the backoff cap', async () => {
    const failures = Array.from({ length: 8 }, () => new TypeError('Failed to fetch'));
    stubFetch([...failures, ok(job('done', { canDownload: true }))]);
    const { merged, sleeps } = deps();
    await followMotionJob(GUEST, merged);
    expect(Math.max(...sleeps)).toBe(15000);
  });

  it('forgets a guest job only when the server says it does not exist', async () => {
    stubFetch([refused(404, '任务不存在')]);
    expect((await followMotionJob(GUEST, deps().merged)).outcome).toBe('forgotten');
    expect(readPendingJob('')).toBeNull();
  });

  it('does not take a 404 from something other than our API as the job being gone', async () => {
    const calls = stubFetch([
      new Response('<html>404 Not Found</html>', { status: 404 }),
      ok(job('done', { canDownload: true })),
    ]);
    const { merged, retries } = deps();
    expect((await followMotionJob(GUEST, merged)).outcome).toBe('done');
    expect(calls).toHaveLength(2);
    expect(retries).toEqual([1]);
    expect(readPendingJob('')).toEqual(GUEST);
  });

  it('keeps an account job when the session ran out, and asks for sign-in', async () => {
    vi.stubGlobal('localStorage', memoryStorage({ [pendingJobKey('user-a')]: JSON.stringify(ACCOUNT) }));
    stubFetch([refused(404, '任务不存在')]);
    const { merged } = deps({ getViewerId: async () => '' });
    expect((await followMotionJob(ACCOUNT, merged)).outcome).toBe('sign_in');
    expect(readPendingJob('user-a')).toEqual(ACCOUNT);
  });

  it('keeps an account job when someone else is signed in', async () => {
    vi.stubGlobal('localStorage', memoryStorage({ [pendingJobKey('user-a')]: JSON.stringify(ACCOUNT) }));
    stubFetch([refused(404, '任务不存在')]);
    const { merged } = deps({ getViewerId: async () => 'user-b' });
    expect((await followMotionJob(ACCOUNT, merged)).outcome).toBe('other_account');
    expect(readPendingJob('user-a')).toEqual(ACCOUNT);
  });

  it('forgets an account job when its owner gets told it does not exist', async () => {
    vi.stubGlobal('localStorage', memoryStorage({ [pendingJobKey('user-a')]: JSON.stringify(ACCOUNT) }));
    stubFetch([refused(404, '任务不存在')]);
    const { merged } = deps({ getViewerId: async () => 'user-a' });
    expect((await followMotionJob(ACCOUNT, merged)).outcome).toBe('forgotten');
    expect(readPendingJob('user-a')).toBeNull();
  });

  it('keeps the record when it cannot tell who is signed in, and asks again', async () => {
    vi.stubGlobal('localStorage', memoryStorage({ [pendingJobKey('user-a')]: JSON.stringify(ACCOUNT) }));
    stubFetch([refused(404, '任务不存在'), ok(job('done', { canDownload: true }))]);
    const { merged, retries } = deps({ getViewerId: async () => { throw new Error('offline'); } });
    expect((await followMotionJob(ACCOUNT, merged)).outcome).toBe('done');
    expect(retries).toEqual([1]);
    expect(readPendingJob('user-a')).toEqual(ACCOUNT);
  });

  it('stops without touching anything once the page has moved on', async () => {
    let stale = false;
    const calls = stubFetch([ok(job('processing')), ok(job('awaiting_upload'))]);
    const { merged, seen } = deps({
      isStale: () => stale,
      sleep: async () => { stale = true; },
    });
    expect((await followMotionJob(GUEST, merged)).outcome).toBe('stopped');
    expect(calls).toHaveLength(1);
    expect(seen).toHaveLength(1);
    expect(readPendingJob('')).toEqual(GUEST);
  });

  it('ignores an answer that arrives after the page moved on', async () => {
    let stale = false;
    vi.stubGlobal('fetch', vi.fn(async () => {
      stale = true;
      return ok(job('failed', { errorMessage: '生成失败' }));
    }));
    const { merged, seen } = deps({ isStale: () => stale });
    expect((await followMotionJob(GUEST, merged)).outcome).toBe('stopped');
    expect(seen).toEqual([]);
    expect(readPendingJob('')).toEqual(GUEST);
  });
});

describe('asking who is signed in', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the account from the session', async () => {
    stubFetch([new Response(JSON.stringify({ user: { id: 'user-a' } }), { status: 200 })]);
    await expect(fetchViewerId()).resolves.toBe('user-a');
  });

  it('reads an empty session as signed out', async () => {
    stubFetch([new Response('{}', { status: 200 })]);
    await expect(fetchViewerId()).resolves.toBe('');
  });

  it('fails instead of pretending the user signed out', async () => {
    stubFetch([new Response('oops', { status: 502 })]);
    await expect(fetchViewerId()).rejects.toThrow();
    stubFetch([new TypeError('Failed to fetch')]);
    await expect(fetchViewerId()).rejects.toThrow();
  });
});

describe('finding the job to restore on page entry', () => {
  afterEach(() => vi.unstubAllGlobals());

  const GUEST_JOB: PendingMotionJob = { jobId: 'guest-job', ownerToken: 'token', userId: '' };

  function find(viewerId: string) {
    const { merged } = deps();
    return findRememberedJob({
      isStale: merged.isStale,
      getViewerId: async () => viewerId,
      onRetrying: merged.onRetrying,
      sleep: merged.sleep,
    });
  }

  it("picks the signed-in account's own job", async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    rememberPendingJob(ACCOUNT);
    rememberPendingJob(GUEST_JOB);
    await expect(find('user-a')).resolves.toEqual({ pending: ACCOUNT, signInJob: null });
  });

  it('falls back to a job this device made before signing in', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    rememberPendingJob(GUEST_JOB);
    await expect(find('user-a')).resolves.toEqual({ pending: GUEST_JOB, signInJob: null });
  });

  it('shows another account nothing and leaves its record alone', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    rememberPendingJob(ACCOUNT);
    await expect(find('user-b')).resolves.toEqual({ pending: null, signInJob: null });
    expect(readPendingJob('user-a')).toEqual(ACCOUNT);
  });

  it('asks a signed-out visitor to sign in without querying the job', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    rememberPendingJob(ACCOUNT);
    const calls = stubFetch([]);
    await expect(find('')).resolves.toEqual({ pending: null, signInJob: ACCOUNT });
    expect(calls).toEqual([]);
  });

  it("follows a guest job and still mentions the signed-out account's one", async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    rememberPendingJob(ACCOUNT);
    rememberPendingJob(GUEST_JOB);
    await expect(find('')).resolves.toEqual({ pending: GUEST_JOB, signInJob: ACCOUNT });
  });

  it('retries a failed session lookup instead of deciding the user signed out', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    rememberPendingJob(ACCOUNT);
    let attempts = 0;
    const { merged, retries, sleeps } = deps();
    const result = await findRememberedJob({
      isStale: merged.isStale,
      onRetrying: merged.onRetrying,
      sleep: merged.sleep,
      getViewerId: async () => {
        attempts += 1;
        if (attempts < 3) throw new Error('offline');
        return 'user-a';
      },
    });
    expect(result.pending).toEqual(ACCOUNT);
    expect(retries).toEqual([1, 2]);
    expect(sleeps).toEqual([3600, 7200]);
  });

  it('gives up quietly once the page has moved on', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    rememberPendingJob(ACCOUNT);
    const result = await findRememberedJob({ isStale: () => true, getViewerId: async () => 'user-a', onRetrying: () => {} });
    expect(result).toEqual({ pending: null, signInJob: null });
  });
});

describe('upload lock across tabs', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubLocks(available: boolean) {
    const request = vi.fn(async (_name: string, optionsOrWork: unknown, maybeWork?: unknown) => {
      const work = (maybeWork || optionsOrWork) as (lock: unknown) => unknown;
      return work(available ? { name: 'lock' } : null);
    });
    vi.stubGlobal('navigator', { locks: { request } });
    return request;
  }

  it('sees another tab holding the lock', async () => {
    stubLocks(false);
    expect(await isUploadingElsewhere()).toBe(true);
  });

  it('sees nobody uploading when the lock is free', async () => {
    stubLocks(true);
    expect(await isUploadingElsewhere()).toBe(false);
  });

  it('runs the work while holding the lock', async () => {
    const request = stubLocks(true);
    await expect(holdUploadLock(async () => 'finished')).resolves.toBe('finished');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('refuses to start a second upload instead of queueing behind the first', async () => {
    stubLocks(false);
    const work = vi.fn(async () => 'finished');
    await expect(holdUploadLock(work)).rejects.toThrow('另一个页面');
    expect(work).not.toHaveBeenCalled();
  });

  describe('in browsers without the locks API', () => {
    beforeEach(() => {
      vi.stubGlobal('navigator', {});
      vi.stubGlobal('localStorage', memoryStorage());
      vi.useFakeTimers();
    });

    afterEach(() => vi.useRealTimers());

    it('sees nobody uploading when no upload has reported in', async () => {
      expect(await isUploadingElsewhere()).toBe(false);
    });

    it('never cancels an upload that reported in recently', async () => {
      beatUploadHeartbeat();
      vi.advanceTimersByTime(29_000);
      expect(await isUploadingElsewhere()).toBe(true);
    });

    it('frees the slot once the upload has gone quiet', async () => {
      beatUploadHeartbeat();
      vi.advanceTimersByTime(31_000);
      expect(await isUploadingElsewhere()).toBe(false);
    });

    it('counts as uploading for the whole of the work, and stops as soon as it ends', async () => {
      let during = false;
      await expect(holdUploadLock(async () => {
        during = await isUploadingElsewhere();
        return 'finished';
      })).resolves.toBe('finished');
      expect(during).toBe(true);
      expect(await isUploadingElsewhere()).toBe(false);
    });

    it('stops counting as uploading when the work fails', async () => {
      await expect(holdUploadLock(async () => { throw new Error('upload failed'); })).rejects.toThrow('upload failed');
      expect(await isUploadingElsewhere()).toBe(false);
    });

    it('runs even when storage is blocked', async () => {
      vi.stubGlobal('localStorage', {
        getItem: () => { throw new Error('blocked'); },
        setItem: () => { throw new Error('blocked'); },
        removeItem: () => { throw new Error('blocked'); },
      });
      await expect(holdUploadLock(async () => 'finished')).resolves.toBe('finished');
      expect(await isUploadingElsewhere()).toBe(false);
    });
  });
});
