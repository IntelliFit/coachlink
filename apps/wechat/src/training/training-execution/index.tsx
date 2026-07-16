import React from 'react'
import { View, Text, ScrollView, Input, Button, Textarea, Image, Canvas } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { trainingService } from '@/services/trainingService'
import { executionService } from '@/services/executionService'
import { impromptuService } from '@/services/impromptuService'
import { authService } from '@/services/authService'
import { studentActionLibService } from '@/services/studentActionLibService'
import { addPublicToMyLib, listPublicActions } from '@/services/actionLibPageService'
import { buildPublicTrainingSharePath } from '@/utils/share'
import { svgToDataUri } from '@/utils/svgToDataUri'
import { formatKgValueForGym } from '@/utils/weightQuantize'
import {
  readTrainingExecutionSnapshot,
  syncTrainingExecutionToStorage,
  trainingExecutionSnapshotKey
} from '@/utils/trainingExecutionCache'
import maleFrontSvgRaw from '@/assets/body-map/maleFrontSvg'
import maleBackSvgRaw from '@/assets/body-map/maleBackSvg'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'
import { useSharePoster } from '@/hooks/useSharePoster'
import { resolveCanvasImageSrc } from '@/utils/weapp-canvas-image'
import {
  ACTION_PICKER_EQUIPMENT_FILTERS,
  ACTION_PICKER_MUSCLE_FILTERS,
  getActionPickerSearchText,
  matchesActionPickerFilter
} from '@/utils/actionPickerFilters'

const RETURN_CONFIRM_STORAGE_KEY = 'today_training_last_confirmed_day'
const EXECUTION_LOAD_TIMEOUT_MS = 30000
const EXECUTION_BOOT_WATCHDOG_MS = 12000
const REST_TIMER_STORAGE_PREFIX = 'training_execution_rest_timer_v1'
const TRAINING_TIMER_STORAGE_PREFIX = 'training_execution_total_timer_v1'
const ROUTE_PARAM_STORAGE_KEY = 'training_execution_last_route_params_v1'
const WEIGHT_STEP_KG = 2.5
const REPS_STEP = 1
const WORKOUT_POSTER_CANVAS_ID = 'workout-share-poster-canvas'
const WORKOUT_POSTER_WIDTH = 750
const WORKOUT_POSTER_HEIGHT = 1184

const MUSCLE_FILL_ORIGIN_STYLE = 'fill:#222222'
const MUSCLE_FILL_HIGHLIGHT_STYLE = 'fill:#CF6D4E'

const SUMMARY_MUSCLE_TO_SVG_CATEGORIES: Record<string, string[]> = {
  胸部: ['胸部'],
  背部: ['背部'],
  肩部: ['肩部'],
  手臂: ['大臂', '小臂'],
  核心: ['腹部'],
  腿部: ['大腿', '小腿'],
  臀部: ['臀部']
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
  source?: string // 'student_extra' = 学员自行添加
  sets: SetData[]
  total_sets: number
  completed_sets: number
}

interface WorkoutPosterActionRow {
  id: string
  name: string
  setsCount: number
  volume: number
}

interface WorkoutPosterMuscleRow {
  label: string
  score: number
}

