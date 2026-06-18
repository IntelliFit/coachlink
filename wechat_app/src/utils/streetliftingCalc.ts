/**
 * Streetlifting / strength-score calculator helpers shared by the mini program.
 * The math must stay aligned with the web implementation.
 */

export type Gender = 'Male' | 'Female'

export type ExerciseType =
  | 'weighted_pullup'
  | 'weighted_dips'
  | 'strict_press'
  | 'barbell_curl'
  | 'squat'
  | 'bench'
  | 'deadlift'

export type CalcMode = 'forward' | 'reverse_weight' | 'reverse_reps' | 'day_max'

export const isUpperBodyExercise = (type: ExerciseType) =>
  type === 'weighted_pullup' || type === 'weighted_dips'

export const isPowerliftingExercise = (type: ExerciseType) =>
  type === 'squat' || type === 'bench' || type === 'deadlift'

export const isBenchBasedExercise = (type: ExerciseType) =>
  type === 'strict_press' || type === 'barbell_curl'

export const STRICT_PRESS_MULTIPLIER = 500 / (130 * 0.65)
export const BARBELL_CURL_MULTIPLIER = 500 / (130 * 0.5)

export function computeDOTSCoefficient(weight: number, isMale: boolean) {
  const A = isMale ? -0.000001093 : -0.0000010706
  const B = isMale ? 0.0007391293 : 0.0005158568
  const C = isMale ? -0.1918759221 : -0.1126655495
  const D = isMale ? 24.0900756 : 13.6175032
  const E = isMale ? -307.75076 : -57.96288
  const denom = A * Math.pow(weight, 4) + B * Math.pow(weight, 3) + C * Math.pow(weight, 2) + D * weight + E
  return 500 / denom
}

export function computeCoefficient(
  bodyweight: number,
  formula: {
    coeff_a?: number
    coeff_b: number
    coeff_c: number
    coeff_d: number
    coeff_e: number
    coeff_f: number
  }
) {
  const W = Number(bodyweight)
  if (!Number.isFinite(W)) return 0
  const a = Number((formula as any)?.coeff_a ?? 0)
  const b = Number((formula as any)?.coeff_b ?? 0)
  const c = Number((formula as any)?.coeff_c ?? 0)
  const d = Number((formula as any)?.coeff_d ?? 0)
  const e = Number((formula as any)?.coeff_e ?? 0)
  const f = Number((formula as any)?.coeff_f ?? 0)
  const coeff = a * Math.pow(W, 5) + b * Math.pow(W, 4) + c * Math.pow(W, 3) + d * Math.pow(W, 2) + e * W + f
  return Number.isFinite(coeff) ? coeff : 0
}

export function meanLoadFactorForReps(reps: number) {
  if (reps < 1 || reps >= 37) throw new Error('完成次数必须在 1 到 36 之间')
  const fE = 1 + 0.0333 * reps
  const fB = 36 / (37 - reps)
  const fL = Math.pow(reps, 0.1)
  return (fE + fB + fL) / 3
}

export function estimateTotal1RMFromTotalWeightAndReps(totalWeight: number, reps: number) {
  if (reps === 1) return totalWeight
  return totalWeight * meanLoadFactorForReps(reps)
}

export function invertTotalWeightForTarget1RM(targetTotal1RM: number, reps: number) {
  if (reps === 1) return targetTotal1RM
  if (reps < 1 || reps >= 37) throw new Error('完成次数必须在 1 到 36 之间')
  return targetTotal1RM / meanLoadFactorForReps(reps)
}

export function estimateRepsForTarget1RMContinuous(targetTotal1RM: number, totalWorkingWeight: number) {
  if (totalWorkingWeight <= 0 || targetTotal1RM <= 0) return 0
  const ratio = targetTotal1RM / totalWorkingWeight
  const rE = (ratio - 1) / 0.0333
  return Math.max(0.1, rE)
}

export function estimateRepsFromTotalWeightAndTarget1RM(target1RM: number, workingWeight: number) {
  const epleyReps = (target1RM / workingWeight - 1) / 0.0333
  const brzyckiReps = 37 - (36 * workingWeight) / target1RM
  const lombardiReps = Math.pow(target1RM / workingWeight, 10)
  return Math.max(1, (epleyReps + brzyckiReps + lombardiReps) / 3)
}

export function calculateAdded1RM(bodyweight: number, addedWeight: number, reps: number, penaltyWeight: number) {
  const adjustedWeight = addedWeight - penaltyWeight
  const totalWeight = bodyweight + adjustedWeight
  if (reps === 1) return adjustedWeight
  if (reps >= 37) return 0
  const totalEstimated1RM = totalWeight * meanLoadFactorForReps(reps)
  return totalEstimated1RM - bodyweight
}

