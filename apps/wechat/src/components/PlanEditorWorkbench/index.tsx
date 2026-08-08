import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Textarea, Picker } from '@tarojs/components'
import { StableInput as Input } from '@/components/StableInput'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import PlanCompactWeekCalendar from '@/components/PlanCompactWeekCalendar'
import PlanReferenceOneRMPanel from '@/components/PlanReferenceOneRMPanel'
import type { PlanActionOption, PlanActionSet, PlanEditorValue, PlanItemType, PlanTrainingDay } from '@/types/plan'
import type { PlanOneRMRecord } from '@/utils/planStrength'
import {
  SUITABLE_FOR_LABELS,
  addEmptyWeek,
  applyAppendAction,
  applyDeleteAction,
  applyReplaceAction,
  buildExecutionSummary,
  chunkDaysByWeek,
  cloneWeekToTail,
  collectOneRMActions,
  createActionSet,
  createDefaultPlanDays,
  deleteWeekAt,
  getTrainingWeekDays,
  normalizeItemType,
  normalizePlanDays,
  resolveActionDisplayName
} from '@/utils/planEditor'
import { formatPlanToScript, getPlanScriptErrorMessage, parsePlanScript } from '@/utils/planScript'
import {
  applyStrengthControlValue,
  buildOneRMIndex,
  buildStrengthPreview,
  getStrengthControlValue,
  isAutoLoadEligible,
  parseIntensityValue,
  resolveEditableDisplayName,
  resolveReferenceOneRM
} from '@/utils/planStrength'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { API_BASE_URL } from '@/utils/request'

type PlanEditorMode = 'coach-template' | 'student-favorite'
type BatchMode = 'replace' | 'delete' | 'append'

interface PlanImportResult {
  trainingDays: any[]
  globalDescription?: string | null
}

interface PlanEditorWorkbenchProps {
  mode: PlanEditorMode
  title: string
  subtitle?: string
  initialValue?: Partial<PlanEditorValue> | null
  actions: PlanActionOption[]
  studentProfile?: Record<string, any> | null
  oneRMRecords?: PlanOneRMRecord[] | null
  loading?: boolean
  saving?: boolean
  saveLabel?: string
  withBottomNav?: boolean
  onCancel?: () => void
  onSave: (value: PlanEditorValue) => Promise<void> | void
  onImportText?: (text: string, actions: PlanActionOption[]) => Promise<PlanImportResult | null>
}

const PLAN_DAY_POSITIONS = [1, 2, 3, 4, 5, 6, 7]

const toFiniteNumber = (value: unknown) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const getStrengthSetsValue = (actionSet?: PlanActionSet | null) => {
  const direct = toFiniteNumber((actionSet as any)?.sets)
  if (direct !== null && direct > 0) return Math.floor(direct)
  const paramSets = toFiniteNumber(actionSet?.params?.sets)
  if (paramSets !== null && paramSets > 0) return Math.floor(paramSets)
  const legacySets = toFiniteNumber(actionSet?.params?.['组数'])
  if (legacySets !== null && legacySets > 0) return Math.floor(legacySets)
  return null
}

const getStrengthRepsValue = (actionSet?: PlanActionSet | null) => {
  const direct = toFiniteNumber((actionSet as any)?.reps)
  if (direct !== null && direct > 0) return Math.floor(direct)
  const paramReps = toFiniteNumber(actionSet?.params?.reps)
  if (paramReps !== null && paramReps > 0) return Math.floor(paramReps)
  const legacyReps = toFiniteNumber(actionSet?.params?.['次数'])
  if (legacyReps !== null && legacyReps > 0) return Math.floor(legacyReps)
  return null
}

const getStrengthRestMinutesValue = (actionSet?: PlanActionSet | null) => {
  const restSeconds = toFiniteNumber(actionSet?.params?.rest_seconds)
  if (restSeconds !== null && restSeconds >= 0) {
    return Number((restSeconds / 60).toFixed(1))
  }
  const legacyRest = toFiniteNumber(actionSet?.params?.['休息时间'])
  if (legacyRest !== null && legacyRest >= 0) {
    return Number((legacyRest / 60).toFixed(1))
  }
  return null
}

const getStrengthLoadUnit = (params: Record<string, any>) => (
  String(params?.loadUnit || params?.intensityConfig?.recommendedLoad?.unit || 'kg') === 'lbs' ? 'lbs' : 'kg'
)

const getStrengthIntensitySource = (params: Record<string, any>) => {
  const relativeConfig = params?.intensityConfig?.relativeIntensity
  if (relativeConfig && typeof relativeConfig === 'object') {
    return relativeConfig
  }
  const legacyRm = toFiniteNumber(params?.['强度'])
  if (legacyRm !== null && legacyRm > 0) return legacyRm
  return params?.intensity
}

const createInitialValue = (mode: PlanEditorMode, initialValue?: Partial<PlanEditorValue> | null): PlanEditorValue => {
  const defaultDays = initialValue?.days && initialValue.days.length > 0
    ? normalizePlanDays(initialValue.days)
    : createDefaultPlanDays(1, mode === 'coach-template' ? 'coach' : 'student')

  return {
    name: initialValue?.name || '',
    description: initialValue?.description || '',
    executionNotice: initialValue?.executionNotice || '',
    tags: initialValue?.tags || [],
    suitableFor: initialValue?.suitableFor || 'beginner',
    type: initialValue?.type || '',
    weekDays: initialValue?.weekDays?.length ? initialValue.weekDays : getTrainingWeekDays(defaultDays),
    globalAnswers: initialValue?.globalAnswers || {},
    days: defaultDays,
    oneRMConfig: initialValue?.oneRMConfig || {}
  }
}

const parseTags = (value: string) =>
  value
    .split(/[,\n，]/)
    .map((item) => item.trim())
    .filter(Boolean)

