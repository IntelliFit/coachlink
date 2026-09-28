import { addBeijingDays, diffBeijingCalendarDays, getBeijingDayStart, toBeijingDateKey } from './beijingTime'
import { executionTrainingTimestamp, isCalendarDate } from './completionDate'

export interface PlanDayScheduleInfo {
  dayIndex: number
  baselineDate: Date
  displayDate: Date
  totalDelayDays: number
  delayAddedDays: number
  /** 被同日提前完成跨过的纯休息日不占用自然日，也不在学员日历展示。 */
  hidden?: boolean
  dateNeedsReview?: boolean
  /** Arrangement projection only; never persisted as the actual workout date. */
  dateEstimated?: boolean
  recordedDate?: Date
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
    return addBeijingDays(effectiveStartDate, dayIndex - 1)
  }

  const anchor = getBeijingDayStart(fallbackAnchorDate)
  return addBeijingDays(anchor, dayIndex - fallbackAnchorDayIndex)
}

const getExecutionAnchorDate = (execution?: any) => {
  if (!execution) return null
  const status = String(execution?.status || '').toLowerCase()
  if (execution.close_reason === 'superseded_by_late_completion') return null
  const ts =
    status === 'completed'
      ? executionTrainingTimestamp(execution) || execution?.started_at
      : status === 'abandoned'
        ? execution?.completed_at || execution?.updated_at || execution?.started_at
        : null
  return ts ? getBeijingDayStart(ts) : null
}

