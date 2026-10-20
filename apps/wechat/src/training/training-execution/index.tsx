import { openActionTeaching } from '@/utils/actionTeaching'
import ExecutionPlanNoticePopup from '@/components/ExecutionPlanNoticePopup'
import { LocalDebugBanner } from '@/components/LocalDebugLogin'
import { hasReadExecutionPlanNotice, markExecutionPlanNoticeRead } from '@/utils/executionPlanNotice'
import React from 'react'
import { canStartPlanDay, executionCapabilities, resolveTrainingIntent, type TrainingIntent } from '@coachlink/core/src/trainingAccess'
import { canCancelEmptyPlanExecution } from '@coachlink/core/src/executionCancellation'
import { isTimedTrainingSet, getActualDurationSeconds, getPlannedDurationSeconds, getTrainingSetVolume, formatRecordedTrainingSet, inheritedTimedSetDefaults } from '@coachlink/core/src/trainingSetMetrics'
import RecordCompletionButton from '@/components/RecordCompletionButton'
import { formatPosterSetText } from './posterSetText'
import { previousCompletedWeight } from './setDefaults'
import { resolveWeappImageThumbnailUrl } from '@/utils/mediaUrl'
import { View, Text, ScrollView, Input, Button, Textarea, Image, Canvas } from '@tarojs/components'
import { ClButton, ClTag } from '@/components/ui'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { trainingService } from '@/services/trainingService'
import { executionService } from '@/services/executionService'
import { impromptuService } from '@/services/impromptuService'
import { authService } from '@/services/authService'
import { studentActionLibService } from '@/services/studentActionLibService'
import { addPublicToMyLib, listPublicActions } from '@/services/actionLibPageService'
import { buildPublicTrainingSharePath } from '@/utils/share'
import { formatKgValueForGym } from '@/utils/weightQuantize'
import { buildPlannedSetPreviews } from '@/utils/planSetPrescriptions'
import {
  readTrainingExecutionSnapshot,
  removeTrainingExecutionFromStorage,
  syncTrainingExecutionToStorage,
  trainingExecutionSnapshotKey
} from '@/utils/trainingExecutionCache'
import posterFrontBase from '@/assets/body-map/poster/front-base.png'
import posterFrontArms from '@/assets/body-map/poster/front-arms.png'
import posterFrontBack from '@/assets/body-map/poster/front-back.png'
import posterFrontChest from '@/assets/body-map/poster/front-chest.png'
import posterFrontCore from '@/assets/body-map/poster/front-core.png'
import posterFrontGlutes from '@/assets/body-map/poster/front-glutes.png'
import posterFrontLegs from '@/assets/body-map/poster/front-legs.png'
import posterFrontShoulders from '@/assets/body-map/poster/front-shoulders.png'
import posterBackBase from '@/assets/body-map/poster/back-base.png'
import posterBackArms from '@/assets/body-map/poster/back-arms.png'
import posterBackBack from '@/assets/body-map/poster/back-back.png'
import posterBackChest from '@/assets/body-map/poster/back-chest.png'
import posterBackCore from '@/assets/body-map/poster/back-core.png'
import posterBackGlutes from '@/assets/body-map/poster/back-glutes.png'
import posterBackLegs from '@/assets/body-map/poster/back-legs.png'
import posterBackShoulders from '@/assets/body-map/poster/back-shoulders.png'
import './index.scss'
import './workoutSummary.scss'
import { useTheme } from '@/hooks/useTheme'
import { useSharePoster } from '@/hooks/useSharePoster'
import {
  ACTION_PICKER_EQUIPMENT_FILTERS,
  ACTION_PICKER_MUSCLE_FILTERS,
  getActionPickerSearchText,
  matchesActionPickerFilter
} from '@/utils/actionPickerFilters'
import {
  drawWorkoutPoster,
  formatWorkoutPosterDateLabel,
  WORKOUT_POSTER_MIN_HEIGHT,
  WORKOUT_POSTER_WIDTH,
  type WorkoutPosterData
} from './workoutPoster'

const RETURN_CONFIRM_STORAGE_KEY = 'today_training_last_confirmed_day'
const EXECUTION_LOAD_TIMEOUT_MS = 30000
const EXECUTION_BOOT_WATCHDOG_MS = 12000
const REST_TIMER_STORAGE_PREFIX = 'training_execution_rest_timer_v1'
const TRAINING_TIMER_STORAGE_PREFIX = 'training_execution_total_timer_v1'
const ROUTE_PARAM_STORAGE_KEY = 'training_execution_last_route_params_v1'
const WEIGHT_STEP_KG = 2.5
const REPS_STEP = 1
const WORKOUT_POSTER_CANVAS_ID = 'workout-share-poster-canvas'

const WORKOUT_POSTER_BODY_MAP_LAYERS: Record<string, { back: string; front: string }> = {
  胸部: { back: posterBackChest, front: posterFrontChest },
  背部: { back: posterBackBack, front: posterFrontBack },
  肩部: { back: posterBackShoulders, front: posterFrontShoulders },
  手臂: { back: posterBackArms, front: posterFrontArms },
  核心: { back: posterBackCore, front: posterFrontCore },
  腿部: { back: posterBackLegs, front: posterFrontLegs },
  臀部: { back: posterBackGlutes, front: posterFrontGlutes }
}

const MUSCLE_INFERENCE_RULES: Array<{ label: string; keywords: string[] }> = [
  { label: '胸部', keywords: ['胸', '卧推', '飞鸟', '夹胸', '俯卧撑', '双杠'] },
  { label: '背部', keywords: ['背', '引体', '划船', '下拉', '硬拉'] },
  { label: '肩部', keywords: ['肩', '推举', '侧平举', '三角肌'] },
  { label: '手臂', keywords: ['手臂', '二头', '三头', '弯举', '臂屈伸'] },
  { label: '核心', keywords: ['核心', '腹', '卷腹', '平板', '腰腹'] },
  { label: '腿部', keywords: ['腿', '深蹲', '腿举', '弓步', '股四头', '腘绳'] },
  { label: '臀部', keywords: ['臀', '臀桥', '髋', '深蹲', '硬拉', '弓步'] }
]

function withExecutionLoadTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null

  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label}超时，请检查网络或后端服务`))
    }, EXECUTION_LOAD_TIMEOUT_MS)
  })

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  }) as Promise<T>
}

interface SetData {
  set_number: number
  set_index?: number
  status: 'pending' | 'completed' | 'skipped'
  planned_reps?: string
  planned_weight?: string
  planned_intensity?: string
  planned_target_type?: string | null
  planned_target_unit?: string | null
  planned_rest_seconds?: number
  actual_weight?: number
  actual_reps?: number
  rpe?: number
  notes?: string
  video_url?: string
  is_pr?: boolean
  e1rm?: number
  is_auto_pr?: boolean
  diet_content?: string
  actual_distance?: number
  actual_duration?: number
  source?: string // 'student_extra' = 学员自行添加
}

interface SetRecordDraft {
  weight: number | null
  weightInput: string
  reps: number | null
  rpe: number | null
  notes: string
  markAsPR: boolean
  videoUrl: string
}

interface ActionExecution {
  action_id: string
  action_name: string
  action_order: number
  source_action_index?: number
  plan_note?: string
  source?: string // 'student_extra' = 学员自行添加
  sets: SetData[]
  total_sets: number
  completed_sets: number
  type?: string
  item_type?: string
  energy_estimate?: {
    calories?: number
    activeCalories?: number
    met?: number
    minutes?: number
    confidence?: 'high' | 'medium' | 'low'
    basis?: string
  } | null
}

type PickerActionSource = 'mine' | 'public'

interface PickerAction {
  id: string
  name: string
  type?: string | null
  positions?: string[] | null
  attrs?: string[] | null
  url?: string | null
  detail?: string | null
  source: PickerActionSource
  isAdded?: boolean
  [key: string]: any
}

const FEEDBACK_DIFFICULTY_OPTIONS = [
  { value: 1, label: '太轻松', mark: '轻' },
  { value: 2, label: '轻松', mark: '松' },
  { value: 3, label: '刚好', mark: '中' },
  { value: 4, label: '有点难', mark: '挑' },
  { value: 5, label: '太难了', mark: '难' }
]

function getActionTypeMeta(type: string): { label: string; cue: string } {
  const t = String(type || 'STRENGTH').toUpperCase()
  const map: Record<string, { label: string; cue: string }> = {
    STRENGTH: { label: '力量', cue: '按计划完成组次与重量' },
    CARDIO: { label: '有氧', cue: '记录距离或训练时长' },
    DIET: { label: '饮食', cue: '按提示记录饮食内容' },
    HABIT: { label: '习惯', cue: '完成习惯打卡' }
  }
  return map[t] || map.STRENGTH
}

function formatRestSummary(seconds?: number | null): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(Number(seconds))) {
    return '间歇未设'
  }
  const s = Math.max(0, Math.round(Number(seconds)))
  if (s <= 0) return '无间歇'
  if (s < 60) return `间歇 ${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  if (r === 0) return `间歇 ${m}分钟`
  return `间歇 ${m}分${r}秒`
}

function getPlanActionNote(
  planInstance: any,
  targetDayIndex: number,
  action: ActionExecution,
  actionIndex: number
): string {
  const embeddedNote = String(action?.plan_note || '').trim()
  if (embeddedNote) return embeddedNote

  const trainingDays = Array.isArray(planInstance?.training_days)
    ? planInstance.training_days
    : Array.isArray(planInstance?.trainingDays)
      ? planInstance.trainingDays
      : []
  const targetDay = trainingDays.find((day: any) => (
    Number(day?.dayIndex ?? day?.day_index) === Number(targetDayIndex)
  ))
  const actionSets = Array.isArray(targetDay?.actionSets)
    ? targetDay.actionSets
    : Array.isArray(targetDay?.action_sets)
      ? targetDay.action_sets
      : []
  const sourceActionIndex = Number(action?.source_action_index)
  const preferredIndex = Number.isInteger(sourceActionIndex) && sourceActionIndex >= 0
    ? sourceActionIndex
    : actionIndex
  const indexedActionSet = actionSets[preferredIndex]
  const actionId = String(action?.action_id || '').trim()
  const matchedActionSet = indexedActionSet || actionSets.find((item: any) => (
    actionId && String(item?.action_id || item?.actionId || '').trim() === actionId
  ))

  return String(matchedActionSet?.params?.note || matchedActionSet?.note || '').trim()
}

function formatTimerValue(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function parseFirstNumber(value?: string | number | null): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const match = String(value).match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const parsed = parseFloat(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

function isConcreteWeightValue(value?: string | number | null): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'number') return Number.isFinite(value)
  const text = String(value).trim().toLowerCase()
  if (!text) return false
  if (text.includes('rm') || text.includes('%')) return false
  return parseFirstNumber(text) !== null
}

function normalizeActionName(action: any): string {
  return String(action?.name || action?.action_name || '').trim()
}

function getSetWeightDefault(set?: SetData | null): number | null {
  if (!set) return null
  if (isTimedTrainingSet(set)) return null
  if (set.actual_weight !== null && set.actual_weight !== undefined && Number.isFinite(Number(set.actual_weight))) {
    return Number(set.actual_weight)
  }
  if (!isConcreteWeightValue(set.planned_weight)) return null
  return parseFirstNumber(set.planned_weight)
}

function getSetRepsDefault(set?: SetData | null): number | null {
  if (!set) return null
  if (isTimedTrainingSet(set)) return getActualDurationSeconds(set) ?? (set.status === 'completed' ? null : getPlannedDurationSeconds(set))
  if (set.actual_reps !== null && set.actual_reps !== undefined && Number.isFinite(Number(set.actual_reps))) {
    return Math.max(0, Math.floor(Number(set.actual_reps)))
  }
  const plannedReps = parseFirstNumber(set.planned_reps)
  return plannedReps === null ? null : Math.max(0, Math.floor(plannedReps))
}

function getSetRestDefault(set?: SetData | null): number | null {
  const rest = Number(set?.planned_rest_seconds ?? (set as any)?.rest_seconds)
  return Number.isFinite(rest) && rest > 0 ? Math.round(rest) : null
}

function formatPlannedRepsText(set?: SetData | null): string {
  const value = String(set?.planned_reps || '').trim()
  if (!value) return ''
  if (isTimedTrainingSet(set)) return `保持 ${getPlannedDurationSeconds(set) ?? '-'} 秒`
  const targetType = String(set?.planned_target_type || '').trim().toLowerCase()
  if (targetType === 'time' || targetType === 'distance' || targetType === 'amrap' || targetType === 'reps_max') {
    return value
  }
  return `${value}次`
}

function buildInheritedExtraSet(sourceSet?: SetData | null, action?: any): SetData {
  const inheritedWeight = getSetWeightDefault(sourceSet)
  const inheritedReps = getSetRepsDefault(sourceSet)
  const inheritedRest = getSetRestDefault(sourceSet)

  return {
    set_number: 1,
    status: 'pending',
    planned_weight: inheritedWeight !== null ? `${formatKgValueForGym(inheritedWeight)}kg` : (sourceSet?.planned_weight || ''),
    planned_reps: inheritedReps !== null ? String(inheritedReps) : (sourceSet?.planned_reps || ''),
    ...inheritedTimedSetDefaults(sourceSet, action),
    planned_rest_seconds: inheritedRest ?? sourceSet?.planned_rest_seconds,
    source: 'student_extra'
  }
}

function findInheritableSourceSet(sets: SetData[]): SetData | null {
  for (let i = sets.length - 1; i >= 0; i -= 1) {
    const set = sets[i]
    if (
      getSetWeightDefault(set) !== null ||
      getSetRepsDefault(set) !== null ||
      String(set?.planned_weight || '').trim() ||
      String(set?.planned_reps || '').trim()
    ) {
      return set
    }
  }
  return sets.length > 0 ? sets[sets.length - 1] : null
}

function parseTimestamp(value?: string | number | Date | null): number | null {
  if (!value) return null
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null
}

function asTextList(value?: string[] | null) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function inferMusclesForAction(actionExecution: ActionExecution, actionDetail: any): string[] {
  const sourceText = getActionPickerSearchText({
    ...actionDetail,
    action_name: actionExecution?.action_name
  })
  const directPositions = asTextList(actionDetail?.positions)
    .filter((item) => ['胸部', '背部', '肩部', '手臂', '核心', '腿部', '臀部'].includes(item))

  const inferred = MUSCLE_INFERENCE_RULES
    .filter((rule) => rule.keywords.some((keyword) => sourceText.includes(keyword.toLowerCase())))
    .map((rule) => rule.label)

  return Array.from(new Set([...directPositions, ...inferred])).slice(0, 3)
}

