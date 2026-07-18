import { formatKgValueForGym } from '@/utils/weightQuantize'
import { formatMonthDayWeekday } from '@/utils/dateFormat'

export type ExecutionStatus = 'none' | 'in_progress' | 'completed'
export type LightweightType = 'DIET' | 'CARDIO' | 'HABIT'
export type DayItemType = 'STRENGTH' | LightweightType

export interface NormalizedDayTask {
  index: number
  executionIndex: number
  actionId: string
  title: string
  itemType: DayItemType
  params: any
  customData: any
  noteText: string
  detailText: string
  demoVideoUrl?: string | null
  suggestedTime?: string | null
  executionItem?: any
  setCount: number
  completedSetCount: number
  isCompleted: boolean
  isStudentExtra?: boolean
}

export interface DayModuleModel {
  normalizedTasks: NormalizedDayTask[]
  strengthTasks: NormalizedDayTask[]
  lightweightTasks: NormalizedDayTask[]
  lightweightGroups: Array<{ slot: string; items: NormalizedDayTask[] }>
  moduleCount: number
  completedModuleCount: number
  remainingModuleCount: number
  dayCompleted: boolean
  strengthCompleted: boolean
  trainingCompleted: boolean
  trainingInProgress: boolean
  strengthCompletedSetCount: number
  strengthTotalSetCount: number
  lightweightCompletedCount: number
}

export interface PlanDayScheduleInfo {
  dayIndex: number
  baselineDate: Date
  displayDate: Date
  totalDelayDays: number
  delayAddedDays: number
  /** 被同日提前完成跨过的纯休息日不占用自然日，也不在学员日历展示。 */
  hidden?: boolean
}

export interface PostponedDateMarker {
  date: Date
  key: string
  targetDayIndex: number
  offset: number
}

export interface PlanScheduleModel {
  scheduleByDayIndex: Map<number, PlanDayScheduleInfo>
  /** 一个自然日可以承载多个已完成/进行中的训练 Day。 */
  dayIndexesByDateKey: Map<string, number[]>
  postponedDates: PostponedDateMarker[]
  postponedByDateKey: Map<string, PostponedDateMarker>
}

export const slotOrder = ['早晨', '中午', '下午', '晚上', '任意时间'] as const

export const parsePositiveIntOrNull = (value: any) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.floor(n)
}

export const getTimeSlotLabel = (time?: string | null) => {
  if (!time) return '任意时间'
  const match = String(time).match(/(\d{1,2})/)
  const hour = match ? Number(match[1]) : NaN
  if (!Number.isFinite(hour)) return '任意时间'
  if (hour < 11) return '早晨'
  if (hour < 14) return '中午'
  if (hour < 18) return '下午'
  return '晚上'
}

export const getTaskItemType = (
  actionSet: any,
  action: any,
  executionItem?: any
): DayItemType => {
  const rawType = String(
    executionItem?.item_type ||
      executionItem?.type ||
      actionSet?.itemType ||
      action?.type ||
      'STRENGTH'
  ).toUpperCase()

  if (rawType === 'DIET' || rawType === 'CARDIO' || rawType === 'HABIT') {
    return rawType
  }
  return 'STRENGTH'
}

export const buildStrengthMeta = (task: NormalizedDayTask) => {
  const params = task.params || {}
  const sets = task.setCount || 1
  const reps = parsePositiveIntOrNull(params['次数'])
  const durationSeconds = parsePositiveIntOrNull(params['持续时间'])
  const secondPart = durationSeconds !== null ? `${durationSeconds}秒` : reps !== null ? `${reps}次` : '自选'

  const load = params.load
  const intensity = params['强度']
  const intensityConfig = params.intensityConfig
  const relativeIntensity = intensityConfig?.relativeIntensity

  let loadText: string | null = null
  if (load !== null && load !== undefined) {
    if (typeof load === 'string' && load.trim().length > 0 && /kg|rm|%/i.test(load)) {
      loadText = load.trim()
    } else {
      const numericLoad = Number(load)
      if (Number.isFinite(numericLoad)) {
        if (numericLoad < 0) {
          loadText = `辅助${formatKgValueForGym(Math.abs(numericLoad))}kg`
        } else if (numericLoad > 0) {
          loadText = `${formatKgValueForGym(numericLoad)}kg`
        }
      }
    }
  }

  if (!loadText && relativeIntensity?.value && relativeIntensity.value > 0) {
    const suffix = relativeIntensity.type === 'percentage' ? '%' : 'RM'
    loadText = `${relativeIntensity.value}${suffix}`
  }

  if (!loadText && intensity && intensity > 0) {
    loadText = `${intensity}RM`
  }

  const restSeconds = params['休息时间'] ?? params.rest_seconds
  return {
    summary: `${sets}组 × ${secondPart}`,
    loadText,
    restText: restSeconds ? `休息${(Number(restSeconds) / 60).toFixed(1)}分钟` : null
  }
}

