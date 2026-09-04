import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import { IconFont } from '../../components/IconFont'
import type { RootStackParamList } from '../../navigation/types'
import { colors, radius, spacing } from '../../theme'
import { Card, EmptyState, InlineAvatar, LoadingState, ScreenShell, SolidButton, safeRequest } from '../me/MeShared'

type Navigation = NativeStackNavigationProp<RootStackParamList>
type SortMode = 'subscription_created_desc' | 'subscription_created_asc' | 'subscription_updated_desc'

const PAGE_SIZE = 10
const SORT_OPTIONS: Array<{ label: string; value: SortMode }> = [
  { label: '新订阅', value: 'subscription_created_desc' },
  { label: '旧订阅', value: 'subscription_created_asc' },
  { label: '最近更新', value: 'subscription_updated_desc' },
]

function nameOf(student: any) {
  return student?.profile?.nickname || student?.profile?.full_name || student?.profile?.phone || student?.student_id || '学员'
}

function tierLabel(tier: unknown) {
  const value = Number(tier || 1)
  if (value >= 3) return '高级'
  if (value === 2) return '进阶'
  return '基础'
}

function planStatus(student: any) {
  const status = String(student?.plan?.status || '')
  if (!student?.plan) return '未配置'
  if (status === 'completed') return '已完成'
  if (status === 'paused') return '已暂停'
  return '进行中'
}

function dateText(value?: string | null) {
  if (!value) return '未设置'
  return String(value).slice(0, 10)
}

function genderLabel(value?: string | null) {
  const labels: Record<string, string> = { male: '男', female: '女', other: '其他', unknown: '未填写' }
  return labels[String(value || '').toLowerCase()] || value || '-'
}

function fitnessLevelLabel(value?: string | null) {
  const labels: Record<string, string> = { beginner: '入门', intermediate: '进阶', advanced: '高阶' }
  return labels[String(value || '').toLowerCase()] || value || '-'
}

function subscriptionStatusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    active: '进行中',
    waiting: '待处理',
    inactive: '未激活',
    pending_payment: '待支付',
    expired: '已到期',
    completed: '已完成',
    cancelled: '已取消',
  }
  return labels[String(value || '').toLowerCase()] || value || '未知状态'
}

function progressOf(student: any) {
  const total = Number(student?.progress?.total || 0)
  const completed = Number(student?.progress?.completed || 0)
  const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0
  return { total, completed, percent }
}

