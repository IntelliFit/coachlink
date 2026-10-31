import { buildPlanScheduleModel } from '@coachlink/core/src/planCalendar'
import { buildPlannedSetPreviews } from '@coachlink/core/src/planSetPrescriptions'
import { buildWeekStripCells, getUnlockedPlanWeek } from '@coachlink/core/src/planWeekStrip'
import { normalizeTrainingItemType } from './trainingModel'
import type { TodayTrainingPlanBlock } from './todayTrainingCache'

/**
 * 今日训练的日期安排，与小程序 TodayTrainingScreen 同口径：
 * 教练计划没有 start_date 时先按分配日展示第 1 天，不能复用整段订阅的旧开始日。
 */
export function buildTodaySchedule(params: {
  block: TodayTrainingPlanBlock
  planMode: 'coach' | 'self'
  subscription?: any
  selectedDayIndex: number
  now?: Date
}) {
  const { block, planMode, subscription, selectedDayIndex } = params
  const now = params.now || new Date()
  const instance = block.instance
  const trainingDays = (Array.isArray(instance?.training_days) ? instance.training_days : []).map((day: any) => ({
    ...day,
    dayIndex: Number(day?.dayIndex ?? day?.day_index),
  }))
  const executionsByDayIndex = block.executionsByDayIndex || {}
  const completionDates = block.completionDates || {}
  const progressDayIndex = block.recommendedDayIndex || 1
  const startExecutionDay = Number(instance?.start_execution_day || 1)
  const effectiveStartDate = planMode === 'coach'
    ? instance?.start_date || instance?.created_at || subscription?.start_date || null
    : instance?.start_date || null
  const scheduleModel = buildPlanScheduleModel({
    dateBasis: 'plan-order',
    trainingDays,
    executionsByDayIndex,
    completionDates,
    effectiveStartDate,
    progressDayIndex,
    startExecutionDay,
    fallbackAnchorDayIndex: progressDayIndex,
    today: now,
  })
  const unlockedWeek = getUnlockedPlanWeek(startExecutionDay, progressDayIndex)
  const selectedDate = scheduleModel.scheduleByDayIndex.get(selectedDayIndex)?.displayDate || now
  const weekCells = buildWeekStripCells({
    now: selectedDate,
    today: now,
    trainingDays,
    scheduleModel,
    planStartDate: effectiveStartDate,
    progressDayIndex,
    currentDayIndex: progressDayIndex,
    executionsByDayIndex,
    completionDates,
    startExecutionDay,
    unlockedWeek,
  })
  return { trainingDays, scheduleModel, unlockedWeek, selectedDate, weekCells, startExecutionDay, executionsByDayIndex, completionDates }
}

/** 选中训练日的力量部分：动作数、总组数、已完成组数（「3个动作 · 12组 · 4/12完成」）。 */
export function strengthDaySummary(day: any, execution: any, actions: Record<string, any> = {}) {
  const actionSets = Array.isArray(day?.actionSets) ? day.actionSets : []
  const isStrength = (item: any, fallbackType?: string) =>
    normalizeTrainingItemType(item?.itemType || item?.item_type || fallbackType) === 'STRENGTH'
  const planned = actionSets.filter((item: any) => isStrength(item, actions[item?.action_id || item?.actionId]?.type))
  const executed = Array.isArray(execution?.action_executions)
    ? execution.action_executions.filter((item: any) => isStrength(item))
    : null
  if (executed && executed.length > 0) {
    const sets = executed.flatMap((item: any) => (Array.isArray(item.sets) ? item.sets : []))
    return {
      actionCount: executed.length,
      totalSets: sets.length,
      completedSets: sets.filter((set: any) => String(set?.status || '') === 'completed').length,
    }
  }
  return {
    actionCount: planned.length,
    totalSets: planned.reduce((sum: number, item: any) => sum + buildPlannedSetPreviews(item).length, 0),
    completedSets: 0,
  }
}
