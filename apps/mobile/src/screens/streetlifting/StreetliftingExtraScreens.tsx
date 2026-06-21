import { useEffect, useMemo, useState } from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ActivityIndicator, Image, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
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

type MethodologyProps = NativeStackScreenProps<RootStackParamList, 'StreetliftingMethodology'>
type StoriesProps = NativeStackScreenProps<RootStackParamList, 'StreetliftingStories'>
type SubmitProps = NativeStackScreenProps<RootStackParamList, 'StreetliftingSubmit'>
type SubmitSuccessProps = NativeStackScreenProps<RootStackParamList, 'StreetliftingSubmitSuccess'>
type MapProps = NativeStackScreenProps<RootStackParamList, 'StreetliftingLocationsMap'>
type DetailProps = NativeStackScreenProps<RootStackParamList, 'StreetliftingLocationDetail'>

type ExerciseType = 'weighted_pullup' | 'weighted_dips'
type FormQuality = 'Competition' | 'Minor_Cheat' | 'Major_Cheat' | 'Extreme_Cheat'
type PullupType = 'Overhand' | 'Underhand'

type StreetliftingStory = {
  id: string
  title: string
  content: string | null
  video_url: string | null
  type: 'story' | 'event'
  event_date: string | null
  created_at: string
  user_contact: string | null
}

type StreetliftingSubmission = {
  id: string
  exercise_type: ExerciseType
  gender: Gender
  bodyweight: number
  added_weight: number
  reps: number
  form_quality: FormQuality
  penalty_weight?: number | null
  user_name?: string | null
  video_url?: string | null
  pullup_type?: PullupType | null
  created_at: string
}

type StreetliftingFormula = StreetliftingFormulaLike & {
  gender: Gender
  exercise_type: ExerciseType
}

type MapPin = {
  id: string
  name: string
  latitude: number
  longitude: number
  province?: string | null
  city?: string | null
  county?: string | null
  address?: string | null
}

type StreetliftingLocation = MapPin & {
  description?: string | null
  image_url?: string | null
  image_urls?: string[] | null
  created_at?: string | null
  user_contact?: string | null
  contributor_name_snapshot?: string | null
}

type SubmitForm = {
  exercise_type: ExerciseType
  gender: Gender
  bodyweight: string
  added_weight: string
  reps: string
  form_quality: FormQuality
  penalty_weight: string
  user_name: string
  video_url: string
  pullup_type: PullupType
}

type Option<T extends string> = { label: string; value: T; helper?: string }

const EXERCISE_OPTIONS: Option<ExerciseType>[] = [
  { label: '负重引体', value: 'weighted_pullup', helper: '正手/反手可选' },
  { label: '负重臂屈伸', value: 'weighted_dips', helper: '按 1.3 系数折算' },
]

const GENDER_OPTIONS: Option<Gender>[] = [
  { label: '男', value: 'Male' },
  { label: '女', value: 'Female' },
]

const PULLUP_OPTIONS: Option<PullupType>[] = [
  { label: '正手', value: 'Overhand' },
  { label: '反手', value: 'Underhand' },
]

const QUALITY_OPTIONS: Option<FormQuality>[] = [
  { label: '比赛级', value: 'Competition', helper: '不扣重量' },
  { label: '轻微借力', value: 'Minor_Cheat', helper: '默认扣 3kg' },
  { label: '严重借力', value: 'Major_Cheat', helper: '默认扣 10kg' },
  { label: '超严重借力', value: 'Extreme_Cheat', helper: '默认扣 30kg' },
]

const DEFAULT_FORM: SubmitForm = {
  exercise_type: 'weighted_pullup',
  gender: 'Male',
  bodyweight: '',
  added_weight: '',
  reps: '',
  form_quality: 'Minor_Cheat',
  penalty_weight: '3',
  user_name: '',
  video_url: '',
  pullup_type: 'Overhand',
}