export function CoachStudentsScreen() {
  const navigation = useNavigation<Navigation>()
  const isTopLevelTab = useRoute().name === 'CoachStudentsTab'
  const backAction = isTopLevelTab ? undefined : () => navigation.goBack()
  const [students, setStudents] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortMode>('subscription_created_desc')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const load = useCallback(async (nextPage = page, quiet = false) => {
    try {
      if (quiet) setRefreshing(true)
      else setLoading(true)
      setError(null)
      const res = await safeRequest<any>('/api/coach/list-students', {
        body: {
          pagination: { page: nextPage, limit: PAGE_SIZE },
          search: query || undefined,
          sort: { mode: sort },
        },
      })
      const rows = Array.isArray(res?.students) ? res.students : []
      setStudents(rows)
      setTotal(Number(res?.pagination?.total ?? res?.total ?? rows.length))
      setPage(nextPage)
    } catch (e) {
      setStudents([])
      setTotal(0)
      setError(e instanceof Error ? e.message : '学员列表加载失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [page, query, sort])

  useEffect(() => {
    void load(0)
  }, [query, sort])

  const noPlanCount = useMemo(() => students.filter((item) => !item?.plan).length, [students])

  function submitSearch() {
    setQuery(search.trim())
    setPage(0)
  }

  return (
    <ScreenShell title="学员管理" subtitle={`${total} 位学员 · ${noPlanCount} 位待配置计划`} onBack={backAction} tabBarInset={isTopLevelTab}>
      <Card style={styles.toolbar}>
        <View style={styles.searchRow}>
          <IconFont name="icon-search" size={20} color={colors.textMuted} />
          <TextInput
            accessibilityLabel="搜索学员"
            accessibilityHint="输入学员昵称或手机号后搜索"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={submitSearch}
            returnKeyType="search"
            placeholder="搜索学员昵称/手机号"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          {search ? (
            <Pressable accessibilityRole="button" accessibilityLabel="清除学员搜索" onPress={() => { setSearch(''); setQuery(''); setPage(0) }} style={styles.clearButton}>
              <Text style={styles.clearText}>×</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((item) => (
            <Pressable key={item.value} accessibilityRole="button" accessibilityLabel={`按${item.label}排序`} accessibilityState={{ selected: sort === item.value }} onPress={() => { setSort(item.value); setPage(0) }} style={[styles.sortPill, sort === item.value && styles.sortPillActive]}>
              <Text style={[styles.sortText, sort === item.value && styles.sortTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {loading ? <LoadingState title="正在加载学员" /> : null}
      {!loading && error ? <EmptyState title="加载失败" desc={error} /> : null}
      {!loading && !error && students.length === 0 ? <EmptyState title="暂无学员" desc="尝试调整搜索条件或稍后刷新。" icon="icon-friends-o" /> : null}

      {!loading && !error ? (
        <>
          {students.map((student) => (
            <StudentCard key={String(student?.id || student?.student_id)} student={student} onOpen={() => navigation.navigate('CoachStudentDetail', { subscriptionId: student?.id, studentId: student?.student_id })} />
          ))}
          <View style={styles.pager}>
            <SolidButton label="上一页" variant="secondary" disabled={page <= 0 || refreshing} onPress={() => void load(Math.max(0, page - 1), true)} />
            <Text style={styles.pageText}>第 {page + 1} / {totalPages} 页</Text>
            <SolidButton label="下一页" variant="secondary" disabled={page >= totalPages - 1 || refreshing} onPress={() => void load(Math.min(totalPages - 1, page + 1), true)} />
          </View>
        </>
      ) : null}
    </ScreenShell>
  )
}

function StudentCard({ student, onOpen }: { student: any; onOpen: () => void }) {
  const progress = progressOf(student)
  const unreviewed = Math.max(0, Number(student?.uploaded || 0) - Number(student?.reviewed || 0))
  const status = planStatus(student)
  return (
    <Card style={styles.studentCard}>
      <Pressable onPress={onOpen} style={styles.summary}>
        <InlineAvatar uri={student?.profile?.avatar_url} label={nameOf(student)} size={56} />
        <View style={styles.studentMeta}>
          <View style={styles.nameRow}>
            <Text style={styles.studentName}>{nameOf(student)}</Text>
            <View style={styles.tierChip}><Text style={styles.tierText}>{tierLabel(student?.tier)}</Text></View>
          </View>
          <View style={styles.chipRow}>
            <StatusChip label={status} tone={status === '未配置' ? 'warning' : status === '已完成' ? 'success' : 'brand'} />
            <StatusChip label={`待评 ${unreviewed}`} tone={unreviewed > 0 ? 'warning' : 'muted'} />
            <StatusChip label={`${Number(student?.subscribed_weeks || 0) || '-'}周`} tone="muted" />
          </View>
        </View>
        <IconFont name="icon-right-arrow" size={18} color={colors.textMuted} />
      </Pressable>

      <View style={styles.planBox}>
        <Text style={styles.planName}>{student?.plan?.name || '未配置计划'}</Text>
        <Text style={styles.planDesc}>{student?.plan?.description || '当前学员还没有可执行计划。'}</Text>
        <View style={styles.progressLine}>
          <View style={[styles.progressFill, { width: `${progress.percent}%` }]} />
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricText}>训练进度 {progress.completed}/{progress.total} 天 · {progress.percent}%</Text>
          <Text style={styles.metricText}>到期 {dateText(student?.end_date)}</Text>
        </View>
      </View>
    </Card>
  )
}

function StatusChip({ label, tone }: { label: string; tone: 'brand' | 'success' | 'warning' | 'muted' }) {
  return (
    <View style={[styles.statusChip, tone === 'brand' && styles.brandChip, tone === 'success' && styles.successChip, tone === 'warning' && styles.warningChip]}>
      <Text style={[styles.statusText, tone === 'brand' && styles.brandText, tone === 'success' && styles.successText, tone === 'warning' && styles.warningText]}>{label}</Text>
    </View>
  )
}

export function CoachStudentDetailScreen() {
  const navigation = useNavigation<Navigation>()
  const route = useRoute<RouteProp<RootStackParamList, 'CoachStudentDetail'>>()
  const [student, setStudent] = useState<any>(null)
  const [planData, setPlanData] = useState<any>(null)
  const [feedbacks, setFeedbacks] = useState<any[]>([])
  const [studentActions, setStudentActions] = useState<any[]>([])
  const [oneRmDrafts, setOneRmDrafts] = useState<Record<string, string>>({})
  const [savingOneRm, setSavingOneRm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const subscriptionId = String(route.params?.subscriptionId || '')
      const [studentResult, planResult, actionsResult] = await Promise.allSettled([
        safeRequest<any>('/api/coach/get-student', {
          body: {
            subscriptionId,
            studentId: route.params?.studentId,
            need1RM: true,
          },
        }),
        safeRequest<any>('/api/plan-lib/get-instance', {
          body: { subscriptionId },
        }),
        safeRequest<any>('/api/coach/get-student-actions', {
          body: { subscriptionId },
        }),
      ])
      if (studentResult.status === 'rejected') throw studentResult.reason
      setStudent(studentResult.value?.student || null)
      const nextPlanData = planResult.status === 'fulfilled' ? planResult.value : null
      setPlanData(nextPlanData)
      const nextActions = actionsResult.status === 'fulfilled' && Array.isArray(actionsResult.value?.actions)
        ? actionsResult.value.actions
        : []
      setStudentActions(nextActions)
      setOneRmDrafts(Object.fromEntries(nextActions.map((action: any) => [
        String(action.id),
        action.reference_1rm == null ? '' : String(action.reference_1rm),
      ])))

      const instanceId = nextPlanData?.instance?.id
      if (instanceId) {
        const feedbackResult = await safeRequest<any>('/api/coach/get-student-feedbacks', {
          body: { instanceId, markRead: true },
        }).catch(() => null)
        setFeedbacks(Array.isArray(feedbackResult?.feedbacks) ? feedbackResult.feedbacks : [])
      } else {
        setFeedbacks([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '学员档案加载失败')
    } finally {
      setLoading(false)
    }
  }, [route.params?.studentId, route.params?.subscriptionId])

  useFocusEffect(useCallback(() => {
    void load()
  }, [load]))

  const eligibleActions = useMemo(() => studentActions.filter((action: any) => {
    const type = String(action?.type || 'STRENGTH').toUpperCase()
    if (['DIET', 'CARDIO', 'HABIT', 'REST'].includes(type)) return false
    return action?.enableAutoWeightCompute !== false && action?.enable_auto_weight_compute !== false
  }).slice(0, 30), [studentActions])

  async function saveOneRm() {
    const subscriptionId = String(route.params?.subscriptionId || '')
    const updates = eligibleActions.flatMap((action: any) => {
      const raw = oneRmDrafts[String(action.id)]?.trim() || ''
      const original = action.reference_1rm == null ? '' : String(action.reference_1rm)
      if (raw === original) return []
      const value = raw ? Number(raw) : null
      if (value !== null && (!Number.isFinite(value) || value <= 0)) return []
      return [{ actionId: String(action.id), reference_1rm: value }]
    })
    if (updates.length === 0) {
      Alert.alert('无需保存', '没有检测到有效的 1RM 修改。')
      return
    }
    setSavingOneRm(true)
    try {
      const result = await safeRequest<any>('/api/coach/batch-update-student-1rm', {
        body: { subscriptionId, updates },
      })
      Alert.alert('保存成功', `已更新 ${Number(result?.updated || updates.length)} 个动作。`)
      await load()
    } catch (saveError) {
      Alert.alert('保存失败', saveError instanceof Error ? saveError.message : '请稍后重试')
    } finally {
      setSavingOneRm(false)
    }
  }

  return (
    <ScreenShell title="学员档案" subtitle="订阅、问卷、训练资料与当前计划。" onBack={() => navigation.goBack()}>
      {loading ? <LoadingState title="正在加载学员档案" /> : null}
      {!loading && error ? <EmptyState title="加载失败" desc={error} /> : null}
      {!loading && !error && student ? (
        <StudentDetailBody
          student={student}
          planData={planData}
          feedbacks={feedbacks}
          eligibleActions={eligibleActions}
          oneRmDrafts={oneRmDrafts}
          savingOneRm={savingOneRm}
          onOneRmChange={(actionId, value) => setOneRmDrafts((current) => ({ ...current, [actionId]: value }))}
          onSaveOneRm={() => void saveOneRm()}
          onAssignPlan={() => navigation.navigate('CoachAssignPlan', {
            subscriptionId: String(route.params?.subscriptionId || student?.id || ''),
            studentId: String(route.params?.studentId || student?.student_id || ''),
            studentName: nameOf(student),
          })}
          onOpenDay={(dayIndex) => planData?.instance?.id && navigation.navigate('TrainingExecution', {
            instanceId: String(planData.instance.id),
            dayIndex,
            readOnly: true,
          })}
          onOpenMessages={() => navigation.navigate('Messages')}
        />
      ) : null}
    </ScreenShell>
  )
}

function StudentDetailBody({
  student,
  planData,
  feedbacks,
  eligibleActions,
  oneRmDrafts,
  savingOneRm,
  onOneRmChange,
  onSaveOneRm,
  onAssignPlan,
  onOpenDay,
  onOpenMessages,
}: {
  student: any
  planData: any
  feedbacks: any[]
  eligibleActions: any[]
  oneRmDrafts: Record<string, string>
  savingOneRm: boolean
  onOneRmChange: (actionId: string, value: string) => void
  onSaveOneRm: () => void
  onAssignPlan: () => void
  onOpenDay: (dayIndex: number) => void
  onOpenMessages: () => void
}) {
  const profile = student?.profile || {}
  const answers = Array.isArray(student?.subscribe_data)
    ? student.subscribe_data
    : Array.isArray(student?.subscribe_data?.answers)
      ? student.subscribe_data.answers
      : []
  return (
    <>
      <Card style={styles.detailTop}>
        <InlineAvatar uri={profile.avatar_url} label={nameOf(student)} size={72} />
        <View style={styles.detailTitleBox}>
          <Text style={styles.detailName}>{nameOf(student)}</Text>
          <Text style={styles.detailSub}>{profile.phone || genderLabel(profile.gender) || '训练档案'}</Text>
          <View style={styles.chipRow}>
            <StatusChip label={tierLabel(student?.tier)} tone="brand" />
            <StatusChip label={subscriptionStatusLabel(student?.status)} tone="muted" />
          </View>
        </View>
      </Card>

      <Card style={styles.infoCard}>
        <View style={styles.cardTitleRow}>
          <View style={styles.cardTitleMain}>
            <Text style={styles.cardTitle}>当前训练计划</Text>
            <Text style={styles.cardSubtitle}>{planData?.instance ? '查看执行进度，或从模板替换计划。' : '该学员尚未配置训练计划。'}</Text>
          </View>
          <SolidButton label={planData?.instance ? '替换计划' : '分配计划'} variant="secondary" onPress={onAssignPlan} />
        </View>
        {planData?.instance ? (
          <>
            <View style={styles.planDetailBox}>
              <Text style={styles.planDetailName}>{planData.instance.name || '未命名计划'}</Text>
              <Text style={styles.planDetailMeta}>当前第 {Number(planData.recommendedDayIndex || planData.nextDayIndex || 1)} 天 · {Number(planData.completedDays?.length || 0)}/{Number(planData.totalTrainingDays || planData.instance.training_days?.length || 0)} 天完成</Text>
            </View>
            {Object.entries(planData.executionsByDayIndex || {}).slice(-8).reverse().map(([dayIndex, execution]: [string, any]) => (
              <Pressable key={dayIndex} onPress={() => onOpenDay(Number(dayIndex))} style={styles.executionRow}>
                <View style={styles.executionDay}><Text style={styles.executionDayText}>D{dayIndex}</Text></View>
                <View style={styles.executionMain}>
                  <Text style={styles.executionTitle}>第 {dayIndex} 天训练</Text>
                  <Text style={styles.executionMeta}>{execution?.status === 'completed' ? '已完成' : execution?.status === 'abandoned' ? '已跳过' : '进行中'} · {Number(execution?.completed_sets || 0)}/{Number(execution?.total_sets || 0)} 项</Text>
                </View>
                <IconFont name="icon-right-arrow" color={colors.textMuted} size={16} />
              </Pressable>
            ))}
          </>
        ) : <Text style={styles.emptyText}>分配后计划会同步到学员今日训练页。</Text>}
      </Card>

      <Card style={styles.infoCard}>
        <Text style={styles.cardTitle}>基础资料</Text>
        <InfoRow label="性别" value={genderLabel(profile.gender)} />
        <InfoRow label="年龄" value={profile.age ? `${profile.age}` : '-'} />
        <InfoRow label="身高" value={profile.height ? `${profile.height} cm` : '-'} />
        <InfoRow label="体重" value={profile.weight ? `${profile.weight} kg` : '-'} />
        <InfoRow label="目标" value={profile.fitness_goal || '-'} />
        <InfoRow label="水平" value={fitnessLevelLabel(profile.fitness_level)} />
      </Card>

      <Card style={styles.infoCard}>
        <Text style={styles.cardTitle}>订阅与训练</Text>
        <InfoRow label="订阅周期" value={`${Number(student?.subscribed_weeks || 0) || '-'} 周`} />
        <InfoRow label="历史训练" value={`${Number(student?.prior_training_weeks || 0)} 周`} />
        <InfoRow label="开始日期" value={dateText(student?.start_date)} />
        <InfoRow label="预计结束" value={dateText(student?.end_date)} />
        <InfoRow label="上传/点评" value={`${Number(student?.reviewed || 0)} / ${Number(student?.uploaded || 0)}`} />
      </Card>

      <Card style={styles.infoCard}>
        <Text style={styles.cardTitle}>问卷摘要</Text>
        {answers.length > 0 ? answers.slice(0, 8).map((item: any, index: number) => (
          <InfoRow key={`${item?.question || index}`} label={String(item?.question || `问题 ${index + 1}`)} value={String(item?.answer || item?.userSelection || item?.userSelections?.join?.('、') || '-')} />
        )) : <Text style={styles.emptyText}>暂无问卷答案</Text>}
      </Card>

      <Card style={styles.infoCard}>
        <View style={styles.cardTitleRow}>
          <View style={styles.cardTitleMain}>
            <Text style={styles.cardTitle}>训练反馈</Text>
            <Text style={styles.cardSubtitle}>最近反馈会按训练日倒序展示。</Text>
          </View>
          <SolidButton label="联系学员" variant="secondary" onPress={onOpenMessages} />
        </View>
        {feedbacks.length > 0 ? feedbacks.slice(0, 10).map((feedback: any, index: number) => (
          <Pressable key={`${feedback.instance_id || ''}-${feedback.day_index}-${feedback.created_at || index}`} onPress={() => onOpenDay(Number(feedback.day_index || 1))} style={styles.feedbackRow}>
            <View style={styles.feedbackHeader}>
              <Text style={styles.feedbackDay}>第 {Number(feedback.day_index || 0)} 天</Text>
              <Text style={styles.feedbackTime}>{String(feedback.created_at || '').replace('T', ' ').slice(0, 16)}</Text>
            </View>
            <Text style={styles.feedbackContent}>{feedback.content || '（无文字反馈）'}</Text>
            {feedback.difficulty_rating ? <Text style={styles.feedbackRating}>训练难度 {Number(feedback.difficulty_rating)}/5</Text> : null}
          </Pressable>
        )) : <Text style={styles.emptyText}>暂无学员训练反馈</Text>}
      </Card>

      <Card style={styles.infoCard}>
        <Text style={styles.cardTitle}>动作 1RM</Text>
        <Text style={styles.cardSubtitle}>用于计划自动换算训练重量。清空输入可移除手动参考值。</Text>
        {eligibleActions.length > 0 ? eligibleActions.map((action: any) => (
          <View key={String(action.id)} style={styles.oneRmRow}>
            <View style={styles.oneRmMain}>
              <Text style={styles.oneRmName}>{action.name || '未命名动作'}</Text>
              <Text style={styles.oneRmMeta}>{action.equipment || action.category || '力量动作'}</Text>
            </View>
            <TextInput
              value={oneRmDrafts[String(action.id)] || ''}
              onChangeText={(value) => onOneRmChange(String(action.id), value)}
              keyboardType="decimal-pad"
              placeholder="kg"
              placeholderTextColor={colors.textMuted}
              style={styles.oneRmInput}
            />
            <Text style={styles.oneRmUnit}>kg</Text>
          </View>
        )) : <Text style={styles.emptyText}>学员动作库暂无可维护的力量动作。</Text>}
        {eligibleActions.length > 0 ? <SolidButton label={savingOneRm ? '保存中…' : '保存 1RM'} loading={savingOneRm} onPress={onSaveOneRm} /> : null}
      </Card>
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  toolbar: {
    gap: spacing.sm,
  },
  searchRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  clearButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    color: colors.textMuted,
    fontSize: 22,
    fontWeight: '700',
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sortPill: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortPillActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  sortText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  sortTextActive: {
    color: colors.surface,
  },
  studentCard: {
    gap: spacing.sm,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  studentMeta: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  studentName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  tierChip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
  },
  tierText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '900',
  },
  studentId: {
    color: colors.textMuted,
    fontSize: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  statusChip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  brandChip: {
    backgroundColor: colors.brandSoft,
  },
  successChip: {
    backgroundColor: '#E8F6EF',
  },
  warningChip: {
    backgroundColor: '#FFF4DE',
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  brandText: {
    color: colors.brand,
  },
  successText: {
    color: colors.success,
  },
  warningText: {
    color: colors.warning,
  },
  planBox: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  planName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  planDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  progressLine: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  metricText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pageText: {
    flex: 1,
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  detailTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailTitleBox: {
    flex: 1,
    gap: spacing.xs,
  },
  detailName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  detailSub: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  infoCard: {
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  cardTitleMain: {
    flex: 1,
    gap: 4,
  },
  cardSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  planDetailBox: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
  },
  planDetailName: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: '900',
  },
  planDetailMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  executionRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  executionDay: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
  },
  executionDayText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '900',
  },
  executionMain: {
    flex: 1,
    gap: 4,
  },
  executionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  executionMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  feedbackRow: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  feedbackDay: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '900',
  },
  feedbackTime: {
    color: colors.textMuted,
    fontSize: 11,
  },
  feedbackContent: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  feedbackRating: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '800',
  },
  oneRmRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  oneRmMain: {
    flex: 1,
    gap: 4,
  },
  oneRmName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  oneRmMeta: {
    color: colors.textMuted,
    fontSize: 11,
  },
  oneRmInput: {
    width: 88,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    color: colors.text,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
    textAlign: 'right',
  },
  oneRmUnit: {
    width: 24,
    color: colors.textSecondary,
    fontSize: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  infoLabel: {
    flex: 0.42,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  infoValue: {
    flex: 0.58,
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'right',
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
})
