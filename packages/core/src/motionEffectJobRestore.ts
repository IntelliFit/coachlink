/**
 * Finger-light-film job restore rules shared by the Web page and the mini-program.
 * The server lets one account or device hold one job and has no job list, so a client
 * finds its job again from an id it saved locally.
 */

export interface MotionJobRestoreState {
  status: string
  canDownload?: boolean
  errorMessage?: string | null
}

export type MotionRestorePlan = 'poll' | 'done' | 'resume' | 'release' | 'notice' | 'forget'

export function motionRestorePlan(job: MotionJobRestoreState, uploaded: boolean): MotionRestorePlan {
  if (job.status === 'queued' || job.status === 'processing') return 'poll'
  if (job.status === 'done') return job.canDownload ? 'done' : 'forget'
  if (job.status === 'awaiting_upload' || job.status === 'awaiting_payment') {
    // 没传完的任务接不上，也不能留着：服务端同时只放行一个任务
    return uploaded ? 'resume' : 'release'
  }
  if (job.status === 'failed') return job.errorMessage === '已取消' ? 'forget' : 'notice'
  if (job.status === 'expired') return 'notice'
  return 'forget'
}

/** 只有服务端明确说任务不存在才忘记；断网和登录失效时任务还在，下次还要接上。 */
export function isMotionJobGone(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return message.includes('任务不存在') || /\b404\b/.test(message)
}

export function motionRestoreNotice(job: MotionJobRestoreState) {
  if (job.status === 'queued' || job.status === 'processing') return '上次的视频还在生成'
  if (job.status === 'done') return '上次的视频已经生成好了'
  if (job.status === 'failed') return '上次的视频没有生成成功'
  if (job.status === 'expired') return '上次的视频已过期'
  return '上次的视频已上传，还没开始生成'
}
