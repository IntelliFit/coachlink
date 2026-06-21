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
export type RestCat = 'short' | 'moderate' | 'long' | 'very_long'
export type SetFeedbackType = 'RIR' | 'Achieved'
export type FormQuality = 'Competition' | 'Minor_Cheat' | 'Major_Cheat' | 'Extreme_Cheat'

export type StreetliftingFormulaLike = {
  coeff_a?: number | string | null
  coeff_b: number | string
  coeff_c: number | string
  coeff_d: number | string
  coeff_e: number | string
  coeff_f: number | string
}

export type StreetliftingCalculatorRequest = {
  exerciseType: ExerciseType
  mode: CalcMode
  gender: Gender
  bodyweight: number
  addedWeight?: number | null
  added1RM?: number | null
  workingAddedWeight?: number | null
  liftWeight?: number | null
  target1RM?: number | null
  workingLiftWeight?: number | null
  reps?: number | null
  sets?: number | null
  restCat?: RestCat | null
  dayFirstType?: SetFeedbackType | null
  dayFirstValue?: number | null
  dayLastType?: SetFeedbackType | null
  dayLastValue?: number | null
  formQuality: FormQuality
  penaltyWeight?: number | null
}

export type StreetliftingCalculatorResult = {
  estimated1RMKg: number
  finalScore: number
  coefficient: number
  computedAddedWeightKg?: number | null
  computedReps?: number | null
  adjustedUsedWeightKg?: number | null
  resultLevel: string
  isRankingEligible: boolean
}

export const isUpperBodyExercise = (type: ExerciseType) => type === 'weighted_pullup' || type === 'weighted_dips'
export const isPowerliftingExercise = (type: ExerciseType) => type === 'squat' || type === 'bench' || type === 'deadlift'
export const isBenchBasedExercise = (type: ExerciseType) => type === 'strict_press' || type === 'barbell_curl'

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

export function computeCoefficient(bodyweight: number, formula: StreetliftingFormulaLike) {
  const W = Number(bodyweight)
  if (!Number.isFinite(W)) return 0
  const a = Number(formula.coeff_a ?? 0)
  const b = Number(formula.coeff_b ?? 0)
  const c = Number(formula.coeff_c ?? 0)
  const d = Number(formula.coeff_d ?? 0)
  const e = Number(formula.coeff_e ?? 0)
  const f = Number(formula.coeff_f ?? 0)
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
  return targetTotal1RM / meanLoadFactorForReps(reps)
}

export function estimateRepsForTarget1RMContinuous(targetTotal1RM: number, totalWorkingWeight: number) {
  if (totalWorkingWeight <= 0 || targetTotal1RM <= 0) return 0
  const ratio = targetTotal1RM / totalWorkingWeight
  return Math.max(0.1, (ratio - 1) / 0.0333)
}

export function estimateRepsFromTotalWeightAndTarget1RM(target1RM: number, workingWeight: number) {
  const epleyReps = (target1RM / workingWeight - 1) / 0.0333
  const brzyckiReps = 37 - (36 * workingWeight) / target1RM
  const lombardiReps = Math.pow(target1RM / workingWeight, 10)
  return Math.max(1, (epleyReps + brzyckiReps + lombardiReps) / 3)
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
    if (score >= 208) return { level: '世界一线' }
    if (score >= 180) return { level: '国内一线' }
    if (score >= 152) return { level: '大佬' }
    if (score >= 120) return { level: '爱好者' }
    return { level: '菜就多练' }
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
  return repsList.map((reps) => {
    const targetLoad = invertTotalWeightForTarget1RM(total1rm, reps) - bodyweightForTotal
    return {
      reps,
      weight: Math.round(targetLoad * 10) / 10,
      percentage: external1rm > 0 ? Math.round((targetLoad / external1rm) * 100) : 0,
    }
  })
}

export function getPenaltyWeight(formQuality: FormQuality, penaltyWeight?: number | null) {
  if (formQuality === 'Competition') return 0
  return Math.max(0, Number(penaltyWeight || 0))
}

