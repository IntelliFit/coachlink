import { useCallback, useMemo, useState } from 'react'
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import { useFocusEffect } from '@react-navigation/native'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { apiClient } from '../api'
import { Page } from '../components/Page'
import { SectionCard } from '../components/SectionCard'
import { colors, radius, spacing } from '../theme'
import { useAuth } from '../providers/AuthProvider'
import { ActionGrid, ActionTile, HeroPanel, RowCard } from './AppHomeShared'
import type { MainTabParamList, RootStackParamList } from '../navigation/types'
import {
  emptyTodayTrainingPlanBlock,
  getActiveTodayTrainingPlan,
  normalizeTodayTrainingPlanBlock,
  patchTodayTrainingCacheSelection,
  persistTodayTrainingCache,
  readTodayTrainingCache,
  type TodayTrainingCache,
  type TodayTrainingPlanBlock,
  type TodayTrainingPlanMode,
} from './training/todayTrainingCache'

type Props = BottomTabScreenProps<MainTabParamList, 'TrainingTab'>

function unwrap(response: any) {
  return response?.data?.data ?? response?.data ?? {}
}

function pickArray(data: any, keys: string[]) {
  for (const key of keys) {
    const value = data?.[key] ?? data?.data?.[key]
    if (Array.isArray(value)) return value
  }
  return []
}

function planBlockFromResponse(response: any): TodayTrainingPlanBlock {
  const data = unwrap(response)
  return normalizeTodayTrainingPlanBlock(data)
}

function dayIndexOf(day: any, fallback = 1) {
  return Number(day?.dayIndex ?? day?.day_index ?? fallback) || fallback
}

function executionStatus(block: TodayTrainingPlanBlock, dayIndex: number) {
  return String(block.executionsByDayIndex?.[dayIndex]?.status || '').toLowerCase()
}

function dayStatusLabel(block: TodayTrainingPlanBlock, day: any) {
  const dayIndex = dayIndexOf(day)
  if (day?.type === 'rest') return '休息'
  const status = executionStatus(block, dayIndex)
  if (status === 'completed') return '已完成'
  if (status === 'abandoned') return '已跳过'
  if (status === 'in_progress') return '进行中'
  if (block.missingDays.includes(dayIndex)) return '待补练'
  if (dayIndex === block.recommendedDayIndex) return '今日'
  if (dayIndex > block.recommendedDayIndex) return '未开始'
  return '待确认'
}

function isReadOnlyDay(block: TodayTrainingPlanBlock, dayIndex: number) {
  const status = executionStatus(block, dayIndex)
  if (status === 'in_progress') return false
  if (status === 'completed' || status === 'abandoned') return true
  return dayIndex > block.recommendedDayIndex
}

