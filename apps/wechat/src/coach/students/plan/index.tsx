import { useState, useEffect, useMemo, useCallback } from 'react'
import { View, Text, ScrollView, Input, Image, Textarea } from '@tarojs/components'
import { User, Message } from '@nutui/icons-react-taro'
import Taro from '@tarojs/taro'
import PlanCompactWeekCalendar from '@/components/PlanCompactWeekCalendar'
import PlanReferenceOneRMPanel from '@/components/PlanReferenceOneRMPanel'
import { coachService } from '@/services/coach/coachService'
import { planLibService } from '@/services/coach/planLibService'
import { actionLibService } from '@/services/coach/actionLibService'
import { authService } from '@/services/authService'
import { chatService } from '@/services/chatService'
import { isOneRMEligibleAction } from '@/utils/oneRmEligibility'
import { buildExecutionSummary } from '@/utils/planEditor'
import { buildStrengthPreview } from '@/utils/planStrength'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useTheme } from '@/hooks/useTheme'

const FITNESS_LEVEL_LABEL_MAP: Record<string, string> = {
  beginner: '零基础',
  novice: '入门',
  intermediate: '进阶',
  advanced: '高阶',
  elite: '精英 / 职业'
}

// ============ 类型定义 ============
interface StudentProfile {
  nickname: string
  avatar_url: string
  full_name: string
  phone: string
  gender: string
  age: number
  height: number
  weight: number
  fitness_goal: string
  fitness_level: string
  sport_cards: any[]
}

interface StudentAction {
  id: string
  name: string
  reference_1rm: number | null
  canonical_action_id: string | null
}

interface CoachAction {
  id: string
  name: string
  type?: string | null
  attrs?: string[] | null
  enableAutoWeightCompute?: boolean | null
  canonical_action_id?: string | null
}

interface ActionSet {
  id?: string
  type?: string
  itemType?: string
  group_title?: string
  question?: {
    question?: string
    options?: Array<{
      label?: string
      value?: string
      text?: string
    }>
  }
  actions?: ActionSet[]
  action_id?: string
  actionId?: string
  action_name?: string
  actionName?: string
  setName?: string
  sets?: number
  reps?: number
  weight?: number
  intensity?: string
  params?: any
}

interface TrainingDay {
  dayIndex: number
  type: 'training' | 'rest'
  note?: string
  actionSets?: ActionSet[]
}

interface PlanInstance {
  id: string
  name: string
  description?: string
  execution_notice?: string | null
  status: 'active' | 'paused' | 'completed'
  progress: number
  current_day: number
  total_days: number
  start_date?: string
  template_id?: string
  ai_generation_log?: any
}

interface Execution {
  id: string
  day_index: number
  status: string
  completed_at?: string
  actions?: any[]
}

interface Feedback {
  id: string
  day_index: number
  content: string
  difficulty_rating?: number
  created_at: string
  coach_reply?: string
  is_read: boolean
}

// ============ 工具函数 ============
const normalizeName = (name?: string | null) => (name || '').trim().toLowerCase()
const normalizeActionId = (value?: string | number | null) => {
  if (value === undefined || value === null) return ''
  const text = String(value).trim()
  return text
}
const isPlaceholderActionName = (name?: string | null) => {
  const text = String(name || '').trim()
  if (!text) return true
  const compact = text.replace(/\s+/g, '')
  return compact === '未选择动作' || compact === '未选择' || /^动作\d+$/i.test(compact)
}
const pickFirstMeaningfulName = (candidates: Array<string | undefined | null>) => {
  for (const candidate of candidates) {
    const text = String(candidate || '').trim()
    if (text && !isPlaceholderActionName(text)) return text
  }
  return ''
}
const pickFirstRawName = (candidates: Array<string | undefined | null>) => {
  for (const candidate of candidates) {
    const text = String(candidate || '').trim()
    if (text) return text
  }
  return ''
}
const toFiniteNumber = (value: any) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}
const getActionSetActionId = (set?: ActionSet | null) =>
  normalizeActionId(
    set?.action_id ??
    set?.actionId ??
    set?.params?.action_id ??
    set?.params?.actionId
  )
const getActionSetRawName = (set?: ActionSet | null) => {
  const candidates = [
    set?.group_title,
    set?.question?.question,
    set?.action_name,
    (set as any)?.set_name,
    set?.actionName,
    set?.setName,
    set?.params?.action_name,
    set?.params?.actionName,
    set?.params?.setName,
    set?.params?.name,
    set?.params?.['动作名称']
  ]
  return pickFirstMeaningfulName(candidates) || pickFirstRawName(candidates)
}
const parseJsonArrayMaybe = (value: any) => {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    const values = Object.values(value)
    return Array.isArray(values) ? values : []
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
      if (parsed && typeof parsed === 'object') {
        return Object.values(parsed)
      }
      return []
    } catch (e) {
      return []
    }
  }
  return []
}
const isOneFilterActionSet = (set?: ActionSet | null) =>
  Boolean(set && set.type === 'one-filter' && Array.isArray(set.actions))
const getOneFilterOptionLabel = (set: ActionSet, index: number) => {
  const rawOption = Array.isArray(set?.question?.options)
    ? set.question?.options?.[index]
    : undefined
  const text = String(
    rawOption?.label ??
    rawOption?.value ??
    rawOption?.text ??
    ''
  ).trim()
  return text || `选项 ${index + 1}`
}
const getOneFilterDisplayName = (set?: ActionSet | null) => {
  if (!set) return ''
  const title = String(set?.question?.question || '').trim()
  if (title) return title
  const fallback = String(set?.group_title || '').trim()
  return fallback
}
const isStrengthItemType = (itemType?: string | null) => {
  const normalized = String(itemType || 'STRENGTH').trim().toUpperCase()
  return !normalized || normalized === 'STRENGTH'
}
const PARAM_UNIT_MAP: Record<string, string> = {
  '组数': '组',
  sets: '组',
  '次数': '次',
  reps: '次',
  '重量': 'kg',
  '重量(kg)': 'kg',
  weight: 'kg',
  load: 'kg',
  '强度': 'RM',
  '休息时间': 'min',
  '持续时间': 's'
}
const getParamUnit = (key: string) => PARAM_UNIT_MAP[key] || ''
const getParamDisplayLabel = (key: string) => {
  if (key === 'sets') return '组数'
  if (key === 'reps') return '次数'
  if (key === 'load' || key === 'weight') return '重量(kg)'
  return key
}
const parseLooseParamValue = (value: string) => {
  const text = String(value ?? '').trim()
  if (!text) return undefined
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    const num = Number(text)
    return Number.isFinite(num) ? num : text
  }
  return text
}
const isSimpleParamValue = (value: any) => {
  const type = typeof value
  return value === null || type === 'string' || type === 'number' || type === 'boolean'
}
const INTERNAL_PARAM_KEYS = new Set([
  'action_id',
  'actionId',
  'action_name',
  'actionName',
  'setName',
  'id',
  'type',
  'itemType',
  'group_title',
  'question',
  'loadCalculated',
  'loadSource',
  'loadDisplayText',
  'intensityConfig'
])
const getActionSetSets = (set?: ActionSet | null) => {
  const direct = toFiniteNumber(set?.sets)
  if (direct !== null && direct > 0) return Math.floor(direct)
  const paramSets = toFiniteNumber(set?.params?.sets)
  if (paramSets !== null && paramSets > 0) return Math.floor(paramSets)
  const zhSets = toFiniteNumber(set?.params?.['组数'])
  if (zhSets !== null && zhSets > 0) return Math.floor(zhSets)
  return null
}
const getActionSetReps = (set?: ActionSet | null) => {
  const direct = toFiniteNumber(set?.reps)
  if (direct !== null && direct > 0) return Math.floor(direct)
  const paramReps = toFiniteNumber(set?.params?.reps)
  if (paramReps !== null && paramReps > 0) return Math.floor(paramReps)
  const legacyReps = toFiniteNumber(set?.params?.['次数'])
  if (legacyReps !== null && legacyReps > 0) return Math.floor(legacyReps)
  return null
}
const getActionSetWeight = (set?: ActionSet | null) => {
  const direct = toFiniteNumber(set?.weight)
  if (direct !== null && direct >= 0) return direct
  const load = toFiniteNumber(set?.params?.load)
  if (load !== null && load >= 0) return load
  const weight = toFiniteNumber(set?.params?.weight)
  if (weight !== null && weight >= 0) return weight
  const zhWeight = toFiniteNumber(set?.params?.['重量'])
  if (zhWeight !== null && zhWeight >= 0) return zhWeight
  const backupBarbellWeight = toFiniteNumber(set?.params?.['杠铃负重(备选)'])
  if (backupBarbellWeight !== null && backupBarbellWeight >= 0) return backupBarbellWeight
  return null
}
const FEEDBACK_DIFFICULTY_MAP: Record<number, string> = {
  1: '太轻松',
  2: '轻松',
  3: '刚好',
  4: '有点难',
  5: '太难了'
}

// PlanInstance 类型扩展，包含可选字段
interface PlanInstanceWithExtras extends PlanInstance {
  tags?: string[]
  suitable_for?: string
}

