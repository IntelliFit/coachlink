import {
  addBeijingDays,
  getBeijingDateFromParts,
  getBeijingDateParts,
  getBeijingDayStart,
  getBeijingMonthDays,
  getBeijingWeekday,
  toBeijingDateKey,
} from './beijingTime'
import { canViewPlanDay, resolvePlanDayDate, type PlanScheduleModel } from './planCalendar'

/**
 * 今日训练顶部周条与月历的纯逻辑（小程序 WeekDashboardStrip / ScheduleCalendarPanel 与 APP 共用）。
 * 日期一律按北京时间计算。
 */

const SUN_FIRST_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const WEEKDAY_TEXT = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

export type WeekStripCellStatus = 'empty' | 'rest' | 'pending' | 'completed' | 'in_progress' | 'locked'

export interface WeekStripCell {
  date: Date
  dateKey: string
  weekdayLabel: string
  dayNum: number
  planDayIndex: number | null
  planDayIndexes: number[]
  status: WeekStripCellStatus
  isToday: boolean
}

/** 训练日所在的计划周（第 1–7 天为第 1 周）。 */
export function getPlanDayWeekNumber(dayIndex: number) {
  return Math.max(1, Math.ceil(dayIndex / 7))
}

/** 已解锁到第几周：当前进度所在周和下一周可看，顺延的计划按真实进度而非自然日解锁。 */
export function getUnlockedPlanWeek(startExecutionDay: number, progressDayIndex: number) {
  return Math.max(getPlanDayWeekNumber(startExecutionDay || 1), getPlanDayWeekNumber(progressDayIndex || 1)) + 1
}

/** 当前周（周日为首日）7 天起点 0:00 */
export function getSundayWeekStart(d: Date) {
  const parts = getBeijingDateParts(d)
  return addBeijingDays(d, -getBeijingWeekday(parts.year, parts.month, parts.day))
}

