import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Image, ScrollView, Textarea } from '@tarojs/components'
import { StableInput as Input } from '@/components/StableInput'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { authService } from '@/services/authService'
import { trainingService, PlanInstance } from '@/services/trainingService'
import { executionService } from '@/services/executionService'
import { studentActionLibService } from '@/services/studentActionLibService'
import { studentOnboardingService } from '@/services/studentOnboardingService'
import { request, API_BASE_URL } from '@/utils/request'
import { formatMonthDaySlash } from '@/utils/dateFormat'
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
  Target,
  User
} from '@nutui/icons-react-taro'
import { Popup } from '@nutui/nutui-react-taro'
import {
  buildPlanScheduleModel,
  buildDayModuleModel,
  formatPlanDayLabel,
  resolvePlanDayDate,
  toDateKey,
  type NormalizedDayTask,
  type PlanScheduleModel
} from './lib/dayModules'
import WeekDashboardStrip, { buildWeekStripCells, getSundayWeekStart } from './components/WeekDashboardStrip'
import type { WeekStripCell } from './components/WeekDashboardStrip'
import { getDayWeekNumber, isDayUnlocked } from '@/utils/weekUnlock'
import { LoadingSpinner } from '@/components/LoadingSpinner'
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
  trainingExecutionSnapshotKey
} from '@/utils/trainingExecutionCache'
import { formatKgValueForGym } from '@/utils/weightQuantize'
import './index.scss'

type PlanMode = 'coach' | 'self'
type ExecutionStatus = 'none' | 'in_progress' | 'completed'
type GreetingModel = {
  label: '早上好' | '中午好' | '晚上好'
  iconClass: 'icon-zaoshang' | 'icon-zhongwu' | 'icon-wanshang'
}
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

function getLocalGreetingModel(date = new Date()): GreetingModel {
  const hour = date.getHours()
  if (hour >= 5 && hour < 11) {
    return { label: '早上好', iconClass: 'icon-zaoshang' }
  }
  if (hour >= 11 && hour < 18) {
    return { label: '中午好', iconClass: 'icon-zhongwu' }
  }
  return { label: '晚上好', iconClass: 'icon-wanshang' }
}

function resolveStudentDisplayName(user: any) {
  const candidates = [
    user?.nickname,
    user?.real_name,
    user?.name,
    user?.profile?.nickname,
    user?.user_profile?.nickname,
    user?.user_profiles?.nickname
  ]

  for (const candidate of candidates) {
    const value = String(candidate || '').trim()
    if (value) return value
  }

  return 'CoachLink 学员'
}

/** 小程序 Image 需要可访问的绝对 URL；后端若返回相对路径则拼 API 根 */
function resolveCoachAvatarUrl(raw: string | null | undefined): string {
  const s = raw != null ? String(raw).trim() : ''
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  const base = String(API_BASE_URL || '').replace(/\/$/, '')
  const path = s.startsWith('/') ? s : `/${s}`
  return base ? `${base}${path}` : s
}

const startCalendarDay = (d: Date | string) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const addCalendarDays = (d: Date | string, days: number) => {
  const x = startCalendarDay(d)
  x.setDate(x.getDate() + days)
  return x
}

