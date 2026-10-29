import { formatRestMinutes } from '@coachlink/core/src/restDisplay'
import { buildPlannedSetPreviews } from '@/utils/planSetPrescriptions'

export interface PlanDetailActionRow {
  key: string
  name: string
  /** e.g. "3 × 8-10" or "3 组" */
  volume: string
  /** e.g. "休息 90 秒 · RPE 6-7" */
  meta: string
}

export interface PlanDetailDay {
  dayIndex: number
  isRest: boolean
  note: string
  actions: PlanDetailActionRow[]
}

const DAYS_PER_WEEK = 7

function formatRest(seconds?: number | null) {
  const minutes = formatRestMinutes(seconds)
  return minutes ? `休息 ${minutes}` : ''
}

function uniqueText(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)))
}

function resolveActionName(actionSet: any) {
  return String(
    actionSet?.actionName || actionSet?.action_name || actionSet?.setName || actionSet?.set_name || ''
  ).trim() || '未命名动作'
}

function toActionRow(actionSet: any, key: string): PlanDetailActionRow {
  const previews = buildPlannedSetPreviews(actionSet)
  const reps = uniqueText(previews.map((set) => set.planned_reps))
  const intensities = uniqueText(previews.map((set) => set.planned_intensity))
  const loads = uniqueText(previews.map((set) => set.planned_weight))
  const isStrength = String(actionSet?.itemType || actionSet?.item_type || 'STRENGTH').toUpperCase() === 'STRENGTH'
  const setCount = isStrength ? previews.length : 1

  const repsText = reps.join(' / ')
  const volume = isStrength
    ? (repsText ? `${setCount} × ${repsText}` : `${setCount} 组`)
    : repsText || '按计划'

  return {
    key,
    name: resolveActionName(actionSet),
    volume,
    meta: [
      loads.join(' / '),
      intensities.join(' / '),
      formatRest(previews[0]?.planned_rest_seconds)
    ].filter(Boolean).join(' · ')
  }
}

export function toPlanDetailDays(trainingDays: any[]): PlanDetailDay[] {
  return (trainingDays || []).map((day: any, index: number) => {
    const dayIndex = Number(day?.dayIndex) || index + 1
    const isRest = String(day?.type || 'training') === 'rest'
    const actionSets: any[] = Array.isArray(day?.actionSets) ? day.actionSets : []
    return {
      dayIndex,
      isRest,
      note: String(day?.note || '').trim(),
      actions: isRest ? [] : actionSets.map((set, setIndex) => toActionRow(set, `${dayIndex}-${setIndex}`))
    }
  })
}

export function weekOfDay(dayIndex: number) {
  return Math.max(1, Math.ceil(dayIndex / DAYS_PER_WEEK))
}

export function countWeeks(days: PlanDetailDay[], declaredWeeks?: number | null) {
  const fromDays = days.reduce((max, day) => Math.max(max, weekOfDay(day.dayIndex)), 0)
  return Math.max(1, fromDays || Number(declaredWeeks) || 1)
}
