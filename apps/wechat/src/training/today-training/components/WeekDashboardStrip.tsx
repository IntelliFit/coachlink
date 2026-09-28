import React, { useMemo } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { resolvePlanDayDate, toDateKey } from '../lib/dayModules'
import { addBeijingDays, getBeijingDayStart, getBeijingDateParts, getBeijingWeekday } from '@coachlink/core/src/beijingTime'
import { canViewPlanDay } from '@coachlink/core/src/planCalendar'
import './WeekDashboardStrip.scss'

const SUN_FIRST_LABELS = ['日', '一', '二', '三', '四', '五', '六']

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

interface WeekDashboardStripProps {
  cells: WeekStripCell[]
  selectedDateKey: string
  onCellPress: (cell: WeekStripCell) => void
}

function WeekDashboardStrip({ cells, selectedDateKey, onCellPress }: WeekDashboardStripProps) {
  const safeCells = useMemo(() => (cells.length === 7 ? cells : []), [cells])

  return (
    <View className='week-dashboard-strip'>
      {/* 关闭 enhanced：部分机型上横向 scroll-view 易吞掉子节点 tap */}
      <ScrollView scrollX className='week-dashboard-strip__scroll' showScrollbar={false}>
        <View className='week-dashboard-strip__row'>
          {safeCells.map((cell) => {
            const selected = cell.dateKey === selectedDateKey
            const showDot =
              cell.planDayIndex != null &&
              cell.status !== 'empty' &&
              cell.status !== 'locked' &&
              (cell.status === 'completed' ||
                cell.status === 'in_progress' ||
                cell.status === 'pending' ||
                cell.status === 'rest')

            return (
              <View
                key={cell.dateKey}
                className={`week-dashboard-strip__pill week-dashboard-strip__pill--${cell.status} ${selected ? 'week-dashboard-strip__pill--selected' : ''} ${
                  cell.isToday ? 'week-dashboard-strip__pill--today' : ''
                }`}
                hoverClass='week-dashboard-strip__pill--active'
                hoverStayTime={70}
                onClick={() => onCellPress(cell)}
              >
                {showDot ? <View className='week-dashboard-strip__dot' /> : <View className='week-dashboard-strip__dot-placeholder' />}
                <Text className='week-dashboard-strip__wd'>{cell.weekdayLabel}</Text>
                <Text className='week-dashboard-strip__num'>{cell.dayNum}</Text>
              </View>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}

/** 当前周（周日为首日）7 天起点 0:00 */
export function getSundayWeekStart(d: Date) {
  const parts = getBeijingDateParts(d)
  return addBeijingDays(d, -getBeijingWeekday(parts.year, parts.month, parts.day))
}

function startOfDayTime(dateValue: Date | string) {
  return getBeijingDayStart(dateValue)
}

export function buildWeekStripCells(params: {
  now?: Date
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
  const todayKey = toDateKey(startOfDayTime(now))

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
      const dateKey = toDateKey(startOfDayTime(dt))
      const dayIndexes = dayIndexesByDateKey.get(dateKey) || []
      dayIndexes.push(day.dayIndex)
      dayIndexesByDateKey.set(dateKey, dayIndexes)
    })
  }

  const cells: WeekStripCell[] = []
  for (let i = 0; i < 7; i += 1) {
    const date = addBeijingDays(weekStart, i)
    const dateKey = toDateKey(startOfDayTime(date))
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

export default WeekDashboardStrip
