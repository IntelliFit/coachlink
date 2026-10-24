/**
 * 力量分计算器 - 小程序原生实现（逻辑与网页端一致）
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { buildProfileBodyMetricsPatch } from '@coachlink/core/src/bodyMetrics'
import { useMyBodyMetrics } from '@/hooks/useMyBodyMetrics'
import { SaveBodyToProfileLink } from '@/components/SaveBodyToProfileLink'
import { usePageEnterTrace } from '@/utils/pageTrace'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import { StableInput as Input } from '@/components/StableInput'
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
import {
  streetliftingIndexService,
  type StreetliftingFormula,
  type StreetliftingCalcRecord,
  type StreetliftingCalcSummary
} from '@/services/streetliftingIndexService'
import { studentService } from '@/services/studentService'
import { authService } from '@/services/authService'
import { persistStreetliftingCalcSummaryCache } from '@/utils/streetliftingCalcHistoryCache'
import { ChoiceChips, type ChoiceOption } from './ChoiceChips'
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

// Short labels for the one-tap chips; the long labels above stay for history/compare text.
const EXERCISE_SHORT_LABELS: Record<ExerciseType, string> = {
  weighted_pullup: '负重引体',
  weighted_dips: '负重臂屈伸',
  strict_press: '实力推',
  barbell_curl: '杠铃弯举',
  squat: '深蹲',
  bench: '卧推',
  deadlift: '硬拉'
}

const EXERCISE_CHIP_OPTIONS: ChoiceOption<ExerciseType>[] = EXERCISE_OPTIONS.map((option) => ({
  value: option.value,
  label: EXERCISE_SHORT_LABELS[option.value]
}))

const MODE_SHORT_LABELS: Record<CalcMode, string> = {
  forward: '算力量分',
  reverse_weight: '反推重量',
  reverse_reps: '反推次数',
  day_max: '做组极限'
}

const MODE_HINTS: Record<CalcMode, string> = {
  forward: '输入这次的重量和次数，算 1RM 和力量分。',
  reverse_weight: '给定目标 1RM 和次数，反推每组该用多重。',
  reverse_reps: '给定目标 1RM 和做组重量，反推能做几次。',
  day_max: '根据几组的完成情况，估算今天的负重极限（仅引体/臂屈伸）。'
}

const QUALITY_CHIP_OPTIONS: ChoiceOption<string>[] = [
  { value: 'Competition', label: '比赛级', hint: '标准动作' },
  { value: 'Minor_Cheat', label: '轻微借力', hint: '2-5kg' },
  { value: 'Major_Cheat', label: '严重借力', hint: '5-20kg' },
  { value: 'Extreme_Cheat', label: '超严重借力', hint: '20-50kg' }
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

type SavedCalcResultPayload = {
  result: CalcResult
  exerciseType: ExerciseType
  mode: CalcMode
  gender: string
  bodyweight: string
  reps: string
  workingWeight?: number | null
  summary?: StreetliftingCalcSummary | null
  record?: StreetliftingCalcRecord | null
}

const STORAGE_KEY = 'sl_calc_form_data'
const RESULT_KEY = 'sl_calc_result'
const LAST_RUN_KEY = 'sl_calc_last_run'
const CALCULATOR_PATH = '/streetlifting/index/calculator'

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

function isAuthErrorMessage(message?: string | null) {
  if (!message) return false
  const normalized = String(message).toLowerCase()
  return (
    normalized.includes('用户未登录') ||
    normalized.includes('请先登录') ||
    normalized.includes('登录状态已过期') ||
    normalized.includes('unauthorized') ||
    normalized.includes('token expired') ||
    normalized.includes('invalid token')
  )
}

export default function StreetliftingCalculator() {
  usePageEnterTrace()

  const { effectiveTheme } = useTheme()
  const bodyMetrics = useMyBodyMetrics()
  const authSession = authService.getAuthSession({ normalize: true })
  const isAuthenticated = authSession.isAuthenticated
  const [draft, setDraft] = useState<CalcDraft>(DEFAULT_DRAFT)
  const [formulaMap, setFormulaMap] = useState<Record<string, StreetliftingFormula>>({})
  const [loadingFormula, setLoadingFormula] = useState(true)
  const [formulaState, setFormulaState] = useState<'loading' | 'ready' | 'auth_required' | 'error'>(
    isAuthenticated ? 'loading' : 'auth_required'
  )
  const [formulaErrorMessage, setFormulaErrorMessage] = useState('')
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

  const openLogin = useCallback(() => {
    Taro.navigateTo({ url: authService.buildLoginUrl(CALCULATOR_PATH) })
  }, [])

  const promptLogin = useCallback((content: string) => {
    Taro.showModal({
      title: '登录后可用',
      content,
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          openLogin()
        }
      }
    })
  }, [openLogin])

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

      if (!isAuthenticated) {
        if (!cancelled) {
          setFormulaMap({})
          setFormulaState('auth_required')
          setFormulaErrorMessage('')
          setLoadingFormula(false)
        }
      } else {
        setLoadingFormula(true)
        setFormulaState('loading')
        setFormulaErrorMessage('')
        try {
          const data = await streetliftingIndexService.listFormulas()
          if (!cancelled && data?.formulas) {
            const next: Record<string, StreetliftingFormula> = {}
            data.formulas.forEach((f) => {
              next[`${f.gender}`] = f
            })
            setFormulaMap(next)
            setFormulaState('ready')
          }
        } catch (e) {
          if (!cancelled) {
            console.error('[calculator] listFormulas error:', e)
            const message = (e as Error)?.message || '公式获取失败'
            if (isAuthErrorMessage(message)) {
              setFormulaMap({})
              setFormulaState('auth_required')
              setFormulaErrorMessage('')
            } else {
              setFormulaState('error')
              setFormulaErrorMessage(message)
              Taro.showToast({ title: message, icon: 'none' })
            }
          }
        } finally {
          if (!cancelled) setLoadingFormula(false)
        }
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
  }, [isAuthenticated])

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

  const confirmClearDraft = useCallback(() => {
    Taro.showModal({
      title: '清空已填写的内容？',
      content: '只清空本页的输入，不影响已保存的历史记录。',
      confirmText: '清空',
      success: (res) => {
        if (res.confirm) clearPersistedDraft()
      }
    })
  }, [clearPersistedDraft])

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

  const openHistoryPage = useCallback(() => {
    if (!isAuthenticated) {
      promptLogin('登录后才可以查看你的历史记录和趣味排名。')
      return
    }
    Taro.navigateTo({ url: `/streetlifting/index/calculator/history?exerciseType=${exerciseType}` })
  }, [exerciseType, isAuthenticated, promptLogin])

  const handleCalculate = async () => {
    if (!isAuthenticated) {
      promptLogin('当前页面可以先浏览和填写，但开始计算前需要先登录。')
      return
    }

    setSubmitting(true)

    const finish = async (result: CalcResult) => {
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

      let savedSummary: StreetliftingCalcSummary | null = null
      let savedRecord: StreetliftingCalcRecord | null = null

      try {
        const saveRes = await streetliftingIndexService.saveCalculatorResult({
          sourceSurface: 'weapp',
          exerciseType,
          mode,
          gender: gender as Gender,
          bodyweight: Number(bodyweight),
          addedWeight: addedWeight ? Number(addedWeight) : null,
          added1RM: added1RM ? Number(added1RM) : null,
          workingAddedWeight: workingAddedWeight ? Number(workingAddedWeight) : null,
          liftWeight: liftWeight ? Number(liftWeight) : null,
          target1RM: target1RM ? Number(target1RM) : null,
          workingLiftWeight: workingLiftWeight ? Number(workingLiftWeight) : null,
          reps: reps ? Number(reps) : null,
          sets: sets ? Number(sets) : null,
          restCat: restCat || null,
          dayFirstType: dayFirstType || null,
          dayFirstValue: dayFirstValue ? Number(dayFirstValue) : null,
          dayLastType: dayLastType || null,
          dayLastValue: dayLastValue ? Number(dayLastValue) : null,
          formQuality: formQuality as 'Competition' | 'Minor_Cheat' | 'Major_Cheat' | 'Extreme_Cheat',
          penaltyWeight
        })
        savedSummary = saveRes.summary
        savedRecord = saveRes.record
        if (savedSummary) {
          persistStreetliftingCalcSummaryCache(exerciseType, savedSummary)
        }
      } catch (e) {
        console.error('[calculator] save cloud history error:', e)
      }

      try {
        const payload: SavedCalcResultPayload = {
          result,
          exerciseType,
          mode,
          gender,
          bodyweight,
          reps,
          workingWeight: workingWeightForPoster,
          summary: savedSummary,
          record: savedRecord
        }
        Taro.setStorageSync(RESULT_KEY, JSON.stringify(payload))
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
          await finish({
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
          await finish({
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
          await finish({
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
          await finish({
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
          await finish({
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
          await finish({
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
        await finish({
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

  const renderNumberField = (
    title: string,
    compareKey: keyof CalcDraft,
    value: string,
    onInput: (value: string) => void,
    options: { placeholder: string; unit?: string; type?: 'digit' | 'number'; footer?: ReactNode }
  ) => (
    <View className='calc-field'>
      {renderLabel(title, getNumericCompareText(compareKey))}
      <View className='calc-input-box'>
        <Input
          className='calc-input cl-num'
          type={options.type || 'digit'}
          placeholder={options.placeholder}
          placeholderClass='calc-input-placeholder'
          value={value}
          onInput={(e) => onInput(e.detail.value)}
        />
        {options.unit ? <Text className='calc-input-unit'>{options.unit}</Text> : null}
      </View>
      {options.footer}
    </View>
  )

  const isUpper = isUpperBodyExercise(exerciseType)
  const isBarbell = isPowerliftingExercise(exerciseType) || isBenchBasedExercise(exerciseType)
  // The draft already starts from the profile weight; this only offers to write a changed weight back.
  const bodyweightPatch = bodyMetrics.signedIn
    ? buildProfileBodyMetricsPatch({ weightKg: bodyweight }, bodyMetrics.profile)
    : null
  const formulaProblem = isAuthenticated && isUpper && !loadingFormula && !currentFormula
  const formulaProblemText = formulaState === 'auth_required'
    ? '登录后会自动加载对应公式并开放计算'
    : formulaState === 'error'
      ? formulaErrorMessage || '公式加载失败，请稍后重试'
      : '未找到对应公式，请稍后重试'

  return (
    <View className={`calc-page theme-${effectiveTheme}${effectiveTheme === 'dark' ? ' cl-theme-dark' : ''}`}>
      <ScrollView className='calc-scroll' scrollY>
        <View className='calc-body'>
          <View className='calc-card'>
            <View className='calc-block'>
              {renderLabel('动作', getTextCompareText('exerciseType', (value) => getOptionLabel(EXERCISE_OPTIONS, value)))}
              <ChoiceChips
                layout='scroll'
                options={EXERCISE_CHIP_OPTIONS}
                value={exerciseType}
                onChange={(nextExerciseType) => patchDraft({
                  exerciseType: nextExerciseType,
                  mode: !isUpperBodyExercise(nextExerciseType) && mode === 'day_max' ? 'forward' : mode
                })}
              />
            </View>
            <View className='calc-block'>
              {renderLabel('算什么', getTextCompareText('mode', (value) => getOptionLabel(MODE_OPTIONS, value as CalcMode)))}
              <ChoiceChips
                columns={availableModeOptions.length >= 4 ? 4 : 3}
                options={availableModeOptions.map((option) => ({ value: option.value, label: MODE_SHORT_LABELS[option.value] }))}
                value={mode}
                onChange={(nextMode) => patchDraft({ mode: nextMode })}
              />
              <Text className='calc-block__hint'>{MODE_HINTS[mode]}</Text>
            </View>
            <View className='calc-block'>
              {renderLabel('性别', getTextCompareText('gender', (value) => getOptionLabel(GENDER_OPTIONS, value as Gender)))}
              <ChoiceChips options={GENDER_OPTIONS} value={gender} onChange={(nextGender) => patchDraft({ gender: nextGender })} />
            </View>
          </View>

          <View className='calc-card'>
            <Text className='calc-card__title'>{mode === 'forward' ? '这次的成绩' : mode === 'day_max' ? '做组情况' : '目标与条件'}</Text>
            <View className='calc-grid'>
              {renderNumberField('体重', 'bodyweight', bodyweight, (value) => patchDraft({ bodyweight: value }), {
                placeholder: '70.5',
                unit: 'kg',
                footer: (
                  <SaveBodyToProfileLink
                    patch={bodyweightPatch}
                    profileEmpty={bodyMetrics.profile.weightKg === null}
                    onSave={bodyMetrics.saveToProfile}
                  />
                )
              })}

              {isUpper && mode === 'forward' && renderNumberField('附加负重', 'addedWeight', addedWeight, (value) => patchDraft({ addedWeight: value }), { placeholder: '20', unit: 'kg' })}

              {isUpper && (mode === 'reverse_weight' || mode === 'reverse_reps') && renderNumberField('目标负重 1RM', 'added1RM', added1RM, (value) => patchDraft({ added1RM: value }), { placeholder: '50', unit: 'kg' })}

              {isUpper && mode === 'reverse_reps' && renderNumberField('做组附加负重', 'workingAddedWeight', workingAddedWeight, (value) => patchDraft({ workingAddedWeight: value }), { placeholder: '20', unit: 'kg' })}

              {isBarbell && mode === 'forward' && renderNumberField('做组重量', 'liftWeight', liftWeight, (value) => patchDraft({ liftWeight: value }), { placeholder: '100', unit: 'kg' })}

              {isBarbell && (mode === 'reverse_weight' || mode === 'reverse_reps') && renderNumberField('目标 1RM', 'target1RM', target1RM, (value) => patchDraft({ target1RM: value }), { placeholder: '200', unit: 'kg' })}

              {isBarbell && mode === 'reverse_reps' && renderNumberField('做组重量', 'workingLiftWeight', workingLiftWeight, (value) => patchDraft({ workingLiftWeight: value }), { placeholder: '150', unit: 'kg' })}

              {mode === 'day_max' && isUpper && renderNumberField('做组附加负重', 'addedWeight', addedWeight, (value) => patchDraft({ addedWeight: value }), { placeholder: '20', unit: 'kg' })}

              {renderNumberField(mode === 'day_max' ? '每组次数' : '完成次数', 'reps', reps, (value) => patchDraft({ reps: value }), { placeholder: '5', unit: '次', type: 'number' })}

              {mode === 'day_max' && isUpper && renderNumberField('组数', 'sets', sets, (value) => patchDraft({ sets: value }), { placeholder: '4', unit: '组', type: 'number' })}
            </View>

            {mode === 'day_max' && isUpper && (
              <View className='calc-day-max'>
                <View className='calc-block'>
                  {renderLabel('平均休息', getTextCompareText('restCat', (value) => getOptionLabel(REST_OPTIONS, value as RestCat)))}
                  <ChoiceChips columns={4} options={REST_OPTIONS} value={restCat} onChange={(nextRest) => patchDraft({ restCat: nextRest })} />
                </View>
                {([
                  ['第一组（可选）', 'dayFirstType', dayFirstType, dayFirstValue, 'dayFirstValue'],
                  ['最后一组（可选）', 'dayLastType', dayLastType, dayLastValue, 'dayLastValue']
                ] as const).map(([title, typeKey, typeValue, numberValue, valueKey]) => (
                  <View key={typeKey} className='calc-block'>
                    {renderLabel(title, getTextCompareText(typeKey, (value) => getOptionLabel(SET_FEEDBACK_TYPE_OPTIONS, value as 'RIR' | 'Achieved')))}
                    <View className='calc-feedback-row'>
                      <ChoiceChips
                        options={SET_FEEDBACK_TYPE_OPTIONS}
                        value={typeValue}
                        onChange={(nextType) => patchDraft(typeKey === 'dayFirstType' ? { dayFirstType: nextType } : { dayLastType: nextType })}
                      />
                      <View className='calc-input-box calc-input-box--compact'>
                        <Input
                          className='calc-input cl-num'
                          type='digit'
                          placeholder='数值'
                          placeholderClass='calc-input-placeholder'
                          value={numberValue}
                          onInput={(e) => patchDraft(valueKey === 'dayFirstValue' ? { dayFirstValue: e.detail.value } : { dayLastValue: e.detail.value })}
                        />
                      </View>
                    </View>
                  </View>
                ))}
                <Text className='calc-block__hint'>
                  结合组数、休息和第一组/最后一组的完成情况估算当天负重极限；两组都填时第一组权重更高。
                </Text>
              </View>
            )}
          </View>

          <View className='calc-card'>
            {renderLabel('动作质量', getTextCompareText('formQuality', (value) => getOptionLabel(QUALITY_OPTIONS, value)))}
            <ChoiceChips
              options={QUALITY_CHIP_OPTIONS}
              value={formQuality}
              onChange={(nextFormQuality) => patchDraft({
                formQuality: nextFormQuality,
                penaltyWeight: ['Minor_Cheat', 'Major_Cheat', 'Extreme_Cheat'].includes(nextFormQuality)
                  ? getPenaltyPreset(nextFormQuality)
                  : penaltyWeight
              })}
            />
            {showPenalty && (
              <View className='calc-penalty'>
                {renderNumberField('借力扣除', 'penaltyWeight', String(penaltyWeight), (value) => patchDraft({ penaltyWeight: Number(value) || 0 }), { placeholder: '0', unit: 'kg' })}
              </View>
            )}
          </View>

          {!isAuthenticated && (
            <View className='calc-notice' onClick={openLogin}>
              <View className='calc-notice__copy'>
                <Text className='calc-notice__title'>登录后才能正式计算</Text>
                <Text className='calc-notice__desc'>可以先填写参数；计算、保存历史和趣味排名需要登录。</Text>
              </View>
              <Text className='calc-notice__action'>去登录</Text>
            </View>
          )}

          {formulaProblem ? <Text className='calc-formula-warn'>{formulaProblemText}</Text> : null}

          <View className='calc-card calc-card--list'>
            {lastSnapshot?.result ? (
              <View className='calc-row'>
                <Text className='calc-row__label'>上一次计算</Text>
                <Text className='calc-row__value cl-num'>
                  {lastSnapshot.result.final_score.toFixed(isUpperBodyExercise(lastSnapshot.draft.exerciseType) ? 0 : 1)}
                  {isUpperBodyExercise(lastSnapshot.draft.exerciseType) || isBenchBasedExercise(lastSnapshot.draft.exerciseType) ? ' 力量分' : ' DOTS'}
                  {' · '}
                  {EXERCISE_SHORT_LABELS[lastSnapshot.draft.exerciseType] || getOptionLabel(EXERCISE_OPTIONS, lastSnapshot.draft.exerciseType)}
                </Text>
              </View>
            ) : null}
            <View className={`calc-row calc-row--link ${lastSnapshot?.result ? 'calc-row--divided' : ''}`} onClick={openHistoryPage}>
              <View className='calc-row__copy'>
                <Text className='calc-row__label calc-row__label--strong'>我的历史与趣味排名</Text>
                <Text className='calc-row__sub'>历史最佳、较上次变化和当前排名</Text>
              </View>
              <Text className='calc-row__arrow'>›</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View className='calc-footer'>
        <View className='calc-footer__clear' onClick={confirmClearDraft}>
          <Text className='calc-footer__clear-text'>清空</Text>
        </View>
        <Button className={`calc-footer__primary ${isAuthenticated && submitting ? 'calc-footer__primary--busy' : ''}`} onClick={handleCalculate} disabled={isAuthenticated && submitting}>
          {!isAuthenticated ? '登录后开始计算' : submitting ? '计算中…' : loadingFormula && isUpper ? '正在加载公式…' : '开始计算'}
        </Button>
      </View>
    </View>
  )
}
