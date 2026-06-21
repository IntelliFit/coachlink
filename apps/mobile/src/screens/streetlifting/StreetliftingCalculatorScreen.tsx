import { useEffect, useMemo, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { IconFont } from '../../components/IconFont'
import { Page } from '../../components/Page'
import { SectionCard } from '../../components/SectionCard'
import { apiClient } from '../../api'
import { colors, radius, shadow, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'
import {
  buildStreetliftingRankingBucketTitle,
  computeStreetliftingCalculatorResult,
  generateRMTable,
  isPowerliftingExercise,
  isUpperBodyExercise,
  type CalcMode,
  type ExerciseType,
  type FormQuality,
  type Gender,
  type RestCat,
  type SetFeedbackType,
  type StreetliftingCalculatorResult,
  type StreetliftingFormulaLike,
} from './streetliftingCalculator'

type Props = NativeStackScreenProps<RootStackParamList, 'StreetliftingCalculator'>

type StreetliftingFormula = StreetliftingFormulaLike & {
  gender: Gender
  exercise_type: 'weighted_pullup' | 'weighted_dips'
}

type CalculatorDraft = {
  exerciseType: ExerciseType
  mode: CalcMode
  gender: Gender
  bodyweight: string
  addedWeight: string
  added1RM: string
  workingAddedWeight: string
  liftWeight: string
  target1RM: string
  workingLiftWeight: string
  reps: string
  sets: string
  restCat: RestCat
  dayFirstType: SetFeedbackType
  dayFirstValue: string
  dayLastType: SetFeedbackType
  dayLastValue: string
  formQuality: FormQuality
  penaltyWeight: string
}

type LastRun = {
  timestamp: number
  draft: CalculatorDraft
  result: StreetliftingCalculatorResult
  cloudSummary?: unknown
}

type Option<T extends string> = {
  label: string
  value: T
  description?: string
}

const STORAGE_KEY = 'sl_calc_form_data'
const LAST_RUN_KEY = 'sl_calc_last_run'

const EXERCISE_OPTIONS: Option<ExerciseType>[] = [
  { label: '负重引体向上', value: 'weighted_pullup', description: '街健 500 分体系' },
  { label: '负重双杠臂屈伸', value: 'weighted_dips', description: '街健 500 分体系' },
  { label: '实力推', value: 'strict_press', description: '按卧推系数折算' },
  { label: '杠铃弯举', value: 'barbell_curl', description: '按卧推系数折算' },
  { label: '深蹲', value: 'squat', description: 'DOTS' },
  { label: '卧推', value: 'bench', description: 'DOTS' },
  { label: '硬拉', value: 'deadlift', description: 'DOTS' },
]

const MODE_OPTIONS: Option<CalcMode>[] = [
  { label: '正向计算', value: 'forward' },
  { label: '反推做组重量', value: 'reverse_weight' },
  { label: '反推次数', value: 'reverse_reps' },
  { label: '做组极限估算', value: 'day_max', description: '仅引体/臂屈伸' },
]

const GENDER_OPTIONS: Option<Gender>[] = [
  { label: '男', value: 'Male' },
  { label: '女', value: 'Female' },
]

const QUALITY_OPTIONS: Option<FormQuality>[] = [
  { label: '比赛级', value: 'Competition', description: '标准动作' },
  { label: '轻微借力', value: 'Minor_Cheat', description: '默认扣 3kg' },
  { label: '严重借力', value: 'Major_Cheat', description: '默认扣 10kg' },
  { label: '超严重借力', value: 'Extreme_Cheat', description: '默认扣 30kg' },
]

const REST_OPTIONS: Option<RestCat>[] = [
  { label: '≤90秒', value: 'short' },
  { label: '90秒-3分钟', value: 'moderate' },
  { label: '3-5分钟', value: 'long' },
  { label: '>5分钟', value: 'very_long' },
]

const FEEDBACK_OPTIONS: Option<SetFeedbackType>[] = [
  { label: 'RIR', value: 'RIR' },
  { label: '实际次数', value: 'Achieved' },
]

const DEFAULT_DRAFT: CalculatorDraft = {
  exerciseType: 'weighted_pullup',
  mode: 'forward',
  gender: 'Male',
  bodyweight: '',
  addedWeight: '',
  added1RM: '',
  workingAddedWeight: '',
  liftWeight: '',
  target1RM: '',
  workingLiftWeight: '',
  reps: '',
  sets: '',
  restCat: 'long',
  dayFirstType: 'RIR',
  dayFirstValue: '',
  dayLastType: 'RIR',
  dayLastValue: '',
  formQuality: 'Minor_Cheat',
  penaltyWeight: '3',
}

function parseNumber(value: string): number | null {
  const n = Number(String(value || '').trim())
  return Number.isFinite(n) ? n : null
}

function formatKg(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return `${value.toFixed(1)}kg`
}

function formatScore(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return value.toFixed(1)
}

function defaultPenalty(formQuality: FormQuality) {
  if (formQuality === 'Competition') return '0'
  if (formQuality === 'Minor_Cheat') return '3'
  if (formQuality === 'Major_Cheat') return '10'
  return '30'
}

function isValidDraft(raw: unknown): raw is CalculatorDraft {
  if (!raw || typeof raw !== 'object') return false
  const draft = raw as Partial<CalculatorDraft>
  return Boolean(draft.exerciseType && draft.mode && draft.gender)
}

function optionLabel<T extends string>(options: Option<T>[], value: T) {
  return options.find((item) => item.value === value)?.label || value
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const active = value === option.value
        return (
          <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{option.label}</Text>
            {option.description ? <Text style={[styles.chipDesc, active && styles.chipDescActive]}>{option.description}</Text> : null}
          </Pressable>
        )
      })}
    </View>
  )
}

