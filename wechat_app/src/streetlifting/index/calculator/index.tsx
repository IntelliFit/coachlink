/**
 * 力量分计算器 - 小程序原生实现（逻辑与网页端一致）
 */
import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Input, Picker, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  type ExerciseType,
  type CalcMode,
  type Gender,
  isUpperBodyExercise,
  isPowerliftingExercise,
  isBenchBasedExercise,
  computeDOTSCoefficient,
  computeCoefficient,
  estimateTotal1RMFromTotalWeightAndReps,
  invertTotalWeightForTarget1RM,
  estimateRepsForTarget1RMContinuous,
  STRICT_PRESS_MULTIPLIER,
  BARBELL_CURL_MULTIPLIER
} from '@/utils/streetliftingCalc'
import { streetliftingIndexService, type StreetliftingFormula } from '@/services/streetliftingIndexService'
import { studentService } from '@/services/studentService'
import { authService } from '@/services/authService'
import './index.scss'

const EXERCISE_OPTIONS: { label: string; value: ExerciseType }[] = [
  { label: '负重引体向上', value: 'weighted_pullup' },
  { label: '负重双杠臂屈伸', value: 'weighted_dips' },
  { label: '实力推（满分500）', value: 'strict_press' },
  { label: '杠铃弯举（满分500）', value: 'barbell_curl' },
  { label: '深蹲（DOTS）', value: 'squat' },
  { label: '卧推（DOTS）', value: 'bench' },
  { label: '硬拉（DOTS）', value: 'deadlift' }
]

const MODE_OPTIONS: { label: string; value: CalcMode }[] = [
  { label: '正向计算', value: 'forward' },
  { label: '反推做组重量', value: 'reverse_weight' },
  { label: '反推次数', value: 'reverse_reps' }
]

const GENDER_OPTIONS: { label: string; value: Gender }[] = [
  { label: '男性', value: 'Male' },
  { label: '女性', value: 'Female' }
]

