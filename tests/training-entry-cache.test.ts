import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const memory = vi.hoisted(() => new Map<string, any>());
vi.mock('@tarojs/taro', () => ({ default: {
  getStorageSync: (key: string) => memory.get(key),
  setStorageSync: (key: string, value: any) => memory.set(key, value),
  removeStorageSync: (key: string) => memory.delete(key),
} }));
vi.mock('@/services/authService', () => ({ authService: { getAuthSession: () => ({ userId: 'student' }) } }));
vi.mock('@/utils/todayTrainingPageCache', async () => import('../apps/wechat/src/utils/todayTrainingPageCache'));
import { getExecutionCacheRevision, patchExecutionInTodayTrainingPageCache, readTodayTrainingPageCache, removeExecutionFromTodayTrainingPageCache, TODAY_TRAINING_PAGE_CACHE_KEY } from '../apps/wechat/src/utils/todayTrainingPageCache';
import { persistTrainingExecutionSnapshot, readTrainingExecutionSnapshot, syncTrainingExecutionToStorage } from '../apps/wechat/src/utils/trainingExecutionCache';
const now = new Date('2026-10-08T01:00:00Z');
const instance = { id: 'plan', start_date: '2026-09-01', training_days: [{ dayIndex: 1, type: 'training' }, { dayIndex: 2, type: 'training' }] };
const finished = { id: 'done', day_index: 1, status: 'completed', completed_at: '2026-10-05T08:00:00Z' };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now); memory.clear();
  memory.set(TODAY_TRAINING_PAGE_CACHE_KEY, { v: 1, userId: 'student', savedAt: now.getTime(), coachSubscriptions: [],
    coachPlanDataBySubId: {}, selfInstance: instance, selfActions: {}, selfDayIndex: 1, selfTodayCompleted: false,
    selfCompletionDates: {}, selfExecutionsByDayIndex: {}, selfMissingDays: [], planMode: 'self', selectedDayIndex: 1 });
});
afterEach(() => { memory.clear(); vi.useRealTimers(); });
describe('actual mini-program cache writes (in-memory storage, no account mutation)', () => {
  it('completion updates self pointer and actual date in the same write', () => {
    const revision = getExecutionCacheRevision();
    patchExecutionInTodayTrainingPageCache('student', 'plan', 1, finished);
    const cache = readTodayTrainingPageCache('student')!;
    expect(cache.selfDayIndex).toBe(2); expect(cache.selfCompletionDates[1]).toBe(finished.completed_at);
    expect(cache.selfTodayCompleted).toBe(false); expect(getExecutionCacheRevision()).toBeGreaterThan(revision);
  });
  it('completion updates the matching coach only', () => {
    const current = memory.get(TODAY_TRAINING_PAGE_CACHE_KEY);
    current.selfInstance = null;
    current.coachPlanDataBySubId = { a: { instance, dayIndex: 1, executionsByDayIndex: {} },
      b: { instance: { ...instance, id: 'other' }, dayIndex: 1, executionsByDayIndex: {} } };
    patchExecutionInTodayTrainingPageCache('student', 'plan', 1, finished);
    const cache = readTodayTrainingPageCache('student')!;
    expect(cache.coachPlanDataBySubId.a.dayIndex).toBe(2); expect(cache.coachPlanDataBySubId.b.dayIndex).toBe(1);
  });
  it('preview cannot replace an actual completion in homepage cache', () => {
    patchExecutionInTodayTrainingPageCache('student', 'plan', 1, finished);
    patchExecutionInTodayTrainingPageCache('student', 'plan', 1, { id: 'preview-1', status: 'preview' });
    expect(readTodayTrainingPageCache('student')!.selfExecutionsByDayIndex[1].id).toBe('done');
  });
  it('ignores another account and expired caches', () => {
    patchExecutionInTodayTrainingPageCache('other', 'plan', 1, finished);
    expect(readTodayTrainingPageCache('student')!.selfDayIndex).toBe(1);
    vi.setSystemTime(new Date(now.getTime() + 61 * 86400000));
    expect(readTodayTrainingPageCache('student')).toBeNull();
  });
  it('cancellation invalidates pre-mutation responses and removes only its execution', () => {
    patchExecutionInTodayTrainingPageCache('student', 'plan', 1, { id: 'active', day_index: 1, status: 'in_progress' });
    const revision = getExecutionCacheRevision();
    removeExecutionFromTodayTrainingPageCache('student', 'plan', 1);
    expect(readTodayTrainingPageCache('student')!.selfExecutionsByDayIndex[1]).toBeUndefined();
    expect(getExecutionCacheRevision()).toBeGreaterThan(revision);
  });
  it('prewarm cannot erase a record, but fresh cloud absence can replace stale snapshot', () => {
    const key = 'plan:plan:1';
    persistTrainingExecutionSnapshot('student', key, { execution: finished });
    persistTrainingExecutionSnapshot('student', key, { execution: { id: 'preview-1', status: 'preview' } });
    expect(readTrainingExecutionSnapshot('student', key)!.execution.id).toBe('done');
    syncTrainingExecutionToStorage({ userId: 'student', scopeKey: key, instanceId: 'plan', dayIndex: 1,
      isImpromptuMode: false, execution: { id: 'preview-1', status: 'preview' } });
    expect(readTrainingExecutionSnapshot('student', key)!.execution.status).toBe('preview');
  });
});
