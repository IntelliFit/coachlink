import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Input, Textarea } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { authService } from '@/services/authService'
import { trainingService, PlanInstance } from '@/services/trainingService'
import { executionService } from '@/services/executionService'
import { studentActionLibService } from '@/services/studentActionLibService'
import { studentOnboardingService } from '@/services/studentOnboardingService'
import { request } from '@/utils/request'
import { formatMonthDaySlash } from '@/utils/dateFormat'
import {
  persistTodayTrainingPageCache,
  readTodayTrainingPageCache,
  type TodayTrainingPageCacheV1
} from '@/utils/todayTrainingPageCache'
import {
  buildSharePath,
  buildPublicTrainingSharePath,
  createSharePayload,
  createTimelinePayload,
  getTodayTrainingShareTitle,
  openCoachLinkShareMenu
} from '@/utils/share'
import TodayTrainingCard from './components/TodayTrainingCard'
import RestDayCard from './components/RestDayCard'
import ScheduleCalendarPanel from './components/ScheduleCalendarPanel'
import LightweightTaskSheet from './components/LightweightTaskSheet'
import LightweightActionPicker from './components/LightweightActionPicker'
import DayCheckinShareSheet from './components/DayCheckinShareSheet'
import {
  ArrowRight,
  Calendar,
  Check,
  Location,
  Message,
  Notice,
  Power,
  Star,
  Target,
  User
} from '@nutui/icons-react-taro'
import {
  buildPlanScheduleModel,
  buildDayModuleModel,
  formatPlanDayLabel,
  resolvePlanDayDate,
  type NormalizedDayTask
} from './lib/dayModules'
import './index.scss'

type PlanMode = 'coach' | 'self'
type ExecutionStatus = 'none' | 'in_progress' | 'completed'
const RETURN_CONFIRM_STORAGE_KEY = 'today_training_last_confirmed_day'
const TODAY_TRAINING_RETURN_TO = '/training/today-training'

const isAuthErrorMessage = (message?: string | null) => {
  if (!message) return false
  const normalized = String(message).toLowerCase()
  return (
    normalized.includes('用户未登录') ||
    normalized.includes('请先登录') ||
    normalized.includes('登录已过期') ||
    normalized.includes('unauthorized') ||
    normalized.includes('invalid token') ||
    normalized.includes('token expired')
  )
}

const formatShortDate = (ts?: string | null) => {
  return formatMonthDaySlash(ts)
}

const getExecutionId = (value: any) => value?.id || value?.data?.id || null

const getRemainingDays = (endDate?: string | null) => {
  if (!endDate) return null
  const ts = new Date(endDate).getTime()
  if (!Number.isFinite(ts)) return null
  return Math.ceil((ts - Date.now()) / (24 * 60 * 60 * 1000))
}