const QUALITY_OPTIONS: { label: string; value: string }[] = [
  { label: '比赛级（标准动作）', value: 'Competition' },
  { label: '轻微借力（2-5kg）', value: 'Minor_Cheat' },
  { label: '严重借力（5-20kg）', value: 'Major_Cheat' },
  { label: '超严重借力（20-50kg）', value: 'Extreme_Cheat' }
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

function normalizeGender(g: string): Gender | null {
  const s = String(g).toLowerCase().trim()
  if (s === 'male' || s === 'm' || s === '男' || s === '1') return 'Male'
  if (s === 'female' || s === 'f' || s === '女' || s === '0' || s === '2') return 'Female'
  return null
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

function isExerciseType(v: unknown): v is ExerciseType {
  return typeof v === 'string' && EXERCISE_OPTIONS.some((o) => o.value === v)
}

function isCalcMode(v: unknown): v is CalcMode {
  return typeof v === 'string' && MODE_OPTIONS.some((o) => o.value === v)
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

/** 草稿优先；为空时再使用「上一次正式计算」快照里的同字段，避免输入框空但右侧仍有「较上次」的错位 */
function coalesceDraftField(a: unknown, b: unknown): string {
  const sa = a !== undefined && a !== null ? String(a).trim() : ''
  if (sa !== '') return String(a).trim()
  const sb = b !== undefined && b !== null ? String(b).trim() : ''
  return sb !== '' ? sb : ''
}

export default function StreetliftingCalculator() {
  const [exerciseType, setExerciseType] = useState<ExerciseType>('weighted_pullup')
  const [mode, setMode] = useState<CalcMode>('forward')
  const [gender, setGender] = useState<Gender | ''>('')
  const [bodyweight, setBodyweight] = useState('')
  const [addedWeight, setAddedWeight] = useState('')
  const [added1RM, setAdded1RM] = useState('')
  const [workingAddedWeight, setWorkingAddedWeight] = useState('')
  const [liftWeight, setLiftWeight] = useState('')
  const [target1RM, setTarget1RM] = useState('')
  const [workingLiftWeight, setWorkingLiftWeight] = useState('')
  const [reps, setReps] = useState('')
  const [formQuality, setFormQuality] = useState('')
  const [penaltyWeight, setPenaltyWeight] = useState(3)

  const [formulaMap, setFormulaMap] = useState<Record<string, StreetliftingFormula>>({})
  const [loadingFormula, setLoadingFormula] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [lastSnapshot, setLastSnapshot] = useState<CalcSnapshot | null>(null)
  /** 未完成初始化前禁止把空表单写回 storage，否则会冲掉历史草稿 */
  const [formHydrated, setFormHydrated] = useState(false)

  const draft: CalcDraft = {
    exerciseType,
    mode,
    gender,
    bodyweight,
    addedWeight,
    added1RM,
    workingAddedWeight,
    liftWeight,
    target1RM,
    workingLiftWeight,
    reps,
    formQuality,
    penaltyWeight
  }

  // 加载公式 + 同步读取本地草稿 + 拉取档案（性别/体重优先档案）+ 合并后再允许写回 storage
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const saved = parseStoredDraft(Taro.getStorageSync(STORAGE_KEY))
      const lastSnap = parseLastSnapshot(Taro.getStorageSync(LAST_RUN_KEY))
      const lastD = lastSnap?.draft

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

      // 运动类型 / 模式：草稿优先，缺省用上一次正式计算
      try {
        if (saved && isExerciseType(saved.exerciseType)) {
          setExerciseType(saved.exerciseType)
        } else if (lastD && isExerciseType(lastD.exerciseType)) {
          setExerciseType(lastD.exerciseType)
        }
        if (saved && isCalcMode(saved.mode)) {
          setMode(saved.mode)
        } else if (lastD && isCalcMode(lastD.mode)) {
          setMode(lastD.mode)
        }
      } catch (e) {
        console.error('[calculator] restore exercise/mode error:', e)
      }

      // 性别：档案 > 本地草稿 > 上一次正式计算
      let mergedGender: Gender | '' = ''
      if (profileGender) mergedGender = profileGender
      else if (saved?.gender === 'Male' || saved?.gender === 'Female') mergedGender = saved.gender
      else if (lastD?.gender === 'Male' || lastD?.gender === 'Female') mergedGender = lastD.gender
      setGender(mergedGender)

      const mergedBodyweight =
        profileBodyweightStr !== null
          ? profileBodyweightStr
          : coalesceDraftField(saved?.bodyweight, lastD?.bodyweight)

      setBodyweight(mergedBodyweight)

      // 数字与选项字段：storage 与「上一次正式计算」草稿二选一合并（避免仅存空串导致输入框空白）
      setAddedWeight(coalesceDraftField(saved?.addedWeight, lastD?.addedWeight))
      setAdded1RM(coalesceDraftField(saved?.added1RM, lastD?.added1RM))
      setWorkingAddedWeight(coalesceDraftField(saved?.workingAddedWeight, lastD?.workingAddedWeight))
      setLiftWeight(coalesceDraftField(saved?.liftWeight, lastD?.liftWeight))
      setTarget1RM(coalesceDraftField(saved?.target1RM, lastD?.target1RM))
      setWorkingLiftWeight(coalesceDraftField(saved?.workingLiftWeight, lastD?.workingLiftWeight))
      setReps(coalesceDraftField(saved?.reps, lastD?.reps))
      setFormQuality(coalesceDraftField(saved?.formQuality, lastD?.formQuality))

      let nextPenalty = 3
      if (typeof saved?.penaltyWeight === 'number' && Number.isFinite(saved.penaltyWeight)) {
        nextPenalty = saved.penaltyWeight
      } else if (typeof lastD?.penaltyWeight === 'number' && Number.isFinite(lastD.penaltyWeight)) {
        nextPenalty = lastD.penaltyWeight
      }
      setPenaltyWeight(nextPenalty)

      if (!cancelled && lastSnap) {
        setLastSnapshot(lastSnap)
      }

      if (!cancelled) setFormHydrated(true)
    }
    run()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!formHydrated) return
    try {
      Taro.setStorageSync(STORAGE_KEY, JSON.stringify(draft))
    } catch (e) {
      console.error('[calculator] save form data error:', e)
    }
  }, [
    formHydrated,
    exerciseType, mode, gender, bodyweight,
    addedWeight, added1RM, workingAddedWeight,
    liftWeight, target1RM, workingLiftWeight,
    reps, formQuality, penaltyWeight
  ])

  const penalty = ['Minor_Cheat', 'Major_Cheat', 'Extreme_Cheat'].includes(formQuality) ? penaltyWeight : 0
  const currentFormula = gender && isUpperBodyExercise(exerciseType) ? formulaMap[gender] || null : null

  const saveLastSnapshot = (snapshot: CalcSnapshot) => {
    try {
      Taro.setStorageSync(LAST_RUN_KEY, JSON.stringify(snapshot))
      setLastSnapshot(snapshot)
    } catch (e) {
      console.error('[calculator] save last snapshot error:', e)
    }
  }

  const getOptionLabel = <T extends string>(
    options: Array<{ label: string; value: T }>,
    value: string | undefined
  ) => options.find((item) => item.value === value)?.label || String(value || '')

  const getNumericCompareText = (field: keyof CalcDraft) => {
    if (!lastSnapshot) return ''
    const prevRaw = lastSnapshot.draft?.[field]
    const prevStr = prevRaw !== undefined && prevRaw !== null ? String(prevRaw).trim() : ''
    if (!prevStr) return ''
    const previous = Number(prevRaw)
    if (!Number.isFinite(previous)) return ''

    const curRaw = draft[field]
    const curStr =
      typeof curRaw === 'number' && Number.isFinite(curRaw)
        ? String(curRaw)
        : String(curRaw ?? '').trim()
    // 空输入不应按 0 参与比较，否则会与「上次」产生虚假差值
    if (curStr === '') {
      return `上次 ${prevStr}`
    }
    const current = Number(curStr)
    if (!Number.isFinite(current)) {
      return `上次 ${prevStr}`
    }
    const delta = current - previous
    if (Math.abs(delta) < 0.0001) return `较上次持平`
    const prefix = delta > 0 ? '+' : ''
    return `较上次 ${prefix}${delta.toFixed(field === 'reps' || field === 'penaltyWeight' ? 0 : 1)}`
  }

  const getTextCompareText = (field: keyof CalcDraft, formatter?: (value: string) => string) => {
    if (!lastSnapshot) return ''
    const previous = String(lastSnapshot.draft?.[field] ?? '').trim()
    if (!previous) return ''
    const current = String(draft[field] ?? '').trim()
    const fmt = (v: string) => (formatter ? formatter(v) : v)
    if (current && current === previous) return '较上次一致'
    if (current && current !== previous) return `上次 ${fmt(previous)} · 现 ${fmt(current)}`
    return `上次 ${fmt(previous)}`
  }

  const handleCalculate = () => {
    setSubmitting(true)
    const finish = (res: CalcResult) => {
      try {
        Taro.setStorageSync(RESULT_KEY, JSON.stringify({
          result: res,
          exerciseType,
          mode,
          gender,
          bodyweight,
          reps
        }))
      } catch (e) {
        console.error('[calculator] save result error:', e)
      }
      saveLastSnapshot({
        timestamp: Date.now(),
        draft,
        result: res
      })
      Taro.navigateTo({ url: '/streetlifting/index/calculator/result' })
    }
    try {
      const bw = Number(bodyweight)
      const isMale = gender === 'Male'
      if (!gender || !Number.isFinite(bw) || bw <= 0) {
        throw new Error('请填写性别与体重')
      }
      if (!formQuality) throw new Error('请选择动作质量')

      // 三大项
      if (isPowerliftingExercise(exerciseType)) {
        const coeff = computeDOTSCoefficient(bw, isMale)
        if (mode === 'forward') {
          const lw = Number(liftWeight)
          const r = Number(reps)
          if (!Number.isFinite(lw) || lw <= 0 || !Number.isFinite(r) || r <= 0) throw new Error('请填写做组重量与次数')
          const adjusted = lw - penalty
          if (adjusted <= 0) throw new Error('惩罚重量过高')
          const estimated1RM = estimateTotal1RMFromTotalWeightAndReps(adjusted, r)
          finish({
            estimated_1rm: estimated1RM,
            final_score: estimated1RM * coeff,
            coefficient: coeff,
            adjusted_used_weight: adjusted
          })
          return
        }
        if (mode === 'reverse_weight') {
          const t1 = Number(target1RM)
          const r = Number(reps)
          if (!Number.isFinite(t1) || t1 <= 0 || !Number.isFinite(r) || r <= 0) throw new Error('请填写目标1RM与次数')
          const computed = invertTotalWeightForTarget1RM(t1, r)
          finish({
            estimated_1rm: t1,
            final_score: t1 * coeff,
            coefficient: coeff,
            computed_added_weight: computed
          })
          return
        }
        if (mode === 'reverse_reps') {
          const t1 = Number(target1RM)
          const ww = Number(workingLiftWeight)
          if (!Number.isFinite(t1) || t1 <= 0 || !Number.isFinite(ww) || ww <= 0) throw new Error('请填写目标1RM与做组重量')
          if (ww >= t1) throw new Error('做组重量必须小于1RM')
          const repsCont = estimateRepsForTarget1RMContinuous(t1, ww)
          finish({
            estimated_1rm: t1,
            final_score: t1 * coeff,
            coefficient: coeff,
            computed_reps: Number(repsCont.toFixed(1)),
            adjusted_used_weight: ww
          })
          return
        }
      }

      // 实力推/弯举
      if (isBenchBasedExercise(exerciseType)) {
        const dots = computeDOTSCoefficient(bw, isMale)
        const mult = exerciseType === 'strict_press' ? STRICT_PRESS_MULTIPLIER : BARBELL_CURL_MULTIPLIER
        if (mode === 'forward') {
          const lw = Number(liftWeight)
          const r = Number(reps)
          if (!Number.isFinite(lw) || lw <= 0 || !Number.isFinite(r) || r <= 0) throw new Error('请填写做组重量与次数')
          const adjusted = lw - penalty
          if (adjusted <= 0) throw new Error('惩罚重量过高')
          const estimated1RM = estimateTotal1RMFromTotalWeightAndReps(adjusted, r)
          finish({
            estimated_1rm: estimated1RM,
            final_score: estimated1RM * dots * mult,
            coefficient: dots,
            adjusted_used_weight: adjusted
          })
          return
        }
        if (mode === 'reverse_weight') {
          const t1 = Number(target1RM)
          const r = Number(reps)
          if (!Number.isFinite(t1) || t1 <= 0 || !Number.isFinite(r) || r <= 0) throw new Error('请填写目标1RM与次数')
          const computed = invertTotalWeightForTarget1RM(t1, r)
          finish({
            estimated_1rm: t1,
            final_score: t1 * dots * mult,
            coefficient: dots,
            computed_added_weight: computed
          })
          return
        }
        if (mode === 'reverse_reps') {
          const t1 = Number(target1RM)
          const ww = Number(workingLiftWeight)
          if (!Number.isFinite(t1) || t1 <= 0 || !Number.isFinite(ww) || ww <= 0) throw new Error('请填写目标1RM与做组重量')
          if (ww >= t1) throw new Error('做组重量必须小于1RM')
          const repsCont = estimateRepsForTarget1RMContinuous(t1, ww)
          finish({
            estimated_1rm: t1,
            final_score: t1 * dots * mult,
            coefficient: dots,
            computed_reps: Number(repsCont.toFixed(1)),
            adjusted_used_weight: ww
          })
          return
        }
      }

      // 上肢：引体/臂屈伸
      if (!isUpperBodyExercise(exerciseType)) throw new Error('未知运动类型')
      if (loadingFormula) throw new Error('公式加载中，请稍后再试')
      if (!currentFormula) throw new Error('未找到对应性别/动作的公式')

      const coefficient = computeCoefficient(bw, currentFormula)

      if (mode === 'forward') {
        const added = Number(addedWeight)
        const r = Number(reps)
        if (!Number.isFinite(added)) throw new Error('请填写附加负重')
        if (!Number.isFinite(r) || r < 1 || r > 36) throw new Error('完成次数须在 1-36 之间')
        const adjustedAdded = added - penalty
        const totalWeight = bw + adjustedAdded
        if (totalWeight <= 0) throw new Error('惩罚重量过高，导致总重量无效')
        const total1RM = estimateTotal1RMFromTotalWeightAndReps(totalWeight, r)
        const added1RMVal = total1RM - bw
        const rawScore = total1RM * coefficient
        const finalScore = exerciseType === 'weighted_dips' ? rawScore / 1.3 : rawScore
        finish({
          estimated_1rm: added1RMVal,
          final_score: finalScore,
          coefficient,
          adjusted_used_weight: adjustedAdded
        })
        return
      }

      if (mode === 'reverse_weight') {
        const a1rm = Number(added1RM)
        const r = Number(reps)
        if (!Number.isFinite(a1rm) || !Number.isFinite(r) || r < 1 || r > 36) throw new Error('请填写负重1RM与次数')
        const targetTotal1RM = bw + a1rm
        const totalWorkingWeight = invertTotalWeightForTarget1RM(targetTotal1RM, r)
        const adjustedAdded = totalWorkingWeight - bw
        const computedAdded = adjustedAdded + penalty
        const rawScore = targetTotal1RM * coefficient
        const finalScore = exerciseType === 'weighted_dips' ? rawScore / 1.3 : rawScore
        finish({
          estimated_1rm: a1rm,
          final_score: finalScore,
          coefficient,
          computed_added_weight: computedAdded,
          adjusted_used_weight: adjustedAdded
        })
        return
      }

      if (mode === 'reverse_reps') {
        const a1rm = Number(added1RM)
        const wAdded = Number(workingAddedWeight)
        if (!Number.isFinite(a1rm) || !Number.isFinite(wAdded)) throw new Error('请填写负重1RM与做组重量（附加负重）')
        const targetTotal1RM = bw + a1rm
        const adjustedAdded = wAdded - penalty
        const totalWorkingWeight = bw + adjustedAdded
        if (totalWorkingWeight <= 0) throw new Error('输入导致总重量无效')
        const repsCont = estimateRepsForTarget1RMContinuous(targetTotal1RM, totalWorkingWeight)
        const rawScore = targetTotal1RM * coefficient
        const finalScore = exerciseType === 'weighted_dips' ? rawScore / 1.3 : rawScore
        finish({
          estimated_1rm: a1rm,
          final_score: finalScore,
          coefficient,
          computed_reps: Number(repsCont.toFixed(1)),
          adjusted_used_weight: adjustedAdded
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
    <View className='calc-page'>
      <ScrollView className='calc-scroll' scrollY>
        <View className='calc-card'>
          {/* 表单区域 */}
          <View className='calc-form-wrap'>
            <View className='form-row'>
              {renderLabel('运动类型', getTextCompareText('exerciseType', (value) => getOptionLabel(EXERCISE_OPTIONS, value)))}
              <Picker
                mode='selector'
                range={EXERCISE_OPTIONS}
                rangeKey='label'
                value={EXERCISE_OPTIONS.findIndex((o) => o.value === exerciseType)}
                onChange={(e) => {
                  const i = Number(e.detail.value)
                  if (i >= 0) setExerciseType(EXERCISE_OPTIONS[i].value)
                }}
              >
                <View className='picker-value'>{EXERCISE_OPTIONS.find((o) => o.value === exerciseType)?.label || '请选择'}</View>
              </Picker>
            </View>

            <View className='form-row'>
              {renderLabel('计算模式', getTextCompareText('mode', (value) => getOptionLabel(MODE_OPTIONS, value as CalcMode)))}
              <Picker
                mode='selector'
                range={MODE_OPTIONS}
                rangeKey='label'
                value={MODE_OPTIONS.findIndex((o) => o.value === mode)}
                onChange={(e) => {
                  const i = Number(e.detail.value)
                  if (i >= 0) setMode(MODE_OPTIONS[i].value)
                }}
              >
                <View className='picker-value'>{MODE_OPTIONS.find((o) => o.value === mode)?.label || '请选择'}</View>
              </Picker>
            </View>

            <View className='form-row'>
              {renderLabel('性别', getTextCompareText('gender', (value) => getOptionLabel(GENDER_OPTIONS, value as Gender)))}
              <Picker
                mode='selector'
                range={GENDER_OPTIONS}
                rangeKey='label'
                value={gender ? GENDER_OPTIONS.findIndex((o) => o.value === gender) : 0}
                onChange={(e) => {
                  const i = Number(e.detail.value)
                  if (i >= 0) setGender(GENDER_OPTIONS[i].value)
                }}
              >
                <View className='picker-value'>{gender ? GENDER_OPTIONS.find((o) => o.value === gender)?.label : '请选择'}</View>
              </Picker>
            </View>

            <View className='form-row'>
              {renderLabel('体重（kg）', getNumericCompareText('bodyweight'))}
              <Input
                className='input'
                type='digit'
                placeholder='例如 70.5'
                value={bodyweight}
                onInput={(e) => { setBodyweight(e.detail.value) }}
              />
            </View>

            {isUpperBodyExercise(exerciseType) && mode === 'forward' && (
              <View className='form-row'>
                {renderLabel('附加负重（kg）', getNumericCompareText('addedWeight'))}
                <Input
                  className='input'
                  type='digit'
                  placeholder='例如 20'
                  value={addedWeight}
                  onInput={(e) => { setAddedWeight(e.detail.value) }}
                />
              </View>
            )}
            {isUpperBodyExercise(exerciseType) && mode === 'reverse_weight' && (
              <View className='form-row'>
                {renderLabel('目标负重1RM（kg）', getNumericCompareText('added1RM'))}
                <Input
                  className='input'
                  type='digit'
                  placeholder='例如 50'
                  value={added1RM}
                  onInput={(e) => { setAdded1RM(e.detail.value) }}
                />
              </View>
            )}
            {isUpperBodyExercise(exerciseType) && mode === 'reverse_reps' && (
              <>
                <View className='form-row'>
                  {renderLabel('目标负重1RM（kg）', getNumericCompareText('added1RM'))}
                  <Input className='input' type='digit' placeholder='例如 50' value={added1RM} onInput={(e) => { setAdded1RM(e.detail.value) }} />
                </View>
                <View className='form-row'>
                  {renderLabel('做组重量·附加负重（kg）', getNumericCompareText('workingAddedWeight'))}
                  <Input className='input' type='digit' placeholder='例如 20' value={workingAddedWeight} onInput={(e) => { setWorkingAddedWeight(e.detail.value) }} />
                </View>
              </>
            )}

            {(isPowerliftingExercise(exerciseType) || isBenchBasedExercise(exerciseType)) && mode === 'forward' && (
              <View className='form-row'>
                {renderLabel('做组重量（kg）', getNumericCompareText('liftWeight'))}
                <Input className='input' type='digit' placeholder='例如 100' value={liftWeight} onInput={(e) => { setLiftWeight(e.detail.value) }} />
              </View>
            )}
            {(isPowerliftingExercise(exerciseType) || isBenchBasedExercise(exerciseType)) && (mode === 'reverse_weight' || mode === 'reverse_reps') && (
              <>
                <View className='form-row'>
                  {renderLabel('目标1RM（kg）', getNumericCompareText('target1RM'))}
                  <Input className='input' type='digit' placeholder='例如 200' value={target1RM} onInput={(e) => { setTarget1RM(e.detail.value) }} />
                </View>
                {mode === 'reverse_reps' && (
                  <View className='form-row'>
                    {renderLabel('做组重量（kg）', getNumericCompareText('workingLiftWeight'))}
                    <Input className='input' type='digit' placeholder='例如 150' value={workingLiftWeight} onInput={(e) => { setWorkingLiftWeight(e.detail.value) }} />
                  </View>
                )}
              </>
            )}

            <View className='form-row'>
              {renderLabel(mode === 'day_max' ? '每组次数' : '完成次数', getNumericCompareText('reps'))}
              <Input className='input' type='number' placeholder='例如 5' value={reps} onInput={(e) => { setReps(e.detail.value) }} />
            </View>

            <View className='form-row'>
              {renderLabel('动作质量', getTextCompareText('formQuality', (value) => getOptionLabel(QUALITY_OPTIONS, value)))}
              <Picker
                mode='selector'
                range={QUALITY_OPTIONS}
                rangeKey='label'
                value={formQuality ? QUALITY_OPTIONS.findIndex((o) => o.value === formQuality) : 0}
                onChange={(e) => {
                  const i = Number(e.detail.value)
                  if (i >= 0) {
                    setFormQuality(QUALITY_OPTIONS[i].value)
                    if (QUALITY_OPTIONS[i].value === 'Minor_Cheat') setPenaltyWeight(3)
                    else if (QUALITY_OPTIONS[i].value === 'Major_Cheat') setPenaltyWeight(10)
                    else if (QUALITY_OPTIONS[i].value === 'Extreme_Cheat') setPenaltyWeight(30)
                  }
                }}
              >
                <View className='picker-value'>{formQuality ? QUALITY_OPTIONS.find((o) => o.value === formQuality)?.label : '请选择'}</View>
              </Picker>
            </View>

            {showPenalty && (
              <View className='form-row'>
                {renderLabel('惩罚重量（kg）', getNumericCompareText('penaltyWeight'))}
                <Input
                  className='input'
                  type='digit'
                  value={String(penaltyWeight)}
                  onInput={(e) => { setPenaltyWeight(Number(e.detail.value) || 0) }}
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

            <Button className='btn-calc' onClick={handleCalculate} disabled={submitting}>
              {submitting ? '计算中...' : '开始计算'}
            </Button>

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