function InputField({
  label,
  value,
  onChangeText,
  suffix,
  helper,
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  suffix?: string
  helper?: string
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {suffix ? <Text style={styles.fieldSuffix}>{suffix}</Text> : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder="输入数值"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
      {helper ? <Text style={styles.fieldHelper}>{helper}</Text> : null}
    </View>
  )
}

export function StreetliftingCalculatorScreen({ navigation }: Props) {
  const [draft, setDraft] = useState<CalculatorDraft>(DEFAULT_DRAFT)
  const [formulaMap, setFormulaMap] = useState<Record<string, StreetliftingFormula>>({})
  const [loadingFormula, setLoadingFormula] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [lastRun, setLastRun] = useState<LastRun | null>(null)
  const [saveHint, setSaveHint] = useState('')

  const availableModes = useMemo(
    () => MODE_OPTIONS.filter((option) => option.value !== 'day_max' || isUpperBodyExercise(draft.exerciseType)),
    [draft.exerciseType],
  )
  const currentFormula = useMemo(() => formulaMap[`${draft.exerciseType}:${draft.gender}`] || formulaMap[draft.gender] || null, [draft.exerciseType, draft.gender, formulaMap])

  const patchDraft = (patch: Partial<CalculatorDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      if (!isUpperBodyExercise(next.exerciseType) && next.mode === 'day_max') next.mode = 'forward'
      return next
    })
  }

  useEffect(() => {
    let mounted = true
    async function hydrate() {
      try {
        const [savedDraftRaw, lastRunRaw] = await Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(LAST_RUN_KEY)])
        if (!mounted) return
        if (savedDraftRaw) {
          const parsed = JSON.parse(savedDraftRaw)
          if (isValidDraft(parsed)) setDraft({ ...DEFAULT_DRAFT, ...parsed })
        }
        if (lastRunRaw) {
          const parsed = JSON.parse(lastRunRaw) as LastRun
          if (parsed?.result) setLastRun(parsed)
        }
      } catch {
        // Ignore corrupted local calculator cache.
      }
    }
    hydrate()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    async function loadFormulas() {
      setLoadingFormula(true)
      try {
        const res = await apiClient.request<{ formulas: StreetliftingFormula[] }>('/api/streetlifting-index/formulas/list', { timeoutMs: 12000 })
        if (!mounted) return
        const next: Record<string, StreetliftingFormula> = {}
        ;(res.formulas || []).forEach((formula) => {
          next[`${formula.exercise_type}:${formula.gender}`] = formula
          next[formula.gender] = formula
        })
        setFormulaMap(next)
      } catch (e) {
        if (mounted) setSaveHint((e as Error)?.message || '公式加载失败，上肢项目暂不可计算')
      } finally {
        if (mounted) setLoadingFormula(false)
      }
    }
    loadFormulas()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(draft)).catch(() => undefined)
    }, 300)
    return () => clearTimeout(timer)
  }, [draft])

  const inputBlocks = useMemo(() => {
    const upperBody = isUpperBodyExercise(draft.exerciseType)
    if (draft.mode === 'forward') {
      return upperBody
        ? [{ key: 'addedWeight', label: '附加负重', suffix: 'kg' }, { key: 'reps', label: '完成次数', suffix: '次' }]
        : [{ key: 'liftWeight', label: '做组重量', suffix: 'kg' }, { key: 'reps', label: '完成次数', suffix: '次' }]
    }
    if (draft.mode === 'reverse_weight') {
      return upperBody
        ? [{ key: 'added1RM', label: '负重 1RM', suffix: 'kg' }, { key: 'reps', label: '目标次数', suffix: '次' }]
        : [{ key: 'target1RM', label: '现有 1RM', suffix: 'kg' }, { key: 'reps', label: '目标次数', suffix: '次' }]
    }
    if (draft.mode === 'reverse_reps') {
      return upperBody
        ? [{ key: 'added1RM', label: '负重 1RM', suffix: 'kg' }, { key: 'workingAddedWeight', label: '做组附加负重', suffix: 'kg' }]
        : [{ key: 'target1RM', label: '现有 1RM', suffix: 'kg' }, { key: 'workingLiftWeight', label: '做组重量', suffix: 'kg' }]
    }
    return [
      { key: 'addedWeight', label: '做组附加负重', suffix: 'kg' },
      { key: 'sets', label: '组数', suffix: '组' },
      { key: 'reps', label: '每组次数', suffix: '次' },
      { key: 'dayFirstValue', label: draft.dayFirstType === 'RIR' ? '首组 RIR' : '首组实际次数', suffix: draft.dayFirstType === 'RIR' ? 'RIR' : '次' },
      { key: 'dayLastValue', label: draft.dayLastType === 'RIR' ? '末组 RIR' : '末组实际次数', suffix: draft.dayLastType === 'RIR' ? 'RIR' : '次' },
    ]
  }, [draft.dayFirstType, draft.dayLastType, draft.exerciseType, draft.mode])

  const calculate = async () => {
    setError('')
    setSaveHint('')
    setSubmitting(true)
    try {
      const request = {
        exerciseType: draft.exerciseType,
        mode: draft.mode,
        gender: draft.gender,
        bodyweight: parseNumber(draft.bodyweight) ?? 0,
        addedWeight: parseNumber(draft.addedWeight),
        added1RM: parseNumber(draft.added1RM),
        workingAddedWeight: parseNumber(draft.workingAddedWeight),
        liftWeight: parseNumber(draft.liftWeight),
        target1RM: parseNumber(draft.target1RM),
        workingLiftWeight: parseNumber(draft.workingLiftWeight),
        reps: parseNumber(draft.reps),
        sets: parseNumber(draft.sets),
        restCat: draft.restCat,
        dayFirstType: draft.dayFirstType,
        dayFirstValue: parseNumber(draft.dayFirstValue),
        dayLastType: draft.dayLastType,
        dayLastValue: parseNumber(draft.dayLastValue),
        formQuality: draft.formQuality,
        penaltyWeight: parseNumber(draft.penaltyWeight),
      }
      const result = computeStreetliftingCalculatorResult(request, { formula: isUpperBodyExercise(draft.exerciseType) ? currentFormula : null })
      let cloudSummary: unknown = null
      try {
        const saved = await apiClient.request<unknown>('/api/streetlifting-index/calculator/save-result', {
          method: 'POST',
          body: { sourceSurface: 'weapp', ...request },
          timeoutMs: 12000,
        })
        cloudSummary = saved
        setSaveHint('已保存到云端历史')
      } catch (e) {
        setSaveHint((e as Error)?.message ? `本地已计算，云端保存失败：${(e as Error).message}` : '本地已计算，云端保存失败')
      }
      const snapshot: LastRun = { timestamp: Date.now(), draft, result, cloudSummary }
      setLastRun(snapshot)
      await AsyncStorage.setItem(LAST_RUN_KEY, JSON.stringify(snapshot))
    } catch (e) {
      setError((e as Error)?.message || '计算失败')
    } finally {
      setSubmitting(false)
    }
  }

  const resetDraft = async () => {
    setDraft(DEFAULT_DRAFT)
    setError('')
    setSaveHint('')
    await AsyncStorage.removeItem(STORAGE_KEY)
  }

  const result = lastRun?.result || null
  const rmRows = result && result.estimated1RMKg > 0 ? generateRMTable(Number(lastRun?.draft.bodyweight || 0), result.estimated1RMKg).slice(0, 8) : []

  return (
    <Page>
      <Pressable onPress={() => navigation.goBack()} style={styles.backRow}>
        <IconFont name="icon-back" color={colors.text} size={18} />
        <Text style={styles.backText}>返回</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.kicker}>街健指数</Text>
          <Text style={styles.heroTitle}>力量计算器</Text>
          <Text style={styles.heroSubtitle}>计算极限重量、做组重量、目标次数和做组极限估算，逻辑与小程序保持一致。</Text>
        </View>
        <View style={styles.heroIcon}>
          <IconFont name="icon-calculator" color={colors.brand} size={30} />
        </View>
      </View>

      <SectionCard title="项目">
        <ChipGroup options={EXERCISE_OPTIONS} value={draft.exerciseType} onChange={(exerciseType) => patchDraft({ exerciseType })} />
      </SectionCard>

      <SectionCard title="计算方式">
        <ChipGroup options={availableModes} value={draft.mode} onChange={(mode) => patchDraft({ mode })} />
      </SectionCard>

      <SectionCard title="基础信息" description={loadingFormula && isUpperBodyExercise(draft.exerciseType) ? '正在加载街健公式。' : undefined}>
        <ChipGroup options={GENDER_OPTIONS} value={draft.gender} onChange={(gender) => patchDraft({ gender })} />
        <View style={styles.formGrid}>
          <InputField label="体重" value={draft.bodyweight} onChangeText={(bodyweight) => patchDraft({ bodyweight })} suffix="kg" />
          <InputField label="扣罚重量" value={draft.penaltyWeight} onChangeText={(penaltyWeight) => patchDraft({ penaltyWeight })} suffix="kg" helper={draft.formQuality === 'Competition' ? '标准动作不扣罚' : undefined} />
        </View>
        <ChipGroup
          options={QUALITY_OPTIONS}
          value={draft.formQuality}
          onChange={(formQuality) => patchDraft({ formQuality, penaltyWeight: defaultPenalty(formQuality) })}
        />
      </SectionCard>

      <SectionCard title="输入数据">
        {draft.mode === 'day_max' ? (
          <>
            <ChipGroup options={REST_OPTIONS} value={draft.restCat} onChange={(restCat) => patchDraft({ restCat })} />
            <View style={styles.feedbackRow}>
              <View style={styles.feedbackCol}>
                <Text style={styles.feedbackLabel}>首组记录方式</Text>
                <ChipGroup options={FEEDBACK_OPTIONS} value={draft.dayFirstType} onChange={(dayFirstType) => patchDraft({ dayFirstType })} />
              </View>
              <View style={styles.feedbackCol}>
                <Text style={styles.feedbackLabel}>末组记录方式</Text>
                <ChipGroup options={FEEDBACK_OPTIONS} value={draft.dayLastType} onChange={(dayLastType) => patchDraft({ dayLastType })} />
              </View>
            </View>
          </>
        ) : null}
        <View style={styles.formGrid}>
          {inputBlocks.map((field) => (
            <InputField
              key={field.key}
              label={field.label}
              suffix={field.suffix}
              value={String(draft[field.key as keyof CalculatorDraft] || '')}
              onChangeText={(value) => patchDraft({ [field.key]: value } as Partial<CalculatorDraft>)}
            />
          ))}
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={styles.actions}>
          <Pressable onPress={resetDraft} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>清除输入</Text>
          </Pressable>
          <Pressable onPress={calculate} disabled={submitting || (loadingFormula && isUpperBodyExercise(draft.exerciseType))} style={[styles.primaryButton, (submitting || (loadingFormula && isUpperBodyExercise(draft.exerciseType))) && styles.buttonDisabled]}>
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>开始计算</Text>}
          </Pressable>
        </View>
      </SectionCard>

      {result ? (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View>
              <Text style={styles.resultKicker}>{optionLabel(EXERCISE_OPTIONS, lastRun!.draft.exerciseType)}</Text>
              <Text style={styles.resultTitle}>{result.resultLevel}</Text>
            </View>
            <Text style={styles.score}>{formatScore(result.finalScore)}</Text>
          </View>
          <View style={styles.metricGrid}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>估算 1RM</Text>
              <Text style={styles.metricValue}>{formatKg(result.estimated1RMKg)}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>计算系数</Text>
              <Text style={styles.metricValue}>{result.coefficient.toFixed(3)}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>调整后用重</Text>
              <Text style={styles.metricValue}>{formatKg(result.adjustedUsedWeightKg)}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>{result.computedReps ? '预计次数' : '反推重量'}</Text>
              <Text style={styles.metricValue}>{result.computedReps ? `${result.computedReps}次` : formatKg(result.computedAddedWeightKg)}</Text>
            </View>
          </View>
          <View style={styles.rankBox}>
            <Text style={styles.rankTitle}>{buildStreetliftingRankingBucketTitle({ exerciseType: lastRun!.draft.exerciseType, gender: lastRun!.draft.gender })}</Text>
            <Text style={styles.rankText}>{result.isRankingEligible ? '正向计算结果会进入趣味榜统计。' : '反推和做组极限估算暂不进入趣味榜。'}</Text>
          </View>
          {saveHint ? <Text style={styles.saveHint}>{saveHint}</Text> : null}
        </View>
      ) : null}

      {rmRows.length ? (
        <SectionCard title="训练重量参考" description="按估算 1RM 推算常用次数的目标负重。">
          <View style={styles.rmTable}>
            {rmRows.map((row) => (
              <View key={row.reps} style={styles.rmRow}>
                <Text style={styles.rmText}>{row.reps} 次</Text>
                <Text style={styles.rmText}>{formatKg(row.weight)}</Text>
                <Text style={styles.rmMuted}>{row.percentage}%</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      ) : null}
    </Page>
  )
}

const styles = StyleSheet.create({
  backRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  backText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  hero: {
    minHeight: 152,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderRadius: radius.xl,
    padding: spacing.md,
    backgroundColor: '#1F1F1F',
  },
  heroText: {
    flex: 1,
    gap: spacing.xs,
  },
  kicker: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '800',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 22,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    minHeight: 44,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  chipLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  chipLabelActive: {
    color: '#FFFFFF',
  },
  chipDesc: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  chipDescActive: {
    color: 'rgba(255,255,255,0.78)',
  },
  formGrid: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  field: {
    gap: spacing.xs,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  fieldSuffix: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldHelper: {
    color: colors.textMuted,
    fontSize: 12,
  },
  feedbackRow: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  feedbackCol: {
    gap: spacing.xs,
  },
  feedbackLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  resultCard: {
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  resultKicker: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  resultTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  score: {
    color: colors.brand,
    fontSize: 36,
    fontWeight: '900',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metric: {
    width: '47%',
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  metricValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 4,
  },
  rankBox: {
    borderRadius: radius.lg,
    padding: spacing.sm,
    backgroundColor: colors.brandSoft,
  },
  rankTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  rankText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  saveHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  rmTable: {
    gap: spacing.xs,
  },
  rmRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
  rmText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  rmMuted: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
})
