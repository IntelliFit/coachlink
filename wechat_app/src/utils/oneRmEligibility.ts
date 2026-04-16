type OneRMActionLike = {
  type?: string | null
  attrs?: string[] | null
  enableAutoWeightCompute?: boolean | null
  enable_auto_weight_compute?: boolean | null
  enableautoweightcompute?: boolean | null
}

const isStrengthType = (type?: string | null) => (type || 'STRENGTH') === 'STRENGTH'

const hasIntensityAttr = (attrs?: string[] | null) =>
  Array.isArray(attrs) && attrs.includes('强度')

const isAutoComputeEnabled = (action: OneRMActionLike) => {
  if (typeof action.enableAutoWeightCompute === 'boolean') {
    return action.enableAutoWeightCompute
  }
  if (typeof action.enable_auto_weight_compute === 'boolean') {
    return action.enable_auto_weight_compute
  }
  if (typeof action.enableautoweightcompute === 'boolean') {
    return action.enableautoweightcompute
  }
  return false
}

// A 1RM value is only meaningful for strength actions with intensity and auto-load capability.
export const isOneRMEligibleAction = (action?: OneRMActionLike | null) => {
  if (!action) return false
  return (
    isStrengthType(action.type) &&
    hasIntensityAttr(action.attrs) &&
    isAutoComputeEnabled(action)
  )
}