function findTodayCompletedDayIndex(executionsByDayIndex?: Record<number, any>) {
  const todayStart = startCalendarDay(new Date())
  const tomorrowStart = addCalendarDays(todayStart, 1)

  const matched = Object.entries(executionsByDayIndex || {})
    .map(([key, execution]) => {
      const dayIndex = Number(execution?.day_index ?? key)
      const completedAt = execution?.completed_at
      if (!Number.isFinite(dayIndex) || dayIndex <= 0) return null
      if (String(execution?.status || '').toLowerCase() !== 'completed' || !completedAt) return null

      const completedDate = new Date(completedAt)
      const completedTime = completedDate.getTime()
      if (!Number.isFinite(completedTime)) return null
      if (completedDate < todayStart || completedDate >= tomorrowStart) return null

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
    const params = item?.params || {}
    const rawSetCount = Number(params['组数'] ?? item?.sets ?? 1)
    const setCount = Number.isFinite(rawSetCount) && rawSetCount > 0 ? Math.max(1, Math.floor(rawSetCount)) : 1

    let plannedWeight = ''
    const loadValue = parsePlanNumber(params?.load)
    if (loadValue !== null) {
      if (loadValue < 0) {
        plannedWeight = `辅助${formatKgValueForGym(Math.abs(loadValue))}kg`
      } else if (loadValue > 0) {
        plannedWeight = `${formatKgValueForGym(loadValue)}kg`
      }
    }

    if (!plannedWeight) {
      const intensity = parsePlanNumber(params?.['强度'] ?? item?.intensity)
      if (intensity !== null && intensity > 0) {
        plannedWeight = `${String(intensity).replace(/\.0+$/, '')}RM`
      }
    }

    const plannedReps = String(params?.['次数'] ?? item?.reps ?? '').trim()
    const restSeconds = parsePlanNumber(params?.['休息时间'] ?? params?.rest_seconds ?? item?.rest_seconds)
    const sets = Array.from({ length: setCount }).map((_, setIdx) => ({
      set_number: setIdx + 1,
      status: 'pending',
      planned_weight: plannedWeight,
      planned_reps: plannedReps,
      planned_rest_seconds: restSeconds ?? undefined
    }))

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
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [completedPlanInfo, setCompletedPlanInfo] = useState<{ name: string; rate: number } | null>(null)
  const [showExplainDialog, setShowExplainDialog] = useState(false)
  const [selectedDayIndex, setSelectedDayIndex] = useState(initialSelectedDayIndex)
  const selectedDayIndexRef = useRef<number>(initialSelectedDayIndex)
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
  const [moreTrainingOpen, setMoreTrainingOpen] = useState(false)
  const [coachPickSheetOpen, setCoachPickSheetOpen] = useState(false)
  const [calendarExpanded, setCalendarExpanded] = useState(false)
  const [cloudSyncing, setCloudSyncing] = useState(false)
  const [scheduleScrollIntoView, setScheduleScrollIntoView] = useState('')
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

  const [greetingModel, setGreetingModel] = useState<GreetingModel>(() => getLocalGreetingModel())

  const userDisplayName = useMemo(() => {
    const user = authService.getAuthSession({ normalize: true }).user
    return resolveStudentDisplayName(user)
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
  const effectiveTodayCompleted = todayCompleted || !!todayCompletedDayIndex
  const defaultSelectedDayIndex = todayCompletedDayIndex || progressDayIndex || 1

  useEffect(() => {
    if (!instance?.id) return
    setSelectedDayIndex(defaultSelectedDayIndex)
  }, [defaultSelectedDayIndex, instance?.id])

  useEffect(() => {
    const refreshGreeting = () => setGreetingModel(getLocalGreetingModel())
    const timer = setInterval(refreshGreeting, 60 * 1000)
    return () => clearInterval(timer)
  }, [])

  const selectedDay = trainingDays.find((day) => day.dayIndex === selectedDayIndex) || progressDay || trainingDays[0]
  const selectedIsTodayCompletedTraining =
    !!todayCompletedDayIndex && selectedDayIndex === todayCompletedDayIndex && selectedDay?.type === 'training'
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
        startExecutionDay: Number(instance?.start_execution_day || 1),
        fallbackAnchorDayIndex: progressDayIndex || 1
      }),
    [trainingDays, executionsByDayIndex, effectiveCalendarStartDate, progressDayIndex, instance?.start_execution_day]
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

  const unlockedWeekForStrip = useMemo(() => {
    if (!instance) return 999
    const byStart = getDayWeekNumber(Number(instance?.start_execution_day || 1))
    const byProgress = getDayWeekNumber(Number(progressDayIndex || todayDayIndex || 1))
    // Visibility follows the student's real sequential progress: show the
    // current logical week plus the next week. Calendar time must not unlock
    // extra weeks while a training day is postponed.
    return Math.max(byStart, byProgress) + 1
  }, [instance, progressDayIndex, todayDayIndex])

  const weekStripCells = useMemo(
    () =>
      buildWeekStripCells({
        trainingDays,
        scheduleModel,
        planStartDate: effectiveCalendarStartDate,
        progressDayIndex,
        currentDayIndex: todayDayIndex,
        executionsByDayIndex,
        completionDates,
        startExecutionDay: instance?.start_execution_day || 1,
        unlockedWeek: instance ? unlockedWeekForStrip : 999
      }),
    [
      trainingDays,
      scheduleModel,
      effectiveCalendarStartDate,
      progressDayIndex,
      todayDayIndex,
      executionsByDayIndex,
      completionDates,
      instance?.start_execution_day,
      unlockedWeekForStrip,
      instance
    ]
  )

  const stripSelectedDateKey = useMemo(() => {
    const today = startCalendarDay(new Date())
    if (!instance || trainingDays.length === 0) {
      return toDateKey(today)
    }
    const sch = scheduleModel.scheduleByDayIndex.get(selectedDayIndex)
    if (sch?.displayDate) return toDateKey(startCalendarDay(sch.displayDate))
    const d = resolvePlanDayDate({
      dayIndex: selectedDayIndex,
      effectiveStartDate: effectiveCalendarStartDate,
      fallbackAnchorDayIndex: progressDayIndex || 1
    })
    return toDateKey(startCalendarDay(d))
  }, [
    instance,
    trainingDays.length,
    scheduleModel,
    selectedDayIndex,
    effectiveCalendarStartDate,
    progressDayIndex
  ])

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
      nickname: resolveStudentDisplayName(user),
      completedAt: selectedExec?.completed_at || null,
      dayIndex: selectedDayIndex,
      moduleCount: selectedTaskSummary.totalModules,
      completedModuleCount: selectedTaskSummary.completedModules,
      lightweightCompletedCount: selectedModuleModel.lightweightCompletedCount,
      lightweightTotalCount: selectedModuleModel.lightweightTasks.length,
      trainingCompleted: selectedTaskSummary.trainingCompleted,
      strengthTaskCount: selectedModuleModel.strengthTasks.length,
      strengthCompletedSetCount: selectedModuleModel.strengthCompletedSetCount,
      strengthTotalSetCount: selectedModuleModel.strengthTotalSetCount,
      strengthItems: selectedModuleModel.strengthTasks.slice(0, 4).map((task) => ({
        title: task.title,
        completedSetCount: task.completedSetCount,
        setCount: task.setCount
      })),
      lightweightItems: selectedModuleModel.lightweightTasks.slice(0, 5).map((task) => ({
        title: task.title,
        type: task.itemType,
        isCompleted: task.isCompleted
      }))
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
        : buildSharePath(TODAY_TRAINING_HOME_PATH)
    })
  }, [daySharePath, dayShareVisible, instance?.name, selectedDayIndex])
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
    setCloudSyncing(true)
    try {
      const session = authService.getAuthSession({ normalize: true })
      if (!session.isAuthenticated || !session.userId) {
        await authService.logout()
        setIsGuestHome(true)
        return
      }
      setIsGuestHome(false)

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
          await authService.logout()
          setIsGuestHome(true)
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
        avatar_url_resolved: logCoach?.avatar_url ? resolveCoachAvatarUrl(logCoach.avatar_url) : '',
        subscriptionsPreview: activeSubs.map((s: any) => ({
          subId: s.id,
          coach_id: s.coach_id,
          hasCoachObject: !!s.coach,
          coachName: s.coach?.name,
          avatar_url: s.coach?.avatar_url ?? null
        }))
      })

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

      if (activeSubs.some((item: any) => coachPlanData[item.id]?.instance)) {
        setPlanMode('coach')
      } else if (selfRes?.instance) {
        setPlanMode('self')
      }

      const persistedPlanMode: PlanMode = activeSubs.some((item: any) => coachPlanData[item.id]?.instance)
        ? 'coach'
        : selfRes?.instance
          ? 'self'
          : planModeRef.current

      const selfDerivedPersist = selfRes as any
      persistTodayTrainingPageCache({
        userId: String(session.userId),
        coachSubscriptions: activeSubs,
        coachPlanDataBySubId: coachPlanData,
        activeCoachSubscriptionId: nextActiveId,
        selfInstance: selfRes?.instance ?? null,
        selfActions: selfDerivedPersist?.actions ?? {},
        selfDayIndex: selfRes?.instance
          ? Number(selfDerivedPersist.recommendedDayIndex ?? selfDerivedPersist.nextDayIndex ?? 1) || 1
          : 1,
        selfTodayCompleted: selfRes?.instance ? !!selfDerivedPersist.todayCompleted : false,
        selfCompletionDates: selfRes?.instance ? selfDerivedPersist.completionDates || {} : {},
        selfExecutionsByDayIndex: selfRes?.instance ? selfDerivedPersist.executionsByDayIndex || {} : {},
        selfMissingDays: selfRes?.instance
          ? Array.isArray(selfDerivedPersist.missingDays)
            ? selfDerivedPersist.missingDays
            : []
          : [],
        planMode: persistedPlanMode,
        selectedDayIndex: selectedDayIndexRef.current
      })
    } catch (error) {
      console.error('[today-training] load failed', error)
      Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
    } finally {
      setCloudSyncing(false)
    }
  }, [handleCompletePlan])

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
    setGreetingModel(getLocalGreetingModel())
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
      const isStrictCurrentDay = Number(dayIndex) === Number(progressDayIndex)
      const effectiveReadOnly =
        !!options?.readOnly || targetStatus === 'completed' || !isStrictCurrentDay
      if (!options?.readOnly && !isStrictCurrentDay && targetStatus !== 'completed') {
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
      const coachId = activeSubscription?.coach_id || activeSubscription?.coach?.id
      const coachName = activeSubscription?.coach?.name || ''
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
    [actions, activeSubscription, currentUserId, executionsByDayIndex, instance, progressDayIndex]
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

  const scrollToScheduleCalendar = useCallback(() => {
    setScheduleScrollIntoView('schedule-calendar-anchor')
    setTimeout(() => setScheduleScrollIntoView(''), 480)
  }, [])

  const handleWeekStripCell = useCallback(
    (cell: WeekStripCell) => {
      if (!instance) {
        Taro.showToast({ title: '暂无训练计划', icon: 'none' })
        return
      }
      if (cell.planDayIndex == null) {
        Taro.showToast({ title: '这一天不在当前计划内', icon: 'none' })
        setCalendarExpanded(true)
        scrollToScheduleCalendar()
        return
      }
      if (!isDayUnlocked(cell.planDayIndex, unlockedWeekForStrip)) {
        Taro.showToast({ title: '该日尚未解锁', icon: 'none' })
        return
      }
      setSelectedDayIndex(cell.planDayIndex)
    },
    [instance, scrollToScheduleCalendar, unlockedWeekForStrip]
  )

  /** 多订阅切换：同步进度日与教练计划模式，避免沿用上一位教练的 dayIndex */
  const handleSelectCoachSubscription = useCallback(
    (subId: string) => {
      if (!subId) return
      try {
        Taro.setStorageSync(PREFERRED_COACH_SUB_STORAGE_KEY, subId)
      } catch (e) {
        console.warn('[today-training] persist preferred coach sub failed', e)
      }
      setPlanMode('coach')
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
    [coachPlanDataBySubId]
  )

  const handleGoToPlanLib = useCallback(() => {
    Taro.navigateTo({ url: '/me/plan-lib/index' })
  }, [])

  const handleDiscoverCoach = useCallback(() => {
    Taro.navigateTo({ url: '/discovery/index' })
  }, [])

  /** 主行动：进入当前进度日训练执行（与原「开始训练」快捷入口一致） */
  const handleMegaStart = useCallback(() => {
    const targetDayIndex = selectedTaskSummary.dayCompleted
      ? selectedDayIndex
      : selectedDayIndex || todayCompletedDayIndex || progressDayIndex
    handleGoToTrainingExecution(targetDayIndex, undefined, { readOnly: selectedTaskSummary.dayCompleted })
  }, [
    handleGoToTrainingExecution,
    progressDayIndex,
    selectedDayIndex,
    selectedTaskSummary.dayCompleted,
    todayCompletedDayIndex
  ])

  const handleImpromptu = useCallback(() => {
    Taro.navigateTo({ url: '/training/impromptu-training' })
  }, [])

  const handleFindCoach = useCallback(() => {
    Taro.navigateTo({ url: '/discovery/index' })
  }, [])

  const handleGuestLogin = useCallback(() => {
    Taro.navigateTo({ url: authService.buildLoginUrl(TODAY_TRAINING_HOME_PATH) })
  }, [])

  const handleGuestKnowledge = useCallback(() => {
    Taro.navigateTo({ url: '/content/knowledge' })
  }, [])

  const handleGuestCalculator = useCallback(() => {
    Taro.navigateTo({ url: '/streetlifting/index/calculator' })
  }, [])

  const handleGuestPowerAnalysis = useCallback(() => {
    Taro.navigateTo({ url: '/toolbox/power-analysis/index' })
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

  const renderDashboardIntro = () => (
    <View className='dashboard-intro-row'>
      <View className='dashboard-intro-left'>
        <View className='dashboard-greeting-row'>
          <Text className={`dashboard-greeting-icon iconfont ${greetingModel.iconClass}`} />
          <Text className='dashboard-greeting'>{`${greetingModel.label}，${userDisplayName}`}</Text>
          {cloudSyncing ? (
            <View className='dashboard-cloud-sync-spin'>
              <LoadingSpinner size={24} className='dashboard-cloud-sync-spin-inner' />
            </View>
          ) : null}
        </View>
      </View>
      <View className='dashboard-more-hit' onClick={() => setMoreTrainingOpen(true)}>
        <Text className='dashboard-more-dots'>⋯</Text>
      </View>
    </View>
  )

  const renderCoachPickSheet = () => (
    <Popup visible={coachPickSheetOpen} position='bottom' round onClose={() => setCoachPickSheetOpen(false)}>
      <View className='coach-pick-sheet'>
        <View className='coach-pick-sheet-handle' />
        <Text className='coach-pick-sheet-title'>切换教练</Text>
        <ScrollView scrollY className='coach-pick-sheet-scroll'>
          {coachSubscriptions.map((sub: any) => {
            const isActive = activeCoachSubscriptionId === sub.id
            const hasPlan = !!coachPlanDataBySubId[sub.id]?.instance
            const subRemainingCredits = Number(sub?.entitlement_remaining_credits ?? NaN)
            const subHasRemainingCredits =
              Number.isFinite(subRemainingCredits) && subRemainingCredits > 0
            const subGrace =
              String(sub?.lifecycle_status || '') === 'expired_grace' &&
              !subHasRemainingCredits
            const coach = sub.coach || {}
            const planData = coachPlanDataBySubId[sub.id]
            const planTitle = planData?.instance?.name?.trim() || (hasPlan ? '训练计划' : '计划待制定')
            const coachIdRaw = sub.coach_id || coach.id
            const coachIdShort =
              coachIdRaw != null && String(coachIdRaw) !== ''
                ? String(coachIdRaw)
                    .replace(/-/g, '')
                    .slice(0, 12)
                    .toUpperCase()
                : '—'
            const specRaw = coach.specialties ?? coach.specialty_tags
            const specText = Array.isArray(specRaw)
              ? specRaw.filter(Boolean).slice(0, 2).join(' · ')
              : typeof specRaw === 'string'
                ? specRaw.replace(/\s+/g, ' ').slice(0, 24)
                : ''
            const subtitle = String(coach.title || '').trim() || specText || ''
            const avatarUrl = resolveCoachAvatarUrl(coach.avatar_url)
            const initial = String(coach.name || '教').trim().charAt(0) || '教'
            return (
              <View
                key={sub.id}
                className={`coach-pick-row ${isActive ? 'coach-pick-row--active' : ''}`}
                hoverClass='coach-pick-row--pressed'
                hoverStayTime={70}
                onClick={() => {
                  handleSelectCoachSubscription(sub.id)
                  setCoachPickSheetOpen(false)
                }}
              >
                <View className='coach-pick-avatar-wrap'>
                  {avatarUrl ? (
                    <Image className='coach-pick-avatar-img' src={avatarUrl} mode='aspectFill' />
                  ) : (
                    <View className='coach-pick-avatar-fallback'>
                      <Text className='coach-pick-avatar-letter'>{initial}</Text>
                    </View>
                  )}
                </View>
                <View className='coach-pick-body'>
                  <View className='coach-pick-name-row'>
                    <Text className='coach-pick-name'>{coach.name || `教练 ${String(sub.id).slice(0, 8)}`}</Text>
                    {isActive && <Text className='coach-pick-current'>当前</Text>}
                    {!hasPlan && (
                      <Text className='coach-pick-badge'>{subGrace ? '待续费' : '待制定'}</Text>
                    )}
                  </View>
                  <Text className='coach-pick-plan'>{planTitle}</Text>
                  <Text className='coach-pick-id'>ID · {coachIdShort}</Text>
                  {!!subtitle && <Text className='coach-pick-sub'>{subtitle}</Text>}
                </View>
                {isActive ? <Text className='coach-pick-check'>✓</Text> : <Text className='coach-pick-chevron'>›</Text>}
              </View>
            )
          })}
        </ScrollView>
        <View
          className='coach-pick-sheet-footer'
          onClick={() => {
            setCoachPickSheetOpen(false)
            Taro.navigateTo({ url: '/me/my-coaches/index' })
          }}
        >
          <Text className='coach-pick-footer-text'>管理我的教练</Text>
        </View>
      </View>
    </Popup>
  )

  const renderDailyProgressCard = () => {
    const hasPlanForCard = !!instance
    const isSelfPlanForCard = hasPlanForCard && (planMode === 'self' || instance?.source === 'self')
    const showCoachSwitchTrigger = planMode === 'coach' && !isSelfPlanForCard && coachSubscriptions.length > 1
    const hasCoachWaitingPlan = !hasPlanForCard && !!activeSubscription?.id
    const noPlanForCard = !hasPlanForCard && !activeSubscription?.id
    const coachName = activeSubscription?.coach?.name || ''
    const identityName = isSelfPlanForCard ? userDisplayName : coachName || userDisplayName
    const identityInitial = (identityName || 'C').trim().slice(0, 1).toUpperCase()
    const focusStatusText = !hasPlanForCard
      ? isExpiredGrace
        ? '待续费'
        : hasCoachWaitingPlan
          ? '制定中'
          : '未开始'
      : selectedTaskSummary.totalModules === 0
        ? '暂无任务'
        : selectedTaskSummary.dayCompleted
          ? '已完成'
          : selectedTaskSummary.trainingInProgress
            ? '进行中'
            : '待执行'
    const focusDayText = hasPlanForCard
      ? selectedDay
        ? `第${selectedDayIndex}天 · ${selectedDay.type === 'rest' ? '恢复日' : '训练日'}`
        : '暂无训练日'
      : hasCoachWaitingPlan
        ? activeSubscription?.coach?.name
          ? `${activeSubscription.coach.name}的教练计划`
          : '教练计划'
        : '自由训练'
    const focusPlanText = hasPlanForCard
      ? instance?.source === 'self'
        ? '我的计划'
        : activeSubscription?.coach?.name
          ? `教练 · ${activeSubscription.coach.name}`
          : '教练计划'
      : hasCoachWaitingPlan
        ? isExpiredGrace
          ? '订阅需要续费'
          : '等待教练制定'
        : '还没有长期计划'
    const cardTitle = hasPlanForCard
      ? isSelfPlanForCard
        ? '我的训练安排'
        : `${coachName || '教练'}的训练安排`
      : hasCoachWaitingPlan
        ? isExpiredGrace
          ? '计划暂时锁定'
          : '计划正在制定中'
        : '今天可以先练起来'
    const focusModuleTitle = hasPlanForCard
      ? selectedDay?.type === 'rest'
        ? '恢复日'
        : selectedModuleModel.strengthTasks.length > 0
          ? '连续力量训练'
          : selectedTaskSummary.lightweightCount > 0
            ? '轻量任务'
            : '当天安排'
      : hasCoachWaitingPlan
        ? isExpiredGrace
          ? '续费后继续'
          : '先自由练'
        : '自由训练'
    const focusMetaLine = hasPlanForCard
      ? selectedDay?.type === 'rest'
        ? `${focusDayText} · ${selectedTaskSummary.lightweightCount}个轻任务`
        : `${selectedModuleModel.strengthTasks.length}个动作 · ${selectedModuleModel.strengthTotalSetCount}组 · 计划进度 ${planProgressStats.percent}%`
      : `${focusPlanText} · ${focusDayText}`
    const primaryActionLabel = hasPlanForCard
      ? selectedTaskSummary.dayCompleted
        ? '查看今日记录'
        : selectedTaskSummary.trainingInProgress
          ? '继续训练'
          : selectedDay?.type === 'rest'
            ? '查看轻任务'
            : '开始训练'
      : isExpiredGrace && hasCoachWaitingPlan
        ? '去续费'
        : '即兴锻炼'
    const handlePrimaryAction = () => {
      if (hasPlanForCard) {
        handleMegaStart()
        return
      }
      if (isExpiredGrace && hasCoachWaitingPlan) {
        Taro.navigateTo({ url: renewPath })
        return
      }
      handleImpromptu()
    }

    return (
      <View className={`tt-daily-progress-card ${!hasPlanForCard ? 'tt-daily-progress-card--empty-state' : ''}`}>
        <View className='tt-plan-identity'>
          <View className='tt-plan-avatar'>
            <Text>{identityInitial}</Text>
          </View>
          <View className='tt-plan-identity-main'>
            <Text className='tt-plan-identity-title'>{cardTitle}</Text>
            <Text className='tt-plan-identity-meta'>
              {hasPlanForCard
                ? `${instance?.name || focusPlanText} · ${focusDayText} · ${focusStatusText}`
                : `${focusPlanText} · ${focusStatusText}`}
            </Text>
          </View>
          <View className='tt-plan-identity-actions'>
            {!isSelfPlanForCard && activeSubscription?.id && !isExpiredGrace ? (
              <View
                className='tt-plan-identity-action'
                onClick={handleContactCoach}
                hoverClass='tt-plan-identity-action--pressed'
                hoverStayTime={70}
              >
                <Message size={18} color='#111827' />
                <Text>联系</Text>
              </View>
            ) : null}
            {showCoachSwitchTrigger && (
              <View
                className='tt-plan-identity-action'
                onClick={() => setCoachPickSheetOpen(true)}
                hoverClass='tt-plan-identity-action--pressed'
                hoverStayTime={70}
              >
                <Text className='tt-plan-action-icon'>↔</Text>
                <Text>换教练</Text>
              </View>
            )}
          </View>
        </View>
        <View className='tt-focus-panel'>
          <View className='tt-focus-art'>
            <Text className='tt-focus-art-icon iconfont icon-a-Trainingplan' />
          </View>
          <View className='tt-focus-copy'>
            <Text className='tt-focus-kicker'>今天重点</Text>
            <Text className='tt-focus-title'>{focusModuleTitle}</Text>
            <Text className='tt-focus-meta'>{focusMetaLine}</Text>
          </View>
          <View className='tt-focus-primary-btn' onClick={handlePrimaryAction} hoverClass='tt-focus-primary-btn--pressed' hoverStayTime={70}>
            <View className='tt-focus-play-icon'>
              <Text>▷</Text>
            </View>
            <Text className='tt-focus-primary-text'>{primaryActionLabel}</Text>
          </View>
          <View className='tt-focus-secondary-row'>
            {hasPlanForCard ? (
              <View className='tt-focus-secondary-btn' onClick={handleImpromptu} hoverClass='tt-focus-secondary-btn--pressed' hoverStayTime={70}>
                <Power size={16} color='#4B5563' />
                <Text>即兴锻炼</Text>
              </View>
            ) : isExpiredGrace && hasCoachWaitingPlan ? (
              <View className='tt-focus-secondary-btn' onClick={() => Taro.navigateTo({ url: renewPath })} hoverClass='tt-focus-secondary-btn--pressed' hoverStayTime={70}>
                <Text>去教练主页续费</Text>
              </View>
            ) : (
              <View className='tt-focus-secondary-btn' onClick={handleFindCoach} hoverClass='tt-focus-secondary-btn--pressed' hoverStayTime={70}>
                <Target size={16} color='#4B5563' />
                <Text>{hasCoachWaitingPlan ? '浏览教练' : '找教练'}</Text>
              </View>
            )}
          </View>
          {!hasPlanForCard && (
            <View
              className='tt-focus-tertiary-link'
              onClick={handleGoToPlanLib}
              hoverClass='tt-focus-tertiary-link--pressed'
              hoverStayTime={70}
            >
              <Calendar size={15} color='#6B7280' />
              <Text>查看计划库</Text>
            </View>
          )}
          {!hasPlanForCard && (
            <View className='tt-empty-state-hint'>
              <Text>
                {noPlanForCard
                  ? '之后有教练计划时，这里会自动切换成今日训练。'
                  : isExpiredGrace
                    ? '原计划、日历和训练记录不会丢失，续费后继续。'
                    : '教练发布计划后，日历和当天安排会出现在这里。'}
              </Text>
            </View>
          )}
        </View>
        {hasPlanForCard && (
          <View className='tt-overall-progress'>
            <View className='tt-overall-progress-head'>
              <Text className='tt-overall-progress-label'>当前计划进度</Text>
              <Text className='tt-overall-progress-value'>{planProgressStats.percent}%</Text>
            </View>
            <View className='tt-overall-progress-track'>
              <View className='tt-overall-progress-fill' style={{ width: `${planProgressStats.percent}%` }} />
            </View>
            <Text className='tt-overall-progress-meta'>
              已完成 {planProgressStats.done}/{planProgressStats.total} 个训练日
            </Text>
          </View>
        )}
      </View>
    )
  }

  const renderWrappedEmptyDesc = (lines: string[]) => (
    <View className='empty-desc'>
      {lines.filter(Boolean).map((line, index) => (
        <Text key={`${line}-${index}`} className='empty-desc-line'>
          {line}
        </Text>
      ))}
    </View>
  )

  const renderMoreTrainingPopup = () => (
    <Popup visible={moreTrainingOpen} position='bottom' round onClose={() => setMoreTrainingOpen(false)}>
      <View className='more-training-sheet'>
        <View className='more-training-sheet-handle' />
        <View className='more-training-sheet-header'>
          <Text className='more-training-sheet-title'>更多训练方式</Text>
          <Text className='more-training-sheet-subtitle'>按你的当前目标选择开始方式</Text>
        </View>
        <View className='more-training-list'>
        <View
          className='more-training-item'
          onClick={() => {
            setMoreTrainingOpen(false)
            handleImpromptu()
          }}
          hoverClass='more-training-item--pressed'
          hoverStayTime={70}
        >
          <View className='more-training-item-icon more-training-item-icon--accent'>
            <Power size={22} color='#CF6D4E' />
          </View>
          <View className='more-training-item-copy'>
            <Text className='more-training-item-title'>即兴训练</Text>
            <Text className='more-training-item-desc'>自由选择动作，随时开始训练</Text>
          </View>
          <ArrowRight size={18} color='#9CA3AF' />
        </View>
        <View
          className='more-training-item'
          onClick={() => {
            setMoreTrainingOpen(false)
            handleGoToPlanLib()
          }}
          hoverClass='more-training-item--pressed'
          hoverStayTime={70}
        >
          <View className='more-training-item-icon more-training-item-icon--plan'>
            <Calendar size={22} color='#3B82F6' />
          </View>
          <View className='more-training-item-copy'>
            <Text className='more-training-item-title'>AI 长期计划</Text>
            <Text className='more-training-item-desc'>创建并管理你的长期训练安排</Text>
          </View>
          <ArrowRight size={18} color='#9CA3AF' />
        </View>
        <View
          className='more-training-item'
          onClick={() => {
            setMoreTrainingOpen(false)
            handleDiscoverCoach()
          }}
          hoverClass='more-training-item--pressed'
          hoverStayTime={70}
        >
          <View className='more-training-item-icon more-training-item-icon--coach'>
            <Location size={22} color='#0F766E' />
          </View>
          <View className='more-training-item-copy'>
            <Text className='more-training-item-title'>浏览教练</Text>
            <Text className='more-training-item-desc'>查看教练服务与订阅方案</Text>
          </View>
          <ArrowRight size={18} color='#9CA3AF' />
        </View>
        </View>
      </View>
    </Popup>
  )

  const renderGuestHome = () => (
    <PageThemeRoot>
      <View className={`today-training-page theme-${effectiveTheme}`}>
        <ScrollView className='page-scroll' scrollY>
          <View className='page-content guest-home-content'>
            <View className='guest-hero'>
              <Text className={`guest-hero-icon iconfont ${greetingModel.iconClass}`} />
              <Text className='guest-hero-title'>{greetingModel.label}，欢迎来到教链</Text>
              <Text className='guest-hero-subtitle'>先看看教练、知识和公开工具；开始记录训练时再登录。</Text>
              <View className='guest-hero-actions'>
                <View className='guest-primary-btn' onClick={handleGuestLogin}>
                  <Text>登录同步训练</Text>
                </View>
              </View>
            </View>

            <View className='guest-entry-grid'>
              <View className='guest-entry-card' onClick={handleFindCoach}>
                <View className='guest-entry-icon-wrap'>
                  <Location size={22} color='#CF6D4E' />
                </View>
                <View className='guest-entry-copy'>
                  <Text className='guest-entry-title'>找教练</Text>
                  <Text className='guest-entry-desc'>浏览公开教练主页</Text>
                </View>
                <ArrowRight size={18} color='#9CA3AF' />
              </View>
              <View className='guest-entry-card' onClick={handleGuestKnowledge}>
                <View className='guest-entry-icon-wrap guest-entry-icon-wrap--muted'>
                  <Notice size={22} color='#3B82F6' />
                </View>
                <View className='guest-entry-copy'>
                  <Text className='guest-entry-title'>知识库</Text>
                  <Text className='guest-entry-desc'>查看训练主题和计划</Text>
                </View>
                <ArrowRight size={18} color='#9CA3AF' />
              </View>
              <View className='guest-entry-card' onClick={handleGuestCalculator}>
                <View className='guest-entry-icon-wrap guest-entry-icon-wrap--warm'>
                  <Power size={22} color='#D97706' />
                </View>
                <View className='guest-entry-copy'>
                  <Text className='guest-entry-title'>力量计算器</Text>
                  <Text className='guest-entry-desc'>体验公开训练工具</Text>
                </View>
                <ArrowRight size={18} color='#9CA3AF' />
              </View>
              <View className='guest-entry-card' onClick={handleGuestPowerAnalysis}>
                <View className='guest-entry-icon-wrap guest-entry-icon-wrap--muted'>
                  <Power size={22} color='#3B82F6' />
                </View>
                <View className='guest-entry-copy'>
                  <Text className='guest-entry-title'>功率视频分析</Text>
                  <Text className='guest-entry-desc'>上传视频估算功率</Text>
                </View>
                <ArrowRight size={18} color='#9CA3AF' />
              </View>
            </View>

            <View className='guest-training-card'>
              <View className='guest-training-copy'>
                <Text className='guest-training-title'>已有训练计划？</Text>
                <Text className='guest-training-desc'>登录后会回到今日训练，并同步计划、进度和训练记录。</Text>
              </View>
              <View className='guest-training-btn' onClick={handleGuestLogin}>
                <Text>去登录</Text>
              </View>
            </View>
          </View>
        </ScrollView>
        <BottomNav />
      </View>
    </PageThemeRoot>
  )

  const hasAnyPlan = !!(coachInstance || selfInstance)
  const hasBothPlans = !!(coachInstance && selfInstance)
  const graceDaysLeft = Math.max(0, Number(activeSubscription?.grace_days_left || 0))
  const graceDeadlineLabel = formatShortDate(activeSubscription?.grace_deadline_at)

  if (isGuestHome) {
    return renderGuestHome()
  }

  if (!hasAnyPlan) {
    return (
      <PageThemeRoot>
        <View className={`today-training-page theme-${effectiveTheme}`}>
          <ScrollView
            className='page-scroll'
            scrollY
            scrollIntoView={scheduleScrollIntoView}
            scrollWithAnimation
            scrollIntoViewAlignment='start'
          >
            <View className='page-content'>
              {renderDashboardIntro()}
              {renderDailyProgressCard()}
              {isExpiredGrace && (
                <View className='grace-warning-banner'>
                  <Text>
                    宽限期剩余 {graceDaysLeft} 天{graceDeadlineLabel ? `（截至 ${graceDeadlineLabel}）` : ''}。
                  </Text>
                  <Text className='banner-link' onClick={() => Taro.navigateTo({ url: renewPath })}>
                    去续费
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
          {renderMoreTrainingPopup()}
          {planMode === 'coach' && coachSubscriptions.length > 0 ? renderCoachPickSheet() : null}
          <BottomNav />
        </View>
      </PageThemeRoot>
    )
  }

  const waitingCoachPage = planMode === 'coach' && !coachInstance && activeSubscription?.id
  const enableScheduleMonthExpand = !!instance && trainingDays.length > 0 && !waitingCoachPage

  const renderScheduleCalendarCombined = () => (
    enableScheduleMonthExpand ? (
      <View id='schedule-calendar-anchor' className='schedule-calendar-anchor'>
      <View className='schedule-calendar-anchor__bar'>
        <View className='schedule-calendar-anchor__title-wrap'>
          <Calendar size={18} color='#111827' />
          <Text className='schedule-calendar-anchor__label'>{calendarExpanded ? '训练月历' : '本周日历'}</Text>
        </View>
        {enableScheduleMonthExpand ? (
          <View
            className='schedule-calendar-anchor__toggle'
            onClick={() => setCalendarExpanded((v) => !v)}
            hoverClass='schedule-calendar-anchor__toggle--pressed'
            hoverStayTime={70}
          >
            <Text
              className={`schedule-calendar-anchor__toggle-icon iconfont icon-a-shili-zhankaizuocezhankaijiantou${
                calendarExpanded ? ' schedule-calendar-anchor__toggle-icon--expanded' : ''
              }`}
            />
            <Text className='schedule-calendar-anchor__toggle-text'>
              {calendarExpanded ? '收起' : '展开'}
              月历
            </Text>
          </View>
        ) : null}
      </View>
      {enableScheduleMonthExpand && calendarExpanded ? (
        <ScheduleCalendarPanel
          trainingDays={trainingDays}
          currentDayIndex={todayDayIndex}
          selectedDayIndex={selectedDayIndex}
          completionDates={completionDates}
          executionsByDayIndex={executionsByDayIndex}
          scheduleModel={scheduleModel}
          todayCompleted={effectiveTodayCompleted}
          progressDayIndex={progressDayIndex}
          planStartDate={effectiveCalendarStartDate || undefined}
          startExecutionDay={instance?.start_execution_day || 1}
          onSelectedDayChange={setSelectedDayIndex}
          monthOnly
          showMonthGrid
        />
      ) : (
        <WeekDashboardStrip
          cells={weekStripCells}
          selectedDateKey={stripSelectedDateKey}
          onCellPress={handleWeekStripCell}
        />
      )}
    </View>
    ) : null
  )

  return (
    <PageThemeRoot>
    <View className={`today-training-page theme-${effectiveTheme}`}>
      <ScrollView
        className='page-scroll'
        scrollY
        scrollIntoView={scheduleScrollIntoView}
        scrollWithAnimation
        scrollIntoViewAlignment='start'
      >
        <View className='page-content'>
          {renderDashboardIntro()}
          {hasBothPlans && (
            <View className='plan-switcher'>
              <View className={`switcher-btn ${planMode === 'coach' ? 'active' : ''}`} onClick={() => setPlanMode('coach')}>
                <Text className='switcher-icon'><User size={14} /></Text>
                <Text>教练计划</Text>
              </View>
              <View className={`switcher-btn ${planMode === 'self' ? 'active' : ''}`} onClick={() => setPlanMode('self')}>
                <Text className='iconfont icon-star switcher-icon-star' />
                <Text>我的计划</Text>
              </View>
            </View>
          )}
          {renderDailyProgressCard()}
          {renderScheduleCalendarCombined()}

          {waitingCoachPage ? (
            <>
              {isExpiredGrace && (
                <View className='grace-warning-banner'>
                  <Text>
                    宽限期剩余 {graceDaysLeft} 天{graceDeadlineLabel ? `（截至 ${graceDeadlineLabel}）` : ''}。
                  </Text>
                  <Text className='banner-link' onClick={() => Taro.navigateTo({ url: renewPath })}>
                    去续费
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              {returnConfirmedDayIndex && (
                <View className='return-confirm-banner'>
                  <Text>已确认第{returnConfirmedDayIndex}天。</Text>
                  <Text className='banner-link' onClick={() => setReturnConfirmedDayIndex(null)}>
                    收起
                  </Text>
                </View>
              )}

              {missingDays.length > 0 && (
                <View className='missing-days-banner'>
                  <Text className='missing-days-desc'>未确认训练日 {missingDays.length} 天</Text>
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

              {effectiveTodayCompleted && (
                <View className='today-completed-banner'>
                  <Text><Check size={16} /> 今日训练已完成</Text>
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

              <View className='tt-schedule-stack'>
                <View className='section-header section-header--schedule'>
                  <View className='header-left'>
                    <View className='tt-schedule-stack__head'>
                      <Text className='tt-schedule-stack__icon iconfont icon-a-Trainingplan' />
                      <View className='tt-schedule-stack__titles'>
                        <Text className='section-title'>
                          {selectedDayIndex === progressDayIndex || selectedIsTodayCompletedTraining ? '今日安排' : '当天安排'}
                        </Text>
                        <Text className='section-subtitle'>
                          {selectedDay?.type === 'rest'
                            ? `第${selectedDayIndex}天 · 恢复与轻任务`
                            : `第${selectedDayIndex}天 · ${
                                selectedModuleModel.strengthTasks.length > 0
                                  ? '连续力量训练'
                                  : selectedTaskSummary.lightweightCount > 0
                                    ? '轻量任务'
                                    : '当天安排'
                              } · ${selectedModuleModel.strengthTasks.length}个动作 · ${selectedModuleModel.strengthTotalSetCount}组`}
                        </Text>
                      </View>
                    </View>
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
                    embeddedInSchedule
                    onOpenLightweightTask={handleOpenLightweightTask}
                    onAddLightweightTask={handleOpenLightweightPicker}
                    onDeleteLightweightTask={handleDeleteLightweightTask}
                    onOpenExecution={handleGoToTrainingExecution}
                  />

                  {canShareDayCheckin && (
                    <View className='share-entry-card'>
                      <Text className='share-entry-title'>整日打卡图</Text>
                      <View className='inline-actions'>
                        <View className='inline-action-btn' onClick={() => setDayShareVisible(true)}>
                          <Text>生成</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </>
              ) : selectedDay ? (
                <>
                  <RestDayCard dayIndex={selectedDayIndex} />
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
                    embeddedInSchedule
                    onOpenLightweightTask={handleOpenLightweightTask}
                    onAddLightweightTask={handleOpenLightweightPicker}
                    onDeleteLightweightTask={handleDeleteLightweightTask}
                    onOpenExecution={handleGoToTrainingExecution}
                  />

                  {inProgressExec && (
                    <View className='in-progress-banner in-progress-banner--quiet'>
                      <Text>
                        进行中的训练：第{inProgressExec.day_index}天，已在上方主按钮保留继续入口。
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <View className='empty-card'>
                  <Text className='empty-title'>当前计划暂无可展示的训练日</Text>
                  {renderWrappedEmptyDesc(['可以先去计划库查看，或者做一次即兴锻炼。'])}
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
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {renderMoreTrainingPopup()}
      {planMode === 'coach' && coachSubscriptions.length > 0 ? renderCoachPickSheet() : null}
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

      <ExecutionPlanNoticePopup
        visible={executionNoticeVisible}
        executionNotice={(instance as any)?.execution_notice || (instance as any)?.executionNotice || null}
        planName={instance?.name || null}
        onConfirm={handleConfirmExecutionNotice}
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
