/** Strength sets can measure repetitions or elapsed time; kilograms are external load. */
export function isTimedTrainingSet(set: any, action?: any): boolean {
  const type = String(set?.planned_target_type ?? set?.plannedTargetType ?? '').toLowerCase()
  const unit = String(set?.planned_target_unit ?? set?.plannedTargetUnit ?? '').toLowerCase()
  if (/^(time|duration)$/.test(type) || /^(s|sec|seconds?|秒|min|minutes?|分钟)$/.test(unit)) return true
  if (type === 'reps' || type === 'count') return false
  if (getActualDurationSeconds(set) !== null) return true
  if (/秒|分钟|\b(?:sec(?:onds?)?|min(?:utes?)?)\b/i.test(String(set?.planned_reps ?? set?.plannedReps ?? ''))) return true
  // Older added sets lost their target metadata. The action's other sets retain it.
  if (Array.isArray(action?.sets) && action.sets.some((s: any) => isTimedTrainingSet(s))) return true
  const attrs = action?.attrs ?? action?.action?.attrs
  return Array.isArray(attrs) && attrs.includes('持续时间') && !attrs.includes('次数')
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function getActualDurationSeconds(set: any): number | null {
  const value = finiteNumber(set?.actual_duration ?? set?.actualDuration)
  return value !== null && value > 0 ? value : null
}

export function getPlannedDurationSeconds(set: any, action?: any): number | null {
  if (!isTimedTrainingSet(set, action)) return null
  const text = String(set?.planned_reps ?? set?.plannedReps ?? '')
  const raw = set?.planned_duration ?? set?.plannedDuration ?? text.match(/\d+(?:\.\d+)?/)?.[0]
  const value = finiteNumber(raw)
  const unit = String(set?.planned_target_unit ?? set?.plannedTargetUnit ?? '').toLowerCase()
  const minutes = /^(min|minutes?|分钟)$/.test(unit) || /分钟|\bmin(?:utes?)?\b/i.test(text)
  return value !== null && value > 0 ? value * (minutes ? 60 : 1) : null
}

export function getTrainingSetVolume(set: any, action?: any): number {
  if (isTimedTrainingSet(set, action)) return 0
  const weight = finiteNumber(set?.actual_weight ?? set?.actualWeight)
  const reps = finiteNumber(set?.actual_reps ?? set?.actualReps)
  return Math.max(0, weight ?? 0) * Math.max(0, reps ?? 0)
}

export function formatRecordedTrainingSet(set: any, action?: any): string {
  if (isTimedTrainingSet(set, action)) {
    const seconds = getActualDurationSeconds(set)
    return seconds === null ? '时长未记录' : `保持 ${seconds} 秒`
  }
  const weight = finiteNumber(set?.actual_weight ?? set?.actualWeight)
  const reps = finiteNumber(set?.actual_reps ?? set?.actualReps)
  const load = weight === null ? '重量未记录' : weight === 0 ? '自重 / 无外加负重' : weight < 0 ? `辅助 ${Math.abs(weight)}kg` : `${weight}kg`
  return `${load} × ${reps ?? '-'}次`
}

/** Never reinterpret historical actual_reps as seconds or use a prescription as an actual result. */
export function trainingSetMeasurementPatch(set: any, input: {
  actualWeight?: number | null; actualReps?: number | null; actualDuration?: number | null
}, action?: any): { patch: Record<string, any>; error?: string } {
  if (isTimedTrainingSet(set, action)) {
    const duration = input.actualDuration === undefined ? getActualDurationSeconds(set)
      : typeof input.actualDuration === 'number' && Number.isFinite(input.actualDuration) ? input.actualDuration : null
    if (duration === null || duration <= 0) return { patch: {}, error: '请填写实际保持时长（秒），此动作不按重量和次数记录' }
    return { patch: { actual_duration: duration, actual_weight: null, actual_reps: null, e1rm: null, is_auto_pr: false } }
  }
  if (input.actualDuration !== undefined && input.actualDuration !== null) return { patch: {}, error: '此动作按次数记录' }
  const patch: Record<string, any> = {}
  for (const [key, value] of [['actual_weight', input.actualWeight], ['actual_reps', input.actualReps]] as const) {
    if (value === undefined) continue
    if (value !== null && (!Number.isFinite(value) || (key === 'actual_reps' && (value <= 0 || !Number.isInteger(value))))) {
      return { patch: {}, error: key === 'actual_reps' ? '次数必须是正整数' : '重量必须是有效数字；自重请记录0公斤外加负重' }
    }
    patch[key] = value
  }
  return { patch }
}

export function inheritedTimedSetDefaults(set: any, action?: any): Record<string, any> {
  if (!isTimedTrainingSet(set, action)) return {}
  const seconds = getActualDurationSeconds(set) ?? getPlannedDurationSeconds(set, action)
  return { planned_weight: null, planned_reps: seconds === null ? null : `${seconds}秒`,
    planned_target_type: 'time', planned_target_unit: 's' }
}