export const buildLightweightSummary = (task: NormalizedDayTask) => {
  const { itemType, customData, detailText, suggestedTime } = task
  switch (itemType) {
    case 'DIET':
      return {
        accentClass: 'diet',
        icon: '🥗',
        summary: customData.content || detailText || '按建议饮食执行',
        extra: suggestedTime ? `建议时间 ${suggestedTime}` : '轻量记录，完成即可打卡',
        actionLabel: task.isCompleted ? '查看记录' : '记录饮食'
      }
    case 'CARDIO':
      return {
        accentClass: 'cardio',
        icon: '🏃',
        summary: [
          customData.duration ? `${(Number(customData.duration) / 60).toFixed(0)}分钟` : null,
          customData.distance ? `${(Number(customData.distance) / 1000).toFixed(1)}km` : null,
          customData.pace ? `配速 ${customData.pace}` : null,
          !customData.duration && !customData.distance ? detailText || '完成有氧任务' : null
        ]
          .filter(Boolean)
          .join(' · '),
        extra: suggestedTime ? `建议时间 ${suggestedTime}` : '完成后记录距离或时长',
        actionLabel: task.isCompleted ? '查看记录' : '记录有氧'
      }
    case 'HABIT':
    default:
      return {
        accentClass: 'habit',
        icon: '✅',
        summary: customData.habit_name || detailText || '完成习惯打卡',
        extra: customData.target_duration
          ? `目标 ${customData.target_duration} 分钟`
          : suggestedTime
            ? `建议时间 ${suggestedTime}`
            : '完成即可打卡',
        actionLabel: task.isCompleted ? '查看记录' : '立即打卡'
      }
  }
}

