/**
 * 与主站 `src/lib/streetliftingSubmissionLimits.ts` 数值保持一致。
 */
export const STREETLIFTING_MAX_BODYWEIGHT_KG = 250
export const STREETLIFTING_MAX_ADDED_WEIGHT_KG = 250

export function validateStreetliftingSubmissionWeights(
  bodyweight: number,
  addedWeight: number
): { ok: true } | { ok: false; message: string } {
  if (!Number.isFinite(bodyweight) || bodyweight <= 0) {
    return { ok: false, message: '请填写有效体重' }
  }
  if (bodyweight > STREETLIFTING_MAX_BODYWEIGHT_KG) {
    return {
      ok: false,
      message: `体重不能超过 ${STREETLIFTING_MAX_BODYWEIGHT_KG} kg`
    }
  }
  if (!Number.isFinite(addedWeight)) {
    return { ok: false, message: '请填写有效附加负重' }
  }
  if (addedWeight < 0) {
    return { ok: false, message: '附加负重不能为负数' }
  }
  if (addedWeight > STREETLIFTING_MAX_ADDED_WEIGHT_KG) {
    return {
      ok: false,
      message: `附加负重不能超过 ${STREETLIFTING_MAX_ADDED_WEIGHT_KG} kg`
    }
  }
  return { ok: true }
}