export const buildPlanScheduleModel = (params: {
  trainingDays: any[]
  executionsByDayIndex?: Record<number, any>
  completionDates?: Record<number, string>
  effectiveStartDate?: string | Date | null
  progressDayIndex?: number
  startExecutionDay?: number
  fallbackAnchorDayIndex?: number
  fallbackAnchorDate?: Date
  today?: Date
  /** Recorded history remains available; arrangement pages explicitly use original plan order. */
  dateBasis?: 'recorded' | 'plan-order'
}): PlanScheduleModel => {
  const {
    trainingDays,
    executionsByDayIndex = {},
    completionDates = {},
    effectiveStartDate,
    progressDayIndex,
    startExecutionDay = 1,
    fallbackAnchorDayIndex = progressDayIndex || 1,
    fallbackAnchorDate = new Date(),
    today = new Date(),
    dateBasis = 'recorded'
  } = params

  const scheduleByDayIndex = new Map<number, PlanDayScheduleInfo>()
  const dayIndexesByDateKey = new Map<string, number[]>()
  const postponedDates: PostponedDateMarker[] = []
  const postponedByDateKey = new Map<string, PostponedDateMarker>()
  const todayStart = getBeijingDayStart(today)

  const sortedDays = [...(trainingDays || [])].sort((a, b) => {
    const left = Number(a?.dayIndex ?? a?.day_index ?? 0)
    const right = Number(b?.dayIndex ?? b?.day_index ?? 0)
    return left - right
  })

  const executionStartDay = Math.max(1, Number(startExecutionDay || 1))
  const normalizedProgressDay = Math.max(executionStartDay, Number(progressDayIndex || executionStartDay))

  const addDateBucketDay = (date: Date, dayIndex: number) => {
    const key = toBeijingDateKey(date)
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
      totalDelayDays: Math.max(0, diffBeijingCalendarDays(displayDate, baselineDate)),
      hidden: !!options?.hidden
    })
    if (!options?.hidden) addDateBucketDay(displayDate, dayIndex)
  }

  const addPostponedRange = (fromDate: Date, untilDate: Date, targetDayIndex: number) => {
    let cursor = getBeijingDayStart(fromDate)
    let offset = 1
    while (diffBeijingCalendarDays(untilDate, cursor) > 0) {
      const key = toBeijingDateKey(cursor)
      if (!postponedByDateKey.has(key) && !dayIndexesByDateKey.has(key)) {
        const marker: PostponedDateMarker = { date: cursor, key, targetDayIndex, offset }
        postponedByDateKey.set(key, marker)
        postponedDates.push(marker)
      }
      cursor = addBeijingDays(cursor, 1)
      offset += 1
    }
    return offset - 1
  }

  // 执行起点之前仍按原始计划日期展示，不参与后续的动态压缩。
  sortedDays
    .filter((day) => Number(day?.dayIndex ?? day?.day_index ?? 0) < executionStartDay)
    .forEach((day) => {
      const dayIndex = Number(day?.dayIndex ?? day?.day_index ?? 0)
      const recordedDate = getExecutionAnchorDate(executionsByDayIndex[dayIndex])
        || (completionDates[dayIndex] ? getBeijingDayStart(completionDates[dayIndex]) : null)
      setScheduleDay(day, recordedDate || resolvePlanDayDate({
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
    .map((day, position) => {
      const di = Number(day?.dayIndex ?? day?.day_index ?? 0)
      // An editable replacement attempt cannot erase an already completed day.
      const execution = executionsByDayIndex[di]
      return { day, position, date: isCalendarDate(execution?.performed_on)
        ? getExecutionAnchorDate(execution)
        : completionDates[di] ? getBeijingDayStart(completionDates[di]) : getExecutionAnchorDate(execution) }
    })
    .filter((entry): entry is { day: any; position: number; date: Date } => !!entry.date)

  const recordedDates = new Map(anchorPositions.map(anchor => [anchor.position, anchor.date]))
  const estimatedPositions = new Set<number>()
  if (dateBasis === 'plan-order') {
    const firstPlanDate = resolvePlanDayDate({ dayIndex: executionStartDay, effectiveStartDate,
      fallbackAnchorDayIndex, fallbackAnchorDate })
    anchorPositions.forEach((anchor, index) => {
      const execution = executionsByDayIndex[Number(anchor.day.dayIndex ?? anchor.day.day_index)]
      if (!execution || execution.status !== 'completed' || isCalendarDate(execution.performed_on)) return
      const started = new Date(execution.started_at || '').getTime()
      const saved = new Date(execution.last_saved_at || '').getTime()
      const completed = new Date(execution.completed_at || '').getTime()
      const meaningfulSave = Number(execution.completed_sets || 0) > 0
        || (Array.isArray(execution.action_executions) && execution.action_executions.some((action: any) =>
          Number(action.completed_sets || 0) > 0 || (Array.isArray(action.sets) && action.sets.some((set: any) => set.completed))))
      let candidate: Date | null = null
      if (meaningfulSave && saved >= started && saved <= started + 5 * 3600000 && saved <= completed) {
        candidate = getBeijingDayStart(new Date(saved))
      } else if (index > 0 && Number.isFinite(started) && completed - started > 5 * 3600000) {
        // A late confirmation is not a new training day. Start is only a
        // provisional arrangement anchor, not an asserted historical fact.
        // Never infer the first workout from an automatically created attempt.
        candidate = getBeijingDayStart(new Date(started))
      }
      if (candidate && candidate >= firstPlanDate && candidate <= todayStart
        && candidate.getTime() !== anchor.date.getTime()) {
        anchor.date = candidate
        estimatedPositions.add(anchor.position)
      }
    })
    // Work backwards from the later original-plan day. A delayed submission
    // must not push D53/D57 past D60. Preserve original spacing where possible;
    // only the arrangement changes, while recordedDates retains all evidence.
    for (let i = anchorPositions.length - 2; i >= 0; i -= 1) {
      const current = anchorPositions[i]
      const next = anchorPositions[i + 1]
      if (current.date > next.date || (current.date.getTime() === next.date.getTime()
        && estimatedPositions.has(current.position))) {
        const gap = Math.max(1, Number(next.day.dayIndex ?? next.day.day_index)
          - Number(current.day.dayIndex ?? current.day.day_index))
        const inferred = addBeijingDays(next.date, -gap)
        current.date = inferred < firstPlanDate ? firstPlanDate : inferred
        estimatedPositions.add(current.position)
      }
    }
  }

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
    let availableSlots = Math.max(0, diffBeijingCalendarDays(anchor.date, cursorDate))

    segment.forEach((day, segmentIndex) => {
      const isRestDay = String(day?.type || 'training').toLowerCase() === 'rest' && !day?.actionSets?.length
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
        cursorDate = addBeijingDays(cursorDate, 1)
        availableSlots -= 1
        return
      }

      // 异常旧数据中若缺少中间训练执行，不再覆盖后一个 Day；聚合到真实执行日供用户追溯。
      setScheduleDay(day, anchor.date)
    })

    const delayAddedDays = addPostponedRange(cursorDate, anchor.date, anchorDayIndex)
    setScheduleDay(anchor.day, anchor.date, { delayAddedDays })
    const schedule = scheduleByDayIndex.get(anchorDayIndex)!
    schedule.recordedDate = recordedDates.get(anchor.position)
    schedule.dateEstimated = estimatedPositions.has(anchor.position)
    if (schedule.dateEstimated) schedule.dateNeedsReview = true
    // The next original-plan day follows this fact, not the maximum timestamp
    // of an earlier (possibly incorrectly dated) workout.
    cursorDate = addBeijingDays(anchor.date, 1)
    cursorPosition = anchor.position + 1
  })

  const trailingDays = activeDays.slice(cursorPosition)
  trailingDays.forEach((day) => {
    const dayIndex = Number(day?.dayIndex ?? day?.day_index ?? 0)
    const isRestDay = String(day?.type || 'training').toLowerCase() === 'rest'

    let delayAddedDays = 0
    if (dayIndex === normalizedProgressDay && !isRestDay && diffBeijingCalendarDays(todayStart, cursorDate) > 0) {
      delayAddedDays = addPostponedRange(cursorDate, todayStart, dayIndex)
      cursorDate = todayStart
    }
    setScheduleDay(day, cursorDate, { delayAddedDays })
    cursorDate = addBeijingDays(cursorDate, 1)
  })

  // Historical facts may be genuinely out of order or corrupted by old edits.
  // Flag them; never silently move a completed workout to a fabricated date.
  for (let i = 1; i < anchorPositions.length; i += 1) {
    if (anchorPositions[i].date.getTime() < anchorPositions[i - 1].date.getTime()) {
      for (const entry of [anchorPositions[i - 1], anchorPositions[i]]) {
        const info = scheduleByDayIndex.get(Number(entry.day.dayIndex ?? entry.day.day_index))
        if (info) info.dateNeedsReview = true
      }
    }
  }
  for (const key of dayIndexesByDateKey.keys()) postponedByDateKey.delete(key)
  return {
    scheduleByDayIndex,
    dayIndexesByDateKey,
    postponedDates: postponedDates.filter(marker => postponedByDateKey.has(marker.key)),
    postponedByDateKey
  }
}


/** Viewing a saved record must never be blocked by a future-week preview gate. */
export function canViewPlanDay(dayIndex: number, unlockedWeek: number, execution?: { status?: string }, hasCompletion = false) {
  return hasCompletion || !!execution || Math.ceil(dayIndex / 7) <= unlockedWeek
}
