import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ storage: new Map<string, any>(), request: vi.fn(), reLaunch: vi.fn(), api: 'http://127.0.0.1:3003', env: 'develop' }));
vi.mock('@tarojs/taro', () => ({ default: {
  getStorageSync: (key: string) => mock.storage.get(key),
  setStorageSync: (key: string, value: any) => mock.storage.set(key, value),
  removeStorageSync: (key: string) => mock.storage.delete(key),
  request: mock.request, reLaunch: mock.reLaunch,
} }));
vi.mock('@/utils/apiBaseUrl', () => ({ resolveApiBaseUrl: () => mock.api, readMiniProgramEnvVersion: () => mock.env }));
vi.mock('@/utils/todayTrainingPageCache', () => ({ TODAY_TRAINING_PAGE_CACHE_KEY: 'today_training_page_cache_v1' }));
vi.mock('@/utils/trainingExecutionCache', () => ({ SNAPSHOT_KEY: 'training_execution_snapshots_v1' }));
import { canUseLocalDebugLogin, getLocalDebugSession, loginLocalDebugUser, exitLocalDebugLogin } from '../apps/wechat/src/services/localDebugService';
const result = (id: string) => ({ statusCode: 200, data: { success: true, data: {
  user: { id, name: id }, token: `cldev.${id}`, debug: { userId: id, name: id, expiresAt: Date.now() + 3600000 },
} } });
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'development'); mock.api = 'http://127.0.0.1:3003'; mock.env = 'develop';
  mock.storage.clear(); mock.request.mockReset(); mock.reLaunch.mockReset().mockResolvedValue({});
  mock.storage.set('user', { id: 'original' }); mock.storage.set('token', 'original-token');
  mock.storage.set('theme', 'dark');
});
afterEach(() => { vi.unstubAllEnvs(); mock.storage.clear(); });
describe('mini local debug account isolation', () => {
  it.each(['trial', 'release'])('hides and disables entry on %s', async env => {
    mock.env = env; expect(canUseLocalDebugLogin()).toBe(false);
    await expect(loginLocalDebugUser('target', 'pair')).rejects.toThrow();
    expect(mock.request).not.toHaveBeenCalled();
  });
  it('does not expose entry in production or on remote API', () => {
    vi.stubEnv('NODE_ENV', 'production'); expect(canUseLocalDebugLogin()).toBe(false);
    vi.stubEnv('NODE_ENV', 'development'); mock.api = 'https://dev.coachlink.fit'; expect(canUseLocalDebugLogin()).toBe(false);
  });
  it('keeps original account on failed pairing', async () => {
    mock.request.mockResolvedValue({ statusCode: 403, data: { success: false, message: '配对失败' } });
    await expect(loginLocalDebugUser('target', 'bad')).rejects.toThrow('配对失败');
    expect(mock.storage.get('token')).toBe('original-token'); expect(getLocalDebugSession()).toBeNull();
  });
  it('refuses a response for the wrong account', async () => {
    mock.request.mockResolvedValue(result('wrong'));
    await expect(loginLocalDebugUser('target', 'pair')).rejects.toThrow();
    expect(mock.storage.get('user').id).toBe('original');
  });
  it('switches with fresh training caches and restores original after multiple targets', async () => {
    mock.storage.set('today_training_page_cache_v1', { userId: 'original' });
    mock.storage.set('training_execution_snapshots_v1', { userId: 'original' });
    mock.request.mockResolvedValueOnce(result('first')).mockResolvedValueOnce(result('second'));
    await loginLocalDebugUser('first', 'pair');
    expect(mock.storage.has('today_training_page_cache_v1')).toBe(false);
    expect(mock.storage.has('training_execution_snapshots_v1')).toBe(false);
    await loginLocalDebugUser('second', 'pair'); expect(getLocalDebugSession()?.userId).toBe('second');
    await exitLocalDebugLogin();
    expect(mock.storage.get('user').id).toBe('original'); expect(mock.storage.get('token')).toBe('original-token');
    expect(mock.storage.get('theme')).toBe('dark'); expect(getLocalDebugSession()).toBeNull();
    expect([...mock.storage.keys()].some(key => key.includes('local_debug'))).toBe(false);
  });
  it('also restores after expired session cleared the active auth', async () => {
    mock.request.mockResolvedValue(result('target')); await loginLocalDebugUser('target', 'pair');
    mock.storage.delete('token'); mock.storage.delete('user'); await exitLocalDebugLogin();
    expect(mock.storage.get('token')).toBe('original-token');
  });
});
