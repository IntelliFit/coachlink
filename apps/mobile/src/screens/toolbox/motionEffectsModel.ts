export type MotionEffectJobStatus = 'awaiting_payment' | 'awaiting_upload' | 'queued' | 'processing' | 'done' | 'failed' | 'expired'
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

export type ExportQuality = 'standard' | 'hd'
export type QueueTier = 'standard' | 'priority'
export type MotionSpeed = 'gentle' | 'balanced' | 'energetic'
export type GlowStrength = 'soft' | 'balanced' | 'strong'
export type SurfaceDensity = 'transparent' | 'balanced' | 'rich'
export type MotionEffectPrices = { standardCents: number; hdCents: number; priorityAddonCents: number }

export const DEFAULT_MOTION_PRICES: MotionEffectPrices = { standardCents: 290, hdCents: 490, priorityAddonCents: 190 }

/** 光膜风格和细节选项，与小程序 toolbox/motion-effects 一致。 */
export const MOTION_STYLE_OPTIONS = [
  { key: 'aurora', name: '极光流体', description: '青绿、蓝紫与粉色缓慢流动', colors: ['#35d7c0', '#5278f6', '#e762ce'] },
  { key: 'cyber', name: '赛博霓虹', description: '电蓝、紫罗兰和高亮品红', colors: ['#26bfff', '#7547ff', '#ff32bd'] },
  { key: 'lava', name: '熔岩脉冲', description: '金黄、橙红与深红热浪', colors: ['#ffcf45', '#ff6b2e', '#c91f37'] },
  { key: 'candy', name: '糖果派对', description: '蜜桃粉、柠檬黄与薄荷青', colors: ['#ff87b8', '#ffe35b', '#65dec5'] },
  { key: 'ice', name: '冰晶折射', description: '银白、浅蓝与冰紫色折射', colors: ['#eaf9ff', '#74d4ff', '#a69cff'] },
  { key: 'galaxy', name: '星云跃迁', description: '深蓝、星紫与玫红交替闪烁', colors: ['#315acb', '#854bc8', '#ed4f9d'] },
  { key: 'emerald', name: '翡翠能量', description: '祖母绿、湖蓝与荧光黄绿', colors: ['#22a56c', '#30bdb8', '#b1e541'] },
  { key: 'gold', name: '鎏金光幕', description: '香槟金、琥珀与暖白光带', colors: ['#fff0b3', '#d99c35', '#fff8e5'] },
]

export const MOTION_SPEED_OPTIONS: Array<{ value: MotionSpeed; label: string; description: string }> = [
  { value: 'gentle', label: '舒缓', description: '颜色和扫光移动更慢' },
  { value: 'balanced', label: '标准', description: '节奏自然，适合大多数视频' },
  { value: 'energetic', label: '动感', description: '颜色和扫光变化更快' },
]

export const GLOW_STRENGTH_OPTIONS: Array<{ value: GlowStrength; label: string; description: string }> = [
  { value: 'soft', label: '柔光', description: '边缘更克制' },
  { value: 'balanced', label: '均衡', description: '清晰但不过曝' },
  { value: 'strong', label: '高亮', description: '边缘光更醒目' },
]

export const SURFACE_DENSITY_OPTIONS: Array<{ value: SurfaceDensity; label: string; description: string }> = [
  { value: 'transparent', label: '通透', description: '保留更多原画面' },
  { value: 'balanced', label: '均衡', description: '光膜与画面平衡' },
  { value: 'rich', label: '浓郁', description: '膜面颜色更饱满' },
]

export function formatMotionPrice(cents: number) {
  return `¥${(cents / 100).toFixed(1)}`
}

/** 本次预计价格：注册账号首次标准导出免费；极速处理始终加价。 */
export function motionEffectPriceCents(params: { quality: ExportQuality; tier: QueueTier; prices: MotionEffectPrices; signupFreeAvailable: boolean }) {
  const { quality, tier, prices, signupFreeAvailable } = params
  const base = quality === 'hd' ? prices.hdCents : signupFreeAvailable ? 0 : prices.standardCents
  return base + (tier === 'priority' ? prices.priorityAddonCents : 0)
}

type MotionJobState = { status: MotionEffectJobStatus; paymentStatus?: string; canDownload?: boolean }

const AWAITING_STATUSES: MotionEffectJobStatus[] = ['awaiting_upload', 'awaiting_payment']

/** 重新打开页面时怎么接上上次的任务。付款相关的任务不能丢，否则钱付了却没有结果。 */
export type MotionRestorePlan = 'poll' | 'done' | 'retry' | 'confirmPayment' | 'resume' | 'release' | 'forget'

export function motionRestorePlan(job: MotionJobState, uploaded: boolean): MotionRestorePlan {
  if (job.status === 'queued' || job.status === 'processing') return 'poll'
  if (job.status === 'done') return job.canDownload ? 'done' : 'forget'
  if (job.status === 'expired') return 'forget'
  // 超时被释放的任务也可能在这之后才付款成功，先确认
  if (job.paymentStatus === 'pending') return 'confirmPayment'
  if (job.status === 'failed') return job.paymentStatus === 'paid' ? 'retry' : 'forget'
  if (job.paymentStatus === 'paid') return 'confirmPayment'
  return uploaded ? 'resume' : 'release'
}

export function shouldRememberMotionJob(job: MotionJobState) {
  if (job.status === 'failed') return job.paymentStatus === 'paid' || job.paymentStatus === 'pending'
  return job.status !== 'expired'
}

/** 已发起付款的任务不能放弃：服务端不让取消，用户也可能已经付了钱。 */
export function isMotionJobPaymentLocked(job: MotionJobState | null | undefined) {
  if (!job || !AWAITING_STATUSES.includes(job.status)) return false
  return job.paymentStatus === 'pending' || job.paymentStatus === 'paid'
}

export function canReleaseMotionJob(job: MotionJobState | null | undefined) {
  return Boolean(job) && AWAITING_STATUSES.includes((job as MotionJobState).status) && !isMotionJobPaymentLocked(job)
}