export function buildWeekStripCells(params: {
  now?: Date
  today?: Date
  trainingDays: any[]
  scheduleModel: {
    scheduleByDayIndex: Map<number, { displayDate: Date; hidden?: boolean }>
    dayIndexesByDateKey?: Map<string, number[]>
  }
  planStartDate?: string | null
  progressDayIndex: number
  currentDayIndex: number
  executionsByDayIndex: Record<number, any>
  completionDates: Record<number, string>
  startExecutionDay: number
  unlockedWeek: number
}): WeekStripCell[] {
  const {
    now = new Date(),
    trainingDays,
    scheduleModel,
    planStartDate,
    progressDayIndex,
    currentDayIndex,
    executionsByDayIndex,
    completionDates,
    startExecutionDay,
    unlockedWeek
  } = params

  const weekStart = getSundayWeekStart(now)
  const todayKey = toBeijingDateKey(getBeijingDayStart(params.today || now))

  const dayIndexesByDateKey = new Map<string, number[]>()
  if (scheduleModel.dayIndexesByDateKey) {
    scheduleModel.dayIndexesByDateKey.forEach((dayIndexes, dateKey) => {
      dayIndexesByDateKey.set(dateKey, [...dayIndexes])
    })
  } else {
    trainingDays.forEach((day: any) => {
      const info = scheduleModel.scheduleByDayIndex.get(day.dayIndex)
      if (info?.hidden) return
      const dt =
        info?.displayDate ||
        resolvePlanDayDate({
          dayIndex: day.dayIndex,
          effectiveStartDate: planStartDate,
          fallbackAnchorDayIndex: progressDayIndex || currentDayIndex || 1
        })
      const dateKey = toBeijingDateKey(getBeijingDayStart(dt))
      const dayIndexes = dayIndexesByDateKey.get(dateKey) || []
      dayIndexes.push(day.dayIndex)
      dayIndexesByDateKey.set(dateKey, dayIndexes)
    })
  }

  const cells: WeekStripCell[] = []
  for (let i = 0; i < 7; i += 1) {
    const date = addBeijingDays(weekStart, i)
    const dateKey = toBeijingDateKey(getBeijingDayStart(date))
    const weekdayLabel = SUN_FIRST_LABELS[i]
    const planDayIndexes = dayIndexesByDateKey.get(dateKey) || []
    const getStatus = (planDayIndex: number): WeekStripCellStatus => {
      const ex = executionsByDayIndex[planDayIndex]
      if (planDayIndex < startExecutionDay) {
        return completionDates[planDayIndex] || ex?.status === 'completed' ? 'completed' : 'pending'
      }
      if (ex?.status === 'completed' || completionDates[planDayIndex]) return 'completed'
      if (ex?.status === 'in_progress') return 'in_progress'
      if (!canViewPlanDay(planDayIndex, unlockedWeek, ex)) return 'locked'
      const day = trainingDays.find((x: any) => x.dayIndex === planDayIndex)
      return day?.type === 'rest' ? 'rest' : 'pending'
    }
    const statuses = planDayIndexes.map(getStatus)
    const planDayIndex = planDayIndexes.find((dayIndex) => getStatus(dayIndex) === 'in_progress')
      || planDayIndexes.find((dayIndex) => {
        const day = trainingDays.find((entry: any) => entry.dayIndex === dayIndex)
        return getStatus(dayIndex) === 'pending' && day?.type !== 'rest'
      })
      || planDayIndexes[planDayIndexes.length - 1]
      || null

    let status: WeekStripCellStatus = 'empty'
    if (statuses.length > 0) {
      if (statuses.every((entry) => entry === 'completed')) status = 'completed'
      else if (statuses.includes('in_progress')) status = 'in_progress'
      else if (statuses.includes('pending')) status = 'pending'
      else if (statuses.every((entry) => entry === 'rest')) status = 'rest'
      else if (statuses.includes('rest')) status = 'rest'
      else status = 'locked'
    }

    cells.push({
      date,
      dateKey,
      weekdayLabel,
      dayNum: getBeijingDateParts(date).day,
      planDayIndex,
      planDayIndexes,
      status,
      isToday: dateKey === todayKey
    })
  }

  return cells
}

/** 周条里该日是否显示小圆点（有可看的计划安排）。 */
export function weekStripCellHasDot(cell: WeekStripCell) {
  return cell.planDayIndex != null && cell.status !== 'empty' && cell.status !== 'locked'
}

