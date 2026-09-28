import { getBeijingDayStart, toBeijingDateKey } from './beijingTime'

/** A date selected by a person is a calendar date, not an arbitrary timestamp. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00+08:00`)
  return Number.isFinite(parsed.getTime()) && toBeijingDateKey(parsed) === value
}

export function validatePerformedOn(value: unknown, earliest?: string | null, now = new Date()) {
  if (!isCalendarDate(value)) return '请选择有效的实际训练日期'
  if (value > toBeijingDateKey(now)) return '不能补记未来的训练'
  if (earliest && value < toBeijingDateKey(earliest)) return '训练日期不能早于这份计划的开始日期'
  return null
}

export function executionTrainingTimestamp(execution: any): string | null {
  if (isCalendarDate(execution?.performed_on)) return getBeijingDayStart(execution.performed_on).toISOString()
  return execution?.completed_at || null
}

/** Suggestions are evidence, never automatic confirmation of the planned date. */
export function suggestPerformedOn(execution: any): string {
  const completed = executionTrainingTimestamp(execution)
  if (completed) return toBeijingDateKey(completed)
  const started = new Date(execution?.started_at || '').getTime()
  const saved = new Date(execution?.last_saved_at || '').getTime()
  if (Number(execution?.completed_sets || 0) > 0 && saved >= started && saved <= started + 5 * 3600000) {
    return toBeijingDateKey(saved)
  }
  return ''
}

export type RecordPlanCompletionInput = {
  instanceId: string
  dayIndex: number
  performedOn: string
  executionId?: string
  expectedUpdatedAt?: string
  requestId: string
}

export function createCompletionRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const n = Math.floor(Math.random() * 16)
    return (char === 'x' ? n : (n & 3) | 8).toString(16)
  })
}