function restMultiplier(cat: RestCat) {
  switch (cat) {
    case 'short':
      return 1.6
    case 'moderate':
      return 1.25
    case 'long':
      return 1
    case 'very_long':
      return 0.85
    default:
      return 1
  }
}

function intensityAvg(reps: number) {
  const r = Math.max(1, Math.min(36, Math.round(reps)))
  const e = 1 / (1 + 0.0333 * r)
  const b = (37 - r) / 36
  const l = Math.pow(r, -0.1)
  return (e + b + l) / 3
}

function estimateDayMaxFromSets(params: {
  bodyweight: number
  addedWeight: number
  penaltyWeight: number
  sets: number
  reps: number
  restCat: RestCat
  firstSet?: { type: SetFeedbackType; value: number }
  lastSet?: { type: SetFeedbackType; value: number }
}) {
  const totalWorkingWeight = params.bodyweight + params.addedWeight - params.penaltyWeight
  if (!Number.isFinite(totalWorkingWeight) || totalWorkingWeight <= 0) throw new Error('输入导致总重量无效')
  const beta = 0.004 * params.reps * restMultiplier(params.restCat)
  const lastAvail = Math.max(0.75, 1 - (params.sets - 1) * beta)
  const effectiveReps = (input?: { type: SetFeedbackType; value: number }) => {
    if (!input) return null
    const value = input.type === 'RIR' ? params.reps + input.value : input.value
    return Math.max(1, Math.min(36, value))
  }
  const firstSetReps = effectiveReps(params.firstSet)
  const lastSetReps = effectiveReps(params.lastSet)
  const firstEstimate = firstSetReps === null ? null : totalWorkingWeight / intensityAvg(firstSetReps)
  const lastEstimate = lastSetReps === null ? null : totalWorkingWeight / (intensityAvg(lastSetReps) * lastAvail)
  let day1RM: number
  if (firstEstimate !== null && lastEstimate !== null) day1RM = firstEstimate * 0.8 + lastEstimate * 0.2
  else if (firstEstimate !== null) day1RM = firstEstimate
  else if (lastEstimate !== null) day1RM = lastEstimate
  else throw new Error('请至少输入第一组或最后一组的信息')
  return { total1RM: day1RM, added1RM: day1RM - params.bodyweight }
}