// ============ 主组件 ============
function CoachStudentPlan() {
  const { effectiveTheme } = useTheme()
  const routeParams = Taro.getCurrentInstance().router?.params || {}
  const subscriptionId = routeParams.id
  const historyInstanceId = routeParams.instanceId || routeParams.planInstanceId || ''
  const isReadonlyPlanView = routeParams.readonly === '1' || Boolean(historyInstanceId)
  const focusDayParam = Number(routeParams.focusDay)
  const openFeedbackParam = routeParams.openFeedback === '1'

  // 加载状态
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')

  // 基础数据
  const [studentData, setStudentData] = useState<{
    id: string
    student_id: string
    profile: StudentProfile
    aggregated1RM: Record<string, number>
  } | null>(null)

  const [actions, setActions] = useState<CoachAction[]>([])
  const [studentActions, setStudentActions] = useState<StudentAction[]>([])

  // 计划数据
  const [instance, setInstance] = useState<PlanInstance | null>(null)
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [trainingDays, setTrainingDays] = useState<TrainingDay[]>([])
  const [executions, setExecutions] = useState<Record<number, Execution>>({})

  // 编辑状态
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editExecutionNotice, setEditExecutionNotice] = useState('')
  const [editSuitableFor, setEditSuitableFor] = useState<string>('beginner')

  // 面板状态
  const [showOneRMPanel, setShowOneRMPanel] = useState(false)
  const [showFullCalendar, setShowFullCalendar] = useState(false)
  const [advancedActionKeys, setAdvancedActionKeys] = useState<Record<string, boolean>>({})
  const [showFeedbackPanel, setShowFeedbackPanel] = useState(false)
  const [showProfilePanel, setShowProfilePanel] = useState(true)
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const [templateImportMode, setTemplateImportMode] = useState<'overwrite' | 'new_instance'>('overwrite')
  const [templateStartWeek, setTemplateStartWeek] = useState(1)
  const [templateStartDay, setTemplateStartDay] = useState(1)
  const [showAiModifierDialog, setShowAiModifierDialog] = useState(false)
  const [aiModifierInstruction, setAiModifierInstruction] = useState('')
  const [aiModifierLoading, setAiModifierLoading] = useState(false)
  const [aiModifierError, setAiModifierError] = useState('')
  const [aiModifierPreviewDays, setAiModifierPreviewDays] = useState<TrainingDay[] | null>(null)
  const [aiModifierPreviewSummary, setAiModifierPreviewSummary] = useState('')

  // 1RM 配置
  const [oneRMValues, setOneRMValues] = useState<Record<string, number | null>>({})

  // 反馈数据
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [feedbackUnreadCount, setFeedbackUnreadCount] = useState(0)

  // 模板列表
  const [templates, setTemplates] = useState<any[]>([])
  const [showActionPicker, setShowActionPicker] = useState(false)
  const [actionKeyword, setActionKeyword] = useState('')
  const [dayActionKeyword, setDayActionKeyword] = useState('')
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('')
  const [autoSaveReady, setAutoSaveReady] = useState(false)
  const actionMapById = useMemo(() => {
    const map = new Map<string, CoachAction>()
    actions.forEach((action) => {
      const id = normalizeActionId(action.id)
      if (id) map.set(id, action)
    })
    return map
  }, [actions])
  const actionNameMapById = useMemo(() => {
    const map = new Map<string, string>()
    actions.forEach((action) => {
      const id = normalizeActionId(action.id)
      const name = String(action.name || '').trim()
      if (id && name) {
        map.set(id, name)
      }
    })
    return map
  }, [actions])
  const actionIdMapByName = useMemo(() => {
    const map = new Map<string, string>()
    actions.forEach((action) => {
      const id = normalizeActionId(action.id)
      const name = normalizeName(action.name)
      if (id && name) {
        map.set(name, id)
      }
    })
    return map
  }, [actions])
  const resolveActionItemType = useCallback((set?: ActionSet | null) => {
    const explicitType = String(set?.itemType || '').trim().toUpperCase()
    if (explicitType) return explicitType
    const actionId = getActionSetActionId(set)
    if (!actionId) return 'STRENGTH'
    const action = actionMapById.get(actionId)
    const actionType = String(action?.type || 'STRENGTH').trim().toUpperCase()
    return actionType || 'STRENGTH'
  }, [actionMapById])
  const normalizeSingleActionSet = useCallback((
    set: ActionSet,
    actionNameLookup: Map<string, string>,
    actionIdByName: Map<string, string>
  ): ActionSet => {
    const rawActionId = getActionSetActionId(set)
    const fallbackName = getActionSetRawName(set)
    const nameMatchedActionId = !rawActionId && fallbackName
      ? (actionIdByName.get(normalizeName(fallbackName)) || '')
      : ''
    const actionId = rawActionId || nameMatchedActionId
    const mappedName = actionId ? actionNameLookup.get(actionId) : ''
    const finalName = mappedName || fallbackName
    const resolvedSets = getActionSetSets(set)
    const resolvedReps = getActionSetReps(set)
    const resolvedWeight = getActionSetWeight(set)
    const nextParams: Record<string, any> = {
      ...(set?.params || {})
    }
    if (resolvedSets !== null) {
      nextParams.sets = resolvedSets
      nextParams['组数'] = resolvedSets
    }
    if (resolvedReps !== null) {
      nextParams.reps = resolvedReps
      nextParams['次数'] = resolvedReps
    }
    if (resolvedWeight !== null) {
      nextParams.load = resolvedWeight
      nextParams.weight = resolvedWeight
      nextParams['重量'] = resolvedWeight
    }
    return {
      ...set,
      action_id: actionId || undefined,
      actionId: actionId || undefined,
      action_name: finalName || undefined,
      actionName: finalName || undefined,
      setName: finalName || undefined,
      sets: resolvedSets ?? set?.sets,
      reps: resolvedReps ?? set?.reps,
      weight: resolvedWeight ?? set?.weight,
      params: nextParams
    }
  }, [])
  const normalizeActionSetTree = useCallback((
    set: ActionSet,
    actionNameLookup: Map<string, string>,
    actionIdByName: Map<string, string>
  ): ActionSet => {
    if (isOneFilterActionSet(set)) {
      const innerActions = (set.actions || []).map((innerSet) =>
        normalizeSingleActionSet(innerSet, actionNameLookup, actionIdByName)
      )
      return {
        ...set,
        actions: innerActions
      }
    }
    return normalizeSingleActionSet(set, actionNameLookup, actionIdByName)
  }, [normalizeSingleActionSet])
  const flattenDisplayActionSets = useCallback((day?: TrainingDay | null) => {
    const result: Array<{
      set: ActionSet
      path: [number] | [number, number]
      oneFilterLabel?: string
      oneFilterTitle?: string
    }> = []
    ;(day?.actionSets || []).forEach((set, index) => {
      if (isOneFilterActionSet(set)) {
        const title = getOneFilterDisplayName(set)
        ;(set.actions || []).forEach((innerSet, innerIndex) => {
          result.push({
            set: innerSet,
            path: [index, innerIndex],
            oneFilterLabel: getOneFilterOptionLabel(set, innerIndex),
            oneFilterTitle: title || undefined
          })
        })
      } else {
        result.push({ set, path: [index] })
      }
    })
    return result
  }, [])

  // 找出计划中需要1RM的动作
  const eligibleActions = useMemo(() => {
    if (!trainingDays.length || !actions.length) return []

    const usedActionIds = new Set<string>()
    const usedActionNames = new Set<string>()

    trainingDays.forEach(day => {
      flattenDisplayActionSets(day).forEach(({ set }) => {
        const actionId = getActionSetActionId(set)
        if (actionId) usedActionIds.add(actionId)
        const actionName = getActionSetRawName(set)
        if (actionName) usedActionNames.add(actionName.trim().toLowerCase())
      })
    })

    return actions.filter(action => {
      const normalizedActionId = normalizeActionId(action.id)
      const isUsed = (normalizedActionId ? usedActionIds.has(normalizedActionId) : false) ||
        (action.name ? usedActionNames.has(action.name.trim().toLowerCase()) : false)
      if (!isUsed) return false
      return isOneRMEligibleAction({
        type: action.type,
        attrs: action.attrs || undefined,
        enableAutoWeightCompute: action.enableAutoWeightCompute ?? (action as any).enable_auto_weight_compute,
      })
    })
  }, [flattenDisplayActionSets, trainingDays, actions])

  const serializePlanSnapshot = useCallback((
    name: string,
    description: string,
    executionNotice: string,
    suitableFor: string,
    days: TrainingDay[]
  ) => {
    try {
      return JSON.stringify({
        name: (name || '').trim(),
        description: (description || '').trim(),
        executionNotice: (executionNotice || '').trim(),
        suitableFor: (suitableFor || '').trim() || 'beginner',
        trainingDays: days || []
      })
    } catch (e) {
      console.error('serialize plan snapshot failed:', e)
      return ''
    }
  }, [])

  const normalizeTrainingDaysForSave = useCallback((days: TrainingDay[]) => {
    const normalizeLeafSet = (set: ActionSet): ActionSet => {
      const normalizedActionId = getActionSetActionId(set)
      const resolvedSets = getActionSetSets(set)
      const resolvedReps = getActionSetReps(set)
      const resolvedWeight = getActionSetWeight(set)
      const mergedName = getActionSetRawName(set)
      const nextParams: Record<string, any> = {
        ...(set?.params || {})
      }
      if (resolvedSets !== null) {
        nextParams.sets = resolvedSets
        nextParams['组数'] = resolvedSets
      }
      if (resolvedReps !== null) {
        nextParams.reps = resolvedReps
        nextParams['次数'] = resolvedReps
      }
      if (resolvedWeight !== null) {
        nextParams.load = resolvedWeight
        nextParams.weight = resolvedWeight
        nextParams['重量'] = resolvedWeight
      }
      return {
        ...set,
        action_id: normalizedActionId || undefined,
        actionId: normalizedActionId || undefined,
        action_name: mergedName || undefined,
        actionName: mergedName || undefined,
        setName: mergedName || undefined,
        sets: resolvedSets ?? set?.sets,
        reps: resolvedReps ?? set?.reps,
        weight: resolvedWeight ?? set?.weight,
        params: nextParams
      }
    }
    const normalizeActionSetForSave = (set: ActionSet): ActionSet => {
      if (isOneFilterActionSet(set)) {
        return {
          ...set,
          actions: (set.actions || []).map((innerSet) => normalizeActionSetForSave(innerSet))
        }
      }
      return normalizeLeafSet(set)
    }

    return (days || []).map((day, dayIdx) => {
      const normalizedDayIndex = Number(day?.dayIndex) > 0 ? Number(day.dayIndex) : dayIdx + 1
      if (day?.type !== 'training') {
        return {
          ...day,
          dayIndex: normalizedDayIndex,
          type: 'rest',
          actionSets: []
        }
      }

      return {
        ...day,
        dayIndex: normalizedDayIndex,
        type: 'training',
        actionSets: (day.actionSets || []).map((set) => normalizeActionSetForSave(set))
      }
    })
  }, [])

  const parseInputNumber = useCallback((value: string, mode: 'int' | 'float' = 'float') => {
    const text = String(value ?? '').trim()
    if (!text || text === '-' || text === '.' || text === '-.') return null
    const parsed = mode === 'int' ? parseInt(text, 10) : parseFloat(text)
    if (!Number.isFinite(parsed)) return null
    return parsed
  }, [])

  const formatFeedbackTime = useCallback((value?: string | null) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }, [])

  const filteredActionOptions = useMemo(() => {
    const keyword = actionKeyword.trim().toLowerCase()
    if (!keyword) return actions
    return actions.filter((action) => (action.name || '').toLowerCase().includes(keyword))
  }, [actions, actionKeyword])

  const actionSearchResults = useMemo(() => {
    const keyword = dayActionKeyword.trim().toLowerCase()
    if (!keyword) return []

    const result: Array<{ dayIndex: number }> = []
    trainingDays.forEach((day, idx) => {
      if (!Array.isArray(day.actionSets) || day.actionSets.length === 0) return

      const hit = flattenDisplayActionSets(day).some(({ set }) => {
        const byName = getActionSetRawName(set)
        if (byName && byName.toLowerCase().includes(keyword)) return true
        const actionId = getActionSetActionId(set)
        if (!actionId) return false
        const actionName = actionNameMapById.get(actionId)
        return Boolean(actionName && actionName.toLowerCase().includes(keyword))
      })

      if (hit) {
        result.push({ dayIndex: day.dayIndex ?? idx + 1 })
      }
    })

    return result
  }, [actionNameMapById, dayActionKeyword, flattenDisplayActionSets, trainingDays])

  const availableDayIndices = useMemo(() => {
    return trainingDays
      .map((day) => Number(day?.dayIndex))
      .filter((dayIndex) => Number.isFinite(dayIndex) && dayIndex > 0)
      .sort((a, b) => a - b)
  }, [trainingDays])

  const trainingDayMap = useMemo(() => {
    const map = new Map<number, TrainingDay>()
    trainingDays.forEach((day) => {
      const dayIndex = Number(day?.dayIndex)
      if (Number.isFinite(dayIndex) && dayIndex > 0) {
        map.set(Math.floor(dayIndex), day)
      }
    })
    return map
  }, [trainingDays])

  const getTrainingDayByDayIndex = useCallback((dayIndex?: number | null) => {
    const normalized = Math.floor(Number(dayIndex))
    if (!Number.isFinite(normalized) || normalized <= 0) return null
    return trainingDayMap.get(normalized) || null
  }, [trainingDayMap])

  const getNearestExistingDayIndex = useCallback((dayIndex?: number | null) => {
    if (!availableDayIndices.length) return 0
    const normalized = Math.floor(Number(dayIndex))
    if (Number.isFinite(normalized) && normalized > 0 && trainingDayMap.has(normalized)) {
      return normalized
    }
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return availableDayIndices[0]
    }
    if (normalized <= availableDayIndices[0]) {
      return availableDayIndices[0]
    }
    if (normalized >= availableDayIndices[availableDayIndices.length - 1]) {
      return availableDayIndices[availableDayIndices.length - 1]
    }
    let nearest = availableDayIndices[0]
    let minDistance = Math.abs(nearest - normalized)
    availableDayIndices.forEach((candidate) => {
      const distance = Math.abs(candidate - normalized)
      if (distance < minDistance) {
        nearest = candidate
        minDistance = distance
      }
    })
    return nearest
  }, [availableDayIndices, trainingDayMap])

  const updateTrainingDayByDayIndex = useCallback((
    dayIndex: number,
    updater: (currentDay: TrainingDay) => TrainingDay
  ) => {
    if (isReadonlyPlanView) return
    const normalized = Math.floor(Number(dayIndex))
    if (!Number.isFinite(normalized) || normalized <= 0) return
    setTrainingDays((prevDays) => {
      const targetIndex = prevDays.findIndex((day) => Number(day?.dayIndex) === normalized)
      if (targetIndex < 0) return prevDays
      const nextDays = [...prevDays]
      nextDays[targetIndex] = updater(nextDays[targetIndex])
      return nextDays
    })
  }, [isReadonlyPlanView])

  const weekGroups = useMemo(() => {
    const weeks: TrainingDay[][] = []
    for (let index = 0; index < trainingDays.length; index += 7) {
      weeks.push(trainingDays.slice(index, index + 7))
    }
    return weeks
  }, [trainingDays])

  // 加载数据
  const loadData = useCallback(async () => {
    if (!subscriptionId) return

    try {
      setLoading(true)
      setAutoSaveReady(false)
      const instanceRequest = historyInstanceId
        ? { id: historyInstanceId }
        : { subscriptionId }

      // 并行加载所有数据
      const [
        actionsRes,
        studentRes,
        studentActionsRes,
        instanceRes,
        exeRes
      ] = await Promise.all([
        actionLibService.listActions({ page: 1, limit: 500 }).catch(e => { console.error('Actions load failed', e); return null }),
        coachService.getStudent({ subscriptionId, need1RM: true }).catch(e => { console.error('Student load failed', e); return null }),
        coachService.getStudentActions({ subscriptionId }).catch(e => { console.error('Student actions load failed', e); return null }),
        planLibService.getInstance(instanceRequest).catch(e => { console.error('Instance load failed', e); return null }),
        isReadonlyPlanView
          ? Promise.resolve(null)
          : planLibService.getWithExecutions({ subscriptionId }).catch(e => { console.error('Execution load failed', e); return null })
      ])

      // 处理学员数据
      if (studentRes?.student) {
        setStudentData(studentRes.student)
      }
      if (studentActionsRes?.actions) {
        setStudentActions(studentActionsRes.actions as StudentAction[])
      }

      // 处理计划实例
      let nextInstanceId: string | null = null
      if (instanceRes?.instance) {
        const inst = instanceRes.instance as PlanInstanceWithExtras
        const editableCurrentInstance = inst.status === 'active' || inst.status === 'paused'
        setInstance(isReadonlyPlanView || editableCurrentInstance ? inst : null)
        if (!isReadonlyPlanView && editableCurrentInstance) {
          nextInstanceId = inst.id
        }
        setEditName(inst.name || '')
        setEditDescription(inst.description || '')
        setEditExecutionNotice(inst.execution_notice || (inst as any).executionNotice || '')
        setEditSuitableFor(inst.suitable_for || 'beginner')

        // 加载反馈
        try {
          const fbRes = await coachService.getStudentFeedbacks({ instanceId: inst.id, markRead: !isReadonlyPlanView })
          if (fbRes) {
            setFeedbacks(fbRes.feedbacks || [])
            setFeedbackUnreadCount(fbRes.unread_count || 0)
          }
        } catch (e) { console.error('Feedbacks load failed', e) }
      } else {
        setInstance(null)
        setInstanceId(null)
        setEditName('')
        setEditDescription('')
        setEditExecutionNotice('')
        setFeedbacks([])
        setFeedbackUnreadCount(0)
        setShowOneRMPanel(false)
        setLastSavedSnapshot('')
      }

      // 处理动作映射：合并 教练动作库 + get-instance + get-with-executions
      const mergedActionMap = new Map<string, CoachAction>()
      const upsertAction = (raw: any, fallbackId?: string) => {
        if (!raw && !fallbackId) return
        const normalizedId = normalizeActionId(raw?.id ?? fallbackId)
        if (!normalizedId) return
        const previous = mergedActionMap.get(normalizedId)
        const incomingAttrs = Array.isArray(raw?.attrs) ? raw.attrs : undefined
        const previousAttrs = previous?.attrs
        mergedActionMap.set(normalizedId, {
          ...(previous || {}),
          ...(raw || {}),
          id: normalizedId,
          name: raw?.name || previous?.name || normalizedId,
          type: raw?.type ?? previous?.type ?? null,
          attrs: incomingAttrs ?? previousAttrs ?? null,
          canonical_action_id: raw?.canonical_action_id ?? previous?.canonical_action_id ?? null,
          enableAutoWeightCompute:
            raw?.enableAutoWeightCompute ??
            raw?.enable_auto_weight_compute ??
            previous?.enableAutoWeightCompute ??
            (previous as any)?.enable_auto_weight_compute ??
            null
        })
      }

      ;(actionsRes?.actions || []).forEach(upsertAction)
      Object.entries(instanceRes?.actions || {}).forEach(([id, action]) => upsertAction(action, id))
      Object.entries(exeRes?.actions || {}).forEach(([id, action]) => upsertAction(action, id))

      const mergedActions = mergedActionMap.size > 0 ? Array.from(mergedActionMap.values()) : []
      setActions(mergedActions)

      const mergedActionNameLookup = new Map<string, string>()
      const mergedActionIdByName = new Map<string, string>()
      mergedActions.forEach((action) => {
        const id = normalizeActionId(action.id)
        const name = String(action.name || '').trim()
        if (id && name) {
          mergedActionNameLookup.set(id, name)
          mergedActionIdByName.set(normalizeName(name), id)
        }
      })

      // 处理训练日（优先使用 get-instance，包含完整动作参数）
      const rawInstanceTrainingDays = (instanceRes?.instance as any)?.training_days ??
        (instanceRes?.instance as any)?.trainingDays
      const rawExecutionTrainingDays = (exeRes as any)?.training_days ??
        (exeRes as any)?.trainingDays
      const instanceTrainingDays = parseJsonArrayMaybe(rawInstanceTrainingDays) as TrainingDay[]
      const executionTrainingDays = parseJsonArrayMaybe(rawExecutionTrainingDays) as TrainingDay[]
      const nextTrainingDays = instanceTrainingDays.length > 0
        ? instanceTrainingDays
        : executionTrainingDays
      const normalizedLoadedTrainingDays = (nextTrainingDays || []).map((day, dayIdx) => {
        const normalizedActionSetRawList = parseJsonArrayMaybe(
          (day as any)?.actionSets ??
          (day as any)?.action_sets
        )
        const rawDayIndex = Number((day as any)?.dayIndex ?? (day as any)?.day_index)
        const normalizedDayIndex = rawDayIndex > 0 ? rawDayIndex : dayIdx + 1
        const dayType = String((day as any)?.type || 'training')
        if (dayType !== 'training') {
          return {
            ...day,
            dayIndex: normalizedDayIndex,
            type: 'rest',
            actionSets: []
          }
        }
        const nextActionSets = normalizedActionSetRawList.map((set) =>
          normalizeActionSetTree(set, mergedActionNameLookup, mergedActionIdByName)
        )
        return {
          ...day,
          dayIndex: normalizedDayIndex,
          type: 'training',
          actionSets: nextActionSets
        }
      }).sort((a, b) => Number(a?.dayIndex || 0) - Number(b?.dayIndex || 0))
      setTrainingDays(normalizedLoadedTrainingDays)
      setSelectedDayIndex((prev) => {
        if (normalizedLoadedTrainingDays.length === 0) return 0
        const loadedDayIndices = normalizedLoadedTrainingDays
          .map((day) => Number(day?.dayIndex))
          .filter((dayIndex) => Number.isFinite(dayIndex) && dayIndex > 0)
          .sort((a, b) => a - b)
        const firstDayIndex = loadedDayIndices[0] || 0
        if (Number.isFinite(focusDayParam) && focusDayParam > 0) {
          const focusedDayIndex = Math.floor(focusDayParam)
          if (loadedDayIndices.includes(focusedDayIndex)) {
            return focusedDayIndex
          }
        }
        if (prev > 0 && loadedDayIndices.includes(prev)) {
          return prev
        }
        return firstDayIndex
      })
      if (openFeedbackParam) {
        setShowFeedbackPanel(true)
      }
      const normalizedForSave = normalizeTrainingDaysForSave(normalizedLoadedTrainingDays)
      setLastSavedSnapshot(
        serializePlanSnapshot(
          instanceRes?.instance?.name || '',
          instanceRes?.instance?.description || '',
          (instanceRes?.instance as any)?.execution_notice || (instanceRes?.instance as any)?.executionNotice || '',
          (instanceRes?.instance as PlanInstanceWithExtras | undefined)?.suitable_for || 'beginner',
          normalizedForSave
        )
      )
      setInstanceId(nextInstanceId)
      setAutoSaveReady(Boolean(!isReadonlyPlanView && nextInstanceId && normalizedForSave.length > 0))
      setAutoSaveStatus('idle')

      // 处理执行记录
      if (isReadonlyPlanView && instanceRes?.executionsByDayIndex) {
        setExecutions(instanceRes.executionsByDayIndex as Record<number, Execution>)
      } else if (exeRes?.executions) {
        setExecutions(exeRes.executions)
      } else {
        setExecutions({})
      }

      if (!studentActionsRes?.actions && studentRes?.student?.subscribe_data) {
        const subscribeData = studentRes.student.subscribe_data
        if (Array.isArray(subscribeData)) {
          setStudentActions(subscribeData as StudentAction[])
        }
      }
    } catch (error) {
      console.error('加载数据失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [focusDayParam, historyInstanceId, isReadonlyPlanView, normalizeActionSetTree, normalizeTrainingDaysForSave, openFeedbackParam, serializePlanSnapshot, subscriptionId])

  useEffect(() => {
    if (!subscriptionId) {
      Taro.showToast({ title: '缺少学员参数', icon: 'none' })
      setLoading(false)
      return
    }
    loadData()
  }, [subscriptionId, loadData])

  // 初始化 1RM 值
  useEffect(() => {
    if (eligibleActions.length === 0 || studentActions.length === 0) return

    const values: Record<string, number | null> = {}
    eligibleActions.forEach(coachAction => {
      let matched = studentActions.find(s =>
        coachAction.canonical_action_id &&
        s.canonical_action_id &&
        s.canonical_action_id === coachAction.canonical_action_id
      )
      if (!matched) {
        const targetName = normalizeName(coachAction.name)
        matched = studentActions.find(s => normalizeName(s.name) === targetName)
      }
      if (matched) {
        values[coachAction.id] = matched.reference_1rm
      } else {
        values[coachAction.id] = null
      }
    })
    setOneRMValues(values)
  }, [eligibleActions, studentActions])

  // 自动保存
  useEffect(() => {
    if (isReadonlyPlanView) return
    if (!autoSaveReady) return
    if (loading) return
    if (!instanceId) return
    const normalizedTrainingDays = normalizeTrainingDaysForSave(trainingDays)
    if (!normalizedTrainingDays.length) {
      setAutoSaveStatus('idle')
      return
    }
    const currentSnapshot = serializePlanSnapshot(
      editName,
      editDescription,
      editExecutionNotice,
      editSuitableFor,
      normalizedTrainingDays
    )
    if (!currentSnapshot) return

    if (currentSnapshot === lastSavedSnapshot) {
      setAutoSaveStatus('idle')
      return
    }

    setAutoSaveStatus('pending')
    const timer = setTimeout(async () => {
      setAutoSaveStatus('saving')
      try {
        await planLibService.updateInstance({
          id: instanceId,
          name: editName,
          description: editDescription || null,
          executionNotice: editExecutionNotice || null,
          suitableFor: editSuitableFor || 'beginner',
          trainingDays: normalizedTrainingDays
        })
        setLastSavedSnapshot(currentSnapshot)
        setInstance((prev) => (prev ? { ...prev, name: editName, description: editDescription, execution_notice: editExecutionNotice || null } : prev))
        setAutoSaveStatus('saved')
        setTimeout(() => setAutoSaveStatus('idle'), 1800)
      } catch (error) {
        console.error('保存失败:', error)
        setAutoSaveStatus('error')
      }
    }, 1200)

    return () => clearTimeout(timer)
  }, [
    editDescription,
    editExecutionNotice,
    editName,
    editSuitableFor,
    autoSaveReady,
    instanceId,
    isReadonlyPlanView,
    lastSavedSnapshot,
    loading,
    normalizeTrainingDaysForSave,
    serializePlanSnapshot,
    trainingDays
  ])

  // 保存 1RM
  const handleSaveOneRM = async () => {
    if (isReadonlyPlanView) {
      Taro.showToast({ title: '历史计划仅支持查看', icon: 'none' })
      return
    }
    if (!subscriptionId || eligibleActions.length === 0) return

    const updates: Array<{ actionId: string; reference_1rm: number | null }> = []
    eligibleActions.forEach(coachAction => {
      const studentAction = studentActions.find(s =>
        (coachAction.canonical_action_id && s.canonical_action_id && s.canonical_action_id === coachAction.canonical_action_id) ||
        normalizeName(s.name) === normalizeName(coachAction.name)
      )
      if (studentAction && studentAction.id) {
        const value = oneRMValues[coachAction.id]
        updates.push({ actionId: studentAction.id, reference_1rm: value !== undefined ? value : null })
      }
    })

    if (updates.length === 0) {
      Taro.showToast({ title: '所有动作尚未同步到学员动作库', icon: 'none' })
      return
    }

    setSaving(true)
    try {
      const res = await coachService.batchUpdateStudent1RM({ subscriptionId, updates })
      if (res) {
        Taro.showToast({ title: `已更新 ${res.updated || 0} 个动作的1RM`, icon: 'success' })
        const refreshRes = await coachService.getStudentActions({ subscriptionId })
        if (refreshRes?.actions) {
          setStudentActions(refreshRes.actions as StudentAction[])
        }
      }
    } catch (error) {
      console.error('保存1RM失败:', error)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const handleOneRMChange = (coachActionId: string, val: string) => {
    const parsed = val === '' ? null : parseFloat(val)
    const numVal = parsed === null || !Number.isFinite(parsed) ? null : parsed
    setOneRMValues(prev => ({ ...prev, [coachActionId]: numVal }))
  }

  // 暂停/继续计划
  const handleTogglePlanStatus = async () => {
    if (isReadonlyPlanView) {
      Taro.showToast({ title: '历史计划仅支持查看', icon: 'none' })
      return
    }
    if (!instanceId || !instance) return
    try {
      if (instance.status === 'active') {
        await planLibService.pauseInstance(instanceId)
        setInstance({ ...instance, status: 'paused' })
        Taro.showToast({ title: '已暂停计划', icon: 'success' })
      } else if (instance.status === 'paused') {
        await planLibService.resumeInstance(instanceId)
        setInstance({ ...instance, status: 'active' })
        Taro.showToast({ title: '已恢复计划', icon: 'success' })
      }
    } catch (error) {
      console.error('操作失败:', error)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  const handleContactStudent = useCallback(async (options?: { draft?: string }) => {
    const coachId = authService.getCurrentUser()?.id
    const studentId = studentData?.student_id
    if (!coachId || !studentId) {
      Taro.showToast({ title: '学员信息不完整', icon: 'none' })
      return
    }
    if (coachId === studentId) {
      Taro.showToast({ title: '无法与自己发起会话', icon: 'none' })
      return
    }

    const peerName = studentData?.profile?.nickname || studentData?.profile?.full_name || '学员'
    try {
      const room = await chatService.getChatroom({ members: [coachId, studentId] })
      if (!room?.id) {
        Taro.showToast({ title: '创建会话失败，请稍后重试', icon: 'none' })
        return
      }
      const draftText = (options?.draft || '').trim()
      const draftQuery = draftText ? `&draft=${encodeURIComponent(draftText.slice(0, 180))}` : ''
      await Taro.navigateTo({
        url: `/me/messages/chat/index?roomId=${room.id}&peerName=${encodeURIComponent(peerName)}${draftQuery}`
      })
    } catch (error) {
      console.error('[coach/students/plan] open chat failed:', error)
      Taro.showToast({ title: '打开会话失败，请稍后重试', icon: 'none' })
    }
  }, [studentData])

  const handleFocusFeedbackDay = useCallback((dayIndex?: number | null) => {
    if (!trainingDays.length) {
      Taro.showToast({ title: '计划天数为空', icon: 'none' })
      return
    }
    if (!Number.isFinite(Number(dayIndex)) || Number(dayIndex) <= 0) {
      Taro.showToast({ title: '反馈训练日无效', icon: 'none' })
      return
    }
    const target = getNearestExistingDayIndex(dayIndex)
    if (!target) {
      Taro.showToast({ title: '未找到对应训练日', icon: 'none' })
      return
    }
    setSelectedDayIndex(target)
  }, [getNearestExistingDayIndex, trainingDays.length])

  const buildFeedbackDraft = useCallback((feedback: Feedback) => {
    const dayText = Number.isFinite(Number(feedback.day_index)) && Number(feedback.day_index) > 0
      ? `第${Math.floor(Number(feedback.day_index))}天`
      : '当天训练'
    const difficultyText = feedback.difficulty_rating
      ? `难度反馈：${FEEDBACK_DIFFICULTY_MAP[feedback.difficulty_rating] || `${feedback.difficulty_rating}/5`}`
      : ''
    const contentText = (feedback.content || '').trim()
    const lines = [
      `我看到了你 ${dayText} 的训练反馈。`,
      difficultyText,
      contentText ? `你写到：${contentText}` : ''
    ].filter(Boolean)
    return lines.join('\n')
  }, [])

  const handleReplyFeedback = useCallback(async (feedback: Feedback) => {
    const draft = buildFeedbackDraft(feedback)
    await handleContactStudent({ draft })
  }, [buildFeedbackDraft, handleContactStudent])

  // 加载模板列表
  const loadTemplates = async (searchKeyword?: string) => {
    try {
      const res = await planLibService.listTemplates({ page: 1, limit: 50, search: searchKeyword ?? templateSearch })
      if (res?.templates) {
        setTemplates(res.templates)
      }
    } catch (error) {
      console.error('加载模板失败:', error)
    }
  }

  // 从模板创建计划
  const handleCreateFromTemplate = async (templateId: string, startConfig?: { weekIndex: number; dayIndex: number; startDate?: string }) => {
    if (isReadonlyPlanView) {
      Taro.showToast({ title: '历史计划仅支持查看', icon: 'none' })
      return
    }
    if (!subscriptionId) {
      Taro.showToast({ title: '缺少学员参数', icon: 'none' })
      return
    }
    try {
      setSaving(true)
      const normalizedStartWeek = Math.max(1, startConfig?.weekIndex || templateStartWeek || 1)
      const normalizedStartDay = Math.max(1, Math.min(7, startConfig?.dayIndex || templateStartDay || 1))
      const startExecutionDay = (normalizedStartWeek - 1) * 7 + normalizedStartDay
      const calculatedStartDate = startConfig?.startDate
        ? startConfig.startDate
        : (() => {
          const date = new Date()
          date.setDate(date.getDate() - ((normalizedStartWeek - 1) * 7 + (normalizedStartDay - 1)))
          return date.toISOString()
        })()

      let success = false
      if (instanceId && templateImportMode === 'overwrite') {
        const templateRes = await planLibService.getTemplate(templateId)
        const updateRes = await planLibService.updateInstance({
          id: instanceId,
          templateId,
          name: editName || templateRes?.template?.name || '训练计划',
          description: editDescription || templateRes?.template?.description || null,
          executionNotice: editExecutionNotice || templateRes?.template?.execution_notice || templateRes?.template?.executionNotice || null,
          suitableFor: editSuitableFor || templateRes?.template?.suitable_for || 'beginner',
          startExecutionDay,
          trainingDays: templateRes?.days || []
        })
        success = Boolean(updateRes)
      } else {
        const res = await planLibService.createInstance({
          templateId,
          subscriptionId,
          name: editName || '新训练计划',
          description: editDescription || null,
          executionNotice: editExecutionNotice || null,
          suitableFor: editSuitableFor || 'beginner',
          startDate: calculatedStartDate,
          startWeek: normalizedStartWeek,
          startDay: normalizedStartDay
        })
        success = Boolean(res?.instance)
      }

      if (success) {
        Taro.showToast({ title: '计划创建成功', icon: 'success' })
        loadData()
        setShowTemplateDialog(false)
      } else {
        Taro.showToast({ title: '计划创建失败，请重试', icon: 'none' })
      }
    } catch (error) {
      console.error('创建计划失败:', error)
      Taro.showToast({ title: '创建失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  // 获取动作名称
  const getActionName = (actionId?: string, fallbackName?: string) => {
    const normalizedAction = normalizeActionId(actionId)
    if (normalizedAction) {
      const mappedName = actionNameMapById.get(normalizedAction)
      if (mappedName) return mappedName
    }
    const cleanedFallbackName = String(fallbackName || '').trim()
    if (cleanedFallbackName && !isPlaceholderActionName(cleanedFallbackName)) {
      return cleanedFallbackName
    }
    return ''
  }
  const getActionAttrLabels = useCallback((set?: ActionSet | null) => {
    const actionId = getActionSetActionId(set)
    if (!actionId) return [] as string[]
    const action = actionMapById.get(actionId)
    if (!action?.attrs || !Array.isArray(action.attrs)) return [] as string[]
    return action.attrs
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  }, [actionMapById])
  const getActionSetExtraParamKeys = useCallback((set?: ActionSet | null, attrLabels?: string[]) => {
    const params = set?.params || {}
    const consumedKeys = new Set<string>([
      'sets',
      'reps',
      'load',
      'weight',
      'intensity',
      'note',
      'suggested_time',
      'custom_data',
      '组数',
      '次数',
      '重量',
      '重量(kg)',
      ...(attrLabels || [])
    ])
    return Object.keys(params).filter((key) => {
      if (!key) return false
      if (INTERNAL_PARAM_KEYS.has(key)) return false
      if (consumedKeys.has(key)) return false
      return true
    })
  }, [])
  const getStrengthModeSummary = useCallback((set?: ActionSet | null) => {
    const params = set?.params || {}
    const config = params?.intensityConfig || {}
    const relative = config?.relativeIntensity || {}
    if (relative?.type === 'percentage') {
      const value = toFiniteNumber(relative?.value)
      return value !== null ? `1RM ${value}%` : '1RM 百分比'
    }
    if (relative?.type === 'rm') {
      const value = toFiniteNumber(relative?.value ?? params?.['强度'])
      return value !== null ? `${value}RM` : 'RM'
    }
    const legacyRm = toFiniteNumber(params?.['强度'])
    if (legacyRm !== null) return `${legacyRm}RM`
    const fixedWeight = toFiniteNumber(config?.fixedWeight ?? params?.load ?? params?.weight)
    if (fixedWeight !== null) return `固定重量 ${fixedWeight}${params?.loadUnit || 'kg'}`
    return '固定重量'
  }, [])
  const getStrengthComputedSummary = useCallback((set?: ActionSet | null) => {
    const params = set?.params || {}
    const algorithm = String(params?.algorithm || '').trim()
    const loadSource = String(params?.loadSource || '').trim()
    const loadDisplayText = String(params?.loadDisplayText || '').trim()
    const loadUnit = String(params?.loadUnit || 'kg').trim() || 'kg'
    const loadValue = toFiniteNumber(params?.load ?? params?.weight)
    const parts: string[] = []
    if (algorithm) parts.push(`算法: ${algorithm}`)
    if (loadValue !== null) parts.push(`推荐负重: ${loadValue}${loadUnit}`)
    if (loadSource) parts.push(`来源: ${loadSource}`)
    if (loadDisplayText) parts.push(loadDisplayText)
    return parts
  }, [])

  const updateSelectedDayActionSet = (
    path: [number] | [number, number],
    updater: (current: ActionSet) => ActionSet
  ) => {
    if (!selectedTrainingDay) return
    updateTrainingDayByDayIndex(selectedTrainingDay.dayIndex, (currentDay) => {
      const nextActionSets = [...(currentDay.actionSets || [])]
      if (path.length === 1) {
        const topIndex = path[0]
        const currentSet = nextActionSets[topIndex]
        if (!currentSet) return currentDay
        nextActionSets[topIndex] = updater(currentSet)
      } else {
        const [topIndex, innerIndex] = path
        const parentSet = nextActionSets[topIndex]
        if (!parentSet || !isOneFilterActionSet(parentSet)) return currentDay
        const nextInnerActions = [...(parentSet.actions || [])]
        const currentSet = nextInnerActions[innerIndex]
        if (!currentSet) return currentDay
        nextInnerActions[innerIndex] = updater(currentSet)
        nextActionSets[topIndex] = {
          ...parentSet,
          actions: nextInnerActions
        }
      }
      return {
        ...currentDay,
        actionSets: nextActionSets
      }
    })
  }
  const toggleActionAdvanced = useCallback((pathKey: string) => {
    setAdvancedActionKeys((current) => ({
      ...current,
      [pathKey]: !current[pathKey]
    }))
  }, [])
  const updateSelectedDayActionParams = useCallback((
    path: [number] | [number, number],
    updates: Record<string, any>
  ) => {
    updateSelectedDayActionSet(path, (current) => ({
      ...current,
      params: {
        ...(current.params || {}),
        ...updates
      }
    }))
  }, [updateSelectedDayActionSet])
  const updateSelectedDayActionCustomData = useCallback((
    path: [number] | [number, number],
    updates: Record<string, any>
  ) => {
    updateSelectedDayActionSet(path, (current) => ({
      ...current,
      params: {
        ...(current.params || {}),
        custom_data: {
          ...((current.params || {}).custom_data || {}),
          ...updates
        }
      }
    }))
  }, [updateSelectedDayActionSet])
  const getItemMeta = useCallback((itemType?: string | null) => {
    const normalized = String(itemType || 'STRENGTH').trim().toUpperCase()
    switch (normalized) {
      case 'CARDIO':
        return { short: '有', label: '有氧', tone: 'cardio' }
      case 'DIET':
        return { short: '食', label: '饮食', tone: 'diet' }
      case 'HABIT':
        return { short: '习', label: '习惯', tone: 'habit' }
      case 'STRENGTH':
      default:
        return { short: '力', label: '力量', tone: 'strength' }
    }
  }, [])
  const getActionForSet = useCallback((set?: ActionSet | null) => {
    const actionId = getActionSetActionId(set)
    if (!actionId) return undefined
    return actionMapById.get(actionId)
  }, [actionMapById])
  const studentBodyWeight = useMemo(() => {
    const weight = Number(studentData?.profile?.weight || 0)
    return Number.isFinite(weight) && weight > 0 ? weight : null
  }, [studentData])
  const getStrengthControlState = useCallback((set?: ActionSet | null) => {
    const params = set?.params || {}
    const config = params?.intensityConfig || {}
    const relative = config?.relativeIntensity || {}
    if (relative?.type === 'percentage') {
      const value = toFiniteNumber(relative?.value)
      return {
        mode: 'percentage' as const,
        value: value !== null ? String(value) : ''
      }
    }
    const rmValue = toFiniteNumber(relative?.value ?? params?.['强度'])
    if (relative?.type === 'rm' || rmValue !== null) {
      return {
        mode: 'rm' as const,
        value: rmValue !== null ? String(rmValue) : ''
      }
    }
    const fixedValue = toFiniteNumber(config?.fixedWeight ?? params?.load ?? params?.weight)
    return {
      mode: 'fixed' as const,
      value: fixedValue !== null ? String(fixedValue) : ''
    }
  }, [])
  const setStrengthControlState = useCallback((
    path: [number] | [number, number],
    control: { mode: 'rm' | 'percentage' | 'fixed'; value: string }
  ) => {
    updateSelectedDayActionSet(path, (current) => {
      const nextParams = {
        ...(current.params || {})
      } as Record<string, any>
      const nextConfig = nextParams.intensityConfig && typeof nextParams.intensityConfig === 'object'
        ? { ...nextParams.intensityConfig }
        : {}
      const trimmed = String(control.value || '').trim()
      const numericValue = trimmed === '' ? null : Number(trimmed)

      delete nextConfig.relativeIntensity
      delete nextConfig.fixedWeight

      if (control.mode === 'fixed') {
        delete nextParams['强度']
        delete nextParams.intensity
        if (numericValue !== null && Number.isFinite(numericValue) && numericValue >= 0) {
          nextParams.load = numericValue
          nextParams.weight = numericValue
          nextConfig.fixedWeight = numericValue
        } else {
          delete nextParams.load
          delete nextParams.weight
          delete nextParams['重量']
        }
      } else if (control.mode === 'rm') {
        if (numericValue !== null && Number.isFinite(numericValue) && numericValue > 0) {
          nextParams['强度'] = numericValue
          nextParams.intensity = `${numericValue}RM`
          nextConfig.relativeIntensity = {
            type: 'rm',
            value: numericValue
          }
        } else {
          delete nextParams['强度']
          delete nextParams.intensity
        }
      } else {
        delete nextParams['强度']
        if (numericValue !== null && Number.isFinite(numericValue) && numericValue > 0) {
          nextParams.intensity = `${numericValue}%`
          nextConfig.relativeIntensity = {
            type: 'percentage',
            value: numericValue
          }
        } else {
          delete nextParams.intensity
        }
      }

      if (Object.keys(nextConfig).length > 0) {
        nextParams.intensityConfig = nextConfig
      } else {
        delete nextParams.intensityConfig
      }

      return {
        ...current,
        weight: control.mode === 'fixed' && numericValue !== null && Number.isFinite(numericValue)
          ? numericValue
          : current.weight,
        params: nextParams
      }
    })
  }, [updateSelectedDayActionSet])
  const getReferenceOneRMForSet = useCallback((set?: ActionSet | null) => {
    const action = getActionForSet(set)
    if (!action) return null
    const localValue = oneRMValues[action.id]
    if (localValue !== undefined && localValue !== null && Number.isFinite(Number(localValue))) {
      return Number(localValue)
    }
    const studentAction = studentActions.find((studentItem) =>
      (action.canonical_action_id && studentItem.canonical_action_id && studentItem.canonical_action_id === action.canonical_action_id) ||
      normalizeName(studentItem.name) === normalizeName(action.name)
    )
    if (studentAction?.reference_1rm !== null && studentAction?.reference_1rm !== undefined) {
      return Number(studentAction.reference_1rm)
    }
    const aggregated = studentData?.aggregated1RM || {}
    const aggregatedValue =
      aggregated[action.id] ??
      aggregated[action.canonical_action_id || ''] ??
      aggregated[action.name]
    return Number.isFinite(Number(aggregatedValue)) ? Number(aggregatedValue) : null
  }, [getActionForSet, oneRMValues, studentActions, studentData])
  const getStrengthPreviewResult = useCallback((set?: ActionSet | null) => {
    const action = getActionForSet(set)
    const control = getStrengthControlState(set)
    const params = {
      ...(set?.params || {})
    } as Record<string, any>
    if (control.mode === 'fixed') {
      params.load = control.value ? Number(control.value) : params.load
    } else if (control.value) {
      params.intensity = control.mode === 'percentage'
        ? `${control.value}%`
        : `${control.value}RM`
    }
    return buildStrengthPreview(params, {
      action: action as any,
      oneRM: getReferenceOneRMForSet(set),
      bodyWeight: studentBodyWeight
    })
  }, [getActionForSet, getReferenceOneRMForSet, getStrengthControlState, studentBodyWeight])
  const getActionSummaryText = useCallback((set?: ActionSet | null) => {
    const itemType = resolveActionItemType(set)
    const params = set?.params || {}
    const customData = params.custom_data || {}

    if (isStrengthItemType(itemType)) {
      const control = getStrengthControlState(set)
      return [
        getActionSetSets(set) ? `${getActionSetSets(set)}组` : '',
        getActionSetReps(set) ? `${getActionSetReps(set)}次` : '',
        control.value
          ? `${control.value}${control.mode === 'rm' ? 'RM' : control.mode === 'percentage' ? '%' : 'kg'}`
          : '',
        params?.['休息时间'] ? `${params['休息时间']}min` : ''
      ].filter(Boolean).join(' · ') || '补充组数、次数和强度'
    }

    if (itemType === 'CARDIO') {
      const duration = Number(customData.duration || 0)
      const distance = Number(customData.distance || 0)
      const pace = Number(customData.pace || 0)
      return [
        duration > 0 ? `${Math.round(duration / 60)}分钟` : '',
        distance > 0 ? `${Number((distance / 1000).toFixed(1))}km` : '',
        pace > 0 ? `${pace}配速` : ''
      ].filter(Boolean).join(' · ') || '填写有氧内容'
    }

    if (itemType === 'DIET') {
      return [
        String(customData.content || '').trim(),
        customData.calories ? `${customData.calories}kcal` : ''
      ].filter(Boolean).join(' · ') || '填写饮食建议'
    }

    return [
      String(customData.habit_name || '').trim(),
      customData.target_duration ? `${customData.target_duration}` : ''
    ].filter(Boolean).join(' · ') || '填写习惯目标'
  }, [getStrengthControlState, resolveActionItemType])

  const getDisplayDayNumber = (dayIndex: number) => {
    const normalized = Math.floor(Number(dayIndex))
    if (Number.isFinite(normalized) && normalized > 0 && trainingDayMap.has(normalized)) {
      return normalized
    }
    return availableDayIndices[0] || 0
  }

  const getExecutionForDay = (dayIndex: number) => {
    const normalizedDayIndex = getDisplayDayNumber(dayIndex)
    if (!normalizedDayIndex) return null
    return executions[normalizedDayIndex] || null
  }
  const renderActionSetEditor = (
    actionSet: ActionSet,
    path: [number] | [number, number],
    options?: { oneFilterLabel?: string; oneFilterTitle?: string }
  ) => {
    const params = actionSet?.params || {}
    const customData = params.custom_data || {}
    const itemType = resolveActionItemType(actionSet)
    const itemMeta = getItemMeta(itemType)
    const isStrength = isStrengthItemType(itemType)
    const strengthComputedSummary = getStrengthComputedSummary(actionSet)
    const strengthControl = getStrengthControlState(actionSet)
    const strengthPreview = isStrength ? getStrengthPreviewResult(actionSet) : null
    const mainAttrLabels = getActionAttrLabels(actionSet).filter((attr) => !['组数', '次数', '重量', '重量(kg)', '强度', '休息时间', '持续时间'].includes(attr))
    const extraParamKeys = getActionSetExtraParamKeys(actionSet, [...mainAttrLabels, '强度', '休息时间', '持续时间'])
    const setTitle = getActionName(
      getActionSetActionId(actionSet),
      getActionSetRawName(actionSet)
    ) || '未选择动作'
    const summaryText = getActionSummaryText(actionSet)
    const pathKey = path.join('-')
    const advancedOpen = Boolean(advancedActionKeys[pathKey])
    const topIndex = path[0]
    const innerIndex = path.length > 1 ? path[1] : -1
    const handleDelete = () => {
      if (!selectedTrainingDay) return
      updateTrainingDayByDayIndex(selectedTrainingDay.dayIndex, (currentDay) => {
        const nextActionSets = [...(currentDay.actionSets || [])]
        if (innerIndex < 0) {
          nextActionSets.splice(topIndex, 1)
        } else {
          const parentSet = nextActionSets[topIndex]
          if (!parentSet || !isOneFilterActionSet(parentSet)) return currentDay
          const nextInnerActions = [...(parentSet.actions || [])]
          nextInnerActions.splice(innerIndex, 1)
          nextActionSets[topIndex] = {
            ...parentSet,
            actions: nextInnerActions
          }
        }
        return {
          ...currentDay,
          actionSets: nextActionSets
        }
      })
    }
    const renderLooseParamInput = (key: string, label?: string) => {
      const value = actionSet?.params?.[key]
      const unit = getParamUnit(key)
      if (!isSimpleParamValue(value)) {
        return (
          <View key={`extra-${pathKey}-${key}`} className='param-item param-item-full'>
            <Text className='param-label'>{label || getParamDisplayLabel(key)}</Text>
            <Text className='param-readonly'>{JSON.stringify(value)}</Text>
          </View>
        )
      }
      return (
        <View key={`extra-${pathKey}-${key}`} className='param-item'>
          <Text className='param-label'>{label || getParamDisplayLabel(key)}{unit ? `(${unit})` : ''}</Text>
          <Input
            className='param-input'
            type='text'
            value={value === undefined || value === null ? '' : String(value)}
            onInput={(e) => {
              const nextValue = parseLooseParamValue(e.detail.value)
              updateSelectedDayActionSet(path, (current) => {
                const nextParams = {
                  ...(current.params || {})
                } as any
                if (nextValue === undefined) {
                  delete nextParams[key]
                } else {
                  nextParams[key] = nextValue
                }
                return {
                  ...current,
                  params: nextParams
                }
              })
            }}
            placeholder={`输入${label || getParamDisplayLabel(key)}`}
          />
        </View>
      )
    }

    return (
      <View
        key={`set-${path.join('-')}`}
        className={`action-set-item action-set-item--${itemMeta.tone} ${advancedOpen ? 'expanded' : ''}`}
      >
        <View className='action-set-header'>
          <View className='action-set-main'>
            <View className={`action-set-type-badge ${itemMeta.tone}`}>
              <Text className='action-set-type-short'>{itemMeta.short}</Text>
            </View>
            <View className='action-set-title-wrap'>
              <Text className='action-set-name'>{setTitle}</Text>
              <Text className='action-set-summary'>{summaryText}</Text>
              <View className='action-set-badges'>
                <Text className={`action-set-badge item-type ${itemMeta.tone}`}>{itemMeta.label}</Text>
                {options?.oneFilterTitle ? (
                  <Text className='action-set-badge question'>{options.oneFilterTitle}</Text>
                ) : null}
                {options?.oneFilterLabel ? (
                  <Text className='action-set-badge option'>{options.oneFilterLabel}</Text>
                ) : null}
              </View>
            </View>
          </View>
          <View className='action-set-actions'>
            <Text className='action-set-more' onClick={() => toggleActionAdvanced(pathKey)}>
              {advancedOpen ? '收起' : '更多'}
            </Text>
            {!isReadonlyPlanView && (
              <Text className='action-set-delete' onClick={handleDelete}>删除</Text>
            )}
          </View>
        </View>

        {isStrength ? (
          <View className={`strength-summary-card ${strengthPreview?.source || 'missing'}`}>
            <Text className='strength-summary-mode'>强度模式 · {getStrengthModeSummary(actionSet)}</Text>
            {strengthPreview?.source === 'auto' || strengthPreview?.source === 'manual' ? (
              <Text className='strength-summary-line highlight'>
                {strengthPreview.source === 'auto' ? '自动算重' : '固定重量'} · {strengthPreview.value}{strengthPreview.unit || 'kg'}
                {strengthPreview.basis ? ` · ${strengthPreview.basis}` : ''}
              </Text>
            ) : (
              <Text className='strength-summary-line muted'>
                {strengthPreview?.reason || '填写强度后显示自动算重'}
              </Text>
            )}
            {strengthComputedSummary.map((line) => (
              <Text key={`${path.join('-')}-${line}`} className='strength-summary-line'>{line}</Text>
            ))}
          </View>
        ) : null}

        {isStrength ? (
          <>
            <View className='action-set-params action-set-params--strength'>
              <View className='param-item'>
                <Text className='param-label'>组数</Text>
                <Input
                  className='param-input'
                  type='number'
                  value={String(getActionSetSets(actionSet) ?? '')}
                  onInput={(e) => {
                    const parsedSets = parseInputNumber(e.detail.value, 'int')
                    updateSelectedDayActionSet(path, (current) => {
                      const normalized = parsedSets === null ? undefined : Math.max(1, Math.floor(parsedSets))
                      const nextParams = {
                        ...(current.params || {})
                      } as any
                      if (normalized === undefined) {
                        delete nextParams.sets
                        delete nextParams['组数']
                      } else {
                        nextParams.sets = normalized
                        nextParams['组数'] = normalized
                      }
                      return {
                        ...current,
                        sets: normalized,
                        params: nextParams
                      }
                    })
                  }}
                  placeholder='3'
                />
              </View>
              <View className='param-item'>
                <Text className='param-label'>次数</Text>
                <Input
                  className='param-input'
                  type='number'
                  value={String(getActionSetReps(actionSet) ?? '')}
                  onInput={(e) => {
                    const parsedReps = parseInputNumber(e.detail.value, 'int')
                    updateSelectedDayActionSet(path, (current) => {
                      const normalized = parsedReps === null ? undefined : Math.max(1, Math.floor(parsedReps))
                      const nextParams = {
                        ...(current.params || {})
                      } as any
                      if (normalized === undefined) {
                        delete nextParams.reps
                        delete nextParams['次数']
                      } else {
                        nextParams.reps = normalized
                        nextParams['次数'] = normalized
                      }
                      return {
                        ...current,
                        reps: normalized,
                        params: nextParams
                      }
                    })
                  }}
                  placeholder='8'
                />
              </View>
              <View className='param-item'>
                <Text className='param-label'>休息(min)</Text>
                <Input
                  className='param-input'
                  type='digit'
                  value={params?.['休息时间'] === undefined || params?.['休息时间'] === null ? '' : String(params['休息时间'])}
                  onInput={(e) => {
                    const parsedRest = parseInputNumber(e.detail.value, 'float')
                    updateSelectedDayActionSet(path, (current) => {
                      const nextParams = {
                        ...(current.params || {})
                      } as any
                      if (parsedRest === null) {
                        delete nextParams['休息时间']
                      } else {
                        nextParams['休息时间'] = parsedRest
                      }
                      return {
                        ...current,
                        params: nextParams
                      }
                    })
                  }}
                  placeholder='2'
                />
              </View>
            </View>

            <View className='strength-control-card'>
              <View className='strength-control-card__header'>
                <Text className='strength-control-card__title'>强度</Text>
                <Text className='strength-control-card__hint'>RM / % / 固定</Text>
              </View>
              <View className='strength-control-card__body'>
                <View className='strength-control-card__segments'>
                  {[
                    { label: 'RM', value: 'rm' as const },
                    { label: '%', value: 'percentage' as const },
                    { label: '固定', value: 'fixed' as const }
                  ].map((option) => (
                    <View
                      key={`${pathKey}-${option.value}`}
                      className={`strength-control-card__segment ${strengthControl.mode === option.value ? 'active' : ''}`}
                      onClick={() => setStrengthControlState(path, {
                        mode: option.value,
                        value: strengthControl.mode === option.value ? strengthControl.value : ''
                      })}
                    >
                      <Text>{option.label}</Text>
                    </View>
                  ))}
                </View>
                <View className='strength-control-card__input-wrap'>
                  <Input
                    className='strength-control-card__input'
                    type='digit'
                    value={strengthControl.value}
                    placeholder={strengthControl.mode === 'fixed' ? '输入重量' : '输入数值'}
                    onInput={(e) => setStrengthControlState(path, {
                      mode: strengthControl.mode,
                      value: e.detail.value
                    })}
                  />
                  <Text className='strength-control-card__unit'>
                    {strengthControl.mode === 'rm' ? 'RM' : strengthControl.mode === 'percentage' ? '%' : 'kg'}
                  </Text>
                </View>
              </View>
            </View>

            <View className='action-set-params action-set-params--advanced action-set-params--inline-note'>
              <View className='param-item param-item-full'>
                <Text className='param-label'>备注</Text>
                <Input
                  className='param-input'
                  type='text'
                  value={String(params.note || '')}
                  placeholder='如 rpe9、热身组等'
                  onInput={(e) => updateSelectedDayActionParams(path, {
                    note: e.detail.value
                  })}
                />
              </View>
            </View>
          </>
        ) : null}

        {!isStrength ? (
          <View className='action-set-params action-set-params--lite'>
            {itemType === 'CARDIO' ? (
              <>
                <View className='param-item'>
                  <Text className='param-label'>时长(min)</Text>
                  <Input
                    className='param-input'
                    type='digit'
                    value={customData.duration ? String(Math.round(Number(customData.duration) / 60)) : ''}
                    placeholder='30'
                    onInput={(e) => {
                      const value = parseInputNumber(e.detail.value, 'float')
                      updateSelectedDayActionCustomData(path, {
                        duration: value === null ? undefined : value * 60
                      })
                    }}
                  />
                </View>
                <View className='param-item'>
                  <Text className='param-label'>距离(km)</Text>
                  <Input
                    className='param-input'
                    type='digit'
                    value={customData.distance ? String(Number(customData.distance) / 1000) : ''}
                    placeholder='5'
                    onInput={(e) => {
                      const value = parseInputNumber(e.detail.value, 'float')
                      updateSelectedDayActionCustomData(path, {
                        distance: value === null ? undefined : value * 1000
                      })
                    }}
                  />
                </View>
                <View className='param-item'>
                  <Text className='param-label'>配速(min/km)</Text>
                  <Input
                    className='param-input'
                    type='digit'
                    value={customData.pace === undefined || customData.pace === null ? '' : String(customData.pace)}
                    placeholder='6'
                    onInput={(e) => {
                      const value = parseInputNumber(e.detail.value, 'float')
                      updateSelectedDayActionCustomData(path, {
                        pace: value === null ? undefined : value
                      })
                    }}
                  />
                </View>
              </>
            ) : null}
            {itemType === 'DIET' ? (
              <>
                <View className='param-item param-item-full'>
                  <Text className='param-label'>份量/内容</Text>
                  <Input
                    className='param-input'
                    type='text'
                    value={String(customData.content || '')}
                    placeholder='例如：100g / 2片 / 1杯'
                    onInput={(e) => {
                      updateSelectedDayActionCustomData(path, {
                        content: e.detail.value
                      })
                    }}
                  />
                </View>
                <View className='param-item'>
                  <Text className='param-label'>热量(kcal)</Text>
                  <Input
                    className='param-input'
                    type='digit'
                    value={customData.calories === undefined || customData.calories === null ? '' : String(customData.calories)}
                    placeholder='400'
                    onInput={(e) => {
                      const value = parseInputNumber(e.detail.value, 'float')
                      updateSelectedDayActionCustomData(path, {
                        calories: value === null ? undefined : value
                      })
                    }}
                  />
                </View>
              </>
            ) : null}
            {itemType === 'HABIT' ? (
              <>
                {!getActionSetActionId(actionSet) ? (
                  <View className='param-item param-item-full'>
                    <Text className='param-label'>习惯名称</Text>
                    <Input
                      className='param-input'
                      type='text'
                      value={String(customData.habit_name || '')}
                      placeholder='例如：冥想、阅读、早起'
                      onInput={(e) => {
                        updateSelectedDayActionCustomData(path, {
                          habit_name: e.detail.value
                        })
                      }}
                    />
                  </View>
                ) : null}
                <View className='param-item'>
                  <Text className='param-label'>目标值</Text>
                  <Input
                    className='param-input'
                    type='text'
                    value={customData.target_duration === undefined || customData.target_duration === null ? '' : String(customData.target_duration)}
                    placeholder='30分钟 / 8000步'
                    onInput={(e) => {
                      updateSelectedDayActionCustomData(path, {
                        target_duration: e.detail.value
                      })
                    }}
                  />
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        {advancedOpen ? (
          <View className='action-set-advanced'>
            {mainAttrLabels.length > 0 ? (
              <View className='action-set-params action-set-params--advanced'>
                {mainAttrLabels.map((attr) => renderLooseParamInput(attr))}
              </View>
            ) : null}

            {(itemType === 'CARDIO' || itemType === 'DIET' || itemType === 'HABIT' || isStrength) ? (
              <View className='action-set-params action-set-params--advanced'>
                {(itemType === 'DIET') ? (
                  <View className='param-item'>
                    <Text className='param-label'>建议时间</Text>
                    <Input
                      className='param-input'
                      type='text'
                      value={String(params.suggested_time || '')}
                      placeholder='08:00'
                      onInput={(e) => updateSelectedDayActionParams(path, {
                        suggested_time: e.detail.value
                      })}
                    />
                  </View>
                ) : null}
                {!isStrength ? (
                  <View className='param-item param-item-full'>
                    <Text className='param-label'>备注</Text>
                    <Input
                      className='param-input'
                      type='text'
                      value={String(params.note || '')}
                      placeholder='补充执行说明'
                      onInput={(e) => updateSelectedDayActionParams(path, {
                        note: e.detail.value
                      })}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            {extraParamKeys.length > 0 ? (
              <View className='action-set-params action-set-params--advanced'>
                {extraParamKeys.map((key) => renderLooseParamInput(key))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    )
  }

  const handleSelectAction = (action: CoachAction) => {
    if (!action?.id) return
    const day = getTrainingDayByDayIndex(selectedDayIndex)
    if (!day) return

    updateTrainingDayByDayIndex(day.dayIndex, (currentDay) => {
      const nextActionSets = Array.isArray(currentDay.actionSets) ? [...currentDay.actionSets] : []
      nextActionSets.push({
        action_id: action.id,
        actionId: action.id,
        action_name: action.name,
        actionName: action.name,
        setName: action.name,
        itemType: String(action.type || 'STRENGTH').trim().toUpperCase() || 'STRENGTH',
        sets: 3,
        reps: 8,
        weight: 0,
        params: {
          sets: 3,
          reps: 8,
          load: 0
        }
      })
      return {
        ...currentDay,
        type: 'training',
        actionSets: nextActionSets
      }
    })
    setShowActionPicker(false)
    setActionKeyword('')
  }

  const handleOpenActionPicker = () => {
    if (isReadonlyPlanView) {
      Taro.showToast({ title: '历史计划仅支持查看', icon: 'none' })
      return
    }
    const day = getTrainingDayByDayIndex(selectedDayIndex)
    if (!day) return
    if (!actions.length) {
      Taro.showToast({ title: '动作库为空，请先创建动作', icon: 'none' })
      return
    }
    if (day.type === 'rest') {
      Taro.showToast({ title: '请先切换为训练日', icon: 'none' })
      return
    }
    setShowActionPicker(true)
  }

  // 渲染加载状态
  if (loading) {
    return (
      <View className={`coach-student-plan-page theme-${effectiveTheme}`}>
        <View className='loading-container'>
          <LoadingSpinner size={48} />
        </View>
      </View>
    )
  }

  // 渲染空状态（没有计划）
  if (!instance) {
    return (
      <View className={`coach-student-plan-page theme-${effectiveTheme}`}>
        <ScrollView scrollY className='page'>
          {/* 学员信息卡片 */}
          {studentData && (
            <View className='student-info-card'>
              <View className='student-header'>
                <Image className='student-avatar' src={studentData.profile.avatar_url || 'https://via.placeholder.com/80'} />
                <View className='student-info'>
                  <Text className='student-name'>{studentData.profile.nickname || studentData.profile.full_name || '学员'}</Text>
                  <Text className='student-meta'>
                    {studentData.profile.gender} · {studentData.profile.age}岁 · {FITNESS_LEVEL_LABEL_MAP[studentData.profile.fitness_level] || studentData.profile.fitness_level}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* 无计划提示 */}
          <View className='no-plan-card'>
            <Text className='no-plan-title'>暂无训练计划</Text>
            <Text className='no-plan-desc'>为学员创建训练计划以开始训练</Text>
            <View className='create-plan-btn' onClick={() => { loadTemplates(); setShowTemplateDialog(true) }}>
              <Text className='btn-text'>从模板创建计划</Text>
            </View>
            <View className='create-plan-btn contact-btn' onClick={() => void handleContactStudent()}>
              <Text className='btn-text'>联系学员</Text>
            </View>
          </View>

          {/* 模板选择弹窗 */}
          {showTemplateDialog && (
            <View className='dialog-mask'>
              <View className='template-dialog'>
                <View className='dialog-header'>
                  <Text className='dialog-title'>选择计划模板</Text>
                  <Text className='dialog-close' onClick={() => setShowTemplateDialog(false)}>×</Text>
                </View>
                <View className='template-dialog-tools'>
                  <Input
                    className='action-picker-search-input'
                    value={templateSearch}
                    onInput={(e) => setTemplateSearch(e.detail.value)}
                    placeholder='搜索模板名称'
                  />
                  <View className='template-dialog-search-btn' onClick={() => void loadTemplates(templateSearch)}>
                    <Text>搜索</Text>
                  </View>
                </View>
                <View className='template-dialog-mode-row'>
                  <View
                    className={`template-dialog-chip ${templateImportMode === 'overwrite' ? 'active' : ''}`}
                    onClick={() => setTemplateImportMode('overwrite')}
                  >
                    <Text>覆盖当前计划</Text>
                  </View>
                  <View
                    className={`template-dialog-chip ${templateImportMode === 'new_instance' ? 'active' : ''}`}
                    onClick={() => setTemplateImportMode('new_instance')}
                  >
                    <Text>新建阶段</Text>
                  </View>
                </View>
                <View className='template-dialog-config-row'>
                  <View className='template-dialog-config-item'>
                    <Text className='template-dialog-config-label'>开始周</Text>
                    <Input
                      className='template-dialog-config-input'
                      type='number'
                      value={String(templateStartWeek)}
                      onInput={(e) => setTemplateStartWeek(Math.max(1, Number(e.detail.value || 1)))}
                    />
                  </View>
                  <View className='template-dialog-config-item'>
                    <Text className='template-dialog-config-label'>开始天</Text>
                    <Input
                      className='template-dialog-config-input'
                      type='number'
                      value={String(templateStartDay)}
                      onInput={(e) => setTemplateStartDay(Math.max(1, Math.min(7, Number(e.detail.value || 1))))}
                    />
                  </View>
                </View>
                <ScrollView scrollY className='template-list'>
                  {templates.map(template => (
                    <View key={template.id} className='template-item' onClick={() => handleCreateFromTemplate(template.id, {
                      weekIndex: templateStartWeek,
                      dayIndex: templateStartDay
                    })}>
                      <Text className='template-name'>{template.name}</Text>
                      <Text className='template-desc'>{template.description || template.suitable_for}</Text>
                    </View>
                  ))}
                  {templates.length === 0 && (
                    <Text className='no-template'>暂无模板</Text>
                  )}
                </ScrollView>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    )
  }

  const weekCount = weekGroups.length || 1
  const selectedTrainingDay = getTrainingDayByDayIndex(selectedDayIndex) || trainingDays[0] || null
  const selectedExecution = selectedTrainingDay ? getExecutionForDay(selectedTrainingDay.dayIndex) : null
  const selectedWeekIndex = selectedTrainingDay?.dayIndex
    ? Math.floor((selectedTrainingDay.dayIndex - 1) / 7)
    : 0
  const selectedDayOfWeekIndex = selectedTrainingDay?.dayIndex
    ? (selectedTrainingDay.dayIndex - 1) % 7
    : 0
  const oneRMItems = eligibleActions.map((coachAction) => {
    const studentAction = studentActions.find((studentItem) =>
      (coachAction.canonical_action_id && studentItem.canonical_action_id && studentItem.canonical_action_id === coachAction.canonical_action_id) ||
      normalizeName(studentItem.name) === normalizeName(coachAction.name)
    )
    return {
      id: coachAction.id,
      name: coachAction.name,
      value: oneRMValues[coachAction.id] ?? studentAction?.reference_1rm ?? null,
      editable: Boolean(studentAction?.id),
      badgeText: studentAction?.id ? undefined : '未同步'
    }
  })
  const weekCalendarWeeks = weekGroups.map((week) => week.map((day) => {
    const execution = getExecutionForDay(day.dayIndex)
    const isCompleted = execution?.status === 'completed'
    return {
      dayIndex: day.dayIndex,
      label: `周${['一', '二', '三', '四', '五', '六', '日'][(Math.max(day.dayIndex, 1) - 1) % 7] || '-'}`,
      title: `第${day.dayIndex}天`,
      meta: day.type === 'rest' ? '休息' : isCompleted ? '已完成' : `${day.actionSets?.length || 0}项`,
      rest: day.type === 'rest',
      completed: isCompleted
    }
  }))
  const focusWeek = (weekIndex: number) => {
    const safeWeekIndex = Math.max(0, Math.min(weekIndex, weekCount - 1))
    const targetWeekDays = weekGroups[safeWeekIndex] || []
    const targetDay = targetWeekDays[
      Math.min(selectedDayOfWeekIndex, Math.max(targetWeekDays.length - 1, 0))
    ] || targetWeekDays[0]
    if (targetDay) {
      setSelectedDayIndex(targetDay.dayIndex)
    }
  }
  const goToWeek = (delta: number) => {
    focusWeek(selectedWeekIndex + delta)
  }
  const executionSummary = useMemo(
    () => buildExecutionSummary(trainingDays as any, executions as any),
    [trainingDays, executions]
  )
  const aiGenerationLog = instance?.ai_generation_log || (instance as any)?.aiGenerationLog || null
  const formatAiGenerationSource = useCallback((source?: string | null) => {
    if (source === 'instance') return '历史计划骨架'
    if (source === 'template') return '模板骨架'
    return '从零生成'
  }, [])
  const formatAiGenerationConfidence = useCallback((value?: number | null) => {
    const num = Number(value)
    if (!Number.isFinite(num)) return ''
    return `${Math.round(num * 100)}%`
  }, [])
  const formatAiGenerationTime = useCallback((value?: string | null) => {
    if (!value) return ''
    const dt = new Date(value)
    if (Number.isNaN(dt.getTime())) return ''
    const yyyy = dt.getFullYear()
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const dd = String(dt.getDate()).padStart(2, '0')
    const hh = String(dt.getHours()).padStart(2, '0')
    const min = String(dt.getMinutes()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`
  }, [])
  const aiFeedbackDraft = useMemo(() => {
    if (!feedbacks.length) return ''
    const latestFeedbacks = feedbacks.slice(0, 3)
    const lines = latestFeedbacks.map((feedback) => {
      const difficultyText = feedback.difficulty_rating
        ? `难度 ${FEEDBACK_DIFFICULTY_MAP[feedback.difficulty_rating] || `${feedback.difficulty_rating}/5`}`
        : '未填写难度'
      const content = (feedback.content || '').trim() || '无文字反馈'
      return `第${feedback.day_index}天：${difficultyText}；反馈：${content}`
    })
    const studentName = studentData?.profile?.nickname || studentData?.profile?.full_name || '学员'
    return [
      `${studentName}最近训练反馈汇总：`,
      ...lines,
      '',
      '建议你先反馈：',
      '1. 先确认最近最吃力的动作和疲劳部位',
      '2. 如果连续两次反馈偏难，考虑下调该动作负荷或组数',
      '3. 如果主要问题是恢复差，优先调整休息、睡眠和训练密度'
    ].join('\n')
  }, [feedbacks, studentData])

  const handleOpenAiModifier = (instruction?: string) => {
    if (isReadonlyPlanView) {
      Taro.showToast({ title: '历史计划仅支持查看', icon: 'none' })
      return
    }
    const preset = (instruction || aiFeedbackDraft || '').trim()
    setAiModifierInstruction(preset)
    setAiModifierError('')
    setAiModifierPreviewDays(null)
    setAiModifierPreviewSummary('')
    setShowAiModifierDialog(true)
  }

  const handleRunAiModifier = async () => {
    const instruction = aiModifierInstruction.trim()
    if (!instruction) {
      setAiModifierError('请输入要让 AI 修改计划的要求')
      return
    }
    if (!trainingDays.length) {
      setAiModifierError('当前计划为空，无法进行 AI 修改')
      return
    }

    setAiModifierLoading(true)
    setAiModifierError('')
    setAiModifierPreviewDays(null)
    setAiModifierPreviewSummary('')
    try {
      const result = await planLibService.previewBatchOperationLocal({
        trainingDays,
        instruction,
        subscriptionId,
        subjectUserId: studentData?.student_id
      })
      if (!result?.updatedTrainingDays?.length) {
        throw new Error('AI 暂未返回可应用的计划修改')
      }
      const normalizedDays = (result.updatedTrainingDays as TrainingDay[]).map((day) => ({
        ...day,
        actionSets: Array.isArray(day.actionSets) ? day.actionSets : []
      }))
      const modifications = result.modifications || []
      setAiModifierPreviewDays(normalizedDays)
      setAiModifierPreviewSummary(
        result.message || (modifications.length ? `AI 已生成 ${modifications.length} 处修改预览` : 'AI 已生成计划修改预览')
      )
    } catch (error: any) {
      console.error('[coach/students/plan] ai modifier failed:', error)
      setAiModifierError(error?.message || 'AI 修改失败，请稍后重试')
    } finally {
      setAiModifierLoading(false)
    }
  }

  const handleApplyAiModifierPreview = () => {
    if (isReadonlyPlanView) return
    if (!aiModifierPreviewDays?.length) return
    const normalizedDays = aiModifierPreviewDays.map((day) => ({
      ...day,
      actionSets: Array.isArray(day.actionSets) ? day.actionSets : []
    }))
    setTrainingDays(normalizedDays)
    setSelectedDayIndex(normalizedDays.find((day) => day.type === 'training')?.dayIndex || normalizedDays[0]?.dayIndex || 1)
    setShowAiModifierDialog(false)
    setAiModifierPreviewDays(null)
    setAiModifierPreviewSummary('')
    Taro.showToast({ title: 'AI 修改已应用，请保存计划', icon: 'none' })
  }

  return (
    <ScrollView scrollY className={`coach-student-plan-page theme-${effectiveTheme}`}>
      <View className='page'>
        {/* 学员信息卡片 */}
        {studentData && (
          <View className={`info-card ${showProfilePanel ? 'expanded' : ''}`}>
            <View className='card-header' onClick={() => setShowProfilePanel(!showProfilePanel)}>
              <View className='card-title-wrapper'>
                <View className='card-icon'><User size={18} color="#CF6D4E" /></View>
                <Text className='card-title'>学员信息</Text>
              </View>
              <Text className={`arrow ${showProfilePanel ? 'up' : ''}`}>▼</Text>
            </View>
            {showProfilePanel && (
              <View className='card-content'>
                <View className='student-row'>
                  <Image className='student-avatar' src={studentData.profile.avatar_url || 'https://via.placeholder.com/60'} />
                  <View className='student-info'>
                    <Text className='student-name'>{studentData.profile.nickname || studentData.profile.full_name || '学员'}</Text>
                    <Text className='student-meta'>
                      {studentData.profile.gender} · {studentData.profile.age}岁 · {FITNESS_LEVEL_LABEL_MAP[studentData.profile.fitness_level] || studentData.profile.fitness_level}
                    </Text>
                  </View>
                </View>
                <View className='student-stats'>
                  <View className='stat-item'>
                    <Text className='stat-value'>{studentData.profile.height || '-'}</Text>
                    <Text className='stat-label'>身高(cm)</Text>
                  </View>
                  <View className='stat-item'>
                    <Text className='stat-value'>{studentData.profile.weight || '-'}</Text>
                    <Text className='stat-label'>体重(kg)</Text>
                  </View>
                  <View className='stat-item'>
                    <Text className='stat-value'>{studentData.profile.fitness_goal || '-'}</Text>
                    <Text className='stat-label'>训练目标</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* 计划执行进度 */}
        <View className='execution-card'>
          <View className='execution-header'>
            <Text className='execution-title'>{instance.name || '训练计划'}</Text>
            <View className={`status-tag status-${instance.status}`}>
              <Text className='status-text'>
                {instance.status === 'active' ? '进行中' : instance.status === 'paused' ? '已暂停' : '已完成'}
              </Text>
            </View>
          </View>
          <View className='progress-section'>
            <View className='progress-header'>
              <Text className='progress-text'>完成进度</Text>
              <Text className='progress-value'>{instance.progress || 0}%</Text>
            </View>
            <View className='progress-bar'>
              <View className='progress-fill' style={{ width: `${instance.progress || 0}%` }} />
            </View>
            <Text className='progress-detail'>
              第 {instance.current_day || 0} 天 / 共 {instance.total_days || trainingDays.length} 天
            </Text>
          </View>
          {isReadonlyPlanView && (
            <View className='readonly-plan-banner'>
              <Text className='readonly-plan-text'>历史计划只读查看，不会自动保存或修改学员当前计划。</Text>
            </View>
          )}
          <View className='execution-actions'>
            {!isReadonlyPlanView && (
              <>
                <View className='action-btn secondary' onClick={() => { void loadTemplates(); setShowTemplateDialog(true) }}>
                  <Text className='btn-text'>从模板更新</Text>
                </View>
                <View className='action-btn secondary' onClick={() => handleOpenAiModifier()}>
                  <Text className='btn-text'>AI 修改器</Text>
                </View>
              </>
            )}
            <View className='action-btn primary' onClick={() => void handleContactStudent()}>
              <Text className='btn-text'>联系学员</Text>
            </View>
            {!isReadonlyPlanView && (
              <View className='action-btn secondary' onClick={handleTogglePlanStatus}>
                <Text className='btn-text'>{instance.status === 'active' ? '暂停计划' : '恢复计划'}</Text>
              </View>
            )}
          </View>
        </View>

        <View className='execution-summary-card'>
          <View className='summary-item'>
            <Text className='summary-value'>{executionSummary.trainingDays}</Text>
            <Text className='summary-label'>训练日</Text>
          </View>
          <View className='summary-item'>
            <Text className='summary-value'>{executionSummary.completedDays}</Text>
            <Text className='summary-label'>已完成</Text>
          </View>
          <View className='summary-item'>
            <Text className='summary-value'>{executionSummary.completionRate}%</Text>
            <Text className='summary-label'>完成率</Text>
          </View>
        </View>

        {/* 学员反馈面板入口 */}
        <View className='feedback-entry-card' onClick={() => setShowFeedbackPanel(!showFeedbackPanel)}>
          <View className='entry-row'>
            <View className='entry-icon'><Message size={18} color="#CF6D4E" /></View>
            <Text className='entry-title'>学员反馈</Text>
            {feedbackUnreadCount > 0 && (
              <View className='unread-badge'><Text className='unread-count'>{feedbackUnreadCount}</Text></View>
            )}
          </View>
          <Text className='arrow'>▼</Text>
        </View>

        {/* 反馈列表 */}
        {showFeedbackPanel && (
          <View className='feedback-list-card'>
            {aiFeedbackDraft ? (
              <View className='feedback-ai-card'>
                <Text className='feedback-ai-title'>一键生成沟通建议</Text>
                <Text className='feedback-ai-text'>{aiFeedbackDraft}</Text>
                <View className='feedback-actions'>
                  <View className='feedback-action-btn secondary' onClick={() => handleOpenAiModifier(aiFeedbackDraft)}>
                    <Text className='action-btn-text'>用反馈改计划</Text>
                  </View>
                  <View className='feedback-action-btn primary' onClick={() => void handleContactStudent({ draft: aiFeedbackDraft })}>
                    <Text className='action-btn-text'>带建议去沟通</Text>
                  </View>
                </View>
              </View>
            ) : null}
            {feedbacks.length === 0 ? (
              <Text className='feedback-empty'>暂无学员反馈</Text>
            ) : (
              feedbacks.map(feedback => (
                <View key={feedback.id} className={`feedback-item ${!feedback.is_read ? 'unread' : ''}`}>
                  <View className='feedback-header'>
                    <Text className='feedback-day'>第{feedback.day_index}天</Text>
                    <Text className='feedback-time'>{formatFeedbackTime(feedback.created_at)}</Text>
                  </View>
                  <Text className='feedback-content'>{feedback.content || '（无文字反馈）'}</Text>
                  {feedback.difficulty_rating && (
                    <View className='feedback-rating'>
                      <Text className='rating-label'>难度:</Text>
                      <Text className='rating-value'>{feedback.difficulty_rating}/5</Text>
                    </View>
                  )}
                  {feedback.coach_reply && (
                    <View className='coach-reply'>
                      <Text className='reply-label'>教练回复:</Text>
                      <Text className='reply-content'>{feedback.coach_reply}</Text>
                    </View>
                  )}
                  <View className='feedback-actions'>
                    <View className='feedback-action-btn secondary' onClick={() => handleFocusFeedbackDay(feedback.day_index)}>
                      <Text className='action-btn-text'>定位训练日</Text>
                    </View>
                    <View className='feedback-action-btn primary' onClick={() => void handleReplyFeedback(feedback)}>
                      <Text className='action-btn-text'>继续沟通</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {aiGenerationLog ? (
          <View className='ai-generation-log-card'>
            <View className='ai-generation-log-header'>
              <Text className='ai-generation-log-title'>AI 个性化生成记录</Text>
              <Text className='ai-generation-log-badge'>AI</Text>
            </View>
            <View className='ai-generation-log-tags'>
              <Text className='ai-generation-log-tag'>来源：{formatAiGenerationSource(aiGenerationLog?.stageA?.source)}</Text>
              {aiGenerationLog?.stageA?.confidence !== undefined && aiGenerationLog?.stageA?.confidence !== null ? (
                <Text className='ai-generation-log-tag'>置信度：{formatAiGenerationConfidence(aiGenerationLog.stageA.confidence)}</Text>
              ) : null}
              {aiGenerationLog?.promptVersion ? (
                <Text className='ai-generation-log-tag'>Prompt：{aiGenerationLog.promptVersion}</Text>
              ) : null}
            </View>
            {aiGenerationLog?.timestamp ? (
              <Text className='ai-generation-log-caption'>生成时间：{formatAiGenerationTime(aiGenerationLog.timestamp)}</Text>
            ) : null}
            {aiGenerationLog.stageA ? (
              <View className='ai-generation-log-section'>
                <Text className='ai-generation-log-label'>模板选择理由</Text>
                <Text className='ai-generation-log-text'>{aiGenerationLog.stageA.reasoning || '未记录'}</Text>
                {aiGenerationLog.stageA.templateId ? (
                  <Text className='ai-generation-log-meta'>选中骨架：{aiGenerationLog.stageA.templateId}</Text>
                ) : (
                  <Text className='ai-generation-log-meta'>本次未复用模板骨架，直接从零生成。</Text>
                )}
              </View>
            ) : null}
            {aiGenerationLog.stageB ? (
              <View className='ai-generation-log-section'>
                <Text className='ai-generation-log-label'>个性化调整说明</Text>
                <Text className='ai-generation-log-text'>{aiGenerationLog.stageB.reasoning || '未记录'}</Text>
                {aiGenerationLog.stageB.changesSummary ? (
                  <Text className='ai-generation-log-meta'>{aiGenerationLog.stageB.changesSummary}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* 基础信息编辑 */}
        <View className='edit-card'>
          <Text className='section-title'>计划信息</Text>
          <View className='form-group'>
            <Text className='form-label'>计划名称</Text>
            <Input
              className='form-input'
              value={editName}
              disabled={isReadonlyPlanView}
              onInput={(e) => setEditName(e.detail.value)}
              placeholder='输入计划名称'
            />
          </View>
          <View className='form-group'>
            <Text className='form-label'>计划描述</Text>
            <Input
              className='form-input'
              value={editDescription}
              disabled={isReadonlyPlanView}
              onInput={(e) => setEditDescription(e.detail.value)}
              placeholder='输入计划描述'
            />
          </View>
          <View className='form-group'>
            <Text className='form-label'>执行须知</Text>
            <Textarea
              className='form-textarea'
              value={editExecutionNotice}
              disabled={isReadonlyPlanView}
              onInput={(e) => setEditExecutionNotice(e.detail.value)}
              placeholder='同步网页端的执行前说明'
              maxlength={1200}
              autoHeight
            />
          </View>
          <View className='form-group'>
            <Text className='form-label'>适用等级</Text>
            <View className='suitable-for-options'>
              {['beginner', 'intermediate', 'advanced'].map(level => (
                <View
                  key={level}
                  className={`option-tag ${editSuitableFor === level ? 'active' : ''}`}
                  onClick={() => setEditSuitableFor(level)}
                >
                  <Text className='option-text'>
                    {level === 'beginner' ? '初学者' : level === 'intermediate' ? '中级' : '高级'}
                  </Text>
                </View>
              ))}
            </View>
        </View>
        <View className='auto-save-indicator'>
          <Text className={`save-status status-${autoSaveStatus}`}>
              {isReadonlyPlanView ? '只读查看' :
               autoSaveStatus === 'idle' ? '' :
               autoSaveStatus === 'pending' ? '待保存...' :
               autoSaveStatus === 'saving' ? '保存中...' :
               autoSaveStatus === 'saved' ? '已保存' : '保存失败'}
          </Text>
        </View>
        </View>

        {/* 1RM 配置面板 */}
        {!isReadonlyPlanView && eligibleActions.length > 0 && (
          <PlanReferenceOneRMPanel
            title='学员动作 1RM 设定'
            caption='这些值会参与自动算重。未同步到学员动作库的动作暂时不可编辑。'
            items={oneRMItems}
            expanded={showOneRMPanel}
            onToggle={() => setShowOneRMPanel((current) => !current)}
            onSave={handleSaveOneRM}
            saveLabel={saving ? '保存中...' : '保存 1RM'}
            emptyText='当前计划里还没有需要配置 1RM 的动作。'
            onChange={handleOneRMChange}
          />
        )}

        {/* 周历视图 */}
        <View className='calendar-section'>
          <Text className='section-title'>训练安排</Text>
          <View className='action-search-bar'>
            <Input
              className='action-search-input'
              value={dayActionKeyword}
              onInput={(e) => setDayActionKeyword(e.detail.value)}
              placeholder='搜索动作，快速定位训练日'
            />
            {dayActionKeyword ? (
              <Text className='action-search-clear' onClick={() => setDayActionKeyword('')}>清除</Text>
            ) : null}
          </View>
          {dayActionKeyword && (
            <View className='action-search-results'>
              {actionSearchResults.length > 0 ? (
                actionSearchResults.map((item) => (
                  <View
                    key={item.dayIndex}
                    className='search-result-chip'
                    onClick={() => setSelectedDayIndex(item.dayIndex)}
                  >
                    <Text className='search-result-text'>第 {item.dayIndex} 天</Text>
                  </View>
                ))
              ) : (
                <Text className='action-search-empty'>未找到包含该动作的训练日</Text>
              )}
            </View>
          )}
          <PlanCompactWeekCalendar
            weeks={weekCalendarWeeks}
            currentWeekIndex={selectedWeekIndex}
            selectedDayIndex={selectedTrainingDay?.dayIndex || selectedDayIndex}
            title={`第 ${selectedWeekIndex + 1} 周`}
            caption={`当前选中第 ${selectedTrainingDay?.dayIndex || getDisplayDayNumber(selectedDayIndex)} 天 · ${selectedTrainingDay?.type === 'rest' ? '休息日' : selectedExecution?.status === 'completed' ? '已完成' : '训练日'}`}
            expanded={showFullCalendar}
            onSelectDay={setSelectedDayIndex}
            onPrevWeek={() => goToWeek(-1)}
            onNextWeek={() => goToWeek(1)}
            onToggleExpanded={() => setShowFullCalendar((current) => !current)}
          />
        </View>

        {/* 训练日详情 */}
        <View className={`day-detail-card ${isReadonlyPlanView ? 'readonly' : ''}`}>
          <View className='day-detail-header'>
            <Text className='day-detail-title'>
              第{selectedTrainingDay?.dayIndex || getDisplayDayNumber(selectedDayIndex)}天 - {selectedTrainingDay?.type === 'rest' ? '休息日' : '训练日'}
            </Text>
            {!isReadonlyPlanView && (
              <View className='day-type-toggle' onClick={() => {
                if (!selectedTrainingDay) return
                updateTrainingDayByDayIndex(selectedTrainingDay.dayIndex, (currentDay) => {
                  const nextType = currentDay.type === 'rest' ? 'training' : 'rest'
                  return {
                    ...currentDay,
                    type: nextType,
                    actionSets: nextType === 'rest' ? [] : (currentDay.actionSets || [])
                  }
                })
              }}>
                <Text className='toggle-text'>
                  {selectedTrainingDay?.type === 'rest' ? '改为训练日' : '改为休息日'}
                </Text>
              </View>
            )}
          </View>

          {selectedTrainingDay?.type === 'training' && (
            <>
              <View className='form-group'>
                <Text className='form-label'>备注</Text>
                <Input
                  className='form-input'
                  value={selectedTrainingDay?.note || ''}
                  disabled={isReadonlyPlanView}
                  onInput={(e) => {
                    if (!selectedTrainingDay) return
                    updateTrainingDayByDayIndex(selectedTrainingDay.dayIndex, (currentDay) => ({
                      ...currentDay,
                      note: e.detail.value
                    }))
                  }}
                  placeholder='训练备注'
                />
              </View>

              <View className='action-sets-section'>
                <View className='action-sets-header'>
                  <Text className='action-sets-title'>动作组</Text>
                  {!isReadonlyPlanView && (
                    <View className='add-action-btn' onClick={handleOpenActionPicker}>
                      <Text className='add-btn-text'>+ 添加动作</Text>
                    </View>
                  )}
                </View>
                {(selectedTrainingDay?.actionSets || []).map((actionSet, idx) => {
                  if (isOneFilterActionSet(actionSet)) {
                    return (
                      <View key={`group-${idx}`} className='one-filter-group'>
                        <View className='one-filter-header'>
                          <Text className='one-filter-title'>
                            {getOneFilterDisplayName(actionSet) || `条件动作组 ${idx + 1}`}
                          </Text>
                          <Text className='one-filter-subtitle'>
                            条件选项：{(actionSet.actions || []).length}
                          </Text>
                        </View>
                        {(actionSet.actions || []).map((innerSet, innerIdx) => (
                          renderActionSetEditor(innerSet, [idx, innerIdx], {
                            oneFilterLabel: getOneFilterOptionLabel(actionSet, innerIdx),
                            oneFilterTitle: getOneFilterDisplayName(actionSet) || undefined
                          })
                        ))}
                        {(actionSet.actions || []).length === 0 ? (
                          <Text className='one-filter-empty'>该条件组暂未配置动作</Text>
                        ) : null}
                      </View>
                    )
                  }
                  return renderActionSetEditor(actionSet, [idx])
                })}
                {(selectedTrainingDay?.actionSets?.length || 0) === 0 && (
                  <Text className='no-actions'>暂无动作，请点击上方添加</Text>
                )}
              </View>
            </>
          )}

          {/* 执行记录 */}
          {selectedExecution && (
            <View className='execution-record'>
              <Text className='record-title'>执行记录</Text>
              <Text className='record-status'>状态: {selectedExecution.status}</Text>
              {selectedExecution.completed_at && (
                <Text className='record-time'>完成时间: {selectedExecution.completed_at}</Text>
              )}
            </View>
          )}
        </View>

        {showActionPicker && (
          <View className='dialog-mask' onClick={() => setShowActionPicker(false)}>
            <View className='template-dialog' onClick={(e) => e.stopPropagation()}>
              <View className='dialog-header'>
                <Text className='dialog-title'>选择动作</Text>
                <Text className='dialog-close' onClick={() => setShowActionPicker(false)}>×</Text>
              </View>
              <View className='action-picker-search-wrap'>
                <Input
                  className='action-picker-search-input'
                  value={actionKeyword}
                  onInput={(e) => setActionKeyword(e.detail.value)}
                  placeholder='搜索动作名称'
                />
              </View>
              <ScrollView scrollY className='template-list'>
                {filteredActionOptions.slice(0, 80).map((action) => (
                  <View key={action.id} className='action-picker-item' onClick={() => handleSelectAction(action)}>
                    <Text className='action-picker-name'>{action.name}</Text>
                    <Text className='action-picker-arrow'>+</Text>
                  </View>
                ))}
                {filteredActionOptions.length === 0 && (
                  <Text className='no-template'>未找到匹配动作</Text>
                )}
                {filteredActionOptions.length > 80 && (
                  <Text className='action-picker-limit'>仅展示前 80 个动作，请缩小搜索范围</Text>
                )}
              </ScrollView>
            </View>
          </View>
        )}

        {showTemplateDialog && (
          <View className='dialog-mask'>
            <View className='template-dialog'>
              <View className='dialog-header'>
                <Text className='dialog-title'>选择计划模板</Text>
                <Text className='dialog-close' onClick={() => setShowTemplateDialog(false)}>×</Text>
              </View>
              <View className='template-dialog-tools'>
                <Input
                  className='action-picker-search-input'
                  value={templateSearch}
                  onInput={(e) => setTemplateSearch(e.detail.value)}
                  placeholder='搜索模板名称'
                />
                <View className='template-dialog-search-btn' onClick={() => void loadTemplates(templateSearch)}>
                  <Text>搜索</Text>
                </View>
              </View>
              <View className='template-dialog-mode-row'>
                <View
                  className={`template-dialog-chip ${templateImportMode === 'overwrite' ? 'active' : ''}`}
                  onClick={() => setTemplateImportMode('overwrite')}
                >
                  <Text>覆盖当前计划</Text>
                </View>
                <View
                  className={`template-dialog-chip ${templateImportMode === 'new_instance' ? 'active' : ''}`}
                  onClick={() => setTemplateImportMode('new_instance')}
                >
                  <Text>新建阶段</Text>
                </View>
              </View>
              <View className='template-dialog-config-row'>
                <View className='template-dialog-config-item'>
                  <Text className='template-dialog-config-label'>开始周</Text>
                  <Input
                    className='template-dialog-config-input'
                    type='number'
                    value={String(templateStartWeek)}
                    onInput={(e) => setTemplateStartWeek(Math.max(1, Number(e.detail.value || 1)))}
                  />
                </View>
                <View className='template-dialog-config-item'>
                  <Text className='template-dialog-config-label'>开始天</Text>
                  <Input
                    className='template-dialog-config-input'
                    type='number'
                    value={String(templateStartDay)}
                    onInput={(e) => setTemplateStartDay(Math.max(1, Math.min(7, Number(e.detail.value || 1))))}
                  />
                </View>
              </View>
              <ScrollView scrollY className='template-list'>
                {templates.map(template => (
                  <View key={template.id} className='template-item' onClick={() => handleCreateFromTemplate(template.id, {
                    weekIndex: templateStartWeek,
                    dayIndex: templateStartDay
                  })}>
                    <Text className='template-name'>{template.name}</Text>
                    <Text className='template-desc'>{template.description || template.suitable_for}</Text>
                  </View>
                ))}
                {templates.length === 0 && (
                  <Text className='no-template'>暂无模板</Text>
                )}
              </ScrollView>
            </View>
          </View>
        )}

        {showAiModifierDialog && (
          <View className='dialog-mask'>
            <View className='template-dialog ai-modifier-dialog'>
              <View className='dialog-header'>
                <Text className='dialog-title'>AI 修改器</Text>
                <Text className='dialog-close' onClick={() => setShowAiModifierDialog(false)}>×</Text>
              </View>
              <View className='ai-modifier-body'>
                <Text className='ai-modifier-hint'>
                  复用 Web 的计划 AI 修改器。先生成预览，确认后只应用到当前编辑器，仍需点击保存计划。
                </Text>
                <Textarea
                  className='ai-modifier-textarea'
                  value={aiModifierInstruction}
                  placeholder='例如：根据最近反馈，把第 2 周引体强度下调到 8RM，并把总量减少一组。'
                  maxlength={2000}
                  autoHeight
                  onInput={(event) => {
                    setAiModifierInstruction(event.detail.value)
                    if (aiModifierError) setAiModifierError('')
                  }}
                />
                {aiModifierError ? (
                  <Text className='ai-modifier-error'>{aiModifierError}</Text>
                ) : null}
                {aiModifierPreviewSummary ? (
                  <View className='ai-modifier-preview'>
                    <Text className='ai-modifier-preview-title'>预览结果</Text>
                    <Text className='ai-modifier-preview-text'>{aiModifierPreviewSummary}</Text>
                    <Text className='ai-modifier-preview-meta'>
                      {aiModifierPreviewDays?.length || 0} 天计划已准备应用
                    </Text>
                  </View>
                ) : null}
              </View>
              <View className='ai-modifier-footer'>
                <View className='ai-modifier-btn secondary' onClick={() => setShowAiModifierDialog(false)}>
                  <Text>取消</Text>
                </View>
                <View
                  className={`ai-modifier-btn ${aiModifierPreviewDays?.length ? 'secondary' : 'primary'} ${aiModifierLoading ? 'disabled' : ''}`}
                  onClick={() => {
                    if (aiModifierLoading) return
                    void handleRunAiModifier()
                  }}
                >
                  <Text>{aiModifierLoading ? '生成中...' : aiModifierPreviewDays?.length ? '重新生成' : '生成预览'}</Text>
                </View>
                {aiModifierPreviewDays?.length ? (
                  <View className='ai-modifier-btn primary' onClick={handleApplyAiModifierPreview}>
                    <Text>应用到编辑器</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        )}

        <View className='bottom-tip'>
          <Text className='tip-text'>滑动到底部 · 已加载全部内容</Text>
        </View>
      </View>
    </ScrollView>
  )
}

export default CoachStudentPlan
