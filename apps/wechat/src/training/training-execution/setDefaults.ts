interface WeightedSet {
  set_number?: number | string | null
  status?: string | null
  actual_weight?: number | string | null
}

/**
 * Weight the athlete actually used on the latest completed set before `target` in the same
 * action. Used to prefill sets whose plan has no concrete kg (e.g. "9RM"), so the field is
 * not left empty behind a placeholder that looks like a value.
 */
export function previousCompletedWeight(sets: WeightedSet[] | null | undefined, target: WeightedSet | null | undefined): number | null {
  if (!Array.isArray(sets) || !target) return null
  const targetNumber = Number(target.set_number)
  const targetIndex = sets.indexOf(target)
  const before = sets.filter((set, index) => {
    if (set === target) return false
    const number = Number(set.set_number)
    if (Number.isFinite(number) && Number.isFinite(targetNumber)) return number < targetNumber
    return targetIndex >= 0 && index < targetIndex
  })
  for (let i = before.length - 1; i >= 0; i -= 1) {
    const set = before[i]
    if (set.status !== 'completed') continue
    if (set.actual_weight === null || set.actual_weight === undefined || String(set.actual_weight).trim() === '') continue
    const weight = Number(set.actual_weight)
    if (Number.isFinite(weight)) return weight
  }
  return null
}
