import { WECHAT_COACH_PURCHASE_PAUSED } from '@coachlink/core'
import { toBeijingDateKey } from '@coachlink/core/src/beijingTime'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, Textarea } from '@tarojs/components'
import { StableInput as Input } from '@/components/StableInput'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { authService } from '@/services/authService'
import { trainingService, PlanInstance } from '@/services/trainingService'
import { executionService } from '@/services/executionService'
import { studentActionLibService } from '@/services/studentActionLibService'
import { studentOnboardingService } from '@/services/studentOnboardingService'
import { studentService } from '@/services/studentService'
import { request, API_BASE_URL } from '@/utils/request'
import { formatMonthDaySlash } from '@/utils/dateFormat'
import { buildPlannedSetPreviews } from '@/utils/planSetPrescriptions'
import {
  buildSharePath,
  createSharePayload,
  createTimelinePayload,
  openCoachLinkShareMenu
} from '@/utils/share'
import TodayTrainingCard from './components/TodayTrainingCard'
import RecordCompletionButton from '@/components/RecordCompletionButton'
import ScheduleCalendarPanel from './components/ScheduleCalendarPanel'
import LightweightTaskSheet from './components/LightweightTaskSheet'
import LightweightActionPicker from './components/LightweightActionPicker'
import {
  ArrowRight,
  Calendar,
  Check,
} from '@nutui/icons-react-taro'
import { Popup } from '@nutui/nutui-react-taro'
import {
  buildPlanScheduleModel,
  buildDayModuleModel,
  canOpenPlanDayForExecution,
  formatPlanDayLabel,
  resolvePlanDayDate,
  type NormalizedDayTask,
} from './lib/dayModules'
import ExecutionPlanNoticePopup from '@/components/ExecutionPlanNoticePopup'
import {
  hasReadExecutionPlanNotice,
  markExecutionPlanNoticeRead
} from '@/utils/executionPlanNotice'
import { useTheme } from '@/hooks/useTheme'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import {
  getTodayTrainingBootFromCache,
  patchTodayTrainingPageCache,
  persistTodayTrainingPageCache
} from '@/utils/todayTrainingPageCache'
import {
  persistTrainingExecutionSnapshot,
  syncTrainingExecutionToStorage,
  trainingExecutionSnapshotKey
} from '@/utils/trainingExecutionCache'
import { openCoachChat } from '@/utils/coachChat'
import './index.scss'

type PlanMode = 'coach' | 'self'
type ExecutionStatus = 'none' | 'in_progress' | 'completed'
const RETURN_CONFIRM_STORAGE_KEY = 'today_training_last_confirmed_day'
/** 学员在今日训练页选中的教练订阅，刷新后仍优先展示该教练计划 */
const PREFERRED_COACH_SUB_STORAGE_KEY = 'today_training_preferred_coach_sub_id'
/** 学员训练首页（主包 tab 页，与旧分包路径等价） */
const TODAY_TRAINING_HOME_PATH = '/pages/index/index'
const LEGACY_TODAY_TRAINING_PATH = '/training/today-training'

function isStudentTrainingHomeUrl(url: string) {
  const pathOnly = (url || '').split('?')[0]
  return pathOnly === TODAY_TRAINING_HOME_PATH || pathOnly === LEGACY_TODAY_TRAINING_PATH
}

/** 小程序 Image 需要可访问的绝对 URL；后端若返回相对路径则拼 API 根 */
function resolveAvatarUrl(raw: string | null | undefined): string {
  const s = raw != null ? String(raw).trim() : ''
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  const base = String(API_BASE_URL || '').replace(/\/$/, '')
  const path = s.startsWith('/') ? s : `/${s}`
  return base ? `${base}${path}` : s
}

function findTodayCompletedDayIndex(executionsByDayIndex?: Record<number, any>) {
  const todayKey = toBeijingDateKey(new Date())

  const matched = Object.entries(executionsByDayIndex || {})
    .map(([key, execution]) => {
      const dayIndex = Number(execution?.day_index ?? key)
      const completedAt = execution?.completed_at
      if (!Number.isFinite(dayIndex) || dayIndex <= 0) return null
      if (String(execution?.status || '').toLowerCase() !== 'completed' || !completedAt) return null

      const completedDate = new Date(completedAt)
      const completedTime = completedDate.getTime()
      if (!Number.isFinite(completedTime)) return null
      if (toBeijingDateKey(execution?.performed_on || completedAt) !== todayKey) return null

      return { dayIndex, completedTime }
    })
    .filter(Boolean) as Array<{ dayIndex: number; completedTime: number }>

  if (matched.length === 0) return null
  matched.sort((left, right) => right.completedTime - left.completedTime)
  return matched[0].dayIndex
}

const getRemainingDays = (endDate?: string | null) => {
  if (!endDate) return null
  const ts = new Date(endDate).getTime()
  if (!Number.isFinite(ts)) return null
  return Math.ceil((ts - Date.now()) / (24 * 60 * 60 * 1000))
}

function parsePlanNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null
  const direct = Number(value)
  if (Number.isFinite(direct)) return direct
  const matched = String(value).match(/-?\d+(\.\d+)?/)
  if (!matched) return null
  const parsed = Number(matched[0])
  return Number.isFinite(parsed) ? parsed : null
}

function buildPlanExecutionPreview(
  targetInstance: any,
  actionMap: Record<string, any>,
  targetDayIndex: number
) {
  const trainingDays = Array.isArray(targetInstance?.training_days) ? targetInstance.training_days : []
  const day = trainingDays.find((item: any) => Number(item?.dayIndex) === Number(targetDayIndex))
  const actionSets = day?.type === 'training' && Array.isArray(day.actionSets) ? day.actionSets : []

  const actionExecutions = actionSets.map((item: any, actionIdx: number) => {
    const actionId = String(item?.action_id || item?.actionId || '')
    const actionDetail = actionId ? actionMap[actionId] || {} : {}
    const sets = buildPlannedSetPreviews(item)

    return {
      action_id: actionId || `${actionIdx}`,
      action_name: String(actionDetail?.name || item?.action_name || item?.set_name || '动作'),
      action_order: actionIdx + 1,
      sets,
      total_sets: sets.length,
      completed_sets: 0
    }
  })

  return {
    id: `preview-${targetInstance?.id || 'plan'}-${targetDayIndex}`,
    status: 'preview',
    source: 'plan_preview',
    day_index: targetDayIndex,
    action_executions: actionExecutions
  }
}

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

