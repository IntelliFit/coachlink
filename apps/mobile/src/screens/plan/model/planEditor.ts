// 移植自小程序 apps/wechat/src/utils/planEditor.ts，保持同一套计划数据语义；修改时两边同步。
import type { PlanActionOption, PlanActionSet, PlanEditorValue, PlanItemType, PlanQuestionItem, PlanTrainingDay } from './planTypes'
import { isOneRMEligibleAction } from '@coachlink/core/src/actionLoadMode'

export interface PlanBatchResult {
  days: PlanTrainingDay[]
  affectedSets: number
  affectedDays: number
}

export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
export const SUITABLE_FOR_LABELS: Record<PlanEditorValue['suitableFor'], string> = {
  beginner: '初级',
  intermediate: '中级',
  advanced: '高级'
}

export const normalizeItemType = (type?: string | null): PlanItemType => {
  const normalized = String(type || 'STRENGTH').trim().toUpperCase()
  if (normalized === 'DIET' || normalized === 'CARDIO' || normalized === 'HABIT') {
    return normalized
  }
  return 'STRENGTH'
}

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

export const createDefaultPlanDays = (weeks = 1, mode: 'coach' | 'student' = 'student'): PlanTrainingDay[] => {
  const totalDays = Math.max(1, weeks) * 7
  return Array.from({ length: totalDays }, (_, index) => {
    const dayOfWeek = index % 7
    const isWeekendRest = mode === 'coach' ? dayOfWeek >= 5 : dayOfWeek >= 5
    return {
      dayIndex: index + 1,
      type: isWeekendRest ? 'rest' : 'training',
      note: '',
      actionSets: [],
      actionSetsCount: 0
    }
  })
}

export const normalizePlanDays = (days: any[] | undefined | null): PlanTrainingDay[] => {
  if (!Array.isArray(days) || days.length === 0) return createDefaultPlanDays(1)
  return days
    .map((day, index) => ({
      ...day,
      dayIndex: Number(day?.dayIndex || day?.day_index || index + 1),
      type: String(day?.type || 'training') === 'rest' ? 'rest' : 'training',
      note: String(day?.note || ''),
      actionSets: Array.isArray(day?.actionSets)
        ? deepClone(day.actionSets)
        : Array.isArray(day?.action_sets)
          ? deepClone(day.action_sets)
          : [],
    }))
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .map((day) => ({
      ...day,
      actionSetsCount: Array.isArray(day.actionSets) ? day.actionSets.length : 0
    }))
}

export const buildDefaultParams = (itemType: PlanItemType) => {
  switch (itemType) {
    case 'DIET':
      return {
        suggested_time: '08:00',
        custom_data: {
          content: '',
          calories: 0
        }
      }
    case 'CARDIO':
      return {
        custom_data: {
          content: '',
          duration: 30 * 60,
          distance: 0,
          pace: 0
        }
      }
    case 'HABIT':
      return {
        custom_data: {
          habit_name: '',
          target_duration: 10
        }
      }
    case 'STRENGTH':
    default:
      return {
        sets: 3,
        reps: '10',
        intensity: '',
        rest_seconds: 90,
        load: ''
      }
  }
}

export const createActionSet = (itemType: PlanItemType = 'STRENGTH', action?: PlanActionOption | null): PlanActionSet => ({
  type: 'no-filter',
  itemType,
  actionId: action?.id || '',
  actionName: action?.name || '',
  setName:
    itemType === 'DIET'
      ? '饮食建议'
      : itemType === 'CARDIO'
        ? '有氧安排'
        : itemType === 'HABIT'
          ? '习惯打卡'
          : '',
  params: buildDefaultParams(itemType)
})

export const chunkDaysByWeek = (days: PlanTrainingDay[]) => {
  const normalized = normalizePlanDays(days)
  const weeks: PlanTrainingDay[][] = []
  for (let index = 0; index < normalized.length; index += 7) {
    weeks.push(normalized.slice(index, index + 7))
  }
  return weeks
}

