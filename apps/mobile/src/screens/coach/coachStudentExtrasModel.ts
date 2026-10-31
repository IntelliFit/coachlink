/**
 * 学员档案里的自动化单独设置、计划历史和订阅周期，与小程序 coach/students/detail 一致。
 */

export type AutomationOverride = {
  initialPlanMode: string | null
  feedbackAdjustmentMode: string | null
  nextPhaseMode: string | null
  riskGuardMode: string | null
}

export type AutomationOverrideKey = keyof AutomationOverride

export const AUTOMATION_FIELDS: Array<{ key: AutomationOverrideKey; label: string; options: Array<{ value: string; label: string }> }> = [
  { key: 'initialPlanMode', label: '首个计划', options: [
    { value: '', label: '继承全局' },
    { value: 'auto_publish', label: '自动发放' },
    { value: 'draft', label: '生成草稿' },
    { value: 'off', label: '关闭' },
  ] },
  { key: 'feedbackAdjustmentMode', label: '反馈调整', options: [
    { value: '', label: '继承全局' },
    { value: 'draft_notify', label: '草稿并通知' },
    { value: 'auto_apply_low_risk', label: '低风险自动应用' },
    { value: 'auto_apply_safe', label: '安全反馈自动应用' },
    { value: 'off', label: '关闭' },
  ] },
  { key: 'nextPhaseMode', label: '下一阶段', options: [
    { value: '', label: '继承全局' },
    { value: 'draft_notify', label: '提醒教练' },
    { value: 'auto_publish_if_credits', label: '额度足够自动发布' },
    { value: 'off', label: '关闭' },
  ] },
  { key: 'riskGuardMode', label: '风险保护', options: [
    { value: '', label: '继承全局' },
    { value: 'strict', label: '严格' },
    { value: 'normal', label: '普通' },
  ] },
]

export const EMPTY_AUTOMATION_OVERRIDE: AutomationOverride = {
  initialPlanMode: null,
  feedbackAdjustmentMode: null,
  nextPhaseMode: null,
  riskGuardMode: null,
}

export function normalizeAutomationOverride(row: any): AutomationOverride {
  return {
    initialPlanMode: row?.initial_plan_mode ?? null,
    feedbackAdjustmentMode: row?.feedback_adjustment_mode ?? null,
    nextPhaseMode: row?.next_phase_mode ?? null,
    riskGuardMode: row?.risk_guard_mode ?? null,
  }
}

/** 「继承全局」存 null。 */
export function automationOverridePayload(subscriptionId: string, value: AutomationOverride) {
  return {
    subscriptionId,
    initialPlanMode: value.initialPlanMode || null,
    feedbackAdjustmentMode: value.feedbackAdjustmentMode || null,
    nextPhaseMode: value.nextPhaseMode || null,
    riskGuardMode: value.riskGuardMode || null,
  }
}

export type PlanHistorySource = 'all' | 'coach' | 'student'

export const PLAN_HISTORY_SOURCES: Array<{ value: PlanHistorySource; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'coach', label: '教练计划' },
  { value: 'student', label: '学员自建' },
]

export const PLAN_HISTORY_PAGE_SIZE = 5

export function planSourceLabel(source?: string | null) {
  if (source === 'student' || source === 'self') return '学员自建'
  if (source === 'coach') return '教练计划'
  if (source === 'ai') return 'AI 生成'
  return '计划'
}

export function planStatusLabel(status?: string | null) {
  if (status === 'active') return '进行中'
  if (status === 'paused') return '已暂停'
  if (status === 'completed') return '已完成'
  if (status === 'archived') return '已归档'
  if (status === 'scheduled') return '待开始'
  return status || '-'
}

export function normalizeWeeks(value: string, fallback = 0) {
  return Math.max(0, Math.floor(Number(value) || fallback))
}