export const buildDayModuleModel = (params: {
  day: any
  actions: Record<string, any>
  execution?: any
  executionStatus?: ExecutionStatus
}): DayModuleModel => {
  const { day, actions, execution, executionStatus = 'none' } = params

  const actionSets = (day?.actionSets || []) as any[]
  const executionActions = Array.isArray(execution?.action_executions) ? execution.action_executions : []
  const executionBySourceIndex = new Map<number, any>()
  const executionIndexBySourceIndex = new Map<number, number>()

  executionActions.forEach((item: any, index: number) => {
    const sourceIndex = Number.isInteger(item?.source_action_index) ? Number(item.source_action_index) : index
    if (!executionBySourceIndex.has(sourceIndex)) {
      executionBySourceIndex.set(sourceIndex, item)
      executionIndexBySourceIndex.set(sourceIndex, index)
    }
  })

  const plannedExecutionActions = executionActions.filter((item: any) => item?.source !== 'student_extra')
  const executionMatchesCurrentPlan =
    plannedExecutionActions.length === actionSets.length &&
    actionSets.every((actionSet: any, index: number) => {
      const executionItem = executionBySourceIndex.get(index) ?? plannedExecutionActions[index]
      if (!executionItem) return false
      const planActionId = String(actionSet?.action_id || actionSet?.actionId || '')
      const executionActionId = String(executionItem?.action_id || '')
      const planSetCount = parsePositiveIntOrNull(actionSet?.params?.['组数'] ?? actionSet?.sets) ?? 1
      const executionSetCount =
        typeof executionItem?.total_sets === 'number'
          ? executionItem.total_sets
          : Array.isArray(executionItem?.sets)
            ? executionItem.sets.length
            : 1
      return (!planActionId || !executionActionId || planActionId === executionActionId) &&
        planSetCount === executionSetCount
    })
  const useExecutionSnapshot = executionActions.length > 0 && !executionMatchesCurrentPlan

  const planTasks: NormalizedDayTask[] = actionSets.map((actionSet: any, index: number) => {
    const actionId = actionSet.action_id || actionSet.actionId || ''
    const action = actions[actionId]
    const executionItem = executionBySourceIndex.get(index) ?? executionActions[index]
    const executionIndex = executionIndexBySourceIndex.get(index) ?? index
    const itemType = getTaskItemType(actionSet, action, executionItem)
    const paramsData = actionSet.params || {}
    const customData = paramsData.custom_data || {}
    const setCount =
      typeof executionItem?.total_sets === 'number'
        ? executionItem.total_sets
        : parsePositiveIntOrNull(paramsData['组数'] ?? actionSet.sets) ?? 1
    const completedSetCount =
      typeof executionItem?.completed_sets === 'number'
        ? executionItem.completed_sets
        : (executionItem?.sets || []).filter((set: any) => set?.status === 'completed').length
    const isTaskCompleted = executionItem
      ? executionItem?.completed_sets === executionItem?.total_sets ||
        executionItem?.status === 'completed' ||
        executionItem?.completed === true
      : false

    return {
      index,
      executionIndex,
      actionId,
      title: action?.name || actionSet.set_name || '未命名任务',
      itemType,
      params: paramsData,
      customData,
      noteText: String(paramsData.note || actionSet.note || '').trim(),
      detailText: String(action?.detail || '').trim(),
      demoVideoUrl: action?.url || action?.video_url || null,
      suggestedTime: paramsData.suggested_time || action?.suggested_time || null,
      executionItem,
      setCount,
      completedSetCount,
      isCompleted: isTaskCompleted,
      isStudentExtra: executionItem?.source === 'student_extra'
    }
  })

  const snapshotTasks: NormalizedDayTask[] = executionActions.map((executionItem: any, executionIndex: number) => {
    const actionId = executionItem?.action_id || executionItem?.source_action_id || ''
    const action = actions[actionId]
    const itemType = getTaskItemType(null, action, executionItem)
    const sets = Array.isArray(executionItem?.sets) ? executionItem.sets : []
    const firstSet = sets[0] || {}
    const setCount =
      typeof executionItem?.total_sets === 'number'
        ? executionItem.total_sets
        : Math.max(1, sets.length)
    const completedSetCount =
      typeof executionItem?.completed_sets === 'number'
        ? executionItem.completed_sets
        : sets.filter((set: any) => set?.status === 'completed').length
    const paramsData = executionItem?.params || {
      组数: setCount,
      次数: firstSet?.planned_reps ?? null,
      load: firstSet?.planned_weight ?? null,
      休息时间: firstSet?.planned_rest_seconds ?? null
    }
    const customData = executionItem?.custom_data || paramsData?.custom_data || {}
    const isTaskCompleted =
      completedSetCount >= setCount ||
      executionItem?.status === 'completed' ||
      executionItem?.completed === true

    return {
      index: Number.isInteger(executionItem?.source_action_index)
        ? Number(executionItem.source_action_index)
        : executionIndex,
      executionIndex,
      actionId,
      title: executionItem?.action_name || action?.name || '未命名任务',
      itemType,
      params: paramsData,
      customData,
      noteText: String(executionItem?.notes || '').trim(),
      detailText: String(executionItem?.detail || action?.detail || '').trim(),
      demoVideoUrl: action?.url || action?.video_url || null,
      suggestedTime: executionItem?.suggested_time || action?.suggested_time || null,
      executionItem,
      setCount,
      completedSetCount,
      isCompleted: isTaskCompleted,
      isStudentExtra: executionItem?.source === 'student_extra'
    }
  })

  const normalizedTasks = useExecutionSnapshot ? snapshotTasks : planTasks

  const extraExecutionTasks: NormalizedDayTask[] = executionActions
    .map((executionItem: any, executionIndex: number) => {
      const isStudentExtra =
        executionItem?.source === 'student_extra' || (!!executionItem?.source_action_id && !executionItem?.source)
      if (!isStudentExtra) return null

      const actionId = executionItem?.action_id || executionItem?.source_action_id || ''
      const action = actions[actionId]
      const itemType = getTaskItemType(null, action, executionItem)
      const customData = executionItem?.custom_data || executionItem?.params?.custom_data || {}
      const setCount =
        typeof executionItem?.total_sets === 'number'
          ? executionItem.total_sets
          : Array.isArray(executionItem?.sets)
            ? executionItem.sets.length
            : 1
      const completedSetCount =
        typeof executionItem?.completed_sets === 'number'
          ? executionItem.completed_sets
          : Array.isArray(executionItem?.sets)
            ? executionItem.sets.filter((set: any) => set?.status === 'completed').length
            : executionItem?.completed
              ? 1
              : 0
      const isTaskCompleted = executionItem
        ? executionItem?.completed_sets === executionItem?.total_sets ||
          executionItem?.status === 'completed' ||
          executionItem?.completed === true
        : false

      return {
        index: executionIndex,
        executionIndex,
        actionId,
        title: action?.name || executionItem?.action_name || '未命名任务',
        itemType,
        params: executionItem?.params || {},
        customData,
        noteText: String(executionItem?.notes || '').trim(),
        detailText: String(action?.detail || executionItem?.detail || '').trim(),
        demoVideoUrl: action?.url || action?.video_url || null,
        suggestedTime: executionItem?.suggested_time || action?.suggested_time || null,
        executionItem,
        setCount,
        completedSetCount,
        isCompleted: isTaskCompleted,
        isStudentExtra: true
      }
    })
    .filter(Boolean) as NormalizedDayTask[]

  const mergedTasks = useExecutionSnapshot
    ? normalizedTasks
    : [...normalizedTasks, ...extraExecutionTasks]
  const strengthTasks = mergedTasks.filter((task) => task.itemType === 'STRENGTH')
  const lightweightTasks = mergedTasks.filter((task) => task.itemType !== 'STRENGTH')
  const strengthCompleted = strengthTasks.length > 0 && strengthTasks.every((task) => task.isCompleted)
  const trainingCompleted = strengthTasks.length > 0 && (strengthCompleted || executionStatus === 'completed')
  const trainingInProgress = strengthTasks.length > 0 && !trainingCompleted && executionStatus === 'in_progress'
  const strengthCompletedSetCount = strengthTasks.reduce((sum, task) => sum + task.completedSetCount, 0)
  const strengthTotalSetCount = strengthTasks.reduce((sum, task) => sum + task.setCount, 0)
  const lightweightCompletedCount = lightweightTasks.filter((task) => task.isCompleted).length
  const moduleCount = (strengthTasks.length > 0 ? 1 : 0) + lightweightTasks.length
  const completedModuleCount = (trainingCompleted ? 1 : 0) + lightweightCompletedCount
  const remainingModuleCount = Math.max(0, moduleCount - completedModuleCount)
  const dayCompleted = moduleCount > 0 && completedModuleCount >= moduleCount

  const groups = new Map<string, NormalizedDayTask[]>()
  lightweightTasks.forEach((task) => {
    const slot = getTimeSlotLabel(task.suggestedTime)
    if (!groups.has(slot)) groups.set(slot, [])
    groups.get(slot)?.push(task)
  })

  const lightweightGroups = slotOrder
    .map((slot) => ({ slot, items: groups.get(slot) || [] }))
    .filter((group) => group.items.length > 0)

  return {
    normalizedTasks: mergedTasks,
    strengthTasks,
    lightweightTasks,
    lightweightGroups,
    moduleCount,
    completedModuleCount,
    remainingModuleCount,
    dayCompleted,
    strengthCompleted,
    trainingCompleted,
    trainingInProgress,
    strengthCompletedSetCount,
    strengthTotalSetCount,
    lightweightCompletedCount
  }
}

