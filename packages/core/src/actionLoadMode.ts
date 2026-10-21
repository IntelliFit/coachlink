import { buildPlannedSetPreviews } from './planSetPrescriptions'

/**
 * How a strength action is loaded when recording a set.
 * - weighted: the set records a kg value (external load or added load)
 * - bodyweight: the set records reps only; kg is stored as an explicit 0
 */
export type ActionLoadMode = 'weighted' | 'bodyweight'

export interface ActionLoadInput {
  name?: string | null
  type?: string | null
  attrs?: string[] | null
  enableAutoWeightCompute?: boolean | null
  enable_auto_weight_compute?: boolean | null
  enableautoweightcompute?: boolean | null
  includesBodyWeight?: boolean | null
}

// Names/attrs that imply external load. 单杠 is deliberately not matched (pull-up bar).
const EQUIPMENT_PATTERN = /哑铃|杠铃|壶铃|高脚杯|器械|绳索|龙门架|史密斯|负重|腿举|拉力器|药球|沙袋|杠片|悍马|T杠|EZ杆|卧推|硬拉|弯举|飞鸟|下拉|夹胸|蝴蝶机|坐姿推|挺举|抓举|高翻/i
const RELATIVE_INTENSITY_PATTERN = /\d\s*(?:RM\b|%)/i

const attrsOf = (action?: ActionLoadInput | null) =>
  Array.isArray(action?.attrs) ? action!.attrs!.map((attr) => String(attr)) : []

// Rows arrive camelCase from Supabase, snake_case from older APIs, lowercase from legacy views.
const isAutoComputeEnabled = (action: ActionLoadInput) =>
  [action.enableAutoWeightCompute, action.enable_auto_weight_compute, action.enableautoweightcompute]
    .find((value) => typeof value === 'boolean') === true

/**
 * Mirrors src/lib/oneRmEligibility.ts so the client never asks for a 1RM the
 * server would refuse to store. The generic 强度 attr alone is a parameter
 * field every copied strength action carries, not a sign the move is loaded.
 */
export function isOneRMEligibleAction(action?: ActionLoadInput | null): boolean {
  if (!action) return false
  const isStrength = String(action.type || 'STRENGTH').toUpperCase() === 'STRENGTH'
  return isStrength && attrsOf(action).includes('强度') && isAutoComputeEnabled(action)
}

/** True when any set of this plan action is prescribed as RM or %1RM (the only cases that consume a 1RM). */
export function usesRelativeIntensity(actionSet: any): boolean {
  const relative = actionSet?.params?.intensityConfig?.relativeIntensity
  if (relative && Number(relative.value) > 0 && /^(rm|percentage)$/i.test(String(relative.type || ''))) {
    return true
  }
  return buildPlannedSetPreviews(actionSet).some((set) =>
    RELATIVE_INTENSITY_PATTERN.test(String(set.planned_intensity || ''))
  )
}

const actionIdOf = (actionSet: any) => String(actionSet?.actionId || actionSet?.action_id || '').trim()

/** Action ids whose prescriptions in this plan actually depend on a 1RM. */
export function collectPlanOneRMActionIds(trainingDays: any[] | null | undefined): Set<string> {
  const ids = new Set<string>()
  const visit = (actionSet: any) => {
    if (actionSet?.type === 'one-filter' && Array.isArray(actionSet.actions)) {
      actionSet.actions.forEach(visit)
      return
    }
    const id = actionIdOf(actionSet)
    if (id && usesRelativeIntensity(actionSet)) ids.add(id)
  }
  ;(trainingDays || []).forEach((day: any) => {
    if (String(day?.type || 'training') === 'rest') return
    ;(Array.isArray(day?.actionSets) ? day.actionSets : []).forEach(visit)
  })
  return ids
}

const positiveKg = (value: unknown): boolean => {
  if (value === null || value === undefined) return false
  if (typeof value === 'number') return Number.isFinite(value) && value > 0
  const text = String(value).trim()
  if (!text || RELATIVE_INTENSITY_PATTERN.test(text)) return false
  const match = text.match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) > 0 : false
}

/**
 * Decide whether the set form should lead with a kg input or with reps only.
 * Unknown actions default to bodyweight: the user can still add load, while
 * core moves such as 死虫 are no longer blocked on a meaningless kg field.
 */
export function resolveActionLoadMode(
  action: ActionLoadInput | null | undefined,
  evidence?: { plannedWeights?: unknown[]; recordedWeights?: unknown[] }
): ActionLoadMode {
  if ((evidence?.plannedWeights || []).some(positiveKg)) return 'weighted'
  if ((evidence?.recordedWeights || []).some(positiveKg)) return 'weighted'
  if (action && isAutoComputeEnabled(action)) return 'weighted'
  const haystack = [String(action?.name || ''), ...attrsOf(action)].join(' ')
  return EQUIPMENT_PATTERN.test(haystack) ? 'weighted' : 'bodyweight'
}