/** 月历网格（周一为首列），空位为 null。 */
export function buildPlanMonthGrid(year: number, month: number): Array<Date | null> {
  const leadingBlankCount = (getBeijingWeekday(year, month, 1) + 6) % 7
  const totalDays = getBeijingMonthDays(year, month)
  const cells: Array<Date | null> = Array.from({ length: leadingBlankCount }, () => null)
  for (let day = 1; day <= totalDays; day += 1) cells.push(getBeijingDateFromParts(year, month, day))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function shiftPlanMonth(cursor: { year: number; month: number }, delta: -1 | 1) {
  const next = cursor.month + delta
  if (next <= 0) return { year: cursor.year - 1, month: 12 }
  if (next > 12) return { year: cursor.year + 1, month: 1 }
  return { year: cursor.year, month: next }
}

export type PlanMonthCellStatus = 'completed' | 'before_start' | 'in_progress' | 'pending' | 'abandoned' | 'calendar_only'

/** 月历一格的展示信息，与小程序 ScheduleCalendarPanel 的月历格一致。 */
export function describePlanMonthCell(params: {
  date: Date
  scheduleModel: PlanScheduleModel
  trainingDays: any[]
  executionsByDayIndex: Record<number, any>
  completionDates: Record<number, string>
  startExecutionDay: number
  unlockedWeek: number
  selectedDayIndex: number
  today?: Date
}) {
  const { date, scheduleModel, trainingDays, executionsByDayIndex, completionDates, startExecutionDay, unlockedWeek, selectedDayIndex } = params
  const dateKey = toBeijingDateKey(date)
  const dayIndexes = scheduleModel.dayIndexesByDateKey.get(dateKey) || []
  const accessibleDays = dayIndexes.filter((di) => canViewPlanDay(di, unlockedWeek, executionsByDayIndex[di], !!completionDates[di]))
  const postponed = scheduleModel.postponedByDateKey.get(dateKey) || null
  const dayStatus = (dayIndex: number): PlanMonthCellStatus => {
    const execution = executionsByDayIndex?.[dayIndex]
    if (execution?.status === 'completed' || completionDates?.[dayIndex]) return 'completed'
    if (execution?.status === 'in_progress') return 'in_progress'
    if (execution?.status === 'abandoned') return 'abandoned'
    if (dayIndex < startExecutionDay) return 'before_start'
    return 'pending'
  }
  const statuses = dayIndexes.map(dayStatus)
  const status: PlanMonthCellStatus = statuses.length === 0
    ? 'calendar_only'
    : statuses.every((entry) => entry === 'completed' || entry === 'before_start')
      ? 'completed'
      : statuses.includes('in_progress')
        ? 'in_progress'
        : statuses.includes('pending')
          ? 'pending'
          : statuses.includes('abandoned')
            ? 'abandoned'
            : statuses[0]
  const allRest = dayIndexes.length > 0 && dayIndexes.every((di) => trainingDays.find((day: any) => day.dayIndex === di)?.type === 'rest')
  const estimated = dayIndexes.some((di) => scheduleModel.scheduleByDayIndex.get(di)?.dateEstimated)
  const typeLabel = dayIndexes.length > 0
    ? estimated
      ? '推算'
      : status === 'completed' ? '✓' : status === 'in_progress' ? '进行' : status === 'abandoned' ? '跳过' : allRest ? '休' : '练'
    : postponed ? `->D${postponed.targetDayIndex}` : '-'
  return {
    dateKey,
    dayNum: getBeijingDateParts(date).day,
    dayIndexes,
    accessibleDays,
    status,
    dayLabel: dayIndexes.length > 0 ? dayIndexes.map((di) => `D${di}`).join(' · ') : postponed ? '顺延' : '-',
    typeLabel,
    isToday: dateKey === toBeijingDateKey(getBeijingDayStart(params.today || new Date())),
    isSelected: dayIndexes.includes(selectedDayIndex),
    locked: dayIndexes.length > 0 && accessibleDays.length === 0,
    postponed: Boolean(postponed),
  }
}

/** 同一天有多条安排时，再次点击依次切换。 */
export function nextAccessibleDayIndex(accessibleDays: number[], selectedDayIndex: number) {
  if (accessibleDays.length === 0) return null
  const pos = accessibleDays.indexOf(selectedDayIndex)
  return accessibleDays[(pos + 1) % accessibleDays.length]
}

/** 计划完成度：只算训练日（休息日不计）。 */
export function planTrainingProgress(trainingDays: any[], executionsByDayIndex: Record<number, any>, completionDates: Record<number, string>) {
  const planTrainingDays = trainingDays.filter((day: any) => day?.type === 'training')
  const done = planTrainingDays.reduce((sum: number, day: any) => {
    const ex = executionsByDayIndex[day.dayIndex]
    return sum + (ex?.status === 'completed' || !!completionDates[day.dayIndex] ? 1 : 0)
  }, 0)
  const total = planTrainingDays.length
  return { done, total, percent: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0 }
}

/** 「10月29日 星期三」，不依赖运行环境的 Intl 时区支持。 */
export function formatPlanDayDateLabel(date: Date | null | undefined) {
  if (!date) return ''
  const parts = getBeijingDateParts(date)
  return `${parts.month}月${parts.day}日 ${WEEKDAY_TEXT[getBeijingWeekday(parts.year, parts.month, parts.day)]}`
}
