/**
 * Per-set weight unit. `actual_weight` / `planned_weight` always stay in kg so volume, e1RM,
 * PR and rankings keep working; `weight_unit` + `weight_input` remember what the student saw.
 */
export type SetWeightUnit = 'kg' | 'lbs'

export const LBS_PER_KG = 2.20462262
const KG_PER_LB = 0.45359237

export function normalizeWeightUnit(value: unknown): SetWeightUnit {
  return String(value ?? '').trim().toLowerCase() === 'lbs' ? 'lbs' : 'kg'
}

export function isWeightUnit(value: unknown): value is SetWeightUnit {
  return value === 'kg' || value === 'lbs'
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** Canonical kg value (2 decimals) for a number typed in `unit`. */
export function toKg(value: number, unit: SetWeightUnit): number {
  return unit === 'lbs' ? roundTo(value * KG_PER_LB, 2) : value
}

/** Number to show in `unit` for a canonical kg value (1 decimal for lbs). */
export function fromKg(kg: number, unit: SetWeightUnit): number {
  return unit === 'lbs' ? roundTo(kg * LBS_PER_KG, 1) : kg
}

export function weightUnitLabel(unit: SetWeightUnit): string {
  return unit === 'lbs' ? '磅' : 'kg'
}

/** Accepts numbers and plan strings such as "9.07kg". Anything else (e.g. "5RM") is null. */
function parseKg(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const match = String(value ?? '').trim().match(/^(-?\d+(?:\.\d+)?)\s*(?:kg|公斤)?$/i)
  return match ? Number(match[1]) : null
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * The number and unit to display for a recorded or planned set. Historical sets (no unit) are kg.
 * The stored input is used only while it still matches the canonical kg value.
 */
export function getSetDisplayWeight(
  set: any,
  field: 'actual' | 'planned' = 'actual',
): { value: number; unit: SetWeightUnit } | null {
  const camel = field === 'actual' ? 'actualWeight' : 'plannedWeight'
  const kg = parseKg(set?.[`${field}_weight`] ?? set?.[camel])
  if (kg === null) return null
  const prefix = field === 'actual' ? 'weight' : 'planned_weight'
  const camelPrefix = field === 'actual' ? 'weight' : 'plannedWeight'
  const unit = normalizeWeightUnit(set?.[`${prefix}_unit`] ?? set?.[`${camelPrefix}Unit`])
  if (unit === 'kg') return { value: kg, unit }
  const input = parseNumber(set?.[`${prefix}_input`] ?? set?.[`${camelPrefix}Input`])
  if (input !== null && Math.abs(toKg(input, 'lbs') - kg) < 0.05) return { value: input, unit }
  return { value: fromKg(kg, unit), unit }
}

/**
 * Unit fields a new (extra) set inherits from the set whose weight it copies, so adding a set
 * to a lbs exercise keeps showing lbs. Empty for kg and for sets without a concrete weight.
 */
export function inheritedPlannedWeightUnit(set: any): Record<string, any> {
  const hasActual = parseKg(set?.actual_weight ?? set?.actualWeight) !== null
  const shown = getSetDisplayWeight(set, hasActual ? 'actual' : 'planned')
  return shown && shown.unit === 'lbs'
    ? { planned_weight_unit: 'lbs', planned_weight_input: shown.value }
    : {}
}
