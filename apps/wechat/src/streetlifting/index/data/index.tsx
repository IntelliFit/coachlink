/**
 * 社区数据 - 小程序原生实现（列表、筛选/排序、提交、认领）
 */
import { useEffect, useState, useMemo } from 'react'
import { usePageEnterTrace } from '@/utils/pageTrace'
import { View, Text, ScrollView, Picker, Button, Image } from '@tarojs/components'
import { StableInput as Input } from '@/components/StableInput'
import Taro from '@tarojs/taro'
import {
  streetliftingIndexService,
  type StreetliftingSubmission,
  type StreetliftingFormula
} from '@/services/streetliftingIndexService'
import { studentService } from '@/services/studentService'
import { authService } from '@/services/authService'
import { computeCoefficient, calculateAdded1RM } from '@/utils/streetliftingCalc'
import { validateStreetliftingSubmissionWeights } from '@/utils/streetliftingSubmissionLimits'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

const EXERCISE_OPTIONS = [
  { label: '全部动作', value: 'all' },
  { label: '负重引体', value: 'weighted_pullup' },
  { label: '负重臂屈伸', value: 'weighted_dips' }
]
const GENDER_OPTIONS = [
  { label: '全部性别', value: 'all' },
  { label: '男性', value: 'Male' },
  { label: '女性', value: 'Female' }
]
const PULLUP_OPTIONS = [
  { label: '全部握法', value: 'all' },
  { label: '正手', value: 'Overhand' },
  { label: '反手', value: 'Underhand' }
]
const QUALITY_OPTIONS = [
  { label: '全部质量', value: 'all' },
  { label: '比赛级', value: 'Competition' },
  { label: '轻微借力', value: 'Minor_Cheat' },
  { label: '严重借力', value: 'Major_Cheat' },
  { label: '超严重借力', value: 'Extreme_Cheat' }
]
const VIDEO_OPTIONS = [
  { label: '全部视频', value: 'all' },
  { label: '有视频', value: 'with' },
  { label: '无视频', value: 'without' }
]
const SORT_OPTIONS = [
  { label: '按 1RM', value: 'weight' },
  { label: '按 力量分', value: 'score' },
  { label: '按 时间', value: 'date' }
]
const SUBMIT_EXERCISE = [
  { label: '负重引体向上', value: 'weighted_pullup' },
  { label: '负重双杠臂屈伸', value: 'weighted_dips' }
]
const SUBMIT_QUALITY = [
  { label: '比赛级标准', value: 'Competition' },
  { label: '轻微借力（2-5kg）', value: 'Minor_Cheat' },
  { label: '严重借力（5-20kg）', value: 'Major_Cheat' },
  { label: '超严重借力（20-50kg）', value: 'Extreme_Cheat' }
]

function qualityLabel(q: string) {
  const m: Record<string, string> = {
    Competition: '比赛级',
    Minor_Cheat: '轻微借力',
    Major_Cheat: '严重借力',
    Extreme_Cheat: '超严重借力'
  }
  return m[q] || q
}

