import Taro from '@tarojs/taro'

const EXECUTION_PLAN_NOTICE_STORAGE_VERSION = 1
const EXECUTION_PLAN_NOTICE_PREFIX = `coachlink:execution-plan-notice:v${EXECUTION_PLAN_NOTICE_STORAGE_VERSION}`

interface ExecutionPlanNoticeKeyInput {
  instanceId?: string | null
  userId?: string | null
}

const safeSegment = (value?: string | null) => {
  const raw = String(value || '').trim()
  return raw || 'anonymous'
}

export function getExecutionPlanNoticeStorageKey({ instanceId, userId }: ExecutionPlanNoticeKeyInput) {
  return `${EXECUTION_PLAN_NOTICE_PREFIX}:${safeSegment(userId)}:${safeSegment(instanceId)}`
}

export function hasReadExecutionPlanNotice(input: ExecutionPlanNoticeKeyInput) {
  if (!input.instanceId) return false

  try {
    const value = Taro.getStorageSync(getExecutionPlanNoticeStorageKey(input))
    if (!value) return false
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return (
      parsed?.version === EXECUTION_PLAN_NOTICE_STORAGE_VERSION &&
      Number.isFinite(Number(parsed?.acknowledgedAt))
    )
  } catch {
    return false
  }
}

export function markExecutionPlanNoticeRead(input: ExecutionPlanNoticeKeyInput) {
  if (!input.instanceId) return

  try {
    Taro.setStorageSync(
      getExecutionPlanNoticeStorageKey(input),
      JSON.stringify({
        version: EXECUTION_PLAN_NOTICE_STORAGE_VERSION,
        acknowledgedAt: Date.now()
      })
    )
  } catch {
    // Best effort only. Storage failure should not block training.
  }
}
