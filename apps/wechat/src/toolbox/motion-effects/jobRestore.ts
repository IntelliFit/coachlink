// 小程序没有任务列表，退出页面后只能靠本地记下的任务 id 找回生成中的视频。

export {
  isMotionJobGone,
  motionRestoreNotice,
  motionRestorePlan,
} from '@coachlink/core/src/motionEffectJobRestore'
export type {
  MotionJobRestoreState,
  MotionRestorePlan,
} from '@coachlink/core/src/motionEffectJobRestore'

export interface RememberedMotionJob {
  v: 1
  jobId: string
  uploaded: boolean
}

export function parseRememberedMotionJob(value: unknown): RememberedMotionJob | null {
  if (!value || typeof value !== 'object') return null
  const stored = value as { v?: unknown; jobId?: unknown; uploaded?: unknown }
  if (stored.v !== 1 || typeof stored.jobId !== 'string' || !stored.jobId) return null
  return { v: 1, jobId: stored.jobId, uploaded: stored.uploaded === true }
}