function parseNumber(value: string): number | null {
  const n = Number(String(value || '').trim())
  return Number.isFinite(n) ? n : null
}

function defaultPenalty(quality: FormQuality) {
  if (quality === 'Competition') return '0'
  if (quality === 'Minor_Cheat') return '3'
  if (quality === 'Major_Cheat') return '10'
  return '30'
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatKg(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return `${value.toFixed(1)}kg`
}

function qualityLabel(value: string) {
  return QUALITY_OPTIONS.find((item) => item.value === value)?.label || value
}

function exerciseLabel(value: string) {
  return value === 'weighted_dips' ? '负重臂屈伸' : '负重引体'
}

function areaLine(location?: Partial<StreetliftingLocation | MapPin> | null) {
  return [location?.province, location?.city, location?.county].filter(Boolean).join(' · ') || '未补充区域'
}

function addressLine(location?: Partial<StreetliftingLocation | MapPin> | null) {
  return [location?.province, location?.city, location?.county, location?.address].filter(Boolean).join(' ')
}

function locationImages(location?: Partial<StreetliftingLocation> | null) {
  if (Array.isArray(location?.image_urls) && location.image_urls.length) return location.image_urls
  if (location?.image_url) return [location.image_url]
  return []
}

function addedOneRm(bodyweight: number, addedWeight: number, reps: number, penaltyWeight: number) {
  const adjustedWeight = addedWeight - penaltyWeight
  const totalWeight = bodyweight + adjustedWeight
  if (reps === 1) return adjustedWeight
  if (reps >= 37) return 0
  return estimateTotal1RMFromTotalWeightAndReps(totalWeight, reps) - bodyweight
}

function ChipGroup<T extends string>({ options, value, onChange }: { options: Option<T>[]; value: T; onChange: (value: T) => void }) {
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            {option.helper ? <Text style={[styles.chipHelper, active && styles.chipHelperActive]}>{option.helper}</Text> : null}
          </Pressable>
        )
      })}
    </View>
  )
}

function BackRow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.backRow}>
      <IconFont name="icon-back" color={colors.text} size={18} />
      <Text style={styles.backText}>返回</Text>
    </Pressable>
  )
}

function Hero({ title, subtitle, icon }: { title: string; subtitle: string; icon: string }) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroText}>
        <Text style={styles.kicker}>街健指数</Text>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.heroIcon}>
        <IconFont name={icon as any} color={colors.brand} size={30} />
      </View>
    </View>
  )
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  numeric,
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  numeric?: boolean
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        placeholder={placeholder || label}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
    </View>
  )
}

export function StreetliftingMethodologyScreen({ navigation }: MethodologyProps) {
  return (
    <Page>
      <BackRow onPress={() => navigation.goBack()} />
      <Hero title="计算方法论" subtitle="把街健动作、体重、负重、次数与动作质量统一成可比较的力量分。" icon="icon-knowledge" />
      <View style={styles.statGrid}>
        <StatCard value="1RM" label="先估算极限负重" />
        <StatCard value="DOTS" label="再做体重系数校正" />
        <StatCard value="质量" label="借力会扣罚重量" />
        <StatCard value="项目" label="引体/臂屈伸分开看" />
      </View>
      <SectionCard title="核心计算路径">
        {[
          ['估算 1RM', '根据做组重量和次数，先估算总重量 1RM，再减去体重得到街健负重 1RM。'],
          ['体重校正', '通过性别和项目公式把不同体重的人放到同一把尺上比较。'],
          ['动作质量', '比赛级不扣罚，轻微/严重/超严重借力会按规则扣掉附加负重。'],
          ['分数解释', '力量分适合做社区趣味比较和个人趋势观察，不等于正式比赛成绩。'],
        ].map(([title, body]) => (
          <View key={title} style={styles.docRow}>
            <Text style={styles.docTitle}>{title}</Text>
            <Text style={styles.docBody}>{body}</Text>
          </View>
        ))}
      </SectionCard>
      <SectionCard title="适用边界">
        <Text style={styles.paragraph}>当前 APP 与小程序一样，优先覆盖负重引体向上和负重双杠臂屈伸。深蹲、卧推、硬拉、实力推、弯举等项目在计算器里可作为扩展参考。</Text>
      </SectionCard>
    </Page>
  )
}

