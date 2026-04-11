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
  getScoreLevel,
  generateRMTable,
  STRICT_PRESS_MULTIPLIER,
  BARBELL_CURL_MULTIPLIER
} from '@/utils/streetliftingCalc'
import { streetliftingIndexService, type StreetliftingFormula } from '@/services/streetliftingIndexService'
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
  const [result, setResult] = useState<CalcResult | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
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
    }
    run()
    return () => { cancelled = true }
  }, [])

  const penalty = ['Minor_Cheat', 'Major_Cheat', 'Extreme_Cheat'].includes(formQuality) ? penaltyWeight : 0
  const currentFormula = gender && isUpperBodyExercise(exerciseType) ? formulaMap[gender] || null : null

  const handleCalculate = () => {
    setSubmitting(true)
    setResult(null)
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
          setResult({
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
          setResult({
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
          setResult({
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
          setResult({
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
          setResult({
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
          setResult({
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
        setResult({
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
        setResult({
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
        setResult({
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

  const scoreLevel = result ? getScoreLevel(result.final_score, exerciseType) : null
  const showPenalty = ['Minor_Cheat', 'Major_Cheat', 'Extreme_Cheat'].includes(formQuality)
  const bwNum = Number(bodyweight) || 0
  const rmTable = result
    ? generateRMTable(isUpperBodyExercise(exerciseType) ? bwNum : 0, result.estimated_1rm)
    : []

  return (
    <View className='calc-page'>
      <ScrollView className='calc-scroll' scrollY>
        <View className='calc-card'>
          <Text className='calc-title'>力量分计算器</Text>
          <Text className='calc-desc'>与网页端 coachlink.fit 逻辑一致，无需跳转网页。</Text>

          <View className='form-row'>
            <Text className='label'>运动类型</Text>
            <Picker
              mode='selector'
              range={EXERCISE_OPTIONS}
              rangeKey='label'
              value={EXERCISE_OPTIONS.findIndex((o) => o.value === exerciseType)}
              onChange={(e) => {
                const i = Number(e.detail.value)
                if (i >= 0) setExerciseType(EXERCISE_OPTIONS[i].value)
                setResult(null)
              }}
            >
              <View className='picker-value'>{EXERCISE_OPTIONS.find((o) => o.value === exerciseType)?.label || '请选择'}</View>
            </Picker>
          </View>

          <View className='form-row'>
            <Text className='label'>计算模式</Text>
            <Picker
              mode='selector'
              range={MODE_OPTIONS}
              rangeKey='label'
              value={MODE_OPTIONS.findIndex((o) => o.value === mode)}
              onChange={(e) => {
                const i = Number(e.detail.value)
                if (i >= 0) setMode(MODE_OPTIONS[i].value)
                setResult(null)
              }}
            >
              <View className='picker-value'>{MODE_OPTIONS.find((o) => o.value === mode)?.label || '请选择'}</View>
            </Picker>
          </View>

          <View className='form-row'>
            <Text className='label'>性别</Text>
            <Picker
              mode='selector'
              range={GENDER_OPTIONS}
              rangeKey='label'
              value={gender ? GENDER_OPTIONS.findIndex((o) => o.value === gender) : 0}
              onChange={(e) => {
                const i = Number(e.detail.value)
                if (i >= 0) setGender(GENDER_OPTIONS[i].value)
                setResult(null)
              }}
            >
              <View className='picker-value'>{gender ? GENDER_OPTIONS.find((o) => o.value === gender)?.label : '请选择'}</View>
            </Picker>
          </View>

          <View className='form-row'>
            <Text className='label'>体重（kg）</Text>
            <Input
              className='input'
              type='digit'
              placeholder='例如 70.5'
              value={bodyweight}
              onInput={(e) => { setBodyweight(e.detail.value); setResult(null) }}
            />
          </View>

          {isUpperBodyExercise(exerciseType) && mode === 'forward' && (
            <View className='form-row'>
              <Text className='label'>附加负重（kg）</Text>
              <Input
                className='input'
                type='digit'
                placeholder='例如 20'
                value={addedWeight}
                onInput={(e) => { setAddedWeight(e.detail.value); setResult(null) }}
              />
            </View>
          )}
          {isUpperBodyExercise(exerciseType) && mode === 'reverse_weight' && (
            <View className='form-row'>
              <Text className='label'>目标负重1RM（kg）</Text>
              <Input
                className='input'
                type='digit'
                placeholder='例如 50'
                value={added1RM}
                onInput={(e) => { setAdded1RM(e.detail.value); setResult(null) }}
              />
            </View>
          )}
          {isUpperBodyExercise(exerciseType) && mode === 'reverse_reps' && (
            <>
              <View className='form-row'>
                <Text className='label'>目标负重1RM（kg）</Text>
                <Input className='input' type='digit' placeholder='例如 50' value={added1RM} onInput={(e) => { setAdded1RM(e.detail.value); setResult(null) }} />
              </View>
              <View className='form-row'>
                <Text className='label'>做组重量·附加负重（kg）</Text>
                <Input className='input' type='digit' placeholder='例如 20' value={workingAddedWeight} onInput={(e) => { setWorkingAddedWeight(e.detail.value); setResult(null) }} />
              </View>
            </>
          )}

          {(isPowerliftingExercise(exerciseType) || isBenchBasedExercise(exerciseType)) && mode === 'forward' && (
            <View className='form-row'>
              <Text className='label'>做组重量（kg）</Text>
              <Input className='input' type='digit' placeholder='例如 100' value={liftWeight} onInput={(e) => { setLiftWeight(e.detail.value); setResult(null) }} />
            </View>
          )}
          {(isPowerliftingExercise(exerciseType) || isBenchBasedExercise(exerciseType)) && (mode === 'reverse_weight' || mode === 'reverse_reps') && (
            <>
              <View className='form-row'>
                <Text className='label'>目标1RM（kg）</Text>
                <Input className='input' type='digit' placeholder='例如 200' value={target1RM} onInput={(e) => { setTarget1RM(e.detail.value); setResult(null) }} />
              </View>
              {mode === 'reverse_reps' && (
                <View className='form-row'>
                  <Text className='label'>做组重量（kg）</Text>
                  <Input className='input' type='digit' placeholder='例如 150' value={workingLiftWeight} onInput={(e) => { setWorkingLiftWeight(e.detail.value); setResult(null) }} />
                </View>
              )}
            </>
          )}

          <View className='form-row'>
            <Text className='label'>{mode === 'day_max' ? '每组次数' : '完成次数'}</Text>
            <Input className='input' type='number' placeholder='例如 5' value={reps} onInput={(e) => { setReps(e.detail.value); setResult(null) }} />
          </View>

          <View className='form-row'>
            <Text className='label'>动作质量</Text>
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
                setResult(null)
              }}
            >
              <View className='picker-value'>{formQuality ? QUALITY_OPTIONS.find((o) => o.value === formQuality)?.label : '请选择'}</View>
            </Picker>
          </View>

          {showPenalty && (
            <View className='form-row'>
              <Text className='label'>惩罚重量（kg）</Text>
              <Input
                className='input'
                type='digit'
                value={String(penaltyWeight)}
                onInput={(e) => { setPenaltyWeight(Number(e.detail.value) || 0); setResult(null) }}
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

          {result && (
            <View className='result-box'>
              <Text className='result-title'>计算结果</Text>
              {scoreLevel && (
                <View className='result-level'>
                  <Text>{scoreLevel.level}</Text>
                </View>
              )}
              {result.adjusted_used_weight !== undefined && (
                <Text className='result-line'>实际用于计算的重量：{result.adjusted_used_weight.toFixed(1)} kg</Text>
              )}
              {result.computed_added_weight !== undefined && (
                <Text className='result-line'>反推做组重量：{result.computed_added_weight.toFixed(1)} kg</Text>
              )}
              {result.computed_reps !== undefined && (
                <Text className='result-line'>反推可完成次数：{result.computed_reps} 次</Text>
              )}
              <View className='result-grid'>
                <View className='result-item'>
                  <Text className='result-item-label'>{isUpperBodyExercise(exerciseType) ? '估算负重1RM' : '估算1RM'}</Text>
                  <Text className='result-item-value'>{result.estimated_1rm.toFixed(1)} kg</Text>
                </View>
                <View className='result-item'>
                  <Text className='result-item-label'>{isUpperBodyExercise(exerciseType) || isBenchBasedExercise(exerciseType) ? '力量分（/500）' : 'DOTS 分'}</Text>
                  <Text className='result-item-value score'>{result.final_score.toFixed(isUpperBodyExercise(exerciseType) ? 0 : 1)}</Text>
                </View>
              </View>
              <View className='rm-table-wrap'>
                <Text className='rm-table-title'>RM 对照表</Text>
                <View className='rm-table'>
                  {rmTable.map((row) => (
                    <View key={row.reps} className='rm-row'>
                      <Text>{row.reps}次</Text>
                      <Text>{row.weight.toFixed(1)} kg</Text>
                      <Text>{row.percentage}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
