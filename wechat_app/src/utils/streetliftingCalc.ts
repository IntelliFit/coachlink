/**
 * 街健/力量分计算逻辑（与网页端 coachlink 一致，纯逻辑可复用）
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

export function estimateTotal1RMFromTotalWeightAndReps(totalWeight: number, reps: number) {
  if (reps === 1) return totalWeight
  if (reps >= 37) throw new Error('完成次数必须小于37次')
  const epley1RM = totalWeight * (1 + 0.0333 * reps)
  const brzycki1RM = totalWeight * (36 / (37 - reps))
  const lombardi1RM = totalWeight * Math.pow(reps, 0.1)
  return (epley1RM + brzycki1RM + lombardi1RM) / 3
}

export function invertTotalWeightForTarget1RM(targetTotal1RM: number, reps: number) {
  if (reps === 1) return targetTotal1RM
  if (reps < 1 || reps >= 37) throw new Error('完成次数必须在1到36之间')
  const wtE = targetTotal1RM / (1 + 0.0333 * reps)
  const wtB = targetTotal1RM * ((37 - reps) / 36)
  const wtL = targetTotal1RM / Math.pow(reps, 0.1)
  return (wtE + wtB + wtL) / 3
}

export function estimateRepsForTarget1RMContinuous(targetTotal1RM: number, totalWorkingWeight: number) {
  if (totalWorkingWeight <= 0 || targetTotal1RM <= 0) return 0
  const ratio = targetTotal1RM / totalWorkingWeight
  const rE = (ratio - 1) / 0.0333
  return Math.max(0.1, rE)
}

/** 用于社区数据列表：根据体重、附加负重、次数、惩罚重量估算附加负重 1RM */
export function calculateAdded1RM(bodyweight: number, addedWeight: number, reps: number, penaltyWeight: number) {
  const adjustedWeight = addedWeight - penaltyWeight
  const totalWeight = bodyweight + adjustedWeight
  if (reps === 1) return adjustedWeight
  if (reps >= 37) return 0
  const epley1RM = totalWeight * (1 + 0.0333 * reps)
  const brzycki1RM = totalWeight * (36 / (37 - reps))
  const lombardi1RM = totalWeight * Math.pow(reps, 0.1)
  const totalEstimated1RM = (epley1RM + brzycki1RM + lombardi1RM) / 3
  return totalEstimated1RM - bodyweight
}

export function getScoreLevel(score: number, exerciseType: ExerciseType): { level: string } {
  if (isPowerliftingExercise(exerciseType)) {
    if (exerciseType === 'squat') {
      if (score >= 182) return { level: '🏆 世界一线' }
      if (score >= 158) return { level: '🥇 国内一线' }
      if (score >= 133) return { level: '💪 大佬' }
      if (score >= 105) return { level: '🔥 爱好者' }
      return { level: '🌱 菜就多练' }
    }
    if (exerciseType === 'bench') {
      if (score >= 130) return { level: '🏆 世界一线' }
      if (score >= 113) return { level: '🥇 国内一线' }
      if (score >= 95) return { level: '💪 大佬' }
      if (score >= 75) return { level: '🔥 爱好者' }
      return { level: '🌱 菜就多练' }
    }
    if (exerciseType === 'deadlift') {
      if (score >= 208) return { level: '🏆 世界一线' }
      if (score >= 180) return { level: '🥇 国内一线' }
      if (score >= 152) return { level: '💪 大佬' }
      if (score >= 120) return { level: '🔥 爱好者' }
      return { level: '🌱 菜就多练' }
    }
  }
  if (score >= 500) return { level: '🏆 世界级' }
  if (score >= 450) return { level: '🥇 国内顶级' }
  if (score >= 400) return { level: '💪 大佬' }
  if (score >= 300) return { level: '🔥 爱好者水平' }
  return { level: '🌱 菜就多练' }
}

export function generateRMTable(bodyweightForTotal: number, external1rm: number) {
  const total1rm = bodyweightForTotal + external1rm
  const repsList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16]
  return repsList.map((r) => {
    const factorEpley = (1 + 0.0333) / (1 + 0.0333 * r)
    const factorBrzycki = (37 - r) / 36.0
    const factorLombardi = 1 / Math.pow(r, 0.1)
    const avgFactor = (factorEpley + factorBrzycki + factorLombardi) / 3.0
    const sysWeight = total1rm * avgFactor
    const targetLoad = sysWeight - bodyweightForTotal
    const percentage = external1rm > 0 ? (targetLoad / external1rm) * 100 : 0
    return {
      reps: r,
      weight: Math.round(targetLoad * 10) / 10,
      percentage: Math.round(percentage)
    }
  })
}

// 做组极限估算用
export type RestCat = 'short' | 'moderate' | 'long' | 'very_long'

export function restMultiplier(cat: RestCat) {
  switch (cat) {
    case 'short': return 1.6
    case 'moderate': return 1.25
    case 'long': return 1.0
    case 'very_long': return 0.85
    default: return 1.0
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
    bodyweight: W,
    addedWeight: A,
    penaltyWeight: P,
    sets: n,
    reps: r,
    restCat,
    firstSet,
    lastSet,
    alphaPerRep = 0.004
  } = params
  const adjustedAdded = A - P
  const Tw = W + adjustedAdded
  if (!Number.isFinite(Tw) || Tw <= 0) throw new Error('输入导致总重量无效')
  const rm = restMultiplier(restCat)
  const beta = alphaPerRep * r * rm
  const lastAvail = Math.max(0.75, 1 - (n - 1) * beta)
  const effReps = (input?: { type: 'RIR' | 'Achieved'; value: number }) => {
    if (!input) return null
    const v = input.type === 'RIR' ? r + input.value : input.value
    return Math.max(1, Math.min(36, v))
  }
  const r1 = effReps(firstSet)
  const rn = effReps(lastSet)
  let D_first: number | null = null
  let D_last: number | null = null
  if (r1 !== null) {
    const I1 = intensityAvg(r1)
    D_first = Tw / I1
  }
  if (rn !== null) {
    const In = intensityAvg(rn)
    D_last = Tw / (In * lastAvail)
  }
  let D_day: number
  if (D_first !== null && D_last !== null) {
    D_day = 0.8 * D_first + 0.2 * D_last
  } else if (D_first !== null) {
    D_day = D_first
  } else if (D_last !== null) {
    D_day = D_last
  } else {
    throw new Error('请输入第一组或最后一组的RIR/实际次数信息')
  }
  return { total1RM: D_day, added1RM: D_day - W }
}