function removeActionFromExecution(execution: any, actionIndex: number) {
  const actionExecutions = Array.isArray(execution?.action_executions) ? execution.action_executions : []
  if (!Number.isInteger(actionIndex) || actionIndex < 0 || !actionExecutions[actionIndex]) return null

  const nextActions = actionExecutions
    .filter((_: any, index: number) => index !== actionIndex)
    .map((item: any, index: number) => ({
      ...item,
      action_order: index + 1,
      action_index: index
    }))
  const totalSets = nextActions.reduce((sum: number, item: any) => {
    if (Array.isArray(item?.sets)) return sum + item.sets.length
    return sum + 1
  }, 0)

  return {
    ...execution,
    action_executions: nextActions,
    total_sets: totalSets
  }
}

function TodayTrainingScreen() {
  const { effectiveTheme } = useTheme()
  const bootRef = useRef<ReturnType<typeof getTodayTrainingBootFromCache> | null>(null)
  if (!bootRef.current) {
    bootRef.current = getTodayTrainingBootFromCache()
  }
  const pageBoot = bootRef.current
  const pageCache = pageBoot.cache
  const initialSelectedDayIndex = (() => {
    const raw = pageCache?.selectedDayIndex
    return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1
  })()

  const [coachSubscriptions, setCoachSubscriptions] = useState<any[]>(() => pageCache?.coachSubscriptions ?? [])
  const [activeCoachSubscriptionId, setActiveCoachSubscriptionId] = useState<string | null>(
    () => pageCache?.activeCoachSubscriptionId ?? null
  )
  const activeCoachSubscriptionIdRef = useRef<string | null>(pageCache?.activeCoachSubscriptionId ?? null)
  const [coachPlanDataBySubId, setCoachPlanDataBySubId] = useState<Record<string, any>>(
    () => pageCache?.coachPlanDataBySubId ?? {}
  )

  const [selfInstance, setSelfInstance] = useState<PlanInstance | null>(() => pageCache?.selfInstance ?? null)
  const [selfActions, setSelfActions] = useState<Record<string, any>>(() => pageCache?.selfActions ?? {})
  const [selfDayIndex, setSelfDayIndex] = useState(() => pageCache?.selfDayIndex ?? 1)
  const [selfTodayCompleted, setSelfTodayCompleted] = useState(() => pageCache?.selfTodayCompleted ?? false)
  const [selfCompletionDates, setSelfCompletionDates] = useState<Record<number, string>>(
    () => pageCache?.selfCompletionDates ?? {}
  )
  const [selfExecutionsByDayIndex, setSelfExecutionsByDayIndex] = useState<Record<number, any>>(
    () => pageCache?.selfExecutionsByDayIndex ?? {}
  )
  const [selfMissingDays, setSelfMissingDays] = useState<number[]>(() => pageCache?.selfMissingDays ?? [])

  const [planMode, setPlanMode] = useState<PlanMode>(() => (pageCache?.planMode === 'self' ? 'self' : 'coach'))
  const planModeRef = useRef<PlanMode>(pageCache?.planMode === 'self' ? 'self' : 'coach')
  const updatePlanMode = useCallback((nextMode: PlanMode) => {
    planModeRef.current = nextMode
    setPlanMode(nextMode)
  }, [])
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [completedPlanInfo, setCompletedPlanInfo] = useState<{ name: string; rate: number } | null>(null)
  const [showExplainDialog, setShowExplainDialog] = useState(false)
  const [selectedDayIndex, setSelectedDayIndex] = useState(initialSelectedDayIndex)
  const selectedDayIndexRef = useRef<number>(initialSelectedDayIndex)
  const [returnConfirmed, setReturnConfirmed] = useState<{ instanceId: string; dayIndex: number; ts: number } | null>(null)
  const [activeLightweightTask, setActiveLightweightTask] = useState<NormalizedDayTask | null>(null)
  const [lightweightSheetVisible, setLightweightSheetVisible] = useState(false)
  const [lightweightPickerVisible, setLightweightPickerVisible] = useState(false)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [actionPickerList, setActionPickerList] = useState<any[]>([])
  const [addingLightweightTask, setAddingLightweightTask] = useState(false)
  const lightweightDeletionRef = useRef(false)
  const [lightweightSheetSaving, setLightweightSheetSaving] = useState(false)
  const [pendingLightweightAction, setPendingLightweightAction] = useState<any | null>(null)
  const [lightweightConfigVisible, setLightweightConfigVisible] = useState(false)
  const [moreTrainingOpen, setMoreTrainingOpen] = useState(false)
  const [recordCompletionOpen, setRecordCompletionOpen] = useState(false)
  const [coachPickSheetOpen, setCoachPickSheetOpen] = useState(false)
  const [calendarExpanded, setCalendarExpanded] = useState(false)
  const [newTaskSuggestedTime, setNewTaskSuggestedTime] = useState('')
  const [newTaskNotes, setNewTaskNotes] = useState('')
  const [newDietContent, setNewDietContent] = useState('')
  const [newCardioDistanceKm, setNewCardioDistanceKm] = useState('')
  const [newCardioDurationMin, setNewCardioDurationMin] = useState('')
  const [newCardioPace, setNewCardioPace] = useState('')
  const [newHabitName, setNewHabitName] = useState('')
  const [newHabitTargetDurationMin, setNewHabitTargetDurationMin] = useState('')
  const [executionNoticeVisible, setExecutionNoticeVisible] = useState(false)
  const [pendingExecutionTarget, setPendingExecutionTarget] = useState<{ dayIndex: number; focusAction?: number; readOnly?: boolean } | null>(null)
  const [isGuestHome, setIsGuestHome] = useState(() => !authService.getAuthSession({ normalize: true }).isAuthenticated)

  const activeSubscription =
    coachSubscriptions.find((item) => item.id === activeCoachSubscriptionId) ||
    coachSubscriptions[0] ||
    null

  const subscriptionLifecycle = String(activeSubscription?.lifecycle_status || 'active')
  const activeSubscriptionRemainingDays = getRemainingDays(activeSubscription?.end_date)
  const hasPositiveRemainingDays =
    activeSubscriptionRemainingDays === null || activeSubscriptionRemainingDays > 0
  const entitlementRemainingCredits = Number(activeSubscription?.entitlement_remaining_credits ?? NaN)
  const hasEntitlementRemaining =
    Number.isFinite(entitlementRemainingCredits) && entitlementRemainingCredits > 0
  const isExpiredGrace =
    subscriptionLifecycle === 'expired_grace' &&
    !hasPositiveRemainingDays &&
    !hasEntitlementRemaining
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

  const instance = planMode === 'coach' ? coachInstance : selfInstance
  const actions = planMode === 'coach' ? coachActions : selfActions
  const todayDayIndex = planMode === 'coach' ? coachDayIndex : selfDayIndex
  const todayCompleted = planMode === 'coach' ? coachTodayCompleted : selfTodayCompleted
  const completionDates = planMode === 'coach' ? coachCompletionDates : selfCompletionDates
  const executionsByDayIndex = planMode === 'coach' ? coachExecutionsByDayIndex : selfExecutionsByDayIndex
  const missingDays = planMode === 'coach' ? coachMissingDays : selfMissingDays

  const trainingDays = (instance?.training_days || []) as any[]
  const currentUserId = useMemo(() => {
    const session = authService.getAuthSession({ normalize: true })
    return session?.userId ? String(session.userId) : null
  }, [])
  const progressDayIndex = todayDayIndex
  const progressDay = trainingDays.find((item) => item.dayIndex === progressDayIndex)

  const syncCurrentUserProfile = useCallback(async () => {
    const session = authService.getAuthSession({ normalize: true })
    if (!session.isAuthenticated || !session.userId || !session.user) return

    try {
      const profile = (await studentService.getStudentProfile(session.userId))?.profile
      if (!profile || typeof profile !== 'object') return

      const nextUser = {
        ...session.user,
        ...(Object.prototype.hasOwnProperty.call(profile, 'nickname') ? { nickname: profile.nickname || '' } : {}),
        ...(Object.prototype.hasOwnProperty.call(profile, 'avatar_url') ? { avatar_url: profile.avatar_url ?? null } : {})
      }

      authService.setCurrentUser(nextUser)
    } catch (error) {
      console.error('[today-training] sync current user profile:', error)
    }
  }, [])

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

  const todayCompletedDayIndex = useMemo(
    () => findTodayCompletedDayIndex(executionsByDayIndex),
    [executionsByDayIndex]
  )
  const effectiveTodayCompleted = todayCompleted
  const returnedCompletedDayIndex = returnConfirmed && returnConfirmed.instanceId === instance?.id &&
    Date.now() - returnConfirmed.ts <= 30 * 60 * 1000 &&
    executionsByDayIndex[returnConfirmed.dayIndex]?.status === 'completed' ? returnConfirmed.dayIndex : null
  const defaultSelectedDayIndex = Number(inProgressExec?.day_index) || returnedCompletedDayIndex || todayCompletedDayIndex || progressDayIndex || 1

  useEffect(() => {
    if (!instance?.id) return
    setSelectedDayIndex(defaultSelectedDayIndex)
  }, [defaultSelectedDayIndex, instance?.id])

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

  // 每份计划必须使用自己的日期锚点。fresh plan 尚无 start_date 时，
  // 先以分配/创建日展示 D1；不能复用整段订阅的旧 start_date。
  const effectiveCalendarStartDate = planMode === 'coach'
    ? instance?.start_date || instance?.created_at || activeSubscription?.start_date || null
    : instance?.start_date || null
  const scheduleModel = useMemo(
    () =>
      buildPlanScheduleModel({
        dateBasis: 'plan-order',
        trainingDays,
        executionsByDayIndex,
        completionDates,
        effectiveStartDate: effectiveCalendarStartDate,
        progressDayIndex,
        startExecutionDay: Number(instance?.start_execution_day || 1),
        fallbackAnchorDayIndex: progressDayIndex || 1
      }),
    [trainingDays, executionsByDayIndex, completionDates, effectiveCalendarStartDate, progressDayIndex, instance?.start_execution_day]
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
  const planProgressStats = useMemo(() => {
    if (!instance || trainingDays.length === 0) {
      return { done: 0, total: 0, percent: 0 }
    }
    const planTrainingDays = trainingDays.filter((day) => day.type === 'training')
    const done = planTrainingDays.reduce((sum, day) => {
      const ex = executionsByDayIndex[day.dayIndex]
      return sum + (ex?.status === 'completed' || !!completionDates[day.dayIndex] ? 1 : 0)
    }, 0)
    const total = planTrainingDays.length
    const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
    return { done, total, percent }
  }, [completionDates, executionsByDayIndex, instance, trainingDays])

  const todaySharePayload = useMemo(() => createSharePayload({
    title: '打开 CoachLink 查看今日训练与打卡',
    path: buildSharePath(TODAY_TRAINING_HOME_PATH)
  }), [])
  const todayTimelinePayload = useMemo(
    () =>
      createSharePayload({
        title: '打开 CoachLink 查看今日训练与打卡',
        path: buildSharePath(TODAY_TRAINING_HOME_PATH)
      }),
    []
  )

  useShareAppMessage(() => todaySharePayload)
  useShareTimeline(() => createTimelinePayload(todayTimelinePayload))

  useEffect(() => {
    openCoachLinkShareMenu()
  }, [])

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

  useEffect(() => {
    activeCoachSubscriptionIdRef.current = activeCoachSubscriptionId
  }, [activeCoachSubscriptionId])

  useEffect(() => {
    selectedDayIndexRef.current = selectedDayIndex
  }, [selectedDayIndex])

  useEffect(() => {
    planModeRef.current = planMode
  }, [planMode])

  useEffect(() => {
    patchTodayTrainingPageCache({ planMode, selectedDayIndex })
  }, [planMode, selectedDayIndex])

  const loadData = useCallback(async () => {
    try {
      const session = authService.getAuthSession({ normalize: true })
      if (!session.isAuthenticated || !session.userId) {
        await authService.logout()
        setIsGuestHome(true)
        return
      }
      setIsGuestHome(false)
      const fallbackCache = getTodayTrainingBootFromCache().cache

      const postLoginUrl = await studentOnboardingService.resolvePostLoginUrl({
        loggedInUser: session.user,
        fallbackUrl: TODAY_TRAINING_HOME_PATH
      })
      if (!isStudentTrainingHomeUrl(postLoginUrl)) {
        await Taro.redirectTo({ url: postLoginUrl })
        return
      }

      const subsResponse = await request<{ subscriptions?: any[] }>({
        url: '/api/subscription/coach-subscriptions',
        method: 'POST',
        data: { studentId: session.userId },
        showErrorToast: false
      })

      if (!subsResponse.success) {
        if (isAuthErrorMessage(subsResponse.message)) {
          const currentSession = authService.getAuthSession({ normalize: true })
          if (!currentSession.isAuthenticated) {
            setIsGuestHome(true)
            return
          }
        }

        throw new Error(subsResponse.message || '订阅信息加载失败')
      }

      const activeSubs = (subsResponse.data?.subscriptions || []).filter((item: any) => !!item?.id)
      setCoachSubscriptions(activeSubs)

      const coachPromises = activeSubs.map((item: any) =>
        trainingService
          .getInstanceResult({ subscriptionId: item.id }, { showErrorToast: false })
          .catch((error) => ({
            success: false,
            data: undefined,
            message: error instanceof Error ? error.message : '计划加载失败'
          }))
      )
      const [coachResults, selfResult] = await Promise.all([
        Promise.all(coachPromises),
        trainingService
          .getInstanceResult({ fetchSelf: true }, { showErrorToast: false })
          .catch((error) => ({
            success: false,
            data: undefined,
            message: error instanceof Error ? error.message : '计划加载失败'
          }))
      ])

      const coachPlanData: Record<string, any> = {}
      let planRequestFailed = false
      let restoredCachedPlan = false
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

        if (!result?.success) {
          planRequestFailed = true
          const cachedData = fallbackCache?.coachPlanDataBySubId?.[sub.id]
          if (cachedData) {
            coachPlanData[sub.id] = cachedData
            restoredCachedPlan = restoredCachedPlan || !!cachedData.instance
            continue
          }
        } else if (result.data?.instance) {
          const derived = result.data as any
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

      let storedPreferred = ''
      try {
        storedPreferred = String(Taro.getStorageSync(PREFERRED_COACH_SUB_STORAGE_KEY) || '')
      } catch {
        storedPreferred = ''
      }
      const storedValid = !!(storedPreferred && activeSubs.some((item: any) => item.id === storedPreferred))

      const selectedSubId = activeCoachSubscriptionIdRef.current
      const previousActive = activeSubs.find((item: any) => item.id === selectedSubId)
      const firstWithPlan = activeSubs.find((item: any) => coachPlanData[item.id]?.instance)
      const nextActiveId =
        (storedValid ? storedPreferred : null) ||
        previousActive?.id ||
        firstWithPlan?.id ||
        activeSubs[0]?.id ||
        null
      setActiveCoachSubscriptionId(nextActiveId)

      const logTargetSub = nextActiveId ? activeSubs.find((item: any) => item.id === nextActiveId) : activeSubs[0]
      const logCoach = logTargetSub?.coach
      console.log('[today-training] target coach (coach-subscriptions)', {
        timestamp: Date.now(),
        activeSubscriptionId: nextActiveId,
        subscriptionCoachId: logTargetSub?.coach_id,
        coachRow: logCoach,
        avatar_url_raw: logCoach?.avatar_url ?? null,
        avatar_url_resolved: logCoach?.avatar_url ? resolveAvatarUrl(logCoach.avatar_url) : '',
        subscriptionsPreview: activeSubs.map((s: any) => ({
          subId: s.id,
          coach_id: s.coach_id,
          hasCoachObject: !!s.coach,
          coachName: s.coach?.name,
          avatar_url: s.coach?.avatar_url ?? null
        }))
      })

      const selfRes = selfResult?.success ? selfResult.data : null
      const cachedSelfAvailable = !selfResult?.success && !!fallbackCache
      if (!selfResult?.success) {
        planRequestFailed = true
        restoredCachedPlan = restoredCachedPlan || !!fallbackCache?.selfInstance
      }
      const effectiveSelfRes = cachedSelfAvailable
        ? {
            instance: fallbackCache?.selfInstance ?? null,
            actions: fallbackCache?.selfActions ?? {},
            recommendedDayIndex: fallbackCache?.selfDayIndex ?? 1,
            todayCompleted: fallbackCache?.selfTodayCompleted ?? false,
            completionDates: fallbackCache?.selfCompletionDates ?? {},
            executionsByDayIndex: fallbackCache?.selfExecutionsByDayIndex ?? {},
            missingDays: fallbackCache?.selfMissingDays ?? []
          }
        : selfRes

      if (effectiveSelfRes?.instance) {
        const derived = effectiveSelfRes as any
        setSelfInstance(effectiveSelfRes.instance)
        setSelfActions(effectiveSelfRes.actions || {})
        setSelfDayIndex(derived.recommendedDayIndex ?? derived.nextDayIndex ?? 1)
        setSelfTodayCompleted(!!derived.todayCompleted)
        setSelfCompletionDates(derived.completionDates || {})
        setSelfExecutionsByDayIndex(derived.executionsByDayIndex || {})
        setSelfMissingDays(Array.isArray(derived.missingDays) ? derived.missingDays : [])

        const completedCount = Array.isArray(derived.completedDays) ? derived.completedDays.length : 0
        const totalCount = Number(derived.totalTrainingDays || 0)
        if (totalCount > 0 && completedCount >= totalCount && effectiveSelfRes.instance?.status === 'active') {
          await handleCompletePlan(effectiveSelfRes.instance)
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

      const hasCoachPlan = activeSubs.some((item: any) => coachPlanData[item.id]?.instance)
      const hasSelfPlan = !!effectiveSelfRes?.instance
      // 刷新/回到前台时保留用户最后主动选择的有效计划；只有该计划不存在才回退。
      const persistedPlanMode: PlanMode =
        planModeRef.current === 'self' && hasSelfPlan
          ? 'self'
          : planModeRef.current === 'coach' && hasCoachPlan
            ? 'coach'
            : hasCoachPlan
              ? 'coach'
              : hasSelfPlan
                ? 'self'
                : planModeRef.current
      updatePlanMode(persistedPlanMode)

      const selfDerivedPersist = effectiveSelfRes as any
      persistTodayTrainingPageCache({
        userId: String(session.userId),
        coachSubscriptions: activeSubs,
        coachPlanDataBySubId: coachPlanData,
        activeCoachSubscriptionId: nextActiveId,
        selfInstance: effectiveSelfRes?.instance ?? null,
        selfActions: selfDerivedPersist?.actions ?? {},
        selfDayIndex: effectiveSelfRes?.instance
          ? Number(selfDerivedPersist.recommendedDayIndex ?? selfDerivedPersist.nextDayIndex ?? 1) || 1
          : 1,
        selfTodayCompleted: effectiveSelfRes?.instance ? !!selfDerivedPersist.todayCompleted : false,
        selfCompletionDates: effectiveSelfRes?.instance ? selfDerivedPersist.completionDates || {} : {},
        selfExecutionsByDayIndex: effectiveSelfRes?.instance ? selfDerivedPersist.executionsByDayIndex || {} : {},
        selfMissingDays: effectiveSelfRes?.instance
          ? Array.isArray(selfDerivedPersist.missingDays)
            ? selfDerivedPersist.missingDays
            : []
          : [],
        planMode: persistedPlanMode,
        selectedDayIndex: selectedDayIndexRef.current
      })

      if (planRequestFailed) {
        Taro.showToast({
          title: restoredCachedPlan ? '网络不稳定，已显示上次计划' : '部分计划加载失败，请稍后重试',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('[today-training] load failed', error)
      const fallbackCache = getTodayTrainingBootFromCache().cache
      const hasCachedPlan = !!fallbackCache?.selfInstance || Object.values(fallbackCache?.coachPlanDataBySubId || {})
        .some((item: any) => !!item?.instance)
      Taro.showToast({
        title: hasCachedPlan ? '网络不稳定，已显示上次计划' : '加载失败，请稍后重试',
        icon: 'none'
      })
    }
  }, [handleCompletePlan, updatePlanMode])

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

    if (payload?.instanceId && Number.isFinite(dayIndex) && dayIndex > 0) {
      setReturnConfirmed({ instanceId: String(payload.instanceId), dayIndex, ts })
    }
  }, [])

  useDidShow(() => {
    // 执行页已回写同一份 60 天缓存；返回时先回显，再由云端校正。
    const cached = getTodayTrainingBootFromCache().cache
    if (cached) {
      setCoachPlanDataBySubId(cached.coachPlanDataBySubId || {})
      setSelfExecutionsByDayIndex(cached.selfExecutionsByDayIndex || {})
      setSelfCompletionDates(cached.selfCompletionDates || {})
    }
    void syncCurrentUserProfile()
    void loadData()
    consumeReturnConfirmState()
  })

  useEffect(() => {
    if (planMode !== 'coach') {
      setCoachPickSheetOpen(false)
    }
  }, [planMode])

  useEffect(() => {
    if (!instance || !trainingDays.length) {
      setCalendarExpanded(false)
    }
  }, [instance?.id, trainingDays.length])

  const handleGoToTrainingExecution = useCallback(
    (dayIndex: number, focusAction?: number, options?: { readOnly?: boolean }) => {
      if (!instance?.id) return
      const targetExecution = executionsByDayIndex?.[dayIndex]
      const targetStatus = String(targetExecution?.status || '').toLowerCase()
      const isExecutablePlanDay = canOpenPlanDayForExecution({
        trainingDays,
        progressDayIndex: Number(progressDayIndex),
        targetDayIndex: Number(dayIndex)
      })
      const effectiveReadOnly =
        !!options?.readOnly || targetStatus === 'completed' || !isExecutablePlanDay
      if (!options?.readOnly && !isExecutablePlanDay && targetStatus !== 'completed') {
        Taro.showToast({
          title: `请先完成第${progressDayIndex}天；第${dayIndex}天仅供预览`,
          icon: 'none'
        })
      }
      if (!hasReadExecutionPlanNotice({ instanceId: instance.id, userId: currentUserId })) {
        setPendingExecutionTarget({ dayIndex, focusAction, readOnly: effectiveReadOnly })
        setExecutionNoticeVisible(true)
        return
      }
      const coachId = planMode === 'coach' ? activeSubscription?.coach_id || activeSubscription?.coach?.id : undefined
      const coachName = planMode === 'coach' ? activeSubscription?.coach?.name || '' : ''
      const coachQuery = coachId
        ? `&coachId=${encodeURIComponent(coachId)}${coachName ? `&coachName=${encodeURIComponent(coachName)}` : ''}`
        : ''
      const focusQuery = typeof focusAction === 'number' ? `&focusAction=${focusAction}` : ''
      // Always make the intended mode explicit. An editable current day must
      // actively overwrite any readOnly=1 left by a previous preview/history
      // route in the mini-program's local fallback cache.
      const readOnlyQuery = `&readOnly=${effectiveReadOnly ? '1' : '0'}`
      try {
        if (currentUserId) {
          const scopeKey = trainingExecutionSnapshotKey({
            isImpromptuMode: false,
            instanceId: instance.id,
            dayIndex
          })
          const existingExecution = executionsByDayIndex?.[dayIndex]
          const snapshotExecution = Array.isArray(existingExecution?.action_executions)
            ? existingExecution
            : buildPlanExecutionPreview(instance, actions, dayIndex)
          persistTrainingExecutionSnapshot(currentUserId, scopeKey, {
            execution: snapshotExecution,
            planInstance: instance,
            actions
          })
        }
      } catch (error) {
        console.warn('[today-training] prewarm execution snapshot failed', error)
      }
      Taro.navigateTo({
        url: `/training/training-execution?instanceId=${instance.id}&dayIndex=${dayIndex}${coachQuery}${focusQuery}${readOnlyQuery}`
      })
    },
    [actions, activeSubscription, currentUserId, executionsByDayIndex, instance, planMode, progressDayIndex, trainingDays]
  )

  const handleConfirmExecutionNotice = useCallback(() => {
    if (!instance?.id || !pendingExecutionTarget) return

    markExecutionPlanNoticeRead({
      instanceId: instance.id,
      userId: currentUserId
    })

    const target = pendingExecutionTarget
    setExecutionNoticeVisible(false)
    setPendingExecutionTarget(null)
    handleGoToTrainingExecution(target.dayIndex, target.focusAction, { readOnly: target.readOnly })
  }, [currentUserId, handleGoToTrainingExecution, instance?.id, pendingExecutionTarget])

  const handleCancelExecutionNotice = useCallback(() => {
    setExecutionNoticeVisible(false)
    setPendingExecutionTarget(null)
  }, [])

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
    void openCoachChat({
      currentUserId,
      coachId,
      coachUserId: activeSubscription?.coach?.user_id,
      coachName,
      fallbackToMessagesList: true
    })
  }, [activeSubscription, currentUserId])

  /** 多订阅切换：同步进度日与教练计划模式，避免沿用上一位教练的 dayIndex */
  const handleSelectCoachSubscription = useCallback(
    (subId: string) => {
      if (!subId) return
      try {
        Taro.setStorageSync(PREFERRED_COACH_SUB_STORAGE_KEY, subId)
      } catch (e) {
        console.warn('[today-training] persist preferred coach sub failed', e)
      }
      updatePlanMode('coach')
      setActiveCoachSubscriptionId(subId)
      const pd = coachPlanDataBySubId[subId]
      const raw = Number(pd?.dayIndex ?? 1)
      let nextDay = Number.isFinite(raw) && raw > 0 ? raw : 1
      const days = (pd?.instance?.training_days || []) as any[]
      if (days.length > 0) {
        const maxDay = Math.max(...days.map((d) => Number(d?.dayIndex || 0)).filter((n) => n > 0))
        if (Number.isFinite(maxDay) && maxDay > 0 && nextDay > maxDay) nextDay = maxDay
      }
      setSelectedDayIndex(nextDay)
    },
    [coachPlanDataBySubId, updatePlanMode]
  )

  const handleGoToPlanLib = useCallback(() => {
    Taro.navigateTo({ url: '/me/plan-lib/index' })
  }, [])

  /** 主行动：进入当前进度日训练执行（与原「开始训练」快捷入口一致） */
  const handleMegaStart = useCallback(() => {
    const targetDayIndex = selectedDayIndex || todayCompletedDayIndex || progressDayIndex
    handleGoToTrainingExecution(targetDayIndex, undefined, { readOnly: selectedExecutionStatus === 'completed' })
  }, [
    handleGoToTrainingExecution,
    progressDayIndex,
    selectedDayIndex,
    selectedExecutionStatus,
    todayCompletedDayIndex
  ])

  const handleImpromptu = useCallback(() => {
    Taro.navigateTo({ url: '/me/action-lib/index?mode=impromptu-select&source=frequent&itemType=STRENGTH' })
  }, [])

  const handleFindCoach = useCallback(() => {
    Taro.navigateTo({ url: '/discovery/index' })
  }, [])

  const handleGuestLogin = useCallback(() => {
    Taro.navigateTo({ url: authService.buildLoginUrl(TODAY_TRAINING_HOME_PATH) })
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
            updatePlanMode('coach')
          }

          Taro.showToast({ title: '已移除自建计划', icon: 'success' })
          await loadData()
        } catch (error) {
          console.error('[today-training] remove self plan failed', error)
          Taro.showToast({ title: '移除失败，请稍后重试', icon: 'none' })
        }
      }
    })
  }, [coachInstance, loadData, selfInstance?.id, updatePlanMode])

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

  const syncSelectedExecutionLocally = useCallback(
    (nextExecution: any) => {
      if (!instance?.id || !selectedDayIndex || !nextExecution) return

      if (planMode === 'self') {
        setSelfExecutionsByDayIndex((previous) => ({ ...previous, [selectedDayIndex]: nextExecution }))
      } else {
        setCoachPlanDataBySubId((previous) => {
          const subscriptionId = Object.keys(previous).find(
            (key) => previous[key]?.instance?.id === instance.id
          )
          if (!subscriptionId) return previous
          const block = previous[subscriptionId]
          return {
            ...previous,
            [subscriptionId]: {
              ...block,
              executionsByDayIndex: {
                ...(block.executionsByDayIndex || {}),
                [selectedDayIndex]: nextExecution
              }
            }
          }
        })
      }

      const scopeKey = trainingExecutionSnapshotKey({
        isImpromptuMode: false,
        instanceId: instance.id,
        dayIndex: selectedDayIndex
      })
      if (currentUserId && scopeKey) {
        syncTrainingExecutionToStorage({
          userId: currentUserId,
          scopeKey,
          instanceId: instance.id,
          dayIndex: selectedDayIndex,
          isImpromptuMode: false,
          execution: nextExecution,
          planInstance: instance,
          actions
        })
      }
    },
    [actions, currentUserId, instance, planMode, selectedDayIndex]
  )

  const handleDeleteLightweightTask = useCallback(
    (task: NormalizedDayTask) => {
      const executionId = selectedExec?.id
      if (!executionId || !task.isStudentExtra) return
      if (lightweightDeletionRef.current) {
        Taro.showToast({ title: '正在删除，请稍候', icon: 'none' })
        return
      }
      Taro.showModal({
        title: '删除轻任务',
        content: `确认删除轻任务「${task.title}」吗？`,
        success: async (res) => {
          if (!res.confirm) return
          const previousExecution = selectedExec
          const optimisticExecution = removeActionFromExecution(previousExecution, task.executionIndex)
          if (!optimisticExecution) {
            Taro.showToast({ title: '任务已刷新，请重试', icon: 'none' })
            return
          }

          lightweightDeletionRef.current = true
          try {
            // 先更新本地页面与缓存；服务端失败时在 catch 中完整回滚。
            syncSelectedExecutionLocally(optimisticExecution)
            const deleteRes = await executionService.deleteExtraExercise(executionId, task.executionIndex)
            if (!deleteRes) throw new Error('删除失败')
            Taro.showToast({ title: '已删除', icon: 'success' })
          } catch (error) {
            syncSelectedExecutionLocally(previousExecution)
            console.error('[today-training] delete lightweight task failed', error)
            Taro.showToast({ title: '删除失败，请稍后重试', icon: 'none' })
          } finally {
            lightweightDeletionRef.current = false
          }
        }
      })
    },
    [selectedExec, syncSelectedExecutionLocally]
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
        try {
          const saved = await executionService.getExecution(executionId)
          if (saved) syncSelectedExecutionLocally({ ...saved, day_index: saved.day_index ?? saved.dayIndex ?? selectedDayIndex })
        } catch (error) {
          console.warn('[today-training] refresh completed task snapshot failed', error)
        }
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
    [activeLightweightTask, instance?.id, loadData, selectedDayIndex, selectedExec?.id, syncSelectedExecutionLocally]
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

  const renderCoachPickSheet = () => (
    <Popup visible={coachPickSheetOpen} position='bottom' round onClose={() => setCoachPickSheetOpen(false)}>
      <View className='compact-training-sheet'>
        <Text className='compact-sheet-title'>选择计划</Text>
        <ScrollView scrollY className='compact-plan-options'
          style={{ height: `${Math.min(560, (coachSubscriptions.length + (selfInstance ? 1 : 0)) * 144)}rpx` }}>
          {coachSubscriptions.map((sub: any) => {
            const data = coachPlanDataBySubId[sub.id]
            const selected = planMode === 'coach' && activeCoachSubscriptionId === sub.id
            const completed = findTodayCompletedDayIndex(data?.executionsByDayIndex)
            const nextDay = data?.instance?.training_days?.find((day: any) => day.dayIndex === data.dayIndex)
            const status = !data?.instance ? '待制定' : completed ? '今日已完成' : nextDay?.type === 'rest' ? '休息日' : '待训练'
            return (
              <View key={sub.id} className='compact-plan-option' onClick={() => {
                handleSelectCoachSubscription(sub.id)
                setCoachPickSheetOpen(false)
              }}>
                <View className='compact-plan-option-copy'>
                  <Text className='compact-plan-option-title'>{sub.coach?.name || '教练'}的计划</Text>
                  <Text className='compact-plan-option-meta'>{data?.instance?.name || '计划待制定'} · {status}</Text>
                </View>
                {selected && <Check size={20} color='#CF6D4E' />}
              </View>
            )
          })}
          {!!selfInstance && (
            <View className='compact-plan-option' onClick={() => {
              updatePlanMode('self')
              setCoachPickSheetOpen(false)
            }}>
              <View className='compact-plan-option-copy'>
                <Text className='compact-plan-option-title'>我的计划</Text>
                <Text className='compact-plan-option-meta'>{selfInstance.name}</Text>
              </View>
              {planMode === 'self' && <Check size={20} color='#CF6D4E' />}
            </View>
          )}
        </ScrollView>
      </View>
    </Popup>
  )

  const renderMoreTrainingPopup = () => (
    <Popup visible={moreTrainingOpen} position='bottom' round onClose={() => setMoreTrainingOpen(false)}>
      <View className='compact-training-sheet'>
        <Text className='compact-sheet-title'>更多</Text>
        {instance?.id && selectedDay?.type === 'training' && (
          <View className='compact-menu-row' onClick={() => {
            setMoreTrainingOpen(false)
            setRecordCompletionOpen(true)
          }}><Text>{selectedExecutionStatus === 'completed' ? '核对训练日期' : '补记训练'}</Text><ArrowRight size={16} /></View>
        )}
        <View className='compact-menu-row' onClick={() => { setMoreTrainingOpen(false); handleImpromptu() }}>
          <Text>即兴锻炼</Text><ArrowRight size={16} />
        </View>
        {!!instance && selectedDay && (
          <View className='compact-menu-row' onClick={() => { setMoreTrainingOpen(false); handleOpenLightweightPicker() }}>
            <Text>添加任务</Text><ArrowRight size={16} />
          </View>
        )}
        {planMode === 'coach' && activeSubscription?.id && (
          <View className='compact-menu-row' onClick={() => { setMoreTrainingOpen(false); handleContactCoach() }}>
            <Text>联系教练</Text><ArrowRight size={16} />
          </View>
        )}
        <View className='compact-menu-row' onClick={() => { setMoreTrainingOpen(false); handleGoToPlanLib() }}>
          <Text>我的计划库</Text><ArrowRight size={16} />
        </View>
        <View className='compact-menu-row' onClick={() => { setMoreTrainingOpen(false); setShowExplainDialog(true) }}>
          <Text>训练记录说明</Text><ArrowRight size={16} />
        </View>
      </View>
    </Popup>
  )

  const renderGuestHome = () => (
    <PageThemeRoot>
      <View className={`today-training-page main-home-page compact-training-home theme-${effectiveTheme}`}>
        <ScrollView className='page-scroll' scrollY>
          <View className='page-content'>
            <View className='compact-context-row'><Text className='compact-date-text'>{formatPlanDayLabel(new Date())}</Text></View>
            <View className='compact-empty-state'>
              <Text className='compact-empty-title'>今天想怎么练？</Text>
              <View className='compact-primary-button' onClick={handleGuestLogin}><Text>即兴锻炼</Text></View>
              <View className='compact-secondary-button' onClick={handleFindCoach}><Text>找教练</Text></View>
              <Text className='compact-empty-hint'>开始记录训练时登录，同步你的训练记录。</Text>
            </View>
          </View>
        </ScrollView>
        <BottomNav />
      </View>
    </PageThemeRoot>
  )

  const graceDaysLeft = Math.max(0, Number(activeSubscription?.grace_days_left || 0))
  const graceDeadlineLabel = formatShortDate(activeSubscription?.grace_deadline_at)
  if (isGuestHome) return renderGuestHome()

  const waitingCoachPage = planMode === 'coach' && !coachInstance && activeSubscription?.id
  const enableScheduleMonthExpand = !!instance && trainingDays.length > 0 && !waitingCoachPage

  const currentPlanLabel = planMode === 'self'
    ? '我的计划'
    : activeSubscription?.coach?.name ? `${activeSubscription.coach.name}的计划` : '教练计划'
  const hasPlanChoices = coachSubscriptions.length + (selfInstance ? 1 : 0) > 1
  const hasStrength = selectedModuleModel.strengthTasks.length > 0
  const selectedTrainingCompleted = selectedExecutionStatus === 'completed'
  const primaryLabel = selectedTrainingCompleted ? '查看训练记录'
    : selectedExecutionStatus === 'in_progress' ? '继续训练'
    : hasStrength ? '开始训练' : '查看任务'

  return (
    <PageThemeRoot>
    <View className={`today-training-page main-home-page compact-training-home theme-${effectiveTheme}`}>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          <View className='compact-context-row'>
            <View className='compact-context-control' onClick={() => enableScheduleMonthExpand && setCalendarExpanded(true)}>
              <Calendar size={18} />
              <Text className='compact-date-text'>{instance ? selectedDateLabel : formatPlanDayLabel(new Date())}</Text>
              {enableScheduleMonthExpand && <ArrowRight size={14} className='compact-down-arrow' />}
            </View>
            {(instance || coachSubscriptions.length > 0) && (
              <View className='compact-plan-control' onClick={() => hasPlanChoices && setCoachPickSheetOpen(true)}>
                <Text>{currentPlanLabel}</Text>
                {hasPlanChoices && <ArrowRight size={14} className='compact-down-arrow' />}
              </View>
            )}
          </View>
          {!instance ? (
            <View className='compact-empty-state'>
              <Text className='compact-empty-title'>{waitingCoachPage ? '教练正在制定计划' : '今天想怎么练？'}</Text>
              <View className='compact-primary-button' onClick={handleImpromptu}><Text>即兴锻炼</Text></View>
              <View className='compact-secondary-button' onClick={waitingCoachPage ? handleContactCoach : handleFindCoach}>
                <Text>{waitingCoachPage ? '联系教练' : '找教练'}</Text>
              </View>
              <View className='compact-menu-link' onClick={() => setMoreTrainingOpen(true)}><Text>更多</Text></View>
            </View>
          ) : (
            <>
              <View className='compact-summary-row'>
                <Text className={selectedTrainingCompleted ? 'compact-completed-text' : 'compact-summary-text'}>
                  {selectedTrainingCompleted ? '本次训练已完成'
                    : selectedDay?.type === 'rest' ? `第${selectedDayIndex}天 · 休息日`
                    : `第${selectedDayIndex}天 · ${selectedModuleModel.strengthTasks.length}个动作 · ${selectedModuleModel.strengthTotalSetCount}组`}
                </Text>
                <View className='compact-more-button' onClick={() => setMoreTrainingOpen(true)}><Text>···</Text></View>
              </View>
              {isExpiredGrace && planMode === 'coach' && (
                <View className='compact-notice' onClick={() => Taro.navigateTo({ url: renewPath })}>
                  <Text>{WECHAT_COACH_PURCHASE_PAUSED ? '查看教练服务状态' : `服务宽限期剩余${graceDaysLeft}天，查看续费`}{graceDeadlineLabel ? ` · ${graceDeadlineLabel}` : ''}</Text>
                </View>
              )}
              {selectedDay && selectedTaskSummary.totalModules > 0 ? (
                <>
                  <TodayTrainingCard key={`${instance.id}-${selectedDayIndex}`} compact
                    day={selectedDay} actions={actions} instanceId={instance.id} dayIndex={selectedDayIndex}
                    executionStatus={selectedExecutionStatus} execution={selectedExec}
                    onOpenLightweightTask={handleOpenLightweightTask} onDeleteLightweightTask={handleDeleteLightweightTask}
                    onOpenExecution={handleGoToTrainingExecution} />
                  {(hasStrength || selectedExecutionStatus !== 'none' || selectedTaskSummary.lightweightCount > 0) && (
                    <View className='compact-primary-button' onClick={() => {
                      if (hasStrength || selectedExecutionStatus !== 'none') { handleMegaStart(); return }
                      const task = selectedModuleModel.lightweightTasks.find((item) => !item.isCompleted) || selectedModuleModel.lightweightTasks[0]
                      if (task) handleOpenLightweightTask(task)
                    }}><Text>{primaryLabel}</Text></View>
                  )}
                </>
              ) : (
                <View className='compact-empty-state'>
                  <Text className='compact-empty-hint'>{selectedDay?.type === 'rest' ? '今天没有其他任务，好好休息。' : '这一天暂无训练安排。'}</Text>
                  <View className='compact-secondary-button' onClick={handleImpromptu}><Text>即兴锻炼</Text></View>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
      {renderMoreTrainingPopup()}
      {renderCoachPickSheet()}
      <Popup visible={calendarExpanded} position='bottom' round onClose={() => setCalendarExpanded(false)}>
        <View className='compact-training-sheet'>
          <Text className='compact-sheet-title'>训练日历</Text>
          <Text className='compact-calendar-progress'>计划已完成 {planProgressStats.done}/{planProgressStats.total} 个训练日 · {planProgressStats.percent}%</Text>
          <ScrollView scrollY className='compact-calendar-scroll'>
            <ScheduleCalendarPanel trainingDays={trainingDays} currentDayIndex={todayDayIndex}
              selectedDayIndex={selectedDayIndex} completionDates={completionDates} executionsByDayIndex={executionsByDayIndex}
              scheduleModel={scheduleModel} todayCompleted={effectiveTodayCompleted} progressDayIndex={progressDayIndex}
              planStartDate={effectiveCalendarStartDate || undefined} startExecutionDay={instance?.start_execution_day || 1}
              onSelectedDayChange={(dayIndex) => { setSelectedDayIndex(dayIndex); setCalendarExpanded(false) }} monthOnly showMonthGrid />
            {missingDays.map((dayIndex) => (
              <View className='compact-missing-day' key={dayIndex}>
                <Text>第{dayIndex}天未确认</Text>
                <Text className='compact-task-action' onClick={() => { setCalendarExpanded(false); handleGoToTrainingExecution(dayIndex) }}>补练</Text>
                <Text className='compact-task-action' onClick={() => handleSkipDay(dayIndex)}>跳过</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Popup>
      {instance?.id && selectedDay?.type === 'training' && (
        <RecordCompletionButton instanceId={instance.id} dayIndex={selectedDayIndex} execution={selectedExec}
          open={recordCompletionOpen} hideTrigger onClose={() => setRecordCompletionOpen(false)}
          earliestDate={instance.start_date || instance.created_at}
          onSaved={async saved => {
            const savedDayIndex = Number(saved.day_index ?? saved.dayIndex ?? selectedDayIndex)
            syncSelectedExecutionLocally({ ...saved, day_index: savedDayIndex })
            setReturnConfirmed({ instanceId: instance.id, dayIndex: savedDayIndex, ts: Date.now() })
            await loadData()
            setSelectedDayIndex(savedDayIndex)
          }} />
      )}
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

      <ExecutionPlanNoticePopup
        visible={executionNoticeVisible}
        executionNotice={(instance as any)?.execution_notice || (instance as any)?.executionNotice || null}
        planName={instance?.name || null}
        planSource={planMode === 'self' || instance?.source === 'self' ? 'self' : 'coach'}
        onConfirm={handleConfirmExecutionNotice}
        onClose={handleCancelExecutionNotice}
        confirmLabel='我已阅读，进入训练'
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
            <View className='completion-modal-icon'>
              <Text className='iconfont icon-star completion-modal-icon-star' />
            </View>
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
    </PageThemeRoot>
  )
}

export default TodayTrainingScreen