export function StreetliftingStoriesScreen({ navigation }: StoriesProps) {
  const [loading, setLoading] = useState(true)
  const [stories, setStories] = useState<StreetliftingStory[]>([])
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', video_url: '', user_contact: '', type: 'story' as 'story' | 'event', event_date: '' })

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiClient.request<{ stories: StreetliftingStory[] }>('/api/streetlifting-index/stories/list', { method: 'POST', body: {}, timeoutMs: 12000 })
      setStories(data.stories || [])
    } catch (e) {
      setError((e as Error)?.message || '故事加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const submitStory = async () => {
    setError('')
    try {
      if (!form.title.trim()) throw new Error('请填写标题')
      const data = await apiClient.request<{ story: StreetliftingStory }>('/api/streetlifting-index/stories/create', {
        method: 'POST',
        body: {
          title: form.title.trim(),
          content: form.content.trim() || null,
          video_url: form.video_url.trim() || null,
          type: form.type,
          event_date: form.event_date.trim() || null,
          user_contact: form.user_contact.trim() || null,
        },
        timeoutMs: 12000,
      })
      setStories((prev) => [data.story, ...prev])
      setDialogOpen(false)
      setForm({ title: '', content: '', video_url: '', user_contact: '', type: 'story', event_date: '' })
    } catch (e) {
      setError((e as Error)?.message || '提交失败')
    }
  }

  return (
    <Page>
      <BackRow onPress={() => navigation.goBack()} />
      <Hero title="街健故事" subtitle="记录训练者、地点、活动和数据背后的真实案例。" icon="icon-time" />
      <View style={styles.actions}>
        <Pressable onPress={load} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>刷新</Text></Pressable>
        <Pressable onPress={() => setDialogOpen(true)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>投稿故事</Text></Pressable>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading ? (
        <View style={styles.loadingCard}><ActivityIndicator color={colors.brand} /><Text style={styles.loadingText}>正在加载故事</Text></View>
      ) : stories.length ? (
        <View style={styles.list}>
          {stories.map((story) => (
            <View key={story.id} style={styles.storyCard}>
              <View style={styles.storyTop}>
                <Text style={styles.storyType}>{story.type === 'event' ? '活动' : '故事'}</Text>
                <Text style={styles.storyDate}>{formatDate(story.event_date || story.created_at)}</Text>
              </View>
              <Text style={styles.storyTitle}>{story.title}</Text>
              {story.content ? <Text style={styles.storyContent}>{story.content}</Text> : null}
              <Text style={styles.storyMeta}>{story.user_contact || '匿名投稿'}{story.video_url ? ' · 含视频链接' : ''}</Text>
            </View>
          ))}
        </View>
      ) : (
        <SectionCard title="暂无故事">
          <Text style={styles.paragraph}>还没有公开故事。可以先提交一条训练经历、场地活动或数据背后的说明。</Text>
        </SectionCard>
      )}

      <Modal visible={dialogOpen} animationType="slide" transparent onRequestClose={() => setDialogOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>投稿街健故事</Text>
            <ChipGroup options={[{ label: '故事', value: 'story' }, { label: '活动', value: 'event' }]} value={form.type} onChange={(type) => setForm((prev) => ({ ...prev, type }))} />
            <TextField label="标题" value={form.title} onChangeText={(title) => setForm((prev) => ({ ...prev, title }))} />
            <TextField label="正文" value={form.content} onChangeText={(content) => setForm((prev) => ({ ...prev, content }))} placeholder="训练经历、活动说明或案例背景" />
            <TextField label="视频链接" value={form.video_url} onChangeText={(video_url) => setForm((prev) => ({ ...prev, video_url }))} placeholder="可选" />
            <TextField label="日期" value={form.event_date} onChangeText={(event_date) => setForm((prev) => ({ ...prev, event_date }))} placeholder="YYYY-MM-DD，可选" />
            <TextField label="署名/联系方式" value={form.user_contact} onChangeText={(user_contact) => setForm((prev) => ({ ...prev, user_contact }))} placeholder="可选" />
            <View style={styles.actions}>
              <Pressable onPress={() => setDialogOpen(false)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>取消</Text></Pressable>
              <Pressable onPress={submitStory} style={styles.primaryButton}><Text style={styles.primaryButtonText}>提交</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Page>
  )
}

export function StreetliftingSubmitScreen({ navigation }: SubmitProps) {
  const [form, setForm] = useState<SubmitForm>(DEFAULT_FORM)
  const [formulas, setFormulas] = useState<Record<string, StreetliftingFormula>>({})
  const [checking, setChecking] = useState(true)
  const [existingHint, setExistingHint] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [formulaData, existing] = await Promise.all([
          apiClient.request<{ formulas: StreetliftingFormula[] }>('/api/streetlifting-index/formulas/list', { method: 'POST', body: {}, timeoutMs: 12000 }),
          apiClient.request<{ hasExisting: boolean; existingSubmission?: StreetliftingSubmission | null }>('/api/streetlifting-index/submissions/check-existing', { method: 'POST', body: {}, timeoutMs: 12000 }).catch(() => null),
        ])
        if (!mounted) return
        const next: Record<string, StreetliftingFormula> = {}
        ;(formulaData.formulas || []).forEach((formula) => {
          next[`${formula.exercise_type}:${formula.gender}`] = formula
        })
        setFormulas(next)
        if (existing?.hasExisting && existing.existingSubmission) {
          setExistingHint(`你已经提交过 ${exerciseLabel(existing.existingSubmission.exercise_type)} 数据，本次提交会作为新的社区记录保留。`)
        }
      } catch (e) {
        if (mounted) setError((e as Error)?.message || '初始化失败')
      } finally {
        if (mounted) setChecking(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const preview = useMemo(() => {
    const bodyweight = parseNumber(form.bodyweight)
    const added = parseNumber(form.added_weight)
    const reps = parseNumber(form.reps)
    const penalty = parseNumber(form.penalty_weight) ?? 0
    if (!bodyweight || added == null || !reps) return null
    const oneRm = addedOneRm(bodyweight, added, reps, penalty)
    const formula = formulas[`${form.exercise_type}:${form.gender}`]
    const score = formula ? (bodyweight + oneRm) * computeCoefficient(bodyweight, formula) / (form.exercise_type === 'weighted_dips' ? 1.3 : 1) : null
    return { oneRm, score }
  }, [form, formulas])

  const patchForm = (patch: Partial<SubmitForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const submit = async () => {
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        exercise_type: form.exercise_type,
        gender: form.gender,
        bodyweight: parseNumber(form.bodyweight),
        added_weight: parseNumber(form.added_weight),
        reps: parseNumber(form.reps),
        form_quality: form.form_quality,
        penalty_weight: parseNumber(form.penalty_weight) ?? 0,
        user_name: form.user_name.trim() || null,
        video_url: form.video_url.trim() || null,
        pullup_type: form.exercise_type === 'weighted_pullup' ? form.pullup_type : null,
      }
      if (!payload.bodyweight || payload.bodyweight <= 0) throw new Error('请填写有效体重')
      if (payload.added_weight == null) throw new Error('请填写附加负重')
      if (!payload.reps || payload.reps < 1 || payload.reps > 36) throw new Error('完成次数需在 1-36 之间')
      const data = await apiClient.request<{ submission: StreetliftingSubmission }>('/api/streetlifting-index/submissions/create', {
        method: 'POST',
        body: payload,
        timeoutMs: 12000,
      })
      navigation.replace('StreetliftingSubmitSuccess', {
        submissionId: data.submission.id,
        exerciseType: data.submission.exercise_type,
        oneRm: preview?.oneRm,
        score: preview?.score ?? undefined,
      })
    } catch (e) {
      setError((e as Error)?.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Page>
      <BackRow onPress={() => navigation.goBack()} />
      <Hero title="提交数据" subtitle="贡献你的负重引体或负重臂屈伸记录，完善社区街健指数样本。" icon="icon-pencil" />
      {checking ? <View style={styles.loadingCard}><ActivityIndicator color={colors.brand} /><Text style={styles.loadingText}>正在检查历史提交</Text></View> : null}
      {existingHint ? <Text style={styles.noticeText}>{existingHint}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <SectionCard title="项目">
        <ChipGroup options={EXERCISE_OPTIONS} value={form.exercise_type} onChange={(exercise_type) => patchForm({ exercise_type })} />
        <ChipGroup options={GENDER_OPTIONS} value={form.gender} onChange={(gender) => patchForm({ gender })} />
        {form.exercise_type === 'weighted_pullup' ? <ChipGroup options={PULLUP_OPTIONS} value={form.pullup_type} onChange={(pullup_type) => patchForm({ pullup_type })} /> : null}
      </SectionCard>

      <SectionCard title="成绩">
        <TextField label="体重 kg" value={form.bodyweight} onChangeText={(bodyweight) => patchForm({ bodyweight })} numeric />
        <TextField label="附加负重 kg" value={form.added_weight} onChangeText={(added_weight) => patchForm({ added_weight })} numeric />
        <TextField label="完成次数" value={form.reps} onChangeText={(reps) => patchForm({ reps })} numeric />
        <ChipGroup options={QUALITY_OPTIONS} value={form.form_quality} onChange={(form_quality) => patchForm({ form_quality, penalty_weight: defaultPenalty(form_quality) })} />
        <TextField label="扣罚重量 kg" value={form.penalty_weight} onChangeText={(penalty_weight) => patchForm({ penalty_weight })} numeric />
      </SectionCard>

      {preview ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>提交前预估</Text>
          <Text style={styles.resultValue}>{formatKg(preview.oneRm)}</Text>
          <Text style={styles.resultMeta}>力量分 {preview.score == null ? '公式加载中' : preview.score.toFixed(1)}</Text>
        </View>
      ) : null}

      <SectionCard title="展示信息">
        <TextField label="显示名称" value={form.user_name} onChangeText={(user_name) => patchForm({ user_name })} placeholder="可选，不填则按账号信息展示" />
        <TextField label="视频链接" value={form.video_url} onChangeText={(video_url) => patchForm({ video_url })} placeholder="可选，建议提供标准动作视频" />
      </SectionCard>

      <Pressable onPress={submit} disabled={submitting} style={[styles.fullPrimaryButton, submitting && styles.buttonDisabled]}>
        <Text style={styles.primaryButtonText}>{submitting ? '提交中' : '提交社区数据'}</Text>
      </Pressable>
    </Page>
  )
}

export function StreetliftingSubmitSuccessScreen({ navigation, route }: SubmitSuccessProps) {
  return (
    <Page>
      <View style={styles.successHero}>
        <View style={styles.successIcon}>
          <IconFont name="icon-jhk" color="#FFFFFF" size={32} />
        </View>
        <Text style={styles.successTitle}>提交成功</Text>
        <Text style={styles.successText}>你的数据已经进入街健指数社区样本，可在社区数据页查看。</Text>
      </View>
      <View style={styles.statGrid}>
        <StatCard value={exerciseLabel(route.params?.exerciseType || 'weighted_pullup')} label="项目" />
        <StatCard value={formatKg(route.params?.oneRm)} label="负重 1RM" />
        <StatCard value={route.params?.score ? route.params.score.toFixed(1) : '--'} label="力量分" />
        <StatCard value={route.params?.submissionId ? '已记录' : '已提交'} label="状态" />
      </View>
      <View style={styles.actions}>
        <Pressable onPress={() => navigation.replace('StreetliftingData')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>查看社区数据</Text></Pressable>
        <Pressable onPress={() => navigation.replace('StreetliftingCalculator')} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>继续计算</Text></Pressable>
      </View>
    </Page>
  )
}

export function StreetliftingLocationsMapScreen({ navigation }: MapProps) {
  const [pins, setPins] = useState<MapPin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiClient.request<MapPin[]>('/api/streetlifting-index/locations/map-pins', { method: 'POST', body: {}, timeoutMs: 12000 })
      setPins(data || [])
    } catch (e) {
      setError((e as Error)?.message || '地图点位加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, number>()
    pins.forEach((pin) => {
      const area = pin.province || '未填写省份'
      map.set(area, (map.get(area) || 0) + 1)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [pins])

  return (
    <Page>
      <BackRow onPress={() => navigation.goBack()} />
      <Hero title="点位地图" subtitle="APP 端先展示可导航点位列表，点击点位可打开系统地图。" icon="icon-location" />
      <View style={styles.statGrid}>
        <StatCard value={pins.length} label="可导航点位" />
        <StatCard value={grouped.length} label="覆盖区域" />
      </View>
      {grouped.length ? (
        <SectionCard title="区域分布">
          {grouped.map(([name, count]) => (
            <View key={name} style={styles.areaRow}>
              <Text style={styles.areaName}>{name}</Text>
              <Text style={styles.areaCount}>{count} 个点位</Text>
            </View>
          ))}
        </SectionCard>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading ? (
        <View style={styles.loadingCard}><ActivityIndicator color={colors.brand} /><Text style={styles.loadingText}>正在加载地图点位</Text></View>
      ) : (
        <View style={styles.list}>
          {pins.map((pin) => (
            <Pressable key={pin.id} onPress={() => navigation.navigate('StreetliftingLocationDetail', { id: pin.id })} style={styles.pinCard}>
              <View style={styles.pinIcon}><IconFont name="icon-location" color={colors.brand} size={22} /></View>
              <View style={styles.pinMain}>
                <Text style={styles.pinTitle}>{pin.name}</Text>
                <Text style={styles.pinMeta}>{areaLine(pin)}</Text>
                {pin.address ? <Text style={styles.pinAddress}>{pin.address}</Text> : null}
              </View>
              <IconFont name="icon-right-arrow" color={colors.textMuted} size={16} />
            </Pressable>
          ))}
        </View>
      )}
    </Page>
  )
}

export function StreetliftingLocationDetailScreen({ navigation, route }: DetailProps) {
  const locationId = route.params?.id || ''
  const [location, setLocation] = useState<StreetliftingLocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await apiClient.request<{ location: StreetliftingLocation }>('/api/streetlifting-index/locations/get', {
          method: 'POST',
          body: { id: locationId },
          timeoutMs: 12000,
        })
        if (mounted) setLocation(data.location)
      } catch (e) {
        if (mounted) setError((e as Error)?.message || '点位加载失败')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [locationId])

  const openMap = () => {
    if (!location?.latitude || !location?.longitude) return
    const label = encodeURIComponent(location.name)
    const url = `https://maps.apple.com/?ll=${location.latitude},${location.longitude}&q=${label}`
    Linking.openURL(url).catch(() => undefined)
  }

  const images = locationImages(location)

  return (
    <Page>
      <BackRow onPress={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.loadingCard}><ActivityIndicator color={colors.brand} /><Text style={styles.loadingText}>正在加载点位</Text></View>
      ) : error ? (
        <SectionCard title="加载失败"><Text style={styles.errorText}>{error}</Text></SectionCard>
      ) : location ? (
        <>
          <Hero title={location.name} subtitle={addressLine(location) || '单杠地图点位'} icon="icon-location" />
          {images[0] ? <Image source={{ uri: images[0] }} style={styles.locationImage} /> : <View style={styles.locationImageFallback}><IconFont name="icon-location" color={colors.brand} size={30} /></View>}
          <SectionCard title="点位信息">
            <Text style={styles.docTitle}>{areaLine(location)}</Text>
            <Text style={styles.paragraph}>{location.description || '这个点位暂时还没有更多介绍。'}</Text>
            {location.address ? <Text style={styles.pinAddress}>{location.address}</Text> : null}
            <Text style={styles.storyMeta}>贡献者：{location.contributor_name_snapshot || location.user_contact || '未署名'}</Text>
          </SectionCard>
          <View style={styles.actions}>
            <Pressable onPress={openMap} disabled={!location.latitude || !location.longitude} style={[styles.primaryButton, (!location.latitude || !location.longitude) && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>打开系统地图</Text></Pressable>
            <Pressable onPress={() => navigation.navigate('StreetliftingLocations')} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>返回列表</Text></Pressable>
          </View>
        </>
      ) : null}
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
  statValue: { color: colors.text, fontSize: 22, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800', marginTop: 4 },
  docRow: { borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surfaceMuted, gap: spacing.xs },
  docTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  docBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  paragraph: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  primaryButton: { flex: 1, minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondaryButton: { flex: 1, minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  fullPrimaryButton: { minHeight: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  buttonDisabled: { opacity: 0.52 },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '800', lineHeight: 20 },
  noticeText: { color: colors.warning, fontSize: 13, fontWeight: '800', lineHeight: 20, borderRadius: radius.md, padding: spacing.sm, backgroundColor: '#FFF7E6' },
  loadingCard: { minHeight: 96, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.surface },
  loadingText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
  list: { gap: spacing.sm },
  storyCard: { borderRadius: radius.lg, padding: spacing.sm, gap: spacing.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow },
  storyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  storyType: { overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4, color: colors.brand, fontSize: 12, fontWeight: '900', backgroundColor: colors.brandSoft },
  storyDate: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  storyTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  storyContent: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  storyMeta: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  modalCard: { maxHeight: '88%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.sm, gap: spacing.xs, backgroundColor: colors.surface },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  chip: { minHeight: 40, borderRadius: radius.pill, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  chipTextActive: { color: '#FFFFFF' },
  chipHelper: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  chipHelperActive: { color: 'rgba(255,255,255,0.82)' },
  field: { gap: spacing.xs },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: '900' },
  input: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.sm, color: colors.text, fontSize: 15, fontWeight: '800', backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  resultCard: { borderRadius: radius.xl, padding: spacing.md, backgroundColor: '#1F1F1F', gap: spacing.xs },
  resultLabel: { color: 'rgba(255,255,255,0.68)', fontSize: 12, fontWeight: '900' },
  resultValue: { color: '#FFFFFF', fontSize: 34, fontWeight: '900' },
  resultMeta: { color: 'rgba(255,255,255,0.82)', fontSize: 14, fontWeight: '800' },
  successHero: { minHeight: 224, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: '#1F1F1F' },
  successIcon: { width: 64, height: 64, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success },
  successTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
  successText: { color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: 22, textAlign: 'center' },
  areaRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surfaceMuted, marginBottom: spacing.xs },
  areaName: { color: colors.text, fontSize: 14, fontWeight: '900' },
  areaCount: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  pinCard: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow },
  pinIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  pinMain: { flex: 1, gap: 4 },
  pinTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  pinMeta: { color: colors.brand, fontSize: 12, fontWeight: '900' },
  pinAddress: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  locationImage: { width: '100%', height: 192, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  locationImageFallback: { height: 176, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
})
