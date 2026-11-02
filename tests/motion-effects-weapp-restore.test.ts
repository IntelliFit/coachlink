import { describe, expect, it } from 'vitest';
import {
  isMotionJobGone,
  motionRestoreNotice,
  motionRestorePlan,
  parseRememberedMotionJob,
} from '../apps/wechat/src/toolbox/motion-effects/jobRestore';

describe('mini-program motion effect job restore plan', () => {
  it('keeps following a job the worker still has', () => {
    expect(motionRestorePlan({ status: 'queued' }, true)).toBe('poll');
    expect(motionRestorePlan({ status: 'processing' }, true)).toBe('poll');
  });

  it('brings back a finished video only while it can still be downloaded', () => {
    expect(motionRestorePlan({ status: 'done', canDownload: true }, true)).toBe('done');
    expect(motionRestorePlan({ status: 'done', canDownload: false }, true)).toBe('forget');
  });

  it('lets the user start a video that finished uploading', () => {
    expect(motionRestorePlan({ status: 'awaiting_upload' }, true)).toBe('resume');
  });

  it('frees the one job slot when the upload never finished', () => {
    expect(motionRestorePlan({ status: 'awaiting_upload' }, false)).toBe('release');
  });

  it('tells the user once when the job ended while they were away', () => {
    expect(motionRestorePlan({ status: 'failed', errorMessage: '任务长时间没有进展，请重新上传' }, true)).toBe('notice');
    expect(motionRestorePlan({ status: 'expired' }, true)).toBe('notice');
  });

  it('does not report a job the user cancelled as a failure', () => {
    expect(motionRestorePlan({ status: 'failed', errorMessage: '已取消' }, true)).toBe('forget');
  });
});

describe('mini-program motion effect remembered job', () => {
  it('reads what the page stored', () => {
    expect(parseRememberedMotionJob({ v: 1, jobId: 'job-1', uploaded: true })).toEqual({
      v: 1,
      jobId: 'job-1',
      uploaded: true,
    });
  });

  it('treats a missing upload flag as not uploaded', () => {
    expect(parseRememberedMotionJob({ v: 1, jobId: 'job-1' })?.uploaded).toBe(false);
  });

  it('ignores anything it cannot trust', () => {
    expect(parseRememberedMotionJob(null)).toBeNull();
    expect(parseRememberedMotionJob('job-1')).toBeNull();
    expect(parseRememberedMotionJob({ v: 2, jobId: 'job-1', uploaded: true })).toBeNull();
    expect(parseRememberedMotionJob({ v: 1, jobId: '', uploaded: true })).toBeNull();
    expect(parseRememberedMotionJob({ v: 1, uploaded: true })).toBeNull();
  });
});

describe('mini-program motion effect job lookup errors', () => {
  it('forgets a job only when the server says it does not exist', () => {
    expect(isMotionJobGone(new Error('任务不存在'))).toBe(true);
    expect(isMotionJobGone(new Error('Request failed: 404'))).toBe(true);
  });

  it('keeps the job through network and login failures', () => {
    expect(isMotionJobGone(new Error('request:fail timeout'))).toBe(false);
    expect(isMotionJobGone(new Error('登录已过期，请重新登录'))).toBe(false);
    expect(isMotionJobGone(null)).toBe(false);
  });
});

describe('mini-program motion effect restore notice', () => {
  it('says where the restored job stands', () => {
    expect(motionRestoreNotice({ status: 'queued' })).toContain('还在生成');
    expect(motionRestoreNotice({ status: 'processing' })).toContain('还在生成');
    expect(motionRestoreNotice({ status: 'done' })).toContain('生成好了');
    expect(motionRestoreNotice({ status: 'awaiting_upload' })).toContain('已上传');
    expect(motionRestoreNotice({ status: 'failed' })).toContain('没有生成成功');
    expect(motionRestoreNotice({ status: 'expired' })).toContain('已过期');
  });
});
