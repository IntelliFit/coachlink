/**
 * Plan days that already have a workout record are history. Workout rows only
 * store `day_index`, so changing what sits at a past index (deleting or
 * inserting days before it, switching training/rest, swapping exercises)
 * silently re-attaches old workouts to different content, rewinds the strict
 * progress pointer and changes which days are charged. Parameters such as
 * sets, reps, load or notes may still be edited.
 */

export type PlanEditLockDay = {
  dayIndex?: number | string | null
  day_index?: number | string | null
  type?: string | null
  actionSets?: any[] | null
  action_sets?: any[] | null
}

export type PlanEditLockExecution = {
  day_index?: number | string | null
  status?: string | null
}

export type LockedPlanDayViolation = {
  dayIndex: number
  reason: 'missing' | 'type_changed' | 'actions_changed'
}

export const PLAN_EDIT_LOCKING_STATUSES: readonly string[] = [
  'completed',
  'abandoned',
  'in_progress',
  'timed_out',
  'paused'
]

export function getPlanDayIndex(day: PlanEditLockDay | null | undefined): number {
  const value = Number(day?.dayIndex ?? day?.day_index ?? 0)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/** Highest plan day that has a workout record; 0 when nothing is locked. */
export function getLockedThroughDayIndex(executions: PlanEditLockExecution[] | null | undefined): number {
  return (executions || []).reduce((max, execution) => {
    const status = String(execution?.status || '').trim().toLowerCase()
    if (!PLAN_EDIT_LOCKING_STATUSES.includes(status)) return max
    const dayIndex = Number(execution?.day_index ?? 0)
    return Number.isFinite(dayIndex) && dayIndex > max ? Math.floor(dayIndex) : max
  }, 0)
}

export function isPlanDayLocked(dayIndex: number, lockedThroughDayIndex: number): boolean {
  return lockedThroughDayIndex > 0 && dayIndex >= 1 && dayIndex <= lockedThroughDayIndex
}

const isOneFilter = (set: any) => set?.type === 'one-filter' && Array.isArray(set?.actions)

// The same exercise is stored differently by different editors: the id may sit
// in action_id, actionId or params, and an editor may fill in an id it resolved
// from the exercise name. Compare ids when both sides have one, names when
// neither has, and treat "only one side has an id" as undecidable (equal).
const actionIdOf = (set: any) =>
  String(set?.action_id ?? set?.actionId ?? set?.params?.action_id ?? set?.params?.actionId ?? '').trim()

const actionNameOf = (set: any) => String(
  set?.action_name ?? set?.set_name ?? set?.actionName ?? set?.setName ?? set?.name ??
  set?.params?.action_name ?? set?.params?.actionName ?? set?.params?.setName ?? set?.params?.name ??
  set?.params?.['动作名称'] ?? ''
).trim().replace(/\s+/g, ' ').toLowerCase()

function isSameActionSet(left: any, right: any): boolean {
  if (isOneFilter(left) || isOneFilter(right)) {
    return isOneFilter(left) && isOneFilter(right) && isSameActionList(left.actions, right.actions)
  }
  const leftId = actionIdOf(left)
  const rightId = actionIdOf(right)
  if (leftId && rightId) return leftId === rightId
  if (leftId || rightId) return true
  const leftName = actionNameOf(left)
  const rightName = actionNameOf(right)
  return !leftName || !rightName || leftName === rightName
}

function isSameActionList(left: any[], right: any[]): boolean {
  return left.length === right.length && left.every((set, index) => isSameActionSet(set, right[index]))
}

const dayKind = (day: PlanEditLockDay) =>
  String(day?.type ?? 'training').trim().toLowerCase() === 'rest' ? 'rest' : 'training'

const actionSetsOf = (day: PlanEditLockDay) =>
  Array.isArray(day?.actionSets) ? day.actionSets : Array.isArray(day?.action_sets) ? day.action_sets : []

/** Same kind of day with the same exercises in the same order; parameters are ignored. */
export function isSamePlanDayStructure(left: PlanEditLockDay, right: PlanEditLockDay): boolean {
  return dayKind(left) === dayKind(right) && isSameActionList(actionSetsOf(left), actionSetsOf(right))
}

const byDayIndex = <T extends PlanEditLockDay>(days: T[] | null | undefined) =>
  new Map((days || []).map((day) => [getPlanDayIndex(day), day] as const))

export function findLockedPlanDayViolation(params: {
  savedDays: PlanEditLockDay[] | null | undefined
  nextDays: PlanEditLockDay[] | null | undefined
  lockedThroughDayIndex: number
}): LockedPlanDayViolation | null {
  const { lockedThroughDayIndex } = params
  if (lockedThroughDayIndex <= 0) return null
  const nextByIndex = byDayIndex(params.nextDays)
  const lockedSaved = (params.savedDays || [])
    .filter((day) => isPlanDayLocked(getPlanDayIndex(day), lockedThroughDayIndex))
    .sort((left, right) => getPlanDayIndex(left) - getPlanDayIndex(right))

  for (const savedDay of lockedSaved) {
    const dayIndex = getPlanDayIndex(savedDay)
    const nextDay = nextByIndex.get(dayIndex)
    if (!nextDay) return { dayIndex, reason: 'missing' }
    if (dayKind(savedDay) !== dayKind(nextDay)) return { dayIndex, reason: 'type_changed' }
    if (!isSamePlanDayStructure(savedDay, nextDay)) return { dayIndex, reason: 'actions_changed' }
  }
  return null
}

/**
 * Keep every locked day as saved unless only its parameters changed, and take
 * everything after the lock from the edited days. Inputs are not mutated.
 */
export function mergeLockedPlanDays<T extends PlanEditLockDay>(params: {
  savedDays: T[] | null | undefined
  nextDays: T[] | null | undefined
  lockedThroughDayIndex: number
}): { days: T[]; restoredDayIndexes: number[] } {
  const { lockedThroughDayIndex } = params
  const nextDays = params.nextDays || []
  if (lockedThroughDayIndex <= 0) return { days: nextDays, restoredDayIndexes: [] }

  const nextByIndex = byDayIndex(nextDays)
  const restoredDayIndexes: number[] = []
  const lockedDays = (params.savedDays || [])
    .filter((day) => isPlanDayLocked(getPlanDayIndex(day), lockedThroughDayIndex))
    .map((savedDay) => {
      const candidate = nextByIndex.get(getPlanDayIndex(savedDay))
      if (candidate && isSamePlanDayStructure(candidate, savedDay)) return candidate
      restoredDayIndexes.push(getPlanDayIndex(savedDay))
      return savedDay
    })
  const lockedIndexes = new Set(lockedDays.map(getPlanDayIndex))
  const days = [...lockedDays, ...nextDays.filter((day) => !lockedIndexes.has(getPlanDayIndex(day)))]
    .sort((left, right) => getPlanDayIndex(left) - getPlanDayIndex(right))

  return { days, restoredDayIndexes: restoredDayIndexes.sort((left, right) => left - right) }
}

export function describeLockedRange(lockedThroughDayIndex: number): string {
  return lockedThroughDayIndex <= 1 ? '第1天' : `第1–${lockedThroughDayIndex}天`
}

export function describeLockedPlanDayViolation(
  violation: LockedPlanDayViolation,
  lockedThroughDayIndex: number
): string {
  const day = `第${violation.dayIndex}天已有训练记录`
  const detail = violation.reason === 'missing'
    ? '，不能删除。'
    : violation.reason === 'type_changed'
      ? '，不能在训练日和休息日之间切换，也不能在它之前插入或删除天数。'
      : '，不能增删或调换动作。'
  return `${day}${detail}${describeLockedRange(lockedThroughDayIndex)}只能修改组数、次数、重量和备注；如需整体更换计划，请新建阶段。`
}
