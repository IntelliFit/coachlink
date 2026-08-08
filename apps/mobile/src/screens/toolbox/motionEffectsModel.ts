export type MotionEffectJobStatus = 'awaiting_upload' | 'queued' | 'processing' | 'done' | 'failed' | 'expired'
export type MotionEffectUploadPhase = 'idle' | 'creating' | 'uploading' | 'uploaded' | 'enqueueing' | 'queued' | 'done'

export type MotionEffectLimits = {
  maxVideoSizeMb: number
  maxDurationSeconds: number
  dailyLimit: number
}

export function validateMotionEffectVideo(
  video: { size: number; durationSeconds: number },
  limits: MotionEffectLimits,
) {
  if (!Number.isFinite(video.size) || video.size <= 0) return '无法读取视频大小，请重新选择视频'
  if (video.size > limits.maxVideoSizeMb * 1024 * 1024) return `视频需小于 ${limits.maxVideoSizeMb}MB`
  if (Number.isFinite(video.durationSeconds) && video.durationSeconds > limits.maxDurationSeconds) {
    return `视频需小于 ${limits.maxDurationSeconds} 秒`
  }
  return ''
}

export function getMotionEffectProgress(input: {
  phase: MotionEffectUploadPhase
  uploadProgress: number
  jobStatus?: MotionEffectJobStatus
  jobProgress?: number
}) {
  if (input.jobStatus === 'done') return 100
  if (input.jobStatus === 'queued' || input.jobStatus === 'processing') return Math.max(5, Math.min(99, input.jobProgress || 5))
  if (input.phase === 'uploaded' || input.phase === 'enqueueing') return 100
  if (input.phase === 'uploading') return Math.max(0, Math.min(100, input.uploadProgress))
  if (input.phase === 'creating') return 5
  return 0
}

export function getMotionEffectStatusText(input: {
  phase: MotionEffectUploadPhase
  uploadProgress: number
  jobStatus?: MotionEffectJobStatus
  jobProgress?: number
}) {
  if (input.phase === 'creating') return '正在创建临时任务'
  if (input.phase === 'uploading') return `正在上传 ${Math.round(input.uploadProgress)}%`
  if (input.phase === 'uploaded') return '上传完成，等待开始生成'
  if (input.phase === 'enqueueing') return '正在提交生成任务'
  if (input.jobStatus === 'queued') return '已进入生成队列'
  if (input.jobStatus === 'processing') return `正在生成 ${Math.round(input.jobProgress || 0)}%`
  if (input.jobStatus === 'done') return '特效视频已生成'
  if (input.jobStatus === 'failed') return '生成失败'
  if (input.jobStatus === 'expired') return '结果已过期'
  return '选择视频后会自动上传'
}
