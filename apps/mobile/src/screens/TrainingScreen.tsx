import { useCallback, useMemo, useRef, useState } from 'react'
import { trainingEntry } from '@coachlink/core/src/trainingAccess'
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import { useFocusEffect } from '@react-navigation/native'
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { HomeAnnouncements } from '../components/announcements/HomeAnnouncements'
import { RecordCompletionSheet } from './training/RecordCompletionSheet'
import { LightTaskSheet } from './training/LightTaskSheet'
import { LIGHT_TASK_LABELS, removeActionAt, studentExtraTasks } from './training/lightTaskModel'
import { executionSnapshotKey, syncTrainingExecutionToCache } from './training/trainingCache'
import { plansReadyToComplete } from './training/planCompletion'
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
  return response?.data?.data ?? response?.data ?? response ?? {}
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

function entryForDay(block: TodayTrainingPlanBlock, dayIndex: number) {
  return trainingEntry({ trainingDays: block.instance?.training_days || [], progressDayIndex: block.recommendedDayIndex,
    targetDayIndex: dayIndex, executionsByDayIndex: block.executionsByDayIndex, execution: block.executionsByDayIndex?.[dayIndex] })
}

export function TrainingScreen({ navigation }: Props) {
  const rootNav = navigation.getParent<any>()
  const { user, isAuthenticated, isGuest } = useAuth()
  const userId = user?.id ? String(user.id) : ''
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [cache, setCache] = useState<TodayTrainingCache | null>(null)
  const [recordCompletionOpen, setRecordCompletionOpen] = useState(false)
  const [lightTaskOpen, setLightTaskOpen] = useState(false)
  /** 删除进行中时不接受第二次删除：服务端按下标删除，并发会删错。 */
  const lightTaskDeletingRef = useRef(false)
  const [completedPlanName, setCompletedPlanName] = useState('')
  /** 本次启动已尝试收尾的计划，避免每次回到首页都重复调用。 */
  const completionAttemptedRef = useRef(new Set<string>())

  const completeFinishedPlans = useCallback(async (snapshot: TodayTrainingCache) => {
    for (const instance of plansReadyToComplete(snapshot)) {
      const instanceId = String(instance.id)
      if (completionAttemptedRef.current.has(instanceId)) continue
      completionAttemptedRef.current.add(instanceId)
      try {
        await apiClient.request('/api/plan-lib/complete-instance', {
          method: 'POST',
          body: { instanceId },
          timeoutMs: 12000,
        })
        setCompletedPlanName(String(instance.name || instance.title || '训练计划'))
      } catch (completeError) {
        // 下次启动再试；不影响首页展示。
        console.warn('[mobile-training] complete plan failed', completeError)
      }
    }
  }, [])

  const load = useCallback(async (manual = false) => {
    if (!userId) {
      setLoading(false)
      setRefreshing(false)
      return
    }
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
      // 只按本次云端成功返回的计划判断收尾；请求失败时用的是本地缓存，可能已过期。
      const freshCoachBlocks = Object.fromEntries(
        subscriptions.flatMap((subscription: any, index: number) => (
          coachResults[index]?.status === 'fulfilled'
            ? [[String(subscription.id), coachPlanDataBySubId[String(subscription.id)]]]
            : []
        )),
      )
      void completeFinishedPlans({
        ...provisional,
        coachPlanDataBySubId: freshCoachBlocks,
        selfPlanData: selfResult.status === 'fulfilled' ? selfPlanData : emptyTodayTrainingPlanBlock(),
      })
    } catch (loadError: any) {
      console.warn('[mobile-training] load failed', loadError)
      setError(cached ? '云端同步失败，当前展示本地缓存。' : '训练数据加载失败，请检查网络后重试。')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [completeFinishedPlans, userId])

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

  const ensureLogin = () => {
    if (isAuthenticated && !isGuest) return true
    Alert.alert('请先登录', '登录后可以同步计划、开始训练并保存训练记录。', [
      { text: '取消', style: 'cancel' },
      { text: '去登录', onPress: () => rootNav?.navigate('Login') },
    ])
    return false
  }

  const go = (name: keyof RootStackParamList, params?: any) => {
    if (ensureLogin()) rootNav?.navigate(name, params)
  }

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
      intent: entryForDay(activePlan, dayIndex).intent,
    })
  }

  /** 补记成功后先把返回的 execution 写进本地缓存，弱网下重新同步失败也不会显示旧状态。 */
  const applySavedCompletion = async (saved: any) => {
    const instanceId = instance?.id ? String(instance.id) : ''
    if (instanceId && saved && typeof saved === 'object') {
      const dayIndex = Number(saved.day_index ?? saved.dayIndex ?? selectedDayIndex) || selectedDayIndex
      await syncTrainingExecutionToCache({
        userId,
        key: executionSnapshotKey({ mode: 'plan', instanceId, dayIndex }),
        isImpromptu: false,
        instanceId,
        dayIndex,
        execution: { ...saved, day_index: dayIndex },
      }).catch((cacheError) => console.warn('[mobile-training] failed to cache recorded completion', cacheError))
      const refreshed = await readTodayTrainingCache(userId).catch(() => null)
      if (refreshed) setCache(refreshed)
    }
    await load(true)
  }

  const writeDayExecution = async (instanceId: string, dayIndex: number, execution: any) => {
    await syncTrainingExecutionToCache({
      userId,
      key: executionSnapshotKey({ mode: 'plan', instanceId, dayIndex }),
      isImpromptu: false,
      instanceId,
      dayIndex,
      execution,
    }).catch((cacheError) => console.warn('[mobile-training] failed to cache light task change', cacheError))
    const refreshed = await readTodayTrainingCache(userId).catch(() => null)
    if (refreshed) setCache(refreshed)
  }

  const deleteLightTask = (execution: any, executionIndex: number, title: string) => {
    if (lightTaskDeletingRef.current) {
      Alert.alert('正在删除', '上一项还在删除中，请稍候。')
      return
    }
    const instanceId = instance?.id ? String(instance.id) : ''
    const dayIndex = selectedDayIndex
    Alert.alert('删除轻任务', `确认删除轻任务「${title}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          const optimistic = removeActionAt(execution, executionIndex)
          if (!optimistic || !instanceId || lightTaskDeletingRef.current) return
          lightTaskDeletingRef.current = true
          // 与小程序一致：先更新本地页面和缓存，服务端失败时完整回滚。
          await writeDayExecution(instanceId, dayIndex, optimistic)
          try {
            await apiClient.request('/api/execution/extra-content/delete-extra-exercise', {
              method: 'POST',
              body: { executionId: execution.id, actionIndex: executionIndex },
              timeoutMs: 12000,
            })
          } catch (deleteError: any) {
            await writeDayExecution(instanceId, dayIndex, execution)
            Alert.alert('删除失败', deleteError?.message || '请稍后重试')
          } finally {
            lightTaskDeletingRef.current = false
          }
          await load(true)
        },
      },
    ])
  }

  const contactCoach = async () => {
    const coachUserId = String(activeSubscription?.coach?.user_id || '')
    if (!ensureLogin() || !coachUserId || coachUserId === userId) return
    try {
      const data = await apiClient.request<{ chatroom?: { id?: string } | null }>('/api/chat/get-chatroom', {
        method: 'POST',
        body: { members: [userId, coachUserId] },
        timeoutMs: 12000,
      })
      if (!data?.chatroom?.id) throw new Error('会话创建失败')
      rootNav?.navigate('Chat', { roomId: data.chatroom.id, peerName: activeSubscription?.coach?.name || undefined })
    } catch (chatError: any) {
      Alert.alert('打开会话失败', chatError?.message || '请稍后重试')
    }
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
  // 服务端只允许给「当前可练的训练日」或进行中的执行加任务（未来天 409、空休息日 400）。
  const canAddLightTask = executionStatus(activePlan, selectedDayIndex) === 'in_progress'
    || (selectedDay?.type !== 'rest' && entryForDay(activePlan, selectedDayIndex).intent === 'execute')
  const selectedExecutionStatus = executionStatus(activePlan, selectedDayIndex)
  const primaryLabel = entryForDay(activePlan, selectedDayIndex).label

  return (
    <Page>
      <HeroPanel title="训练" subtitle="多教练计划、自主计划、补练与即兴训练都集中在这里。" kicker="CoachLink" icon="icon-dumbbell" />
      <HomeAnnouncements enabled={isAuthenticated} />

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
          <Pressable accessibilityRole="button" accessibilityLabel="重试同步训练计划" onPress={() => void load(true)} style={styles.noticeButton}>
            <Text style={styles.noticeButtonText}>重试同步</Text>
          </Pressable>
        </View>
      ) : null}

      <SectionCard title="计划来源" description="保留你上次选择的计划；返回本页时自动同步云端最新进度。">
        <View style={styles.segment}>
          {Object.values(cache?.coachPlanDataBySubId || {}).some((block) => block.instance) ? (
            <Pressable
              accessibilityRole="tab"
              accessibilityLabel="教练计划"
              accessibilityState={{ selected: cache?.planMode === 'coach' }}
              onPress={() => void selectMode('coach')}
              style={[styles.segmentItem, cache?.planMode === 'coach' && styles.segmentItemActive]}
            >
              <Text style={[styles.segmentText, cache?.planMode === 'coach' && styles.segmentTextActive]}>教练计划</Text>
            </Pressable>
          ) : null}
          {cache?.selfPlanData.instance ? (
            <Pressable
              accessibilityRole="tab"
              accessibilityLabel="自主计划"
              accessibilityState={{ selected: cache?.planMode === 'self' }}
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
                  accessibilityRole="button"
                  accessibilityLabel={`${coach.name || '我的教练'}，${hasPlan ? '已有计划' : '计划待制定'}`}
                  accessibilityState={{ selected }}
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

        {cache?.planMode === 'coach' && activeSubscription?.coach?.user_id && String(activeSubscription.coach.user_id) !== userId ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`联系${activeSubscription.coach.name || '教练'}`} onPress={() => void contactCoach()} style={styles.syncButton}>
            <Text style={styles.syncText}>联系{activeSubscription.coach.name || '教练'}</Text>
          </Pressable>
        ) : null}

        {activePlan.missingDays.length > 0 ? (
          <View style={styles.missingCard}>
            <Text style={styles.missingTitle}>有 {activePlan.missingDays.length} 个训练日待确认</Text>
            <Text style={styles.missingDescription}>可以补练，也可以明确跳过；跳过记录会同步给教练。</Text>
            {activePlan.missingDays.slice(0, 3).map((dayIndex) => (
              <View key={dayIndex} style={styles.missingRow}>
                <Text style={styles.missingDay}>第 {dayIndex} 天</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`补练第 ${dayIndex} 天`} onPress={() => openTrainingDay(dayIndex)} style={styles.primarySmallButton}>
                  <Text style={styles.primarySmallText}>去补练</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`跳过第 ${dayIndex} 天`} onPress={() => skipDay(dayIndex)} style={styles.secondarySmallButton}>
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
                    accessibilityRole="tab"
                    accessibilityLabel={`第 ${dayIndex} 天，${status}`}
                    accessibilityState={{ selected }}
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
              <Pressable accessibilityRole="button" accessibilityLabel={selectedDay?.type === 'rest' ? '查看恢复安排' : primaryLabel} onPress={() => openTrainingDay()} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{selectedDay?.type === 'rest' ? '查看恢复安排' : primaryLabel}</Text>
              </Pressable>
              {(() => {
                const selectedExecution = activePlan.executionsByDayIndex?.[selectedDayIndex]
                const executionInProgress = String(selectedExecution?.status || '').toLowerCase() === 'in_progress'
                const extras = studentExtraTasks(selectedExecution)
                if (extras.length === 0) return null
                return (
                  <View style={styles.lightTasks}>
                    <Text style={styles.blockLabel}>我加的轻任务</Text>
                    {extras.map((task) => (
                      <View key={`${task.executionIndex}-${task.title}`} style={styles.lightTaskRow}>
                        <Text style={styles.lightTaskTag}>{task.type ? LIGHT_TASK_LABELS[task.type] : '任务'}</Text>
                        <Text style={styles.lightTaskTitle} numberOfLines={1}>{task.title}{task.completed ? ' · 已完成' : ''}</Text>
                        {!task.completed && executionInProgress && selectedExecution?.id ? (
                          <Pressable accessibilityRole="button" accessibilityLabel={`删除${task.title}`} onPress={() => deleteLightTask(selectedExecution, task.executionIndex, task.title)} style={styles.lightTaskDelete}>
                            <Text style={styles.lightTaskDeleteText}>删除</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )
              })()}
              {instance?.id && selectedDay && canAddLightTask ? (
                <Pressable accessibilityRole="button" accessibilityLabel="添加轻任务" onPress={() => ensureLogin() && setLightTaskOpen(true)} style={styles.syncButton}>
                  <Text style={styles.syncText}>+ 添加轻任务（饮食 / 有氧 / 习惯）</Text>
                </Pressable>
              ) : null}
              {instance?.id && selectedDay && selectedDay.type !== 'rest' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={selectedExecutionStatus === 'completed' ? '核对训练日期' : '补记训练'}
                  onPress={() => ensureLogin() && setRecordCompletionOpen(true)}
                  style={styles.syncButton}
                >
                  <Text style={styles.syncText}>{selectedExecutionStatus === 'completed' ? '核对训练日期' : '补记已练过的这一天'}</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <View style={styles.emptyPlan}>
            <Text style={styles.emptyPlanTitle}>还没有可执行的计划</Text>
            <Text style={styles.empty}>{userId ? '可以先去全部计划查看历史，或直接从动作库开始即兴训练。' : '登录后即可同步计划、开始训练并保存记录。'}</Text>
          </View>
        )}

        <Pressable accessibilityRole="button" accessibilityLabel={userId ? '同步最新计划' : '登录后同步计划'} accessibilityState={{ disabled: refreshing, busy: refreshing }} onPress={() => userId ? void load(true) : ensureLogin()} disabled={refreshing} style={styles.syncButton}>
          {refreshing ? <ActivityIndicator size="small" color={colors.brand} /> : <Text style={styles.syncText}>{userId ? '同步最新计划' : '登录后同步计划'}</Text>}
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
      {instance?.id ? (
        <RecordCompletionSheet
          visible={recordCompletionOpen}
          instanceId={String(instance.id)}
          dayIndex={selectedDayIndex}
          execution={activePlan.executionsByDayIndex?.[selectedDayIndex]}
          earliestDate={instance.start_date || instance.created_at}
          onClose={() => setRecordCompletionOpen(false)}
          onSaved={applySavedCompletion}
        />
      ) : null}
      {instance?.id ? (
        <LightTaskSheet
          visible={lightTaskOpen}
          instanceId={String(instance.id)}
          dayIndex={selectedDayIndex}
          // 只有进行中的执行记录能加任务；已完成 / 已跳过 / 超时的由服务端新建一次执行（或拒绝）
          executionId={String(activePlan.executionsByDayIndex?.[selectedDayIndex]?.status || '').toLowerCase() === 'in_progress' ? activePlan.executionsByDayIndex?.[selectedDayIndex]?.id || null : null}
          onClose={() => setLightTaskOpen(false)}
          onAdded={() => load(true)}
        />
      ) : null}
      <Modal visible={Boolean(completedPlanName)} transparent animationType="fade" onRequestClose={() => setCompletedPlanName('')}>
        <View style={styles.completionMask}>
          <View style={styles.completionCard} accessibilityViewIsModal>
            <Text style={styles.completionTitle}>计划完成</Text>
            <Text style={styles.completionDesc}>恭喜完成「{completedPlanName}」的全部训练日。更新一下身体数据，下一阶段计划会更贴合你。</Text>
            <Pressable accessibilityRole="button" onPress={() => { setCompletedPlanName(''); go('FitnessCard') }} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>更新健身资料卡</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setCompletedPlanName(''); go('PlanHistory') }} style={styles.syncButton}>
              <Text style={styles.syncText}>查看全部计划</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setCompletedPlanName('')} style={styles.syncButton}>
              <Text style={styles.syncText}>知道了</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  statValue: { color: colors.text, fontSize: 16, fontWeight: '700' },
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
  noticeButton: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm },
  noticeButtonText: { color: colors.brand, fontSize: 13, fontWeight: '600' },
  segment: { flexDirection: 'row', gap: spacing.xs, padding: 4, borderRadius: radius.lg, backgroundColor: colors.background },
  segmentItem: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  segmentItemActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  segmentText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  segmentTextActive: { color: colors.brand },
  coachList: { gap: spacing.xs, paddingVertical: spacing.xs },
  coachChip: { minWidth: 128, minHeight: 56, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  coachChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  coachChipTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  coachChipTitleActive: { color: '#FFFFFF' },
  coachChipMeta: { marginTop: 4, color: colors.textSecondary, fontSize: 11 },
  coachChipMetaActive: { color: 'rgba(255,255,255,0.82)' },
  missingCard: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' },
  missingTitle: { color: '#9A3412', fontSize: 15, fontWeight: '700' },
  missingDescription: { color: '#9A3412', fontSize: 12, lineHeight: 18 },
  missingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 48 },
  missingDay: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  primarySmallButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.brand },
  primarySmallText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  secondarySmallButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border },
  secondarySmallText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  blockLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  dayList: { gap: spacing.xs, paddingVertical: spacing.xs },
  dayCard: { minWidth: 88, minHeight: 64, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  dayCardActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  dayNumber: { color: colors.text, fontSize: 13, fontWeight: '600' },
  dayNumberActive: { color: '#FFFFFF' },
  dayStatus: { marginTop: 4, color: colors.textSecondary, fontSize: 11 },
  dayStatusActive: { color: 'rgba(255,255,255,0.82)' },
  selectedDayCard: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  selectedDayHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  selectedDayTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  selectedDayMeta: { marginTop: 4, color: colors.textSecondary, fontSize: 12 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.brandSoft },
  statusBadgeText: { color: colors.brand, fontSize: 11, fontWeight: '600' },
  selectedDayDescription: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  syncButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  syncText: { color: colors.brand, fontSize: 13, fontWeight: '600' },
  emptyPlan: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.background },
  emptyPlanTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  empty: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  lightTasks: { gap: spacing.xs },
  lightTaskRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  lightTaskTag: { color: colors.brandText, backgroundColor: colors.brandSoft, borderRadius: radius.tag, paddingHorizontal: 6, fontSize: 11, fontWeight: '500', overflow: 'hidden' },
  lightTaskTitle: { flex: 1, color: colors.text, fontSize: 14 },
  lightTaskDelete: { minHeight: 40, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  lightTaskDeleteText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  completionMask: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: 'rgba(36,29,26,0.56)' },
  completionCard: { width: '100%', maxWidth: 400, gap: spacing.xs, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  completionTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  completionDesc: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: spacing.xs },
})
