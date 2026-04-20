import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Input, Textarea, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import PlanCompactWeekCalendar from '@/components/PlanCompactWeekCalendar'
import PlanReferenceOneRMPanel from '@/components/PlanReferenceOneRMPanel'
import type { PlanActionOption, PlanActionSet, PlanEditorValue, PlanItemType, PlanQuestionItem, PlanTrainingDay } from '@/types/plan'
import type { PlanOneRMRecord } from '@/utils/planStrength'
import {
  WEEKDAY_LABELS,
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
  normalizeQuestionOptions,
  resolveActionDisplayName
} from '@/utils/planEditor'
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
  loadQuestionnaires?: () => Promise<PlanQuestionItem[]>
}

const createInitialValue = (mode: PlanEditorMode, initialValue?: Partial<PlanEditorValue> | null): PlanEditorValue => {
  const defaultDays = initialValue?.days && initialValue.days.length > 0
    ? normalizePlanDays(initialValue.days)
    : createDefaultPlanDays(1, mode === 'coach-template' ? 'coach' : 'student')

  return {
    name: initialValue?.name || '',
    description: initialValue?.description || '',
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
  actions,
  studentProfile = null,
  oneRMRecords = [],
  loading = false,
  saving = false,
  saveLabel = '保存',
  withBottomNav = false,
  onCancel,
  onSave,
  onImportText,
  loadQuestionnaires
}: PlanEditorWorkbenchProps) {
  const [editor, setEditor] = useState<PlanEditorValue>(() => createInitialValue(mode, initialValue))
  const [selectedDayIndex, setSelectedDayIndex] = useState(1)
  const [tagInput, setTagInput] = useState((initialValue?.tags || []).join(', '))
  const [questionnaires, setQuestionnaires] = useState<PlanQuestionItem[]>([])
  const [questionnaireLoading, setQuestionnaireLoading] = useState(false)
  const [showBatchDialog, setShowBatchDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showCopyDialog, setShowCopyDialog] = useState(false)
  const [showOneRMPanel, setShowOneRMPanel] = useState(false)
  const [showFullCalendar, setShowFullCalendar] = useState(false)
  const [advancedActionKeys, setAdvancedActionKeys] = useState<Record<string, boolean>>({})
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [batchMode, setBatchMode] = useState<BatchMode>('replace')
  const [batchFromActionId, setBatchFromActionId] = useState('')
  const [batchToActionId, setBatchToActionId] = useState('')
  const [batchAppendActionId, setBatchAppendActionId] = useState('')
  const [batchWeekStart, setBatchWeekStart] = useState(1)
  const [batchWeekEnd, setBatchWeekEnd] = useState(1)
  const [batchWeekdays, setBatchWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7])

  useEffect(() => {
    const nextValue = createInitialValue(mode, initialValue)
    setEditor(nextValue)
    setTagInput((nextValue.tags || []).join(', '))
    setSelectedDayIndex(nextValue.days.find((day) => day.type === 'training')?.dayIndex || nextValue.days[0]?.dayIndex || 1)
    setBatchWeekEnd(Math.max(1, Math.ceil(nextValue.days.length / 7)))
    setShowOneRMPanel(false)
    setShowFullCalendar(false)
    setAdvancedActionKeys({})
  }, [initialValue, mode])

  useEffect(() => {
    if (mode !== 'coach-template' || !loadQuestionnaires) return
    let mounted = true
    setQuestionnaireLoading(true)
    loadQuestionnaires()
      .then((items) => {
        if (!mounted) return
        setQuestionnaires(Array.isArray(items) ? items : [])
      })
      .catch((error) => {
        console.warn('[PlanEditorWorkbench] load questionnaires failed:', error)
      })
      .finally(() => {
        if (mounted) setQuestionnaireLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [loadQuestionnaires, mode])

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
      label: `周${WEEKDAY_LABELS[(Math.max(day.dayIndex, 1) - 1) % 7] || '-'}`,
      title: `第${day.dayIndex}天`,
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

  const getDayWeekLabel = (dayIndex: number) => `周${WEEKDAY_LABELS[(Math.max(dayIndex, 1) - 1) % 7] || '-'}`

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
      const parsedIntensity = parseIntensityValue(params.intensity, params.load)
      const parts = [
        params.sets ? `${params.sets}组` : '',
        params.reps ? `${params.reps}次` : '',
        parsedIntensity.mode === 'rm' && parsedIntensity.value ? `${parsedIntensity.value}RM` : '',
        parsedIntensity.mode === 'percentage' && parsedIntensity.value ? `${parsedIntensity.value}%` : '',
        parsedIntensity.mode === 'fixed' && params.load ? `${params.load}kg` : '',
        params.rest_seconds ? `${params.rest_seconds}s` : ''
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

  const updateDays = (updater: (days: PlanTrainingDay[]) => PlanTrainingDay[]) => {
    updateEditor((current) => ({
      ...current,
      days: normalizePlanDays(updater(current.days))
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
      })
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
      tags: parseTags(tagInput),
      weekDays: editor.weekDays?.length ? editor.weekDays : getTrainingWeekDays(editor.days),
      days: normalizePlanDays(editor.days)
    }
    await onSave(payload)
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
    const itemTypeOptions: PlanItemType[] = ['STRENGTH', 'CARDIO', 'DIET', 'HABIT']
    const itemTypeLabels = ['力量', '有氧', '饮食', '习惯']
    const currentItemTypeIndex = itemTypeOptions.indexOf(itemType)
    const params = actionSet.params || {}
    const customData = params.custom_data || {}
    const actionMeta = getItemMeta(itemType)
    const advancedKey = `${selectedDay.dayIndex}-${setIndex}`
    const advancedOpen = Boolean(advancedActionKeys[advancedKey])
    const currentAction = getActionBySet(actionSet)
    const autoLoadEnabled = itemType === 'STRENGTH' && isAutoLoadEligible(currentAction)
    const strengthPreview = itemType === 'STRENGTH' ? getStrengthPreview(actionSet) : null
    const parsedIntensity = itemType === 'STRENGTH' ? parseIntensityValue(params.intensity, params.load) : null
    const strengthControl = itemType === 'STRENGTH' ? getStrengthControlValue(params.intensity, params.load) : null
    const referenceOneRM = currentAction
      ? resolveReferenceOneRM(currentAction, editor.oneRMConfig, oneRMRecordIndex)
      : null
    const editableDisplayName = resolveEditableDisplayName(actionSet)
    const actionSummary = getActionSummaryText(actionSet)

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
          {actionOptions.length > 0 ? (
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
                  className='plan-editor__input'
                  type='number'
                  value={String(params.sets ?? '')}
                  onInput={(event) => {
                    updateActionSet(selectedDay.dayIndex, setIndex, (currentSet) => ({
                      ...currentSet,
                      params: {
                        ...(currentSet.params || {}),
                        sets: Number(event.detail.value || 0)
                      }
                    }))
                  }}
                />
              </View>
              <View className='plan-editor__field'>
                <Text className='plan-editor__label'>次数</Text>
                <Input
                  className='plan-editor__input'
                  value={String(params.reps ?? '')}
                  onInput={(event) => {
                    updateActionSet(selectedDay.dayIndex, setIndex, (currentSet) => ({
                      ...currentSet,
                      params: {
                        ...(currentSet.params || {}),
                        reps: event.detail.value
                      }
                    }))
                  }}
                />
              </View>
              <View className='plan-editor__field'>
                <Text className='plan-editor__label'>休息</Text>
                <Input
                  className='plan-editor__input'
                  type='number'
                  value={String(params.rest_seconds ?? '')}
                  onInput={(event) => {
                    updateActionSet(selectedDay.dayIndex, setIndex, (currentSet) => ({
                      ...currentSet,
                      params: {
                        ...(currentSet.params || {}),
                        rest_seconds: Number(event.detail.value || 0)
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
                        updateActionSet(selectedDay.dayIndex, setIndex, (currentSet) => ({
                          ...currentSet,
                          params: applyStrengthControlValue(currentSet.params || {}, {
                            mode: option.key as 'rm' | 'percentage' | 'fixed',
                            value: strengthControl?.mode === option.key ? strengthControl?.value || '' : ''
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
            <View className={`plan-editor__auto-load plan-editor__auto-load--${strengthPreview?.source || 'missing'}`}>
              <View className='plan-editor__auto-load-main'>
                <Text className='plan-editor__auto-load-label'>
                  {autoLoadEnabled ? '自动算重' : '重量信息'}
                </Text>
                <Text className='plan-editor__auto-load-value'>
                  {strengthPreview?.source === 'auto' && strengthPreview.value !== undefined
                    ? `${strengthPreview.value}${strengthPreview.unit || 'kg'}`
                    : strengthPreview?.source === 'manual' && strengthPreview.value !== undefined
                      ? `${strengthPreview.value}${strengthPreview.unit || 'kg'}`
                      : strengthPreview?.reason || '填写强度后显示自动算重'}
                </Text>
              </View>
              <Text className='plan-editor__auto-load-meta'>
                {strengthPreview?.source === 'auto'
                  ? `基于 ${strengthPreview.basis || ''}${referenceOneRM ? ` · 1RM ${referenceOneRM}kg` : ''}${bodyWeight ? ` · 体重 ${bodyWeight}kg` : ''}`
                  : strengthPreview?.source === 'manual'
                    ? '这组会按固定重量展示与执行'
                    : autoLoadEnabled
                      ? `当前识别：${parsedIntensity?.raw || '未设置强度'}`
                      : '当前动作未启用自动算重'}
              </Text>
            </View>

            {advancedOpen ? (
              <View className='plan-editor__grid plan-editor__grid--two plan-editor__advanced-grid'>
                {strengthControl?.mode !== 'fixed' ? (
                  <View className='plan-editor__field'>
                    <Text className='plan-editor__label'>{autoLoadEnabled ? '手动覆盖重量' : '重量(kg)'}</Text>
                    <Input
                      className='plan-editor__input'
                      type='digit'
                      value={String(params.load ?? '')}
                      placeholder={autoLoadEnabled ? '留空则按 1RM 自动计算' : '可留空'}
                      onInput={(event) => {
                        updateActionSet(selectedDay.dayIndex, setIndex, (currentSet) => ({
                          ...currentSet,
                          params: {
                            ...(currentSet.params || {}),
                            load: event.detail.value
                          }
                        }))
                      }}
                    />
                  </View>
                ) : null}
                <View className='plan-editor__field'>
                  <Text className='plan-editor__label'>自定义显示名称</Text>
                  <Input
                    className='plan-editor__input'
                    value={editableDisplayName}
                    placeholder='不填就直接显示动作名'
                    onInput={(event) => {
                      const value = event.detail.value
                      updateActionSet(selectedDay.dayIndex, setIndex, (currentSet) => ({
                        ...currentSet,
                        setName: value
                      }))
                    }}
                  />
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
            <View className='plan-editor__field plan-editor__field--full'>
              <Text className='plan-editor__label'>自定义显示名称</Text>
              <Input
                className='plan-editor__input'
                value={editableDisplayName}
                placeholder='不填就直接显示动作名'
                onInput={(event) => {
                  const value = event.detail.value
                  updateActionSet(selectedDay.dayIndex, setIndex, (currentSet) => ({
                    ...currentSet,
                    setName: value
                  }))
                }}
              />
            </View>
          </View>
        ) : null}
      </View>
    )
  }

  if (loading) {
    return (
      <View className='plan-editor page-with-nav'>
        <View className="plan-editor__loading"><LoadingSpinner size={48} /></View>
        {withBottomNav ? <BottomNav /> : null}
      </View>
    )
  }

  return (
    <View className={`plan-editor page-with-nav ${withBottomNav ? 'with-nav' : ''}`}>
      <ScrollView className='plan-editor__scroll' scrollY>
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
            <View className='plan-editor__field'>
              <Text className='plan-editor__label'>描述</Text>
              <Textarea
                className='plan-editor__textarea'
                value={editor.description}
                placeholder='补充计划目标、注意事项与执行提示'
                maxlength={600}
                autoHeight
                onInput={(event) => updateEditor((current) => ({ ...current, description: event.detail.value }))}
              />
            </View>
            {mode === 'coach-template' ? (
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
                  <Text className='plan-editor__label'>建议训练日</Text>
                  <View className='plan-editor__chip-row'>
                    {WEEKDAY_LABELS.map((label, index) => {
                      const value = index + 1
                      return (
                        <View
                          key={label}
                          className={`plan-editor__chip ${editor.weekDays.includes(value) ? 'active' : ''}`}
                          onClick={() => handleToggleWeekday(value)}
                        >
                          <Text>周{label}</Text>
                        </View>
                      )
                    })}
                  </View>
                </View>
              </>
            ) : null}
          </View>

          {mode === 'coach-template' ? (
            <View className='plan-editor__section'>
              <Text className='plan-editor__section-title'>问卷联动</Text>
              {questionnaireLoading ? (
                <LoadingSpinner size={40} />
              ) : questionnaires.length === 0 ? (
                <Text className='plan-editor__muted'>当前没有可联动的问题，后续可在问卷里补充。</Text>
              ) : (
                questionnaires.map((question, index) => {
                  const options = normalizeQuestionOptions(question)
                  if (options.length === 0) return null
                  const questionKey = String(question.question || question.id || `question-${index}`)
                  return (
                    <View key={questionKey} className='plan-editor__question-card'>
                      <Text className='plan-editor__question-title'>{question.question || `问题 ${index + 1}`}</Text>
                      <View className='plan-editor__chip-row'>
                        {options.map((option, optionIndex) => (
                          <View
                            key={`${questionKey}-${optionIndex}`}
                            className={`plan-editor__chip ${editor.globalAnswers[questionKey] === optionIndex ? 'active' : ''}`}
                            onClick={() => updateEditor((current) => ({
                              ...current,
                              globalAnswers: {
                                ...current.globalAnswers,
                                [questionKey]: optionIndex
                              }
                            }))}
                          >
                            <Text>{option.label}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )
                })
              )}
            </View>
          ) : null}

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
              caption={`当前选中 ${getDayWeekLabel(selectedDayIndex)} · 第 ${selectedDayIndex} 日`}
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
                    第 {selectedDay.dayIndex} 天 · {getDayWeekLabel(selectedDay.dayIndex)}
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
                      {[
                        { label: '力量', type: 'STRENGTH' as PlanItemType },
                        { label: '有氧', type: 'CARDIO' as PlanItemType },
                        { label: '饮食', type: 'DIET' as PlanItemType },
                        { label: '习惯', type: 'HABIT' as PlanItemType }
                      ].map((option) => (
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
              placeholder='粘贴训练计划文本，例如：周一 深蹲 5x5，周三 卧推 4x8...'
              maxlength={5000}
              onInput={(event) => setImportText(event.detail.value)}
            />
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
                    {WEEKDAY_LABELS.map((label, index) => {
                      const value = index + 1
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
                          <Text>周{label}</Text>
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