const startOfDay = (value: string | Date) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

const diffCalendarDays = (left: Date, right: Date) => {
  const leftTime = startOfDay(left).getTime()
  const rightTime = startOfDay(right).getTime()
  return Math.floor((leftTime - rightTime) / (24 * 60 * 60 * 1000))
}

export const addDays = (dateValue: string | Date, offset: number) => {
  const date = startOfDay(dateValue)
  date.setDate(date.getDate() + offset)
  return date
}

export const resolvePlanDayDate = (params: {
  dayIndex: number
  effectiveStartDate?: string | Date | null
  fallbackAnchorDayIndex?: number
  fallbackAnchorDate?: Date
}) => {
  const {
    dayIndex,
    effectiveStartDate,
    fallbackAnchorDayIndex = 1,
    fallbackAnchorDate = new Date()
  } = params

  if (effectiveStartDate) {
    return addDays(effectiveStartDate, dayIndex - 1)
  }

  const anchor = startOfDay(fallbackAnchorDate)
  return addDays(anchor, dayIndex - fallbackAnchorDayIndex)
}

const getExecutionAnchorDate = (execution?: any) => {
  if (!execution) return null
  const status = String(execution?.status || '').toLowerCase()
  const ts =
    status === 'completed'
      ? execution?.completed_at || execution?.started_at
      : status === 'abandoned'
        ? execution?.completed_at || execution?.updated_at || execution?.started_at
        : status === 'in_progress'
          ? execution?.started_at
          : null
  return ts ? startOfDay(ts) : null
}