export function TrainingScreen({ navigation }: Props) {
  const rootNav = navigation.getParent<any>()
  const { user } = useAuth()
  const userId = user?.id ? String(user.id) : ''
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [cache, setCache] = useState<TodayTrainingCache | null>(null)

  const load = useCallback(async (manual = false) => {
    if (!userId) return
    if (manual) setRefreshing(true)
    else setLoading(true)
    setError('')

    const cached = await readTodayTrainingCache(userId).catch((readError) => {
      console.warn('[mobile-training] failed to read today cache', readError)
      return null
    })
    if (cached) {
      setCache(cached)
      setLoading(false)
    }

    try {
      const [subscriptionsResult, selfResult, actionsResult] = await Promise.allSettled([
        apiClient.request('/api/subscription/coach-subscriptions', {
          method: 'POST',
          body: { studentId: userId, onlyActive: true },
          timeoutMs: 12000,
        }),
        apiClient.request('/api/plan-lib/get-instance', {
          method: 'POST',
          body: { fetchSelf: true },
          timeoutMs: 15000,
        }),
        apiClient.request('/api/student/action-lib/list-actions', {
          method: 'POST',
          body: { page: 1, limit: 4 },
          timeoutMs: 10000,
        }),
      ])

      if (subscriptionsResult.status === 'rejected' && selfResult.status === 'rejected') {
        throw subscriptionsResult.reason || selfResult.reason
      }

      const subscriptions =
        subscriptionsResult.status === 'fulfilled'
          ? pickArray(unwrap(subscriptionsResult.value), ['subscriptions', 'items', 'data']).filter(
              (item: any) => item?.id,
            )
          : cached?.coachSubscriptions || []

      const coachResults = await Promise.allSettled(
        subscriptions.map((subscription: any) =>
          apiClient.request('/api/plan-lib/get-instance', {
            method: 'POST',
            body: { subscriptionId: subscription.id },
            timeoutMs: 15000,
          }),
        ),
      )
      const coachPlanDataBySubId: Record<string, TodayTrainingPlanBlock> = {}
      subscriptions.forEach((subscription: any, index: number) => {
        const result = coachResults[index]
        coachPlanDataBySubId[String(subscription.id)] =
          result?.status === 'fulfilled'
            ? planBlockFromResponse(result.value)
            : cached?.coachPlanDataBySubId[String(subscription.id)] ||
              emptyTodayTrainingPlanBlock()
      })

      const selfPlanData =
        selfResult.status === 'fulfilled'
          ? planBlockFromResponse(selfResult.value)
          : cached?.selfPlanData || emptyTodayTrainingPlanBlock()
      const recentActions =
        actionsResult.status === 'fulfilled'
          ? pickArray(unwrap(actionsResult.value), ['actions', 'items', 'data']).slice(0, 4)
          : cached?.recentActions || []

      const previousSubId = cached?.activeCoachSubscriptionId
      const firstWithPlan = subscriptions.find(
        (subscription: any) => coachPlanDataBySubId[String(subscription.id)]?.instance,
      )
      const activeCoachSubscriptionId =
        (previousSubId && subscriptions.some((item: any) => String(item.id) === previousSubId)
          ? previousSubId
          : null) || String(firstWithPlan?.id || subscriptions[0]?.id || '') || null
      const hasCoachPlan = Object.values(coachPlanDataBySubId).some((block) => block.instance)
      const hasSelfPlan = Boolean(selfPlanData.instance)
      const preferredMode = cached?.planMode || 'coach'
      const planMode: TodayTrainingPlanMode =
        preferredMode === 'coach' && hasCoachPlan
          ? 'coach'
          : preferredMode === 'self' && hasSelfPlan
            ? 'self'
            : hasCoachPlan
              ? 'coach'
              : hasSelfPlan
                ? 'self'
                : preferredMode

      const provisional: TodayTrainingCache = {
        v: 1,
        savedAt: Date.now(),
        userId,
        coachSubscriptions: subscriptions,
        coachPlanDataBySubId,
        activeCoachSubscriptionId,
        selfPlanData,
        recentActions,
        planMode,
        selectedDayIndex: cached?.selectedDayIndex || 1,
      }
      const activePlan = getActiveTodayTrainingPlan(provisional)
      const dayIndexes = new Set(
        (activePlan.instance?.training_days || []).map((day: any) => dayIndexOf(day)),
      )
      provisional.selectedDayIndex = dayIndexes.has(provisional.selectedDayIndex)
        ? provisional.selectedDayIndex
        : activePlan.recommendedDayIndex

      setCache(provisional)
      await persistTodayTrainingCache(provisional)
    } catch (loadError: any) {
      console.warn('[mobile-training] load failed', loadError)
      setError(cached ? '云端同步失败，当前展示本地缓存。' : '训练数据加载失败，请检查网络后重试。')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [userId])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const activePlan = useMemo(() => getActiveTodayTrainingPlan(cache), [cache])
  const instance = activePlan.instance
  const days = useMemo(
    () =>
      (Array.isArray(instance?.training_days) ? [...instance.training_days] : []).sort(
        (a: any, b: any) => dayIndexOf(a) - dayIndexOf(b),
      ),
    [instance],
  )
  const selectedDayIndex = cache?.selectedDayIndex || activePlan.recommendedDayIndex || 1
  const selectedDay = days.find((day: any) => dayIndexOf(day) === selectedDayIndex)
  const completedCount = days.filter(
    (day: any) => executionStatus(activePlan, dayIndexOf(day)) === 'completed',
  ).length
  const activeSubscription = cache?.coachSubscriptions.find(
    (item: any) => String(item.id) === String(cache.activeCoachSubscriptionId),
  )

  const stats = [
    { label: '当前计划', value: instance?.name || instance?.title || '未配置' },
    { label: '训练进度', value: days.length ? `${completedCount}/${days.length}` : '-' },
    { label: '当前训练日', value: instance ? `第 ${activePlan.recommendedDayIndex} 天` : '-' },
  ]

  const go = (name: keyof RootStackParamList, params?: any) => rootNav?.navigate(name, params)

  const selectMode = async (planMode: TodayTrainingPlanMode) => {
    if (!cache) return
    const target =
      planMode === 'self'
        ? cache.selfPlanData
        : cache.activeCoachSubscriptionId
          ? cache.coachPlanDataBySubId[cache.activeCoachSubscriptionId]
          : null
    const nextDayIndex = target?.recommendedDayIndex || 1
    const next = { ...cache, planMode, selectedDayIndex: nextDayIndex }
    setCache(next)
    await patchTodayTrainingCacheSelection(userId, { planMode, selectedDayIndex: nextDayIndex })
  }

  const selectCoach = async (subscriptionId: string) => {
    if (!cache) return
    const target = cache.coachPlanDataBySubId[subscriptionId]
    const next = {
      ...cache,
      planMode: 'coach' as const,
      activeCoachSubscriptionId: subscriptionId,
      selectedDayIndex: target?.recommendedDayIndex || 1,
    }
    setCache(next)
    await patchTodayTrainingCacheSelection(userId, {
      planMode: 'coach',
      activeCoachSubscriptionId: subscriptionId,
      selectedDayIndex: next.selectedDayIndex,
    })
  }

  const selectDay = async (dayIndex: number) => {
    if (!cache) return
    setCache({ ...cache, selectedDayIndex: dayIndex })
    await patchTodayTrainingCacheSelection(userId, {
      planMode: cache.planMode,
      selectedDayIndex: dayIndex,
    })
  }

  const openTrainingDay = (dayIndex = selectedDayIndex) => {
    if (!instance?.id) return
    go('TrainingExecution', {
      instanceId: String(instance.id),
      dayIndex,
      readOnly: isReadOnlyDay(activePlan, dayIndex),
    })
  }

  const skipDay = (dayIndex: number) => {
    if (!instance?.id) return
    Alert.alert(
      '确认跳过',
      `确认跳过第 ${dayIndex} 天吗？跳过后会推进计划进度，并对教练可见。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认跳过',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.request('/api/execution/skip-day', {
                method: 'POST',
                body: { instanceId: instance.id, dayIndex },
                timeoutMs: 12000,
              })
              await load(true)
            } catch (skipError: any) {
              Alert.alert('跳过失败', skipError?.message || '请稍后重试')
            }
          },
        },
      ],
    )
  }

  const selectedStatus = selectedDay ? dayStatusLabel(activePlan, selectedDay) : ''
  const selectedExecutionStatus = executionStatus(activePlan, selectedDayIndex)
  const primaryLabel =
    selectedExecutionStatus === 'in_progress'
      ? '继续训练'
      : isReadOnlyDay(activePlan, selectedDayIndex)
        ? '查看训练详情'
        : activePlan.missingDays.includes(selectedDayIndex)
          ? '开始补练'
          : '开始今日训练'

  return (
    <Page>
      <HeroPanel title="训练" subtitle="多教练计划、自主计划、补练与即兴训练都集中在这里。" kicker="CoachLink" icon="icon-dumbbell" />

      <View style={styles.stats}>
        {stats.map((item) => (
          <View key={item.label} style={styles.stat}>
            <Text style={styles.statValue} numberOfLines={1}>{String(item.value)}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {error ? (
        <View style={styles.noticeError}>
          <Text style={styles.noticeErrorText}>{error}</Text>
          <Pressable onPress={() => void load(true)} style={styles.noticeButton}>
            <Text style={styles.noticeButtonText}>重试同步</Text>
          </Pressable>
        </View>
      ) : null}

      <SectionCard title="计划来源" description="保留你上次选择的计划；返回本页时自动同步云端最新进度。">
        <View style={styles.segment}>
          {Object.values(cache?.coachPlanDataBySubId || {}).some((block) => block.instance) ? (
            <Pressable
              onPress={() => void selectMode('coach')}
              style={[styles.segmentItem, cache?.planMode === 'coach' && styles.segmentItemActive]}
            >
              <Text style={[styles.segmentText, cache?.planMode === 'coach' && styles.segmentTextActive]}>教练计划</Text>
            </Pressable>
          ) : null}
          {cache?.selfPlanData.instance ? (
            <Pressable
              onPress={() => void selectMode('self')}
              style={[styles.segmentItem, cache?.planMode === 'self' && styles.segmentItemActive]}
            >
              <Text style={[styles.segmentText, cache?.planMode === 'self' && styles.segmentTextActive]}>自主计划</Text>
            </Pressable>
          ) : null}
        </View>

        {cache?.planMode === 'coach' && (cache.coachSubscriptions.length > 1 || activeSubscription) ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.coachList}>
            {cache.coachSubscriptions.map((subscription: any) => {
              const subscriptionId = String(subscription.id)
              const coach = subscription.coach || {}
              const selected = subscriptionId === cache.activeCoachSubscriptionId
              const hasPlan = Boolean(cache.coachPlanDataBySubId[subscriptionId]?.instance)
              return (
                <Pressable
                  key={subscriptionId}
                  onPress={() => void selectCoach(subscriptionId)}
                  style={[styles.coachChip, selected && styles.coachChipActive]}
                >
                  <Text style={[styles.coachChipTitle, selected && styles.coachChipTitleActive]}>{coach.name || '我的教练'}</Text>
                  <Text style={[styles.coachChipMeta, selected && styles.coachChipMetaActive]}>{hasPlan ? '已有计划' : '计划待制定'}</Text>
                </Pressable>
              )
            })}
          </ScrollView>
        ) : null}
      </SectionCard>

      <SectionCard
        title={instance?.name || instance?.title || '今日训练'}
        description={
          instance
            ? `${cache?.planMode === 'coach' ? activeSubscription?.coach?.name || '教练计划' : '自主计划'} · ${instance.status === 'paused' ? '已暂停' : '进行中'}`
            : '当前没有进行中的训练计划，你仍然可以开始即兴锻炼。'
        }
      >
        {loading ? <ActivityIndicator color={colors.brand} /> : null}

        {activePlan.missingDays.length > 0 ? (
          <View style={styles.missingCard}>
            <Text style={styles.missingTitle}>有 {activePlan.missingDays.length} 个训练日待确认</Text>
            <Text style={styles.missingDescription}>可以补练，也可以明确跳过；跳过记录会同步给教练。</Text>
            {activePlan.missingDays.slice(0, 3).map((dayIndex) => (
              <View key={dayIndex} style={styles.missingRow}>
                <Text style={styles.missingDay}>第 {dayIndex} 天</Text>
                <Pressable onPress={() => openTrainingDay(dayIndex)} style={styles.primarySmallButton}>
                  <Text style={styles.primarySmallText}>去补练</Text>
                </Pressable>
                <Pressable onPress={() => skipDay(dayIndex)} style={styles.secondarySmallButton}>
                  <Text style={styles.secondarySmallText}>跳过</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {days.length > 0 ? (
          <>
            <Text style={styles.blockLabel}>训练日程</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayList}>
              {days.map((day: any) => {
                const dayIndex = dayIndexOf(day)
                const selected = dayIndex === selectedDayIndex
                const status = dayStatusLabel(activePlan, day)
                return (
                  <Pressable
                    key={dayIndex}
                    onPress={() => void selectDay(dayIndex)}
                    style={[styles.dayCard, selected && styles.dayCardActive]}
                  >
                    <Text style={[styles.dayNumber, selected && styles.dayNumberActive]}>第 {dayIndex} 天</Text>
                    <Text style={[styles.dayStatus, selected && styles.dayStatusActive]}>{status}</Text>
                  </Pressable>
                )
              })}
            </ScrollView>

            <View style={styles.selectedDayCard}>
              <View style={styles.selectedDayHeader}>
                <View>
                  <Text style={styles.selectedDayTitle}>第 {selectedDayIndex} 天安排</Text>
                  <Text style={styles.selectedDayMeta}>{selectedDay?.type === 'rest' ? '恢复日与轻任务' : '力量训练'} · {selectedStatus}</Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{selectedStatus}</Text>
                </View>
              </View>
              {selectedDay?.type === 'rest' ? (
                <Text style={styles.selectedDayDescription}>今天以恢复为主。若计划包含打卡、拉伸或饮食任务，可进入详情完成。</Text>
              ) : (
                <Text style={styles.selectedDayDescription}>
                  {Array.isArray(selectedDay?.actionSets) ? selectedDay.actionSets.length : 0} 个训练模块。历史和未来训练日只读查看，不会误创建 execution。
                </Text>
              )}
              <Pressable onPress={() => openTrainingDay()} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{selectedDay?.type === 'rest' ? '查看恢复安排' : primaryLabel}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.emptyPlan}>
            <Text style={styles.emptyPlanTitle}>还没有可执行的计划</Text>
            <Text style={styles.empty}>可以先去全部计划查看历史，或直接从动作库开始即兴训练。</Text>
          </View>
        )}

        <Pressable onPress={() => void load(true)} disabled={refreshing} style={styles.syncButton}>
          {refreshing ? <ActivityIndicator size="small" color={colors.brand} /> : <Text style={styles.syncText}>同步最新计划</Text>}
        </Pressable>
        <RowCard title="即兴锻炼" subtitle="没有计划也能从力量动作库快速开始，未完成训练可继续。" icon="icon-strength" onPress={() => go('ImpromptuTraining')} />
      </SectionCard>

      <ActionGrid>
        <ActionTile title="动作库" subtitle="个人动作与公共动作" icon="icon-dumbbell" onPress={() => go('ActionLibrary')} />
        <ActionTile title="全部计划" subtitle="当前与历史计划" icon="icon-a-Trainingplan" onPress={() => go('PlanHistory')} />
        <ActionTile title="训练历史" subtitle="日历、记录、分享" icon="icon-training_history" onPress={() => go('TrainingHistory')} />
        <ActionTile title="力量曲线" subtitle="e1RM 趋势" icon="icon-ranking" onPress={() => go('E1RMChart')} />
      </ActionGrid>

      <SectionCard title="最近动作" description="从个人动作库读取，断网时仍保留最近一次成功同步结果。">
        {(cache?.recentActions || []).length === 0 ? (
          <Text style={styles.empty}>暂无动作，先去动作库添加或从公共库复制。</Text>
        ) : (
          cache?.recentActions.map((action: any) => (
            <RowCard key={String(action.id || action.name)} title={action.name || action.action_name || '未命名动作'} subtitle={action.category || action.muscle_group || action.equipment || '个人动作'} icon="icon-dumbbell" onPress={() => go('ActionDetail', { id: action.id, action, source: 'mine' })} />
          ))
        )}
      </SectionCard>
    </Page>
  )
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    minHeight: 80,
    justifyContent: 'center',
    borderRadius: radius.lg,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '900' },
  statLabel: { marginTop: 4, color: colors.textSecondary, fontSize: 12 },
  noticeError: {
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: '#FFF1EE',
    borderWidth: 1,
    borderColor: '#F2C7BC',
    gap: spacing.xs,
  },
  noticeErrorText: { color: '#9A3F2B', fontSize: 13, lineHeight: 20 },
  noticeButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  noticeButtonText: { color: colors.brand, fontSize: 13, fontWeight: '800' },
  segment: { flexDirection: 'row', gap: spacing.xs, padding: 4, borderRadius: radius.lg, backgroundColor: colors.background },
  segmentItem: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  segmentItemActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  segmentText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  segmentTextActive: { color: colors.brand },
  coachList: { gap: spacing.xs, paddingVertical: spacing.xs },
  coachChip: { minWidth: 128, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  coachChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  coachChipTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  coachChipTitleActive: { color: '#FFFFFF' },
  coachChipMeta: { marginTop: 4, color: colors.textSecondary, fontSize: 11 },
  coachChipMetaActive: { color: 'rgba(255,255,255,0.82)' },
  missingCard: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' },
  missingTitle: { color: '#9A3412', fontSize: 15, fontWeight: '900' },
  missingDescription: { color: '#9A3412', fontSize: 12, lineHeight: 18 },
  missingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 40 },
  missingDay: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  primarySmallButton: { minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.brand },
  primarySmallText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  secondarySmallButton: { minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border },
  secondarySmallText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  blockLabel: { color: colors.text, fontSize: 15, fontWeight: '900' },
  dayList: { gap: spacing.xs, paddingVertical: spacing.xs },
  dayCard: { minWidth: 88, minHeight: 64, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  dayCardActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  dayNumber: { color: colors.text, fontSize: 13, fontWeight: '800' },
  dayNumberActive: { color: '#FFFFFF' },
  dayStatus: { marginTop: 4, color: colors.textSecondary, fontSize: 11 },
  dayStatusActive: { color: 'rgba(255,255,255,0.82)' },
  selectedDayCard: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  selectedDayHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  selectedDayTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  selectedDayMeta: { marginTop: 4, color: colors.textSecondary, fontSize: 12 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.brandSoft },
  statusBadgeText: { color: colors.brand, fontSize: 11, fontWeight: '800' },
  selectedDayDescription: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  syncButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  syncText: { color: colors.brand, fontSize: 13, fontWeight: '800' },
  emptyPlan: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.background },
  emptyPlanTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  empty: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
})