/** 列表卡片展示提交时间 */
function formatSubmissionTime(iso: string | undefined | null): string {
  if (!iso) return ''
  const d = new Date(String(iso))
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function StreetliftingData() {
  usePageEnterTrace()

  const { effectiveTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [submissions, setSubmissions] = useState<StreetliftingSubmission[]>([])
  const [formulaMap, setFormulaMap] = useState<Record<string, StreetliftingFormula>>({})
  const [filterEx, setFilterEx] = useState('all')
  const [filterGender, setFilterGender] = useState('all')
  const [filterPullup, setFilterPullup] = useState('all')
  const [filterQuality, setFilterQuality] = useState('all')
  const [filterVideo, setFilterVideo] = useState<'all' | 'with' | 'without'>('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'weight' | 'score' | 'date'>('weight')
  /** 展开后显示：全部动作～按 1RM 等筛选标签 */

  const [formOpen, setFormOpen] = useState(false)
  const [profileLocked, setProfileLocked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [claimingIds, setClaimingIds] = useState<Set<string>>(new Set())
  const [claimDialogOpen, setClaimDialogOpen] = useState(false)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [existingSubmission, setExistingSubmission] = useState<{
    id: string
    created_at: string
    exercise_type: string
    bodyweight: number
    added_weight: number
    reps: number
  } | null>(null)
  const [form, setForm] = useState({
    exercise_type: 'weighted_pullup' as 'weighted_pullup' | 'weighted_dips',
    gender: '' as '' | 'Male' | 'Female',
    bodyweight: null as number | null,
    added_weight: null as number | null,
    reps: null as number | null,
    form_quality: '' as string,
    penalty_weight: 3,
    user_name: '',
    video_url: '',
    pullup_type: '' as '' | 'Overhand' | 'Underhand'
  })

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const [subData, formulaData] = await Promise.all([
          streetliftingIndexService.listSubmissions({ limit: 500 }),
          streetliftingIndexService.listFormulas()
        ])
        if (!cancelled) {
          setSubmissions(subData?.submissions || [])
          const next: Record<string, StreetliftingFormula> = {}
          ;(formulaData?.formulas || []).forEach((f) => {
            next[f.gender] = f
          })
          setFormulaMap(next)
        }
      } catch (e) {
        if (!cancelled) Taro.showToast({ title: (e as Error)?.message || '加载失败', icon: 'none' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const computeScore = (s: StreetliftingSubmission) => {
    const f = formulaMap[s.gender]
    if (!f) return 0
    const bw = Number(s.bodyweight)
    const aw = Number(s.added_weight)
    const reps = Number(s.reps)
    const penalty = Number((s as any).penalty_weight ?? 0)
    if (!Number.isFinite(bw) || bw <= 0 || !Number.isFinite(aw) || !Number.isFinite(reps) || reps < 1 || reps > 36) return 0
    const added1RM = calculateAdded1RM(bw, aw, reps, penalty)
    const total1rm = bw + added1RM
    if (!Number.isFinite(total1rm) || total1rm <= 0) return 0
    const coeff = computeCoefficient(bw, f)
    if (!Number.isFinite(coeff) || coeff <= 0) return 0
    const raw = total1rm * coeff
    return s.exercise_type === 'weighted_dips' ? raw / 1.3 : raw
  }

  const compute1RM = (s: StreetliftingSubmission) => {
    const bw = Number(s.bodyweight)
    const aw = Number(s.added_weight)
    const reps = Number(s.reps)
    const penalty = Number((s as any).penalty_weight ?? 0)
    if (!Number.isFinite(bw) || !Number.isFinite(aw) || !Number.isFinite(reps) || !Number.isFinite(penalty)) return 0
    return calculateAdded1RM(bw, aw, reps, penalty)
  }

  const filtered = useMemo(() => {
    let arr = [...submissions]
    if (filterEx !== 'all') arr = arr.filter((s) => s.exercise_type === filterEx)
    if (filterGender !== 'all') arr = arr.filter((s) => s.gender === filterGender)
    if (filterPullup !== 'all') arr = arr.filter((s) => s.pullup_type === filterPullup)
    if (filterQuality !== 'all') arr = arr.filter((s) => s.form_quality === filterQuality)
    if (filterVideo === 'with') arr = arr.filter((s) => !!(s.video_url && s.video_url.trim()))
    if (filterVideo === 'without') arr = arr.filter((s) => !(s.video_url && s.video_url.trim()))
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      arr = arr.filter((s) => (s.user_name || '').toLowerCase().includes(q))
    }
    if (sortBy === 'date') arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    else if (sortBy === 'weight') arr.sort((a, b) => compute1RM(b) - compute1RM(a))
    else arr.sort((a, b) => computeScore(b) - computeScore(a))
    return arr
  }, [submissions, filterEx, filterGender, filterPullup, filterQuality, filterVideo, search, sortBy])

  const stats = useMemo(() => ({
    total: filtered.length,
    withVideo: filtered.filter((s) => !!s.video_url).length,
    pullup: filtered.filter((s) => s.exercise_type === 'weighted_pullup').length,
    dips: filtered.filter((s) => s.exercise_type === 'weighted_dips').length
  }), [filtered])

  const openSubmit = async () => {
    const user = authService.getCurrentUser()
    if (!user?.id) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    try {
      const profileData = await studentService.getStudentProfile(user.id)
      const profile = (profileData as any)?.profile || null
      let gender: '' | 'Male' | 'Female' = ''
      if (profile?.gender) {
        const g = String(profile.gender).toLowerCase()
        if (g.includes('male') || g.includes('男')) gender = 'Male'
        else if (g.includes('female') || g.includes('女')) gender = 'Female'
      }
      const weight = typeof profile?.weight === 'number' && Number.isFinite(profile.weight) ? profile.weight : null
      if (!gender || !weight) {
        Taro.showToast({ title: '请先在个人档案填写性别与体重', icon: 'none' })
        return
      }
      setProfileLocked(true)
      setForm((p) => ({
        ...p,
        user_name: p.user_name || (user as any).name || '',
        gender,
        bodyweight: weight
      }))
      setFormOpen(true)
    } catch (e) {
      Taro.showToast({ title: (e as Error)?.message || '读取档案失败', icon: 'none' })
    }
  }

  const resetForm = () => {
    setProfileLocked(false)
    setForm({
      exercise_type: 'weighted_pullup',
      gender: '',
      bodyweight: null,
      added_weight: null,
      reps: null,
      form_quality: '',
      penalty_weight: 3,
      user_name: '',
      video_url: '',
      pullup_type: ''
    })
  }

  const handleSubmit = async () => {
    if (!form.gender || !Number.isFinite(form.bodyweight) || (form.bodyweight as number) <= 0) {
      Taro.showToast({ title: '请填写性别与体重', icon: 'none' })
      return
    }
    if (!Number.isFinite(form.added_weight)) {
      Taro.showToast({ title: '请填写附加负重', icon: 'none' })
      return
    }
    const weightCheck = validateStreetliftingSubmissionWeights(
      form.bodyweight as number,
      form.added_weight as number
    )
    if (!weightCheck.ok) {
      Taro.showToast({ title: weightCheck.message, icon: 'none' })
      return
    }
    if (!Number.isFinite(form.reps) || (form.reps as number) < 1 || (form.reps as number) > 36) {
      Taro.showToast({ title: '次数须在 1-36 之间', icon: 'none' })
      return
    }
    if (!form.form_quality) {
      Taro.showToast({ title: '请选择动作质量', icon: 'none' })
      return
    }
    if (form.exercise_type === 'weighted_pullup' && !form.pullup_type) {
      Taro.showToast({ title: '负重引体请选择握法', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      const penalty = ['Minor_Cheat', 'Major_Cheat', 'Extreme_Cheat'].includes(form.form_quality) ? form.penalty_weight : 0
      await streetliftingIndexService.createSubmission({
        gender: form.gender,
        bodyweight: form.bodyweight as number,
        added_weight: form.added_weight as number,
        reps: form.reps as number,
        form_quality: form.form_quality,
        penalty_weight: penalty,
        user_name: form.user_name?.trim() || null,
        video_url: form.video_url?.trim() || null,
        pullup_type: form.exercise_type === 'weighted_pullup' ? (form.pullup_type as any) : null,
        exercise_type: form.exercise_type
      })
      Taro.showToast({ title: '提交成功', icon: 'success' })
      setFormOpen(false)
      resetForm()
      const data = await streetliftingIndexService.listSubmissions({ limit: 500 })
      setSubmissions(data?.submissions || [])
    } catch (e) {
      Taro.showToast({ title: (e as Error)?.message || '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleClaimClick = async (submissionId: string) => {
    const user = authService.getCurrentUser()
    if (!user?.id) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    try {
      const check = await streetliftingIndexService.checkExistingSubmission()
      if (check?.hasExisting && check.existingSubmission) {
        setExistingSubmission(check.existingSubmission)
        setClaimingId(submissionId)
        setClaimDialogOpen(true)
      } else {
        await doClaim(submissionId)
      }
    } catch {
      await doClaim(submissionId)
    }
  }

  const doClaim = async (submissionId: string) => {
    setClaimDialogOpen(false)
    setClaimingId(null)
    setExistingSubmission(null)
    setClaimingIds((prev) => new Set(prev).add(submissionId))
    try {
      await streetliftingIndexService.claimSubmission(submissionId)
      Taro.showToast({ title: '认领成功', icon: 'success' })
      const data = await streetliftingIndexService.listSubmissions({ limit: 500 })
      setSubmissions(data?.submissions || [])
    } catch (e) {
      Taro.showToast({ title: (e as Error)?.message || '认领失败', icon: 'none' })
    } finally {
      setClaimingIds((prev) => {
        const next = new Set(prev)
        next.delete(submissionId)
        return next
      })
    }
  }

  const renderSkeleton = () => (
    <View className='skeleton-wrap'>
      <View className='stats-row skeleton-stats'>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} className='stat skeleton-stat'>
            <View className='skeleton-line' style={{ width: '50%', height: '40rpx', marginBottom: '8rpx' }} />
            <View className='skeleton-line' style={{ width: '70%', height: '24rpx' }} />
          </View>
        ))}
      </View>
      {[1, 2, 3].map((i) => (
        <View key={`card-${i}`} className='data-card skeleton-card'>
          <View className='skeleton-head'>
            <View className='skeleton-line' style={{ width: '88rpx', height: '88rpx', borderRadius: '9999rpx', flexShrink: 0 }} />
            <View style={{ flex: 1, marginLeft: '16rpx', minWidth: 0 }}>
              <View className='skeleton-line' style={{ width: '55%', height: '32rpx', marginBottom: '12rpx' }} />
              <View className='skeleton-line' style={{ width: '70%', height: '22rpx' }} />
            </View>
            <View className='skeleton-line' style={{ width: '96rpx', height: '48rpx', flexShrink: 0 }} />
          </View>
          <View className='skeleton-tags'>
            <View className='skeleton-line' style={{ width: '80rpx', height: '36rpx', borderRadius: '9999rpx' }} />
            <View className='skeleton-line' style={{ width: '96rpx', height: '36rpx', borderRadius: '9999rpx' }} />
            <View className='skeleton-line' style={{ width: '80rpx', height: '36rpx', borderRadius: '9999rpx' }} />
          </View>
          <View className='skeleton-score-hero'>
            <View className='skeleton-line' style={{ width: '30%', height: '28rpx', margin: '0 auto 16rpx' }} />
            <View className='skeleton-line' style={{ width: '50%', height: '56rpx', margin: '0 auto' }} />
          </View>
          <View className='skeleton-grid'>
            {[1, 2, 3, 4].map((j) => (
              <View key={j} className='skeleton-cell'>
                <View className='skeleton-line' style={{ width: '60%', height: '24rpx', marginBottom: '8rpx' }} />
                <View className='skeleton-line' style={{ width: '80%', height: '32rpx' }} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  )

  return (
    <View className={`data-page theme-${effectiveTheme}${effectiveTheme === 'dark' ? ' cl-theme-dark' : ''}`}>
      <View className='data-page-inner'>
        <View className='data-head'>
          <View className='data-search'>
            <Text className='iconfont icon-search data-search__icon' />
            <Input
              className='data-search__input'
              placeholder='搜索用户名'
              placeholderClass='data-search__placeholder'
              value={search}
              onInput={(e) => setSearch(e.detail.value)}
            />
          </View>
          <View className='data-segment'>
            {EXERCISE_OPTIONS.map((option) => (
              <View
                key={option.value}
                className={`data-segment__item ${filterEx === option.value ? 'data-segment__item--active' : ''}`}
                onClick={() => setFilterEx(option.value)}
              >
                <Text>{option.value === 'all' ? '全部' : option.label}</Text>
              </View>
            ))}
          </View>
          <ScrollView className='data-filter-scroll' scrollX enhanced showScrollbar={false}>
            <View className='data-filter-row'>
              {([
                ['性别', GENDER_OPTIONS, filterGender, (v: string) => setFilterGender(v)],
                ['握法', PULLUP_OPTIONS, filterPullup, (v: string) => setFilterPullup(v)],
                ['质量', QUALITY_OPTIONS, filterQuality, (v: string) => setFilterQuality(v)],
                ['视频', VIDEO_OPTIONS, filterVideo, (v: string) => setFilterVideo(v as typeof filterVideo)]
              ] as Array<[string, Array<{ label: string; value: string }>, string, (v: string) => void]>).map(([title, options, value, onPick]) => (
                <Picker
                  key={title}
                  mode='selector'
                  range={options}
                  rangeKey='label'
                  value={Math.max(0, options.findIndex((o) => o.value === value))}
                  onChange={(e) => onPick(options[Number(e.detail.value)]?.value || 'all')}
                >
                  <View className={`data-filter-chip ${value !== 'all' ? 'data-filter-chip--active' : ''}`}>
                    <Text>{value === 'all' ? title : options.find((o) => o.value === value)?.label}</Text>
                    <Text className='data-filter-chip__caret'>▾</Text>
                  </View>
                </Picker>
              ))}
              <View className='data-filter-divider' />
              <Picker mode='selector' range={SORT_OPTIONS} rangeKey='label' value={Math.max(0, SORT_OPTIONS.findIndex((o) => o.value === sortBy))} onChange={(e) => setSortBy(SORT_OPTIONS[Number(e.detail.value)]?.value as any)}>
                <View className='data-filter-chip'>
                  <Text>{(SORT_OPTIONS.find((o) => o.value === sortBy)?.label || '排序').replace('按 ', '按')}</Text>
                  <Text className='data-filter-chip__caret'>▾</Text>
                </View>
              </Picker>
            </View>
          </ScrollView>
          {!loading && (
            <Text className='data-summary cl-num'>{`${stats.total} 条成绩 · ${stats.withVideo} 条有视频`}</Text>
          )}
        </View>

        <ScrollView className='data-scroll' scrollY>
        {loading ? (
          renderSkeleton()
        ) : filtered.length === 0 ? (
          <View className='empty-wrap'><Text>没有符合条件的数据</Text></View>
        ) : (
          <View className='data-list'>
            {filtered.map((s) => {
              const rm = compute1RM(s)
              const score = computeScore(s)
              const avatarUrl = (s.user_avatar_url && String(s.user_avatar_url).trim()) || ''
              const displayName = s.user_name || '匿名'
              return (
                <View key={s.id} className='data-row'>
                  {avatarUrl ? (
                    <Image className='data-avatar' src={avatarUrl} mode='aspectFill' />
                  ) : (
                    <View className='data-avatar data-avatar--placeholder'>
                      <Text className='data-avatar-letter'>{displayName.slice(0, 1)}</Text>
                    </View>
                  )}
                  <View className='data-row__main'>
                    <View className='data-row__title'>
                      <Text className='data-row__name' numberOfLines={1}>{displayName}</Text>
                      <Text className='data-row__date'>{formatSubmissionTime(s.created_at)}</Text>
                    </View>
                    <Text className='data-row__tags' numberOfLines={1}>
                      {[
                        s.gender === 'Male' ? '男' : '女',
                        s.exercise_type === 'weighted_pullup' ? '负重引体' : '臂屈伸',
                        s.pullup_type ? (s.pullup_type === 'Overhand' ? '正手' : '反手') : null,
                        qualityLabel(s.form_quality)
                      ].filter(Boolean).join(' · ')}
                    </Text>
                    <Text className='data-row__stats cl-num' numberOfLines={1}>
                      {`体重 ${s.bodyweight}kg · +${s.added_weight}kg × ${s.reps} · 1RM ${rm.toFixed(1)}`}
                    </Text>
                    {(!s.user_id || s.video_url) && (
                      <View className='data-row__actions'>
                        {s.video_url && (
                          <Text className='data-row__action' onClick={() => {
                            Taro.setClipboardData({ data: s.video_url!, success: () => Taro.showToast({ title: '视频链接已复制', icon: 'success' }) })
                          }}>复制视频链接</Text>
                        )}
                        {!s.user_id && (
                          <Text
                            className={`data-row__action ${claimingIds.has(s.id) ? 'data-row__action--busy' : ''}`}
                            onClick={() => { if (!claimingIds.has(s.id)) handleClaimClick(s.id) }}
                          >认领这条</Text>
                        )}
                      </View>
                    )}
                  </View>
                  <View className='data-row__score'>
                    <Text className='data-row__score-value cl-num'>{score.toFixed(1)}</Text>
                    <Text className='data-row__score-label'>力量分</Text>
                  </View>
                </View>
              )
            })}
          </View>
        )}
        </ScrollView>
      </View>

      {!formOpen && !claimDialogOpen && (
        <View className='data-submit-bar'>
          <View className='data-submit-bar__btn' onClick={openSubmit}>
            <Text>提交我的成绩</Text>
          </View>
        </View>
      )}

      {formOpen && (
        <View className='dialog-mask' onClick={() => { setFormOpen(false); resetForm() }}>
          <View className='dialog-box' onClick={(e) => e.stopPropagation()}>
            <Text className='dialog-title'>提交我的数据</Text>
            <ScrollView scrollY className='dialog-scroll'>
              <View className='form-row'><Text className='label'>运动类型</Text>
                <Picker mode='selector' range={SUBMIT_EXERCISE} rangeKey='label' value={SUBMIT_EXERCISE.findIndex((o) => o.value === form.exercise_type)} onChange={(e) => setForm((p) => ({ ...p, exercise_type: (SUBMIT_EXERCISE[Number(e.detail.value)]?.value || 'weighted_pullup') as 'weighted_pullup' | 'weighted_dips', pullup_type: '' }))}>
                  <View className='picker-val'>{SUBMIT_EXERCISE.find((o) => o.value === form.exercise_type)?.label}</View>
                </Picker>
              </View>
              <View className='form-row'><Text className='label'>性别</Text><View className='picker-val'>{form.gender ? (form.gender === 'Male' ? '男性' : '女性') : '-'}</View></View>
              <View className='form-row'><Text className='label'>体重(kg)</Text><Input className='input' type='digit' value={form.bodyweight != null ? String(form.bodyweight) : ''} onInput={(e) => setForm((p) => ({ ...p, bodyweight: Number(e.detail.value) || null }))} disabled={profileLocked} /></View>
              <View className='form-row'><Text className='label'>附加负重(kg)</Text><Input className='input' type='digit' value={form.added_weight != null ? String(form.added_weight) : ''} onInput={(e) => setForm((p) => ({ ...p, added_weight: Number(e.detail.value) || null }))} /></View>
              <View className='form-row'><Text className='label'>完成次数</Text><Input className='input' type='number' value={form.reps != null ? String(form.reps) : ''} onInput={(e) => setForm((p) => ({ ...p, reps: Number(e.detail.value) || null }))} /></View>
              <View className='form-row'><Text className='label'>动作质量</Text>
                <Picker mode='selector' range={SUBMIT_QUALITY} rangeKey='label' value={SUBMIT_QUALITY.findIndex((o) => o.value === form.form_quality)} onChange={(e) => setForm((p) => ({ ...p, form_quality: SUBMIT_QUALITY[Number(e.detail.value)]?.value || '' }))}>
                  <View className='picker-val'>{SUBMIT_QUALITY.find((o) => o.value === form.form_quality)?.label || '请选择'}</View>
                </Picker>
              </View>
              {form.exercise_type === 'weighted_pullup' && (
                <View className='form-row'><Text className='label'>引体类型</Text>
                  <Picker mode='selector' range={[{ label: '正手', value: 'Overhand' }, { label: '反手', value: 'Underhand' }]} rangeKey='label' value={form.pullup_type === 'Overhand' ? 0 : form.pullup_type === 'Underhand' ? 1 : 0} onChange={(e) => setForm((p) => ({ ...p, pullup_type: Number(e.detail.value) === 0 ? 'Overhand' : 'Underhand' }))}>
                    <View className='picker-val'>{form.pullup_type === 'Overhand' ? '正手' : form.pullup_type === 'Underhand' ? '反手' : '请选择'}</View>
                  </Picker>
                </View>
              )}
              {['Minor_Cheat', 'Major_Cheat', 'Extreme_Cheat'].includes(form.form_quality) && (
                <View className='form-row'><Text className='label'>惩罚重量(kg)</Text><Input className='input' type='digit' value={String(form.penalty_weight)} onInput={(e) => setForm((p) => ({ ...p, penalty_weight: Number(e.detail.value) || 0 }))} /></View>
              )}
              <View className='form-row'><Text className='label'>姓名/社媒(选填)</Text><Input className='input' value={form.user_name} onInput={(e) => setForm((p) => ({ ...p, user_name: e.detail.value }))} placeholder='选填' /></View>
              <View className='form-row'><Text className='label'>视频链接(选填)</Text><Input className='input' value={form.video_url} onInput={(e) => setForm((p) => ({ ...p, video_url: e.detail.value }))} placeholder='https://...' /></View>
            </ScrollView>
            <View className='dialog-actions'>
              <Button className='btn-cancel' onClick={() => { setFormOpen(false); resetForm() }}>取消</Button>
              <Button className='btn-ok' onClick={handleSubmit} disabled={submitting}>提交</Button>
            </View>
          </View>
        </View>
      )}

      {claimDialogOpen && (
        <View className='dialog-mask' onClick={() => { setClaimDialogOpen(false); setClaimingId(null); setExistingSubmission(null) }}>
          <View className='dialog-box small' onClick={(e) => e.stopPropagation()}>
            <Text className='dialog-title'>确认认领</Text>
            <Text className='dialog-body'>
              {existingSubmission ? '你已有认领数据，认领新数据将覆盖现有数据。确定继续？' : '确定认领这条数据？'}
            </Text>
            <View className='dialog-actions'>
              <Button className='btn-cancel' onClick={() => { setClaimDialogOpen(false); setClaimingId(null); setExistingSubmission(null) }}>取消</Button>
              <Button className='btn-ok' onClick={() => claimingId && doClaim(claimingId)}>确认认领</Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