export default function PlanEditorWorkbench({
  mode,
  title,
  subtitle,
  initialValue,
  actions: providedActions,
  studentProfile = null,
  oneRMRecords = [],
  loading = false,
  saving = false,
  saveLabel = '保存',
  withBottomNav = false,
  onCancel,
  onSave,
  onImportText
}: PlanEditorWorkbenchProps) {
  const [editor, setEditor] = useState<PlanEditorValue>(() => createInitialValue(mode, initialValue))
  const [selectedDayIndex, setSelectedDayIndex] = useState(1)
  const [tagInput, setTagInput] = useState((initialValue?.tags || []).join(', '))
  const [showBatchDialog, setShowBatchDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showScriptDialog, setShowScriptDialog] = useState(false)
  const [showCopyDialog, setShowCopyDialog] = useState(false)
  const [showOneRMPanel, setShowOneRMPanel] = useState(false)
  const [showFullCalendar, setShowFullCalendar] = useState(false)
  const [advancedActionKeys, setAdvancedActionKeys] = useState<Record<string, boolean>>({})
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [scriptText, setScriptText] = useState('')
  const [scriptError, setScriptError] = useState('')
  const [batchMode, setBatchMode] = useState<BatchMode>('replace')
  const [batchFromActionId, setBatchFromActionId] = useState('')
  const [batchToActionId, setBatchToActionId] = useState('')
  const [batchAppendActionId, setBatchAppendActionId] = useState('')
  const [batchWeekStart, setBatchWeekStart] = useState(1)
  const [batchWeekEnd, setBatchWeekEnd] = useState(1)
  const [batchWeekdays, setBatchWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7])
  const [pickedLibraryActions, setPickedLibraryActions] = useState<PlanActionOption[]>([])
  const actions = useMemo(() => {
    const actionMap = new Map<string, PlanActionOption>()
    ;[...providedActions, ...pickedLibraryActions].forEach((action) => {
      if (action?.id) actionMap.set(String(action.id), action)
    })
    return Array.from(actionMap.values())
  }, [pickedLibraryActions, providedActions])

  useEffect(() => {
    const nextValue = createInitialValue(mode, initialValue)
    setEditor(nextValue)
    setTagInput((nextValue.tags || []).join(', '))
    setSelectedDayIndex(nextValue.days.find((day) => day.type === 'training')?.dayIndex || nextValue.days[0]?.dayIndex || 1)
    setBatchWeekEnd(Math.max(1, Math.ceil(nextValue.days.length / 7)))
    setShowOneRMPanel(false)
    setShowFullCalendar(false)
    setShowScriptDialog(false)
    setScriptText('')
    setScriptError('')
    setAdvancedActionKeys({})
  }, [initialValue, mode])

  const weeks = useMemo(() => chunkDaysByWeek(editor.days), [editor.days])
  const oneRMRecordIndex = useMemo(() => buildOneRMIndex(oneRMRecords), [oneRMRecords])
  const currentWeekIndex = useMemo(() => {
    if (!selectedDayIndex || selectedDayIndex < 1) return 0
    return Math.floor((selectedDayIndex - 1) / 7)
  }, [selectedDayIndex])
  const bodyWeight = useMemo(() => {
    const weight = Number(studentProfile?.weight || 0)
    return Number.isFinite(weight) && weight > 0 ? weight : null
  }, [studentProfile])
  const selectedDay = useMemo(
    () => editor.days.find((day) => day.dayIndex === selectedDayIndex) || editor.days[0] || null,
    [editor.days, selectedDayIndex]
  )
  const relevantOneRMActions = useMemo(
    () => collectOneRMActions(editor.days, actions),
    [actions, editor.days]
  )
  const oneRMItems = useMemo(
    () => relevantOneRMActions.map((action) => {
      const savedValue = editor.oneRMConfig[action.id]
      const fallbackValue = resolveReferenceOneRM(action, {}, oneRMRecordIndex)
      return {
        id: action.id,
        name: action.name,
        value: savedValue || fallbackValue || null
      }
    }),
    [editor.oneRMConfig, oneRMRecordIndex, relevantOneRMActions]
  )
  const usedActions = useMemo(() => {
    const map = new Map<string, PlanActionOption>()
    editor.days.forEach((day) => {
      ;(day.actionSets || []).forEach((set) => {
        if (set.type === 'one-filter' && Array.isArray(set.actions)) {
          set.actions.forEach((innerSet) => {
            const actionId = String(innerSet.actionId || innerSet.action_id || '')
            const action = actions.find((item) => String(item.id) === actionId)
            if (action) map.set(action.id, action)
          })
          return
        }
        const actionId = String(set.actionId || set.action_id || '')
        const action = actions.find((item) => String(item.id) === actionId)
        if (action) map.set(action.id, action)
      })
    })
    return Array.from(map.values())
  }, [actions, editor.days])
  const executionSummary = useMemo(() => buildExecutionSummary(editor.days, {}), [editor.days])
  const weekCalendarWeeks = useMemo(
    () => weeks.map((week) => week.map((day) => ({
      dayIndex: day.dayIndex,
      label: `第${((Math.max(day.dayIndex, 1) - 1) % 7) + 1}日`,
      title: day.type === 'rest' ? '休息' : '训练',
      meta: day.type === 'rest' ? '休息' : `${day.actionSets?.length || 0}项`,
      rest: day.type === 'rest'
    }))),
    [weeks]
  )

  const toggleActionAdvanced = (dayIndex: number, setIndex: number) => {
    const key = `${dayIndex}-${setIndex}`
    setAdvancedActionKeys((current) => ({
      ...current,
      [key]: !current[key]
    }))
  }

  const goToWeek = (delta: number) => {
    if (weeks.length === 0) return
    const nextWeekIndex = Math.max(0, Math.min(currentWeekIndex + delta, weeks.length - 1))
    const targetWeek = weeks[nextWeekIndex] || []
    const selectedDayOfWeekIndex = selectedDayIndex ? (selectedDayIndex - 1) % 7 : 0
    const targetDay = targetWeek[Math.min(selectedDayOfWeekIndex, Math.max(targetWeek.length - 1, 0))] || targetWeek[0]
    if (targetDay?.dayIndex) setSelectedDayIndex(targetDay.dayIndex)
  }

  const updateEditor = (updater: (current: PlanEditorValue) => PlanEditorValue) => {
    setEditor((current) => updater(current))
  }

  const getPlanDayPositionLabel = (dayIndex: number) => `第${((Math.max(dayIndex, 1) - 1) % 7) + 1}日`

  const getItemMeta = (itemType: PlanItemType) => {
    switch (itemType) {
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
  }

  const getActionBySet = (actionSet: PlanActionSet) => {
    const actionId = String(actionSet.actionId || actionSet.action_id || '')
    return actions.find((action) => String(action.id) === actionId)
  }

  const getActionSummaryText = (actionSet: PlanActionSet) => {
    const itemType = normalizeItemType(actionSet.itemType)
    const params = actionSet.params || {}
    const customData = params.custom_data || {}

    if (itemType === 'STRENGTH') {
      const fallbackLoad = toFiniteNumber(params.load) ?? toFiniteNumber(params?.intensityConfig?.recommendedLoad?.value)
      const parsedIntensity = parseIntensityValue(getStrengthIntensitySource(params), fallbackLoad)
      const strengthUnit = getStrengthLoadUnit(params)
      const setsValue = getStrengthSetsValue(actionSet)
      const repsValue = getStrengthRepsValue(actionSet)
      const restMinutesValue = getStrengthRestMinutesValue(actionSet)
      const parts = [
        setsValue ? `${setsValue}组` : '',
        repsValue ? `${repsValue}次` : '',
        parsedIntensity.mode === 'rm' && parsedIntensity.value ? `${parsedIntensity.value}RM` : '',
        parsedIntensity.mode === 'percentage' && parsedIntensity.value ? `${parsedIntensity.value}%` : '',
        parsedIntensity.mode === 'fixed' && fallbackLoad ? `${fallbackLoad}${strengthUnit}` : '',
        restMinutesValue !== null ? `${restMinutesValue}min` : ''
      ].filter(Boolean)
      return parts.join(' · ') || '补充组数、次数和强度'
    }

    if (itemType === 'CARDIO') {
      const duration = Number(customData.duration || 0)
      const distance = Number(customData.distance || 0)
      const pace = Number(customData.pace || 0)
      return [
        duration > 0 ? `${Math.round(duration / 60)}分钟` : '',
        distance > 0 ? `${distance}km` : '',
        pace > 0 ? `${pace}配速` : ''
      ]
        .filter(Boolean)
        .join(' · ') || '填写有氧内容与时长'
    }

    if (itemType === 'DIET') {
      return [
        String(customData.content || '').trim(),
        customData.calories ? `${customData.calories}kcal` : '',
        params.note ? String(params.note).trim() : ''
      ]
        .filter(Boolean)
        .join(' · ') || '填写饮食建议'
    }

    return [
      String(customData.habit_name || '').trim(),
      customData.target_duration ? `${customData.target_duration}` : '',
      params.note ? String(params.note).trim() : ''
    ]
      .filter(Boolean)
      .join(' · ') || '填写习惯目标'
  }

  const getStrengthPreview = (actionSet: PlanActionSet) => {
    const action = getActionBySet(actionSet)
    const oneRM = resolveReferenceOneRM(action, editor.oneRMConfig, oneRMRecordIndex)
    return buildStrengthPreview(actionSet.params || {}, {
      action,
      oneRM,
      bodyWeight
    })
  }

  const updateActionParams = (
    dayIndex: number,
    setIndex: number,
    updates: Record<string, any>
  ) => {
    updateActionSet(dayIndex, setIndex, (currentSet) => ({
      ...currentSet,
      params: {
        ...(currentSet.params || {}),
        ...updates
      }
    }))
  }

  const updateActionCustomData = (
    dayIndex: number,
    setIndex: number,
    updates: Record<string, any>
  ) => {
    updateActionSet(dayIndex, setIndex, (currentSet) => ({
      ...currentSet,
      params: {
        ...(currentSet.params || {}),
        custom_data: {
          ...((currentSet.params || {}).custom_data || {}),
          ...updates
        }
      }
    }))
  }

  const updateDays = (
    updater: (days: PlanTrainingDay[]) => PlanTrainingDay[],
    normalize = true
  ) => {
    updateEditor((current) => ({
      ...current,
      days: normalize ? normalizePlanDays(updater(current.days)) : updater(current.days)
    }))
  }

  const updateDay = (dayIndex: number, updater: (day: PlanTrainingDay) => PlanTrainingDay) => {
    updateDays((days) =>
      days.map((day) => {
        if (day.dayIndex !== dayIndex) return day
        const nextDay = updater(day)
        return {
          ...nextDay,
          actionSetsCount: Array.isArray(nextDay.actionSets) ? nextDay.actionSets.length : 0
        }
      }),
      false
    )
  }

  const updateActionSet = (
    dayIndex: number,
    setIndex: number,
    updater: (actionSet: PlanActionSet) => PlanActionSet
  ) => {
    updateDay(dayIndex, (day) => ({
      ...day,
      actionSets: (day.actionSets || []).map((actionSet, index) => (
        index === setIndex ? updater(actionSet) : actionSet
      ))
    }))
  }

  const handleToggleWeekday = (day: number) => {
    updateEditor((current) => {
      const nextSet = new Set(current.weekDays || [])
      if (nextSet.has(day)) nextSet.delete(day)
      else nextSet.add(day)
      return {
        ...current,
        weekDays: Array.from(nextSet).sort((a, b) => a - b)
      }
    })
  }

  const handleAddActionSet = (itemType: PlanItemType) => {
    if (!selectedDay) return
    updateDay(selectedDay.dayIndex, (day) => ({
      ...day,
      type: 'training',
      actionSets: [...(day.actionSets || []), createActionSet(itemType)]
    }))
  }

  const handleRemoveActionSet = (setIndex: number) => {
    if (!selectedDay) return
    updateDay(selectedDay.dayIndex, (day) => ({
      ...day,
      actionSets: (day.actionSets || []).filter((_, index) => index !== setIndex)
    }))
  }

  const handleCopyFromDay = (sourceDayIndex: number) => {
    if (!selectedDay || sourceDayIndex === selectedDay.dayIndex) return
    const sourceDay = editor.days.find((day) => day.dayIndex === sourceDayIndex)
    if (!sourceDay) return
    updateDay(selectedDay.dayIndex, () => ({
      ...sourceDay,
      dayIndex: selectedDay.dayIndex
    }))
    setShowCopyDialog(false)
    Taro.showToast({ title: '已复制当日内容', icon: 'none' })
  }

  const handleAddWeek = () => {
    updateDays((days) => addEmptyWeek(days))
  }

  const handleCloneWeek = (weekIndex: number) => {
    updateDays((days) => cloneWeekToTail(days, weekIndex))
  }

  const handleDeleteWeek = (weekIndex: number) => {
    if (editor.days.length <= 7) {
      Taro.showToast({ title: '至少保留一周', icon: 'none' })
      return
    }
    updateDays((days) => deleteWeekAt(days, weekIndex))
    setSelectedDayIndex((current) => Math.max(1, Math.min(current, Math.max(1, editor.days.length - 7))))
  }

  const handleImportConfirm = async () => {
    if (!onImportText || !importText.trim()) {
      Taro.showToast({ title: '请输入待导入文本', icon: 'none' })
      return
    }
    try {
      setImporting(true)
      const result = await onImportText(importText, actions)
      if (!result?.trainingDays?.length) {
        Taro.showToast({ title: '未解析出训练安排', icon: 'none' })
        return
      }
      const normalizedDays = normalizePlanDays(result.trainingDays)
      updateEditor((current) => ({
        ...current,
        description: current.description || String(result.globalDescription || ''),
        days: normalizedDays,
        weekDays: getTrainingWeekDays(normalizedDays)
      }))
      setSelectedDayIndex(normalizedDays.find((day) => day.type === 'training')?.dayIndex || normalizedDays[0]?.dayIndex || 1)
      setImportText('')
      setShowImportDialog(false)
      Taro.showToast({ title: '已导入训练安排', icon: 'none' })
    } catch (error) {
      console.error('[PlanEditorWorkbench] import failed:', error)
      Taro.showToast({ title: '导入失败', icon: 'none' })
    } finally {
      setImporting(false)
    }
  }

  const uploadImportFile = async (filePath: string, fileName?: string) => {
    try {
      setImporting(true)
      const token = Taro.getStorageSync('token') || ''
      const response = await Taro.uploadFile({
        url: `${API_BASE_URL}/api/plan-lib/extract-file-text`,
        filePath,
        name: 'file',
        header: token ? { Authorization: `Bearer ${token}` } : {}
      })
      const body = typeof response.data === 'string' ? JSON.parse(response.data) : response.data as any
      if (response.statusCode !== 200 || !body?.success || !body?.data?.text) {
        throw new Error(body?.message || '文件提取失败')
      }
      setImportText(body.data.text)
      const methodHint = body.data.extractionMethod === 'vision' ? '已识别图片，请核对关键数字后再导入' : '已提取文件内容，请确认后导入'
      Taro.showToast({ title: methodHint, icon: 'none' })
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '文件上传失败', icon: 'none' })
    } finally {
      setImporting(false)
    }
  }

  const handleChooseImportImage = async () => {
    try {
      const result = await Taro.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'] } as any)
      const filePath = result.tempFiles?.[0]?.tempFilePath
      if (filePath) await uploadImportFile(filePath, 'plan-image.jpg')
    } catch (error: any) {
      if (!String(error?.errMsg || '').includes('cancel')) Taro.showToast({ title: '选择图片失败', icon: 'none' })
    }
  }

  const handleChooseImportFile = async () => {
    try {
      const result = await Taro.chooseMessageFile({ count: 1, type: 'file' } as any)
      const file = result.tempFiles?.[0] as any
      if (file?.path) await uploadImportFile(file.path, file.name)
    } catch (error: any) {
      if (!String(error?.errMsg || '').includes('cancel')) Taro.showToast({ title: '选择文件失败', icon: 'none' })
    }
  }

  const handleOpenScriptDialog = () => {
    try {
      setScriptText(formatPlanToScript({
        description: editor.description,
        days: editor.days,
        actions
      }))
      setScriptError('')
      setShowScriptDialog(true)
    } catch (error) {
      Taro.showToast({
        title: getPlanScriptErrorMessage(error),
        icon: 'none'
      })
    }
  }

  const handleApplyScript = () => {
    if (!scriptText.trim()) {
      setScriptError('请输入计划脚本')
      return
    }

    try {
      const result = parsePlanScript({ script: scriptText, actions })
      if (!result.days.length) {
        setScriptError('脚本里没有解析出训练日')
        return
      }

      const normalizedDays = normalizePlanDays(result.days)
      updateEditor((current) => ({
        ...current,
        description: result.description !== null ? result.description : current.description,
        days: normalizedDays,
        weekDays: getTrainingWeekDays(normalizedDays)
      }))
      setSelectedDayIndex(normalizedDays.find((day) => day.type === 'training')?.dayIndex || normalizedDays[0]?.dayIndex || 1)
      setScriptError('')
      setShowScriptDialog(false)
      Taro.showToast({ title: '已应用脚本', icon: 'none' })
    } catch (error) {
      setScriptError(getPlanScriptErrorMessage(error))
    }
  }

  const handleBatchConfirm = () => {
    let result = null as ReturnType<typeof applyReplaceAction> | ReturnType<typeof applyDeleteAction> | ReturnType<typeof applyAppendAction> | null
    if (batchMode === 'replace') {
      const targetAction = actions.find((action) => String(action.id) === batchToActionId)
      if (!batchFromActionId || !targetAction) {
        Taro.showToast({ title: '请选择替换动作', icon: 'none' })
        return
      }
      result = applyReplaceAction(editor.days, batchFromActionId, targetAction)
    } else if (batchMode === 'delete') {
      if (!batchFromActionId) {
        Taro.showToast({ title: '请选择要删除的动作', icon: 'none' })
        return
      }
      result = applyDeleteAction(editor.days, batchFromActionId)
    } else {
      const appendAction = actions.find((action) => String(action.id) === batchAppendActionId)
      if (!appendAction) {
        Taro.showToast({ title: '请选择要追加的动作', icon: 'none' })
        return
      }
      result = applyAppendAction(
        editor.days,
        appendAction,
        Math.max(1, batchWeekStart),
        Math.max(batchWeekStart, batchWeekEnd),
        batchWeekdays.length > 0 ? batchWeekdays : [1, 2, 3, 4, 5, 6, 7]
      )
    }

    if (!result || result.affectedSets <= 0) {
      Taro.showToast({ title: '没有匹配到可处理内容', icon: 'none' })
      return
    }

    updateEditor((current) => ({
      ...current,
      days: result!.days
    }))
    setShowBatchDialog(false)
    Taro.showToast({ title: `已处理 ${result.affectedSets} 项`, icon: 'none' })
  }

  const handleSave = async () => {
    if (!editor.name.trim()) {
      Taro.showToast({ title: mode === 'coach-template' ? '请输入模板名称' : '请输入计划名称', icon: 'none' })
      return
    }
    const payload: PlanEditorValue = {
      ...editor,
      name: editor.name.trim(),
      description: editor.description.trim(),
      executionNotice: editor.executionNotice.trim(),
      tags: parseTags(tagInput),
      weekDays: editor.weekDays?.length ? editor.weekDays : getTrainingWeekDays(editor.days),
      days: normalizePlanDays(editor.days)
    }
    await onSave(payload)
  }

  const handleOpenSystemActionLibrary = (dayIndex: number, setIndex: number, itemType: PlanItemType) => {
    void Taro.navigateTo({
      url: `/me/action-lib/index?tab=public&mode=plan-select&itemType=${encodeURIComponent(itemType)}`,
      success: ({ eventChannel }) => {
        eventChannel.on('selectPlanAction', (selectedAction: PlanActionOption) => {
          if (!selectedAction?.id || !selectedAction?.name) return
          setPickedLibraryActions((current) => {
            const next = current.filter((action) => String(action.id) !== String(selectedAction.id))
            return [...next, selectedAction]
          })
          updateActionSet(dayIndex, setIndex, (currentSet) => {
            const currentItemType = normalizeItemType(currentSet.itemType)
            const selectedItemType = normalizeItemType(selectedAction.type || currentItemType)
            const typeChanged = currentItemType !== selectedItemType
            const nextDefault = typeChanged ? createActionSet(selectedItemType) : null
            return {
              ...currentSet,
              itemType: selectedItemType,
              actionId: selectedAction.id,
              actionName: selectedAction.name,
              setName: typeChanged || !resolveEditableDisplayName(currentSet) ? '' : currentSet.setName,
              params: nextDefault ? nextDefault.params : currentSet.params
            }
          })
        })
      }
    })
  }

  const getActionOptionsByType = (itemType: PlanItemType) => {
    const normalizedType = normalizeItemType(itemType)
    return actions.filter((action) => normalizeItemType(action.type) === normalizedType)
  }

  const renderActionSetCard = (actionSet: PlanActionSet, setIndex: number) => {
    if (!selectedDay) return null
    const itemType = normalizeItemType(actionSet.itemType)
    const actionOptions = getActionOptionsByType(itemType)
    const selectedActionIndex = actionOptions.findIndex((action) => String(action.id) === String(actionSet.actionId || actionSet.action_id || ''))
    const itemTypeOptions: PlanItemType[] = mode === 'student-favorite'
      ? ['STRENGTH', 'CARDIO']
      : ['STRENGTH', 'CARDIO', 'DIET', 'HABIT']
    const itemTypeLabels = mode === 'student-favorite'
      ? ['力量', '有氧']
      : ['力量', '有氧', '饮食', '习惯']
    const currentItemTypeIndex = itemTypeOptions.indexOf(itemType)
    const params = actionSet.params || {}
    const customData = params.custom_data || {}
    const actionMeta = getItemMeta(itemType)
    const advancedKey = `${selectedDay.dayIndex}-${setIndex}`
    const advancedOpen = Boolean(advancedActionKeys[advancedKey])
    const currentAction = getActionBySet(actionSet)
    const autoLoadEnabled = itemType === 'STRENGTH' && isAutoLoadEligible(currentAction)
    const strengthPreview = itemType === 'STRENGTH' ? getStrengthPreview(actionSet) : null
    const strengthIntensitySource = itemType === 'STRENGTH' ? getStrengthIntensitySource(params) : null
    const fallbackLoad = itemType === 'STRENGTH'
      ? (toFiniteNumber(params.load) ?? toFiniteNumber(params?.intensityConfig?.recommendedLoad?.value))
      : null
    const parsedIntensity = itemType === 'STRENGTH' ? parseIntensityValue(strengthIntensitySource, fallbackLoad) : null
    const strengthControl = itemType === 'STRENGTH' ? getStrengthControlValue(strengthIntensitySource, fallbackLoad) : null
    const strengthSetsValue = itemType === 'STRENGTH' ? getStrengthSetsValue(actionSet) : null
    const strengthRepsValue = itemType === 'STRENGTH' ? getStrengthRepsValue(actionSet) : null
    const strengthRestMinutesValue = itemType === 'STRENGTH' ? getStrengthRestMinutesValue(actionSet) : null
    const strengthLoadUnit = itemType === 'STRENGTH' ? getStrengthLoadUnit(params) : 'kg'
    const strengthAlgorithm = String(params?.algorithm || '综合计算')
    const referenceOneRM = currentAction
      ? resolveReferenceOneRM(currentAction, editor.oneRMConfig, oneRMRecordIndex)
      : null
    const editableDisplayName = resolveEditableDisplayName(actionSet)
    const actionSummary = getActionSummaryText(actionSet)
    const autoRecommendedLoad = strengthPreview?.source === 'auto' && strengthPreview.value !== undefined
      ? strengthPreview.value
      : null
    const recommendedWeightValue = fallbackLoad ?? autoRecommendedLoad
    const recommendedWeightDisplay = recommendedWeightValue !== null && recommendedWeightValue !== undefined
      ? String(recommendedWeightValue)
      : ''

    const syncRecommendedLoad = (
      currentSet: PlanActionSet,
      loadValue: number | null,
      loadUnit: 'kg' | 'lbs'
    ) => {
      const nextParams = {
        ...(currentSet.params || {})
      } as Record<string, any>
      const existingConfig = (nextParams.intensityConfig && typeof nextParams.intensityConfig === 'object')
        ? nextParams.intensityConfig
        : {}
      const nextConfig: Record<string, any> = {
        ...existingConfig
      }

      if (loadValue !== null && loadValue > 0) {
        nextParams.load = loadValue
        nextParams.loadUnit = loadUnit
        nextConfig.recommendedLoad = {
          value: loadValue,
          unit: loadUnit
        }
      } else {
        nextParams.load = ''
        delete nextConfig.recommendedLoad
      }

      nextParams.intensityConfig = Object.keys(nextConfig).length > 0 ? nextConfig : undefined
      return {
        ...currentSet,
        params: nextParams
      }
    }

    return (
      <View
        key={`${selectedDay.dayIndex}-${setIndex}`}
        className={`plan-editor__action-card plan-editor__action-card--${actionMeta.tone}`}
      >
        <View className='plan-editor__action-header'>
          <View className='plan-editor__action-main'>
            <Text className='plan-editor__action-index'>#{setIndex + 1}</Text>
            <Picker
              mode='selector'
              range={itemTypeLabels}
              value={currentItemTypeIndex >= 0 ? currentItemTypeIndex : 0}
              onChange={(event) => {
                const nextType = itemTypeOptions[Number(event.detail.value)] || 'STRENGTH'
                const nextDefault = createActionSet(nextType)
                updateActionSet(selectedDay.dayIndex, setIndex, (currentSet) => ({
                  ...currentSet,
                  itemType: nextType,
                  actionId: '',
                  actionName: '',
                  setName: nextDefault.setName,
                  params: {
                    ...nextDefault.params
                  }
                }))
              }}
            >
              <View className={`plan-editor__type-badge plan-editor__type-badge--${actionMeta.tone}`}>
                <Text>{actionMeta.short}</Text>
              </View>
            </Picker>
            <View className='plan-editor__action-heading'>
              <Text className='plan-editor__action-title'>{resolveActionDisplayName(actionSet, actions)}</Text>
              <Text className='plan-editor__action-subtitle'>{actionSummary}</Text>
            </View>
          </View>

          <View className='plan-editor__action-tools'>
            {itemType === 'STRENGTH' ? (
              <View className={`plan-editor__weight-pill ${strengthPreview?.source || 'missing'}`}>
                <Text>
                  {strengthPreview?.source === 'auto' && strengthPreview.value !== undefined
                    ? `${strengthPreview.value}${strengthPreview.unit || 'kg'}`
                    : strengthPreview?.source === 'manual' && strengthPreview.value !== undefined
                      ? `固定 ${strengthPreview.value}${strengthPreview.unit || 'kg'}`
                      : '待算重'}
                </Text>
              </View>
            ) : null}
            <Text className='plan-editor__action-link' onClick={() => toggleActionAdvanced(selectedDay.dayIndex, setIndex)}>
              {advancedOpen ? '收起' : '更多'}
            </Text>
            <Text className='plan-editor__remove-link' onClick={() => handleRemoveActionSet(setIndex)}>删除</Text>
          </View>
        </View>

        <View className='plan-editor__field plan-editor__field--tight'>
          {mode === 'student-favorite' ? (
            <View
              className='plan-editor__picker plan-editor__picker--accent'
              onClick={() => handleOpenSystemActionLibrary(selectedDay.dayIndex, setIndex, itemType)}
            >
              <Text>{currentAction?.name || actionSet.actionName || actionSet.action_name || '请选择系统动作'}</Text>
              <Text className='plan-editor__picker-arrow'>›</Text>
            </View>
          ) : actionOptions.length > 0 ? (
            <Picker
              mode='selector'
              range={actionOptions.map((action) => action.name)}
              value={selectedActionIndex >= 0 ? selectedActionIndex : 0}
              onChange={(event) => {
                const selectedAction = actionOptions[Number(event.detail.value)]
                if (!selectedAction) return
                updateActionSet(selectedDay.dayIndex, setIndex, (currentSet) => ({
                  ...currentSet,
                  actionId: selectedAction.id,
                  actionName: selectedAction.name,
                  setName: editableDisplayName ? currentSet.setName : ''
                }))
              }}
            >
              <View className='plan-editor__picker plan-editor__picker--accent'>
                <Text>{selectedActionIndex >= 0 ? actionOptions[selectedActionIndex]?.name : '请选择动作'}</Text>
                <Text className='plan-editor__picker-arrow'>›</Text>
              </View>
            </Picker>
          ) : (
            <View className='plan-editor__picker disabled'>
              <Text>当前类型暂无动作，请先补动作库</Text>
            </View>
          )}
        </View>

        {itemType === 'STRENGTH' ? (
          <>
            <View className='plan-editor__grid plan-editor__grid--three'>
              <View className='plan-editor__field'>
                <Text className='plan-editor__label'>组数</Text>
                <Input
                  className='plan-editor__input plan-editor__input--sets'
                  type='number'
                  value={strengthSetsValue === null ? '' : String(strengthSetsValue)}
                  onInput={(event) => {
                    updateActionSet(selectedDay.dayIndex, setIndex, (currentSet) => ({
                      ...currentSet,
                      params: {
                        ...(currentSet.params || {}),
                        sets: Number(event.detail.value || 0),
                        ['组数']: Number(event.detail.value || 0)
                      }
                    }))
                  }}
                />
              </View>
              <View className='plan-editor__field'>
                <Text className='plan-editor__label'>次数</Text>
                <Input
                  className='plan-editor__input plan-editor__input--reps'
                  type='number'
                  value={strengthRepsValue === null ? '' : String(strengthRepsValue)}
                  onInput={(event) => {
                    updateActionSet(selectedDay.dayIndex, setIndex, (currentSet) => ({
                      ...currentSet,
                      params: {
                        ...(currentSet.params || {}),
                        reps: Number(event.detail.value || 0),
                        ['次数']: Number(event.detail.value || 0)
                      }
                    }))
                  }}
                />
              </View>
              <View className='plan-editor__field'>
                <Text className='plan-editor__label'>休息(min)</Text>
                <Input
                  className='plan-editor__input plan-editor__input--rest'
                  type='digit'
                  value={strengthRestMinutesValue === null ? '' : String(strengthRestMinutesValue)}
                  onInput={(event) => {
                    const restMinutes = Number(event.detail.value || 0)
                    const restSeconds = Number((restMinutes * 60).toFixed(0))
                    updateActionSet(selectedDay.dayIndex, setIndex, (currentSet) => ({
                      ...currentSet,
                      params: {
                        ...(currentSet.params || {}),
                        rest_seconds: restSeconds,
                        ['休息时间']: restSeconds
                      }
                    }))
                  }}
                />
              </View>
            </View>
            <View className='plan-editor__field plan-editor__field--full'>
              <Text className='plan-editor__label'>强度</Text>
              <View className='plan-editor__strength-config'>
                <View className='plan-editor__segment-row'>
                  {[
                    { key: 'rm', label: 'RM' },
                    { key: 'percentage', label: '%' },
                    { key: 'fixed', label: '固定' }
                  ].map((option) => (
                    <View
                      key={option.key}
                      className={`plan-editor__segment ${strengthControl?.mode === option.key ? 'active' : ''}`}
                      onClick={() => {
                        const nextValue = option.key === 'fixed'
                          ? recommendedWeightDisplay
                          : (strengthControl?.mode === option.key ? strengthControl?.value || '' : '')
                        updateActionSet(selectedDay.dayIndex, setIndex, (currentSet) => ({
                          ...currentSet,
                          params: applyStrengthControlValue(currentSet.params || {}, {
                            mode: option.key as 'rm' | 'percentage' | 'fixed',
                            value: nextValue
                          })
                        }))
                      }}
                    >
                      <Text>{option.label}</Text>
                    </View>
                  ))}
                </View>
                <View className='plan-editor__inline-input plan-editor__inline-input--strength'>
                  <Input
                    className='plan-editor__input plan-editor__input--compact'
                    type='digit'
                    value={strengthControl?.value || ''}
                    placeholder={strengthControl?.mode === 'fixed'
                      ? '60'
                      : strengthControl?.mode === 'percentage'
                        ? '75'
                        : '8'}
                    onInput={(event) => {
                      updateActionSet(selectedDay.dayIndex, setIndex, (currentSet) => ({
                        ...currentSet,
                        params: applyStrengthControlValue(currentSet.params || {}, {
                          mode: strengthControl?.mode || 'rm',
                          value: event.detail.value
                        })
                      }))
                    }}
                  />
                  <Text className='plan-editor__inline-suffix'>
                    {strengthControl?.mode === 'fixed'
                      ? 'kg'
                      : strengthControl?.mode === 'percentage'
                        ? '%'
                        : 'RM'}
                  </Text>
                </View>
              </View>
            </View>
            {strengthControl?.mode === 'rm' ? (
              <View className='plan-editor__field plan-editor__field--full'>
                <Text className='plan-editor__label'>自动计算算法</Text>
                <View className='plan-editor__chip-row'>
                  {['综合计算', 'Epley', 'Brzycki', 'Lombardi'].map((name) => (
                    <View
                      key={name}
                      className={`plan-editor__chip ${strengthAlgorithm === name ? 'active' : ''}`}
                      onClick={() => {
                        updateActionSet(selectedDay.dayIndex, setIndex, (currentSet) => ({
                          ...currentSet,
                          params: {
                            ...(currentSet.params || {}),
                            algorithm: name
                          }
                        }))
                      }}
                    >
                      <Text>{name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            <View className='plan-editor__field plan-editor__field--full'>
              <Text className='plan-editor__label'>
                {strengthControl?.mode === 'fixed' ? '固定重量' : '推荐重量（备选）'}
              </Text>
              <View className='plan-editor__grid plan-editor__grid--two'>
                <Input
                  className='plan-editor__input'
                  type='digit'
                  value={recommendedWeightDisplay}
                  placeholder={autoRecommendedLoad !== null ? String(autoRecommendedLoad) : '0'}
                  onInput={(event) => {
                    const nextLoad = toFiniteNumber(event.detail.value)
                    updateActionSet(selectedDay.dayIndex, setIndex, (currentSet) => syncRecommendedLoad(currentSet, nextLoad, strengthLoadUnit))
                  }}
                />
                <View className='plan-editor__chip-row plan-editor__chip-row--compact'>
                  {(['kg', 'lbs'] as const).map((unit) => (
                    <View
                      key={`load-unit-${unit}`}
                      className={`plan-editor__chip ${strengthLoadUnit === unit ? 'active' : ''}`}
                      onClick={() => {
                        updateActionSet(selectedDay.dayIndex, setIndex, (currentSet) => {
                          const currentLoad = toFiniteNumber((currentSet.params || {}).load)
                          return syncRecommendedLoad(currentSet, currentLoad, unit)
                        })
                      }}
                    >
                      <Text>{unit}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
            <View className={`plan-editor__auto-load plan-editor__auto-load--${strengthPreview?.source || 'missing'}`}>
              <View className='plan-editor__auto-load-main'>
                <Text className='plan-editor__auto-load-label'>
                  {strengthControl?.mode === 'fixed' ? '固定重量' : '自动计算'}
                </Text>
                <Text className='plan-editor__auto-load-value'>
                  {strengthPreview?.source === 'auto' && strengthPreview.value !== undefined
                    ? `${strengthPreview.value}${strengthPreview.unit || strengthLoadUnit}`
                    : strengthPreview?.source === 'manual' && strengthPreview.value !== undefined
                      ? `${strengthPreview.value}${strengthPreview.unit || strengthLoadUnit}`
                      : strengthPreview?.reason || '填写强度后显示自动算重'}
                </Text>
              </View>
              <Text className='plan-editor__auto-load-meta'>
                {strengthPreview?.source === 'auto'
                  ? `基于 ${strengthPreview.basis || ''}${referenceOneRM ? ` · 1RM ${referenceOneRM}kg` : ''}${bodyWeight ? ` · 体重 ${bodyWeight}kg` : ''}`
                  : strengthPreview?.source === 'manual'
                    ? (strengthControl?.mode === 'fixed' ? '这组会按固定重量展示与执行' : '无法计算时会回退使用推荐重量')
                    : autoLoadEnabled
                      ? `当前识别：${parsedIntensity?.raw || '未设置强度'}`
                      : '当前动作未启用自动算重'}
              </Text>
            </View>
            <View className='plan-editor__field plan-editor__field--full'>
              <Text className='plan-editor__label'>备注</Text>
              <Textarea
                className='plan-editor__textarea plan-editor__textarea--compact'
                value={String(params.note || '')}
                placeholder='如 rpe9、热身组、动作节奏等'
                maxlength={200}
                autoHeight
                onInput={(event) => {
                  updateActionParams(selectedDay.dayIndex, setIndex, {
                    note: event.detail.value
                  })
                }}
              />
            </View>

            {advancedOpen ? (
              <View className='plan-editor__grid plan-editor__grid--two plan-editor__advanced-grid'>
                <View className='plan-editor__field plan-editor__field--full'>
                  <Text className='plan-editor__label'>识别明细</Text>
                  <Text className='plan-editor__caption'>
                    当前强度：{parsedIntensity?.raw || '未设置'} · 算法：{strengthControl?.mode === 'rm' ? strengthAlgorithm : '不适用'}
                  </Text>
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {itemType === 'CARDIO' ? (
          <View className='plan-editor__grid plan-editor__grid--three'>
            <View className='plan-editor__field'>
              <Text className='plan-editor__label'>时长(分)</Text>
              <Input
                className='plan-editor__input'
                type='number'
                value={customData.duration ? String(Math.round(Number(customData.duration) / 60)) : ''}
                onInput={(event) => {
                  updateActionCustomData(selectedDay.dayIndex, setIndex, {
                    duration: Number(event.detail.value || 0) * 60
                  })
                }}
              />
            </View>
            <View className='plan-editor__field'>
              <Text className='plan-editor__label'>距离(km)</Text>
              <Input
                className='plan-editor__input'
                type='digit'
                value={String(customData.distance ?? '')}
                onInput={(event) => {
                  updateActionCustomData(selectedDay.dayIndex, setIndex, {
                    distance: Number(event.detail.value || 0)
                  })
                }}
              />
            </View>
            <View className='plan-editor__field'>
              <Text className='plan-editor__label'>配速</Text>
              <Input
                className='plan-editor__input'
                type='digit'
                value={String(customData.pace ?? '')}
                placeholder='min/km'
                onInput={(event) => {
                  updateActionCustomData(selectedDay.dayIndex, setIndex, {
                    pace: Number(event.detail.value || 0)
                  })
                }}
              />
            </View>
          </View>
        ) : null}

        {itemType === 'DIET' ? (
          <View className='plan-editor__grid plan-editor__grid--three'>
            <View className='plan-editor__field plan-editor__field--full'>
              <Text className='plan-editor__label'>份量/内容</Text>
              <Input
                className='plan-editor__input'
                value={String(customData.content || '')}
                placeholder='如 100g / 2片 / 1杯'
                onInput={(event) => {
                  updateActionCustomData(selectedDay.dayIndex, setIndex, {
                    content: event.detail.value
                  })
                }}
              />
            </View>
            <View className='plan-editor__field'>
              <Text className='plan-editor__label'>热量(kcal)</Text>
              <Input
                className='plan-editor__input'
                type='number'
                value={String(customData.calories ?? '')}
                onInput={(event) => {
                  updateActionCustomData(selectedDay.dayIndex, setIndex, {
                    calories: Number(event.detail.value || 0)
                  })
                }}
              />
            </View>
          </View>
        ) : null}

        {itemType === 'HABIT' ? (
          <View className='plan-editor__grid plan-editor__grid--three'>
            {!actionSet.actionId ? (
              <View className='plan-editor__field plan-editor__field--full'>
                <Text className='plan-editor__label'>习惯名称</Text>
                <Input
                  className='plan-editor__input'
                  value={String(customData.habit_name || '')}
                  placeholder='如 每晚 11 点前睡觉'
                  onInput={(event) => {
                    updateActionCustomData(selectedDay.dayIndex, setIndex, {
                      habit_name: event.detail.value
                    })
                  }}
                />
              </View>
            ) : null}
            <View className='plan-editor__field'>
              <Text className='plan-editor__label'>目标值</Text>
              <Input
                className='plan-editor__input'
                value={String(customData.target_duration ?? '')}
                placeholder='如 30分钟 / 8000步'
                onInput={(event) => {
                  updateActionCustomData(selectedDay.dayIndex, setIndex, {
                    target_duration: event.detail.value
                  })
                }}
              />
            </View>
          </View>
        ) : null}

        {itemType !== 'STRENGTH' && advancedOpen ? (
          <View className='plan-editor__grid plan-editor__grid--two plan-editor__advanced-grid'>
            {itemType === 'CARDIO' ? (
              <View className='plan-editor__field plan-editor__field--full'>
                <Text className='plan-editor__label'>备注</Text>
                <Textarea
                  className='plan-editor__textarea plan-editor__textarea--compact'
                  value={String(params.note || '')}
                  placeholder='补充节奏、心率区间或执行提示'
                  maxlength={200}
                  autoHeight
                  onInput={(event) => {
                    updateActionParams(selectedDay.dayIndex, setIndex, {
                      note: event.detail.value
                    })
                  }}
                />
              </View>
            ) : null}
            {itemType === 'DIET' ? (
              <>
                <View className='plan-editor__field'>
                  <Text className='plan-editor__label'>建议时间</Text>
                  <Input
                    className='plan-editor__input'
                    value={String(params.suggested_time ?? '')}
                    placeholder='08:00'
                    onInput={(event) => {
                      updateActionParams(selectedDay.dayIndex, setIndex, {
                        suggested_time: event.detail.value
                      })
                    }}
                  />
                </View>
                <View className='plan-editor__field plan-editor__field--full'>
                  <Text className='plan-editor__label'>备注</Text>
                  <Textarea
                    className='plan-editor__textarea plan-editor__textarea--compact'
                    value={String(params.note || '')}
                    placeholder='如 早餐/晚餐/烹饪方式'
                    maxlength={200}
                    autoHeight
                    onInput={(event) => {
                      updateActionParams(selectedDay.dayIndex, setIndex, {
                        note: event.detail.value
                      })
                    }}
                  />
                </View>
              </>
            ) : null}
            {itemType === 'HABIT' ? (
              <View className='plan-editor__field plan-editor__field--full'>
                <Text className='plan-editor__label'>备注</Text>
                <Textarea
                  className='plan-editor__textarea plan-editor__textarea--compact'
                  value={String(params.note || '')}
                  placeholder='如 日饮水 2L / 阅读 30分钟'
                  maxlength={200}
                  autoHeight
                  onInput={(event) => {
                    updateActionParams(selectedDay.dayIndex, setIndex, {
                      note: event.detail.value
                    })
                  }}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    )
  }

  if (loading) {
    return (
      <View className={`plan-editor ${withBottomNav ? 'page-with-float-nav with-nav' : ''}`}>
        <View className="plan-editor__loading"><LoadingSpinner size={48} /></View>
        {withBottomNav ? <BottomNav /> : null}
      </View>
    )
  }

  return (
    <View className={`plan-editor page-with-nav ${withBottomNav ? 'page-with-float-nav with-nav' : ''}`}>
      <View className='plan-editor__scroll'>
        <View className='plan-editor__content'>
          <View className='plan-editor__hero'>
            <Text className='plan-editor__title'>{title}</Text>
            {subtitle ? <Text className='plan-editor__subtitle'>{subtitle}</Text> : null}
          </View>

          <View className='plan-editor__section'>
            <View className='plan-editor__section-header compact'>
              <View>
                <Text className='plan-editor__section-title'>基础信息</Text>
                <Text className='plan-editor__caption'>先定标题和计划说明，其余内容再按天细化。</Text>
              </View>
            </View>
            <View className='plan-editor__field'>
              <Text className='plan-editor__label'>{mode === 'coach-template' ? '模板名称' : '计划名称'}</Text>
              <Input
                className='plan-editor__input'
                value={editor.name}
                placeholder={mode === 'coach-template' ? '输入模板名称' : '输入计划名称'}
                onInput={(event) => updateEditor((current) => ({ ...current, name: event.detail.value }))}
              />
            </View>
            {mode === 'coach-template' ? (
              <View className='plan-editor__field'>
                <Text className='plan-editor__label'>训练项目（可选）</Text>
                <Input
                  className='plan-editor__input'
                  value={tagInput}
                  placeholder='用逗号分隔，例如 引体、背屈伸、8周'
                  onInput={(event) => {
                    setTagInput(event.detail.value)
                    updateEditor((current) => ({
                      ...current,
                      tags: parseTags(event.detail.value)
                    }))
                  }}
                />
              </View>
            ) : null}
            <View className='plan-editor__field'>
              <Text className='plan-editor__label'>详情描述</Text>
              <Textarea
                className='plan-editor__textarea'
                value={editor.description}
                placeholder='补充模板目标、安排思路和使用说明'
                maxlength={600}
                autoHeight
                onInput={(event) => updateEditor((current) => ({ ...current, description: event.detail.value }))}
              />
            </View>
            {mode === 'coach-template' ? (
              <View className='plan-editor__field'>
                <Text className='plan-editor__label'>执行摘要</Text>
                <Textarea
                  className='plan-editor__textarea'
                  value={editor.executionNotice}
                  placeholder='同步网页端的执行说明，例如安全提醒、视频提交要求或周期注意事项'
                  maxlength={1200}
                  autoHeight
                  onInput={(event) => updateEditor((current) => ({ ...current, executionNotice: event.detail.value }))}
                />
              </View>
            ) : null}
            {mode === 'coach-template' ? (
              <View className='plan-editor__field'>
                <Text className='plan-editor__label'>每周频率</Text>
                <View className='plan-editor__chip-row'>
                  {PLAN_DAY_POSITIONS.map((value) => {
                    return (
                      <View
                        key={`weekly-frequency-inline-${value}`}
                        className={`plan-editor__chip ${editor.weekDays.includes(value) ? 'active' : ''}`}
                        onClick={() => handleToggleWeekday(value)}
                      >
                        <Text>{value}次/周</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
            ) : null}
            {false ? (
              <>
                <View className='plan-editor__field'>
                  <Text className='plan-editor__label'>标签</Text>
                  <Input
                    className='plan-editor__input'
                    value={tagInput}
                    placeholder='用逗号分隔，如 新手, 增肌, 三分化'
                    onInput={(event) => {
                      setTagInput(event.detail.value)
                      updateEditor((current) => ({
                        ...current,
                        tags: parseTags(event.detail.value)
                      }))
                    }}
                  />
                </View>
                <View className='plan-editor__field'>
                  <Text className='plan-editor__label'>适合人群</Text>
                  <View className='plan-editor__chip-row'>
                    {(Object.keys(SUITABLE_FOR_LABELS) as Array<keyof typeof SUITABLE_FOR_LABELS>).map((option) => (
                      <View
                        key={option}
                        className={`plan-editor__chip ${editor.suitableFor === option ? 'active' : ''}`}
                        onClick={() => updateEditor((current) => ({ ...current, suitableFor: option }))}
                      >
                        <Text>{SUITABLE_FOR_LABELS[option]}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View className='plan-editor__field'>
                  <Text className='plan-editor__label'>模板类型</Text>
                  <View className='plan-editor__chip-row'>
                    {[
                      { label: '通用', value: '' },
                      { label: '新手', value: 'beginner' },
                      { label: '力量', value: 'strength' }
                    ].map((option) => (
                      <View
                        key={option.label}
                        className={`plan-editor__chip ${String(editor.type || '') === option.value ? 'active' : ''}`}
                        onClick={() => updateEditor((current) => ({ ...current, type: option.value }))}
                      >
                        <Text>{option.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View className='plan-editor__field'>
                  <Text className='plan-editor__label'>建议每周频率</Text>
                  <View className='plan-editor__chip-row'>
                    {PLAN_DAY_POSITIONS.map((value) => {
                      return (
                        <View
                          key={`weekly-frequency-${value}`}
                          className={`plan-editor__chip ${editor.weekDays.includes(value) ? 'active' : ''}`}
                          onClick={() => handleToggleWeekday(value)}
                        >
                          <Text>{value}次/周</Text>
                        </View>
                      )
                    })}
                  </View>
                </View>
              </>
            ) : null}
          </View>

          {mode === 'student-favorite' ? (
            <View className='plan-editor__section'>
              <PlanReferenceOneRMPanel
                title='负重参考'
                caption={
                  relevantOneRMActions.length > 0
                    ? `${relevantOneRMActions.length} 个动作支持按 1RM 自动算重`
                    : '当前计划里还没有需要配置 1RM 的力量动作'
                }
                items={oneRMItems}
                expanded={showOneRMPanel}
                onToggle={() => setShowOneRMPanel((current) => !current)}
                emptyText='当前计划里还没有需要配置 1RM 的力量动作。'
                onChange={(actionId, value) => {
                  const parsed = value === '' ? null : Number(value)
                  updateEditor((current) => {
                    const nextConfig = { ...current.oneRMConfig }
                    if (parsed === null || !Number.isFinite(parsed) || parsed <= 0) {
                      delete nextConfig[actionId]
                    } else {
                      nextConfig[actionId] = parsed
                    }
                    return {
                      ...current,
                      oneRMConfig: nextConfig
                    }
                  })
                }}
              />
            </View>
          ) : null}

          <View className='plan-editor__section'>
            <View className='plan-editor__section-header'>
              <View>
                <Text className='plan-editor__section-title'>周历编排</Text>
                <Text className='plan-editor__caption'>
                  共 {executionSummary.totalDays} 天 / {executionSummary.trainingDays} 个训练日
                </Text>
              </View>
              <View className='plan-editor__toolbar'>
                {onImportText ? (
                  <View className='plan-editor__toolbar-btn' onClick={() => setShowImportDialog(true)}>
                    <Text>智能导入</Text>
                  </View>
                ) : null}
                <View className='plan-editor__toolbar-btn' onClick={handleOpenScriptDialog}>
                  <Text>脚本模式</Text>
                </View>
                <View className='plan-editor__toolbar-btn' onClick={() => setShowBatchDialog(true)}>
                  <Text>批量操作</Text>
                </View>
                <View className='plan-editor__toolbar-btn primary' onClick={handleAddWeek}>
                  <Text>新增一周</Text>
                </View>
              </View>
            </View>

            <PlanCompactWeekCalendar
              weeks={weekCalendarWeeks}
              currentWeekIndex={currentWeekIndex}
              selectedDayIndex={selectedDayIndex}
              title={`第 ${currentWeekIndex + 1} 周`}
              caption={`当前选中第 ${selectedDayIndex} 天 · ${getPlanDayPositionLabel(selectedDayIndex)}`}
              expanded={showFullCalendar}
              onSelectDay={setSelectedDayIndex}
              onPrevWeek={() => goToWeek(-1)}
              onNextWeek={() => goToWeek(1)}
              onToggleExpanded={() => setShowFullCalendar((current) => !current)}
              footerActions={[
                { label: '复制本周', onClick: () => handleCloneWeek(currentWeekIndex) },
                ...(weeks.length > 1 ? [{ label: '删除本周', danger: true, onClick: () => handleDeleteWeek(currentWeekIndex) }] : [])
              ]}
              fullWeekActions={[
                { label: '复制本周', onClick: (weekIndex) => handleCloneWeek(weekIndex) },
                ...(weeks.length > 1 ? [{ label: '删除', danger: true, onClick: (weekIndex: number) => handleDeleteWeek(weekIndex) }] : [])
              ]}
            />
          </View>

          {selectedDay ? (
            <View className='plan-editor__section'>
              <View className='plan-editor__section-header'>
                <View>
                  <Text className='plan-editor__section-title'>
                    第 {selectedDay.dayIndex} 天 · {getPlanDayPositionLabel(selectedDay.dayIndex)}
                  </Text>
                  <Text className='plan-editor__caption'>
                    {selectedDay.type === 'rest'
                      ? '休息日，留备注即可'
                      : `${selectedDay.actionSets?.length || 0} 个训练条目`}
                  </Text>
                </View>
                <View className='plan-editor__toolbar'>
                  <View className='plan-editor__toolbar-btn' onClick={() => setShowCopyDialog(true)}>
                    <Text>复制其他天</Text>
                  </View>
                  <View
                    className={`plan-editor__toolbar-btn ${selectedDay.type === 'training' ? '' : 'primary'}`}
                    onClick={() => updateDay(selectedDay.dayIndex, (day) => ({
                      ...day,
                      type: day.type === 'rest' ? 'training' : 'rest',
                      actionSets: day.type === 'rest' ? day.actionSets : []
                    }))}
                  >
                    <Text>{selectedDay.type === 'rest' ? '改为训练日' : '改为休息日'}</Text>
                  </View>
                </View>
              </View>

              <View className='plan-editor__field'>
                <Text className='plan-editor__label'>备注</Text>
                <Textarea
                  className='plan-editor__textarea'
                  value={selectedDay.note || ''}
                  placeholder='补充当天训练说明、节奏安排与注意事项'
                  maxlength={300}
                  autoHeight
                  onInput={(event) => updateDay(selectedDay.dayIndex, (day) => ({
                    ...day,
                    note: event.detail.value
                  }))}
                />
              </View>

              {selectedDay.type === 'training' ? (
                <>
                  <View className='plan-editor__section-header compact'>
                    <Text className='plan-editor__section-title'>训练条目</Text>
                    <View className='plan-editor__toolbar wrap'>
                      {(mode === 'student-favorite'
                        ? [
                            { label: '力量', type: 'STRENGTH' as PlanItemType },
                            { label: '有氧', type: 'CARDIO' as PlanItemType }
                          ]
                        : [
                            { label: '力量', type: 'STRENGTH' as PlanItemType },
                            { label: '有氧', type: 'CARDIO' as PlanItemType },
                            { label: '饮食', type: 'DIET' as PlanItemType },
                            { label: '习惯', type: 'HABIT' as PlanItemType }
                          ]).map((option) => (
                        <View
                          key={option.type}
                          className='plan-editor__toolbar-btn'
                          onClick={() => handleAddActionSet(option.type)}
                        >
                          <Text>+ {option.label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {(selectedDay.actionSets || []).length === 0 ? (
                    <Text className='plan-editor__muted'>当前还没有训练条目，先从上面添加一项。</Text>
                  ) : (
                    (selectedDay.actionSets || []).map((actionSet, setIndex) => renderActionSetCard(actionSet, setIndex))
                  )}
                </>
              ) : (
                <Text className='plan-editor__muted'>休息日不会安排动作条目。切回训练日即可继续编辑。</Text>
              )}
            </View>
          ) : null}

          <View className='plan-editor__spacer' />
        </View>
      </ScrollView>

      <View className={`plan-editor__bottom-bar ${withBottomNav ? 'with-nav' : ''}`}>
        {onCancel ? (
          <View className='plan-editor__bottom-btn secondary' onClick={onCancel}>
            <Text>返回</Text>
          </View>
        ) : null}
        <View className='plan-editor__bottom-btn primary' onClick={() => void handleSave()}>
          <Text>{saving ? '保存中...' : saveLabel}</Text>
        </View>
      </View>

      {withBottomNav ? <BottomNav /> : null}

      {showImportDialog ? (
        <View className='plan-editor__modal-mask' onClick={() => setShowImportDialog(false)}>
          <View className='plan-editor__modal' onClick={(event) => event.stopPropagation()}>
            <View className='plan-editor__modal-header'>
              <Text className='plan-editor__modal-title'>智能导入</Text>
              <Text className='plan-editor__modal-close' onClick={() => setShowImportDialog(false)}>×</Text>
            </View>
            <Textarea
              className='plan-editor__modal-textarea'
              value={importText}
              placeholder='粘贴训练计划文本，例如：第1日 深蹲 5x5，第3日 卧推 4x8...'
              maxlength={5000}
              onInput={(event) => setImportText(event.detail.value)}
            />
            <View className='plan-editor__toolbar wrap'>
              <View className='plan-editor__toolbar-btn' onClick={() => void handleChooseImportImage()}>
                <Text>上传计划图片</Text>
              </View>
              <View className='plan-editor__toolbar-btn' onClick={() => void handleChooseImportFile()}>
                <Text>上传文件</Text>
              </View>
            </View>
            <Text className='plan-editor__modal-hint'>支持 txt、CSV、Word、Excel、文字 PDF 和图片；图片识别后会先填入文本框供你核对。</Text>
            <View className='plan-editor__modal-footer'>
              <View className='plan-editor__modal-btn' onClick={() => setShowImportDialog(false)}>
                <Text>取消</Text>
              </View>
              <View className='plan-editor__modal-btn primary' onClick={() => void handleImportConfirm()}>
                <Text>{importing ? '导入中...' : '确认导入'}</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {showScriptDialog ? (
        <View className='plan-editor__modal-mask' onClick={() => setShowScriptDialog(false)}>
          <View className='plan-editor__modal large' onClick={(event) => event.stopPropagation()}>
            <View className='plan-editor__modal-header'>
              <Text className='plan-editor__modal-title'>计划脚本</Text>
              <Text className='plan-editor__modal-close' onClick={() => setShowScriptDialog(false)}>×</Text>
            </View>
            <Text className='plan-editor__modal-hint'>
              支持 W1、D1、D2 off、动作 4x8 @9rm r180 #备注。保存前会回写到当前编辑器。
            </Text>
            <Textarea
              className='plan-editor__modal-textarea plan-editor__modal-textarea--script'
              value={scriptText}
              placeholder={'W1\nD1\n深蹲 5x5 @8rm r180\nD2 off #主动恢复'}
              maxlength={20000}
              onInput={(event) => {
                setScriptText(event.detail.value)
                if (scriptError) setScriptError('')
              }}
            />
            {scriptError ? (
              <Text className='plan-editor__modal-error'>{scriptError}</Text>
            ) : null}
            <View className='plan-editor__modal-footer'>
              <View className='plan-editor__modal-btn' onClick={() => setShowScriptDialog(false)}>
                <Text>取消</Text>
              </View>
              <View className='plan-editor__modal-btn primary' onClick={handleApplyScript}>
                <Text>应用脚本</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {showCopyDialog ? (
        <View className='plan-editor__modal-mask' onClick={() => setShowCopyDialog(false)}>
          <View className='plan-editor__modal' onClick={(event) => event.stopPropagation()}>
            <View className='plan-editor__modal-header'>
              <Text className='plan-editor__modal-title'>复制其他天内容</Text>
              <Text className='plan-editor__modal-close' onClick={() => setShowCopyDialog(false)}>×</Text>
            </View>
            <ScrollView className='plan-editor__modal-list' scrollY>
              {editor.days
                .filter((day) => day.dayIndex !== selectedDay?.dayIndex)
                .map((day) => (
                  <View
                    key={`copy-${day.dayIndex}`}
                    className='plan-editor__list-item'
                    onClick={() => handleCopyFromDay(day.dayIndex)}
                  >
                    <Text className='plan-editor__list-title'>第 {day.dayIndex} 天</Text>
                    <Text className='plan-editor__list-meta'>
                      {day.type === 'rest' ? '休息日' : `${day.actionSets?.length || 0} 项训练`}
                    </Text>
                  </View>
                ))}
            </ScrollView>
          </View>
        </View>
      ) : null}

      {showBatchDialog ? (
        <View className='plan-editor__modal-mask' onClick={() => setShowBatchDialog(false)}>
          <View className='plan-editor__modal large' onClick={(event) => event.stopPropagation()}>
            <View className='plan-editor__modal-header'>
              <Text className='plan-editor__modal-title'>批量操作</Text>
              <Text className='plan-editor__modal-close' onClick={() => setShowBatchDialog(false)}>×</Text>
            </View>
            <View className='plan-editor__field'>
              <Text className='plan-editor__label'>操作类型</Text>
              <View className='plan-editor__chip-row'>
                {[
                  { label: '替换动作', value: 'replace' as BatchMode },
                  { label: '删除动作', value: 'delete' as BatchMode },
                  { label: '批量追加', value: 'append' as BatchMode }
                ].map((option) => (
                  <View
                    key={option.value}
                    className={`plan-editor__chip ${batchMode === option.value ? 'active' : ''}`}
                    onClick={() => setBatchMode(option.value)}
                  >
                    <Text>{option.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {batchMode === 'replace' || batchMode === 'delete' ? (
              <View className='plan-editor__field'>
                <Text className='plan-editor__label'>{batchMode === 'replace' ? '原动作' : '要删除的动作'}</Text>
                {usedActions.length > 0 ? (
                  <Picker
                    mode='selector'
                    range={usedActions.map((action) => action.name)}
                    value={Math.max(0, usedActions.findIndex((action) => action.id === batchFromActionId))}
                    onChange={(event) => {
                      const action = usedActions[Number(event.detail.value)]
                      setBatchFromActionId(action?.id || '')
                    }}
                  >
                    <View className='plan-editor__picker'>
                      <Text>{usedActions.find((action) => action.id === batchFromActionId)?.name || '请选择动作'}</Text>
                      <Text className='plan-editor__picker-arrow'>›</Text>
                    </View>
                  </Picker>
                ) : (
                  <View className='plan-editor__picker disabled'>
                    <Text>当前计划中还没有可批量处理的动作</Text>
                  </View>
                )}
              </View>
            ) : null}

            {batchMode === 'replace' ? (
              <View className='plan-editor__field'>
                <Text className='plan-editor__label'>替换成</Text>
                <Picker
                  mode='selector'
                  range={actions.map((action) => action.name)}
                  value={Math.max(0, actions.findIndex((action) => action.id === batchToActionId))}
                  onChange={(event) => {
                    const action = actions[Number(event.detail.value)]
                    setBatchToActionId(action?.id || '')
                  }}
                >
                  <View className='plan-editor__picker'>
                    <Text>{actions.find((action) => action.id === batchToActionId)?.name || '请选择动作'}</Text>
                    <Text className='plan-editor__picker-arrow'>›</Text>
                  </View>
                </Picker>
              </View>
            ) : null}

            {batchMode === 'append' ? (
              <>
                <View className='plan-editor__field'>
                  <Text className='plan-editor__label'>追加动作</Text>
                  <Picker
                    mode='selector'
                    range={actions.map((action) => action.name)}
                    value={Math.max(0, actions.findIndex((action) => action.id === batchAppendActionId))}
                    onChange={(event) => {
                      const action = actions[Number(event.detail.value)]
                      setBatchAppendActionId(action?.id || '')
                    }}
                  >
                    <View className='plan-editor__picker'>
                      <Text>{actions.find((action) => action.id === batchAppendActionId)?.name || '请选择动作'}</Text>
                      <Text className='plan-editor__picker-arrow'>›</Text>
                    </View>
                  </Picker>
                </View>
                <View className='plan-editor__grid plan-editor__grid--two'>
                  <View className='plan-editor__field'>
                    <Text className='plan-editor__label'>开始周</Text>
                    <Input
                      className='plan-editor__input'
                      type='number'
                      value={String(batchWeekStart)}
                      onInput={(event) => setBatchWeekStart(Math.max(1, Number(event.detail.value || 1)))}
                    />
                  </View>
                  <View className='plan-editor__field'>
                    <Text className='plan-editor__label'>结束周</Text>
                    <Input
                      className='plan-editor__input'
                      type='number'
                      value={String(batchWeekEnd)}
                      onInput={(event) => setBatchWeekEnd(Math.max(1, Number(event.detail.value || 1)))}
                    />
                  </View>
                </View>
                <View className='plan-editor__field'>
                  <Text className='plan-editor__label'>目标训练日</Text>
                  <View className='plan-editor__chip-row'>
                    {PLAN_DAY_POSITIONS.map((value) => {
                      const active = batchWeekdays.includes(value)
                      return (
                        <View
                          key={`batch-day-${value}`}
                          className={`plan-editor__chip ${active ? 'active' : ''}`}
                          onClick={() => {
                            setBatchWeekdays((current) => (
                              current.includes(value)
                                ? current.filter((item) => item !== value)
                                : [...current, value].sort((a, b) => a - b)
                            ))
                          }}
                        >
                          <Text>第{value}日</Text>
                        </View>
                      )
                    })}
                  </View>
                </View>
              </>
            ) : null}

            <View className='plan-editor__modal-footer'>
              <View className='plan-editor__modal-btn' onClick={() => setShowBatchDialog(false)}>
                <Text>取消</Text>
              </View>
              <View className='plan-editor__modal-btn primary' onClick={handleBatchConfirm}>
                <Text>执行</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}