interface WorkoutPosterData {
  title: string
  subtitle: string
  totalVolume: number
  completedSetTotal: number
  durationMin: number
  muscles: WorkoutPosterMuscleRow[]
  actionRows: WorkoutPosterActionRow[]
  frontBodyMap: string
  backBodyMap: string
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

function formatTimerValue(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
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
  if (set.actual_weight !== null && set.actual_weight !== undefined && Number.isFinite(Number(set.actual_weight))) {
    return Number(set.actual_weight)
  }
  if (!isConcreteWeightValue(set.planned_weight)) return null
  return parseFirstNumber(set.planned_weight)
}

function getSetRepsDefault(set?: SetData | null): number | null {
  if (!set) return null
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

function buildInheritedExtraSet(sourceSet?: SetData | null): SetData {
  const inheritedWeight = getSetWeightDefault(sourceSet)
  const inheritedReps = getSetRepsDefault(sourceSet)
  const inheritedRest = getSetRestDefault(sourceSet)

  return {
    set_number: 1,
    status: 'pending',
    planned_weight: inheritedWeight !== null ? `${formatKgValueForGym(inheritedWeight)}kg` : (sourceSet?.planned_weight || ''),
    planned_reps: inheritedReps !== null ? String(inheritedReps) : (sourceSet?.planned_reps || ''),
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

function parseSvgCategoryMap(svg: string): Record<string, string> {
  const map: Record<string, string> = {}
  const singleLineRegex = /<g[^>]*data-name="([^"]+)"[^>]*category="([^"]+)"[^>]*>/g
  let match: RegExpExecArray | null
  while ((match = singleLineRegex.exec(svg)) !== null) {
    if (match[1] !== '肌肉' && match[1] !== '关节' && match[1] !== '全身轮廓') {
      map[match[1]] = match[2]
    }
  }
  const multiLineRegex = /<g\s*\n?\s*data-name="([^"]+)"\s*\n?\s*category="([^"]+)"/g
  while ((match = multiLineRegex.exec(svg)) !== null) {
    if (match[1] !== '肌肉' && match[1] !== '关节' && match[1] !== '全身轮廓') {
      map[match[1]] = match[2]
    }
  }
  return map
}

function highlightSvgCategories(svg: string, selectedParts: string[]) {
  const categoryMap = parseSvgCategoryMap(svg)
  const dataNamesToHighlight = new Set<string>()
  const selectedCategories = new Set(
    selectedParts.flatMap((part) => SUMMARY_MUSCLE_TO_SVG_CATEGORIES[part] || [part])
  )
  Object.entries(categoryMap).forEach(([dataName, category]) => {
    if (selectedCategories.has(category)) dataNamesToHighlight.add(dataName)
  })

  let result = svg
    .replace(/fill:#fff/gi, MUSCLE_FILL_ORIGIN_STYLE)
    .replace(/fill="#fff"/gi, 'fill="#222222"')

  dataNamesToHighlight.forEach((dataName) => {
    const regex = new RegExp(`(<g[^>]*data-name="${dataName}"[^>]*>)([\\s\\S]*?)(</g>)`, 'g')
    result = result.replace(regex, (_match, open, content, close) => {
      const highlighted = content.replace(
        new RegExp(MUSCLE_FILL_ORIGIN_STYLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        MUSCLE_FILL_HIGHLIGHT_STYLE
      )
      return open + highlighted + close
    })
  })

  return svgToDataUri(result.replace(
    /<svg\s/,
    '<svg style="width:100%;height:100%;display:block;" preserveAspectRatio="xMidYMid meet" '
  ))
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

function drawPosterRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function posterText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  const source = String(text || '')
  let current = source
  while (current.length > 0 && ctx.measureText(current).width > maxWidth) {
    current = current.slice(0, -1)
  }
  ctx.fillText(current.length < source.length ? `${current.slice(0, Math.max(0, current.length - 1))}…` : current, x, y)
}

async function loadPosterImage(canvas: HTMLCanvasElement, src: string): Promise<CanvasImageSource | null> {
  if (!src) return null
  try {
    const localSrc = await resolveCanvasImageSrc(src)
    if (typeof (canvas as any).createImage !== 'function') return null
    const image = (canvas as any).createImage()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('poster image load failed'))
      image.src = localSrc
    })
    return image as CanvasImageSource
  } catch (error) {
    console.warn('[training-execution] workout poster image load failed', error)
    return null
  }
}

async function drawWorkoutPoster(ctx: CanvasRenderingContext2D, data: WorkoutPosterData, canvas: HTMLCanvasElement) {
  const dpr = 2
  canvas.width = WORKOUT_POSTER_WIDTH * dpr
  canvas.height = WORKOUT_POSTER_HEIGHT * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  ctx.fillStyle = '#f6f3ef'
  ctx.fillRect(0, 0, WORKOUT_POSTER_WIDTH, WORKOUT_POSTER_HEIGHT)

  drawPosterRoundedRect(ctx, 40, 40, 670, 1104, 32)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  ctx.fillStyle = '#cf6d4e'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText('TRAINING COMPLETE', 72, 100)
  ctx.fillStyle = '#111827'
  ctx.font = 'bold 46px sans-serif'
  posterText(ctx, data.title || '训练完成', 72, 156, 440)
  ctx.fillStyle = '#6b7280'
  ctx.font = '24px sans-serif'
  posterText(ctx, data.subtitle || 'CoachLink 训练记录', 72, 196, 520)

  const frontImage = await loadPosterImage(canvas, data.frontBodyMap)
  const backImage = await loadPosterImage(canvas, data.backBodyMap)
  if (frontImage) ctx.drawImage(frontImage, 128, 236, 174, 260)
  if (backImage) ctx.drawImage(backImage, 448, 236, 174, 260)
  ctx.fillStyle = '#6b7280'
  ctx.font = '22px sans-serif'
  ctx.fillText('正面', 192, 528)
  ctx.fillText('背面', 512, 528)

  const stats = [
    { label: '总容量', value: `${Math.round(data.totalVolume || 0)}kg` },
    { label: '完成组数', value: `${data.completedSetTotal || 0}组` },
    { label: '训练时长', value: data.durationMin > 0 ? `${data.durationMin}分钟` : '-' }
  ]
  stats.forEach((stat, index) => {
    const x = 72 + index * 208
    drawPosterRoundedRect(ctx, x, 576, 182, 124, 24)
    ctx.fillStyle = index === 0 ? '#fff7ed' : '#f9fafb'
    ctx.fill()
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 34px sans-serif'
    posterText(ctx, stat.value, x + 20, 626, 142)
    ctx.fillStyle = '#6b7280'
    ctx.font = '22px sans-serif'
    ctx.fillText(stat.label, x + 20, 666)
  })

  const muscles = data.muscles.length > 0 ? data.muscles.slice(0, 5) : [{ label: '全身', score: 1 }]
  const maxScore = Math.max(1, ...muscles.map((item) => item.score || 0))
  muscles.forEach((item, index) => {
    const y = 750 + index * 44
    ctx.fillStyle = '#374151'
    ctx.font = 'bold 24px sans-serif'
    ctx.fillText(item.label, 72, y)
    drawPosterRoundedRect(ctx, 168, y - 22, 510, 16, 8)
    ctx.fillStyle = '#f1eee9'
    ctx.fill()
    drawPosterRoundedRect(ctx, 168, y - 22, Math.max(48, Math.round(((item.score || 0) / maxScore) * 510)), 16, 8)
    ctx.fillStyle = '#cf6d4e'
    ctx.fill()
  })

  const actionStartY = 986
  ctx.fillStyle = '#111827'
  ctx.font = 'bold 28px sans-serif'
  ctx.fillText('训练明细', 72, actionStartY)
  data.actionRows.slice(0, 4).forEach((item, index) => {
    const y = actionStartY + 54 + index * 44
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 24px sans-serif'
    posterText(ctx, item.name, 72, y, 390)
    ctx.fillStyle = '#6b7280'
    ctx.font = '22px sans-serif'
    ctx.fillText(`${item.setsCount}组 · ${Math.round(item.volume)}kg`, 536, y)
  })

  ctx.fillStyle = '#cf6d4e'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText('COACHLINK', 72, 1112)
  ctx.fillStyle = '#9ca3af'
  ctx.font = '20px sans-serif'
  ctx.fillText('训练完成后，留下这一张就够了。', 414, 1112)
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
  const instanceId = rawInstanceId || (!rawImpromptuId ? String(routeFallback.instanceId || '') : '')
  const impromptuId = rawImpromptuId || (!rawInstanceId ? String(routeFallback.impromptuId || '') : '')
  const isImpromptuMode = !!impromptuId
  const parsedDayIndex = parseInt(String(routeParams.dayIndex || routeFallback.dayIndex || '1'))
  const dayIndex = Number.isFinite(parsedDayIndex) && parsedDayIndex > 0 ? parsedDayIndex : 1
  const readOnlyParam = String(routeParams.readOnly || routeFallback.readOnly || '').toLowerCase()
  const isReadOnly = !isImpromptuMode && (readOnlyParam === 'true' || readOnlyParam === '1')
  
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState('')
  const [loadStage, setLoadStage] = React.useState('等待页面启动')
  const [execution, setExecution] = React.useState<any>(null)
  const [actions, setActions] = React.useState<Record<string, any>>({})
  const [planInstance, setPlanInstance] = React.useState<any>(null)
  const [expandedAction, setExpandedAction] = React.useState<number>(0)
  const [currentSetIndex, setCurrentSetIndex] = React.useState(0)
  const [expandedSetKey, setExpandedSetKey] = React.useState<string | null>(null)
  const [openSetMoreKey, setOpenSetMoreKey] = React.useState<string | null>(null)
  const [editingSetKey, setEditingSetKey] = React.useState<string | null>(null)
  const [completing, setCompleting] = React.useState(false)
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
  const [pendingSharePath, setPendingSharePath] = React.useState('')
  const [showWorkoutSummary, setShowWorkoutSummary] = React.useState(false)
  const startTrainingRef = React.useRef<(() => Promise<void>) | null>(null)
  const startTrainingInFlightRef = React.useRef<Promise<void> | null>(null)
  const lastStartTrainingAtRef = React.useRef(0)
  const executionRef = React.useRef<any>(null)
  const loadingRef = React.useRef(true)
  const suppressAutoRefreshUntilRef = React.useRef(0)

  const userId = authService.getCurrentUser()?.id

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
        readOnly: readOnlyParam
      })
    } catch {
      // Route-param fallback is only for DevTools hot reload / native picker return resilience.
    }
  }, [dayIndex, rawImpromptuId, rawInstanceId, readOnlyParam])

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

  React.useEffect(() => {
    executionRef.current = execution
  }, [execution])

  React.useEffect(() => {
    loadingRef.current = loading
  }, [loading])

  const blockUntilExecutionReady = React.useCallback(() => {
    if (!isPreviewExecution) return false
    Taro.showToast({ title: '正在同步训练记录，稍等几秒', icon: 'none' })
    return true
  }, [isPreviewExecution])

  const clearPersistedRestTimer = React.useCallback(() => {
    if (!restTimerStorageKey) return
    try {
      Taro.removeStorageSync(restTimerStorageKey)
    } catch {
      // Best effort only.
    }
  }, [restTimerStorageKey])

  const persistRestTimer = React.useCallback(
    (seconds: number, executionId?: string) => {
      if (!restTimerStorageKey || !executionId || seconds <= 0) return
      try {
        Taro.setStorageSync(restTimerStorageKey, {
          executionId,
          deadlineAt: Date.now() + Math.max(0, Math.round(seconds)) * 1000
        })
      } catch {
        // Best effort only.
      }
    },
    [restTimerStorageKey]
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
    const planned = String(set?.planned_weight || '').trim().toLowerCase()
    if (!planned) return true
    if (planned.includes('kg')) return true
    if (/^-?\d+(\.\d+)?$/.test(planned)) return true
    if (planned.includes('rm') || planned.includes('%')) return false
    return true
  }, [])

  const hydrateSetInputs = React.useCallback((set?: SetData | null, options?: { allowCompleted?: boolean }) => {
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

    const defaultWeight = getSetWeightDefault(set)
    const defaultReps = getSetRepsDefault(set)
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
        const params = item?.params || {}
        const rawSetCount = Number(params['组数'] ?? item?.sets ?? 1)
        const setCount = Number.isFinite(rawSetCount) && rawSetCount > 0 ? Math.max(1, Math.floor(rawSetCount)) : 1
        const rawLoad = params?.load
        let plannedWeight = ''
        if (rawLoad !== null && rawLoad !== undefined && String(rawLoad).trim() !== '') {
          const directLoad = Number(rawLoad)
          const parsedLoad = Number.isFinite(directLoad)
            ? directLoad
            : (() => {
                const matched = String(rawLoad).match(/-?\d+(\.\d+)?/)
                if (!matched) return NaN
                return Number(matched[0])
              })()

          if (Number.isFinite(parsedLoad)) {
            if (parsedLoad < 0) {
              plannedWeight = `辅助${formatKgValueForGym(Math.abs(parsedLoad))}kg`
            } else if (parsedLoad > 0) {
              plannedWeight = `${formatKgValueForGym(parsedLoad)}kg`
            }
          }
        }

        // Do not fallback to legacy "item.weight" to avoid stale action-library values overriding plan load.
        if (!plannedWeight) {
          const intensity = Number(params?.['强度'] ?? item?.intensity)
          if (Number.isFinite(intensity) && intensity > 0) {
            plannedWeight = `${String(intensity).replace(/\.0+$/, '')}RM`
          }
        }
        const plannedReps = String(params?.['次数'] ?? item?.reps ?? '').trim()
        const actionName = String(actionDetail?.name || item?.action_name || item?.set_name || '动作')

        const sets: SetData[] = Array.from({ length: setCount }).map((_, setIdx) => ({
          set_number: setIdx + 1,
          status: 'pending',
          planned_weight: plannedWeight,
          planned_reps: plannedReps,
          planned_rest_seconds: (() => {
            const rawRest = params?.['休息时间'] ?? params?.rest_seconds ?? item?.rest_seconds
            const restSeconds = Number(rawRest)
            return Number.isFinite(restSeconds) && restSeconds > 0 ? restSeconds : undefined
          })()
        }))

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
  const startTraining = React.useCallback(async () => {
    setLoadError('')
    setLoadStage('启动训练页')
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
              type: 'STRENGTH',
              attrs: ['组数', '次数', '强度', '休息时间']
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
        const instanceRes = cachedInstanceRes || (await withExecutionLoadTimeout(
          trainingService.getInstance({ id: instanceId }),
          '加载训练计划'
        ))
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
        if (!isReadOnly) {
          console.log('[training-execution] sync execution record', { instanceId, dayIndex })
          setLoadStage('同步训练记录')
          data = await withExecutionLoadTimeout(
            executionService.startExecution(instanceId, dayIndex),
            '同步训练记录'
          )
        }
        if (!data && isReadOnly) {
          data = snapshot?.execution || buildPreviewExecution(instanceRes?.instance, instanceActions, dayIndex)
        }

        if (data) {
          executionRef.current = data
          hasDisplayableExecution = true
          setLoadStage('已进入训练')
          setExecution(data)
          syncExecutionToCaches(data)
          focusFirstPendingSet(data)
        } else {
          setLoadStage('没有找到当天训练内容')
          setLoadError('没有找到当天训练内容')
          Taro.showToast({ title: '加载失败', icon: 'none' })
        }
      }
    } catch (e: any) {
      console.error('开始训练失败:', e)
      if (!hasDisplayableExecution && !executionRef.current) {
        setLoadStage('进入训练失败')
        setLoadError(e?.message || '加载失败，请检查网络后重试')
      } else {
        setLoadStage('云端刷新失败，已保留本地内容')
        Taro.showToast({ title: '云端刷新失败，已保留本地记录', icon: 'none' })
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
    isReadOnly,
    buildPreviewExecution,
    executionSnapshotScopeKey,
    focusFirstPendingSet,
    syncExecutionToCaches
  ])

  startTrainingRef.current = startTraining

  const requestStartTraining = React.useCallback((options?: { force?: boolean }) => {
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
    const runPromise = runner().finally(() => {
      startTrainingInFlightRef.current = null
    })
    startTrainingInFlightRef.current = runPromise
    return runPromise
  }, [])

  React.useEffect(() => {
    void requestStartTraining({ force: true })
  }, [requestStartTraining])

  useDidShow(() => {
    if (Date.now() < suppressAutoRefreshUntilRef.current) return
    if (executionRef.current) return
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
      allowCompleted: !!currentKey && editingSetKey === currentKey
    })
  }, [editingSetKey, execution, expandedAction, currentSetIndex, hydrateSetInputs, setDrafts, setKeyOf])

  React.useEffect(() => {
    if (!isResting || restTimer <= 0) return
    const timer = setInterval(() => {
      setRestTimer((prev) => {
        if (prev <= 1) {
          setIsResting(false)
          setRestTimerMinimized(false)
          clearPersistedRestTimer()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [clearPersistedRestTimer, isResting, restTimer])

  React.useEffect(() => {
    if (!restTimerStorageKey || !execution?.id || isResting) return
    try {
      const stored = Taro.getStorageSync(restTimerStorageKey) as any
      if (!stored || String(stored.executionId || '') !== String(execution.id)) return
      const deadlineAt = Number(stored.deadlineAt || 0)
      const remaining = Math.ceil((deadlineAt - Date.now()) / 1000)
      if (remaining > 0) {
        setRestTimer(remaining)
        setIsResting(true)
        setRestTimerMinimized(true)
      } else {
        clearPersistedRestTimer()
      }
    } catch {
      clearPersistedRestTimer()
    }
  }, [clearPersistedRestTimer, execution?.id, isResting, restTimerStorageKey])

  React.useEffect(() => {
    if (!trainingTimerStorageKey || !execution || isPreviewExecution) {
      setElapsedTrainingSeconds(0)
      return undefined
    }

    const executionStartedAt = parseTimestamp(execution?.started_at)
    const executionCompletedAt = parseTimestamp(execution?.completed_at)

    // Read-only previews are not workout sessions. Only a persisted execution
    // with both timestamps may show a historical duration; never start or
    // restore a local running timer in read-only mode.
    if (isReadOnly) {
      try {
        Taro.removeStorageSync(trainingTimerStorageKey)
      } catch {
        // Best effort only.
      }
      if (executionStartedAt && executionCompletedAt) {
        setElapsedTrainingSeconds(Math.max(0, Math.floor((executionCompletedAt - executionStartedAt) / 1000)))
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
    execution?.id,
    execution?.started_at,
    executionSnapshotScopeKey,
    isPreviewExecution,
    isReadOnly,
    trainingTimerStorageKey
  ])

  // 选择视频（注意：微信小程序本地存储约 10MB 限制，视频过大会触发 writeFile 超限，建议大视频用「粘贴链接」）
  const handleChooseVideo = async () => {
    if (isReadOnly) {
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
      setUploadingVideo(true)
      const uploadRes = await executionService.uploadSetVideo(
        res.tempFilePath,
        targetExecutionId,
        actionId,
        targetSetIndex + 1
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
    if (isReadOnly) {
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
            const linkRes = await executionService.addSetVideoLink(
              execution.id,
              actionId,
              currentSetIndex + 1,
              res.content
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
    if (isReadOnly) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!execution) return
    if (blockUntilExecutionReady()) return

    const actionExecutions = execution.action_executions || []
    const currentAction = actionExecutions[expandedAction]
    if (!currentAction) return

    // 验证必填项
    const currentSet = currentAction.sets[currentSetIndex]
    if (!currentSet) return
    const currentSetKey = setKeyOf(expandedAction, currentSetIndex)
    const isEditing = editingSetKey === currentSetKey

    if (isWeightRequiredForSet(currentSet) && (weight === null || weight === undefined)) {
      Taro.showToast({ title: '请输入重量', icon: 'none' })
      return
    }

    try {
      setCompleting(true)

      const data = isImpromptuMode
        ? await impromptuService.completeSet(
            execution.id,
            expandedAction,
            currentSetIndex,
            { actualWeight: weight, actualReps: reps, notes: setNotes || undefined }
          )
        : await executionService.completeSet(
            execution.id,
            expandedAction,
            currentSetIndex,
            {
              actualWeight: weight,
              actualReps: reps,
              rpe: rpe,
              notes: setNotes || undefined,
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
          actual_weight: weight,
          actual_reps: reps,
          rpe: rpe,
          notes: setNotes,
          video_url: videoUrl,
          is_pr: markAsPR,
          e1rm: data?.autoE1RM?.e1rm ?? updatedSets[currentSetIndex]?.e1rm,
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
      setCompleting(false)
    }
  }

  const handlePostFinishFlow = React.useCallback((_sharePath?: string) => {
    setShowWorkoutSummary(true)
  }, [])

  const handleSkipFeedback = React.useCallback(() => {
    const sharePath = pendingSharePath
    setShowFeedbackDialog(false)
    setFeedbackContent('')
    setFeedbackDifficulty(3)
    setPendingSharePath('')
    handlePostFinishFlow(sharePath)
  }, [handlePostFinishFlow, pendingSharePath])

  const handleSubmitFeedback = React.useCallback(async () => {
    if (!execution?.id || feedbackSubmitting) return

    const content = feedbackContent.trim()
    if (!content) {
      Taro.showToast({ title: '请先填写反馈内容', icon: 'none' })
      return
    }

    const sharePath = pendingSharePath
    setFeedbackSubmitting(true)
    try {
      const res = await executionService.submitFeedback({
        executionId: execution.id,
        content,
        difficultyRating: feedbackDifficulty
      })
      if (res) {
        Taro.showToast({ title: '反馈已发送', icon: 'success' })
      } else {
        Taro.showToast({ title: '反馈发送失败，已继续', icon: 'none' })
      }
    } catch (e: any) {
      const message = String(e?.message || '')
      if (message.includes('已提交过反馈')) {
        Taro.showToast({ title: '本次训练已提交过反馈', icon: 'none' })
      } else {
        Taro.showToast({ title: '反馈发送失败，已继续', icon: 'none' })
      }
    } finally {
      setFeedbackSubmitting(false)
      setShowFeedbackDialog(false)
      setFeedbackContent('')
      setFeedbackDifficulty(3)
      setPendingSharePath('')
      handlePostFinishFlow(sharePath)
    }
  }, [execution?.id, feedbackContent, feedbackDifficulty, feedbackSubmitting, handlePostFinishFlow, pendingSharePath])

  // 完成训练
  const handleFinishTraining = async () => {
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

              if (shouldAskCoachFeedback) {
                setPendingSharePath(sharePath)
                setShowFeedbackDialog(true)
                return
              }

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

              if (shouldAskCoachFeedback) {
                setPendingSharePath(sharePath)
                setShowFeedbackDialog(true)
                return
              }

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

  // 完成非力量项目（饮食/有氧/习惯）
  const handleCompleteItem = async (actionIndex: number) => {
    if (isReadOnly) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!execution) return
    if (blockUntilExecutionReady()) return
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
    const inheritedSet = buildInheritedExtraSet(sourceSet)
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
        hydrateSetInputs(ae.sets[res.newSetIndex])
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

  const handleOpenActionDetail = (actionExec: ActionExecution, actionDetail: any) => {
    const actionId = String(actionExec?.action_id || actionDetail?.id || '')
    if (!actionId) {
      Taro.showToast({ title: '暂无动作详情', icon: 'none' })
      return
    }

    try {
      Taro.setStorageSync(`action_detail_${actionId}`, {
        id: actionId,
        name: actionExec?.action_name || actionDetail?.name || '动作详情',
        detail: actionDetail?.detail || '',
        positions: actionDetail?.positions || null,
        attrs: actionDetail?.attrs || null,
        type: actionDetail?.type || null,
        url: actionDetail?.url || null
      })
    } catch {
      // Detail cache is a convenience for the detail page; navigation can still proceed.
    }

    Taro.navigateTo({ url: `/training/action-detail?id=${encodeURIComponent(actionId)}` })
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
    const targetKey = setKeyOf(actionIdx, setIdx)
    setExpandedAction(actionIdx)
    setCurrentSetIndex(setIdx)
    setExpandedSetKey(targetKey)
    setEditingSetKey(targetKey)
    setOpenSetMoreKey(set.notes || set.video_url ? targetKey : null)
    hydrateSetInputs(set, { allowCompleted: true })
  }

  const handleCancelEditCompletedSet = () => {
    setEditingSetKey(null)
    setOpenSetMoreKey(null)
    const current = actionExecutions?.[expandedAction]?.sets?.[currentSetIndex]
    hydrateSetInputs(current)
  }

  const handleSkipRest = () => {
    setRestTimer(0)
    setIsResting(false)
    setRestTimerMinimized(false)
    clearPersistedRestTimer()
  }

  const handleAddRestTime = (seconds: number) => {
    setRestTimer((prev) => {
      const next = Math.max(0, prev + seconds)
      if (next <= 0) {
        setIsResting(false)
        setRestTimerMinimized(false)
        clearPersistedRestTimer()
      } else {
        persistRestTimer(next, execution.id)
      }
      return next
    })
    if (seconds > 0) setIsResting(true)
  }

  const handleMinimizeRestTimer = () => {
    if (!isResting) return
    setRestTimerMinimized(true)
  }

  // 计算总进度
  const totalSets = actionExecutions.reduce((sum: number, a: ActionExecution) => sum + (a.total_sets || 0), 0)
  const completedSets = actionExecutions.reduce((sum: number, a: ActionExecution) => sum + (a.completed_sets || 0), 0)
  const pendingSetsCount = Math.max(0, totalSets - completedSets)
  const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0
  const shouldShowQuickFinishButton = !isImpromptuMode && canFinishWholeDay && pendingSetsCount > 0
  const completedActions = actionExecutions.reduce((sum: number, a: ActionExecution) => {
    return sum + ((a.completed_sets || 0) >= (a.total_sets || 0) ? 1 : 0)
  }, 0)
  const planTitle = String(planInstance?.name || (isImpromptuMode ? '即兴锻炼' : '训练执行')).trim()
  const heroTimerValue = formatTimerValue(elapsedTrainingSeconds)
  const heroTimerFontSize = Math.max(16, Math.min(54, Math.floor(240 / Math.max(heroTimerValue.length, 1))))
  const heroTimerLabel = execution?.completed_at ? '本次用时' : '训练总时长'
  const currentActionName = String(currentAction?.action_name || '').trim() || '等待选择动作'
  const currentActionType = String(actions?.[currentAction?.action_id]?.type || 'STRENGTH').toUpperCase()
  const currentActionMeta = getActionTypeMeta(currentActionType)
  const currentPlannedSummary = currentSet
    ? [currentSet.planned_weight || null, currentSet.planned_reps ? `${currentSet.planned_reps}次` : null].filter(Boolean).join(' × ')
    : ''
  const heroSubtitle = planTitle && currentActionName && planTitle === currentActionName
    ? currentPlannedSummary || '按计划完成本组'
    : [currentActionName, currentPlannedSummary || null].filter(Boolean).join(' · ')
  const currentActualSummary = currentSet
    ? [
        currentSet.actual_weight !== null && currentSet.actual_weight !== undefined ? `${currentSet.actual_weight}kg` : null,
        currentSet.actual_reps !== null && currentSet.actual_reps !== undefined ? `${currentSet.actual_reps}次` : null,
        currentSet.rpe ? `RPE ${currentSet.rpe}` : null
      ].filter(Boolean).join(' · ')
    : ''
  const currentRestLabel = formatRestSummary(currentSet?.planned_rest_seconds)
  const workoutSummary = (() => {
    let totalVolume = 0
    let completedSetTotal = 0
    const muscleScores: Record<string, number> = {}
    const actionRows = actionExecutions.map((action: ActionExecution) => {
      const detail = actions[action.action_id] || {}
      const completed = (action.sets || []).filter((set: SetData) => set.status === 'completed')
      const actionVolume = completed.reduce((sum: number, set: SetData) => {
        const actualWeight = Number(set.actual_weight)
        const actualReps = Number(set.actual_reps)
        if (!Number.isFinite(actualWeight) || !Number.isFinite(actualReps)) return sum
        return sum + Math.max(0, actualWeight) * Math.max(0, actualReps)
      }, 0)
      const muscles = inferMusclesForAction(action, detail)
      const score = actionVolume > 0 ? actionVolume : completed.length * 50
      muscles.forEach((muscle) => {
        muscleScores[muscle] = (muscleScores[muscle] || 0) + score
      })
      totalVolume += actionVolume
      completedSetTotal += completed.length
      return {
        id: action.action_id,
        name: action.action_name || detail?.name || '动作',
        setsCount: completed.length,
        volume: actionVolume,
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
      durationMin,
      muscles,
      actionRows
    }
  })()
  const heatmapMuscles = workoutSummary.muscles.map((item) => item.label)
  const heatmapFrontSvg = highlightSvgCategories(maleFrontSvgRaw, heatmapMuscles)
  const heatmapBackSvg = highlightSvgCategories(maleBackSvgRaw, heatmapMuscles)
  const workoutSummaryMaxScore = Math.max(1, ...workoutSummary.muscles.map((item) => item.score))
  const isWorkoutCompleted = String(execution?.status || '').toLowerCase() === 'completed' || !!execution?.completed_at
  const canOpenWorkoutSummary = isWorkoutCompleted && workoutSummary.completedSetTotal > 0
  const workoutPosterData = React.useMemo<WorkoutPosterData>(() => ({
    title: planTitle || '训练完成',
    subtitle: `${isImpromptuMode ? '即兴锻炼' : `第${dayIndex}天`} · ${workoutSummary.completedSetTotal}组完成`,
    totalVolume: workoutSummary.totalVolume,
    completedSetTotal: workoutSummary.completedSetTotal,
    durationMin: workoutSummary.durationMin,
    muscles: workoutSummary.muscles,
    actionRows: workoutSummary.actionRows,
    frontBodyMap: heatmapFrontSvg,
    backBodyMap: heatmapBackSvg
  }), [
    dayIndex,
    heatmapBackSvg,
    heatmapFrontSvg,
    isImpromptuMode,
    planTitle,
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
    // 临时图片路径可能被微信清理；每次操作都重新导出并持久化，不复用旧路径。
    const imagePath = await generateWorkoutPoster(workoutPosterData)
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
    generateWorkoutPoster,
    saveWorkoutPosterImage,
    workoutPosterData
  ])

  const handleLeaveAfterSummary = () => {
    setShowWorkoutSummary(false)
    Taro.navigateBack()
  }

  if (loading && !execution) {
    return (
      <View className={`training-execution-page theme-${effectiveTheme}`}>
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
      <View className={`training-execution-page theme-${effectiveTheme}`}>
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
    <View className={`training-execution-page theme-${effectiveTheme}`}>
      <View className="execution-scroll">
        <View className="execution-shell">
          <View className="hero-section">
            <View className="hero-topbar">
              <Text className="hero-day-label">{isImpromptuMode ? '即兴锻炼' : `${isReadOnly ? '只读查看 · ' : ''}第${dayIndex}天`}</Text>
            </View>

            <View className="hero-main">
              <View className="hero-timer-card">
                <Text className="hero-timer-value" style={{ fontSize: `${heroTimerFontSize}rpx` }}>{heroTimerValue}</Text>
                <Text className="hero-timer-label">{heroTimerLabel}</Text>
              </View>
              <View className="hero-summary">
                <Text className="hero-title">{planTitle || '训练执行'}</Text>
                <Text className="hero-subtitle">{heroSubtitle}</Text>
                <View className="hero-chip-row">
                  <Text className="hero-chip">{currentActionMeta.label}</Text>
                  <Text className="hero-chip">{currentRestLabel}</Text>
                  {currentActualSummary ? <Text className="hero-chip success">{currentActualSummary}</Text> : null}
                  {isReadOnly ? <Text className="hero-chip warning">只读模式</Text> : null}
                </View>
              </View>
            </View>

            <View className="hero-stats">
              <View className="hero-stat-card">
                <Text className="hero-stat-label">动作</Text>
                <Text className="hero-stat-value">{actionExecutions.length}</Text>
              </View>
              <View className="hero-stat-card">
                <Text className="hero-stat-label">组进度</Text>
                <Text className="hero-stat-value">{completedSets}/{totalSets}</Text>
              </View>
              <View className="hero-stat-card">
                <Text className="hero-stat-label">已完成</Text>
                <Text className="hero-stat-value">{completedActions}</Text>
              </View>
              <View className="hero-stat-card">
                <Text className="hero-stat-label">轻任务</Text>
                <Text className="hero-stat-value">{lightweightProgress.pending}</Text>
              </View>
            </View>

            <View className="progress-section">
              <View className="progress-bar">
                <View className="progress-fill" style={{ width: `${progress}%` }} />
              </View>
              <Text className="progress-text">已完成 {Math.round(progress)}%</Text>
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
                    firstSet?.planned_reps ? `${firstSet.planned_reps}次` : null,
                    formatRestSummary(firstSet?.planned_rest_seconds)
                  ].filter(Boolean).join(' · ')
                : actionMeta.cue
              const hasActionDetail = !!(actionDetail?.detail || actionDetail?.url || actionDetail?.positions?.length || actionDetail?.attrs?.length)
              const hasActionDemo = !!actionDetail?.url

              return (
                <View
                  key={actionIdx}
                  className={`action-card action-tone-${actionType.toLowerCase()} ${isExpanded ? 'expanded' : ''} ${isCompleted ? 'completed' : ''}`}
                >
                  <View className="action-header" onClick={() => handleExpandAction(actionIdx)}>
                    <View className="action-info">
                      <Text className="action-number">{actionIdx + 1}</Text>
                      <View className="action-copy">
                        <Text className="action-name">{action.action_name || actionDetail?.name || '未知动作'}</Text>
                        <View className="action-meta-row">
                          <Text className="action-type-pill">{actionMeta.label}</Text>
                          {actionSummary ? <Text className="action-summary">{actionSummary}</Text> : null}
                        </View>
                        {(hasActionDetail || hasActionDemo) && (
                          <View className="action-reference-row">
                            {hasActionDetail && (
                              <Text
                                className="action-reference-chip"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenActionDetail(action, actionDetail)
                                }}
                              >
                                动作要点
                              </Text>
                            )}
                            {hasActionDemo && (
                              <Text
                                className="action-reference-chip demo"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenActionDetail(action, actionDetail)
                                }}
                              >
                                演示
                              </Text>
                            )}
                          </View>
                        )}
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
                    {isStrength ? (
                      <>
                        <View className="sets-list">
                          {action.sets?.map((set: SetData, setIdx: number) => {
                            const isCurrentSet = setIdx === currentSetIndex
                            const isCompletedSet = set.status === 'completed'
                            const setKey = setKeyOf(actionIdx, setIdx)
                            const isExpandedSet = expandedSetKey === setKey
                            const isEditingThisSet = editingSetKey === setKey
                            const showSetForm = isCurrentSet && !isReadOnly && (!isCompletedSet || isEditingThisSet)
                            const setDraft = setDrafts[setKey]
                            const plannedWeightText = String(set.planned_weight || '').trim()
                            const plannedRepsText = String(set.planned_reps || '').trim() ? `${set.planned_reps}次` : ''
                            const plannedSummary = [plannedWeightText || null, plannedRepsText || null].filter(Boolean).join(' × ')
                            const actualSummary = [
                              set.actual_weight !== null && set.actual_weight !== undefined ? `${set.actual_weight}kg` : null,
                              set.actual_reps !== null && set.actual_reps !== undefined ? `${set.actual_reps}次` : null,
                              set.rpe ? `RPE ${set.rpe}` : null
                            ].filter(Boolean).join(' · ')
                            const draftSummary = setDraft
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
                                      {set.is_auto_pr && <Text className="set-tag auto">新纪录</Text>}
                                      {set.video_url && <Text className="set-tag">视频</Text>}
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
                                    <View className="record-inline-row">
                                      <View className="record-input-cell weight">
                                        <Text className="record-input-label">重量</Text>
                                        <View className="record-adjust-input">
                                          <View className="record-value-wrap">
                                            <Input
                                              type="digit"
                                              className="record-inline-input"
                                              value={weightInput}
                                              placeholder={String(set.planned_weight || '0')}
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
                                      </View>
                                      <View className="record-input-cell reps">
                                        <Text className="record-input-label">次数</Text>
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
                                            <Text className="record-unit">次</Text>
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
                                        type="primary"
                                        className="record-complete-btn"
                                        onClick={() => handleCompleteSet(actionIdx, setIdx)}
                                        loading={completing}
                                      >
                                        {isEditingThisSet ? '保存' : '完成'}
                                      </Button>
                                    </View>

                                    <View className="set-secondary-row">
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
                                      <Text
                                        className={`set-more-toggle ${isMoreOpen ? 'open' : ''}`}
                                        onClick={() => setOpenSetMoreKey(isMoreOpen ? null : setKey)}
                                      >
                                        备注 / 视频（可选）{moreSummary ? ` · ${moreSummary}` : ''}
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

                                    {!isReadOnly && (
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
                            <Button type="primary" className="complete-btn" onClick={() => handleCompleteItem(actionIdx)} loading={completing}>
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
              onClick={async () => {
                setShowActionPicker(true)
                await loadActionPicker()
              }}
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
        {!isReadOnly && (
          <View className="footer-section">
            {!canFinishWholeDay && !isImpromptuMode && (
              <Text className="finish-hint">仍有 {lightweightProgress.pending} 个轻任务待完成</Text>
            )}
            <Button
              type="primary"
              className={`finish-btn ${!canFinishWholeDay && !isImpromptuMode ? 'warning' : ''}`}
              onClick={
                !canFinishWholeDay && !isImpromptuMode
                  ? handleBackToTodayTraining
                  : shouldShowQuickFinishButton
                    ? handleQuickFinishTraining
                    : handleFinishTraining
              }
              loading={completing}
            >
              {!canFinishWholeDay && !isImpromptuMode
                ? '返回今日安排继续轻任务'
                : shouldShowQuickFinishButton
                  ? '一键完成训练'
                  : '完成训练'}
            </Button>
          </View>
        )}
        {(isReadOnly || isWorkoutCompleted) && canOpenWorkoutSummary && (
          <View className="footer-section review-share-section">
            <Text className="finish-hint">本次训练已完成，可生成图片发送给好友或群聊。</Text>
            <Button
              type="primary"
              className="finish-btn"
              loading={workoutPosterGenerating}
              onClick={handleGenerateWorkoutPoster}
            >
              生成并分享
            </Button>
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
        <View className="workout-summary-mask" onClick={() => setShowWorkoutSummary(false)}>
          <View className="workout-summary-sheet" onClick={(e) => e.stopPropagation()}>
            <View className="summary-header">
              <View>
                <Text className="summary-eyebrow">TRAINING COMPLETE</Text>
                <Text className="summary-title">训练完成</Text>
              </View>
              <Text className="summary-close" onClick={() => setShowWorkoutSummary(false)}>关闭</Text>
            </View>

            <View className="summary-heatmap-row">
              <View className="summary-body-map">
                <Image className="summary-body-image" src={heatmapFrontSvg} mode="aspectFit" />
                <Text className="summary-body-caption">正面</Text>
              </View>
              <View className="summary-body-map">
                <Image className="summary-body-image" src={heatmapBackSvg} mode="aspectFit" />
                <Text className="summary-body-caption">背面</Text>
              </View>
            </View>

            <View className="summary-stat-grid">
              <View className="summary-stat">
                <Text className="summary-stat-value">{Math.round(workoutSummary.totalVolume)}</Text>
                <Text className="summary-stat-label">总容量 kg</Text>
              </View>
              <View className="summary-stat">
                <Text className="summary-stat-value">{workoutSummary.completedSetTotal}</Text>
                <Text className="summary-stat-label">完成组数</Text>
              </View>
              <View className="summary-stat">
                <Text className="summary-stat-value">{workoutSummary.durationMin || '-'}</Text>
                <Text className="summary-stat-label">分钟</Text>
              </View>
            </View>

            <View className="summary-muscle-list">
              {(workoutSummary.muscles.length > 0 ? workoutSummary.muscles : [{ label: '全身', score: 1 }]).slice(0, 5).map((item) => (
                <View key={item.label} className="summary-muscle-row">
                  <Text className="summary-muscle-name">{item.label}</Text>
                  <View className="summary-muscle-track">
                    <View className="summary-muscle-fill" style={{ width: `${Math.max(12, Math.round((item.score / workoutSummaryMaxScore) * 100))}%` }} />
                  </View>
                </View>
              ))}
            </View>

            <ScrollView scrollY className="summary-action-list">
              {workoutSummary.actionRows.slice(0, 8).map((item) => (
                <View key={item.id} className="summary-action-row">
                  <Text className="summary-action-name">{item.name}</Text>
                  <Text className="summary-action-meta">{item.setsCount}组 · {Math.round(item.volume)}kg</Text>
                </View>
              ))}
              {workoutSummary.actionRows.length === 0 && (
                <Text className="summary-empty">本次暂无已完成力量组，先保存几组再生成训练热力图。</Text>
              )}
            </ScrollView>

            <View className="summary-actions">
              <Text className="summary-secondary-btn" onClick={handleLeaveAfterSummary}>返回</Text>
              <Text className={`summary-primary-btn ${workoutPosterGenerating ? 'disabled' : ''}`} onClick={handleGenerateWorkoutPoster}>
                {workoutPosterGenerating ? '生成中...' : '生成并分享'}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View className="workout-poster-canvas-wrap">
        <Canvas
          id={WORKOUT_POSTER_CANVAS_ID}
          type="2d"
          className="workout-poster-canvas"
          style={{ width: `${WORKOUT_POSTER_WIDTH}px`, height: `${WORKOUT_POSTER_HEIGHT}px` }}
        />
      </View>

      {showFeedbackDialog && (
        <View className="feedback-modal-mask">
          <View className="feedback-modal" onClick={(e) => e.stopPropagation()}>
            <View className="feedback-modal-header">
              <Text className="feedback-modal-title">训练感受如何？</Text>
              <Text className="feedback-modal-subtitle">写一句反馈，教练会在沟通中看到</Text>
            </View>

            <View className="feedback-difficulty-wrap">
              {FEEDBACK_DIFFICULTY_OPTIONS.map((item) => (
                <View
                  key={item.value}
                  className={`difficulty-option ${feedbackDifficulty === item.value ? 'active' : ''}`}
                  onClick={() => {
                    if (!feedbackSubmitting) setFeedbackDifficulty(item.value)
                  }}
                >
                  <Text className="difficulty-mark">{item.mark}</Text>
                  <Text className="difficulty-label">{item.label}</Text>
                </View>
              ))}
            </View>

            <Textarea
              className="feedback-input"
              maxlength={500}
              value={feedbackContent}
              cursorSpacing={96}
              showConfirmBar={false}
              placeholder="例如：深蹲感觉可以加一点重量，卧推动作还不稳定..."
              onInput={(e) => setFeedbackContent(String(e.detail.value || '').slice(0, 500))}
            />
            <Text className="feedback-count">{feedbackContent.length}/500</Text>

            <View className="feedback-actions">
              <Button
                size="mini"
                className="feedback-skip-btn"
                disabled={feedbackSubmitting}
                onClick={handleSkipFeedback}
              >
                跳过
              </Button>
              <Button
                size="mini"
                type="primary"
                className="feedback-submit-btn"
                loading={feedbackSubmitting}
                disabled={!feedbackContent.trim()}
                onClick={() => void handleSubmitFeedback()}
              >
                发送给教练
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

export default TrainingExecution