export const buildPlanScheduleModel = (params: {
  trainingDays: any[]
  executionsByDayIndex?: Record<number, any>
  effectiveStartDate?: string | Date | null
  progressDayIndex?: number
  startExecutionDay?: number
  fallbackAnchorDayIndex?: number
  fallbackAnchorDate?: Date
  today?: Date
}): PlanScheduleModel => {
  const {
    trainingDays,
    executionsByDayIndex = {},
    effectiveStartDate,
    progressDayIndex,
    startExecutionDay = 1,
    fallbackAnchorDayIndex = progressDayIndex || 1,
    fallbackAnchorDate = new Date(),
    today = new Date()
  } = params

  const scheduleByDayIndex = new Map<number, PlanDayScheduleInfo>()
  const dayIndexesByDateKey = new Map<string, number[]>()
  const postponedDates: PostponedDateMarker[] = []
  const postponedByDateKey = new Map<string, PostponedDateMarker>()
  const todayStart = startOfDay(today)

  const sortedDays = [...(trainingDays || [])].sort((a, b) => {
    const left = Number(a?.dayIndex ?? a?.day_index ?? 0)
    const right = Number(b?.dayIndex ?? b?.day_index ?? 0)
    return left - right
  })

  const executionStartDay = Math.max(1, Number(startExecutionDay || 1))
  const normalizedProgressDay = Math.max(executionStartDay, Number(progressDayIndex || executionStartDay))

  const addDateBucketDay = (date: Date, dayIndex: number) => {
    const key = toDateKey(date)
    const indexes = dayIndexesByDateKey.get(key) || []
    if (!indexes.includes(dayIndex)) {
      indexes.push(dayIndex)
      indexes.sort((left, right) => left - right)
    }
    dayIndexesByDateKey.set(key, indexes)
  }

  const setScheduleDay = (day: any, displayDate: Date, options?: { hidden?: boolean; delayAddedDays?: number }) => {
    const dayIndex = Number(day?.dayIndex ?? day?.day_index ?? 0)
    if (!Number.isFinite(dayIndex) || dayIndex <= 0) return
    const baselineDate = resolvePlanDayDate({
      dayIndex,
      effectiveStartDate,
      fallbackAnchorDayIndex,
      fallbackAnchorDate
    })
    scheduleByDayIndex.set(dayIndex, {
      dayIndex,
      baselineDate,
      displayDate,
      delayAddedDays: options?.delayAddedDays || 0,
      // 顺延只表示向后推迟，不允许把提前执行显示成负顺延。
      totalDelayDays: Math.max(0, diffCalendarDays(displayDate, baselineDate)),
      hidden: !!options?.hidden
    })
    if (!options?.hidden) addDateBucketDay(displayDate, dayIndex)
  }

  const addPostponedRange = (fromDate: Date, untilDate: Date, targetDayIndex: number) => {
    let cursor = startOfDay(fromDate)
    let offset = 1
    while (diffCalendarDays(untilDate, cursor) > 0) {
      const key = toDateKey(cursor)
      if (!postponedByDateKey.has(key) && !dayIndexesByDateKey.has(key)) {
        const marker: PostponedDateMarker = { date: cursor, key, targetDayIndex, offset }
        postponedByDateKey.set(key, marker)
        postponedDates.push(marker)
      }
      cursor = addDays(cursor, 1)
      offset += 1
    }
    return offset - 1
  }

  // 执行起点之前仍按原始计划日期展示，不参与后续的动态压缩。
  sortedDays
    .filter((day) => Number(day?.dayIndex ?? day?.day_index ?? 0) < executionStartDay)
    .forEach((day) => {
      const dayIndex = Number(day?.dayIndex ?? day?.day_index ?? 0)
      setScheduleDay(day, resolvePlanDayDate({
        dayIndex,
        effectiveStartDate,
        fallbackAnchorDayIndex,
        fallbackAnchorDate
      }))
    })

  const activeDays = sortedDays.filter(
    (day) => Number(day?.dayIndex ?? day?.day_index ?? 0) >= executionStartDay
  )
  const anchorPositions = activeDays
    .map((day, position) => ({ day, position, date: getExecutionAnchorDate(executionsByDayIndex?.[Number(day?.dayIndex ?? day?.day_index ?? 0)]) }))
    .filter((entry): entry is { day: any; position: number; date: Date } => !!entry.date)

  let cursorDate = resolvePlanDayDate({
    dayIndex: executionStartDay,
    effectiveStartDate,
    fallbackAnchorDayIndex,
    fallbackAnchorDate
  })
  let cursorPosition = 0

  anchorPositions.forEach((anchor) => {
    const anchorDayIndex = Number(anchor.day?.dayIndex ?? anchor.day?.day_index ?? 0)
    const segment = activeDays.slice(cursorPosition, anchor.position)
    let availableSlots = Math.max(0, diffCalendarDays(anchor.date, cursorDate))

    segment.forEach((day, segmentIndex) => {
      const dayIndex = Number(day?.dayIndex ?? day?.day_index ?? 0)
      const isRestDay = String(day?.type || 'training').toLowerCase() === 'rest'
      const remainingTrainingDays = segment
        .slice(segmentIndex + 1)
        .filter((entry) => String(entry?.type || 'training').toLowerCase() === 'training').length
      const canOccupyDate = availableSlots > remainingTrainingDays

      if (isRestDay && !canOccupyDate) {
        // 提前完成后跨过的休息日没有独立自然日可占，逻辑上保留、日历上隐藏。
        setScheduleDay(day, anchor.date, { hidden: true })
        return
      }

      if (availableSlots > 0) {
        setScheduleDay(day, cursorDate)
        cursorDate = addDays(cursorDate, 1)
        availableSlots -= 1
        return
      }

      // 异常旧数据中若缺少中间训练执行，不再覆盖后一个 Day；聚合到真实执行日供用户追溯。
      setScheduleDay(day, anchor.date)
    })

    const delayAddedDays = addPostponedRange(cursorDate, anchor.date, anchorDayIndex)
    setScheduleDay(anchor.day, anchor.date, { delayAddedDays })
    if (diffCalendarDays(anchor.date, cursorDate) >= 0) {
      cursorDate = addDays(anchor.date, 1)
    }
    cursorPosition = anchor.position + 1
  })

  const trailingDays = activeDays.slice(cursorPosition)
  trailingDays.forEach((day) => {
    const dayIndex = Number(day?.dayIndex ?? day?.day_index ?? 0)
    const isRestDay = String(day?.type || 'training').toLowerCase() === 'rest'

    let delayAddedDays = 0
    if (dayIndex === normalizedProgressDay && !isRestDay && diffCalendarDays(todayStart, cursorDate) > 0) {
      delayAddedDays = addPostponedRange(cursorDate, todayStart, dayIndex)
      cursorDate = todayStart
    }
    setScheduleDay(day, cursorDate, { delayAddedDays })
    cursorDate = addDays(cursorDate, 1)
  })

  return {
    scheduleByDayIndex,
    dayIndexesByDateKey,
    postponedDates,
    postponedByDateKey
  }
}