function TrainingExecution() {
  const { effectiveTheme } = useTheme()
  const instance = Taro.getCurrentInstance()
  const routeParams = instance.router?.params || {}
  let routeFallback: any = {}
  try {
    routeFallback = Taro.getStorageSync(ROUTE_PARAM_STORAGE_KEY) || {}
  } catch {
    routeFallback = {}
  }
  const rawInstanceId = routeParams.instanceId as string
  const rawImpromptuId = routeParams.impromptuId as string
  const hasCurrentRouteTarget = !!rawInstanceId || !!rawImpromptuId
  const instanceId = rawInstanceId || (!rawImpromptuId ? String(routeFallback.instanceId || '') : '')
  const impromptuId = rawImpromptuId || (!rawInstanceId ? String(routeFallback.impromptuId || '') : '')
  const isImpromptuMode = !!impromptuId
  const parsedDayIndex = parseInt(String(routeParams.dayIndex || routeFallback.dayIndex || '1'))
  const dayIndex = Number.isFinite(parsedDayIndex) && parsedDayIndex > 0 ? parsedDayIndex : 1
  // A normal navigation target is authoritative. In particular, an omitted
  // readOnly parameter means editable; it must not inherit readOnly=1 from a
  // previously opened history/preview page. Only use the stored route when the
  // whole current target is unavailable (for example after DevTools hot reload
  // or returning from a native picker).
  const readOnlyParam = String(
    Object.prototype.hasOwnProperty.call(routeParams, 'readOnly')
      ? routeParams.readOnly
      : hasCurrentRouteTarget
        ? ''
        : routeFallback.readOnly || ''
  ).toLowerCase()
  const [intent, setIntent] = React.useState<TrainingIntent>(() => resolveTrainingIntent(
    routeParams.intent || (!hasCurrentRouteTarget ? routeFallback.intent : undefined), readOnlyParam))
  const [canStartFromPreview, setCanStartFromPreview] = React.useState(false)
  const [executionNoticeVisible, setExecutionNoticeVisible] = React.useState(false)
  
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState('')
  const [loadStage, setLoadStage] = React.useState('等待页面启动')
  const [execution, setExecution] = React.useState<any>(null)
  const [cloudExecutionReady, setCloudExecutionReady] = React.useState(false)
  const [restartingTimedOut, setRestartingTimedOut] = React.useState(false)
  const [actions, setActions] = React.useState<Record<string, any>>({})
  const [planInstance, setPlanInstance] = React.useState<any>(null)
  const [expandedAction, setExpandedAction] = React.useState<number>(0)
  const [currentSetIndex, setCurrentSetIndex] = React.useState(0)
  const [expandedSetKey, setExpandedSetKey] = React.useState<string | null>(null)
  const [openSetMoreKey, setOpenSetMoreKey] = React.useState<string | null>(null)
  const [editingSetKey, setEditingSetKey] = React.useState<string | null>(null)
  const [completing, setCompleting] = React.useState(false)
  const [cancelling, setCancelling] = React.useState(false)
  const completionMutationRef = React.useRef(false)
  const [restTimer, setRestTimer] = React.useState(0)
  const [isResting, setIsResting] = React.useState(false)
  const [restTimerMinimized, setRestTimerMinimized] = React.useState(false)
  const [elapsedTrainingSeconds, setElapsedTrainingSeconds] = React.useState(0)
  
  // 当前组的输入状态
  const [weight, setWeight] = React.useState<number | null>(null)
  const [weightInput, setWeightInput] = React.useState('')
  const [reps, setReps] = React.useState<number | null>(null)
  const [rpe, setRpe] = React.useState<number | null>(null)
  const [setNotes, setSetNotes] = React.useState('')
  const [markAsPR, setMarkAsPR] = React.useState(false)
  const [videoUrl, setVideoUrl] = React.useState('')
  const [setDrafts, setSetDrafts] = React.useState<Record<string, SetRecordDraft>>({})
  const [uploadingVideo, setUploadingVideo] = React.useState(false)

  // 非力量项目（饮食/有氧/习惯）表单状态
  const [itemStates, setItemStates] = React.useState<Record<number, { dietContent?: string; cardioDistance?: number | null; cardioDuration?: number | null }>>({})
  const [addingExtraSet, setAddingExtraSet] = React.useState(false)
  const [addingExtraAction, setAddingExtraAction] = React.useState(false)
  const [showActionPicker, setShowActionPicker] = React.useState(false)
  const [actionPickerList, setActionPickerList] = React.useState<PickerAction[]>([])
  const [actionKeyword, setActionKeyword] = React.useState('')
  const [pickerMuscle, setPickerMuscle] = React.useState('all')
  const [pickerEquipment, setPickerEquipment] = React.useState('all')
  const [pickerSelectedActionIds, setPickerSelectedActionIds] = React.useState<string[]>([])
  const [removingSet, setRemovingSet] = React.useState(false)
  const [removingAction, setRemovingAction] = React.useState(false)
  const [showFeedbackDialog, setShowFeedbackDialog] = React.useState(false)
  const [feedbackContent, setFeedbackContent] = React.useState('')
  const [feedbackDifficulty, setFeedbackDifficulty] = React.useState<number>(3)
  const [feedbackSubmitting, setFeedbackSubmitting] = React.useState(false)
  const [showWorkoutSummary, setShowWorkoutSummary] = React.useState(false)
  const startTrainingRef = React.useRef<((requestedIntent?: TrainingIntent) => Promise<void>) | null>(null)
  const startTrainingInFlightRef = React.useRef<Promise<void> | null>(null)
  const lastStartTrainingAtRef = React.useRef(0)
  const executionRef = React.useRef<any>(null)
  const loadingRef = React.useRef(true)
  const suppressAutoRefreshUntilRef = React.useRef(0)
  const restTimerDeadlineAtRef = React.useRef(0)

  const currentUser = authService.getCurrentUser() || {}
  const userId = currentUser?.id

  const shouldAskCoachFeedback = React.useMemo(() => {
    if (isImpromptuMode || !planInstance) return false
    const source = String(planInstance.source || planInstance.plan_source || '').toLowerCase()
    if (source === 'coach') return true

    const coachPlanMarkers = [
      planInstance.coach_subscription_id,
      planInstance.coachSubscriptionId,
      planInstance.coach_id,
      planInstance.coachId
    ]
    return coachPlanMarkers.some((value) => {
      const text = String(value || '').trim()
      return !!text && text !== userId
    })
  }, [isImpromptuMode, planInstance, userId])

  React.useEffect(() => {
    if (!rawInstanceId && !rawImpromptuId) return
    try {
      Taro.setStorageSync(ROUTE_PARAM_STORAGE_KEY, {
        instanceId: rawInstanceId || '',
        impromptuId: rawImpromptuId || '',
        dayIndex,
        readOnly: readOnlyParam,
        intent
      })
    } catch {
      // Route-param fallback is only for DevTools hot reload / native picker return resilience.
    }
  }, [dayIndex, rawImpromptuId, rawInstanceId, readOnlyParam, intent])

  const executionSnapshotScopeKey = React.useMemo(
    () => trainingExecutionSnapshotKey({ isImpromptuMode, impromptuId, instanceId, dayIndex }),
    [dayIndex, impromptuId, instanceId, isImpromptuMode]
  )

  const restTimerStorageKey = React.useMemo(
    () => (userId && executionSnapshotScopeKey ? `${REST_TIMER_STORAGE_PREFIX}:${userId}:${executionSnapshotScopeKey}` : ''),
    [executionSnapshotScopeKey, userId]
  )

  const trainingTimerStorageKey = React.useMemo(
    () => (userId && executionSnapshotScopeKey ? `${TRAINING_TIMER_STORAGE_PREFIX}:${userId}:${executionSnapshotScopeKey}` : ''),
    [executionSnapshotScopeKey, userId]
  )

  const isPreviewExecution = React.useMemo(() => {
    const status = String(execution?.status || '').toLowerCase()
    const executionId = String(execution?.id || '')
    return status === 'preview' || executionId.startsWith('preview-')
  }, [execution?.id, execution?.status])

  // Cloud-persisted in-progress executions are authoritative. A stale route or
  // page cache must never turn an active workout into a read-only preview.
  const isPersistedInProgressExecution =
    !isImpromptuMode && !isPreviewExecution && String(execution?.status || '').toLowerCase() === 'in_progress'
  const isCompletedExecution =
    String(execution?.status || '').toLowerCase() === 'completed' || !!execution?.completed_at
  const isTimedOutExecution = String(execution?.status || '').toLowerCase() === 'timed_out'
  const capabilities = executionCapabilities(execution, isImpromptuMode ? 'execute' : intent, cloudExecutionReady)
  const canCorrectCompletedSets = capabilities.canCorrect
  const isReadOnly = !capabilities.canRecord
  const canLateCompleteTimedOut = capabilities.canRecover

  React.useEffect(() => {
    executionRef.current = execution
  }, [execution])

  React.useEffect(() => {
    loadingRef.current = loading
  }, [loading])

  const blockUntilExecutionReady = React.useCallback(() => {
    if (!isPreviewExecution && cloudExecutionReady) return false
    Taro.showToast({ title: loadError || '训练尚未开始，请先核对并开始', icon: 'none' })
    return true
  }, [cloudExecutionReady, isImpromptuMode, isPreviewExecution, loadError])

  const clearPersistedRestTimer = React.useCallback(() => {
    restTimerDeadlineAtRef.current = 0
    if (!restTimerStorageKey) return
    try {
      Taro.removeStorageSync(restTimerStorageKey)
    } catch {
      // Best effort only.
    }
  }, [restTimerStorageKey])

  const persistRestTimer = React.useCallback(
    (seconds: number, executionId?: string) => {
      if (!executionId || seconds <= 0) return
      const deadlineAt = Date.now() + Math.max(0, Math.round(seconds)) * 1000
      restTimerDeadlineAtRef.current = deadlineAt
      if (!restTimerStorageKey) return
      try {
        Taro.setStorageSync(restTimerStorageKey, {
          executionId,
          deadlineAt
        })
      } catch {
        // Best effort only.
      }
    },
    [restTimerStorageKey]
  )

  const reconcileRestTimer = React.useCallback(
    (minimizeWhenRestored = false) => {
      if (!restTimerStorageKey || !execution?.id) return
      try {
        const stored = Taro.getStorageSync(restTimerStorageKey) as any
        if (!stored || String(stored.executionId || '') !== String(execution.id)) return
        const deadlineAt = Number(stored.deadlineAt || 0)
        const remaining = Math.ceil((deadlineAt - Date.now()) / 1000)
        if (deadlineAt > 0 && remaining > 0) {
          restTimerDeadlineAtRef.current = deadlineAt
          setRestTimer(remaining)
          setIsResting(true)
          if (minimizeWhenRestored) setRestTimerMinimized(true)
          return
        }
        setRestTimer(0)
        setIsResting(false)
        setRestTimerMinimized(false)
        clearPersistedRestTimer()
      } catch {
        clearPersistedRestTimer()
      }
    },
    [clearPersistedRestTimer, execution?.id, restTimerStorageKey]
  )

  const syncExecutionToCaches = React.useCallback(
    (nextExecution: any) => {
      if (!userId || !executionSnapshotScopeKey || !nextExecution) return
      syncTrainingExecutionToStorage({
        userId,
        scopeKey: executionSnapshotScopeKey,
        instanceId,
        dayIndex,
        isImpromptuMode,
        execution: nextExecution,
        planInstance,
        actions
      })
    },
    [actions, dayIndex, executionSnapshotScopeKey, instanceId, isImpromptuMode, planInstance, userId]
  )

  const parseInputNumber = React.useCallback((value: string, mode: 'int' | 'float' = 'float') => {
    const trimmed = String(value ?? '').trim()
    if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') {
      return null
    }
    const parsed = mode === 'int' ? parseInt(trimmed, 10) : parseFloat(trimmed)
    if (!Number.isFinite(parsed)) return null
    return parsed
  }, [])

  const formatInputValue = React.useCallback((value?: number | null) => {
    return value === null || value === undefined || !Number.isFinite(value) ? '' : String(value)
  }, [])

  const filteredActionPickerList = React.useMemo(() => {
    const keyword = actionKeyword.trim().toLowerCase()
    const muscleFilter = ACTION_PICKER_MUSCLE_FILTERS.find((item) => item.key === pickerMuscle) || ACTION_PICKER_MUSCLE_FILTERS[0]
    const equipmentFilter = ACTION_PICKER_EQUIPMENT_FILTERS.find((item) => item.key === pickerEquipment) || ACTION_PICKER_EQUIPMENT_FILTERS[0]
    return actionPickerList.filter((action) => {
      const matchesKeyword = !keyword || getActionPickerSearchText(action).includes(keyword)
      return matchesKeyword && matchesActionPickerFilter(action, muscleFilter) && matchesActionPickerFilter(action, equipmentFilter)
    })
  }, [actionKeyword, actionPickerList, pickerEquipment, pickerMuscle])

  const lightweightProgress = React.useMemo(() => {
    const list = Array.isArray(execution?.action_executions) ? execution.action_executions : []
    return list.reduce((acc, item: ActionExecution) => {
      const actionType = String(actions?.[item?.action_id]?.type || 'STRENGTH').toUpperCase()
      if (!['DIET', 'CARDIO', 'HABIT'].includes(actionType)) {
        return acc
      }

      const completedBySets = (item?.completed_sets || 0) >= Math.max(1, item?.total_sets || 1)
      const completedByStatus = item?.sets?.some((set) => set?.status === 'completed')
      const isCompleted = completedBySets || !!completedByStatus

      acc.total += 1
      if (isCompleted) {
        acc.completed += 1
      } else {
        acc.pending += 1
      }
      return acc
    }, { total: 0, completed: 0, pending: 0 })
  }, [actions, execution?.action_executions])

  const canFinishWholeDay = isImpromptuMode || lightweightProgress.pending <= 0

  const setKeyOf = React.useCallback((actionIndex: number, setIndex: number) => `${actionIndex}:${setIndex}`, [])
  const activeSetKey = React.useMemo(
    () => setKeyOf(expandedAction, currentSetIndex),
    [currentSetIndex, expandedAction, setKeyOf]
  )

  const updateSetDraft = React.useCallback((setKey: string, patch: Partial<SetRecordDraft>) => {
    if (!setKey) return
    setSetDrafts((prev) => {
      const current = prev[setKey] || {
        weight,
        weightInput,
        reps,
        rpe,
        notes: setNotes,
        markAsPR,
        videoUrl
      }
      return {
        ...prev,
        [setKey]: {
          ...current,
          ...patch
        }
      }
    })
  }, [markAsPR, reps, rpe, setNotes, videoUrl, weight, weightInput])

  const clearSetDraft = React.useCallback((setKey: string) => {
    if (!setKey) return
    setSetDrafts((prev) => {
      if (!prev[setKey]) return prev
      const next = { ...prev }
      delete next[setKey]
      return next
    })
  }, [])

  const focusFirstPendingSet = React.useCallback((nextExecution: any) => {
    const actionExecutions = nextExecution?.action_executions || []
    if (actionExecutions.length > 0) {
      const firstPendingActionIdx = actionExecutions.findIndex((action: ActionExecution) =>
        (action.sets || []).some((s: SetData) => s.status === 'pending')
      )
      const targetActionIdx = firstPendingActionIdx >= 0 ? firstPendingActionIdx : 0
      const targetAction = actionExecutions[targetActionIdx]
      const pendingSetIndex = targetAction?.sets?.findIndex((s: SetData) => s.status === 'pending') ?? 0
      setExpandedAction(targetActionIdx)
      setCurrentSetIndex(pendingSetIndex >= 0 ? pendingSetIndex : 0)
    } else {
      setExpandedAction(0)
      setCurrentSetIndex(0)
    }
  }, [])

  const isWeightRequiredForSet = React.useCallback((set?: SetData | null) => {
    if (isTimedTrainingSet(set)) return false
    const planned = String(set?.planned_weight || '').trim().toLowerCase()
    if (!planned) return true
    if (planned.includes('kg')) return true
    if (/^-?\d+(\.\d+)?$/.test(planned)) return true
    if (planned.includes('rm') || planned.includes('%')) return false
    return true
  }, [])

  const hydrateSetInputs = React.useCallback((set?: SetData | null, options?: { allowCompleted?: boolean; action?: any }) => {
    const allowCompleted = !!options?.allowCompleted
    if (!set || (set.status === 'completed' && !allowCompleted)) {
      setWeight(null)
      setWeightInput('')
      setReps(null)
      setRpe(null)
      setSetNotes('')
      setMarkAsPR(false)
      setVideoUrl('')
      setOpenSetMoreKey(null)
      return
    }

    const timed = isTimedTrainingSet(set, options?.action)
    const plannedWeight = timed ? null : getSetWeightDefault(set)
    // No concrete kg in the plan (e.g. "9RM"): start from the weight used on the previous set.
    const defaultWeight = timed || plannedWeight !== null || set.status === 'completed'
      ? plannedWeight
      : previousCompletedWeight(options?.action?.sets, set)
    const defaultReps = timed ? getActualDurationSeconds(set) ?? (set.status === 'completed' ? null : getPlannedDurationSeconds(set, options?.action)) : getSetRepsDefault(set)
    setWeight(defaultWeight)
    setWeightInput(formatInputValue(defaultWeight))
    setReps(defaultReps)
    setRpe(set.rpe ?? null)
    setSetNotes(set.notes || '')
    setMarkAsPR(!!set.is_pr)
    setVideoUrl(set.video_url || '')
  }, [formatInputValue])

  const buildPreviewExecution = React.useCallback(
    (targetInstance: any, actionMap: Record<string, any>, targetDayIndex: number) => {
      const trainingDays = Array.isArray(targetInstance?.training_days) ? targetInstance.training_days : []
      const day = trainingDays.find((item: any) => Number(item?.dayIndex) === Number(targetDayIndex))
      if (!day || day.type !== 'training') {
        return {
          id: `preview-${targetDayIndex}`,
          status: 'preview',
          day_index: targetDayIndex,
          action_executions: []
        }
      }

      const actionSets = Array.isArray(day.actionSets) ? day.actionSets : []
      const actionExecutions: ActionExecution[] = actionSets.map((item: any, actionIdx: number) => {
        const actionId = String(item?.action_id || item?.actionId || '')
        const actionDetail = actionMap[actionId] || {}
        const actionName = String(actionDetail?.name || item?.action_name || item?.set_name || '动作')
        const sets: SetData[] = buildPlannedSetPreviews(item)

        return {
          action_id: actionId || `${actionIdx}`,
          action_name: actionName,
          action_order: actionIdx + 1,
          sets,
          total_sets: sets.length,
          completed_sets: 0
        }
      })

      return {
        id: `preview-${targetDayIndex}`,
        status: 'preview',
        day_index: targetDayIndex,
        action_executions: actionExecutions
      }
    },
    []
  )

  // 开始或恢复训练：先展示本地/计划预览，再用幂等 start 接口拿到真实执行记录。
  const startTraining = React.useCallback(async (requestedIntent?: TrainingIntent) => {
    const loadIntent = requestedIntent || intent
    if (requestedIntent) setIntent(requestedIntent)
    const shouldStart = isImpromptuMode || loadIntent === 'execute'
    setLoadError('')
    setLoadStage('启动训练页')
    setCloudExecutionReady(false)
    setCanStartFromPreview(false)
    if (!userId) {
      setExecution(null)
      setLoading(false)
      setLoadStage('缺少登录态')
      setLoadError('请先登录后再进入训练')
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    if (!isImpromptuMode && !instanceId) {
      setExecution(null)
      setLoading(false)
      setLoadStage('缺少计划参数')
      setLoadError('缺少计划参数，请从今日训练重新进入')
      Taro.showToast({ title: '参数错误', icon: 'none' })
      return
    }

    let hasDisplayableExecution = !!executionRef.current
    try {
      console.log('[training-execution] start load', {
        instanceId,
        impromptuId,
        dayIndex,
        isImpromptuMode,
        scopeKey: executionSnapshotScopeKey
      })
      setLoadStage('读取本地训练快照')
      const snapshot = readTrainingExecutionSnapshot(userId, executionSnapshotScopeKey)
      if (snapshot?.execution) {
        executionRef.current = snapshot.execution
        hasDisplayableExecution = true
        setLoadStage('已展示本地训练内容')
        setExecution(snapshot.execution)
        if (snapshot.actions) setActions(snapshot.actions)
        if (snapshot.planInstance) setPlanInstance(snapshot.planInstance)
        focusFirstPendingSet(snapshot.execution)
        setLoading(false)
      } else {
        setLoading(true)
      }

      if (isImpromptuMode && impromptuId) {
        // 即兴训练：直接获取执行记录
        setLoadStage('同步即兴训练记录')
        const data = await withExecutionLoadTimeout(impromptuService.get(impromptuId), '加载即兴训练')
        if (!data) {
          if (snapshot?.execution) {
            setLoadError('无法核对最新训练状态，当前仅显示上次内容，请重试')
            Taro.showToast({ title: '已使用本地训练记录', icon: 'none' })
            return
          }
          setLoadStage('未找到即兴训练记录')
          setLoadError('没有找到这次即兴训练记录')
          Taro.showToast({ title: '无法加载即兴执行记录', icon: 'none' })
          return
        }
        executionRef.current = data
        hasDisplayableExecution = true
        setCloudExecutionReady(true)
        setExecution(data)
        syncExecutionToCaches(data)
        setPlanInstance({
          id: 'impromptu',
          name: '即兴锻炼',
          description: '即兴训练模式',
          source: 'impromptu'
        })
        // 从 action_executions 构建 actions map
        const actionMap: Record<string, any> = {}
        ;(data.action_executions || []).forEach((item: any) => {
          if (item?.action_id) {
            actionMap[item.action_id] = {
              id: item.action_id,
              name: item.action_name || '动作',
              type: item.type || item.item_type || 'STRENGTH',
              attrs: Array.isArray(item.attrs) ? item.attrs : ['组数', '次数', '强度', '休息时间'],
              category: item.category || null,
              item_schema: item.item_schema || null,
              suggested_time: item.suggested_time || null
            }
          }
        })
        setActions(actionMap)
        focusFirstPendingSet(data)
      } else {
        // 计划训练
        const cachedInstanceRes = snapshot?.planInstance
          ? { instance: snapshot.planInstance, actions: snapshot.actions || {} }
          : null
        if (cachedInstanceRes) {
          console.log('[training-execution] use snapshot plan instance', { instanceId, dayIndex })
          setLoadStage('复用本地计划内容')
        } else {
          console.log('[training-execution] load plan instance', { instanceId, dayIndex })
          setLoadStage('加载计划内容')
        }
        let instanceRes: { instance: any; actions?: Record<string, any>; executionsByDayIndex?: Record<string | number, any>; executions?: any[] } | null = cachedInstanceRes
        let cloudPlanLoaded = false
        try {
          const cloudInstanceRes = await withExecutionLoadTimeout(
            trainingService.getInstance({ id: instanceId }),
            '加载训练计划'
          )
          if (cloudInstanceRes) { instanceRes = cloudInstanceRes; cloudPlanLoaded = true }
          if (cloudInstanceRes?.instance) {
            setCanStartFromPreview(canStartPlanDay({ trainingDays: cloudInstanceRes.instance.training_days || [],
              progressDayIndex: Number((cloudInstanceRes as any).recommendedDayIndex || 1), targetDayIndex: dayIndex,
              executionsByDayIndex: (cloudInstanceRes as any).executionsByDayIndex }))
          }
        } catch (cloudInstanceError) {
          if (!instanceRes) throw cloudInstanceError
          console.warn('[training-execution] cloud plan refresh failed; keep local snapshot', cloudInstanceError)
        }
        const instanceActions = instanceRes?.actions || {}
        if (instanceRes?.actions) setActions(instanceRes.actions)
        if (instanceRes?.instance) setPlanInstance(instanceRes.instance)
        if (!snapshot?.execution && instanceRes?.instance) {
          const previewExecution = buildPreviewExecution(instanceRes.instance, instanceActions, dayIndex)
          if (previewExecution?.action_executions?.length) {
            executionRef.current = previewExecution
            hasDisplayableExecution = true
            setLoadStage('已展示计划预览')
            setExecution(previewExecution)
            focusFirstPendingSet(previewExecution)
            setLoading(false)
          }
        }

        let data: any = null
        let dataConfirmed = false
        if (shouldStart && !hasReadExecutionPlanNotice({ instanceId, userId })) {
          setExecutionNoticeVisible(true)
          return
        }
        if (shouldStart) {
          console.log('[training-execution] sync execution record', { instanceId, dayIndex })
          setLoadStage('同步训练记录')
          data = await withExecutionLoadTimeout(
            executionService.startExecution(instanceId, dayIndex),
            '同步训练记录'
          )
          dataConfirmed = !!data
        }
        if (!data && !shouldStart) {
          const serverExecution = instanceRes?.executionsByDayIndex?.[dayIndex] ||
            instanceRes?.executionsByDayIndex?.[String(dayIndex)] ||
            (Array.isArray(instanceRes?.executions)
              ? instanceRes.executions.find((item: any) => Number(item?.day_index) === Number(dayIndex))
              : null)
          let persistedExecution = cloudPlanLoaded ? serverExecution || null : null
          dataConfirmed = !!persistedExecution
          const snapshotExecutionId = String(snapshot?.execution?.id || '')
          const snapshotIsPersisted = !!snapshotExecutionId && !snapshotExecutionId.startsWith('preview-')
          if (!cloudPlanLoaded && !persistedExecution && snapshotIsPersisted) {
            persistedExecution = await withExecutionLoadTimeout(
              executionService.getExecution(snapshotExecutionId),
              '刷新训练记录'
            ).catch(() => null)
            dataConfirmed = !!persistedExecution
          }
          data = persistedExecution || (!cloudPlanLoaded ? snapshot?.execution : null) ||
            buildPreviewExecution(instanceRes?.instance, instanceActions, dayIndex)
        }

        if (data) {
          executionRef.current = data
          hasDisplayableExecution = true
          const persisted = !!data.id && !String(data.id).startsWith('preview-') && data.status !== 'preview'
          setCloudExecutionReady(persisted && dataConfirmed)
          if (!cloudPlanLoaded && !dataConfirmed) setLoadError('无法核对最新训练状态，当前仅显示上次内容，请重试')
          setLoadStage(persisted ? '已同步训练记录' : '查看计划，尚未开始')
          setExecution(data)
          if (dataConfirmed || (cloudPlanLoaded && !persisted)) syncExecutionToCaches(data)
          focusFirstPendingSet(data)
        } else {
          setLoadStage('没有找到当天训练内容')
          setLoadError('没有找到当天训练内容')
          Taro.showToast({ title: '加载失败', icon: 'none' })
        }
      }
    } catch (e: any) {
      console.error('开始训练失败:', e)
      setLoadError(e?.message || '开始训练失败，请检查网络后重试')
      if (!hasDisplayableExecution && !executionRef.current) {
        setLoadStage('进入训练失败')
        setLoadError(e?.message || '加载失败，请检查网络后重试')
      } else {
        setLoadStage('尚未同步成功，下面仅保留上次内容')
      }
    } finally {
      setLoading(false)
    }
  }, [
    instanceId,
    impromptuId,
    isImpromptuMode,
    dayIndex,
    userId,
    intent,
    buildPreviewExecution,
    executionSnapshotScopeKey,
    focusFirstPendingSet,
    syncExecutionToCaches
  ])

  startTrainingRef.current = startTraining

  const requestStartTraining = React.useCallback((options?: { force?: boolean; intent?: TrainingIntent }) => {
    const runner = startTrainingRef.current
    if (!runner) {
      setLoadStage('等待启动函数')
      return Promise.resolve()
    }
    if (startTrainingInFlightRef.current) {
      return startTrainingInFlightRef.current
    }
    const now = Date.now()
    if (!options?.force && now - lastStartTrainingAtRef.current < 500) {
      return Promise.resolve()
    }
    lastStartTrainingAtRef.current = now
    const runPromise = runner(options?.intent).finally(() => {
      startTrainingInFlightRef.current = null
    })
    startTrainingInFlightRef.current = runPromise
    return runPromise
  }, [])

  React.useEffect(() => {
    void requestStartTraining({ force: true })
  }, [requestStartTraining])

  useDidShow(() => {
    reconcileRestTimer()
    if (Date.now() < suppressAutoRefreshUntilRef.current) return
    if (executionRef.current && !loadError) return
    void requestStartTraining({ force: true })
  })

  React.useEffect(() => {
    if (!loading || execution) return undefined
    const timer = setTimeout(() => {
      if (executionRef.current || !loadingRef.current) return
      setLoadStage('页面启动超时')
      setLoadError('页面启动没有完成，请点击重试；如果仍然失败，请从今日训练页重新进入。')
      setLoading(false)
    }, EXECUTION_BOOT_WATCHDOG_MS)
    return () => clearTimeout(timer)
  }, [execution, loading])

  usePullDownRefresh(() => {
    requestStartTraining({ force: true }).finally(() => Taro.stopPullDownRefresh())
  })

  React.useEffect(() => {
    const current = execution?.action_executions?.[expandedAction]?.sets?.[currentSetIndex]
    const currentKey = current ? setKeyOf(expandedAction, currentSetIndex) : null
    const draft = currentKey ? setDrafts[currentKey] : null
    if (current && draft && !(current.status === 'completed' && editingSetKey !== currentKey)) {
      setWeight(draft.weight)
      setWeightInput(draft.weightInput)
      setReps(draft.reps)
      setRpe(draft.rpe)
      setSetNotes(draft.notes)
      setMarkAsPR(draft.markAsPR)
      setVideoUrl(draft.videoUrl)
      return
    }
    hydrateSetInputs(current, {
      allowCompleted: !!currentKey && editingSetKey === currentKey,
      action: execution?.action_executions?.[expandedAction]
    })
  }, [editingSetKey, execution, expandedAction, currentSetIndex, hydrateSetInputs, setDrafts, setKeyOf])

  React.useEffect(() => {
    if (!isResting) return undefined

    const updateRestTimer = () => {
      const remaining = Math.ceil((restTimerDeadlineAtRef.current - Date.now()) / 1000)
      if (remaining <= 0) {
        setRestTimer(0)
        setIsResting(false)
        setRestTimerMinimized(false)
        clearPersistedRestTimer()
        return
      }
      setRestTimer(remaining)
    }

    updateRestTimer()
    const timer = setInterval(updateRestTimer, 1000)

    return () => clearInterval(timer)
  }, [clearPersistedRestTimer, isResting])

  React.useEffect(() => {
    if (!restTimerStorageKey || !execution?.id || isResting) return
    reconcileRestTimer(true)
  }, [execution?.id, isResting, reconcileRestTimer, restTimerStorageKey])

  React.useEffect(() => {
    if (!trainingTimerStorageKey || !execution || isPreviewExecution) {
      setElapsedTrainingSeconds(0)
      return undefined
    }

    const executionStartedAt = parseTimestamp(execution?.started_at)
    const executionCompletedAt = parseTimestamp(execution?.completed_at)
    const executionRecordedEndAt = parseTimestamp(
      execution?.completed_at || execution?.last_saved_at || execution?.ended_at
    )

    // Read-only previews are not workout sessions. Only a persisted execution
    // with both timestamps may show a historical duration; never start or
    // restore a local running timer in read-only mode.
    if (isReadOnly) {
      try {
        Taro.removeStorageSync(trainingTimerStorageKey)
      } catch {
        // Best effort only.
      }
      if (executionStartedAt && executionRecordedEndAt) {
        setElapsedTrainingSeconds(Math.max(0, Math.floor((executionRecordedEndAt - executionStartedAt) / 1000)))
      } else {
        setElapsedTrainingSeconds(0)
      }
      return undefined
    }

    let storedStartedAt: number | null = null

    try {
      const stored = Taro.getStorageSync(trainingTimerStorageKey) as any
      storedStartedAt = parseTimestamp(stored?.startedAt || stored?.started_at || stored)
    } catch {
      storedStartedAt = null
    }

    const startedAt = storedStartedAt || executionStartedAt || Date.now()

    if (!storedStartedAt && !executionCompletedAt) {
      try {
        Taro.setStorageSync(trainingTimerStorageKey, {
          startedAt,
          executionId: execution?.id || '',
          scopeKey: executionSnapshotScopeKey
        })
      } catch {
        // Timer persistence is a UX aid; never block the workout page on storage failure.
      }
    }

    const updateElapsed = () => {
      const endAt = executionCompletedAt || Date.now()
      setElapsedTrainingSeconds(Math.max(0, Math.floor((endAt - startedAt) / 1000)))
    }

    updateElapsed()
    if (executionCompletedAt) return undefined

    const timer = setInterval(updateElapsed, 1000)
    return () => clearInterval(timer)
  }, [
    execution,
    execution?.completed_at,
    execution?.ended_at,
    execution?.id,
    execution?.last_saved_at,
    execution?.started_at,
    executionSnapshotScopeKey,
    isPreviewExecution,
    isReadOnly,
    trainingTimerStorageKey
  ])

  // 选择视频（注意：微信小程序本地存储约 10MB 限制，视频过大会触发 writeFile 超限，建议大视频用「粘贴链接」）
  const handleChooseVideo = async () => {
    if (uploadingVideo || cancelling || completing) return
    if (isReadOnly && !(canCorrectCompletedSets && editingSetKey === setKeyOf(expandedAction, currentSetIndex))) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!execution?.id) return
    if (blockUntilExecutionReady()) return
    const actionId = execution?.action_executions?.[expandedAction]?.action_id
    if (!actionId) return
    const targetExecutionId = execution.id
    const targetActionIndex = expandedAction
    const targetSetIndex = currentSetIndex
    const patchCurrentSetVideoUrl = (url: string) => {
      const baseExecution = executionRef.current || execution
      const actionExecutions = Array.isArray(baseExecution?.action_executions) ? baseExecution.action_executions : []
      const targetAction = actionExecutions[targetActionIndex]
      const targetSet = targetAction?.sets?.[targetSetIndex]
      if (!targetAction || !targetSet) return

      const updatedExecution = { ...baseExecution }
      const updatedActionExecutions = [...actionExecutions]
      const updatedAction = { ...targetAction }
      const updatedSets = [...(targetAction.sets || [])]
      updatedSets[targetSetIndex] = {
        ...targetSet,
        video_url: url
      }
      updatedAction.sets = updatedSets
      updatedActionExecutions[targetActionIndex] = updatedAction
      updatedExecution.action_executions = updatedActionExecutions
      executionRef.current = updatedExecution
      setExecution(updatedExecution)
      syncExecutionToCaches(updatedExecution)
    }

    try {
      suppressAutoRefreshUntilRef.current = Date.now() + 120000
      const res = await Taro.chooseVideo({
        sourceType: ['album', 'camera'],
        maxDuration: 30, // 缩短以减小体积，避免本地存储超限
        compressed: true, // 压缩后再上传
        camera: 'back'
      })
      const maxTrainingVideoBytes = 50 * 1024 * 1024
      if (res.size > maxTrainingVideoBytes) {
        Taro.showToast({ title: '单个训练视频请小于 50MB', icon: 'none' })
        return
      }
      setUploadingVideo(true)
      const uploadRes = await executionService.uploadSetVideo(
        res.tempFilePath,
        targetExecutionId,
        actionId,
        targetSetIndex + 1,
        { fileSize: Number((res as any).size || 0), isImpromptu: isImpromptuMode, actionIndex: targetActionIndex }
      )
      const url = uploadRes?.video_url || uploadRes?.url
      if (url) {
        setVideoUrl(url)
        updateSetDraft(setKeyOf(targetActionIndex, targetSetIndex), { videoUrl: url })
        patchCurrentSetVideoUrl(url)
        Taro.showToast({ title: '视频上传成功', icon: 'success' })
      } else {
        Taro.showToast({ title: '上传失败', icon: 'none' })
      }
    } catch (e: any) {
      console.error('选择视频失败:', e)
      const msg = e?.errMsg || e?.message || '选择视频失败'
      const hint = msg.includes('storage limit') || msg.includes('file storage')
        ? '本地存储已满或视频过大，请用「粘贴链接」上传'
        : msg
      Taro.showToast({ title: hint, icon: 'none', duration: 3000 })
    } finally {
      setUploadingVideo(false)
      suppressAutoRefreshUntilRef.current = Date.now() + 3000
    }
  }

  // 粘贴视频链接
  const handlePasteVideoLink = async () => {
    if (uploadingVideo || cancelling || completing) return
    if (isReadOnly && !(canCorrectCompletedSets && editingSetKey === setKeyOf(expandedAction, currentSetIndex))) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!execution?.id) return
    if (blockUntilExecutionReady()) return
    const actionId = execution?.action_executions?.[expandedAction]?.action_id
    if (!actionId) return
    const targetActionIndex = expandedAction
    const targetSetIndex = currentSetIndex
    const patchCurrentSetVideoUrl = (url: string) => {
      const baseExecution = executionRef.current || execution
      const actionExecutions = Array.isArray(baseExecution?.action_executions) ? baseExecution.action_executions : []
      const targetAction = actionExecutions[targetActionIndex]
      const targetSet = targetAction?.sets?.[targetSetIndex]
      if (!targetAction || !targetSet) return

      const updatedExecution = { ...baseExecution }
      const updatedActionExecutions = [...actionExecutions]
      const updatedAction = { ...targetAction }
      const updatedSets = [...(targetAction.sets || [])]
      updatedSets[targetSetIndex] = {
        ...targetSet,
        video_url: url
      }
      updatedAction.sets = updatedSets
      updatedActionExecutions[targetActionIndex] = updatedAction
      updatedExecution.action_executions = updatedActionExecutions
      executionRef.current = updatedExecution
      setExecution(updatedExecution)
      syncExecutionToCaches(updatedExecution)
    }

    Taro.showModal({
      title: '粘贴视频链接',
      editable: true,
      placeholderText: '请输入视频链接（如B站、YouTube等）',
      success: async (res) => {
        if (res.confirm && res.content) {
          try {
            setUploadingVideo(true)
            const linkRes = await executionService.addSetVideoLink(
              execution.id,
              actionId,
              targetSetIndex + 1,
              res.content,
              { isImpromptu: isImpromptuMode, actionIndex: targetActionIndex }
            )
            if (linkRes) {
              const url = linkRes.video_url || res.content
              setVideoUrl(url)
              updateSetDraft(setKeyOf(targetActionIndex, targetSetIndex), { videoUrl: url })
              patchCurrentSetVideoUrl(url)
              Taro.showToast({ title: '链接添加成功', icon: 'success' })
            } else {
              Taro.showToast({ title: '添加失败', icon: 'none' })
            }
          } catch (e: any) {
            Taro.showToast({ title: (e as Error).message || '添加失败', icon: 'none' })
          } finally {
            setUploadingVideo(false)
          }
        }
      }
    })
  }

  const handleBackToTodayTraining = React.useCallback(() => {
    Taro.navigateBack().catch(() => {
      Taro.redirectTo({ url: '/training/today-training' }).catch(() => {
        Taro.switchTab({ url: '/training/today-training' }).catch(() => {
          Taro.showToast({ title: '跳转失败，请手动返回', icon: 'none' })
        })
      })
    })
  }, [])

  // 完成一组
  const handleCompleteSet = async () => {
    if (cancelling || uploadingVideo) return
    if (!execution) return
    if (blockUntilExecutionReady()) return
    if (completionMutationRef.current) return

    const actionExecutions = execution.action_executions || []
    const currentAction = actionExecutions[expandedAction]
    if (!currentAction) return

    // 验证必填项
    const currentSet = currentAction.sets[currentSetIndex]
    if (!currentSet) return
    const currentSetKey = setKeyOf(expandedAction, currentSetIndex)
    const isEditing = editingSetKey === currentSetKey
    const mayCorrectCompletedSet =
      canCorrectCompletedSets && currentSet.status === 'completed' && isEditing
    if (isReadOnly && !mayCorrectCompletedSet) {
      Taro.showToast({ title: '训练已结束，仅可修改已完成组', icon: 'none' })
      return
    }

    const timed = isTimedTrainingSet(currentSet, currentAction)
    if (timed && (reps === null || reps <= 0)) {
      Taro.showToast({ title: '请输入保持时长（秒）', icon: 'none' })
      return
    }
    if (!timed && isWeightRequiredForSet(currentSet) && (weight === null || weight === undefined)) {
      Taro.showToast({ title: '请输入重量', icon: 'none' })
      return
    }

    try {
      completionMutationRef.current = true
      setCompleting(true)

      const data = isImpromptuMode
        ? await impromptuService.completeSet(
            execution.id,
            expandedAction,
            currentSetIndex,
            { actualWeight: timed ? null : weight, actualReps: timed ? null : reps, actualDuration: timed ? reps : undefined, notes: setNotes, rpe, isPR: markAsPR }
          )
        : await executionService.completeSet(
            execution.id,
            expandedAction,
            currentSetIndex,
            {
              actualWeight: timed ? null : weight,
              actualReps: timed ? null : reps,
              actualDuration: timed ? reps : undefined,
              rpe: rpe,
              notes: setNotes,
              videoUrl: videoUrl || undefined,
              isPR: markAsPR,
              actionId: currentAction.action_id,
              hasVideo: !!videoUrl
            }
          )

      if (data) {
        // 更新本地状态
        const updatedExecution = { ...execution }
        const updatedActionExecutions = [...updatedExecution.action_executions]
        const updatedAction = { ...updatedActionExecutions[expandedAction] }
        const updatedSets = [...updatedAction.sets]
        updatedSets[currentSetIndex] = {
          ...updatedSets[currentSetIndex],
          status: 'completed',
          actual_weight: timed ? null : weight,
          actual_reps: timed ? null : reps,
          ...(timed ? { actual_duration: reps } : {}),
          rpe: rpe,
          notes: setNotes,
          video_url: videoUrl,
          is_pr: markAsPR,
          e1rm: timed ? null : data?.autoE1RM?.e1rm ?? updatedSets[currentSetIndex]?.e1rm,
          is_auto_pr: !!data?.autoE1RM?.isPR
        }
        updatedAction.sets = updatedSets
        updatedAction.completed_sets = updatedSets.filter((s: SetData) => s.status === 'completed').length
        updatedActionExecutions[expandedAction] = updatedAction
        updatedExecution.action_executions = updatedActionExecutions
        setExecution(updatedExecution)
        syncExecutionToCaches(updatedExecution)

        // 重置输入状态
        setWeight(null)
        setWeightInput('')
        setReps(null)
        setRpe(null)
        setSetNotes('')
        setMarkAsPR(false)
        setVideoUrl('')
        setOpenSetMoreKey(null)
        setEditingSetKey(null)
        setExpandedSetKey(currentSetKey)
        clearSetDraft(currentSetKey)

        if (!isEditing) {
          const restSeconds = Number(currentSet.planned_rest_seconds || 90)
          if (Number.isFinite(restSeconds) && restSeconds > 0) {
            setRestTimer(restSeconds)
            setIsResting(true)
            setRestTimerMinimized(false)
            persistRestTimer(restSeconds, execution.id)
          }

          // 移动到下一组
          const nextSetIndex = updatedSets.findIndex((s: SetData, idx: number) => idx > currentSetIndex && s.status === 'pending')
          if (nextSetIndex >= 0) {
            setCurrentSetIndex(nextSetIndex)
          } else {
            // 当前动作完成，移动到下一个动作
            const nextActionIndex = updatedActionExecutions.findIndex((a: ActionExecution, idx: number) => idx > expandedAction && a.completed_sets < a.total_sets)
            if (nextActionIndex >= 0) {
              setExpandedAction(nextActionIndex)
              const nextAction = updatedActionExecutions[nextActionIndex]
              const nextPendingSet = nextAction.sets?.findIndex((s: SetData) => s.status === 'pending') ?? 0
              setCurrentSetIndex(nextPendingSet >= 0 ? nextPendingSet : 0)
            } else {
              const allCompleted = updatedActionExecutions.every((a: ActionExecution) => a.completed_sets >= a.total_sets)
              if (allCompleted) {
                Taro.showToast({ title: '全部动作已完成，可点击「完成训练」', icon: 'none', duration: 1800 })
              }
            }
          }
        }

        Taro.showToast({ title: isEditing ? '已更新本组' : '完成', icon: 'success' })
      } else {
        Taro.showToast({ title: '保存失败', icon: 'none' })
      }
    } catch (e: any) {
      console.error('完成组失败:', e)
      Taro.showToast({ title: e.message || '保存失败', icon: 'none' })
    } finally {
      completionMutationRef.current = false
      setCompleting(false)
    }
  }

  const handlePostFinishFlow = React.useCallback((_sharePath?: string) => {
    setShowWorkoutSummary(true)
  }, [])

  // 完成训练
  const handleFinishTraining = async () => {
    if (isReadOnly && !canLateCompleteTimedOut) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!execution) return
    if (blockUntilExecutionReady()) return

    if (!isImpromptuMode && !canFinishWholeDay) {
      Taro.showModal({
        title: '轻任务未完成',
        content: `还有 ${lightweightProgress.pending} 个轻任务待打卡，请先完成后再结束训练。`,
        confirmText: '返回今日安排',
        cancelText: '继续训练',
        success: (res) => {
          if (res.confirm) {
            handleBackToTodayTraining()
          }
        }
      })
      return
    }

    const actionExecutions = execution.action_executions || []
    const totalSets = actionExecutions.reduce((sum: number, item: ActionExecution) => sum + (item.total_sets || 0), 0)
    const completedSets = actionExecutions.reduce((sum: number, item: ActionExecution) => sum + (item.completed_sets || 0), 0)
    const pendingSets = Math.max(0, totalSets - completedSets)
    const modalContent = pendingSets > 0
      ? `还有 ${pendingSets} 组未完成，确认现在结束训练吗？`
      : '确定要完成本次训练吗？'

    Taro.showModal({
      title: '确认完成训练',
      content: modalContent,
      success: async (res) => {
        if (res.confirm) {
          try {
            setCompleting(true)

            const finishRes = isImpromptuMode
              ? await impromptuService.finish(impromptuId)
              : await executionService.finishTraining(execution.id)

            if (finishRes !== null) {
              const finishedExecution = {
                ...execution,
                ...finishRes,
                action_executions: Array.isArray(finishRes?.action_executions)
                  ? finishRes.action_executions
                  : execution.action_executions
              }
              setExecution(finishedExecution)
              syncExecutionToCaches(finishedExecution)

              if (!isImpromptuMode && dayIndex) {
                Taro.setStorageSync(RETURN_CONFIRM_STORAGE_KEY, {
                  instanceId,
                  dayIndex,
                  ts: Date.now()
                })
              }

              let sharePath = ''

              if (!isImpromptuMode && execution?.id) {
                try {
                  const shareInfo = await executionService.getShareInfo(execution.id)
                  if (shareInfo?.shareToken) {
                    sharePath = buildPublicTrainingSharePath(shareInfo.shareToken)
                    Taro.setStorageSync('last_training_share_path', sharePath)
                  }
                } catch (e: any) {
                  console.error('获取分享信息失败:', e)
                }
              }

              // Coach plans ask for feedback inside the summary page (no separate dialog).
              setShowFeedbackDialog(shouldAskCoachFeedback)
              handlePostFinishFlow(sharePath)
            } else {
              Taro.showToast({ title: '完成失败', icon: 'none' })
            }
          } catch (e: any) {
            Taro.showToast({ title: e.message || '完成失败', icon: 'none' })
          } finally {
            setCompleting(false)
          }
        }
      }
    })
  }

  const handleQuickFinishTraining = async () => {
    if (isReadOnly) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!execution) return
    if (blockUntilExecutionReady()) return

    if (!isImpromptuMode && !canFinishWholeDay) {
      Taro.showModal({
        title: '轻任务未完成',
        content: `还有 ${lightweightProgress.pending} 个轻任务待打卡，请先完成后再结束训练。`,
        confirmText: '返回今日安排',
        cancelText: '继续训练',
        success: (res) => {
          if (res.confirm) {
            handleBackToTodayTraining()
          }
        }
      })
      return
    }

    const actionExecutions = execution.action_executions || []
    const totalSets = actionExecutions.reduce((sum: number, item: ActionExecution) => sum + (item.total_sets || 0), 0)
    const completedSets = actionExecutions.reduce((sum: number, item: ActionExecution) => sum + (item.completed_sets || 0), 0)
    const pendingSets = Math.max(0, totalSets - completedSets)

    if (pendingSets <= 0) {
      await handleFinishTraining()
      return
    }

    Taro.showModal({
      title: '确认一键完成训练',
      content: `还有 ${pendingSets} 组未完成，将按计划默认值自动补齐后完成训练，是否继续？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            setCompleting(true)

            const finishRes = isImpromptuMode
              ? await impromptuService.finish(impromptuId, { mode: 'quick' })
              : await executionService.finishTraining({ executionId: execution.id, mode: 'quick' })

            if (finishRes !== null) {
              const finishedExecution = {
                ...execution,
                ...finishRes,
                action_executions: Array.isArray(finishRes?.action_executions)
                  ? finishRes.action_executions
                  : execution.action_executions
              }
              setExecution(finishedExecution)
              syncExecutionToCaches(finishedExecution)

              if (!isImpromptuMode && dayIndex) {
                Taro.setStorageSync(RETURN_CONFIRM_STORAGE_KEY, {
                  instanceId,
                  dayIndex,
                  ts: Date.now()
                })
              }

              let sharePath = ''

              if (!isImpromptuMode && execution?.id) {
                try {
                  const shareInfo = await executionService.getShareInfo(execution.id)
                  if (shareInfo?.shareToken) {
                    sharePath = buildPublicTrainingSharePath(shareInfo.shareToken)
                    Taro.setStorageSync('last_training_share_path', sharePath)
                  }
                } catch (e: any) {
                  console.error('获取分享信息失败:', e)
                }
              }

              // Coach plans ask for feedback inside the summary page (no separate dialog).
              setShowFeedbackDialog(shouldAskCoachFeedback)
              handlePostFinishFlow(sharePath)
            } else {
              Taro.showToast({ title: '完成失败', icon: 'none' })
            }
          } catch (e: any) {
            Taro.showToast({ title: e.message || '完成失败', icon: 'none' })
          } finally {
            setCompleting(false)
          }
        }
      }
    })
  }

  const handleRestartTimedOutTraining = () => {
    if (!canLateCompleteTimedOut || !instanceId || !userId || restartingTimedOut) return
    Taro.showModal({
      title: '重新训练这一天？',
      content: '原来的训练内容会保留为超时记录，并从 0 开始一条新的训练。',
      confirmText: '重新训练',
      cancelText: '保留记录',
      confirmColor: '#CF6D4E',
      success: async (res) => {
        if (!res.confirm) return
        try {
          setRestartingTimedOut(true)
          setCloudExecutionReady(false)
          const data = await executionService.startExecution(instanceId, dayIndex, { restartTimedOut: true })
          if (!data) return
          executionRef.current = data
          setExecution(data)
          setCloudExecutionReady(true)
          syncExecutionToCaches(data)
          focusFirstPendingSet(data)
          setElapsedTrainingSeconds(0)
          Taro.showToast({ title: '已开始新的训练', icon: 'success' })
        } catch (error: any) {
          setLoadError(error?.message || '重新开始失败，请重新核对并重试')
        } finally {
          setRestartingTimedOut(false)
        }
      }
    })
  }

  // 完成非力量项目（饮食/有氧/习惯）
  const handleCompleteItem = async (actionIndex: number) => {
    if (isReadOnly) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!execution) return
    if (blockUntilExecutionReady()) return
    if (completionMutationRef.current) return
    const actionExec = execution.action_executions[actionIndex]
    const action = actions[actionExec?.action_id]
    const itemType = (action?.type || 'STRENGTH') as 'DIET' | 'CARDIO' | 'HABIT'
    if (itemType === 'STRENGTH') return

    const state = itemStates[actionIndex] || {}
    const cardioDistance = state.cardioDistance !== null && state.cardioDistance !== undefined
      ? Number(state.cardioDistance)
      : null
    const cardioDuration = state.cardioDuration !== null && state.cardioDuration !== undefined
      ? Number(state.cardioDuration)
      : null
    if (itemType === 'CARDIO') {
      const hasDistance = Number.isFinite(cardioDistance) && (cardioDistance as number) > 0
      const hasDuration = Number.isFinite(cardioDuration) && (cardioDuration as number) > 0
      if (!hasDistance && !hasDuration) {
        Taro.showToast({ title: '请填写有氧距离或时长', icon: 'none' })
        return
      }
    }

    try {
      completionMutationRef.current = true
      setCompleting(true)
      const res = await executionService.completeItem({
        executionId: execution.id,
        actionIndex,
        itemType,
        completed: true,
        actualContent: itemType === 'DIET' ? state.dietContent : undefined,
        actualDistance: itemType === 'CARDIO' && Number.isFinite(cardioDistance) && (cardioDistance as number) > 0
          ? (cardioDistance as number) * 1000
          : undefined,
        actualDuration: itemType === 'CARDIO' && Number.isFinite(cardioDuration) && (cardioDuration as number) > 0
          ? (cardioDuration as number) * 60
          : undefined
      })
      if (res) {
        const updated = { ...execution }
        const ae = updated.action_executions[actionIndex]
        if (ae?.sets?.[0]) {
          ae.sets[0] = {
            ...ae.sets[0],
            status: 'completed',
            diet_content: state.dietContent,
            actual_distance: Number.isFinite(cardioDistance) && (cardioDistance as number) > 0
              ? (cardioDistance as number) * 1000
              : undefined,
            actual_duration: Number.isFinite(cardioDuration) && (cardioDuration as number) > 0
              ? (cardioDuration as number) * 60
              : undefined
          }
        }
        ae.completed_sets = 1
        setExecution(updated)
        syncExecutionToCaches(updated)
        setItemStates((prev) => ({ ...prev, [actionIndex]: {} }))
        Taro.showToast({ title: '完成', icon: 'success' })
        const nextIdx = (updated.action_executions || []).findIndex(
          (item: ActionExecution, idx: number) => idx > actionIndex && item.completed_sets < item.total_sets
        )
        if (nextIdx >= 0) {
          setExpandedAction(nextIdx)
          const nextPendingSet = updated.action_executions[nextIdx]?.sets?.findIndex((s: SetData) => s.status === 'pending') ?? 0
          setCurrentSetIndex(nextPendingSet >= 0 ? nextPendingSet : 0)
        } else {
          const allCompleted = (updated.action_executions || []).every(
            (item: ActionExecution) => item.completed_sets >= item.total_sets
          )
          if (allCompleted) {
            Taro.showToast({ title: '全部动作已完成，可点击「完成训练」', icon: 'none', duration: 1800 })
          }
        }
      } else {
        Taro.showToast({ title: '保存失败', icon: 'none' })
      }
    } catch (e: any) {
      Taro.showToast({ title: e.message || '保存失败', icon: 'none' })
    } finally {
      completionMutationRef.current = false
      setCompleting(false)
    }
  }

  // 添加额外组
  const handleAddExtraSet = async (actionIndex: number) => {
    if (isReadOnly) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!execution || addingExtraSet) return
    if (blockUntilExecutionReady()) return
    const actionExec = execution.action_executions[actionIndex]
    const existingSets = Array.isArray(actionExec?.sets) ? actionExec.sets : []
    const sourceSet = findInheritableSourceSet(existingSets)
    const inheritedSet = buildInheritedExtraSet(sourceSet, actionExec)
    const inheritedWeight = getSetWeightDefault(sourceSet)
    const inheritedReps = getSetRepsDefault(sourceSet)
    const inheritedRest = getSetRestDefault(sourceSet)
    const inheritedPlanWeight = inheritedSet.planned_weight || inheritedWeight
    const inheritedPlanReps = inheritedSet.planned_reps || inheritedReps
    try {
      setAddingExtraSet(true)
      const res = isImpromptuMode
        ? await impromptuService.addExtraSet(execution.id, actionIndex, {
            weight: inheritedPlanWeight,
            reps: inheritedPlanReps,
            restSeconds: inheritedRest
          })
        : await executionService.addExtraSet(execution.id, actionIndex, {
            weight: inheritedPlanWeight,
            reps: inheritedPlanReps,
            restSeconds: inheritedRest
          })
      if (res) {
        const updated = { ...execution }
        const ae = updated.action_executions[actionIndex]
        ae.sets.push({
          ...inheritedSet,
          set_number: res.newSetIndex + 1,
          set_index: res.newSetIndex,
          source: 'student_extra'
        })
        ae.total_sets = ae.sets.length
        setExecution(updated)
        syncExecutionToCaches(updated)
        setCurrentSetIndex(res.newSetIndex)
        hydrateSetInputs(ae.sets[res.newSetIndex], { action: ae })
        Taro.showToast({ title: `已添加第${res.newSetIndex + 1}组`, icon: 'success' })
      } else {
        Taro.showToast({ title: '添加失败', icon: 'none' })
      }
    } catch (e: any) {
      Taro.showToast({ title: (e as Error).message || '添加失败', icon: 'none' })
    } finally {
      setAddingExtraSet(false)
    }
  }

  // 加载动作列表（用于添加动作）
  const loadActionPicker = React.useCallback(async () => {
    try {
      const [myRes, publicRes] = await Promise.allSettled([
        studentActionLibService.listActions({ page: 1, limit: 1000 }),
        listPublicActions({ page: 1, limit: 200, viewerActionType: 'student' })
      ])

      if (myRes.status === 'rejected') {
        console.error('[training-execution] load my actions failed:', myRes.reason)
      }
      if (publicRes.status === 'rejected') {
        console.error('[training-execution] load public actions failed:', publicRes.reason)
      }

      const myActions: PickerAction[] = myRes.status === 'fulfilled'
        ? (myRes.value?.actions || [])
          .filter((a: any) => String(a?.type || 'STRENGTH').toUpperCase() === 'STRENGTH')
          .map((a: any) => ({
            ...a,
            name: normalizeActionName(a) || '未命名动作',
            source: 'mine' as const
          }))
        : []
      const myNameSet = new Set(myActions.map((a) => normalizeActionName(a)).filter(Boolean))
      const publicActions: PickerAction[] = publicRes.status === 'fulfilled'
        ? (publicRes.value?.actions || [])
          .filter((a: any) => String(a?.type || 'STRENGTH').toUpperCase() === 'STRENGTH')
          .filter((a: any) => !myNameSet.has(normalizeActionName(a)))
          .map((a: any) => ({
            ...a,
            name: normalizeActionName(a) || '未命名动作',
            source: 'public' as const
          }))
        : []
      const list = [...myActions, ...publicActions]
        .sort((a, b) => {
          if (a.source !== b.source) return a.source === 'mine' ? -1 : 1
          return String(a?.name || '').localeCompare(String(b?.name || ''), 'zh-CN')
        })
      setActionPickerList(list)
      setActionKeyword('')
      setPickerMuscle('all')
      setPickerEquipment('all')
      setPickerSelectedActionIds([])
      if (list.length === 0) {
        Taro.showToast({ title: '动作库暂无可添加动作', icon: 'none' })
      }
    } catch (error) {
      console.error('[training-execution] load action picker failed:', error)
      setActionPickerList([])
      Taro.showToast({ title: '加载动作失败', icon: 'none' })
    }
  }, [])

  // 删除额外组（仅限 student_extra）
  const handleDeleteExtraSet = async (actionIndex: number, setIdx: number) => {
    if (isReadOnly) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!execution || removingSet) return
    if (blockUntilExecutionReady()) return
    const actionExec = execution.action_executions[actionIndex]
    const set = actionExec?.sets?.[setIdx]
    if (set?.source !== 'student_extra') return
    Taro.showModal({
      title: '删除组',
      content: '确定要删除这组吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          setRemovingSet(true)
          const ok = isImpromptuMode
            ? await impromptuService.deleteExtraSet(execution.id, actionIndex, setIdx)
            : await executionService.deleteExtraSet(execution.id, actionIndex, setIdx)
          if (ok) {
            const updated = { ...execution }
            const ae = updated.action_executions[actionIndex]
            ae.sets.splice(setIdx, 1)
            ae.sets.forEach((s: any, i: number) => { s.set_number = i + 1 })
            ae.total_sets = ae.sets.length
            setExecution(updated)
            syncExecutionToCaches(updated)
            const nextIndex = Math.max(0, Math.min(currentSetIndex, ae.sets.length - 1))
            setCurrentSetIndex(nextIndex)
            Taro.showToast({ title: '已删除', icon: 'success' })
          } else {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        } catch (e: any) {
          Taro.showToast({ title: e.message || '删除失败', icon: 'none' })
        } finally {
          setRemovingSet(false)
        }
      }
    })
  }

  // 删除额外动作（仅限 student_extra）
  const handleDeleteExtraExercise = async (actionIndex: number) => {
    if (isReadOnly) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!execution || removingAction) return
    if (blockUntilExecutionReady()) return
    const actionExec = execution.action_executions[actionIndex]
    if (actionExec?.source !== 'student_extra') return
    Taro.showModal({
      title: '删除动作',
      content: `确定要删除「${actionExec.action_name}」吗？`,
      success: async (res) => {
        if (!res.confirm) return
        try {
          setRemovingAction(true)
          const ok = isImpromptuMode
            ? await impromptuService.deleteExtraExercise(execution.id, actionIndex)
            : await executionService.deleteExtraExercise(execution.id, actionIndex)
          if (ok) {
            const updated = { ...execution }
            updated.action_executions.splice(actionIndex, 1)
            setExecution(updated)
            syncExecutionToCaches(updated)
            setExpandedAction(Math.min(expandedAction, Math.max(0, updated.action_executions.length - 1)))
            setCurrentSetIndex(0)
            Taro.showToast({ title: '已删除', icon: 'success' })
          } else {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        } catch (e: any) {
          Taro.showToast({ title: e.message || '删除失败', icon: 'none' })
        } finally {
          setRemovingAction(false)
        }
      }
    })
  }

  const handleTogglePickerAction = (actionId: string) => {
    setPickerSelectedActionIds((prev) => (
      prev.includes(actionId) ? prev.filter((id) => id !== actionId) : [...prev, actionId]
    ))
  }

  // 添加额外动作
  const handleAddExtraExercises = async (targetActions: any[]) => {
    if (isReadOnly) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    const normalizedActions = targetActions.filter((action) => action?.id)
    if (normalizedActions.length === 0) {
      Taro.showToast({ title: '请先选择动作', icon: 'none' })
      return
    }
    if (!execution || addingExtraAction) return
    if (blockUntilExecutionReady()) return
    try {
      setAddingExtraAction(true)
      const updated = {
        ...execution,
        action_executions: [...(execution.action_executions || [])]
      }
      const nextActionMap = { ...actions }
      let latestActionIndex = updated.action_executions.length - 1
      let addedCount = 0

      for (const action of normalizedActions) {
        let actionForTraining = action
        if (action.source === 'public') {
          try {
            actionForTraining = await addPublicToMyLib(action.id) as PickerAction
          } catch (error: any) {
            if (!String(error?.message || '').includes('同名动作')) throw error
            const fallback = await studentActionLibService.listActions({
              page: 1,
              limit: 10,
              search: normalizeActionName(action)
            })
            const matched = (fallback?.actions || []).find((item: any) => normalizeActionName(item) === normalizeActionName(action))
            if (!matched?.id) throw error
            actionForTraining = { ...matched, source: 'mine' }
          }
        }
        const actionId = actionForTraining.id
        const actionName = normalizeActionName(actionForTraining) || normalizeActionName(action) || '未知动作'

        const res = isImpromptuMode
          ? await impromptuService.addExtraExercise(execution.id, actionId, actionName, [{ weight: null, reps: null }])
          : await executionService.addExtraExercise(execution.id, actionId, actionName)
        if (!res) continue

        const nextOrder = Number.isFinite(Number(res.newActionIndex))
          ? Number(res.newActionIndex) + 1
          : updated.action_executions.length + 1
        updated.action_executions.push({
          action_id: actionId,
          action_name: actionName,
          attrs: actionForTraining.attrs,
          type: actionForTraining.type || 'STRENGTH',
          action_order: nextOrder,
          source: 'student_extra',
          sets: [{ set_number: 1, status: 'pending', planned_weight: '', planned_reps: '', source: 'student_extra' }],
          total_sets: 1,
          completed_sets: 0
        })
        nextActionMap[actionId] = {
          ...actionForTraining,
          id: actionId,
          name: actionName,
          source: 'mine'
        }
        latestActionIndex = updated.action_executions.length - 1
        addedCount += 1
      }

      if (addedCount > 0) {
        setActions(nextActionMap)
        setExecution(updated)
        syncExecutionToCaches(updated)
        setExpandedAction(latestActionIndex)
        setCurrentSetIndex(0)
        setPickerSelectedActionIds([])
        setShowActionPicker(false)
        Taro.showToast({ title: `已添加 ${addedCount} 个动作`, icon: 'success' })
      } else {
        Taro.showToast({ title: '添加失败', icon: 'none' })
      }
    } catch (e: any) {
      Taro.showToast({ title: (e as Error).message || '添加失败', icon: 'none' })
    } finally {
      setAddingExtraAction(false)
    }
  }

  const handleAddSelectedPickerActions = () => {
    const selectedSet = new Set(pickerSelectedActionIds)
    const selectedActions = actionPickerList.filter((action) => selectedSet.has(action.id))
    void handleAddExtraExercises(selectedActions)
  }

  const handleOpenActionLibrary = () => {
    if (addingExtraAction) return
    void Taro.navigateTo({
      url: '/me/action-lib/index?tab=public&mode=plan-select&itemType=STRENGTH',
      success: ({ eventChannel }) => {
        eventChannel.on('selectPlanAction', (selectedAction: PickerAction) => {
          if (!selectedAction?.id || !selectedAction?.name) return
          void handleAddExtraExercises([selectedAction])
        })
      }
    })
  }

  const actionExecutions = execution?.action_executions || []
  const currentAction = actionExecutions[expandedAction]
  const currentSet = currentAction?.sets?.[currentSetIndex]

  const adjustWeightValue = (set: SetData | null | undefined, delta: number) => {
    const currentValue = parseInputNumber(weightInput, 'float')
    const plannedValue = parseFirstNumber(set?.planned_weight)
    const base = currentValue ?? weight ?? plannedValue ?? 0
    const next = Math.max(0, Math.round((base + delta) * 10) / 10)
    const nextInput = formatKgValueForGym(next)
    setWeight(next)
    setWeightInput(nextInput)
    updateSetDraft(activeSetKey, { weight: next, weightInput: nextInput })
  }

  const handleOpenActionDetail = (actionExec: ActionExecution, actionDetail: any, actionIndex: number) => {
    const actionId = String(actionExec?.action_id || actionDetail?.id || '')
    if (!actionId) {
      Taro.showToast({ title: '暂无动作详情', icon: 'none' })
      return
    }

    const sourceIndex = Number(actionExec?.source_action_index ?? actionIndex)
    void openActionTeaching({ ...actionDetail, id: actionId, name: actionExec.action_name || actionDetail?.name,
      url: actionDetail?.url || actionDetail?.video_url }, {
      instanceId: isImpromptuMode ? undefined : instanceId, dayIndex, actionIndex: sourceIndex,
      coachNote: getPlanActionNote(planInstance, dayIndex, actionExec, actionIndex)
    })
  }

  const handleCopyVideoUrl = (url?: string | null) => {
    const value = String(url || '').trim()
    if (!value) return
    Taro.setClipboardData({
      data: value,
      success: () => {
        Taro.showToast({ title: '视频链接已复制', icon: 'success' })
      }
    })
  }

  const handlePreviewSetVideo = async (url?: string | null) => {
    const value = String(url || '').trim()
    if (!value) {
      Taro.showToast({ title: '暂无视频', icon: 'none' })
      return
    }
    try {
      await Taro.previewMedia({
        sources: [{ url: value, type: 'video' }],
        current: 0
      })
    } catch {
      Taro.navigateTo({
        url: `/common/common/video-player?url=${encodeURIComponent(value)}&title=${encodeURIComponent('本组视频')}`
      }).catch(() => handleCopyVideoUrl(value))
    }
  }

  const adjustRepsValue = (set: SetData | null | undefined, delta: number) => {
    const plannedValue = parseFirstNumber(set?.planned_reps)
    const base = reps ?? plannedValue ?? 0
    const next = Math.max(0, Math.floor(base + delta))
    setReps(next)
    updateSetDraft(activeSetKey, { reps: next })
  }

  const handleExpandAction = (actionIdx: number) => {
    if (uploadingVideo || completing || cancelling) return
    setExpandedAction(actionIdx)
    setExpandedSetKey(null)
    setEditingSetKey(null)
    const nextAction = actionExecutions[actionIdx]
    const pendingIdx = nextAction?.sets?.findIndex((s: SetData) => s.status === 'pending') ?? -1
    if (pendingIdx >= 0) {
      setCurrentSetIndex(pendingIdx)
      return
    }
    setCurrentSetIndex(0)
  }

  const handlePressSet = (actionIdx: number, setIdx: number) => {
    if (uploadingVideo || completing || cancelling) return
    const targetSet = actionExecutions?.[actionIdx]?.sets?.[setIdx]
    if (!targetSet) return

    const targetKey = setKeyOf(actionIdx, setIdx)
    if (targetSet.status === 'completed') {
      setExpandedSetKey((prev) => (prev === targetKey ? null : targetKey))
      return
    }

    setExpandedAction(actionIdx)
    setCurrentSetIndex(setIdx)
    setExpandedSetKey(null)
    setOpenSetMoreKey(null)
    setEditingSetKey(null)
  }

  const handleEditCompletedSet = (actionIdx: number, setIdx: number, set: SetData) => {
    if (uploadingVideo || completing || cancelling) return
    const targetKey = setKeyOf(actionIdx, setIdx)
    setExpandedAction(actionIdx)
    setCurrentSetIndex(setIdx)
    setExpandedSetKey(targetKey)
    setEditingSetKey(targetKey)
    setOpenSetMoreKey(set.notes || set.video_url ? targetKey : null)
    hydrateSetInputs(set, { allowCompleted: true, action: actionExecutions[actionIdx] })
  }

  const handleCancelEditCompletedSet = () => {
    if (uploadingVideo || completing || cancelling) return
    setEditingSetKey(null)
    setOpenSetMoreKey(null)
    const current = actionExecutions?.[expandedAction]?.sets?.[currentSetIndex]
    hydrateSetInputs(current, { action: actionExecutions?.[expandedAction] })
  }

  const handleSkipRest = () => {
    setRestTimer(0)
    setIsResting(false)
    setRestTimerMinimized(false)
    clearPersistedRestTimer()
  }

  const handleAddRestTime = (seconds: number) => {
    const deadlineRemaining = restTimerDeadlineAtRef.current > 0
      ? Math.ceil((restTimerDeadlineAtRef.current - Date.now()) / 1000)
      : restTimer
    const next = Math.max(0, deadlineRemaining + seconds)
    setRestTimer(next)
    if (next <= 0) {
      setIsResting(false)
      setRestTimerMinimized(false)
      clearPersistedRestTimer()
      return
    }
    persistRestTimer(next, execution.id)
    setIsResting(true)
  }

  const handleMinimizeRestTimer = () => {
    if (!isResting) return
    setRestTimerMinimized(true)
  }

  // 计算总进度
  const totalSets = actionExecutions.reduce((sum: number, a: ActionExecution) => sum + (a.total_sets || 0), 0)
  const completedSets = actionExecutions.reduce((sum: number, a: ActionExecution) => sum + (a.completed_sets || 0), 0)
  const pendingSetsCount = Math.max(0, totalSets - completedSets)
  const shouldShowQuickFinishButton =
    !isImpromptuMode && !isTimedOutExecution && canFinishWholeDay && pendingSetsCount > 0
  const canCancelTraining =
    !isImpromptuMode &&
    !isReadOnly &&
    isPersistedInProgressExecution &&
    canCancelEmptyPlanExecution(execution)

  const handleCancelTraining = () => {
    if (!canCancelTraining || !execution?.id || !instanceId || !userId || cancelling) return

    Taro.showModal({
      title: '取消本次训练？',
      content: '仅取消尚无已保存记录的本次训练，恢复为未开始。未保存的输入也会丢弃。已有记录的训练请保留并返回。',
      confirmText: '确认取消',
      cancelText: '继续训练',
      confirmColor: '#CF6D4E',
      success: async (res) => {
        if (!res.confirm) return
        try {
          setCancelling(true)
          const cancelled = await executionService.cancelExecution(execution.id)
          if (!cancelled) return

          removeTrainingExecutionFromStorage({
            userId,
            scopeKey: executionSnapshotScopeKey,
            instanceId,
            dayIndex
          })
          clearPersistedRestTimer()
          if (trainingTimerStorageKey) {
            try {
              Taro.removeStorageSync(trainingTimerStorageKey)
            } catch {
              // Best effort only.
            }
          }
          setIsResting(false)
          setRestTimer(0)
          setRestTimerMinimized(false)
          setElapsedTrainingSeconds(0)
          Taro.showToast({ title: '训练已取消', icon: 'success' })
          handleBackToTodayTraining()
        } catch (error: any) {
          Taro.showToast({ title: error?.message || '取消失败，记录已保留', icon: 'none' })
        } finally {
          setCancelling(false)
        }
      }
    })
  }

  const completedActions = actionExecutions.reduce((sum: number, a: ActionExecution) => {
    return sum + ((a.completed_sets || 0) >= (a.total_sets || 0) ? 1 : 0)
  }, 0)
  const planTitle = String(planInstance?.name || (isImpromptuMode ? '即兴锻炼' : '训练执行')).trim()
  const heroTimerValue = formatTimerValue(elapsedTrainingSeconds)
  const heroTimerLabel = execution?.completed_at
    ? '本次用时'
    : isTimedOutExecution
      ? '已记录时长'
      : '训练总时长'
  const currentActualSummary = currentSet && isTimedTrainingSet(currentSet, currentAction) ? formatRecordedTrainingSet(currentSet, currentAction) : currentSet
    ? [
        currentSet.actual_weight !== null && currentSet.actual_weight !== undefined ? `${currentSet.actual_weight}kg` : null,
        currentSet.actual_reps !== null && currentSet.actual_reps !== undefined ? `${currentSet.actual_reps}次` : null,
        currentSet.rpe ? `RPE ${currentSet.rpe}` : null
      ].filter(Boolean).join(' · ')
    : ''
  const workoutSummary = (() => {
    let totalVolume = 0
    let completedSetTotal = 0
    let cardioDistanceKm = 0
    let cardioRecordedMinutes = 0
    let calories = 0
    const muscleScores: Record<string, number> = {}
    const actionRows = actionExecutions.map((action: ActionExecution) => {
      const detail = actions[action.action_id] || {}
      const actionType = String(detail?.type || action.type || action.item_type || 'STRENGTH').toUpperCase()
      const completed = (action.sets || []).filter((set: SetData) => set.status === 'completed')
      const actionVolume = completed.reduce((sum: number, set: SetData) => {
        return sum + getTrainingSetVolume(set, action)
      }, 0)
      const muscles = inferMusclesForAction(action, detail)
      const score = actionVolume > 0 ? actionVolume : completed.length * 50
      muscles.forEach((muscle) => {
        muscleScores[muscle] = (muscleScores[muscle] || 0) + score
      })
      totalVolume += actionVolume
      completedSetTotal += completed.length
      const actionDistanceKm = completed.reduce((sum: number, set: SetData) => (
        sum + Math.max(0, Number(set.actual_distance || 0)) / 1000
      ), 0)
      const actionDurationMin = completed.reduce((sum: number, set: SetData) => (
        sum + Math.max(0, Number(set.actual_duration || 0)) / 60
      ), 0)
      const actionCalories = Math.max(0, Number(action.energy_estimate?.calories || 0))
      if (actionType === 'CARDIO') {
        cardioDistanceKm += actionDistanceKm
        cardioRecordedMinutes += actionDurationMin
      }
      calories += actionCalories
      return {
        id: action.action_id,
        name: action.action_name || detail?.name || '动作',
        setsCount: completed.length,
        volume: actionVolume,
        type: actionType,
        distanceKm: actionDistanceKm,
        durationMin: actionDurationMin,
        calories: actionCalories,
        sets: completed.map((set: SetData, setIndex: number) => {
          const hasActualWeight =
            set.actual_weight !== null &&
            set.actual_weight !== undefined &&
            Number.isFinite(Number(set.actual_weight))
          const actualWeight = hasActualWeight ? Number(set.actual_weight) : null
          const plannedWeight = String(set.planned_weight || '').trim()
          const plannedWeightNumber = isConcreteWeightValue(plannedWeight)
            ? parseFirstNumber(plannedWeight)
            : null
          const weightText = actualWeight !== null
            ? actualWeight > 0
              ? `${formatKgValueForGym(actualWeight)}kg`
              : '自重'
            : plannedWeightNumber !== null
              ? `${formatKgValueForGym(plannedWeightNumber)}kg`
              : plannedWeight || '自重'
          const hasActualReps =
            set.actual_reps !== null &&
            set.actual_reps !== undefined &&
            Number.isFinite(Number(set.actual_reps))
          const repsText = hasActualReps
            ? String(Math.max(0, Math.round(Number(set.actual_reps))))
            : String(set.planned_reps || '完成').trim()

          return {
            setNumber: Number(set.set_number || set.set_index || setIndex + 1),
            weightText,
            repsText,
            recordText: formatPosterSetText(set, action),
            isPr: !!set.is_pr
          }
        }),
        muscles
      }
    }).filter((item) => item.setsCount > 0)

    const startedAt = execution?.started_at ? new Date(execution.started_at).getTime() : NaN
    const completedAt = execution?.completed_at ? new Date(execution.completed_at).getTime() : Date.now()
    const durationMin = Number.isFinite(startedAt) && Number.isFinite(completedAt)
      ? Math.max(1, Math.round((completedAt - startedAt) / 60000))
      : 0
    const muscles = Object.entries(muscleScores)
      .sort((a, b) => b[1] - a[1])
      .map(([label, score]) => ({ label, score }))

    return {
      totalVolume,
      completedSetTotal,
      cardioDistanceKm,
      cardioRecordedMinutes,
      calories,
      durationMin,
      muscles,
      actionRows
    }
  })()
  const heatmapMuscles = workoutSummary.muscles.map((item) => item.label)
  const heatmapFrontLayers = heatmapMuscles
    .map((muscle) => WORKOUT_POSTER_BODY_MAP_LAYERS[muscle]?.front)
    .filter((src): src is string => Boolean(src))
  const heatmapBackLayers = heatmapMuscles
    .map((muscle) => WORKOUT_POSTER_BODY_MAP_LAYERS[muscle]?.back)
    .filter((src): src is string => Boolean(src))
  const workoutSummaryMaxScore = Math.max(1, ...workoutSummary.muscles.map((item) => item.score))
  const workoutPlannedSetTotal = actionExecutions.reduce((sum: number, item: ActionExecution) => sum + (item.total_sets || 0), 0)
  const workoutPrSets: Array<{ key: string; name: string; setNumber: number; record: string }> = []
  workoutSummary.actionRows.forEach((row: any) => {
    ;(row.sets || []).filter((set: any) => set.isPr).forEach((set: any) => {
      workoutPrSets.push({ key: `${row.id}-${set.setNumber}`, name: row.name, setNumber: set.setNumber, record: set.recordText })
    })
  })
  const isWorkoutCompleted = isCompletedExecution
  const canOpenWorkoutSummary = isWorkoutCompleted && workoutSummary.completedSetTotal > 0
  const posterNickname = String(currentUser?.nickname || currentUser?.name || '训练者').trim() || '训练者'
  const posterAvatarUrl = String(
    currentUser?.avatar_url || currentUser?.avatarUrl || currentUser?.image || ''
  ).trim()
  const workoutPosterData = React.useMemo<WorkoutPosterData>(() => ({
    dateLabel: formatWorkoutPosterDateLabel(execution?.completed_at || execution?.started_at),
    nickname: posterNickname,
    trainingDaysLabel: '本次训练已完成',
    avatarUrl: posterAvatarUrl,
    title: planTitle || '训练完成',
    subtitle: isImpromptuMode ? '即兴锻炼' : `训练计划 · 第 ${dayIndex} 天`,
    totalVolume: workoutSummary.totalVolume,
    completedSetTotal: workoutSummary.completedSetTotal,
    durationMin: workoutSummary.durationMin,
    muscles: workoutSummary.muscles,
    actionRows: workoutSummary.actionRows,
    frontBodyMap: posterFrontBase,
    backBodyMap: posterBackBase,
    frontBodyMapLayers: heatmapFrontLayers,
    backBodyMapLayers: heatmapBackLayers,
    shareUrl: 'https://coachlink.fit',
    shareMode: 'brand'
  }), [
    dayIndex,
    execution?.completed_at,
    execution?.started_at,
    heatmapBackLayers,
    heatmapFrontLayers,
    isImpromptuMode,
    planTitle,
    posterAvatarUrl,
    posterNickname,
    workoutSummary.actionRows,
    workoutSummary.completedSetTotal,
    workoutSummary.durationMin,
    workoutSummary.muscles,
    workoutSummary.totalVolume
  ])
  const {
    generate: generateWorkoutPoster,
    generating: workoutPosterGenerating
  } = useSharePoster<WorkoutPosterData>({
    canvasId: WORKOUT_POSTER_CANVAS_ID,
    width: WORKOUT_POSTER_WIDTH,
    draw: (ctx, data, canvas) => drawWorkoutPoster(ctx, data, canvas)
  })

  const saveWorkoutPosterImage = React.useCallback((imagePath: string) => {
    if (!imagePath) return
    Taro.saveImageToPhotosAlbum({
      filePath: imagePath,
      success: () => Taro.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: (err: { errMsg?: string }) => {
        if (err.errMsg?.includes('auth deny') || err.errMsg?.includes('authorize')) {
          Taro.showModal({
            title: '需要相册权限',
            content: '请允许保存图片到相册。',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) Taro.openSetting()
            }
          })
          return
        }
        const message = String(err?.errMsg || '')
        console.error('[training-execution] save workout poster failed', err)
        if (message.includes('no such file') || message.includes('file not exist')) {
          Taro.showToast({ title: '图片文件已失效，请重新生成', icon: 'none' })
          return
        }
        Taro.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
      }
    })
  }, [])

  const handleGenerateWorkoutPoster = React.useCallback(async () => {
    if (!canOpenWorkoutSummary) {
      Taro.showToast({ title: '暂无可分享的训练记录', icon: 'none' })
      return
    }

    Taro.showLoading({ title: '生成分享图' })
    let enhancedPosterData = workoutPosterData
    if (!isImpromptuMode && execution?.id && !String(execution.id).startsWith('preview-')) {
      try {
        const shareInfo = await executionService.getShareInfo(String(execution.id))
        if (shareInfo) {
          const shareToken = String(shareInfo.shareToken || '').trim()
          const monthlyTrainingDays = Array.isArray(shareInfo.monthlyTrainingDays)
            ? shareInfo.monthlyTrainingDays.length
            : 0
          enhancedPosterData = {
            ...workoutPosterData,
            dateLabel: formatWorkoutPosterDateLabel(
              shareInfo.completedAt || execution?.completed_at || execution?.started_at
            ),
            nickname: String(shareInfo.user?.nickname || workoutPosterData.nickname).trim() || workoutPosterData.nickname,
            avatarUrl: String(shareInfo.user?.avatarUrl || workoutPosterData.avatarUrl).trim(),
            trainingDaysLabel: monthlyTrainingDays > 0
              ? `本月训练 ${monthlyTrainingDays} 天`
              : workoutPosterData.trainingDaysLabel,
            title: String(shareInfo.planName || workoutPosterData.title).trim() || workoutPosterData.title,
            subtitle: `训练计划 · 第 ${Number(shareInfo.dayIndex || dayIndex)} 天`,
            shareUrl: shareToken
              ? `https://coachlink.fit/public/training/${encodeURIComponent(shareToken)}`
              : workoutPosterData.shareUrl,
            shareMode: shareToken ? 'record' : 'brand'
          }
        }
      } catch (error) {
        console.warn('[training-execution] workout share info unavailable, using local poster data', error)
      }
    }

    // 临时图片路径可能被微信清理；每次操作都重新导出并持久化，不复用旧路径。
    const imagePath = await generateWorkoutPoster(enhancedPosterData)
    Taro.hideLoading()
    if (!imagePath) return

    const platform = String(Taro.getDeviceInfo?.().platform || '')
    if (platform === 'devtools') {
      Taro.showModal({
        title: '分享图已生成',
        content: '微信开发者工具不能打开好友或群聊选择器，也没有手机相册。可先预览生成结果；真机中可直接发送给好友或群聊。',
        showCancel: false,
        confirmText: '预览图片',
        success: (res) => {
          if (!res.confirm) return
          Taro.previewImage({
            current: imagePath,
            urls: [imagePath],
            fail: (error) => {
              console.error('[training-execution] preview workout poster failed', error)
              Taro.showToast({ title: '预览失败，请重新生成', icon: 'none' })
            }
          })
        }
      })
      return
    }

    const showShareImageMenu = (Taro as any).showShareImageMenu
    if (typeof showShareImageMenu === 'function') {
      showShareImageMenu({
        path: imagePath,
        fail: (err: { errMsg?: string }) => {
          const message = String(err?.errMsg || '')
          if (message.includes('cancel')) return
          console.error('[training-execution] showShareImageMenu failed', err)
          Taro.showModal({
            title: '分享图已生成',
            content: '当前环境不能直接调起好友或群聊分享，可先保存到相册再发送。',
            confirmText: '保存图片',
            success: (res) => {
              if (res.confirm) saveWorkoutPosterImage(imagePath)
            }
          })
        }
      })
      return
    }

    Taro.showModal({
      title: '分享图已生成',
      content: '当前基础库不支持直接发送给好友或群聊，可先保存到相册再发送。',
      confirmText: '保存图片',
      success: (res) => {
        if (res.confirm) saveWorkoutPosterImage(imagePath)
      }
    })
  }, [
    canOpenWorkoutSummary,
    dayIndex,
    execution?.completed_at,
    execution?.id,
    execution?.started_at,
    generateWorkoutPoster,
    isImpromptuMode,
    saveWorkoutPosterImage,
    workoutPosterData
  ])

  const handleLeaveAfterSummary = () => {
    setShowWorkoutSummary(false)
    handleBackToTodayTraining()
  }

  /** "完成" on the summary page: send the optional coach feedback, then leave. */
  const handleCompleteSummary = async () => {
    if (feedbackSubmitting) return
    const content = feedbackContent.trim()
    if (showFeedbackDialog && content && execution?.id) {
      setFeedbackSubmitting(true)
      try {
        const res = await executionService.submitFeedback({
          executionId: execution.id,
          content,
          difficultyRating: feedbackDifficulty
        })
        Taro.showToast({ title: res ? '反馈已发送' : '反馈发送失败，已继续', icon: res ? 'success' : 'none' })
      } catch (e: any) {
        const message = String(e?.message || '')
        Taro.showToast({ title: message.includes('已提交过反馈') ? '本次训练已提交过反馈' : '反馈发送失败，已继续', icon: 'none' })
      } finally {
        setFeedbackSubmitting(false)
      }
    }
    setShowFeedbackDialog(false)
    setFeedbackContent('')
    setFeedbackDifficulty(3)
    handleLeaveAfterSummary()
  }

  const executionNoticePopup = <ExecutionPlanNoticePopup visible={executionNoticeVisible}
    executionNotice={planInstance?.execution_notice || planInstance?.executionNotice || null}
    planName={planInstance?.name || null} planSource={planInstance?.source === 'self' ? 'self' : 'coach'}
    onClose={() => { setExecutionNoticeVisible(false); setLoadError('请先阅读执行须知，再开始训练') }}
    onConfirm={() => {
      markExecutionPlanNoticeRead({ instanceId, userId })
      setExecutionNoticeVisible(false)
      void requestStartTraining({ force: true, intent: 'execute' })
    }} confirmLabel='我已阅读，开始训练' />

  if (loading && !execution) {
    return (
      <View className={`training-execution-page tx-v1 theme-${effectiveTheme}${effectiveTheme === 'dark' ? ' cl-theme-dark' : ''}`}>
        {process.env.NODE_ENV === 'development' ? <LocalDebugBanner /> : null}
        <View className="loading-wrap">
          <Text className="loading-title">正在进入训练</Text>
          <Text className="loading-stage">{loadStage}</Text>
          <Text className="loading-desc">如果网络较慢，稍后会自动给出重试入口。</Text>
        </View>
      </View>
    )
  }

  if (!execution) {
    return (
      <View className={`training-execution-page tx-v1 theme-${effectiveTheme}${effectiveTheme === 'dark' ? ' cl-theme-dark' : ''}`}>
        {process.env.NODE_ENV === 'development' ? <LocalDebugBanner /> : null}
        {executionNoticePopup}
        <View className="error-wrap">
          <Text className="error-title">暂时进不去训练</Text>
          <Text className="loading-stage">{loadStage}</Text>
          <Text className="error-desc">{loadError || '加载失败，请从今日训练重新进入或稍后重试。'}</Text>
          <View className="error-actions">
            <Button className="error-primary-btn" onClick={() => void requestStartTraining({ force: true })}>重试</Button>
            <Button className="error-secondary-btn" onClick={() => Taro.navigateBack()}>返回</Button>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className={`training-execution-page tx-v1 theme-${effectiveTheme}${effectiveTheme === 'dark' ? ' cl-theme-dark' : ''}`}>
      {process.env.NODE_ENV === 'development' ? <LocalDebugBanner /> : null}
      {executionNoticePopup}
      {loadError ? (
        <View className='error-wrap execution-status-banner'>
          <Text className='error-title'>训练尚未就绪</Text>
          <Text className='error-desc'>{loadError}</Text>
          <Button className='error-primary-btn' onClick={() => void requestStartTraining({ force: true })}>重新核对并重试</Button>
        </View>
      ) : null}
      {!isImpromptuMode && intent === 'preview' ? (
        <View className='error-wrap execution-status-banner'>
          <Text className='error-desc'>这是计划预览，尚未开始训练。</Text>
          {canStartFromPreview ? <Button className='error-primary-btn'
            onClick={() => void requestStartTraining({ force: true, intent: 'execute' })}>开始这一天的训练</Button>
            : <Button className='error-secondary-btn' onClick={() => void requestStartTraining({ force: true })}>刷新训练资格</Button>}
        </View>
      ) : null}
      <View className="execution-scroll">
        <View className="execution-shell">
          {isWorkoutCompleted && (
            <View className="workout-complete-entry">
              <Text className="workout-complete-title">本次训练已完成</Text>
              <Text className="workout-complete-hint">
                {canOpenWorkoutSummary ? '生成打卡图，分享这次训练。' : '训练已记录，暂无可生成打卡图的完成组。'}
              </Text>
              {canOpenWorkoutSummary && (
                <Button className="workout-checkin-button" loading={workoutPosterGenerating}
                  disabled={workoutPosterGenerating} onClick={handleGenerateWorkoutPoster}>
                  生成打卡图
                </Button>
              )}
            </View>
          )}
          <View className="hero-section">
            <View className="hero-compact">
              <View className="hero-compact__row">
                <View className="hero-compact__copy">
                  {!isImpromptuMode && (
                    <Text className="hero-compact__kicker">{`${intent === 'preview' ? '计划预览 · ' : isCompletedExecution ? '训练记录 · ' : isTimedOutExecution ? '待处理训练 · ' : !cloudExecutionReady ? '尚未开始 · ' : ''}第${dayIndex}天`}</Text>
                  )}
                  <Text className="hero-compact__title">{planTitle || '训练执行'}</Text>
                </View>
                <View className="hero-compact__timer">
                  <Text className="hero-compact__timer-value cl-num">{heroTimerValue}</Text>
                  <Text className="hero-compact__timer-label">{heroTimerLabel}</Text>
                </View>
              </View>
              {actionExecutions.length > 0 && (
                <View className="hero-compact__segments">
                  {actionExecutions.map((item: ActionExecution, index: number) => (
                    <View
                      key={index}
                      className={`hero-compact__segment ${item.completed_sets >= item.total_sets ? 'hero-compact__segment--done' : index === expandedAction ? 'hero-compact__segment--current' : ''}`}
                    />
                  ))}
                </View>
              )}
              <View className="hero-compact__meta-row">
                <Text className="hero-compact__meta cl-num">
                  {`${actionExecutions.length}个动作 · ${completedSets}/${totalSets}组 · 完成${completedActions}个`}
                  {lightweightProgress.pending > 0 ? ` · 轻任务待完成${lightweightProgress.pending}` : ''}
                </Text>
                {currentActualSummary ? <Text className="hero-chip success">{currentActualSummary}</Text> : null}
                {isTimedOutExecution ? <Text className="hero-chip warning">已超过5小时</Text> : null}
              </View>
            </View>
          </View>

          <View className="actions-section">
            {actionExecutions.map((action: ActionExecution, actionIdx: number) => {
              const actionDetail = actions[action.action_id]
              const actionType = String(actionDetail?.type || 'STRENGTH').toUpperCase()
              const actionMeta = getActionTypeMeta(actionType)
              const isStrength = actionType === 'STRENGTH'
              const isExpanded = expandedAction === actionIdx
              const isCompleted = action.completed_sets >= action.total_sets
              const firstSet = action.sets?.[0]
              const actionSummary = isStrength
                ? [
                    firstSet?.planned_weight || null,
                    formatPlannedRepsText(firstSet) || null,
                    firstSet?.planned_intensity || null,
                    formatRestSummary(firstSet?.planned_rest_seconds)
                  ].filter(Boolean).join(' · ')
                : actionMeta.cue
              const planActionNote = getPlanActionNote(planInstance, dayIndex, action, actionIdx)

              return (
                <View
                  key={actionIdx}
                  className={`action-card action-tone-${actionType.toLowerCase()} ${isExpanded ? 'expanded' : ''} ${isCompleted ? 'completed' : ''}`}
                >
                  <View className="action-header" onClick={() => handleExpandAction(actionIdx)}>
                    <View className="action-info">
                      {actionDetail?.reference_image_url ? (
                        <Image
                          className="action-thumb"
                          src={resolveWeappImageThumbnailUrl(actionDetail.reference_image_url, 240)}
                          mode="aspectFit"
                          lazyLoad
                        />
                      ) : (
                        <Text className="action-number">{actionIdx + 1}</Text>
                      )}
                      <View className="action-copy">
                        <Text className="action-name">{action.action_name || actionDetail?.name || '未知动作'}</Text>
                        <View className="action-meta-row">
                          <Text className="action-type-pill">{actionMeta.label}</Text>
                          {actionSummary ? <Text className="action-summary">{actionSummary}</Text> : null}
                        </View>
                        <View className="action-reference-row">
                          <Text className="action-reference-chip" onClick={(e) => {
                            e.stopPropagation()
                            handleOpenActionDetail(action, actionDetail, actionIdx)
                          }}>动作讲解</Text>
                        </View>
                      </View>
                    </View>
                    <View className="action-progress">
                      <Text className={`action-progress-pill ${isCompleted ? 'done' : ''}`}>{action.completed_sets}/{action.total_sets}组</Text>
                      {!isReadOnly && action.source === 'student_extra' && (
                        <Text
                          className="action-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteExtraExercise(actionIdx)
                          }}
                        >
                          删除
                        </Text>
                      )}
                    </View>
                  </View>

                {isExpanded && (
                  <View className="action-content">
                    {planActionNote && (
                      <View className="coach-plan-note">
                        <Text className="coach-plan-note-label">教练备注</Text>
                        <Text className="coach-plan-note-text">{planActionNote}</Text>
                      </View>
                    )}
                    {isStrength ? (
                      <>
                        <View className="sets-list">
                          {action.sets?.map((set: SetData, setIdx: number) => {
                            const isCurrentSet = setIdx === currentSetIndex
                            const isCompletedSet = set.status === 'completed'
                            const setKey = setKeyOf(actionIdx, setIdx)
                            const isExpandedSet = expandedSetKey === setKey
                            const isEditingThisSet = editingSetKey === setKey
                            const showSetForm = isCurrentSet && (
                              (!isReadOnly && (!isCompletedSet || isEditingThisSet)) ||
                              (canCorrectCompletedSets && isCompletedSet && isEditingThisSet)
                            )
                            const setDraft = setDrafts[setKey]
                            const timedSet = isTimedTrainingSet(set, action)
                            const plannedWeightText = String(set.planned_weight || '').trim()
                            const plannedRepsText = formatPlannedRepsText(set)
                            const plannedSummary = [
                              !timedSet ? plannedWeightText || null : null,
                              plannedRepsText || null,
                              set.planned_intensity || null
                            ].filter(Boolean).join(' · ')
                            const actualSummary = timedSet ? formatRecordedTrainingSet(set, action) : [
                              set.actual_weight !== null && set.actual_weight !== undefined ? `${set.actual_weight}kg` : null,
                              set.actual_reps !== null && set.actual_reps !== undefined ? `${set.actual_reps}次` : null,
                              set.rpe ? `RPE ${set.rpe}` : null
                            ].filter(Boolean).join(' · ')
                            const draftSummary = timedSet && setDraft ? (setDraft.reps ? `保持 ${setDraft.reps} 秒` : '') : setDraft
                              ? [
                                  setDraft.weight !== null && setDraft.weight !== undefined ? `${formatKgValueForGym(setDraft.weight)}kg` : null,
                                  setDraft.reps !== null && setDraft.reps !== undefined ? `${setDraft.reps}次` : null,
                                  setDraft.rpe ? `RPE ${setDraft.rpe}` : null
                                ].filter(Boolean).join(' · ')
                              : ''
                            const mainSummary = isCompletedSet
                              ? actualSummary || '已完成'
                              : draftSummary || plannedSummary || (isCurrentSet ? '填写本组' : '未填写')
                            const stateText = isEditingThisSet
                              ? '编辑中'
                              : isCompletedSet
                                ? '已完成'
                                : isCurrentSet
                                  ? '当前组'
                                  : '待完成'
                            const isMoreOpen = openSetMoreKey === setKey
                            const draftVideoUrl = setDraft?.videoUrl || ''
                            const activeVideoUrl = (isCurrentSet ? videoUrl : '') || draftVideoUrl || set.video_url || ''
                            const hasAttachedVideo = !!activeVideoUrl
                            const moreSummary = [
                              (isCurrentSet ? setNotes : '') || setDraft?.notes || set.notes ? '有备注' : null,
                              hasAttachedVideo ? '有视频' : null
                            ].filter(Boolean).join(' · ')

                            return (
                              <View
                                key={setIdx}
                                className={`set-item ${isCurrentSet ? 'current' : ''} ${isCompletedSet ? 'completed' : ''} ${isExpandedSet ? 'expanded-details' : ''}`}
                              >
                                <View className="set-header" onClick={() => handlePressSet(actionIdx, setIdx)}>
                                  <View className="set-index-pill">
                                    <Text className="set-index-number">{set.set_number}</Text>
                                    <Text className="set-index-label">组</Text>
                                  </View>
                                  <View className="set-header-main">
                                    <View className="set-header-top">
                                      <Text className="set-main-summary">{mainSummary}</Text>
                                      <Text className={`set-state-pill ${isCompletedSet ? 'done' : isCurrentSet ? 'active' : ''}`}>{stateText}</Text>
                                    </View>
                                    <View className="set-header-bottom">
                                      <Text className="set-subline">{formatRestSummary(set.planned_rest_seconds)}</Text>
                                      {set.is_pr && <Text className="set-tag pr">PR</Text>}
                                      {set.is_auto_pr && !timedSet && <Text className="set-tag auto">新纪录</Text>}
                                      {set.video_url && <Text className="set-tag">视频</Text>}
                                      {set.notes && <Text className="set-tag">备注</Text>}
                                    </View>
                                  </View>
                                  {!isReadOnly && set.source === 'student_extra' && (
                                    <Text
                                      className="set-delete-btn"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteExtraSet(actionIdx, setIdx)
                                      }}
                                    >
                                      删除
                                    </Text>
                                  )}
                                </View>

                                {showSetForm && (
                                  <View className="set-record-form">
                                    <View className={`record-inline-row ${timedSet ? 'timed' : ''}`}>
                                      {!timedSet && <View className="record-input-cell weight">
                                        <Text className="record-input-label">外加重量</Text>
                                        <View className="record-adjust-input">
                                          <View className="record-value-wrap">
                                            <Input
                                              type="digit"
                                              className="record-inline-input"
                                              value={weightInput}
                                              placeholder={set.planned_weight ? String(set.planned_weight) : '填重量'}
                                              onInput={(e) => {
                                                const rawValue = e.detail.value
                                                const parsed = parseInputNumber(rawValue, 'float')
                                                setWeightInput(rawValue)
                                                setWeight(parsed)
                                                updateSetDraft(setKey, { weightInput: rawValue, weight: parsed })
                                              }}
                                            />
                                            <Text className="record-unit">kg</Text>
                                          </View>
                                          <View className="record-stepper">
                                            <Text className="record-stepper-hit" onClick={(e) => {
                                              e.stopPropagation()
                                              adjustWeightValue(set, WEIGHT_STEP_KG)
                                            }}>+</Text>
                                            <Text className="record-stepper-divider" />
                                            <Text className="record-stepper-hit" onClick={(e) => {
                                              e.stopPropagation()
                                              adjustWeightValue(set, -WEIGHT_STEP_KG)
                                            }}>-</Text>
                                          </View>
                                        </View>
                                      </View>}
                                      <View className="record-input-cell reps">
                                        <Text className="record-input-label">{timedSet ? '保持时长' : '次数'}</Text>
                                        <View className="record-adjust-input">
                                          <View className="record-value-wrap">
                                            <Input
                                              type="number"
                                              className="record-inline-input"
                                              value={reps !== null && reps !== undefined ? String(reps) : ''}
                                              placeholder={String(set.planned_reps || '0')}
                                              onInput={(e) => {
                                                const parsed = parseInputNumber(e.detail.value, 'int')
                                                const nextReps = parsed === null ? null : Math.max(0, Math.floor(parsed))
                                                setReps(nextReps)
                                                updateSetDraft(setKey, { reps: nextReps })
                                              }}
                                            />
                                            <Text className="record-unit">{timedSet ? '秒' : '次'}</Text>
                                          </View>
                                          <View className="record-stepper">
                                            <Text className="record-stepper-hit" onClick={(e) => {
                                              e.stopPropagation()
                                              adjustRepsValue(set, REPS_STEP)
                                            }}>+</Text>
                                            <Text className="record-stepper-divider" />
                                            <Text className="record-stepper-hit" onClick={(e) => {
                                              e.stopPropagation()
                                              adjustRepsValue(set, -REPS_STEP)
                                            }}>-</Text>
                                          </View>
                                        </View>
                                      </View>
                                      <View className="record-input-cell rpe">
                                        <Text className="record-input-label">RPE</Text>
                                        <Input
                                          type="number"
                                          className="record-rpe-input"
                                          value={rpe?.toString() || ''}
                                          placeholder="1-10"
                                          onInput={(e) => {
                                            const parsed = parseInputNumber(e.detail.value, 'int')
                                            const nextRpe = parsed === null ? null : Math.min(10, Math.max(1, Math.floor(parsed)))
                                            setRpe(nextRpe)
                                            updateSetDraft(setKey, { rpe: nextRpe })
                                          }}
                                        />
                                      </View>
                                      <Button
                                        className="record-complete-btn"
                                        onClick={() => handleCompleteSet()}
                                        loading={completing}
                                      >
                                        {isEditingThisSet ? '保存' : '完成'}
                                      </Button>
                                    </View>

                                    <View className="set-secondary-row">
                                      {!timedSet && <Button size="mini" className="bodyweight-btn" onClick={() => {
                                        setWeight(0)
                                        setWeightInput('0')
                                        updateSetDraft(setKey, { weight: 0, weightInput: '0' })
                                      }}>{weight === 0 ? '已选自重 / 无负重' : '自重 / 无负重'}</Button>}
                                      <Text
                                        className={`progress-toggle ${markAsPR ? 'active' : ''}`}
                                        onClick={() => {
                                          const next = !markAsPR
                                          setMarkAsPR(next)
                                          updateSetDraft(setKey, { markAsPR: next })
                                        }}
                                      >
                                        {markAsPR ? '已标记进步组' : '标记进步组'}
                                      </Text>
                                      <Button size="mini" className="ghost-tool-btn" onClick={handleChooseVideo} loading={uploadingVideo}>
                                        {hasAttachedVideo ? '更换本组视频' : '上传本组视频'}
                                      </Button>
                                      <Text
                                        className={`set-more-toggle ${isMoreOpen ? 'open' : ''}`}
                                        onClick={() => setOpenSetMoreKey(isMoreOpen ? null : setKey)}
                                      >
                                        备注 / 视频链接{moreSummary ? ` · ${moreSummary}` : ''}
                                      </Text>
                                    </View>

                                    {isMoreOpen && (
                                      <View className="set-more-panel">
                                        <Input
                                          className="compact-note-input"
                                          value={setNotes}
                                          placeholder="备注：手感、节奏或动作问题"
                                          onInput={(e) => {
                                            setSetNotes(e.detail.value)
                                            updateSetDraft(setKey, { notes: e.detail.value })
                                          }}
                                        />
                                        <View className="set-more-actions">
                                          <Button size="mini" className="ghost-tool-btn" onClick={handleChooseVideo} loading={uploadingVideo}>
                                            {hasAttachedVideo ? '换视频' : '选视频'}
                                          </Button>
                                          <Button size="mini" className="ghost-tool-btn" onClick={handlePasteVideoLink}>
                                            贴链接
                                          </Button>
                                          {hasAttachedVideo && (
                                            <Text className="video-attached-chip" onClick={() => void handlePreviewSetVideo(activeVideoUrl)}>
                                              预览视频
                                            </Text>
                                          )}
                                        </View>
                                      </View>
                                    )}
                                  </View>
                                )}


                                {isCurrentSet && !isCompletedSet && isReadOnly && (
                                  <View className="readonly-set-tip">
                                    <Text className="readonly-set-tip-text">该组暂无执行记录（只读模式）</Text>
                                  </View>
                                )}

                                {isCompletedSet && isExpandedSet && (
                                  <View className="set-details">
                                    <View className="detail-grid">
                                      <View className="detail-cell">
                                        <Text className="detail-label">本组记录</Text>
                                        <Text className="detail-value">{actualSummary || '未填写'}</Text>
                                      </View>
                                      <View className="detail-cell">
                                        <Text className="detail-label">休息</Text>
                                        <Text className="detail-value">{formatRestSummary(set.planned_rest_seconds)}</Text>
                                      </View>
                                      <View className="detail-cell">
                                        <Text className="detail-label">e1RM</Text>
                                        <Text className="detail-value">
                                          {set.e1rm !== null && set.e1rm !== undefined ? `${set.e1rm}kg` : '未生成'}
                                        </Text>
                                      </View>
                                    </View>

                                    {!!set.notes && (
                                      <View className="detail-note">
                                        <Text className="detail-label">备注</Text>
                                        <Text className="detail-note-text">{set.notes}</Text>
                                      </View>
                                    )}

                                    {!!set.video_url && (
                                      <View className="detail-note">
                                        <Text className="detail-label">视频</Text>
                                        <Text className="detail-link" onClick={() => void handlePreviewSetVideo(set.video_url)}>
                                          预览本组视频
                                        </Text>
                                      </View>
                                    )}

                                    {(!isReadOnly || canCorrectCompletedSets) && (
                                      <View className="detail-actions">
                                        <Button size="mini" className="ghost-tool-btn" onClick={() => handleEditCompletedSet(actionIdx, setIdx, set)}>
                                          编辑本组
                                        </Button>
                                        {isEditingThisSet && (
                                          <Button size="mini" className="ghost-tool-btn" onClick={handleCancelEditCompletedSet}>
                                            取消编辑
                                          </Button>
                                        )}
                                      </View>
                                    )}
                                  </View>
                                )}
                              </View>
                            )
                          })}
                        </View>
                        {!isReadOnly && (
                          <View className="extra-set-btn-wrap">
                            <Button
                              size="mini"
                              className="add-extra-set-btn"
                              onClick={() => handleAddExtraSet(actionIdx)}
                              disabled={addingExtraSet}
                            >
                              {addingExtraSet ? '添加中...' : '+ 新增一组'}
                            </Button>
                          </View>
                        )}
                      </>
                    ) : (
                      <View className="non-strength-card">
                        {action.completed_sets > 0 ? (
                          <View className="item-completed">
                            <Text className="item-done-text">已打卡完成</Text>
                            {action.sets?.[0]?.diet_content && <Text className="item-detail">内容：{action.sets[0].diet_content}</Text>}
                            {action.sets?.[0]?.actual_distance && <Text className="item-detail">距离：{(action.sets[0].actual_distance / 1000).toFixed(1)} km</Text>}
                            {action.sets?.[0]?.actual_duration && <Text className="item-detail">时长：{Math.round((action.sets[0].actual_duration || 0) / 60)} 分钟</Text>}
                          </View>
                        ) : isReadOnly ? (
                          <View className="item-readonly">
                            <Text className="item-readonly-text">该项目暂无完成记录（只读模式）</Text>
                          </View>
                        ) : (
                          <View className="item-form">
                            <Text className="item-form-title">{actionMeta.label}打卡</Text>
                            {actionType === 'DIET' && (
                              <View className="compact-note-row">
                                <Text className="compact-input-label">内容</Text>
                                <Input
                                  className="compact-note-input"
                                  value={itemStates[actionIdx]?.dietContent || ''}
                                  placeholder="吃了什么、补了什么"
                                  onInput={(e) => setItemStates((prev) => ({ ...prev, [actionIdx]: { ...prev[actionIdx], dietContent: e.detail.value } }))}
                                />
                              </View>
                            )}
                            {actionType === 'CARDIO' && (
                              <View className="compact-input-grid two-cols">
                                <View className="compact-input-card">
                                  <Text className="compact-input-label">距离</Text>
                                  <Input
                                    type="digit"
                                    className="compact-input-field"
                                    value={itemStates[actionIdx]?.cardioDistance?.toString() || ''}
                                    placeholder="0"
                                    onInput={(e) => {
                                      const parsed = parseInputNumber(e.detail.value, 'float')
                                      setItemStates((prev) => ({
                                        ...prev,
                                        [actionIdx]: {
                                          ...prev[actionIdx],
                                          cardioDistance: parsed === null ? null : Math.max(0, parsed)
                                        }
                                      }))
                                    }}
                                  />
                                </View>
                                <View className="compact-input-card">
                                  <Text className="compact-input-label">时长</Text>
                                  <Input
                                    type="number"
                                    className="compact-input-field"
                                    value={itemStates[actionIdx]?.cardioDuration?.toString() || ''}
                                    placeholder="0"
                                    onInput={(e) => {
                                      const parsed = parseInputNumber(e.detail.value, 'int')
                                      setItemStates((prev) => ({
                                        ...prev,
                                        [actionIdx]: {
                                          ...prev[actionIdx],
                                          cardioDuration: parsed === null ? null : Math.max(0, Math.floor(parsed))
                                        }
                                      }))
                                    }}
                                  />
                                </View>
                              </View>
                            )}
                            <Button className="complete-btn" onClick={() => handleCompleteItem(actionIdx)} loading={completing}>
                              完成打卡
                            </Button>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )
          })}
        </View>

        {!isReadOnly && (
          <View className="add-action-wrap">
            <Button
              size="mini"
              className="add-action-btn"
              onClick={handleOpenActionLibrary}
              disabled={addingExtraAction}
            >
              {addingExtraAction ? '添加中...' : '+ 添加动作'}
            </Button>
          </View>
        )}
        {/* 动作选择弹层 */}
        {showActionPicker && (
          <View className="action-picker-mask" onClick={() => setShowActionPicker(false)}>
            <View className="action-picker-panel" onClick={(e) => e.stopPropagation()}>
              <View className="picker-header">
                <View>
                  <Text className="picker-title">添加动作</Text>
                  <Text className="picker-subtitle">按肌群和器械快速多选</Text>
                </View>
                <Text className="picker-close" onClick={() => setShowActionPicker(false)}>关闭</Text>
              </View>
              <Input
                className="picker-search-input"
                value={actionKeyword}
                placeholder="输入动作名字搜索"
                onInput={(e) => setActionKeyword(e.detail.value)}
              />

              <ScrollView scrollX className="picker-equipment-scroll" showScrollbar={false}>
                <View className="picker-equipment-list">
                  {ACTION_PICKER_EQUIPMENT_FILTERS.map((item) => (
                    <Text
                      key={item.key}
                      className={`picker-equipment-chip ${pickerEquipment === item.key ? 'active' : ''}`}
                      onClick={() => setPickerEquipment(item.key)}
                    >
                      {item.label}
                    </Text>
                  ))}
                </View>
              </ScrollView>

              <View className="picker-body">
                <ScrollView scrollY className="picker-muscle-rail">
                  {ACTION_PICKER_MUSCLE_FILTERS.map((item) => (
                    <Text
                      key={item.key}
                      className={`picker-muscle-item ${pickerMuscle === item.key ? 'active' : ''}`}
                      onClick={() => setPickerMuscle(item.key)}
                    >
                      {item.label}
                    </Text>
                  ))}
                </ScrollView>
                <ScrollView scrollY className="picker-card-list">
                  <View className="picker-action-list">
                    {filteredActionPickerList.map((a) => {
                      const isSelected = pickerSelectedActionIds.includes(a.id)
                      const meta = [
                        ...(Array.isArray(a.positions) ? a.positions : []),
                        ...(Array.isArray(a.attrs) ? a.attrs : [])
                      ].filter(Boolean).slice(0, 3)
                      return (
                        <View
                          key={a.id}
                          className={`picker-action-row ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleTogglePickerAction(a.id)}
                        >
                          <View className="picker-action-main">
                            <View className="picker-action-title-line">
                              <Text className="picker-action-name">{a.name || '未命名动作'}</Text>
                              <Text className={`picker-action-source ${a.source === 'public' ? 'public' : ''}`}>
                                {a.source === 'public' ? '公共' : '我的'}
                              </Text>
                            </View>
                            <Text className="picker-action-meta">{meta.length > 0 ? meta.join(' · ') : '力量动作'}</Text>
                          </View>
                          <Text className="picker-action-check">{isSelected ? '已选' : '+'}</Text>
                        </View>
                      )
                    })}
                  </View>
                  {filteredActionPickerList.length === 0 && <Text className="picker-empty">暂无匹配动作</Text>}
                </ScrollView>
              </View>

              <View className="picker-bottom-bar">
                <Text className="picker-selected-count">已选 {pickerSelectedActionIds.length} 个</Text>
                <View className="picker-bottom-actions">
                  <Button size="mini" className="picker-secondary-btn" onClick={() => setPickerSelectedActionIds([])}>
                    清空
                  </Button>
                  <Button
                    size="mini"
                    className="picker-primary-btn"
                    loading={addingExtraAction}
                    disabled={pickerSelectedActionIds.length === 0}
                    onClick={handleAddSelectedPickerActions}
                  >
                    加入训练
                  </Button>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 完成训练按钮 */}
        {(!isReadOnly || canLateCompleteTimedOut) && (
          <View className="footer-section">
            {canLateCompleteTimedOut && (
              <Text className="finish-hint">这次训练已自动结束；可按已记录内容补记完成，或重新训练这一天</Text>
            )}
            {!canFinishWholeDay && !isImpromptuMode && (
              <Text className="finish-hint">仍有 {lightweightProgress.pending} 个轻任务待完成</Text>
            )}
            {canLateCompleteTimedOut && cloudExecutionReady && (
              <RecordCompletionButton instanceId={instanceId} dayIndex={dayIndex} execution={execution}
                earliestDate={planInstance?.start_date || planInstance?.created_at}
                onSaved={(saved) => { setExecution(saved); syncExecutionToCaches(saved); handleBackToTodayTraining() }} />
            )}
            {!canLateCompleteTimedOut && <Button
              className={`finish-btn ${!canFinishWholeDay && !isImpromptuMode ? 'warning' : ''}`}
              onClick={
                canLateCompleteTimedOut
                  ? handleFinishTraining
                  : !canFinishWholeDay && !isImpromptuMode
                  ? handleBackToTodayTraining
                  : shouldShowQuickFinishButton
                    ? handleQuickFinishTraining
                    : handleFinishTraining
              }
                                  loading={completing}
              disabled={!cloudExecutionReady || restartingTimedOut}
            >
              {canLateCompleteTimedOut
                ? '按已记录内容补记完成'
                : !canFinishWholeDay && !isImpromptuMode
                ? '返回今日安排继续轻任务'
                : shouldShowQuickFinishButton
                  ? '一键完成训练'
                  : '完成训练'}
            </Button>}
            {canLateCompleteTimedOut && (
              <View className="cancel-training-wrap">
                <Button
                  className="cancel-training-btn"
                  loading={restartingTimedOut}
                  disabled={completing || restartingTimedOut || !cloudExecutionReady}
                  onClick={handleRestartTimedOutTraining}
                >
                  重新训练这一天
                </Button>
              </View>
            )}
            {canCancelTraining && (
              <View className="cancel-training-wrap">
                <Text className="cancel-training-hint">误点进入且尚未完成任何内容时，可恢复为未开始</Text>
                <Button
                  className="cancel-training-btn"
                  loading={cancelling}
                  disabled={completing || cancelling || uploadingVideo}
                  onClick={handleCancelTraining}
                >
                  取消本次训练
                </Button>
              </View>
            )}
          </View>
        )}
        </View>
      </View>

      {isResting && restTimerMinimized && (
        <View className="rest-timer-bubble" onClick={() => setRestTimerMinimized(false)}>
          <Text className="rest-bubble-label">休息</Text>
          <Text className="rest-bubble-value">{formatTimerValue(restTimer)}</Text>
        </View>
      )}

      {isResting && !restTimerMinimized && (
        <View className="rest-timer-mask" onClick={handleMinimizeRestTimer}>
          <View className="rest-timer-panel" onClick={(e) => e.stopPropagation()}>
            <Text className="rest-timer-emoji">休</Text>
            <Text className="rest-timer-value">{formatTimerValue(restTimer)}</Text>
            <Text className="rest-timer-label">组间休息</Text>
            <View className="rest-timer-actions">
              <Button size="mini" className="rest-action-btn" onClick={() => handleAddRestTime(-10)}>
                -10秒
              </Button>
              <Button size="mini" className="rest-action-btn" onClick={() => handleAddRestTime(10)}>
                +10秒
              </Button>
              <Button size="mini" className="rest-action-btn primary" onClick={handleSkipRest}>
                完成
              </Button>
              <Button size="mini" className="rest-action-btn" onClick={handleMinimizeRestTimer}>
                最小化
              </Button>
            </View>
          </View>
        </View>
      )}

      {showWorkoutSummary && (
        <View className="ws-page">
          <ScrollView scrollY className="ws-scroll">
            <View className="ws-body">
              <View className="ws-head">
                <Text className="ws-title">训练完成</Text>
                <Text className="ws-subtitle">
                  {[
                    isImpromptuMode ? '即兴锻炼' : `第 ${dayIndex} 天`,
                    formatWorkoutPosterDateLabel(execution?.completed_at || execution?.started_at),
                    planTitle && !isImpromptuMode ? planTitle : ''
                  ].filter(Boolean).join(' · ')}
                </Text>
              </View>

              <View className="ws-stats">
                <View className="ws-stat">
                  <Text className="ws-stat__label">完成组数</Text>
                  <Text className="ws-stat__value cl-num">
                    {workoutSummary.completedSetTotal}
                    {workoutPlannedSetTotal > 0 ? <Text className="ws-stat__unit"> / {workoutPlannedSetTotal}</Text> : null}
                  </Text>
                </View>
                {workoutSummary.totalVolume > 0 ? (
                  <View className="ws-stat">
                    <Text className="ws-stat__label">总容量</Text>
                    <Text className="ws-stat__value cl-num">{Math.round(workoutSummary.totalVolume).toLocaleString('en-US')}<Text className="ws-stat__unit"> kg</Text></Text>
                  </View>
                ) : null}
                {workoutSummary.cardioDistanceKm > 0 ? (
                  <View className="ws-stat">
                    <Text className="ws-stat__label">有氧距离</Text>
                    <Text className="ws-stat__value cl-num">{workoutSummary.cardioDistanceKm.toFixed(1)}<Text className="ws-stat__unit"> km</Text></Text>
                  </View>
                ) : null}
                <View className="ws-stat">
                  <Text className="ws-stat__label">时长</Text>
                  <Text className="ws-stat__value cl-num">{workoutSummary.durationMin || '-'}<Text className="ws-stat__unit"> 分钟</Text></Text>
                </View>
                {workoutSummary.calories > 0 ? (
                  <View className="ws-stat">
                    <Text className="ws-stat__label">AI 估算消耗</Text>
                    <Text className="ws-stat__value cl-num">{Math.round(workoutSummary.calories)}<Text className="ws-stat__unit"> kcal</Text></Text>
                  </View>
                ) : null}
              </View>
              <Text className="ws-note">
                {workoutSummary.calories > 0
                  ? `热量按体重、实际时长与2024运动MET估算${execution?.energy_estimate?.method === 'ai_assisted_2024_compendium' ? '，AI用于强度分类' : ''}；未接入心率设备时不等同实验室实测。`
                  : '完善个人体重并记录有氧时长后，才能生成可复算的训练热量估算。'}
              </Text>

              {workoutPrSets.length > 0 ? (
                <View className="ws-section">
                  <Text className="ws-section__title">这次的进步</Text>
                  {workoutPrSets.map((item) => (
                    <View key={item.key} className="ws-pr">
                      <ClTag tone="clay">新纪录</ClTag>
                      <View className="ws-pr__copy">
                        <Text className="ws-pr__name">{item.name}</Text>
                        <Text className="ws-pr__meta">第 {item.setNumber} 组</Text>
                      </View>
                      <Text className="ws-pr__record cl-num">{item.record}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View className="ws-section">
                <Text className="ws-section__title">练到的肌群</Text>
                <View className="ws-bodymaps">
                  <View className="ws-bodymap">
                    <View className="ws-bodymap__stack">
                      <Image className="ws-bodymap__img" src={posterFrontBase} mode="aspectFit" />
                      {heatmapFrontLayers.map((src) => (
                        <Image key={src} className="ws-bodymap__img ws-bodymap__img--layer" src={src} mode="aspectFit" />
                      ))}
                    </View>
                    <Text className="ws-bodymap__caption">正面</Text>
                  </View>
                  <View className="ws-bodymap">
                    <View className="ws-bodymap__stack">
                      <Image className="ws-bodymap__img" src={posterBackBase} mode="aspectFit" />
                      {heatmapBackLayers.map((src) => (
                        <Image key={src} className="ws-bodymap__img ws-bodymap__img--layer" src={src} mode="aspectFit" />
                      ))}
                    </View>
                    <Text className="ws-bodymap__caption">背面</Text>
                  </View>
                </View>
                {(workoutSummary.muscles.length > 0 ? workoutSummary.muscles : [{ label: '全身', score: 1 }]).slice(0, 5).map((item) => (
                  <View key={item.label} className="ws-muscle">
                    <Text className="ws-muscle__name">{item.label}</Text>
                    <View className="ws-muscle__track">
                      <View className="ws-muscle__fill" style={{ width: `${Math.max(12, Math.round((item.score / workoutSummaryMaxScore) * 100))}%` }} />
                    </View>
                  </View>
                ))}
              </View>

              <View className="ws-section">
                <Text className="ws-section__title">完成的动作</Text>
                {workoutSummary.actionRows.length === 0 ? (
                  <Text className="ws-note">本次暂无已完成力量组，先保存几组再生成训练热力图。</Text>
                ) : workoutSummary.actionRows.map((item) => (
                  <View key={item.id} className="ws-action">
                    <Text className="ws-action__name">{item.name}</Text>
                    <Text className="ws-action__meta cl-num">
                      {item.type === 'CARDIO'
                        ? [
                            item.durationMin > 0 ? `${Math.round(item.durationMin)}分钟` : null,
                            item.distanceKm > 0 ? `${item.distanceKm.toFixed(1)}km` : null,
                            item.calories > 0 ? `${Math.round(item.calories)}kcal` : null
                          ].filter(Boolean).join(' · ') || '已完成'
                        : item.volume > 0 ? `${item.setsCount} 组 · ${Math.round(item.volume)} kg` : `${item.setsCount} 组`}
                    </Text>
                  </View>
                ))}
              </View>

              {showFeedbackDialog ? (
                <View className="ws-section">
                  <Text className="ws-section__title">训练感受如何？</Text>
                  <View className="ws-feel">
                    {FEEDBACK_DIFFICULTY_OPTIONS.map((item) => (
                      <View
                        key={item.value}
                        className={`ws-feel__option ${feedbackDifficulty === item.value ? 'ws-feel__option--on' : ''}`}
                        ariaRole="button"
                        ariaLabel={feedbackDifficulty === item.value ? `${item.label}，已选` : item.label}
                        onClick={() => {
                          if (!feedbackSubmitting) setFeedbackDifficulty(item.value)
                        }}
                      >
                        <Text>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                  <Textarea
                    className="ws-feedback"
                    maxlength={500}
                    value={feedbackContent}
                    cursorSpacing={96}
                    showConfirmBar={false}
                    placeholder="写一句反馈，教练会在沟通中看到（可不填）"
                    onInput={(e) => setFeedbackContent(String(e.detail.value || '').slice(0, 500))}
                  />
                  <Text className="ws-feedback__count cl-num">{feedbackContent.length}/500</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View className="ws-bar">
            <ClButton
              variant="secondary"
              className="ws-bar__poster"
              loading={workoutPosterGenerating}
              loadingText="生成中"
              onClick={handleGenerateWorkoutPoster}
            >
              生成打卡图
            </ClButton>
            <ClButton
              className="ws-bar__done"
              loading={feedbackSubmitting}
              loadingText="提交中"
              onClick={() => void handleCompleteSummary()}
            >
              {showFeedbackDialog && feedbackContent.trim() ? '提交并完成' : '完成'}
            </ClButton>
          </View>
        </View>
      )}

      <View className="workout-poster-canvas-wrap">
        <Canvas
          id={WORKOUT_POSTER_CANVAS_ID}
          type="2d"
          className="workout-poster-canvas"
          style={{ width: `${WORKOUT_POSTER_WIDTH}px`, height: `${WORKOUT_POSTER_MIN_HEIGHT}px` }}
        />
      </View>

    </View>
  )
}

export default TrainingExecution
