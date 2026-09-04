import { useEffect, useMemo, useState } from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { IconFont } from '../../components/IconFont'
import { Page } from '../../components/Page'
import { SectionCard } from '../../components/SectionCard'
import { apiClient } from '../../api'
import { colors, radius, shadow, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'
import {
  computeCoefficient,
  estimateTotal1RMFromTotalWeightAndReps,
  type Gender,
  type StreetliftingFormulaLike,
} from './streetliftingCalculator'

type Props = NativeStackScreenProps<RootStackParamList, 'StreetliftingData'>

type ExerciseFilter = 'all' | 'weighted_pullup' | 'weighted_dips'
type GenderFilter = 'all' | Gender
type PullupFilter = 'all' | 'Overhand' | 'Underhand'
type QualityFilter = 'all' | 'Competition' | 'Minor_Cheat' | 'Major_Cheat' | 'Extreme_Cheat'
type VideoFilter = 'all' | 'with' | 'without'
type SortBy = 'weight' | 'score' | 'date'

type StreetliftingSubmission = {
  id: string
  created_at: string
  user_id: string | null
  gender: Gender
  bodyweight: number
  added_weight: number
  reps: number
  form_quality: QualityFilter extends 'all' ? never : QualityFilter
  penalty_weight?: number | null
  user_name: string | null
  user_avatar_url?: string | null
  video_url: string | null
  pullup_type: 'Overhand' | 'Underhand' | null
  exercise_type: 'weighted_pullup' | 'weighted_dips'
}

type StreetliftingFormula = StreetliftingFormulaLike & {
  gender: Gender
  exercise_type: 'weighted_pullup' | 'weighted_dips'
}

type Option<T extends string> = { label: string; value: T }

const EXERCISE_OPTIONS: Option<ExerciseFilter>[] = [
  { label: '全部动作', value: 'all' },
  { label: '负重引体', value: 'weighted_pullup' },
  { label: '负重臂屈伸', value: 'weighted_dips' },
]
const GENDER_OPTIONS: Option<GenderFilter>[] = [
  { label: '全部性别', value: 'all' },
  { label: '男性', value: 'Male' },
  { label: '女性', value: 'Female' },
]
const PULLUP_OPTIONS: Option<PullupFilter>[] = [
  { label: '全部握法', value: 'all' },
  { label: '正手', value: 'Overhand' },
  { label: '反手', value: 'Underhand' },
]
const QUALITY_OPTIONS: Option<QualityFilter>[] = [
  { label: '全部质量', value: 'all' },
  { label: '比赛级', value: 'Competition' },
  { label: '轻微借力', value: 'Minor_Cheat' },
  { label: '严重借力', value: 'Major_Cheat' },
  { label: '超严重借力', value: 'Extreme_Cheat' },
]
const VIDEO_OPTIONS: Option<VideoFilter>[] = [
  { label: '全部视频', value: 'all' },
  { label: '有视频', value: 'with' },
  { label: '无视频', value: 'without' },
]
const SORT_OPTIONS: Option<SortBy>[] = [
  { label: '按 1RM', value: 'weight' },
  { label: '按力量分', value: 'score' },
  { label: '按时间', value: 'date' },
]

function ChipGroup<T extends string>({ options, value, onChange }: { options: Option<T>[]; value: T; onChange: (value: T) => void }) {
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function qualityLabel(value: string) {
  const labels: Record<string, string> = {
    Competition: '比赛级',
    Minor_Cheat: '轻微借力',
    Major_Cheat: '严重借力',
    Extreme_Cheat: '超严重借力',
  }
  return labels[value] || value
}

function exerciseLabel(value: string) {
  return value === 'weighted_dips' ? '负重臂屈伸' : '负重引体'
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function calculateAdded1RM(bodyweight: number, addedWeight: number, reps: number, penaltyWeight: number) {
  const adjustedWeight = addedWeight - penaltyWeight
  const totalWeight = bodyweight + adjustedWeight
  if (reps === 1) return adjustedWeight
  if (reps >= 37) return 0
  return estimateTotal1RMFromTotalWeightAndReps(totalWeight, reps) - bodyweight
}

function formatKg(value: number) {
  if (!Number.isFinite(value)) return '--'
  return `${value.toFixed(1)}kg`
}

export function StreetliftingDataScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true)
  const [submissions, setSubmissions] = useState<StreetliftingSubmission[]>([])
  const [formulaMap, setFormulaMap] = useState<Record<string, StreetliftingFormula>>({})
  const [filterEx, setFilterEx] = useState<ExerciseFilter>('all')
  const [filterGender, setFilterGender] = useState<GenderFilter>('all')
  const [filterPullup, setFilterPullup] = useState<PullupFilter>('all')
  const [filterQuality, setFilterQuality] = useState<QualityFilter>('all')
  const [filterVideo, setFilterVideo] = useState<VideoFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('weight')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [submitOpen, setSubmitOpen] = useState(false)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    exercise_type: 'weighted_pullup' as 'weighted_pullup' | 'weighted_dips',
    gender: 'Male' as Gender,
    bodyweight: '',
    added_weight: '',
    reps: '',
    form_quality: 'Minor_Cheat' as Exclude<QualityFilter, 'all'>,
    penalty_weight: '3',
    user_name: '',
    video_url: '',
    pullup_type: 'Overhand' as 'Overhand' | 'Underhand',
  })

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [subData, formulaData] = await Promise.all([
        apiClient.request<{ submissions: StreetliftingSubmission[] }>('/api/streetlifting-index/submissions/list', { method: 'POST', body: { limit: 500 }, timeoutMs: 12000 }),
        apiClient.request<{ formulas: StreetliftingFormula[] }>('/api/streetlifting-index/formulas/list', { method: 'POST', body: {}, timeoutMs: 12000 }),
      ])
      setSubmissions(subData.submissions || [])
      const next: Record<string, StreetliftingFormula> = {}
      ;(formulaData.formulas || []).forEach((formula) => {
        next[`${formula.exercise_type}:${formula.gender}`] = formula
        next[formula.gender] = formula
      })
      setFormulaMap(next)
    } catch (e) {
      setError((e as Error)?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const compute1RM = (submission: StreetliftingSubmission) => {
    return calculateAdded1RM(Number(submission.bodyweight), Number(submission.added_weight), Number(submission.reps), Number(submission.penalty_weight || 0))
  }

  const computeScore = (submission: StreetliftingSubmission) => {
    const formula = formulaMap[`${submission.exercise_type}:${submission.gender}`] || formulaMap[submission.gender]
    if (!formula) return 0
    const added1RM = compute1RM(submission)
    const total1RM = Number(submission.bodyweight) + added1RM
    const coefficient = computeCoefficient(Number(submission.bodyweight), formula)
    const raw = total1RM * coefficient
    return submission.exercise_type === 'weighted_dips' ? raw / 1.3 : raw
  }

  const filtered = useMemo(() => {
    let rows = [...submissions]
    if (filterEx !== 'all') rows = rows.filter((row) => row.exercise_type === filterEx)
    if (filterGender !== 'all') rows = rows.filter((row) => row.gender === filterGender)
    if (filterPullup !== 'all') rows = rows.filter((row) => row.pullup_type === filterPullup)
    if (filterQuality !== 'all') rows = rows.filter((row) => row.form_quality === filterQuality)
    if (filterVideo === 'with') rows = rows.filter((row) => Boolean(row.video_url?.trim()))
    if (filterVideo === 'without') rows = rows.filter((row) => !row.video_url?.trim())
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter((row) => (row.user_name || '').toLowerCase().includes(q))
    }
    if (sortBy === 'date') rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    if (sortBy === 'weight') rows.sort((a, b) => compute1RM(b) - compute1RM(a))
    if (sortBy === 'score') rows.sort((a, b) => computeScore(b) - computeScore(a))
    return rows
  }, [submissions, filterEx, filterGender, filterPullup, filterQuality, filterVideo, search, sortBy, formulaMap])

  const stats = useMemo(() => ({
    total: filtered.length,
    withVideo: filtered.filter((item) => Boolean(item.video_url?.trim())).length,
    pullup: filtered.filter((item) => item.exercise_type === 'weighted_pullup').length,
    dips: filtered.filter((item) => item.exercise_type === 'weighted_dips').length,
  }), [filtered])

  const submit = async () => {
    setError('')
    try {
      const payload = {
        exercise_type: form.exercise_type,
        gender: form.gender,
        bodyweight: Number(form.bodyweight),
        added_weight: Number(form.added_weight),
        reps: Number(form.reps),
        form_quality: form.form_quality,
        penalty_weight: Number(form.penalty_weight || 0),
        user_name: form.user_name.trim() || null,
        video_url: form.video_url.trim() || null,
        pullup_type: form.exercise_type === 'weighted_pullup' ? form.pullup_type : null,
      }
      if (!Number.isFinite(payload.bodyweight) || payload.bodyweight <= 0) throw new Error('请填写有效体重')
      if (!Number.isFinite(payload.added_weight)) throw new Error('请填写附加负重')
      if (!Number.isFinite(payload.reps) || payload.reps < 1 || payload.reps > 36) throw new Error('完成次数需在 1-36 之间')
      const res = await apiClient.request<{ submission: StreetliftingSubmission }>('/api/streetlifting-index/submissions/create', {
        method: 'POST',
        body: payload,
        timeoutMs: 12000,
      })
      setSubmissions((prev) => [res.submission, ...prev])
      setSubmitOpen(false)
    } catch (e) {
      setError((e as Error)?.message || '提交失败')
    }
  }

  const claim = async (id: string) => {
    setClaimingId(id)
    setError('')
    try {
      const res = await apiClient.request<{ submission: StreetliftingSubmission }>('/api/streetlifting-index/submissions/claim', {
        method: 'POST',
        body: { submission_id: id },
        timeoutMs: 12000,
      })
      setSubmissions((prev) => prev.map((item) => (item.id === id ? res.submission : item)))
    } catch (e) {
      setError((e as Error)?.message || '认领失败')
    } finally {
      setClaimingId(null)
    }
  }

  return (
    <Page>
      <Pressable onPress={() => navigation.goBack()} style={styles.backRow}>
        <IconFont name="icon-back" color={colors.text} size={18} />
        <Text style={styles.backText}>返回</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.kicker}>街健指数</Text>
          <Text style={styles.heroTitle}>社区数据</Text>
          <Text style={styles.heroSubtitle}>查看与提交负重引体、负重臂屈伸数据，按 1RM、力量分和时间排序。</Text>
        </View>
        <View style={styles.heroIcon}>
          <IconFont name="icon-ranking" color={colors.brand} size={30} />
        </View>
      </View>

      <View style={styles.statGrid}>
        <View style={styles.statCard}><Text style={styles.statValue}>{stats.total}</Text><Text style={styles.statLabel}>当前结果</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{stats.withVideo}</Text><Text style={styles.statLabel}>有视频</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{stats.pullup}</Text><Text style={styles.statLabel}>引体</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{stats.dips}</Text><Text style={styles.statLabel}>臂屈伸</Text></View>
      </View>

      <SectionCard title="筛选排序">
        <TextInput value={search} onChangeText={setSearch} placeholder="搜索提交者" placeholderTextColor={colors.textMuted} style={styles.input} />
        <ChipGroup options={EXERCISE_OPTIONS} value={filterEx} onChange={setFilterEx} />
        <ChipGroup options={GENDER_OPTIONS} value={filterGender} onChange={setFilterGender} />
        <ChipGroup options={PULLUP_OPTIONS} value={filterPullup} onChange={setFilterPullup} />
        <ChipGroup options={QUALITY_OPTIONS} value={filterQuality} onChange={setFilterQuality} />
        <ChipGroup options={VIDEO_OPTIONS} value={filterVideo} onChange={setFilterVideo} />
        <ChipGroup options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} />
      </SectionCard>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.actions}>
        <Pressable onPress={loadData} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>刷新数据</Text></Pressable>
        <Pressable onPress={() => navigation.navigate('StreetliftingSubmit')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>提交数据</Text></Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingCard}><ActivityIndicator color={colors.brand} /><Text style={styles.loadingText}>正在加载社区数据</Text></View>
      ) : (
        <View style={styles.list}>
          {filtered.map((item, index) => {
            const oneRm = compute1RM(item)
            const score = computeScore(item)
            return (
              <View key={item.id} style={styles.submissionCard}>
                <View style={styles.submissionTop}>
                  <Text style={styles.rank}>#{index + 1}</Text>
                  <View style={styles.submissionMain}>
                    <Text style={styles.submissionTitle}>{item.user_name || '未署名用户'}</Text>
                    <Text style={styles.submissionMeta}>{exerciseLabel(item.exercise_type)} · {item.gender === 'Male' ? '男' : '女'} · {qualityLabel(item.form_quality)}</Text>
                  </View>
                  {item.user_avatar_url ? <Image source={{ uri: item.user_avatar_url }} style={styles.avatar} /> : null}
                </View>
                <View style={styles.metricRow}>
                  <View style={styles.metric}><Text style={styles.metricLabel}>负重 1RM</Text><Text style={styles.metricValue}>{formatKg(oneRm)}</Text></View>
                  <View style={styles.metric}><Text style={styles.metricLabel}>力量分</Text><Text style={styles.metricValue}>{score ? score.toFixed(1) : '--'}</Text></View>
                  <View style={styles.metric}><Text style={styles.metricLabel}>原始做组</Text><Text style={styles.metricValue}>{item.added_weight}kg x {item.reps}</Text></View>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.footerText}>{formatDate(item.created_at)} · {item.video_url ? '有视频' : '无视频'}{item.pullup_type ? ` · ${item.pullup_type === 'Overhand' ? '正手' : '反手'}` : ''}</Text>
                  {!item.user_id ? (
                    <Pressable onPress={() => claim(item.id)} disabled={claimingId === item.id} style={styles.claimButton}>
                      <Text style={styles.claimText}>{claimingId === item.id ? '认领中' : '认领'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            )
          })}
        </View>
      )}

      <Modal visible={submitOpen} animationType="slide" transparent onRequestClose={() => setSubmitOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>提交社区数据</Text>
            <ChipGroup options={EXERCISE_OPTIONS.filter((item) => item.value !== 'all') as Option<'weighted_pullup' | 'weighted_dips'>[]} value={form.exercise_type} onChange={(exercise_type) => setForm((prev) => ({ ...prev, exercise_type }))} />
            <ChipGroup options={GENDER_OPTIONS.filter((item) => item.value !== 'all') as Option<Gender>[]} value={form.gender} onChange={(gender) => setForm((prev) => ({ ...prev, gender }))} />
            {form.exercise_type === 'weighted_pullup' ? <ChipGroup options={PULLUP_OPTIONS.filter((item) => item.value !== 'all') as Option<'Overhand' | 'Underhand'>[]} value={form.pullup_type} onChange={(pullup_type) => setForm((prev) => ({ ...prev, pullup_type }))} /> : null}
            <ChipGroup options={QUALITY_OPTIONS.filter((item) => item.value !== 'all') as Option<Exclude<QualityFilter, 'all'>>[]} value={form.form_quality} onChange={(form_quality) => setForm((prev) => ({ ...prev, form_quality }))} />
            <TextInput value={form.user_name} onChangeText={(user_name) => setForm((prev) => ({ ...prev, user_name }))} placeholder="显示名称" placeholderTextColor={colors.textMuted} style={styles.input} />
            <TextInput value={form.bodyweight} onChangeText={(bodyweight) => setForm((prev) => ({ ...prev, bodyweight }))} keyboardType="decimal-pad" placeholder="体重 kg" placeholderTextColor={colors.textMuted} style={styles.input} />
            <TextInput value={form.added_weight} onChangeText={(added_weight) => setForm((prev) => ({ ...prev, added_weight }))} keyboardType="decimal-pad" placeholder="附加负重 kg" placeholderTextColor={colors.textMuted} style={styles.input} />
            <TextInput value={form.reps} onChangeText={(reps) => setForm((prev) => ({ ...prev, reps }))} keyboardType="decimal-pad" placeholder="完成次数" placeholderTextColor={colors.textMuted} style={styles.input} />
            <TextInput value={form.penalty_weight} onChangeText={(penalty_weight) => setForm((prev) => ({ ...prev, penalty_weight }))} keyboardType="decimal-pad" placeholder="扣罚重量 kg" placeholderTextColor={colors.textMuted} style={styles.input} />
            <TextInput value={form.video_url} onChangeText={(video_url) => setForm((prev) => ({ ...prev, video_url }))} placeholder="视频链接（可选）" placeholderTextColor={colors.textMuted} style={styles.input} />
            <View style={styles.actions}>
              <Pressable onPress={() => setSubmitOpen(false)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>取消</Text></Pressable>
              <Pressable onPress={submit} style={styles.primaryButton}><Text style={styles.primaryButtonText}>提交</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Page>
  )
}

const styles = StyleSheet.create({
  backRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  backText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  hero: { minHeight: 152, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderRadius: radius.xl, padding: spacing.md, backgroundColor: '#1F1F1F' },
  heroText: { flex: 1, gap: spacing.xs },
  kicker: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '800' },
  heroTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
  heroSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 22 },
  heroIcon: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: { width: '47%', borderRadius: radius.lg, padding: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow },
  statValue: { color: colors.text, fontSize: 24, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  chip: { minHeight: 48, borderRadius: radius.pill, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  chipTextActive: { color: '#FFFFFF' },
  input: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.sm, color: colors.text, fontSize: 15, fontWeight: '800', backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm },
  primaryButton: { flex: 1, minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondaryButton: { flex: 1, minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  loadingCard: { minHeight: 96, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.surface },
  loadingText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
  list: { gap: spacing.sm },
  submissionCard: { borderRadius: radius.lg, padding: spacing.sm, gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow },
  submissionTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rank: { color: colors.brand, fontSize: 18, fontWeight: '900' },
  submissionMain: { flex: 1 },
  submissionTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  submissionMeta: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  avatar: { width: 40, height: 40, borderRadius: radius.pill },
  metricRow: { flexDirection: 'row', gap: spacing.xs },
  metric: { flex: 1, borderRadius: radius.md, padding: spacing.xs, backgroundColor: colors.surfaceMuted },
  metricLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  metricValue: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 4 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  footerText: { flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  claimButton: { minHeight: 48, borderRadius: radius.pill, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  claimText: { color: colors.brand, fontSize: 12, fontWeight: '900' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  modalCard: { maxHeight: '88%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.sm, gap: spacing.xs, backgroundColor: colors.surface },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
})