/** 与 execution/start 保持一致：当前进度为连续休息日时，可直接训练后面的第一个训练日。 */
export const canOpenPlanDayForExecution = (params: {
  trainingDays: any[]
  progressDayIndex: number
  targetDayIndex: number
}) => {
  const { trainingDays, progressDayIndex, targetDayIndex } = params
  if (targetDayIndex === progressDayIndex) return true
  if (targetDayIndex < progressDayIndex) return false

  const remainingDays = [...(trainingDays || [])]
    .filter((day) => Number(day?.dayIndex ?? day?.day_index ?? 0) >= progressDayIndex)
    .sort((left, right) => Number(left?.dayIndex ?? left?.day_index ?? 0) - Number(right?.dayIndex ?? right?.day_index ?? 0))
  const firstTrainingDay = remainingDays.find(
    (day) => String(day?.type || 'training').toLowerCase() === 'training'
  )
  if (Number(firstTrainingDay?.dayIndex ?? firstTrainingDay?.day_index ?? 0) !== targetDayIndex) return false

  return remainingDays
    .filter((day) => {
      const dayIndex = Number(day?.dayIndex ?? day?.day_index ?? 0)
      return dayIndex >= progressDayIndex && dayIndex < targetDayIndex
    })
    .every((day) => String(day?.type || 'training').toLowerCase() !== 'training')
}

export const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const formatPlanDayLabel = (date: Date | null) => {
  return formatMonthDayWeekday(date)
}