export function getScoreLevel(score: number, exerciseType: ExerciseType): { level: string } {
  if (isPowerliftingExercise(exerciseType)) {
    if (exerciseType === 'squat') {
      if (score >= 182) return { level: '世界一线' }
      if (score >= 158) return { level: '国内一线' }
      if (score >= 133) return { level: '大佬' }
      if (score >= 105) return { level: '爱好者' }
      return { level: '菜就多练' }
    }
    if (exerciseType === 'bench') {
      if (score >= 130) return { level: '世界一线' }
      if (score >= 113) return { level: '国内一线' }
      if (score >= 95) return { level: '大佬' }
      if (score >= 75) return { level: '爱好者' }
      return { level: '菜就多练' }
    }
    if (exerciseType === 'deadlift') {
      if (score >= 208) return { level: '世界一线' }
      if (score >= 180) return { level: '国内一线' }
      if (score >= 152) return { level: '大佬' }
      if (score >= 120) return { level: '爱好者' }
      return { level: '菜就多练' }
    }
  }
  if (score >= 500) return { level: '世界级' }
  if (score >= 450) return { level: '国内顶级' }
  if (score >= 400) return { level: '大佬' }
  if (score >= 300) return { level: '爱好者水平' }
  return { level: '菜就多练' }
}

export function generateRMTable(bodyweightForTotal: number, external1rm: number) {
  const total1rm = bodyweightForTotal + external1rm
  const repsList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16]
  return repsList.map((r) => {
    const sysWeight = invertTotalWeightForTarget1RM(total1rm, r)
    const targetLoad = sysWeight - bodyweightForTotal
    const percentage = external1rm > 0 ? (targetLoad / external1rm) * 100 : 0
    return {
      reps: r,
      weight: Math.round(targetLoad * 10) / 10,
      percentage: Math.round(percentage)
    }
  })
}

export type RestCat = 'short' | 'moderate' | 'long' | 'very_long'

export function restMultiplier(cat: RestCat) {
  switch (cat) {
    case 'short':
      return 1.6
    case 'moderate':
      return 1.25
    case 'long':
      return 1.0
    case 'very_long':
      return 0.85
    default:
      return 1.0
  }
}

export function intensityAvg(reps: number) {
  const r = Math.max(1, Math.min(36, Math.round(reps)))
  const e = 1 / (1 + 0.0333 * r)
  const b = (37 - r) / 36
  const l = Math.pow(r, -0.1)
  return (e + b + l) / 3
}

export function estimateDayMaxFromSets(params: {
  bodyweight: number
  addedWeight: number
  penaltyWeight: number
  sets: number
  reps: number
  restCat: RestCat
  firstSet?: { type: 'RIR' | 'Achieved'; value: number }
  lastSet?: { type: 'RIR' | 'Achieved'; value: number }
  alphaPerRep?: number
}) {
  const {
    bodyweight,
    addedWeight,
    penaltyWeight,
    sets,
    reps,
    restCat,
    firstSet,
    lastSet,
    alphaPerRep = 0.004
  } = params

  const adjustedAdded = addedWeight - penaltyWeight
  const totalWorkingWeight = bodyweight + adjustedAdded
  if (!Number.isFinite(totalWorkingWeight) || totalWorkingWeight <= 0) {
    throw new Error('用于计算的总重量无效')
  }

  const fatigueMultiplier = restMultiplier(restCat)
  const beta = alphaPerRep * reps * fatigueMultiplier
  const lastAvail = Math.max(0.75, 1 - (sets - 1) * beta)

  const effectiveReps = (input?: { type: 'RIR' | 'Achieved'; value: number }) => {
    if (!input) return null
    const value = input.type === 'RIR' ? reps + input.value : input.value
    return Math.max(1, Math.min(36, value))
  }

  const firstSetReps = effectiveReps(firstSet)
  const lastSetReps = effectiveReps(lastSet)

  let firstEstimate: number | null = null
  let lastEstimate: number | null = null

  if (firstSetReps !== null) {
    firstEstimate = totalWorkingWeight / intensityAvg(firstSetReps)
  }
  if (lastSetReps !== null) {
    lastEstimate = totalWorkingWeight / (intensityAvg(lastSetReps) * lastAvail)
  }

  let day1RM: number
  if (firstEstimate !== null && lastEstimate !== null) {
    day1RM = firstEstimate * 0.8 + lastEstimate * 0.2
  } else if (firstEstimate !== null) {
    day1RM = firstEstimate
  } else if (lastEstimate !== null) {
    day1RM = lastEstimate
  } else {
    throw new Error('请至少填写首组或末组表现')
  }

  return {
    total1RM: day1RM,
    added1RM: day1RM - bodyweight
  }
}
