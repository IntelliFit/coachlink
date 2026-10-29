/**
 * 计划编辑器里单天级别的不可变操作。周级操作（加周、复制周、删周）复用 planEditor.ts。
 */
import type { PlanActionSet, PlanItemType, PlanTrainingDay } from './planTypes'
import { createActionSet } from './planEditor'
import { ensureSetUids, getSetActionId, getSetRawName, normalizeDaysForSave } from './planSetFields'
import { normalizePlanDays } from './planEditor'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

function withCount(day: PlanTrainingDay): PlanTrainingDay {
  return { ...day, actionSetsCount: Array.isArray(day.actionSets) ? day.actionSets.length : 0 }
}

export function updateDay(days: PlanTrainingDay[], dayIndex: number, update: (day: PlanTrainingDay) => PlanTrainingDay): PlanTrainingDay[] {
  return days.map((day) => (day.dayIndex === dayIndex ? withCount(update(day)) : day))
}

export function setDayType(days: PlanTrainingDay[], dayIndex: number, type: 'training' | 'rest') {
  return updateDay(days, dayIndex, (day) => ({ ...day, type }))
}

export function addActionSet(days: PlanTrainingDay[], dayIndex: number, itemType: PlanItemType) {
  return updateDay(days, dayIndex, (day) => ({
    ...day,
    // 与小程序 handleAddActionSet 一致：给某天加任何内容都把它设为训练日。
    type: 'training',
    actionSets: [...(day.actionSets || []), createActionSet(itemType)],
  }))
}

export function replaceActionSet(days: PlanTrainingDay[], dayIndex: number, setIndex: number, next: PlanActionSet) {
  return updateDay(days, dayIndex, (day) => ({
    ...day,
    actionSets: (day.actionSets || []).map((set, index) => (index === setIndex ? next : set)),
  }))
}

export function removeActionSet(days: PlanTrainingDay[], dayIndex: number, setIndex: number) {
  return updateDay(days, dayIndex, (day) => ({
    ...day,
    actionSets: (day.actionSets || []).filter((_, index) => index !== setIndex),
  }))
}

export function moveActionSet(days: PlanTrainingDay[], dayIndex: number, setIndex: number, delta: -1 | 1) {
  return updateDay(days, dayIndex, (day) => {
    const sets = [...(day.actionSets || [])]
    const target = setIndex + delta
    if (target < 0 || target >= sets.length) return day
    const [moved] = sets.splice(setIndex, 1)
    sets.splice(target, 0, moved)
    return { ...day, actionSets: sets }
  })
}

/** 把一天的安排（类型、备注、动作）复制到另一天，目标天原有内容被覆盖。 */
export function copyDayTo(days: PlanTrainingDay[], fromDayIndex: number, toDayIndex: number) {
  const source = days.find((day) => day.dayIndex === fromDayIndex)
  if (!source || fromDayIndex === toDayIndex) return days
  return updateDay(days, toDayIndex, (day) => ({
    ...day,
    type: source.type,
    note: source.note || '',
    actionSets: clone(source.actionSets || []),
  }))
}

/** 保存前的整理：排序、补齐 actionSetsCount，并按小程序规则写齐字段别名（见 planSetFields.ts）。 */
export function finalizeDays(days: PlanTrainingDay[], lockedThroughDayIndex = 0) {
  return normalizeDaysForSave(days, { lockedThroughDayIndex })
}

/** 力量动作没选动作库条目时不能保存，否则执行端无法匹配 1RM 和历史。 */
export function findUnpickedStrength(days: PlanTrainingDay[]) {
  for (const day of days) {
    if (day.type === 'rest') continue
    const index = (day.actionSets || []).findIndex((set) => {
      const type = String(set.itemType || 'STRENGTH').toUpperCase()
      return type === 'STRENGTH' && !getSetActionId(set) && !getSetRawName(set)
    })
    if (index >= 0) return { dayIndex: day.dayIndex, setIndex: index }
  }
  return null
}

/** 从服务端、文本解析或 AI 草稿得到的训练日进入编辑器前统一走这里（排序 + 稳定键）。 */
export function prepareDaysForEditor(raw: unknown): PlanTrainingDay[] {
  return ensureSetUids(normalizePlanDays(raw as any[]))
}