export const cloneWeekToTail = (days: PlanTrainingDay[], weekIndex: number) => {
  const weeks = chunkDaysByWeek(days)
  const targetWeek = weeks[weekIndex]
  if (!targetWeek) return normalizePlanDays(days)
  const nextDays = normalizePlanDays(days)
  const currentLength = nextDays.length
  targetWeek.forEach((day, offset) => {
    nextDays.push({
      ...deepClone(day),
      dayIndex: currentLength + offset + 1,
      actionSetsCount: Array.isArray(day.actionSets) ? day.actionSets.length : 0
    })
  })
  return nextDays
}

export const addEmptyWeek = (days: PlanTrainingDay[]) => {
  const nextDays = normalizePlanDays(days)
  const currentLength = nextDays.length
  for (let index = 0; index < 7; index += 1) {
    const dayOfWeek = index % 7
    nextDays.push({
      dayIndex: currentLength + index + 1,
      type: dayOfWeek >= 5 ? 'rest' : 'training',
      note: '',
      actionSets: [],
      actionSetsCount: 0
    })
  }
  return nextDays
}

export const deleteWeekAt = (days: PlanTrainingDay[], weekIndex: number) => {
  const nextDays = normalizePlanDays(days)
  if (nextDays.length <= 7) return nextDays
  const start = weekIndex * 7
  const trimmed = nextDays.filter((_, index) => index < start || index >= start + 7)
  return trimmed.map((day, index) => ({
    ...day,
    dayIndex: index + 1
  }))
}

export const getActionIdFromSet = (set?: PlanActionSet | null) =>
  String(set?.actionId || set?.action_id || '').trim()

export const getActionNameFromSet = (set?: PlanActionSet | null) =>
  String(
    set?.actionName ||
    set?.action_name ||
    set?.setName ||
    set?.set_name ||
    set?.group_title ||
    ''
  ).trim()

export const resolveActionDisplayName = (set: PlanActionSet, actions: PlanActionOption[]) => {
  const actionId = getActionIdFromSet(set)
  if (actionId) {
    const matched = actions.find((action) => String(action.id) === actionId)
    if (matched?.name) return matched.name
  }
  return getActionNameFromSet(set) || '未选择动作'
}

export const collectRelevantActions = (days: PlanTrainingDay[], actions: PlanActionOption[]) => {
  const actionIds = new Set<string>()
  normalizePlanDays(days).forEach((day) => {
    ;(day.actionSets || []).forEach((set) => {
      if (set.type === 'one-filter' && Array.isArray(set.actions)) {
        set.actions.forEach((innerSet) => {
          const actionId = getActionIdFromSet(innerSet)
          if (actionId) actionIds.add(actionId)
        })
        return
      }
      const actionId = getActionIdFromSet(set)
      if (actionId) actionIds.add(actionId)
    })
  })
  return actions.filter((action) => actionIds.has(String(action.id)))
}

export const collectOneRMActions = (days: PlanTrainingDay[], actions: PlanActionOption[]) => {
  return collectRelevantActions(days, actions).filter((action) => isOneRMEligibleAction(action))
}

export const getTrainingWeekDays = (days: PlanTrainingDay[]) => {
  const weekdays = new Set<number>()
  normalizePlanDays(days).forEach((day) => {
    if (day.type !== 'training') return
    weekdays.add(((day.dayIndex - 1) % 7) + 1)
  })
  return Array.from(weekdays).sort((a, b) => a - b)
}

export const normalizeQuestionOptions = (question: PlanQuestionItem) => {
  const options = Array.isArray(question.options) ? question.options : []
  return options.map((option) => {
    if (typeof option === 'string') {
      return { label: option, value: option }
    }
    return {
      label: String(option?.label || option?.text || option?.value || '选项'),
      value: option?.value ?? option?.label ?? option?.text ?? ''
    }
  })
}