function TodayTraining() {
  const [coachSubscriptions, setCoachSubscriptions] = useState<any[]>([])
  const [activeCoachSubscriptionId, setActiveCoachSubscriptionId] = useState<string | null>(null)
  const [coachPlanDataBySubId, setCoachPlanDataBySubId] = useState<Record<string, any>>({})

  const [selfInstance, setSelfInstance] = useState<PlanInstance | null>(null)
  const [selfActions, setSelfActions] = useState<Record<string, any>>({})
  const [selfDayIndex, setSelfDayIndex] = useState(1)
  const [selfTodayCompleted, setSelfTodayCompleted] = useState(false)
  const [selfCompletionDates, setSelfCompletionDates] = useState<Record<number, string>>({})
  const [selfExecutionsByDayIndex, setSelfExecutionsByDayIndex] = useState<Record<number, any>>({})
  const [selfMissingDays, setSelfMissingDays] = useState<number[]>([])

  const [planMode, setPlanMode] = useState<PlanMode>('coach')
  const [loading, setLoading] = useState(true)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [completedPlanInfo, setCompletedPlanInfo] = useState<{ name: string; rate: number } | null>(null)
  const [showExplainDialog, setShowExplainDialog] = useState(false)
  const [selectedDayIndex, setSelectedDayIndex] = useState(1)
  const [returnConfirmedDayIndex, setReturnConfirmedDayIndex] = useState<number | null>(null)
  const [activeLightweightTask, setActiveLightweightTask] = useState<NormalizedDayTask | null>(null)
  const [lightweightSheetVisible, setLightweightSheetVisible] = useState(false)
  const [lightweightPickerVisible, setLightweightPickerVisible] = useState(false)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [actionPickerList, setActionPickerList] = useState<any[]>([])
  const [addingLightweightTask, setAddingLightweightTask] = useState(false)
  const [lightweightSheetSaving, setLightweightSheetSaving] = useState(false)
  const [pendingLightweightAction, setPendingLightweightAction] = useState<any | null>(null)
  const [lightweightConfigVisible, setLightweightConfigVisible] = useState(false)
  const [dayShareVisible, setDayShareVisible] = useState(false)
  const [daySharePath, setDaySharePath] = useState('')
  const [dayShareLoading, setDayShareLoading] = useState(false)
  const [dayShareShareable, setDayShareShareable] = useState(false)
  const [newTaskSuggestedTime, setNewTaskSuggestedTime] = useState('')
  const [newTaskNotes, setNewTaskNotes] = useState('')
  const [newDietContent, setNewDietContent] = useState('')
  const [newCardioDistanceKm, setNewCardioDistanceKm] = useState('')
  const [newCardioDurationMin, setNewCardioDurationMin] = useState('')
  const [newCardioPace, setNewCardioPace] = useState('')
  const [newHabitName, setNewHabitName] = useState('')
  const [newHabitTargetDurationMin, setNewHabitTargetDurationMin] = useState('')

  const applyCachedPageData = useCallback((cache: TodayTrainingPageCacheV1) => {
    setCoachSubscriptions(cache.coachSubscriptions || [])
    setActiveCoachSubscriptionId(cache.activeCoachSubscriptionId || null)
    setCoachPlanDataBySubId(cache.coachPlanDataBySubId || {})
    setSelfInstance(cache.selfInstance || null)
    setSelfActions(cache.selfActions || {})
    setSelfDayIndex(cache.selfDayIndex || 1)
    setSelfTodayCompleted(!!cache.selfTodayCompleted)
    setSelfCompletionDates(cache.selfCompletionDates || {})
    setSelfExecutionsByDayIndex(cache.selfExecutionsByDayIndex || {})
    setSelfMissingDays(Array.isArray(cache.selfMissingDays) ? cache.selfMissingDays : [])
    setPlanMode(cache.planMode || 'coach')
    setSelectedDayIndex(cache.selectedDayIndex || 1)
  }, [])

  const activeSubscription =
    coachSubscriptions.find((item) => item.id === activeCoachSubscriptionId) ||
    coachSubscriptions[0] ||
    null

  const subscriptionLifecycle = String(activeSubscription?.lifecycle_status || 'active')
  const activeSubscriptionRemainingDays = getRemainingDays(activeSubscription?.end_date)
  const hasPositiveRemainingDays =
    activeSubscriptionRemainingDays === null || activeSubscriptionRemainingDays > 0
  const isExpiredGrace = subscriptionLifecycle === 'expired_grace' && !hasPositiveRemainingDays
  const renewCoachId = activeSubscription?.coach_id || activeSubscription?.coach?.id
  const renewPath = renewCoachId
    ? `/discovery/coach-profile?id=${encodeURIComponent(renewCoachId)}&renew=true`
    : '/discovery/index'

  const activeCoachPlan = activeCoachSubscriptionId ? coachPlanDataBySubId[activeCoachSubscriptionId] : null
  const coachInstance = activeCoachPlan?.instance ?? null
  const coachActions = activeCoachPlan?.actions ?? {}
  const coachDayIndex = activeCoachPlan?.dayIndex ?? 1
  const coachTodayCompleted = activeCoachPlan?.todayCompleted ?? false
  const coachCompletionDates = activeCoachPlan?.completionDates ?? {}
  const coachExecutionsByDayIndex = activeCoachPlan?.executionsByDayIndex ?? {}
  const coachMissingDays = activeCoachPlan?.missingDays ?? []
  const activeCoachHasPlan = !!coachInstance
  const shouldShowRenewBlock = isExpiredGrace && planMode === 'coach' && !activeCoachHasPlan

  const instance = planMode === 'coach' ? coachInstance : selfInstance
  const actions = planMode === 'coach' ? coachActions : selfActions
  const todayDayIndex = planMode === 'coach' ? coachDayIndex : selfDayIndex
  const todayCompleted = planMode === 'coach' ? coachTodayCompleted : selfTodayCompleted
  const completionDates = planMode === 'coach' ? coachCompletionDates : selfCompletionDates
  const executionsByDayIndex = planMode === 'coach' ? coachExecutionsByDayIndex : selfExecutionsByDayIndex
  const missingDays = planMode === 'coach' ? coachMissingDays : selfMissingDays

  const trainingDays = (instance?.training_days || []) as any[]
  const progressDayIndex = todayDayIndex
  const progressDay = trainingDays.find((item) => item.dayIndex === progressDayIndex)

  const inProgressExec = useMemo(() => {
    const list = Object.values(executionsByDayIndex || {}) as any[]
    const matched = list.filter((item) => item?.status === 'in_progress' && Number(item?.day_index || 0) > 0)
    if (matched.length === 0) return null
    return [...matched].sort((a, b) => {
      const at = a?.started_at ? new Date(a.started_at).getTime() : 0
      const bt = b?.started_at ? new Date(b.started_at).getTime() : 0
      return bt - at
    })[0]
  }, [executionsByDayIndex])

  useEffect(() => {
    if (!instance?.id) return
    setSelectedDayIndex(progressDayIndex || 1)
  }, [instance?.id, progressDayIndex])

  const selectedDay = trainingDays.find((day) => day.dayIndex === selectedDayIndex) || progressDay || trainingDays[0]
  const selectedExec = selectedDay ? executionsByDayIndex?.[selectedDay.dayIndex] : null
  const selectedExecutionStatus: ExecutionStatus =
    selectedExec?.status === 'completed'
      ? 'completed'
      : selectedExec?.status === 'in_progress'
        ? 'in_progress'
        : 'none'

  const selectedModuleModel = useMemo(
    () =>
      buildDayModuleModel({
        day: selectedDay,
        actions,
        execution: selectedExec,
        executionStatus: selectedExecutionStatus
      }),
    [actions, selectedDay, selectedExec, selectedExecutionStatus]
  )

  const selectedTaskSummary = useMemo(
    () => ({
      totalModules: selectedModuleModel.moduleCount,
      completedModules: selectedModuleModel.completedModuleCount,
      remainingModules: selectedModuleModel.remainingModuleCount,
      strengthModuleCount: selectedModuleModel.strengthTasks.length > 0 ? 1 : 0,
      lightweightCount: selectedModuleModel.lightweightTasks.length,
      trainingCompleted: selectedModuleModel.trainingCompleted,
      trainingInProgress: selectedModuleModel.trainingInProgress,
      dayCompleted: selectedModuleModel.dayCompleted
    }),
    [selectedModuleModel]
  )

  const effectiveCalendarStartDate = instance?.start_date || activeSubscription?.start_date || null
  const scheduleModel = useMemo(
    () =>
      buildPlanScheduleModel({
        trainingDays,
        executionsByDayIndex,
        effectiveStartDate: effectiveCalendarStartDate,
        progressDayIndex,
        fallbackAnchorDayIndex: progressDayIndex || 1
      }),
    [trainingDays, executionsByDayIndex, effectiveCalendarStartDate, progressDayIndex]
  )
  const selectedSchedule = scheduleModel.scheduleByDayIndex.get(selectedDayIndex)
  const selectedDateLabel = useMemo(() => {
    if (!selectedDayIndex) return ''
    return formatPlanDayLabel(
      selectedSchedule?.displayDate || resolvePlanDayDate({
        dayIndex: selectedDayIndex,
        effectiveStartDate: effectiveCalendarStartDate,
        fallbackAnchorDayIndex: progressDayIndex || 1
      })
    )
  }, [effectiveCalendarStartDate, progressDayIndex, selectedDayIndex, selectedSchedule?.displayDate])
  const selectedDateMeta = useMemo(() => {
    if (!selectedSchedule || selectedSchedule.totalDelayDays <= 0) return null
    return {
      delayDays: selectedSchedule.totalDelayDays,
      originalDateLabel: formatPlanDayLabel(selectedSchedule.baselineDate)
    }
  }, [selectedSchedule])

  const selectedHasLightweightTasks = selectedModuleModel.lightweightTasks.length > 0
  const canShareDayCheckin = selectedDay?.type === 'training' && selectedTaskSummary.totalModules > 0

  const dayShareData = useMemo(() => {
    if (!selectedDay || selectedDay.type !== 'training' || !canShareDayCheckin) return null
    const user = authService.getAuthSession({ normalize: true }).user
    return {
      dateLabel:
        selectedDateLabel ||
        formatPlanDayLabel(
          resolvePlanDayDate({
            dayIndex: selectedDayIndex,
            effectiveStartDate: effectiveCalendarStartDate,
            fallbackAnchorDayIndex: progressDayIndex || 1
          })
        ),
      planName: instance?.name || '今日安排',
      nickname: String(user?.nickname || user?.name || user?.phone || 'CoachLink 学员'),
      completedAt: selectedExec?.completed_at || null,
      dayIndex: selectedDayIndex,
      moduleCount: selectedTaskSummary.totalModules,
      completedModuleCount: selectedTaskSummary.completedModules,
      lightweightCompletedCount: selectedModuleModel.lightweightCompletedCount,
      lightweightTotalCount: selectedModuleModel.lightweightTasks.length,
      trainingCompleted: selectedTaskSummary.trainingCompleted,
      strengthTaskCount: selectedModuleModel.strengthTasks.length,
      strengthCompletedSetCount: selectedModuleModel.strengthCompletedSetCount,
      strengthTotalSetCount: selectedModuleModel.strengthTotalSetCount
    }
  }, [
    canShareDayCheckin,
    effectiveCalendarStartDate,
    instance?.name,
    progressDayIndex,
    selectedDateLabel,
    selectedDay,
    selectedDayIndex,
    selectedExec?.completed_at,
    selectedModuleModel.lightweightCompletedCount,
    selectedModuleModel.lightweightTasks.length,
    selectedModuleModel.strengthCompletedSetCount,
    selectedModuleModel.strengthTasks.length,
    selectedModuleModel.strengthTotalSetCount,
    selectedTaskSummary.completedModules,
    selectedTaskSummary.totalModules,
    selectedTaskSummary.trainingCompleted
  ])

  const todaySharePayload = useMemo(() => {
    const title = dayShareVisible && daySharePath
      ? getTodayTrainingShareTitle(instance?.name, selectedDayIndex)
      : '打开 CoachLink 查看今日训练与打卡'

    return createSharePayload({
      title,
      path: dayShareVisible && daySharePath
        ? daySharePath
        : buildSharePath('/training/today-training')
    })
  }, [daySharePath, dayShareVisible, instance?.name, selectedDayIndex])
  const todayTimelinePayload = useMemo(
    () =>
      createSharePayload({
        title: '打开 CoachLink 查看今日训练与打卡',
        path: buildSharePath('/training/today-training')
      }),
    []
  )

  useShareAppMessage(() => todaySharePayload)
  useShareTimeline(() => createTimelinePayload(todayTimelinePayload))

  useEffect(() => {
    openCoachLinkShareMenu()
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadDaySharePath = async () => {
      const executionId = String(selectedExec?.id || '').trim()
      const canDirectShare = !!executionId && selectedExecutionStatus === 'completed'

      if (!dayShareVisible && !canDirectShare) {
        setDayShareLoading(false)
        setDaySharePath('')
        setDayShareShareable(false)
        return
      }

      if (!canDirectShare) {
        setDayShareLoading(false)
        setDaySharePath('')
        setDayShareShareable(false)
        return
      }

      setDayShareLoading(true)
      try {
        const shareInfo = await executionService.getShareInfo(executionId)
        if (cancelled) return

        const sharePath = buildPublicTrainingSharePath(shareInfo?.shareToken)
        setDaySharePath(sharePath)
        setDayShareShareable(!!sharePath)
      } catch (error) {
        if (!cancelled) {
          console.error('[today-training] load share info failed', error)
          setDaySharePath('')
          setDayShareShareable(false)
        }
      } finally {
        if (!cancelled) {
          setDayShareLoading(false)
        }
      }
    }

    void loadDaySharePath()

    return () => {
      cancelled = true
    }
  }, [dayShareVisible, selectedExec?.id, selectedExecutionStatus])

  const handleCompletePlan = useCallback(async (targetInstance: any) => {
    try {
      const res = await request({
        url: '/api/plan-lib/complete-instance',
        method: 'POST',
        data: { instanceId: targetInstance.id },
        showErrorToast: false
      })
      if (res?.success) {
        setCompletedPlanInfo({
          name: targetInstance.name || '训练计划',
          rate: 100
        })
        setShowCompletionModal(true)
      }
    } catch (error) {
      console.error('[today-training] complete plan failed', error)
    }
  }, [])

  const loadData = useCallback(async () => {
    try {
      const session = authService.getAuthSession({ normalize: true })
      if (!session.isAuthenticated || !session.userId) {
        await authService.logout()
        await Taro.redirectTo({
          url: authService.buildLoginUrl(TODAY_TRAINING_RETURN_TO)
        })
        return
      }

      const postLoginUrl = await studentOnboardingService.resolvePostLoginUrl({
        loggedInUser: session.user,
        fallbackUrl: TODAY_TRAINING_RETURN_TO
      })
      if (postLoginUrl !== TODAY_TRAINING_RETURN_TO) {
        await Taro.redirectTo({ url: postLoginUrl })
        return
      }

      const cached = readTodayTrainingPageCache(String(session.userId))
      if (cached) {
        applyCachedPageData(cached)
        setLoading(false)
      } else {
        setLoading(true)
      }

      const subsResponse = await request<{ subscriptions?: any[] }>({
        url: '/api/subscription/coach-subscriptions',
        method: 'POST',
        data: { studentId: session.userId },
        showErrorToast: false
      })

      if (!subsResponse.success) {
        if (isAuthErrorMessage(subsResponse.message)) {
          await authService.logout()
          await Taro.redirectTo({
            url: authService.buildLoginUrl(TODAY_TRAINING_RETURN_TO)
          })
          return
        }

        throw new Error(subsResponse.message || '订阅信息加载失败')
      }

      const activeSubs = (subsResponse.data?.subscriptions || []).filter((item: any) => !!item?.id)
      setCoachSubscriptions(activeSubs)

      const coachPromises = activeSubs.map((item: any) =>
        trainingService.getInstance({ subscriptionId: item.id }).catch(() => null)
      )
      const [coachResults, selfRes] = await Promise.all([
        Promise.allSettled(coachPromises),
        trainingService.getInstance({ fetchSelf: true }).catch(() => null)
      ])

      const coachPlanData: Record<string, any> = {}
      for (let index = 0; index < activeSubs.length; index += 1) {
        const sub = activeSubs[index]
        const result = coachResults[index]
        const data = {
          instance: null,
          actions: {},
          dayIndex: 1,
          todayCompleted: false,
          completionDates: {},
          executionsByDayIndex: {},
          missingDays: []
        }

        if (result?.status === 'fulfilled' && result.value?.instance) {
          const derived = result.value as any
          data.instance = derived.instance
          data.actions = derived.actions || {}
          data.dayIndex = derived.recommendedDayIndex ?? derived.nextDayIndex ?? 1
          data.todayCompleted = !!derived.todayCompleted
          data.completionDates = derived.completionDates || {}
          data.executionsByDayIndex = derived.executionsByDayIndex || {}
          data.missingDays = Array.isArray(derived.missingDays) ? derived.missingDays : []

          const completedCount = Array.isArray(derived.completedDays) ? derived.completedDays.length : 0
          const totalCount = Number(derived.totalTrainingDays || 0)
          if (totalCount > 0 && completedCount >= totalCount && derived.instance?.status === 'active') {
            await handleCompletePlan(derived.instance)
          }
        }

        if (sub?.id) coachPlanData[sub.id] = data
      }

      setCoachPlanDataBySubId(coachPlanData)

      const previousActive = activeSubs.find((item: any) => item.id === activeCoachSubscriptionId)
      const firstWithPlan = activeSubs.find((item: any) => coachPlanData[item.id]?.instance)
      const previousActiveHasPlan = !!(previousActive?.id && coachPlanData[previousActive.id]?.instance)
      const firstNotExpired = activeSubs.find((item: any) => {
        const remainingDays = getRemainingDays(item?.end_date)
        return remainingDays === null || remainingDays > 0
      })
      const nextActiveId =
        previousActiveHasPlan
          ? previousActive.id
          : firstWithPlan?.id || firstNotExpired?.id || previousActive?.id || activeSubs[0]?.id || null
      setActiveCoachSubscriptionId(nextActiveId)

      if (selfRes?.instance) {
        const derived = selfRes as any
        setSelfInstance(selfRes.instance)
        setSelfActions(selfRes.actions || {})
        setSelfDayIndex(derived.recommendedDayIndex ?? derived.nextDayIndex ?? 1)
        setSelfTodayCompleted(!!derived.todayCompleted)
        setSelfCompletionDates(derived.completionDates || {})
        setSelfExecutionsByDayIndex(derived.executionsByDayIndex || {})
        setSelfMissingDays(Array.isArray(derived.missingDays) ? derived.missingDays : [])

        const completedCount = Array.isArray(derived.completedDays) ? derived.completedDays.length : 0
        const totalCount = Number(derived.totalTrainingDays || 0)
        if (totalCount > 0 && completedCount >= totalCount && selfRes.instance?.status === 'active') {
          await handleCompletePlan(selfRes.instance)
        }
      } else {
        setSelfInstance(null)
        setSelfActions({})
        setSelfDayIndex(1)
        setSelfTodayCompleted(false)
        setSelfCompletionDates({})
        setSelfExecutionsByDayIndex({})
        setSelfMissingDays([])
      }

      const resolvedPlanMode = activeSubs.some((item: any) => coachPlanData[item.id]?.instance)
        ? 'coach'
        : selfRes?.instance
          ? 'self'
          : planMode

      if (resolvedPlanMode === 'coach') {
        setPlanMode('coach')
      } else if (resolvedPlanMode === 'self') {
        setPlanMode('self')
      }

      const selfDerived = selfRes as any
      persistTodayTrainingPageCache({
        userId: String(session.userId),
        coachSubscriptions: activeSubs,
        coachPlanDataBySubId: coachPlanData,
        activeCoachSubscriptionId: nextActiveId,
        selfInstance: selfRes?.instance || null,
        selfActions: selfRes?.actions || {},
        selfDayIndex: selfRes?.instance ? (selfDerived.recommendedDayIndex ?? selfDerived.nextDayIndex ?? 1) : 1,
        selfTodayCompleted: selfRes?.instance ? !!selfDerived.todayCompleted : false,
        selfCompletionDates: selfRes?.instance ? (selfDerived.completionDates || {}) : {},
        selfExecutionsByDayIndex: selfRes?.instance ? (selfDerived.executionsByDayIndex || {}) : {},
        selfMissingDays: selfRes?.instance && Array.isArray(selfDerived.missingDays) ? selfDerived.missingDays : [],
        planMode: resolvedPlanMode,
        selectedDayIndex
      })
    } catch (error) {
      console.error('[today-training] load failed', error)
      Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [activeCoachSubscriptionId, applyCachedPageData, handleCompletePlan, planMode, selectedDayIndex])

  const consumeReturnConfirmState = useCallback(() => {
    const raw = Taro.getStorageSync(RETURN_CONFIRM_STORAGE_KEY)
    if (!raw) return

    Taro.removeStorageSync(RETURN_CONFIRM_STORAGE_KEY)

    const payload =
      raw && typeof raw === 'object'
        ? raw
        : {
            dayIndex: Number(raw),
            ts: Date.now()
          }
    const ts = Number(payload?.ts || Date.now())
    const dayIndex = Number(payload?.dayIndex || 0)

    if (Number.isFinite(ts) && Date.now() - ts > 30 * 60 * 1000) {
      return
    }

    setReturnConfirmedDayIndex(Number.isFinite(dayIndex) && dayIndex > 0 ? dayIndex : null)
  }, [])

  useDidShow(() => {
    void loadData()
    consumeReturnConfirmState()
  })

  const handleGoToTrainingExecution = useCallback(
    (dayIndex: number) => {
      if (!instance?.id) return
      const coachId = activeSubscription?.coach_id || activeSubscription?.coach?.id
      const coachName = activeSubscription?.coach?.name || ''
      const coachQuery = coachId
        ? `&coachId=${encodeURIComponent(coachId)}${coachName ? `&coachName=${encodeURIComponent(coachName)}` : ''}`
        : ''
      Taro.navigateTo({
        url: `/training/training-execution?instanceId=${instance.id}&dayIndex=${dayIndex}${coachQuery}`
      })
    },
    [activeSubscription, instance?.id]
  )

  const handleSkipDay = useCallback(
    (dayIndex: number) => {
      if (!instance?.id || !dayIndex) return
      Taro.showModal({
        title: '确认跳过',
        content: `确认跳过第${dayIndex}天吗？跳过后会推进进度，并对教练可见。`,
        success: async (res) => {
          if (!res.confirm) return
          try {
            const ok = await executionService.skipDay(instance.id, dayIndex)
            if (!ok) {
              Taro.showToast({ title: '操作失败', icon: 'none' })
              return
            }
            Taro.showToast({ title: '已跳过', icon: 'success' })
            await loadData()
          } catch (error) {
            console.error('[today-training] skip day failed', error)
            Taro.showToast({ title: '操作失败，请稍后重试', icon: 'none' })
          }
        }
      })
    },
    [instance?.id, loadData]
  )

  const handleContactCoach = useCallback(() => {
    const coachId = activeSubscription?.coach_id || activeSubscription?.coach?.id
    const coachName = activeSubscription?.coach?.name || ''
    Taro.navigateTo({
      url: coachId
        ? `/me/messages/index?coachId=${encodeURIComponent(coachId)}${coachName ? `&coachName=${encodeURIComponent(coachName)}` : ''}`
        : '/me/messages/index'
    })
  }, [activeSubscription])

  const handleGoToPlanLib = useCallback(() => {
    Taro.navigateTo({ url: '/me/plan-lib/index' })
  }, [])

  const handleImpromptu = useCallback(() => {
    Taro.navigateTo({ url: '/training/impromptu-training' })
  }, [])

  const handleUpdateProfile = useCallback(() => {
    Taro.navigateTo({ url: '/me/profile/detail/index' })
  }, [])

  const handleGenerateNextPlan = useCallback(() => {
    Taro.navigateTo({ url: '/me/plan-lib/index' })
  }, [])

  const handleViewAllPlans = useCallback(() => {
    Taro.navigateTo({ url: '/me/plan-history/index' })
  }, [])

  const handleRemoveSelfPlan = useCallback(() => {
    if (!selfInstance?.id) return
    Taro.showModal({
      title: '确认移除计划',
      content: '移除后当前自建计划会从今日训练页消失，但不会影响教练计划。',
      confirmText: '确认移除',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const deleteRes = await trainingService.deleteInstance({ id: selfInstance.id })
          if (!deleteRes) throw new Error('删除失败')

          setSelfInstance(null)
          setSelfActions({})
          setSelfDayIndex(1)
          setSelfTodayCompleted(false)
          setSelfCompletionDates({})
          setSelfExecutionsByDayIndex({})
          setSelfMissingDays([])

          if (coachInstance) {
            setPlanMode('coach')
          }

          Taro.showToast({ title: '已移除自建计划', icon: 'success' })
          await loadData()
        } catch (error) {
          console.error('[today-training] remove self plan failed', error)
          Taro.showToast({ title: '移除失败，请稍后重试', icon: 'none' })
        }
      }
    })
  }, [coachInstance, loadData, selfInstance?.id])

  const loadLightweightActions = useCallback(async () => {
    try {
      setPickerLoading(true)
      const res = await studentActionLibService.listActions({ page: 1, limit: 200 })
      const filtered = (res?.actions || []).filter((item: any) =>
        ['DIET', 'CARDIO', 'HABIT'].includes(String(item?.type || '').toUpperCase())
      )
      setActionPickerList(filtered)
    } catch (error) {
      console.error('[today-training] load lightweight actions failed', error)
      Taro.showToast({ title: '动作库加载失败', icon: 'none' })
    } finally {
      setPickerLoading(false)
    }
  }, [])

  const handleOpenLightweightPicker = useCallback(async () => {
    setLightweightPickerVisible(true)
    if (actionPickerList.length === 0) {
      await loadLightweightActions()
    }
  }, [actionPickerList.length, loadLightweightActions])

  const handleSelectLightweightAction = useCallback((action: any) => {
    const actionType = String(action?.type || '').toUpperCase()
    const attrs =
      action?.attrs && typeof action.attrs === 'object' && !Array.isArray(action.attrs) ? action.attrs : {}
    const customData = attrs?.custom_data || {}

    setPendingLightweightAction(action)
    setNewTaskSuggestedTime(String(attrs?.suggested_time || '').trim())
    setNewTaskNotes(String(attrs?.note || '').trim())
    setNewDietContent(actionType === 'DIET' ? String(customData?.content || '').trim() : '')
    setNewCardioDistanceKm(actionType === 'CARDIO' && customData?.distance ? `${Number(customData.distance) / 1000}` : '')
    setNewCardioDurationMin(actionType === 'CARDIO' && customData?.duration ? `${Math.round(Number(customData.duration) / 60)}` : '')
    setNewCardioPace(actionType === 'CARDIO' ? String(customData?.pace || '').trim() : '')
    setNewHabitName(actionType === 'HABIT' ? String(customData?.habit_name || action?.name || '').trim() : '')
    setNewHabitTargetDurationMin(actionType === 'HABIT' && customData?.target_duration ? `${Number(customData.target_duration)}` : '')
    setLightweightPickerVisible(false)
    setLightweightConfigVisible(true)
  }, [])

  const resetLightweightConfig = useCallback(() => {
    setPendingLightweightAction(null)
    setNewTaskSuggestedTime('')
    setNewTaskNotes('')
    setNewDietContent('')
    setNewCardioDistanceKm('')
    setNewCardioDurationMin('')
    setNewCardioPace('')
    setNewHabitName('')
    setNewHabitTargetDurationMin('')
  }, [])

  const handleAddLightweightTask = useCallback(async () => {
    if (!instance?.id || !selectedDayIndex || !pendingLightweightAction || addingLightweightTask) return
    try {
      setAddingLightweightTask(true)
      let executionId = selectedExec?.id
      if (!executionId) {
        const startRes = await executionService.startExecution(instance.id, selectedDayIndex)
        executionId = getExecutionId(startRes)
      }
      if (!executionId) throw new Error('无法创建当天执行记录')

      const actionType = String(pendingLightweightAction?.type || '').toUpperCase()
      const distanceNumber = Number(newCardioDistanceKm)
      const durationNumber = Number(newCardioDurationMin)
      const habitDurationNumber = Number(newHabitTargetDurationMin)
      const customData =
        actionType === 'DIET'
          ? { content: newDietContent.trim() || undefined }
          : actionType === 'CARDIO'
            ? {
                distance: Number.isFinite(distanceNumber) && distanceNumber > 0 ? Math.round(distanceNumber * 1000) : undefined,
                duration: Number.isFinite(durationNumber) && durationNumber > 0 ? Math.round(durationNumber * 60) : undefined,
                pace: newCardioPace.trim() || undefined
              }
            : {
                habit_name: newHabitName.trim() || pendingLightweightAction.name,
                target_duration:
                  Number.isFinite(habitDurationNumber) && habitDurationNumber > 0 ? Math.round(habitDurationNumber) : undefined
              }

      const res = await executionService.addExtraExercise(executionId, pendingLightweightAction.id, pendingLightweightAction.name, {
        sets: [{ weight: null, reps: null }],
        suggestedTime: newTaskSuggestedTime.trim() || undefined,
        notes: newTaskNotes.trim() || undefined,
        customData
      })
      if (!res) throw new Error('新增轻任务失败')

      Taro.showToast({ title: '已新增轻任务', icon: 'success' })
      setLightweightConfigVisible(false)
      resetLightweightConfig()
      await loadData()
    } catch (error: any) {
      console.error('[today-training] add lightweight task failed', error)
      Taro.showToast({ title: error?.message || '新增失败，请稍后重试', icon: 'none' })
    } finally {
      setAddingLightweightTask(false)
    }
  }, [
    addingLightweightTask,
    instance?.id,
    loadData,
    newCardioDistanceKm,
    newCardioDurationMin,
    newCardioPace,
    newDietContent,
    newHabitName,
    newHabitTargetDurationMin,
    newTaskNotes,
    newTaskSuggestedTime,
    pendingLightweightAction,
    resetLightweightConfig,
    selectedDayIndex,
    selectedExec?.id
  ])

  const handleDeleteLightweightTask = useCallback(
    (task: NormalizedDayTask) => {
      const executionId = selectedExec?.id
      if (!executionId || !task.isStudentExtra) return
      Taro.showModal({
        title: '删除轻任务',
        content: `确认删除轻任务「${task.title}」吗？`,
        success: async (res) => {
          if (!res.confirm) return
          try {
            setAddingLightweightTask(true)
            const deleteRes = await executionService.deleteExtraExercise(executionId, task.executionIndex)
            if (!deleteRes) throw new Error('删除失败')
            Taro.showToast({ title: '已删除', icon: 'success' })
            await loadData()
          } catch (error) {
            console.error('[today-training] delete lightweight task failed', error)
            Taro.showToast({ title: '删除失败，请稍后重试', icon: 'none' })
          } finally {
            setAddingLightweightTask(false)
          }
        }
      })
    },
    [loadData, selectedExec?.id]
  )

  const handleOpenLightweightTask = useCallback((task: NormalizedDayTask) => {
    setActiveLightweightTask(task)
    setLightweightSheetVisible(true)
  }, [])

  const handleSubmitLightweightSheet = useCallback(
    async (payload: { dietContent?: string; cardioDistance?: number | null; cardioDuration?: number | null }) => {
      if (!activeLightweightTask) return
      try {
        setLightweightSheetSaving(true)
        let executionId = selectedExec?.id
        if (!executionId && instance?.id && selectedDayIndex) {
          const startRes = await executionService.startExecution(instance.id, selectedDayIndex)
          executionId = getExecutionId(startRes)
        }
        if (!executionId) throw new Error('无法获取执行记录')
        const distance = Number(payload.cardioDistance)
        const duration = Number(payload.cardioDuration)
        const res = await executionService.completeItem({
          executionId,
          actionIndex: activeLightweightTask.executionIndex,
          itemType: activeLightweightTask.itemType as 'DIET' | 'CARDIO' | 'HABIT',
          completed: true,
          actualContent: activeLightweightTask.itemType === 'DIET' ? payload.dietContent || undefined : undefined,
          actualDistance:
            activeLightweightTask.itemType === 'CARDIO' && Number.isFinite(distance) && distance > 0
              ? Math.round(distance * 1000)
              : undefined,
          actualDuration:
            activeLightweightTask.itemType === 'CARDIO' && Number.isFinite(duration) && duration > 0
              ? Math.round(duration * 60)
              : undefined
        })
        if (!res) throw new Error('打卡失败')
        Taro.showToast({
          title: activeLightweightTask.isCompleted ? '已更新记录' : '打卡完成',
          icon: 'success'
        })
        setLightweightSheetVisible(false)
        setActiveLightweightTask(null)
        await loadData()
      } catch (error: any) {
        console.error('[today-training] complete lightweight task failed', error)
        Taro.showToast({ title: error?.message || '打卡失败，请稍后重试', icon: 'none' })
      } finally {
        setLightweightSheetSaving(false)
      }
    },
    [activeLightweightTask, instance?.id, loadData, selectedDayIndex, selectedExec?.id]
  )

  const handleGoToWeightCalibration = () => {
    setShowExplainDialog(false)
    const targetDayIndex =
      selectedDay?.type === 'training'
        ? selectedDayIndex
        : progressDay?.type === 'training'
          ? progressDayIndex
          : null

    if (!targetDayIndex) {
      Taro.showToast({ title: '当前没有可校准的训练日', icon: 'none' })
      return
    }

    handleGoToTrainingExecution(targetDayIndex)
  }

  const renderLoading = () => (
    <View className='today-training-page'>
      <ScrollView className='page-scroll' scrollY>
        <View className='loading-container'>
          <View className='skeleton-card'>
            <View className='skeleton-header' />
            <View className='skeleton-body'>
              <View className='skeleton-line' />
              <View className='skeleton-line' />
              <View className='skeleton-line' />
            </View>
          </View>
          <View className='skeleton-card'>
            <View className='skeleton-header' />
            <View className='skeleton-body'>
              <View className='skeleton-line' />
              <View className='skeleton-line' />
            </View>
          </View>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )

  if (loading) {
    return renderLoading()
  }

  const hasAnyPlan = !!(coachInstance || selfInstance)
  const hasBothPlans = !!(coachInstance && selfInstance)
  const hasActiveCoachSubscription = !!activeSubscription?.id
  const subscribedCoachName =
    activeSubscription?.coach?.name || activeSubscription?.coach?.title || activeSubscription?.coach_id || ''
  const graceDaysLeft = Math.max(0, Number(activeSubscription?.grace_days_left || 0))
  const graceDeadlineLabel = formatShortDate(activeSubscription?.grace_deadline_at)

  if (!hasAnyPlan) {
    return (
      <View className='today-training-page'>
        <ScrollView className='page-scroll' scrollY>
          <View className='page-content'>
            <View className='empty-card waiting-card'>
              <View className='empty-icon-wrapper'>
                <View className='empty-icon-bg' />
                <View className='empty-icon-inner'>
                  <Text className='empty-icon'>
                    {hasActiveCoachSubscription ? (shouldShowRenewBlock ? <Notice size={20} /> : <Target size={20} />) : <Location size={20} />}
                  </Text>
                </View>
              </View>
              <Text className='empty-title'>
                {hasActiveCoachSubscription
                  ? (shouldShowRenewBlock ? '订阅已到期，请尽快续费' : '计划正在制定中')
                  : '还没有长期计划'}
              </Text>
              <Text className='empty-desc'>
                {activeSubscription?.id
                  ? shouldShowRenewBlock
                    ? subscribedCoachName
                      ? `您与教练「${subscribedCoachName}」的订阅已到期。训练计划内容已锁定，请在宽限期内续费后恢复并继续当前进度。`
                      : '您的教练订阅已到期。训练计划内容已锁定，请在宽限期内续费后恢复并继续当前进度。'
                    : subscribedCoachName
                      ? `您的教练「${subscribedCoachName}」正在为您制定训练计划，请耐心等待。`
                      : '您的教练正在为您制定训练计划，请耐心等待。'
                  : '可以先做一次即兴训练，训练记录会继续沉淀在这里。'}
              </Text>

              {shouldShowRenewBlock && (
                <View className='grace-card'>
                  <Text>
                    宽限期剩余 {graceDaysLeft} 天{graceDeadlineLabel ? `（截至 ${graceDeadlineLabel}）` : ''}，逾期将自动取消订阅关系。
                  </Text>
                </View>
              )}

              <View className='empty-actions'>
                {activeSubscription?.id && shouldShowRenewBlock ? (
                  <View className='action-btn primary' onClick={() => Taro.navigateTo({ url: renewPath })}>
                    <Text><ArrowRight size={20} /></Text>
                    <Text>去教练主页续费</Text>
                  </View>
                ) : (
                  <View className='action-btn primary' onClick={handleImpromptu}>
                    <Text><Power size={20} /></Text>
                    <Text>{activeSubscription?.id ? '即兴锻炼' : '开始即兴首练'}</Text>
                  </View>
                )}

                {activeSubscription?.id && !shouldShowRenewBlock && (
                  <View className='action-btn action-btn-outline' onClick={handleContactCoach}>
                    <Text><Message size={20} /></Text>
                    <Text>联系教练</Text>
                  </View>
                )}

              </View>
            </View>
          </View>
        </ScrollView>
        <BottomNav />
      </View>
    )
  }

  const waitingCoachPage = planMode === 'coach' && !coachInstance && activeSubscription?.id
  return (
    <View className='today-training-page'>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          {hasBothPlans && (
            <View className='plan-switcher'>
              <View className={`switcher-btn ${planMode === 'coach' ? 'active' : ''}`} onClick={() => setPlanMode('coach')}>
                <Text className='switcher-icon'><User size={14} /></Text>
                <Text>教练计划</Text>
              </View>
              <View className={`switcher-btn ${planMode === 'self' ? 'active' : ''}`} onClick={() => setPlanMode('self')}>
                <Text className='switcher-icon'><Star size={14} /></Text>
                <Text>我的计划</Text>
              </View>
            </View>
          )}

          {planMode === 'coach' && coachSubscriptions.length > 1 && (
            <View className='coach-tabs'>
              <ScrollView scrollX className='coach-tabs-scroll'>
                {coachSubscriptions.map((sub: any) => {
                  const isActive = activeCoachSubscriptionId === sub.id
                  const hasPlan = !!coachPlanDataBySubId[sub.id]?.instance
                  return (
                    <View
                      key={sub.id}
                      className={`coach-tab ${isActive ? 'active' : ''} ${!hasPlan ? 'no-plan' : ''}`}
                      onClick={() => setActiveCoachSubscriptionId(sub.id)}
                    >
                      <Text className='coach-tab-name'>{sub.coach?.name || `教练${String(sub.id).slice(0, 8)}`}</Text>
                      {!hasPlan && <Text className='coach-tab-badge'>{shouldShowRenewBlock && isActive ? '待续费' : '待制定'}</Text>}
                    </View>
                  )
                })}
              </ScrollView>
            </View>
          )}

          {waitingCoachPage ? (
            <View className='empty-card waiting-card'>
              <View className='empty-icon-wrapper'>
                <View className='empty-icon-bg' />
                <View className='empty-icon-inner'>
                  <Text className='empty-icon'>{shouldShowRenewBlock ? <Notice size={20} /> : <Target size={20} />}</Text>
                </View>
              </View>
              <Text className='empty-title'>{shouldShowRenewBlock ? '订阅已到期，请尽快续费' : '教练计划正在制定中'}</Text>
              <Text className='empty-desc'>
                {shouldShowRenewBlock
                  ? `您与教练「${subscribedCoachName || '教练'}」的订阅已到期。训练计划内容已锁定，请在宽限期内续费后恢复并继续当前进度。`
                  : `您的教练「${subscribedCoachName || '教练'}」正在为您制定训练计划，请耐心等待。`}
              </Text>

              {shouldShowRenewBlock && (
                <View className='grace-card'>
                  <Text>
                    宽限期剩余 {graceDaysLeft} 天{graceDeadlineLabel ? `（截至 ${graceDeadlineLabel}）` : ''}。
                  </Text>
                </View>
              )}

              <View className='empty-actions'>
                {shouldShowRenewBlock ? (
                  <View className='action-btn primary' onClick={() => Taro.navigateTo({ url: renewPath })}>
                    <Text><ArrowRight size={20} /></Text>
                    <Text>去教练主页续费</Text>
                  </View>
                ) : (
                  <View className='action-btn primary' onClick={handleImpromptu}>
                    <Text><Power size={20} /></Text>
                    <Text>开始即兴首练</Text>
                  </View>
                )}
                {!shouldShowRenewBlock && (
                  <View className='action-btn action-btn-outline' onClick={handleContactCoach}>
                    <Text><Message size={20} /></Text>
                    <Text>联系教练</Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <>
              <View className={instance?.source === 'self' ? 'coach-card self-plan-card' : 'coach-card'}>
                <View className='card-content'>
                  <View className='card-main'>
                    <View className='coach-avatar'>
                      <View className='avatar-box'>
                        <Text className='avatar-text'>
                          {instance?.source === 'self' ? 'ME' : String(activeSubscription?.coach?.name || 'C').slice(0, 1)}
                        </Text>
                      </View>
                      {instance?.source !== 'self' && <View className='online-dot' />}
                    </View>
                    <View className='coach-info'>
                      <View className='info-labels'>
                        <Text className='pro-badge'>{instance?.source === 'self' ? 'SELF PLAN' : 'PRO COACH'}</Text>
                        <Text className='status-text'>
                          {instance?.source === 'self' ? 'Your personal journey' : 'Assigning your path'}
                        </Text>
                      </View>
                      <Text className='coach-name'>
                        {instance?.source === 'self' ? instance?.name || '我的计划' : activeSubscription?.coach?.name || '未知教练'}
                      </Text>
                      <Text className='coach-title'>
                        {instance?.source === 'self' ? '自我驱动，超越极限' : activeSubscription?.coach?.title || '资深健身专家'}
                      </Text>
                    </View>
                  </View>
                  {instance?.source === 'self' && (
                    <View className='card-action' onClick={handleRemoveSelfPlan}>
                      <Text className='danger-action'>移除计划</Text>
                    </View>
                  )}
                </View>
              </View>

              {returnConfirmedDayIndex && (
                <View className='return-confirm-banner'>
                  <Text>
                    已确认第{returnConfirmedDayIndex}天：训练记录、备注和视频都会沉淀；真实重量会帮助系统更新 e1RM，让下次自动算重量更准。
                  </Text>
                  <Text className='banner-link' onClick={() => setReturnConfirmedDayIndex(null)}>
                    收起
                  </Text>
                </View>
              )}

              <View className='info-tip-card' onClick={() => setShowExplainDialog(true)}>
                <View>
                  <Text className='info-tip-title'>为什么要确认完成？为什么要输入重量？</Text>
                  <Text className='info-tip-desc'>这里会解释休息日顺延、e1RM 校准和为什么确认完成会影响下一次自动算重。</Text>
                </View>
                <Text className='banner-link'>查看说明</Text>
              </View>

              {missingDays.length > 0 && (
                <View className='missing-days-banner'>
                  <Text className='missing-days-desc'>
                    你有 {missingDays.length} 天训练日未确认，可补练或跳过，系统会继续按这些未解决训练日优先引导。
                  </Text>
                  <View className='missing-days-actions'>
                    {missingDays.slice(0, 3).map((dayIndex: number) => (
                      <View key={dayIndex} className='missing-days-row'>
                        <View className='missing-days-btn primary' onClick={() => handleGoToTrainingExecution(dayIndex)}>
                          <Text>去补练 第{dayIndex}天</Text>
                        </View>
                        <View className='missing-days-btn secondary' onClick={() => handleSkipDay(dayIndex)}>
                          <Text>跳过</Text>
                        </View>
                      </View>
                    ))}
                    {missingDays.length > 3 && <Text className='missing-days-ellipsis'>…</Text>}
                  </View>
                </View>
              )}

              {todayCompleted && (
                <View className='today-completed-banner'>
                  <Text><Check size={16} /> 你今天已经完成过训练了；如果仍有未完成训练日，系统会继续引导你补做。</Text>
                </View>
              )}

              {isExpiredGrace && planMode === 'coach' && (
                <View className='grace-warning-banner'>
                  <Text>
                    当前订阅处于宽限期，剩余 {graceDaysLeft} 天{graceDeadlineLabel ? `（截至 ${graceDeadlineLabel}）` : ''}。
                  </Text>
                  <Text className='banner-link' onClick={() => Taro.navigateTo({ url: renewPath })}>
                    去续费
                  </Text>
                </View>
              )}

              {trainingDays.length > 0 && (
                <ScheduleCalendarPanel
                  trainingDays={trainingDays}
                  currentDayIndex={todayDayIndex}
                  selectedDayIndex={selectedDayIndex}
                  completionDates={completionDates}
                  executionsByDayIndex={executionsByDayIndex}
                  scheduleModel={scheduleModel}
                  todayCompleted={todayCompleted}
                  progressDayIndex={progressDayIndex}
                  planStartDate={effectiveCalendarStartDate || undefined}
                  startExecutionDay={instance?.start_execution_day || 1}
                  onSelectedDayChange={setSelectedDayIndex}
                />
              )}

              <View className='section-header'>
                <View className='header-left'>
                  <Text className='section-title'>{selectedDayIndex === progressDayIndex ? '今日安排' : '当天安排'}</Text>
                  <Text className='section-subtitle'>
                    {selectedDay?.type === 'rest'
                      ? `第${selectedDayIndex}天 · 恢复与轻任务`
                      : `第${selectedDayIndex}天 · ${selectedTaskSummary.totalModules} 个模块`}
                  </Text>
                </View>
              </View>

              {selectedDay?.type === 'training' ? (
                <>
                  <TodayTrainingCard
                    day={selectedDay}
                    actions={actions}
                    instanceId={instance?.id || ''}
                    dayIndex={selectedDayIndex}
                    coachId={activeSubscription?.coach_id || activeSubscription?.coach?.id}
                    coachName={activeSubscription?.coach?.name}
                    executionStatus={selectedExecutionStatus}
                    execution={selectedExec}
                    heading={selectedDayIndex === progressDayIndex ? '今日安排' : '当天安排'}
                    subheading={`第${selectedDayIndex}天 · ${selectedTaskSummary.totalModules} 个模块`}
                    dateLabel={selectedDateLabel}
                    dateMeta={selectedDateMeta}
                    onOpenLightweightTask={handleOpenLightweightTask}
                    onAddLightweightTask={handleOpenLightweightPicker}
                    onDeleteLightweightTask={handleDeleteLightweightTask}
                  />

                  {canShareDayCheckin && (
                    <View className='share-entry-card'>
                      <Text className='share-entry-tag'>SHARE CHECK-IN</Text>
                      <Text className='share-entry-title'>现在可以生成整日打卡图</Text>
                      <Text className='share-entry-desc'>这里展示的是这一天的完成状态快照，不要求你先把所有任务做完。</Text>
                      <View className='inline-actions'>
                        <View className='inline-action-btn' onClick={() => setDayShareVisible(true)}>
                          <Text>整日打卡图</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </>
              ) : selectedDay ? (
                <>
                  <RestDayCard dayIndex={selectedDayIndex} />
                  <View className='rest-lightweight-wrap'>
                    <TodayTrainingCard
                      day={selectedDay}
                      actions={actions}
                      instanceId={instance?.id || ''}
                      dayIndex={selectedDayIndex}
                      coachId={activeSubscription?.coach_id || activeSubscription?.coach?.id}
                      coachName={activeSubscription?.coach?.name}
                      executionStatus={selectedExecutionStatus}
                      execution={selectedExec}
                      heading='休息日轻任务'
                      subheading={`第${selectedDayIndex}天 · ${selectedTaskSummary.lightweightCount} 个轻任务`}
                      dateLabel={selectedDateLabel}
                      dateMeta={selectedDateMeta}
                      onOpenLightweightTask={handleOpenLightweightTask}
                      onAddLightweightTask={handleOpenLightweightPicker}
                      onDeleteLightweightTask={handleDeleteLightweightTask}
                    />
                  </View>

                  {inProgressExec && (
                    <View className='in-progress-banner'>
                      <Text>
                        你有进行中的训练：第{inProgressExec.day_index}天（开始于 {formatShortDate(inProgressExec.started_at)}）。
                      </Text>
                      <Text
                        className='banner-link'
                        onClick={() => handleGoToTrainingExecution(Number(inProgressExec.day_index || progressDayIndex))}
                      >
                        继续训练
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <View className='empty-card'>
                  <Text className='empty-title'>当前计划暂无可展示的训练日</Text>
                  <Text className='empty-desc'>可以先去计划库查看，或者做一次即兴锻炼。</Text>
                  <View className='empty-actions'>
                    <View className='action-btn primary' onClick={handleImpromptu}>
                      <Text><Power size={20} /></Text>
                      <Text>即兴锻炼</Text>
                    </View>
                    <View className='action-btn secondary' onClick={handleGoToPlanLib}>
                      <Text><Calendar size={20} /></Text>
                      <Text>我的计划库</Text>
                    </View>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <BottomNav />

      <LightweightTaskSheet
        visible={lightweightSheetVisible}
        task={activeLightweightTask as any}
        saving={lightweightSheetSaving}
        onClose={() => {
          setLightweightSheetVisible(false)
          setActiveLightweightTask(null)
        }}
        onSubmit={handleSubmitLightweightSheet}
      />

      <LightweightActionPicker
        visible={lightweightPickerVisible}
        loading={pickerLoading}
        actions={actionPickerList}
        onClose={() => setLightweightPickerVisible(false)}
        onSelect={handleSelectLightweightAction}
      />

      <DayCheckinShareSheet
        visible={dayShareVisible}
        onClose={() => setDayShareVisible(false)}
        data={dayShareData}
        directShareReady={dayShareShareable}
        directShareLoading={dayShareLoading}
      />

      {lightweightConfigVisible && pendingLightweightAction && (
        <View className='config-sheet-mask' onClick={() => !addingLightweightTask && setLightweightConfigVisible(false)}>
          <View className='config-sheet' onClick={(e) => e.stopPropagation()}>
            <Text className='config-title'>配置任务 · {pendingLightweightAction.name}</Text>
            <View className='config-grid'>
              <View className='config-field'>
                <Text className='config-label'>建议时间（可选）</Text>
                <Input
                  className='config-input'
                  value={newTaskSuggestedTime}
                  placeholder='例如：07:30 / 晚饭后'
                  onInput={(e) => setNewTaskSuggestedTime(e.detail.value)}
                />
              </View>
              <View className='config-field'>
                <Text className='config-label'>任务类型</Text>
                <View className='config-static'>
                  <Text>{String(pendingLightweightAction.type || '').toUpperCase() || 'DIET'}</Text>
                </View>
              </View>
            </View>

            {String(pendingLightweightAction.type || '').toUpperCase() === 'DIET' && (
              <View className='config-field'>
                <Text className='config-label'>饮食目标 / 内容</Text>
                <Textarea
                  className='config-textarea'
                  value={newDietContent}
                  maxlength={300}
                  placeholder='例如：早餐高蛋白，碳水控制在 60g 以内'
                  onInput={(e) => setNewDietContent(String(e.detail.value || '').slice(0, 300))}
                />
              </View>
            )}

            {String(pendingLightweightAction.type || '').toUpperCase() === 'CARDIO' && (
              <View className='config-grid'>
                <View className='config-field'>
                  <Text className='config-label'>目标距离（km）</Text>
                  <Input
                    type='digit'
                    className='config-input'
                    value={newCardioDistanceKm}
                    placeholder='例如：3'
                    onInput={(e) => setNewCardioDistanceKm(e.detail.value)}
                  />
                </View>
                <View className='config-field'>
                  <Text className='config-label'>目标时长（分钟）</Text>
                  <Input
                    type='number'
                    className='config-input'
                    value={newCardioDurationMin}
                    placeholder='例如：25'
                    onInput={(e) => setNewCardioDurationMin(e.detail.value)}
                  />
                </View>
                <View className='config-field'>
                  <Text className='config-label'>目标配速（可选）</Text>
                  <Input
                    className='config-input'
                    value={newCardioPace}
                    placeholder={`例如：5'30''/km`}
                    onInput={(e) => setNewCardioPace(e.detail.value)}
                  />
                </View>
              </View>
            )}

            {String(pendingLightweightAction.type || '').toUpperCase() === 'HABIT' && (
              <View className='config-grid'>
                <View className='config-field'>
                  <Text className='config-label'>习惯名称</Text>
                  <Input
                    className='config-input'
                    value={newHabitName}
                    placeholder='例如：23:00 前入睡'
                    onInput={(e) => setNewHabitName(e.detail.value)}
                  />
                </View>
                <View className='config-field'>
                  <Text className='config-label'>目标时长（分钟，可选）</Text>
                  <Input
                    type='number'
                    className='config-input'
                    value={newHabitTargetDurationMin}
                    placeholder='例如：15'
                    onInput={(e) => setNewHabitTargetDurationMin(e.detail.value)}
                  />
                </View>
              </View>
            )}

            <View className='config-field'>
              <Text className='config-label'>备注（可选）</Text>
              <Textarea
                className='config-textarea'
                value={newTaskNotes}
                maxlength={200}
                placeholder='补充说明会显示在任务卡片上'
                onInput={(e) => setNewTaskNotes(String(e.detail.value || '').slice(0, 200))}
              />
            </View>

            <View className='config-actions'>
              <View
                className='config-btn secondary'
                onClick={() => {
                  if (addingLightweightTask) return
                  setLightweightConfigVisible(false)
                  resetLightweightConfig()
                }}
              >
                <Text>取消</Text>
              </View>
              <View className={`config-btn primary ${addingLightweightTask ? 'disabled' : ''}`} onClick={handleAddLightweightTask}>
                <Text>{addingLightweightTask ? '创建中...' : '创建任务'}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {showCompletionModal && completedPlanInfo && (
        <View className='completion-modal-mask' onClick={() => setShowCompletionModal(false)}>
          <View className='completion-modal' onClick={(e) => e.stopPropagation()}>
            <View className='completion-modal-icon'><Star size={48} color="#CF6D4E" /></View>
            <Text className='completion-modal-title'>恭喜完成训练计划！</Text>
            <Text className='completion-modal-plan'>{completedPlanInfo.name}</Text>
            <Text className='completion-modal-rate'>完成度：{completedPlanInfo.rate}%</Text>
            <View className='completion-modal-actions'>
              <View className='completion-modal-btn primary' onClick={handleUpdateProfile}>
                <Text>更新档案</Text>
              </View>
              <View className='completion-modal-btn secondary' onClick={handleGenerateNextPlan}>
                <Text>生成下一计划</Text>
              </View>
              <View className='completion-modal-btn secondary' onClick={handleViewAllPlans}>
                <Text>查看全部计划</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {showExplainDialog && (
        <View className='info-dialog-mask' onClick={() => setShowExplainDialog(false)}>
          <View className='info-dialog' onClick={(e) => e.stopPropagation()}>
            <Text className='info-dialog-title'>为什么要点完成？为什么要输入重量？</Text>
            <View className='info-dialog-section'>
              <Text className='section-title'>1. 今日推进规则</Text>
              <Text className='section-text'>休息日会自动顺延；到训练日会停住，直到你完成或跳过，避免进度看起来被推走。</Text>
            </View>
            <View className='info-dialog-section'>
              <Text className='section-title'>2. 输入真实重量 / 次数的意义</Text>
              <Text className='section-text'>当次训练内，真实输入会让后续组推荐更贴合；跨天训练时，系统会据此更新 e1RM，让下次自动算重量更准。</Text>
            </View>
            <View className='info-dialog-section'>
              <Text className='section-title'>3. 完成与分享打卡</Text>
              <Text className='section-text'>完成会沉淀训练记录、视频和备注，方便复盘与给教练看；也支持整日打卡图分享。</Text>
            </View>
            <View className='info-dialog-actions'>
              <View className='config-btn secondary' onClick={handleGoToWeightCalibration}>
                <Text>去输入并校准</Text>
              </View>
              <View className='config-btn primary' onClick={() => setShowExplainDialog(false)}>
                <Text>我知道了</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

export default TodayTraining
