import React, { useMemo } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { resolvePlanDayDate, toDateKey } from '../lib/dayModules'
import './WeekDashboardStrip.scss'

const SUN_FIRST_LABELS = ['日', '一', '二', '三', '四', '五', '六']

export type WeekStripCellStatus = 'empty' | 'rest' | 'pending' | 'completed' | 'in_progress' | 'locked'

export interface WeekStripCell {
  date: Date
  dateKey: string
  weekdayLabel: string
  dayNum: number
  planDayIndex: number | null
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
                className={`week-dashboard-strip__pill ${selected ? 'week-dashboard-strip__pill--selected' : ''} ${
                  cell.isToday && !selected ? 'week-dashboard-strip__pill--today' : ''
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
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay()
  x.setDate(x.getDate() - day)
  return x
}

function startOfDayTime(dateValue: Date | string) {
  const date = new Date(dateValue)
  date.setHours(0, 0, 0, 0)
  return date
}

export function buildWeekStripCells(params: {
  now?: Date
  trainingDays: any[]
  scheduleModel: { scheduleByDayIndex: Map<number, { displayDate: Date }> }
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

  const dayIndexByDateKey = new Map<string, number>()
  trainingDays.forEach((day: any) => {
    const info = scheduleModel.scheduleByDayIndex.get(day.dayIndex)
    const dt =
      info?.displayDate ||
      resolvePlanDayDate({
        dayIndex: day.dayIndex,
        effectiveStartDate: planStartDate,
        fallbackAnchorDayIndex: progressDayIndex || currentDayIndex || 1
      })
    dayIndexByDateKey.set(toDateKey(startOfDayTime(dt)), day.dayIndex)
  })

  const cells: WeekStripCell[] = []
  for (let i = 0; i < 7; i += 1) {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    const dateKey = toDateKey(startOfDayTime(date))
    const weekdayLabel = SUN_FIRST_LABELS[date.getDay()]
    const planDayIndex = dayIndexByDateKey.get(dateKey) ?? null

    let status: WeekStripCellStatus = 'empty'
    if (planDayIndex != null) {
      const ex = executionsByDayIndex[planDayIndex]
      if (planDayIndex < startExecutionDay) {
        status = completionDates[planDayIndex] || ex?.status === 'completed' ? 'completed' : 'pending'
      } else if (ex?.status === 'completed' || completionDates[planDayIndex]) {
        status = 'completed'
      } else if (ex?.status === 'in_progress') {
        status = 'in_progress'
      } else if (ex?.status === 'abandoned') {
        status = 'pending'
      } else {
        const wk = Math.max(1, Math.ceil(planDayIndex / 7))
        status = wk > unlockedWeek ? 'locked' : 'pending'
      }
      const day = trainingDays.find((x: any) => x.dayIndex === planDayIndex)
      if (day?.type === 'rest' && status === 'pending') {
        status = 'rest'
      }
    }

    cells.push({
      date,
      dateKey,
      weekdayLabel,
      dayNum: date.getDate(),
      planDayIndex,
      status,
      isToday: dateKey === todayKey
    })
  }

  return cells
}

export default WeekDashboardStrip