export const applyReplaceAction = (
  days: PlanTrainingDay[],
  fromActionId: string,
  toAction: PlanActionOption | null | undefined
): PlanBatchResult => {
  let affectedSets = 0
  let affectedDays = 0
  const nextDays = normalizePlanDays(days).map((day) => {
    let dayChanged = false
    const actionSets = (day.actionSets || []).map((set) => {
      if (set.type === 'one-filter' && Array.isArray(set.actions)) {
        const nextInner = set.actions.map((innerSet) => {
          if (getActionIdFromSet(innerSet) !== fromActionId) return innerSet
          affectedSets += 1
          dayChanged = true
          return {
            ...innerSet,
            actionId: toAction?.id || '',
            actionName: toAction?.name || ''
          }
        })
        return { ...set, actions: nextInner }
      }
      if (getActionIdFromSet(set) !== fromActionId) return set
      affectedSets += 1
      dayChanged = true
      return {
        ...set,
        actionId: toAction?.id || '',
        actionName: toAction?.name || ''
      }
    })
    if (dayChanged) {
      affectedDays += 1
      return { ...day, actionSets, actionSetsCount: actionSets.length }
    }
    return day
  })
  return { days: nextDays, affectedSets, affectedDays }
}

export const applyDeleteAction = (
  days: PlanTrainingDay[],
  actionId: string
): PlanBatchResult => {
  let affectedSets = 0
  let affectedDays = 0
  const nextDays = normalizePlanDays(days).map((day) => {
    const nextSets = (day.actionSets || []).filter((set) => {
      if (set.type === 'one-filter' && Array.isArray(set.actions)) {
        const shouldRemove = set.actions.some((innerSet) => getActionIdFromSet(innerSet) === actionId)
        if (shouldRemove) affectedSets += 1
        return !shouldRemove
      }
      const shouldRemove = getActionIdFromSet(set) === actionId
      if (shouldRemove) affectedSets += 1
      return !shouldRemove
    })
    if (nextSets.length !== (day.actionSets || []).length) {
      affectedDays += 1
      return { ...day, actionSets: nextSets, actionSetsCount: nextSets.length }
    }
    return day
  })
  return { days: nextDays, affectedSets, affectedDays }
}

export const applyAppendAction = (
  days: PlanTrainingDay[],
  action: PlanActionOption,
  weekStart: number,
  weekEnd: number,
  weekdays: number[]
): PlanBatchResult => {
  let affectedSets = 0
  let affectedDays = 0
  const weekdaySet = new Set(weekdays)
  const nextDays = normalizePlanDays(days).map((day) => {
    const week = Math.ceil(day.dayIndex / 7)
    const weekday = ((day.dayIndex - 1) % 7) + 1
    if (day.type !== 'training') return day
    if (week < weekStart || week > weekEnd) return day
    if (!weekdaySet.has(weekday)) return day
    const nextSet = createActionSet(normalizeItemType(action.type), action)
    const actionSets = [...(day.actionSets || []), nextSet]
    affectedSets += 1
    affectedDays += 1
    return {
      ...day,
      actionSets,
      actionSetsCount: actionSets.length
    }
  })
  return { days: nextDays, affectedSets, affectedDays }
}

export const buildExecutionSummary = (
  days: PlanTrainingDay[],
  executions: Record<number, { status?: string } | undefined>
) => {
  const normalizedDays = normalizePlanDays(days)
  const totalDays = normalizedDays.length
  const trainingDays = normalizedDays.filter((day) => day.type === 'training').length
  const completedDays = Object.values(executions || {}).filter((item) => item?.status === 'completed').length
  const pausedDays = Object.values(executions || {}).filter((item) => item?.status === 'paused').length
  return {
    totalDays,
    trainingDays,
    completedDays,
    pausedDays,
    completionRate: trainingDays > 0 ? Math.round((completedDays / trainingDays) * 100) : 0
  }
}
