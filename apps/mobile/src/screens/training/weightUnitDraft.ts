import { fromKg, getSetDisplayWeight, normalizeWeightUnit, toKg, type SetWeightUnit } from '@coachlink/core/src/weightUnit'

/**
 * 每组 kg / 磅 切换，与小程序 training-execution switchWeightUnit 一致：
 * actual_weight 始终存 kg，磅数另存 weightUnit + weightInput，显示时按学员当时选的单位。
 */

export const WEIGHT_UNITS: SetWeightUnit[] = ['kg', 'lbs']

function parseWeight(text: string): number | null {
  const trimmed = String(text ?? '').trim().replace(',', '.')
  if (!trimmed) return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

function roundTyped(value: number) {
  return Math.round(value * 10) / 10
}

function parseFirstNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const match = String(value).match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

/** 计划重量是不是具体数值；「9RM」「75%」这类强度写法不能当成公斤数预填（与小程序 isConcreteWeightValue 一致）。 */
export function isConcreteWeightValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'number') return Number.isFinite(value)
  const text = String(value).trim().toLowerCase()
  if (!text || text.includes('rm') || text.includes('%')) return false
  return parseFirstNumber(text) !== null
}

/**
 * 输入框初始值，与小程序 getSetWeightDefault 一致：已记录的按记录时的单位显示；
 * 未记录的只在计划是具体重量时预填（按计划单位），RM / 百分比留空。
 */
export function initialWeightDraft(set: any): { weight: string; weightUnit: SetWeightUnit } {
  if (set?.actualWeight !== null && set?.actualWeight !== undefined && set?.actualWeight !== '') {
    const shown = getSetDisplayWeight(set, 'actual')
    if (shown) return { weight: String(shown.value), weightUnit: shown.unit }
  }
  const plannedUnit: SetWeightUnit = normalizeWeightUnit(set?.plannedWeightUnit)
  if (!isConcreteWeightValue(set?.plannedWeight)) return { weight: '', weightUnit: plannedUnit }
  const planned = getSetDisplayWeight(set, 'planned')
  if (planned) return { weight: String(planned.value), weightUnit: planned.unit }
  // 「60-70kg」这类区间取第一个数（与小程序 parseFirstNumber 一致）
  return { weight: String(parseFirstNumber(set?.plannedWeight)), weightUnit: 'kg' }
}

/** 切换单位时把已输入的数字换算过去；没填就保持空。 */
export function convertDraftWeight(text: string, from: SetWeightUnit, to: SetWeightUnit): string {
  if (from === to) return text
  const value = parseWeight(text)
  if (value === null) return text
  return String(roundTyped(to === 'lbs' ? fromKg(value, 'lbs') : toKg(value, 'lbs')))
}

/**
 * 完成组时提交的重量字段。自重 / 无负重（0）不带单位，避免把「0 磅」记成有负重。
 */
export function weightSubmission(text: string, unit: SetWeightUnit): {
  actualWeight: number | null
  weightUnit?: SetWeightUnit
  weightInput?: number
} {
  const value = parseWeight(text)
  if (value === null) return { actualWeight: null }
  if (value === 0) return { actualWeight: 0 }
  return { actualWeight: unit === 'lbs' ? toKg(value, 'lbs') : value, weightUnit: unit, weightInput: value }
}
