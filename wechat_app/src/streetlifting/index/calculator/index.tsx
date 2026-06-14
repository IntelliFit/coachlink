/**
 * 力量分计算器 - 小程序原生实现（逻辑与网页端一致）
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Input, Picker, Button } from '@tarojs/components'
import Taro, { useDidHide, useUnload } from '@tarojs/taro'
import {
  type ExerciseType,
  type CalcMode,
  type Gender,
  type RestCat,
  isUpperBodyExercise,
  isPowerliftingExercise,
  isBenchBasedExercise,
  computeDOTSCoefficient,
  computeCoefficient,
  estimateTotal1RMFromTotalWeightAndReps,
  invertTotalWeightForTarget1RM,
  estimateRepsForTarget1RMContinuous,
  estimateRepsFromTotalWeightAndTarget1RM,
  estimateDayMaxFromSets,
  STRICT_PRESS_MULTIPLIER,
  BARBELL_CURL_MULTIPLIER
} from '@/utils/streetliftingCalc'
import { streetliftingIndexService, type StreetliftingFormula } from '@/services/streetliftingIndexService'
import { studentService } from '@/services/studentService'
import { authService } from '@/services/authService'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

const EXERCISE_OPTIONS: { label: string; value: ExerciseType }[] = [
  { label: '负重引体向上', value: 'weighted_pullup' },
  { label: '负重双杠臂屈伸', value: 'weighted_dips' },
  { label: '实力推（满分 500）', value: 'strict_press' },
  { label: '杠铃弯举（满分 500）', value: 'barbell_curl' },
  { label: '深蹲（DOTS）', value: 'squat' },
  { label: '卧推（DOTS）', value: 'bench' },
  { label: '硬拉（DOTS）', value: 'deadlift' }
]

const MODE_OPTIONS: { label: string; value: CalcMode }[] = [
  { label: '正向计算', value: 'forward' },
  { label: '反推做组重量', value: 'reverse_weight' },
  { label: '反推次数', value: 'reverse_reps' },
  { label: '做组极限估算（仅引体/臂屈伸）', value: 'day_max' }
]

const GENDER_OPTIONS: { label: string; value: Gender }[] = [
  { label: '男', value: 'Male' },
  { label: '女', value: 'Female' }
]

const QUALITY_OPTIONS: { label: string; value: string }[] = [
  { label: '比赛级（标准动作）', value: 'Competition' },
  { label: '轻微借力（2-5kg）', value: 'Minor_Cheat' },
  { label: '严重借力（5-20kg）', value: 'Major_Cheat' },
  { label: '超严重借力（20-50kg）', value: 'Extreme_Cheat' }
]

const REST_OPTIONS: { label: string; value: RestCat }[] = [
  { label: '≤90秒', value: 'short' },
  { label: '90秒-3分钟', value: 'moderate' },
  { label: '3-5分钟', value: 'long' },
  { label: '>5分钟', value: 'very_long' }
]

const SET_FEEDBACK_TYPE_OPTIONS: { label: string; value: 'RIR' | 'Achieved' }[] = [
  { label: 'RIR', value: 'RIR' },
  { label: '实际次数', value: 'Achieved' }
]

type CalcResult = {
  estimated_1rm: number
  final_score: number
  coefficient: number
  computed_added_weight?: number
  computed_reps?: number
  adjusted_used_weight?: number
}

type CalcDraft = {
  exerciseType: ExerciseType
  mode: CalcMode
  gender: Gender | ''
  bodyweight: string
  addedWeight: string
  added1RM: string
  workingAddedWeight: string
  liftWeight: string
  target1RM: string
  workingLiftWeight: string
  reps: string
  sets: string
  restCat: RestCat | ''
  dayFirstType: 'RIR' | 'Achieved' | ''
  dayFirstValue: string
  dayLastType: 'RIR' | 'Achieved' | ''
  dayLastValue: string
  formQuality: string
  penaltyWeight: number
}

type CalcSnapshot = {
  timestamp: number
  draft: CalcDraft
  result: CalcResult
}

const STORAGE_KEY = 'sl_calc_form_data'
const RESULT_KEY = 'sl_calc_result'
const LAST_RUN_KEY = 'sl_calc_last_run'

const DEFAULT_DRAFT: CalcDraft = {
  exerciseType: 'weighted_pullup',
  mode: 'forward',
  gender: '',
  bodyweight: '',
  addedWeight: '',
  added1RM: '',
  workingAddedWeight: '',
  liftWeight: '',
  target1RM: '',
  workingLiftWeight: '',
  reps: '',
  sets: '',
  restCat: '',
  dayFirstType: '',
  dayFirstValue: '',
  dayLastType: '',
  dayLastValue: '',
  formQuality: 'Minor_Cheat',
  penaltyWeight: 3
}

function normalizeGender(g: string): Gender | null {
  const s = String(g).toLowerCase().trim()
  if (s === 'male' || s === 'm' || s === '男' || s === '1') return 'Male'
  if (s === 'female' || s === 'f' || s === '女' || s === '0' || s === '2') return 'Female'
  return null
}

function isExerciseType(v: unknown): v is ExerciseType {
  return typeof v === 'string' && EXERCISE_OPTIONS.some((o) => o.value === v)
}

function isCalcMode(v: unknown): v is CalcMode {
  return typeof v === 'string' && MODE_OPTIONS.some((o) => o.value === v)
}

function parseStoredDraft(raw: unknown): Partial<CalcDraft> | null {
  if (raw == null || raw === '') return null
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!data || typeof data !== 'object') return null
    return data as Partial<CalcDraft>
  } catch {
    return null
  }
}

function parseLastSnapshot(raw: unknown): CalcSnapshot | null {
  if (raw == null || raw === '') return null
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!data || typeof data !== 'object' || !data.draft || !data.result) return null
    return data as CalcSnapshot
  } catch {
    return null
  }
}

function coalesceDraftField(a: unknown, b: unknown): string {
  const sa = a !== undefined && a !== null ? String(a).trim() : ''
  if (sa !== '') return String(a).trim()
  const sb = b !== undefined && b !== null ? String(b).trim() : ''
  return sb !== '' ? sb : ''
}

function getPenaltyPreset(formQuality: string) {
  if (formQuality === 'Minor_Cheat') return 3
  if (formQuality === 'Major_Cheat') return 10
  if (formQuality === 'Extreme_Cheat') return 30
  return 3
}

export default function StreetliftingCalculator() {
  const { effectiveTheme } = useTheme()
  const [draft, setDraft] = useState<CalcDraft>(DEFAULT_DRAFT)
  const [formulaMap, setFormulaMap] = useState<Record<string, StreetliftingFormula>>({})
  const [loadingFormula, setLoadingFormula] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [lastSnapshot, setLastSnapshot] = useState<CalcSnapshot | null>(null)
  const [formHydrated, setFormHydrated] = useState(false)

  const exerciseType = draft.exerciseType
  const mode = draft.mode
  const gender = draft.gender
  const bodyweight = draft.bodyweight
  const addedWeight = draft.addedWeight
  const added1RM = draft.added1RM
  const workingAddedWeight = draft.workingAddedWeight
  const liftWeight = draft.liftWeight
  const target1RM = draft.target1RM
  const workingLiftWeight = draft.workingLiftWeight
  const reps = draft.reps
  const sets = draft.sets
  const restCat = draft.restCat
  const dayFirstType = draft.dayFirstType
  const dayFirstValue = draft.dayFirstValue
  const dayLastType = draft.dayLastType
  const dayLastValue = draft.dayLastValue
  const formQuality = draft.formQuality
  const penaltyWeight = draft.penaltyWeight

  const patchDraft = useCallback((patch: Partial<CalcDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }, [])

  const saveDraftNow = useCallback(() => {
    try {
      Taro.setStorageSync(STORAGE_KEY, JSON.stringify(draft))
    } catch (e) {
      console.error('[calculator] save form data error:', e)
    }
  }, [draft])

  useDidHide(() => {
    if (formHydrated) saveDraftNow()
  })

  useUnload(() => {
    if (formHydrated) saveDraftNow()
  })

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const saved = parseStoredDraft(Taro.getStorageSync(STORAGE_KEY))
      const lastSnap = parseLastSnapshot(Taro.getStorageSync(LAST_RUN_KEY))
      const lastDraft = lastSnap?.draft

      setLoadingFormula(true)
      try {
        const data = await streetliftingIndexService.listFormulas()
        if (!cancelled && data?.formulas) {
          const next: Record<string, StreetliftingFormula> = {}
          data.formulas.forEach((f) => {
            next[`${f.gender}`] = f
          })
          setFormulaMap(next)
        }
      } catch (e) {
        if (!cancelled) {
          console.error('[calculator] listFormulas error:', e)
          Taro.showToast({ title: (e as Error)?.message || '公式获取失败', icon: 'none' })
        }
      } finally {
        if (!cancelled) setLoadingFormula(false)
      }

      let profileGender: Gender | null = null
      let profileBodyweightStr: string | null = null
      try {
        const session = authService.getAuthSession({ normalize: true })
        if (session.isAuthenticated && session.user?.id) {
          const profileRes = await studentService.getStudentProfile(session.user.id)
          const profile = profileRes?.profile
          if (profile) {
            const g = normalizeGender(String(profile.gender || ''))
            if (g) profileGender = g
            const w = Number(profile.weight)
            if (Number.isFinite(w) && w > 0) profileBodyweightStr = String(w)
          }
        }
      } catch (e) {
        console.error('[calculator] load profile error:', e)
      }

      if (cancelled) return

      const restoredExerciseType = saved && isExerciseType(saved.exerciseType)
        ? saved.exerciseType
        : lastDraft && isExerciseType(lastDraft.exerciseType)
          ? lastDraft.exerciseType
          : DEFAULT_DRAFT.exerciseType

      let restoredMode = saved && isCalcMode(saved.mode)
        ? saved.mode
        : lastDraft && isCalcMode(lastDraft.mode)
          ? lastDraft.mode
          : DEFAULT_DRAFT.mode

      if (!isUpperBodyExercise(restoredExerciseType) && restoredMode === 'day_max') {
        restoredMode = 'forward'
      }

      const nextDraft: CalcDraft = {
        ...DEFAULT_DRAFT,
        exerciseType: restoredExerciseType,
        mode: restoredMode,
        gender: profileGender || (saved?.gender === 'Male' || saved?.gender === 'Female' ? saved.gender : lastDraft?.gender === 'Male' || lastDraft?.gender === 'Female' ? lastDraft.gender : ''),
        bodyweight: profileBodyweightStr !== null ? profileBodyweightStr : coalesceDraftField(saved?.bodyweight, lastDraft?.bodyweight),
        addedWeight: coalesceDraftField(saved?.addedWeight, lastDraft?.addedWeight),
        added1RM: coalesceDraftField(saved?.added1RM, lastDraft?.added1RM),
        workingAddedWeight: coalesceDraftField(saved?.workingAddedWeight, lastDraft?.workingAddedWeight),
        liftWeight: coalesceDraftField(saved?.liftWeight, lastDraft?.liftWeight),
        target1RM: coalesceDraftField(saved?.target1RM, lastDraft?.target1RM),
        workingLiftWeight: coalesceDraftField(saved?.workingLiftWeight, lastDraft?.workingLiftWeight),
        reps: coalesceDraftField(saved?.reps, lastDraft?.reps),
        sets: coalesceDraftField(saved?.sets, lastDraft?.sets),
        restCat: saved?.restCat && REST_OPTIONS.some((option) => option.value === saved.restCat)
          ? saved.restCat
          : lastDraft?.restCat && REST_OPTIONS.some((option) => option.value === lastDraft.restCat)
            ? lastDraft.restCat
            : '',
        dayFirstType: saved?.dayFirstType === 'RIR' || saved?.dayFirstType === 'Achieved'
          ? saved.dayFirstType
          : lastDraft?.dayFirstType === 'RIR' || lastDraft?.dayFirstType === 'Achieved'
            ? lastDraft.dayFirstType
            : '',
        dayFirstValue: coalesceDraftField(saved?.dayFirstValue, lastDraft?.dayFirstValue),
        dayLastType: saved?.dayLastType === 'RIR' || saved?.dayLastType === 'Achieved'
          ? saved.dayLastType
          : lastDraft?.dayLastType === 'RIR' || lastDraft?.dayLastType === 'Achieved'
            ? lastDraft.dayLastType
            : '',
        dayLastValue: coalesceDraftField(saved?.dayLastValue, lastDraft?.dayLastValue),
        formQuality: coalesceDraftField(saved?.formQuality, lastDraft?.formQuality) || DEFAULT_DRAFT.formQuality,
        penaltyWeight: typeof saved?.penaltyWeight === 'number' && Number.isFinite(saved.penaltyWeight)
          ? saved.penaltyWeight
          : typeof lastDraft?.penaltyWeight === 'number' && Number.isFinite(lastDraft.penaltyWeight)
            ? lastDraft.penaltyWeight
            : DEFAULT_DRAFT.penaltyWeight
      }

      setDraft(nextDraft)
      if (lastSnap) setLastSnapshot(lastSnap)
      setFormHydrated(true)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!formHydrated) return
    const timer = setTimeout(() => {
      saveDraftNow()
    }, 400)
    return () => clearTimeout(timer)
  }, [formHydrated, saveDraftNow])

  const penalty = useMemo(
    () => ['Minor_Cheat', 'Major_Cheat', 'Extreme_Cheat'].includes(formQuality) ? penaltyWeight : 0,
    [formQuality, penaltyWeight]
  )

  const currentFormula = useMemo(
    () => gender && isUpperBodyExercise(exerciseType) ? formulaMap[gender] || null : null,
    [exerciseType, formulaMap, gender]
  )

  const availableModeOptions = useMemo(
    () => MODE_OPTIONS.filter((option) => option.value !== 'day_max' || isUpperBodyExercise(exerciseType)),
    [exerciseType]
  )

  const saveLastSnapshot = (snapshot: CalcSnapshot) => {
    try {
      Taro.setStorageSync(LAST_RUN_KEY, JSON.stringify(snapshot))
      setLastSnapshot(snapshot)
    } catch (e) {
      console.error('[calculator] save last snapshot error:', e)
    }
  }

  const clearPersistedDraft = useCallback(() => {
    try {
      Taro.removeStorageSync(STORAGE_KEY)
    } catch (e) {
      console.error('[calculator] clear draft error:', e)
    }
    setDraft(DEFAULT_DRAFT)
    Taro.showToast({ title: '已清除上次输入', icon: 'success' })
  }, [])

  const getOptionLabel = <T extends string>(options: Array<{ label: string; value: T }>, value: string | undefined) =>
    options.find((item) => item.value === value)?.label || String(value || '')

  const getNumericCompareText = (field: keyof CalcDraft) => {
    if (!lastSnapshot) return ''
    const previousRaw = lastSnapshot.draft?.[field]
    const previousStr = previousRaw !== undefined && previousRaw !== null ? String(previousRaw).trim() : ''
    if (!previousStr) return ''
    const previous = Number(previousRaw)
    if (!Number.isFinite(previous)) return ''

    const currentRaw = draft[field]
    const currentStr =
      typeof currentRaw === 'number' && Number.isFinite(currentRaw)
        ? String(currentRaw)
        : String(currentRaw ?? '').trim()

    if (currentStr === '') return `上次 ${previousStr}`
    const current = Number(currentStr)
    if (!Number.isFinite(current)) return `上次 ${previousStr}`
    const delta = current - previous
    if (Math.abs(delta) < 0.0001) return '较上次持平'
    const decimals = field === 'reps' || field === 'sets' || field === 'penaltyWeight' ? 0 : 1
    return `较上次 ${delta > 0 ? '+' : ''}${delta.toFixed(decimals)}`
  }

  const getTextCompareText = (field: keyof CalcDraft, formatter?: (value: string) => string) => {
    if (!lastSnapshot) return ''
    const previous = String(lastSnapshot.draft?.[field] ?? '').trim()
    if (!previous) return ''
    const current = String(draft[field] ?? '').trim()
    const fmt = (value: string) => (formatter ? formatter(value) : value)
    if (current && current === previous) return '较上次一致'
    if (current && current !== previous) return `上次 ${fmt(previous)} · 现 ${fmt(current)}`
    return `上次 ${fmt(previous)}`
  }

  const handleCalculate = () => {
    setSubmitting(true)

    const finish = (result: CalcResult) => {
      let workingWeightForPoster: number | null = null
      if (mode === 'forward') {
        workingWeightForPoster = isUpperBodyExercise(exerciseType) ? Number(addedWeight) : Number(liftWeight)
      } else if (mode === 'reverse_reps') {
        workingWeightForPoster = isUpperBodyExercise(exerciseType) ? Number(workingAddedWeight) : Number(workingLiftWeight)
      } else if (mode === 'reverse_weight') {
        workingWeightForPoster = Number(result.computed_added_weight)
      }
      if (!Number.isFinite(workingWeightForPoster)) {
        workingWeightForPoster = typeof result.adjusted_used_weight === 'number' && Number.isFinite(result.adjusted_used_weight)
          ? result.adjusted_used_weight
          : null
      }

      try {
        Taro.setStorageSync(RESULT_KEY, JSON.stringify({
          result,
          exerciseType,
          mode,
          gender,
          bodyweight,
          reps,
          workingWeight: workingWeightForPoster
        }))
      } catch (e) {
        console.error('[calculator] save result error:', e)
      }

      saveLastSnapshot({
        timestamp: Date.now(),
        draft,
        result
      })

      Taro.navigateTo({ url: '/streetlifting/index/calculator/result' })
    }

    try {
      const bw = Number(bodyweight)
      const isMale = gender === 'Male'

      if (!gender || !Number.isFinite(bw) || bw <= 0) {
        throw new Error('请填写性别与体重')
      }
      if (!formQuality) {
        throw new Error('请选择动作质量')
      }

      if (isPowerliftingExercise(exerciseType)) {
        const coeff = computeDOTSCoefficient(bw, isMale)

        if (mode === 'forward') {
          const workingWeight = Number(liftWeight)
          const repCount = Number(reps)
          if (!Number.isFinite(workingWeight) || workingWeight <= 0) throw new Error('请填写有效的做组重量')
          if (!Number.isFinite(repCount) || repCount <= 0) throw new Error('请填写有效的完成次数')
          const adjusted = workingWeight - penalty
          if (adjusted <= 0) throw new Error('惩罚重量过高，调整后的重量必须大于 0')
          const estimated1RM = estimateTotal1RMFromTotalWeightAndReps(adjusted, repCount)
          finish({
            estimated_1rm: estimated1RM,
            final_score: estimated1RM * coeff,
            coefficient: coeff,
            adjusted_used_weight: adjusted
          })
          return
        }

        if (mode === 'reverse_weight') {
          const existing1RM = Number(target1RM)
          const repCount = Number(reps)
          if (!Number.isFinite(existing1RM) || existing1RM <= 0) throw new Error('请填写有效的现有 1RM')
          if (!Number.isFinite(repCount) || repCount <= 0) throw new Error('请填写有效的完成次数')
          const computedWeight = invertTotalWeightForTarget1RM(existing1RM, repCount)
          finish({
            estimated_1rm: existing1RM,
            final_score: existing1RM * coeff,
            coefficient: coeff,
            computed_added_weight: computedWeight
          })
          return
        }

        if (mode === 'reverse_reps') {
          const existing1RM = Number(target1RM)
          const workingWeight = Number(workingLiftWeight)
          if (!Number.isFinite(existing1RM) || existing1RM <= 0) throw new Error('请填写有效的现有 1RM')
          if (!Number.isFinite(workingWeight) || workingWeight <= 0) throw new Error('请填写有效的做组重量')
          if (workingWeight >= existing1RM) throw new Error('做组重量必须小于 1RM')
          const estimatedReps = estimateRepsFromTotalWeightAndTarget1RM(existing1RM, workingWeight)
          finish({
            estimated_1rm: existing1RM,
            final_score: existing1RM * coeff,
            coefficient: coeff,
            computed_reps: Number(estimatedReps.toFixed(1)),
            adjusted_used_weight: workingWeight
          })
          return
        }

        throw new Error('三大项不支持做组极限估算')
      }

      if (isBenchBasedExercise(exerciseType)) {
        const dots = computeDOTSCoefficient(bw, isMale)
        const multiplier = exerciseType === 'strict_press' ? STRICT_PRESS_MULTIPLIER : BARBELL_CURL_MULTIPLIER

        if (mode === 'forward') {
          const workingWeight = Number(liftWeight)
          const repCount = Number(reps)
          if (!Number.isFinite(workingWeight) || workingWeight <= 0) throw new Error('请填写有效的做组重量')
          if (!Number.isFinite(repCount) || repCount <= 0) throw new Error('请填写有效的完成次数')
          const adjusted = workingWeight - penalty
          if (adjusted <= 0) throw new Error('惩罚重量过高，调整后的重量必须大于 0')
          const estimated1RM = estimateTotal1RMFromTotalWeightAndReps(adjusted, repCount)
          finish({
            estimated_1rm: estimated1RM,
            final_score: estimated1RM * dots * multiplier,
            coefficient: dots,
            adjusted_used_weight: adjusted
          })
          return
        }

        if (mode === 'reverse_weight') {
          const existing1RM = Number(target1RM)
          const repCount = Number(reps)
          if (!Number.isFinite(existing1RM) || existing1RM <= 0) throw new Error('请填写有效的现有 1RM')
          if (!Number.isFinite(repCount) || repCount <= 0) throw new Error('请填写有效的完成次数')
          const computedWeight = invertTotalWeightForTarget1RM(existing1RM, repCount)
          finish({
            estimated_1rm: existing1RM,
            final_score: existing1RM * dots * multiplier,
            coefficient: dots,
            computed_added_weight: computedWeight
          })
          return
        }

        if (mode === 'reverse_reps') {
          const existing1RM = Number(target1RM)
          const workingWeight = Number(workingLiftWeight)
          if (!Number.isFinite(existing1RM) || existing1RM <= 0) throw new Error('请填写有效的现有 1RM')
          if (!Number.isFinite(workingWeight) || workingWeight <= 0) throw new Error('请填写有效的做组重量')
          if (workingWeight >= existing1RM) throw new Error('做组重量必须小于 1RM')
          const estimatedReps = estimateRepsFromTotalWeightAndTarget1RM(existing1RM, workingWeight)
          finish({
            estimated_1rm: existing1RM,
            final_score: existing1RM * dots * multiplier,
            coefficient: dots,
            computed_reps: Number(estimatedReps.toFixed(1)),
            adjusted_used_weight: workingWeight
          })
          return
        }

        throw new Error('该动作不支持做组极限估算')
      }

      if (!isUpperBodyExercise(exerciseType)) {
        throw new Error('未知运动类型')
      }
      if (loadingFormula) {
        throw new Error('公式加载中，请稍后再试')
      }
      if (!currentFormula) {
        throw new Error('未找到对应性别/动作的公式')
      }

      const coefficient = computeCoefficient(bw, currentFormula)

      if (mode === 'forward') {
        const added = Number(addedWeight)
        const repCount = Number(reps)
        if (!Number.isFinite(added)) throw new Error('请填写附加负重')
        if (!Number.isFinite(repCount) || repCount < 1 || repCount > 36) throw new Error('完成次数需在 1-36 之间')
        const adjustedAdded = added - penalty
        const totalWorkingWeight = bw + adjustedAdded
        if (totalWorkingWeight <= 0) throw new Error('惩罚重量过高，导致总重量无效')
        const total1RM = estimateTotal1RMFromTotalWeightAndReps(totalWorkingWeight, repCount)
        const added1RMValue = total1RM - bw
        const rawScore = total1RM * coefficient
        const finalScore = exerciseType === 'weighted_dips' ? rawScore / 1.3 : rawScore
        finish({
          estimated_1rm: added1RMValue,
          final_score: finalScore,
          coefficient,
          adjusted_used_weight: adjustedAdded
        })
        return
      }

      if (mode === 'reverse_weight') {
        const existingAdded1RM = Number(added1RM)
        const repCount = Number(reps)
        if (!Number.isFinite(existingAdded1RM)) throw new Error('请填写负重 1RM')
        if (!Number.isFinite(repCount) || repCount < 1 || repCount > 36) throw new Error('完成次数需在 1-36 之间')
        const targetTotal1RM = bw + existingAdded1RM
        const totalWorkingWeight = invertTotalWeightForTarget1RM(targetTotal1RM, repCount)
        const adjustedAdded = totalWorkingWeight - bw
        const computedAdded = adjustedAdded + penalty
        const rawScore = targetTotal1RM * coefficient
        const finalScore = exerciseType === 'weighted_dips' ? rawScore / 1.3 : rawScore
        finish({
          estimated_1rm: existingAdded1RM,
          final_score: finalScore,
          coefficient,
          computed_added_weight: computedAdded,
          adjusted_used_weight: adjustedAdded
        })
        return
      }

      if (mode === 'reverse_reps') {
        const existingAdded1RM = Number(added1RM)
        const workingAdded = Number(workingAddedWeight)
        if (!Number.isFinite(existingAdded1RM)) throw new Error('请填写负重 1RM')
        if (!Number.isFinite(workingAdded)) throw new Error('请填写做组重量（附加负重）')
        const targetTotal1RM = bw + existingAdded1RM
        const adjustedAdded = workingAdded - penalty
        const totalWorkingWeight = bw + adjustedAdded
        if (totalWorkingWeight <= 0) throw new Error('输入导致总重量无效')
        const estimatedReps = estimateRepsForTarget1RMContinuous(targetTotal1RM, totalWorkingWeight)
        const rawScore = targetTotal1RM * coefficient
        const finalScore = exerciseType === 'weighted_dips' ? rawScore / 1.3 : rawScore
        finish({
          estimated_1rm: existingAdded1RM,
          final_score: finalScore,
          coefficient,
          computed_reps: Number(estimatedReps.toFixed(1)),
          adjusted_used_weight: adjustedAdded
        })
        return
      }

      if (mode === 'day_max') {
        const setCount = Number(sets)
        const repCount = Number(reps)
        const added = Number(addedWeight)
        if (!Number.isFinite(setCount) || setCount <= 0) throw new Error('请填写有效的组数')
        if (!Number.isFinite(repCount) || repCount <= 0) throw new Error('请填写有效的每组次数')
        if (!Number.isFinite(added)) throw new Error('请填写做组重量（附加负重）')

        const firstSet = dayFirstType && dayFirstValue.trim() !== ''
          ? { type: dayFirstType, value: Number(dayFirstValue) }
          : undefined
        const lastSet = dayLastType && dayLastValue.trim() !== ''
          ? { type: dayLastType, value: Number(dayLastValue) }
          : undefined

        if (!firstSet && !lastSet) {
          throw new Error('请至少输入第一组或最后一组的信息')
        }
        if (firstSet && !Number.isFinite(firstSet.value)) {
          throw new Error('请填写有效的第一组信息')
        }
        if (lastSet && !Number.isFinite(lastSet.value)) {
          throw new Error('请填写有效的最后一组信息')
        }

        const { total1RM, added1RM: dayMaxAdded1RM } = estimateDayMaxFromSets({
          bodyweight: bw,
          addedWeight: added,
          penaltyWeight: penalty,
          sets: setCount,
          reps: repCount,
          restCat: (restCat || 'long') as RestCat,
          firstSet,
          lastSet
        })

        const rawScore = total1RM * coefficient
        const finalScore = exerciseType === 'weighted_dips' ? rawScore / 1.3 : rawScore
        finish({
          estimated_1rm: dayMaxAdded1RM,
          final_score: finalScore,
          coefficient,
          adjusted_used_weight: added - penalty
        })
        return
      }
    } catch (e) {
      Taro.showToast({ title: (e as Error)?.message || '请检查输入', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const showPenalty = ['Minor_Cheat', 'Major_Cheat', 'Extreme_Cheat'].includes(formQuality)

  const renderLabel = (title: string, compareText = '') => (
    <View className='label-row'>
      <Text className='label'>{title}</Text>
      {compareText ? <Text className='label-compare'>{compareText}</Text> : null}
    </View>
  )

  return (
    <View className={`calc-page theme-${effectiveTheme}`}>
      <ScrollView className='calc-scroll' scrollY>
        <View className='calc-card'>
          <View className='calc-form-wrap'>
            <View className='form-row'>
              {renderLabel('运动类型', getTextCompareText('exerciseType', (value) => getOptionLabel(EXERCISE_OPTIONS, value)))}
              <Picker
                mode='selector'
                range={EXERCISE_OPTIONS}
                rangeKey='label'
                value={Math.max(0, EXERCISE_OPTIONS.findIndex((option) => option.value === exerciseType))}
                onChange={(e) => {
                  const index = Number(e.detail.value)
                  if (index < 0) return
                  const nextExerciseType = EXERCISE_OPTIONS[index].value
                  patchDraft({
                    exerciseType: nextExerciseType,
                    mode: !isUpperBodyExercise(nextExerciseType) && mode === 'day_max' ? 'forward' : mode
                  })
                }}
              >
                <View className='picker-value'>{getOptionLabel(EXERCISE_OPTIONS, exerciseType)}</View>
              </Picker>
            </View>

            <View className='form-row'>
              {renderLabel('计算模式', getTextCompareText('mode', (value) => getOptionLabel(MODE_OPTIONS, value as CalcMode)))}
              <Picker
                mode='selector'
                range={availableModeOptions}
                rangeKey='label'
                value={Math.max(0, availableModeOptions.findIndex((option) => option.value === mode))}
                onChange={(e) => {
                  const index = Number(e.detail.value)
                  if (index >= 0) patchDraft({ mode: availableModeOptions[index].value })
                }}
              >
                <View className='picker-value'>{getOptionLabel(availableModeOptions, mode)}</View>
              </Picker>
            </View>

            <View className='form-row'>
              {renderLabel('性别', getTextCompareText('gender', (value) => getOptionLabel(GENDER_OPTIONS, value as Gender)))}
              <Picker
                mode='selector'
                range={GENDER_OPTIONS}
                rangeKey='label'
                value={gender ? Math.max(0, GENDER_OPTIONS.findIndex((option) => option.value === gender)) : 0}
                onChange={(e) => {
                  const index = Number(e.detail.value)
                  if (index >= 0) patchDraft({ gender: GENDER_OPTIONS[index].value })
                }}
              >
                <View className='picker-value'>{gender ? getOptionLabel(GENDER_OPTIONS, gender) : '请选择'}</View>
              </Picker>
            </View>

            <View className='form-row'>
              {renderLabel('体重（kg）', getNumericCompareText('bodyweight'))}
              <Input className='input' type='digit' placeholder='例如 70.5' value={bodyweight} onInput={(e) => patchDraft({ bodyweight: e.detail.value })} />
            </View>

            {isUpperBodyExercise(exerciseType) && mode === 'forward' && (
              <View className='form-row'>
                {renderLabel('附加负重（kg）', getNumericCompareText('addedWeight'))}
                <Input className='input' type='digit' placeholder='例如 20' value={addedWeight} onInput={(e) => patchDraft({ addedWeight: e.detail.value })} />
              </View>
            )}

            {isUpperBodyExercise(exerciseType) && mode === 'reverse_weight' && (
              <View className='form-row'>
                {renderLabel('目标负重 1RM（kg）', getNumericCompareText('added1RM'))}
                <Input className='input' type='digit' placeholder='例如 50' value={added1RM} onInput={(e) => patchDraft({ added1RM: e.detail.value })} />
              </View>
            )}

            {isUpperBodyExercise(exerciseType) && mode === 'reverse_reps' && (
              <>
                <View className='form-row'>
                  {renderLabel('目标负重 1RM（kg）', getNumericCompareText('added1RM'))}
                  <Input className='input' type='digit' placeholder='例如 50' value={added1RM} onInput={(e) => patchDraft({ added1RM: e.detail.value })} />
                </View>
                <View className='form-row'>
                  {renderLabel('做组重量·附加负重（kg）', getNumericCompareText('workingAddedWeight'))}
                  <Input className='input' type='digit' placeholder='例如 20' value={workingAddedWeight} onInput={(e) => patchDraft({ workingAddedWeight: e.detail.value })} />
                </View>
              </>
            )}

            {(isPowerliftingExercise(exerciseType) || isBenchBasedExercise(exerciseType)) && mode === 'forward' && (
              <View className='form-row'>
                {renderLabel('做组重量（kg）', getNumericCompareText('liftWeight'))}
                <Input className='input' type='digit' placeholder='例如 100' value={liftWeight} onInput={(e) => patchDraft({ liftWeight: e.detail.value })} />
              </View>
            )}

            {(isPowerliftingExercise(exerciseType) || isBenchBasedExercise(exerciseType)) && (mode === 'reverse_weight' || mode === 'reverse_reps') && (
              <>
                <View className='form-row'>
                  {renderLabel('目标 1RM（kg）', getNumericCompareText('target1RM'))}
                  <Input className='input' type='digit' placeholder='例如 200' value={target1RM} onInput={(e) => patchDraft({ target1RM: e.detail.value })} />
                </View>
                {mode === 'reverse_reps' && (
                  <View className='form-row'>
                    {renderLabel('做组重量（kg）', getNumericCompareText('workingLiftWeight'))}
                    <Input className='input' type='digit' placeholder='例如 150' value={workingLiftWeight} onInput={(e) => patchDraft({ workingLiftWeight: e.detail.value })} />
                  </View>
                )}
              </>
            )}

            <View className='form-row'>
              {renderLabel(mode === 'day_max' ? '每组次数' : '完成次数', getNumericCompareText('reps'))}
              <Input className='input' type='number' placeholder='例如 5' value={reps} onInput={(e) => patchDraft({ reps: e.detail.value })} />
            </View>

            {mode === 'day_max' && isUpperBodyExercise(exerciseType) && (
              <View className='calc-section'>
                <Text className='calc-section-hint'>
                  做组极限估算会结合组数、休息和第一组/最后一组的完成情况估算当天负重极限。若两者都填写，第一组权重更高。
                </Text>

                <View className='form-row'>
                  {renderLabel('做组重量（附加负重 kg）', getNumericCompareText('addedWeight'))}
                  <Input className='input' type='digit' placeholder='例如 20' value={addedWeight} onInput={(e) => patchDraft({ addedWeight: e.detail.value })} />
                </View>

                <View className='form-row'>
                  {renderLabel('组数', getNumericCompareText('sets'))}
                  <Input className='input' type='number' placeholder='例如 4' value={sets} onInput={(e) => patchDraft({ sets: e.detail.value })} />
                </View>

                <View className='form-row'>
                  {renderLabel('平均休息', getTextCompareText('restCat', (value) => getOptionLabel(REST_OPTIONS, value as RestCat)))}
                  <Picker
                    mode='selector'
                    range={REST_OPTIONS}
                    rangeKey='label'
                    value={restCat ? Math.max(0, REST_OPTIONS.findIndex((option) => option.value === restCat)) : 0}
                    onChange={(e) => {
                      const index = Number(e.detail.value)
                      if (index >= 0) patchDraft({ restCat: REST_OPTIONS[index].value })
                    }}
                  >
                    <View className='picker-value'>{restCat ? getOptionLabel(REST_OPTIONS, restCat) : '请选择'}</View>
                  </Picker>
                </View>

                <View className='form-row'>
                  {renderLabel('第一组信息（可选）', getTextCompareText('dayFirstType', (value) => getOptionLabel(SET_FEEDBACK_TYPE_OPTIONS, value as 'RIR' | 'Achieved')))}
                  <View className='inline-grid'>
                    <Picker
                      mode='selector'
                      range={SET_FEEDBACK_TYPE_OPTIONS}
                      rangeKey='label'
                      value={dayFirstType ? Math.max(0, SET_FEEDBACK_TYPE_OPTIONS.findIndex((option) => option.value === dayFirstType)) : 0}
                      onChange={(e) => {
                        const index = Number(e.detail.value)
                        if (index >= 0) patchDraft({ dayFirstType: SET_FEEDBACK_TYPE_OPTIONS[index].value })
                      }}
                    >
                      <View className='picker-value'>{dayFirstType ? getOptionLabel(SET_FEEDBACK_TYPE_OPTIONS, dayFirstType) : '类型'}</View>
                    </Picker>
                    <Input className='input' type='digit' placeholder='数值' value={dayFirstValue} onInput={(e) => patchDraft({ dayFirstValue: e.detail.value })} />
                  </View>
                </View>

                <View className='form-row'>
                  {renderLabel('最后一组信息（可选）', getTextCompareText('dayLastType', (value) => getOptionLabel(SET_FEEDBACK_TYPE_OPTIONS, value as 'RIR' | 'Achieved')))}
                  <View className='inline-grid'>
                    <Picker
                      mode='selector'
                      range={SET_FEEDBACK_TYPE_OPTIONS}
                      rangeKey='label'
                      value={dayLastType ? Math.max(0, SET_FEEDBACK_TYPE_OPTIONS.findIndex((option) => option.value === dayLastType)) : 0}
                      onChange={(e) => {
                        const index = Number(e.detail.value)
                        if (index >= 0) patchDraft({ dayLastType: SET_FEEDBACK_TYPE_OPTIONS[index].value })
                      }}
                    >
                      <View className='picker-value'>{dayLastType ? getOptionLabel(SET_FEEDBACK_TYPE_OPTIONS, dayLastType) : '类型'}</View>
                    </Picker>
                    <Input className='input' type='digit' placeholder='数值' value={dayLastValue} onInput={(e) => patchDraft({ dayLastValue: e.detail.value })} />
                  </View>
                </View>
              </View>
            )}

            <View className='form-row'>
              {renderLabel('动作质量', getTextCompareText('formQuality', (value) => getOptionLabel(QUALITY_OPTIONS, value)))}
              <Picker
                mode='selector'
                range={QUALITY_OPTIONS}
                rangeKey='label'
                value={formQuality ? Math.max(0, QUALITY_OPTIONS.findIndex((option) => option.value === formQuality)) : 0}
                onChange={(e) => {
                  const index = Number(e.detail.value)
                  if (index < 0) return
                  const nextFormQuality = QUALITY_OPTIONS[index].value
                  patchDraft({
                    formQuality: nextFormQuality,
                    penaltyWeight: ['Minor_Cheat', 'Major_Cheat', 'Extreme_Cheat'].includes(nextFormQuality)
                      ? getPenaltyPreset(nextFormQuality)
                      : penaltyWeight
                  })
                }}
              >
                <View className='picker-value'>{formQuality ? getOptionLabel(QUALITY_OPTIONS, formQuality) : '请选择'}</View>
              </Picker>
            </View>

            {showPenalty && (
              <View className='form-row'>
                {renderLabel('惩罚重量（kg）', getNumericCompareText('penaltyWeight'))}
                <Input
                  className='input'
                  type='digit'
                  value={String(penaltyWeight)}
                  onInput={(e) => patchDraft({ penaltyWeight: Number(e.detail.value) || 0 })}
                />
              </View>
            )}

            {isUpperBodyExercise(exerciseType) && (
              <View className='formula-hint'>
                {loadingFormula ? (
                  <Text className='hint'>正在加载公式…</Text>
                ) : currentFormula ? (
                  <Text className='hint'>公式已加载（{currentFormula.gender} · {currentFormula.exercise_type}）</Text>
                ) : (
                  <Text className='hint warn'>未找到对应公式，请稍后重试</Text>
                )}
              </View>
            )}

            <View className='action-row'>
              <Button className='btn-secondary' onClick={clearPersistedDraft}>
                清空上次输入
              </Button>
              <Button className='btn-calc' onClick={handleCalculate} disabled={submitting}>
                {submitting ? '计算中…' : '开始计算'}
              </Button>
            </View>

            {lastSnapshot?.result ? (
              <View className='calc-last-run-card'>
                <Text className='calc-last-run-title'>上一次正式计算</Text>
                <Text className='calc-last-run-text'>
                  {lastSnapshot.result.final_score.toFixed(isUpperBodyExercise(lastSnapshot.draft.exerciseType) ? 0 : 1)}
                  {isUpperBodyExercise(lastSnapshot.draft.exerciseType) || isBenchBasedExercise(lastSnapshot.draft.exerciseType) ? ' 力量分' : ' DOTS 分'}
                  {' · '}
                  {getOptionLabel(EXERCISE_OPTIONS, lastSnapshot.draft.exerciseType)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