function toFiniteNumber(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function requirePositive(value: unknown, message: string) {
  const n = toFiniteNumber(value)
  if (n === null || n <= 0) throw new Error(message)
  return n
}

function requireReps(value: unknown, message = '完成次数必须在 1-36 之间') {
  const n = toFiniteNumber(value)
  if (n === null || n < 1 || n > 36) throw new Error(message)
  return n
}

export function computeStreetliftingCalculatorResult(
  request: StreetliftingCalculatorRequest,
  options?: { formula?: StreetliftingFormulaLike | null },
): StreetliftingCalculatorResult {
  const { exerciseType, mode, gender, bodyweight, formQuality } = request
  if (gender !== 'Male' && gender !== 'Female') throw new Error('请填写有效的性别')
  const bw = requirePositive(bodyweight, '请填写有效的体重')
  const penalty = getPenaltyWeight(formQuality, request.penaltyWeight)
  const isMale = gender === 'Male'
  let result: Omit<StreetliftingCalculatorResult, 'resultLevel' | 'isRankingEligible'>

  if (isPowerliftingExercise(exerciseType)) {
    const coefficient = computeDOTSCoefficient(bw, isMale)
    if (mode === 'forward') {
      const workingWeight = requirePositive(request.liftWeight, '请填写有效的做组重量')
      const reps = requirePositive(request.reps, '请填写有效的完成次数')
      const adjusted = workingWeight - penalty
      if (adjusted <= 0) throw new Error('惩罚重量过高，调整后的重量必须大于 0')
      const estimated1RM = estimateTotal1RMFromTotalWeightAndReps(adjusted, reps)
      result = { estimated1RMKg: estimated1RM, finalScore: estimated1RM * coefficient, coefficient, adjustedUsedWeightKg: adjusted }
    } else if (mode === 'reverse_weight') {
      const target1RM = requirePositive(request.target1RM, '请填写有效的现有 1RM')
      const reps = requirePositive(request.reps, '请填写有效的完成次数')
      result = { estimated1RMKg: target1RM, finalScore: target1RM * coefficient, coefficient, computedAddedWeightKg: invertTotalWeightForTarget1RM(target1RM, reps) }
    } else if (mode === 'reverse_reps') {
      const target1RM = requirePositive(request.target1RM, '请填写有效的现有 1RM')
      const workingWeight = requirePositive(request.workingLiftWeight, '请填写有效的做组重量')
      if (workingWeight >= target1RM) throw new Error('做组重量必须小于 1RM')
      result = {
        estimated1RMKg: target1RM,
        finalScore: target1RM * coefficient,
        coefficient,
        computedReps: Number(estimateRepsFromTotalWeightAndTarget1RM(target1RM, workingWeight).toFixed(1)),
        adjustedUsedWeightKg: workingWeight,
      }
    } else {
      throw new Error('三大项不支持做组极限估算')
    }
  } else if (isBenchBasedExercise(exerciseType)) {
    const coefficient = computeDOTSCoefficient(bw, isMale)
    const multiplier = exerciseType === 'strict_press' ? STRICT_PRESS_MULTIPLIER : BARBELL_CURL_MULTIPLIER
    if (mode === 'forward') {
      const workingWeight = requirePositive(request.liftWeight, '请填写有效的做组重量')
      const reps = requirePositive(request.reps, '请填写有效的完成次数')
      const adjusted = workingWeight - penalty
      if (adjusted <= 0) throw new Error('惩罚重量过高，调整后的重量必须大于 0')
      const estimated1RM = estimateTotal1RMFromTotalWeightAndReps(adjusted, reps)
      result = { estimated1RMKg: estimated1RM, finalScore: estimated1RM * coefficient * multiplier, coefficient, adjustedUsedWeightKg: adjusted }
    } else if (mode === 'reverse_weight') {
      const target1RM = requirePositive(request.target1RM, '请填写有效的现有 1RM')
      const reps = requirePositive(request.reps, '请填写有效的完成次数')
      result = { estimated1RMKg: target1RM, finalScore: target1RM * coefficient * multiplier, coefficient, computedAddedWeightKg: invertTotalWeightForTarget1RM(target1RM, reps) }
    } else if (mode === 'reverse_reps') {
      const target1RM = requirePositive(request.target1RM, '请填写有效的现有 1RM')
      const workingWeight = requirePositive(request.workingLiftWeight, '请填写有效的做组重量')
      if (workingWeight >= target1RM) throw new Error('做组重量必须小于 1RM')
      result = {
        estimated1RMKg: target1RM,
        finalScore: target1RM * coefficient * multiplier,
        coefficient,
        computedReps: Number(estimateRepsFromTotalWeightAndTarget1RM(target1RM, workingWeight).toFixed(1)),
        adjustedUsedWeightKg: workingWeight,
      }
    } else {
      throw new Error('该动作不支持做组极限估算')
    }
  } else {
    if (!isUpperBodyExercise(exerciseType)) throw new Error('未知运动类型')
    const formula = options?.formula
    if (!formula) throw new Error('未找到对应公式')
    const coefficient = computeCoefficient(bw, formula)
    if (mode === 'forward') {
      const added = requirePositive(request.addedWeight, '请填写附加负重')
      const reps = requireReps(request.reps)
      const adjustedAdded = added - penalty
      const totalWorkingWeight = bw + adjustedAdded
      if (totalWorkingWeight <= 0) throw new Error('惩罚重量过高，导致总重量无效')
      const total1RM = estimateTotal1RMFromTotalWeightAndReps(totalWorkingWeight, reps)
      const rawScore = total1RM * coefficient
      result = {
        estimated1RMKg: total1RM - bw,
        finalScore: exerciseType === 'weighted_dips' ? rawScore / 1.3 : rawScore,
        coefficient,
        adjustedUsedWeightKg: adjustedAdded,
      }
    } else if (mode === 'reverse_weight') {
      const existingAdded1RM = requirePositive(request.added1RM, '请填写负重 1RM')
      const reps = requireReps(request.reps)
      const targetTotal1RM = bw + existingAdded1RM
      const adjustedAdded = invertTotalWeightForTarget1RM(targetTotal1RM, reps) - bw
      const rawScore = targetTotal1RM * coefficient
      result = {
        estimated1RMKg: existingAdded1RM,
        finalScore: exerciseType === 'weighted_dips' ? rawScore / 1.3 : rawScore,
        coefficient,
        computedAddedWeightKg: adjustedAdded + penalty,
        adjustedUsedWeightKg: adjustedAdded,
      }
    } else if (mode === 'reverse_reps') {
      const existingAdded1RM = requirePositive(request.added1RM, '请填写负重 1RM')
      const workingAdded = requirePositive(request.workingAddedWeight, '请填写做组重量（附加负重）')
      const targetTotal1RM = bw + existingAdded1RM
      const adjustedAdded = workingAdded - penalty
      const totalWorkingWeight = bw + adjustedAdded
      if (totalWorkingWeight <= 0) throw new Error('输入导致总重量无效')
      const rawScore = targetTotal1RM * coefficient
      result = {
        estimated1RMKg: existingAdded1RM,
        finalScore: exerciseType === 'weighted_dips' ? rawScore / 1.3 : rawScore,
        coefficient,
        computedReps: Number(estimateRepsForTarget1RMContinuous(targetTotal1RM, totalWorkingWeight).toFixed(1)),
        adjustedUsedWeightKg: adjustedAdded,
      }
    } else if (mode === 'day_max') {
      const sets = requirePositive(request.sets, '请填写有效的组数')
      const reps = requirePositive(request.reps, '请填写有效的每组次数')
      const added = requirePositive(request.addedWeight, '请填写做组重量（附加负重）')
      const firstSet = request.dayFirstType && toFiniteNumber(request.dayFirstValue) !== null ? { type: request.dayFirstType, value: Number(request.dayFirstValue) } : undefined
      const lastSet = request.dayLastType && toFiniteNumber(request.dayLastValue) !== null ? { type: request.dayLastType, value: Number(request.dayLastValue) } : undefined
      const dayMax = estimateDayMaxFromSets({ bodyweight: bw, addedWeight: added, penaltyWeight: penalty, sets, reps, restCat: request.restCat || 'long', firstSet, lastSet })
      const rawScore = dayMax.total1RM * coefficient
      result = {
        estimated1RMKg: dayMax.added1RM,
        finalScore: exerciseType === 'weighted_dips' ? rawScore / 1.3 : rawScore,
        coefficient,
        adjustedUsedWeightKg: added - penalty,
      }
    } else {
      throw new Error('未知计算模式')
    }
  }

  return {
    ...result,
    resultLevel: getScoreLevel(result.finalScore, exerciseType).level,
    isRankingEligible: mode === 'forward',
  }
}

export function buildStreetliftingRankingBucketTitle(params: { exerciseType: ExerciseType; gender: Gender }) {
  const actionNameMap: Record<ExerciseType, string> = {
    weighted_pullup: '负重引体',
    weighted_dips: '负重双杠臂屈伸',
    strict_press: '实力推',
    barbell_curl: '杠铃弯举',
    squat: '深蹲',
    bench: '卧推',
    deadlift: '硬拉',
  }
  return `${params.gender === 'Male' ? '男子' : '女子'}${actionNameMap[params.exerciseType]}趣味榜`
}
