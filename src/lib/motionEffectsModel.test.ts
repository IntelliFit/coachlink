import {
  getMotionEffectProgress,
  getMotionEffectStatusText,
  validateMotionEffectVideo,
} from '../../apps/mobile/src/screens/toolbox/motionEffectsModel'

describe('mobile motion effects model', () => {
  const limits = { maxVideoSizeMb: 100, maxDurationSeconds: 30, dailyLimit: 5 }

  it('accepts a video exactly at the configured boundaries', () => {
    expect(validateMotionEffectVideo({ size: 100 * 1024 * 1024, durationSeconds: 30 }, limits)).toBe('')
  })

  it('rejects missing, oversized, and overlong videos with actionable messages', () => {
    expect(validateMotionEffectVideo({ size: 0, durationSeconds: 10 }, limits)).toContain('视频大小')
    expect(validateMotionEffectVideo({ size: 100 * 1024 * 1024 + 1, durationSeconds: 10 }, limits)).toBe('视频需小于 100MB')
    expect(validateMotionEffectVideo({ size: 1024, durationSeconds: 30.1 }, limits)).toBe('视频需小于 30 秒')
  })

  it('maps upload and cloud job progress without overflowing the progress bar', () => {
    expect(getMotionEffectProgress({ phase: 'creating', uploadProgress: 0 })).toBe(5)
    expect(getMotionEffectProgress({ phase: 'uploading', uploadProgress: 134 })).toBe(100)
    expect(getMotionEffectProgress({ phase: 'queued', uploadProgress: 100, jobStatus: 'queued', jobProgress: 0 })).toBe(5)
    expect(getMotionEffectProgress({ phase: 'queued', uploadProgress: 100, jobStatus: 'processing', jobProgress: 140 })).toBe(99)
    expect(getMotionEffectProgress({ phase: 'done', uploadProgress: 100, jobStatus: 'done', jobProgress: 100 })).toBe(100)
  })

  it('provides precise recovery-friendly status copy', () => {
    expect(getMotionEffectStatusText({ phase: 'uploading', uploadProgress: 42.4 })).toBe('正在上传 42%')
    expect(getMotionEffectStatusText({ phase: 'queued', uploadProgress: 100, jobStatus: 'processing', jobProgress: 67.8 })).toBe('正在生成 68%')
    expect(getMotionEffectStatusText({ phase: 'done', uploadProgress: 100, jobStatus: 'failed' })).toBe('生成失败')
  })
})
