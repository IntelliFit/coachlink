import { describe, expect, it, vi } from 'vitest';
import {
  describePowerUploadFailure,
  isPowerUploadFatalError,
  powerUploadFatalError,
  retryPowerChunk,
  throwIfFatalPowerChunkStatus,
} from '../apps/wechat/src/toolbox/power-analysis/uploadRetry';

function sleeper() {
  const delays: number[] = [];
  return { delays, sleep: async (ms: number) => void delays.push(ms) };
}

describe('retryPowerChunk', () => {
  it('sends once when the first attempt succeeds', async () => {
    const send = vi.fn(async () => 'ok');
    const { delays, sleep } = sleeper();
    await expect(retryPowerChunk(send, { attempts: 4, sleep })).resolves.toBe('ok');
    expect(send).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it('retries the same chunk with growing waits until it gets through', async () => {
    const send = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('第 1 个视频分片传输不完整，请重试'))
      .mockRejectedValueOnce(new Error('request:fail timeout'))
      .mockResolvedValue('ok');
    const { delays, sleep } = sleeper();
    await expect(retryPowerChunk(send, { attempts: 4, sleep })).resolves.toBe('ok');
    expect(send).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([1000, 2000]);
  });

  it('gives up after the last attempt with the last error and no extra wait', async () => {
    const send = vi.fn(async () => {
      throw new Error(`attempt ${send.mock.calls.length}`);
    });
    const { delays, sleep } = sleeper();
    await expect(retryPowerChunk(send, { attempts: 3, sleep })).rejects.toThrow('attempt 3');
    expect(send).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([1000, 2000]);
  });

  it('stops immediately on an error retrying cannot fix', async () => {
    const send = vi.fn(async () => {
      throw powerUploadFatalError('任务状态已变化，请重新提交');
    });
    const { delays, sleep } = sleeper();
    await expect(retryPowerChunk(send, { attempts: 4, sleep })).rejects.toThrow('任务状态已变化');
    expect(send).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it('keeps the errMsg wx.request rejects with', async () => {
    const { sleep } = sleeper();
    await expect(
      retryPowerChunk(async () => Promise.reject({ errMsg: 'request:fail timeout' }), { attempts: 1, sleep }),
    ).rejects.toThrow('request:fail timeout');
    await expect(retryPowerChunk(async () => Promise.reject({}), { attempts: 1, sleep })).rejects.toThrow(
      '视频分片上传失败',
    );
  });
});

describe('throwIfFatalPowerChunkStatus', () => {
  it.each([401, 403, 404, 409, 410, 413])('treats %i as fatal', (status) => {
    let caught: unknown;
    try {
      throwIfFatalPowerChunkStatus(status, 'nope');
    } catch (error) {
      caught = error;
    }
    expect(isPowerUploadFatalError(caught)).toBe(true);
  });

  it.each([400, 408, 429, 500, 502, 503, 504])('lets %i be retried', (status) => {
    expect(() => throwIfFatalPowerChunkStatus(status, 'nope')).not.toThrow();
  });

  it('does not mark ordinary errors fatal', () => {
    expect(isPowerUploadFatalError(new Error('x'))).toBe(false);
    expect(isPowerUploadFatalError(null)).toBe(false);
  });
});

describe('describePowerUploadFailure', () => {
  it.each([
    '第 1 个视频分片传输不完整，请重试',
    '视频分片上传失败（502）',
    'request:fail timeout',
    'request:fail interrupted',
    '网络请求超时，请稍后重试',
    '第 2 个视频分片缺失',
    '视频写入不完整，请重新上传',
  ])('offers a one-tap re-upload for %s', (message) => {
    const prompt = describePowerUploadFailure(message);
    expect(prompt.retryable).toBe(true);
    if (prompt.retryable) {
      expect(prompt.content).toContain('重新上传');
      expect(prompt.content).toContain('不用重新选视频');
    }
  });

  it('gives network advice when the connection is the problem', () => {
    const prompt = describePowerUploadFailure('request:fail timeout');
    expect(prompt.retryable && prompt.content).toContain('Wi-Fi');
  });

  it.each([
    ['用户未登录', '用户未登录'],
    ['今天已经分析 3 次了，明天再来测一次', '今天已经分析 3 次了，明天再来测一次'],
    ['视频过大，当前最多支持 100MB', '视频过大，当前最多支持 100MB'],
    ['任务状态已变化，请重新提交', '任务状态已变化，请重新提交'],
    ['任务已过期，请重新上传', '任务已过期，请重新上传'],
    ['任务不存在', '任务不存在'],
    ['请上传有效的视频文件', '请上传有效的视频文件'],
  ])('passes %s through since re-uploading would not help', (message, shown) => {
    expect(describePowerUploadFailure(message)).toEqual({ retryable: false, message: shown });
  });

  it('asks for the video again when the local file cannot be read', () => {
    for (const message of ['读取视频分片失败', '视频分片读取不完整（应为 10，实际 5）', '视频临时文件尚未准备完成，请重新选择']) {
      expect(describePowerUploadFailure(message)).toEqual({
        retryable: false,
        message: '视频文件读取失败，请重新选择视频',
      });
    }
  });

  it('never shows an empty toast', () => {
    expect(describePowerUploadFailure('').retryable).toBe(true);
  });
});
