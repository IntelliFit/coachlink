import React, { useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { calculateCurrentWeek, formatUnlockDate, getDayWeekNumber, getUnlockDate, isDayUnlocked } from '@/utils/weekUnlock'
import { formatMonthDayWeekday, formatYearMonth } from '@/utils/dateFormat'
import { resolvePlanDayDate, toDateKey, type PlanScheduleModel } from '../lib/dayModules'
import './ScheduleCalendarPanel.scss'

interface ScheduleCalendarPanelProps {
  trainingDays: any[]
  currentDayIndex: number
  selectedDayIndex: number
  completionDates?: Record<number, string>
  executionsByDayIndex?: Record<number, any>
  scheduleModel: PlanScheduleModel
  todayCompleted?: boolean
  progressDayIndex?: number
  planStartDate?: string
  startExecutionDay?: number
  onSelectedDayChange: (dayIndex: number) => void
}

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

const startOfDay = (dateValue: Date | string) => {
  const date = new Date(dateValue)
  date.setHours(0, 0, 0, 0)
  return date
}

const getMonthDays = (year: number, month: number) => {
  return new Date(year, month, 0).getDate()
}

const getWeekday = (year: number, month: number, day: number) => {
  return new Date(year, month - 1, day).getDay()
}

function ScheduleCalendarPanel({
  trainingDays,
  currentDayIndex,
  selectedDayIndex,
  completionDates = {},
  executionsByDayIndex = {},
  scheduleModel,
  todayCompleted = false,
  progressDayIndex,
  planStartDate,
  startExecutionDay = 1,
  onSelectedDayChange
}: ScheduleCalendarPanelProps) {
  const totalWeeks = Math.max(1, Math.ceil(trainingDays.length / 7))
  const [isMonthExpanded, setIsMonthExpanded] = useState(false)
  const [currentWeek, setCurrentWeek] = useState(() => {
    const anchorDay = selectedDayIndex || currentDayIndex || 1
    return Math.max(1, Math.min(Math.ceil(anchorDay / 7), totalWeeks))
  })

  const unlockedWeek = useMemo(() => {
    const byDate = calculateCurrentWeek(planStartDate)
    const byStartExecution = getDayWeekNumber(startExecutionDay || 1)
    return Math.max(byDate, byStartExecution)
  }, [planStartDate, startExecutionDay])

  useEffect(() => {
    const targetWeek = Math.max(1, Math.min(Math.ceil((selectedDayIndex || 1) / 7), totalWeeks))
    setCurrentWeek(targetWeek)
  }, [selectedDayIndex, totalWeeks, trainingDays.length])

  const weekDays = useMemo(() => {
    const startDay = (currentWeek - 1) * 7 + 1
    return Array.from({ length: 7 }, (_, i) => startDay + i).filter((dayIndex) => dayIndex <= trainingDays.length)
  }, [currentWeek, trainingDays.length])

  const dayDateEntries = useMemo(() => {
    return trainingDays.map((day: any) => {
      const scheduleInfo = scheduleModel.scheduleByDayIndex.get(day.dayIndex)
      const date = scheduleInfo?.displayDate || resolvePlanDayDate({
        dayIndex: day.dayIndex,
        effectiveStartDate: planStartDate,
        fallbackAnchorDayIndex: progressDayIndex || currentDayIndex || 1
      })
      return {
        dayIndex: day.dayIndex,
        type: day.type,
        date,
        key: toDateKey(date)
      }
    })
  }, [trainingDays, scheduleModel, planStartDate, progressDayIndex, currentDayIndex])

  const selectedSchedule = useMemo(() => {
    return scheduleModel.scheduleByDayIndex.get(selectedDayIndex || 1)
  }, [scheduleModel, selectedDayIndex])

  const selectedDate = useMemo(() => {
    return selectedSchedule?.displayDate || resolvePlanDayDate({
      dayIndex: selectedDayIndex || 1,
      effectiveStartDate: planStartDate,
      fallbackAnchorDayIndex: progressDayIndex || currentDayIndex || 1
    })
  }, [selectedSchedule, selectedDayIndex, planStartDate, progressDayIndex, currentDayIndex])

  const [monthCursor, setMonthCursor] = useState(() => ({
    year: selectedDate.getFullYear(),
    month: selectedDate.getMonth() + 1
  }))

  useEffect(() => {
    setMonthCursor({
      year: selectedDate.getFullYear(),
      month: selectedDate.getMonth() + 1
    })
  }, [selectedDate])

  const dayIndexByDateKey = useMemo(() => {
    const map = new Map<string, number>()
    dayDateEntries.forEach((entry) => {
      map.set(entry.key, entry.dayIndex)
    })
    return map
  }, [dayDateEntries])

  const monthGrid = useMemo(() => {
    const leadingBlankCount = (getWeekday(monthCursor.year, monthCursor.month, 1) + 6) % 7
    const totalDays = getMonthDays(monthCursor.year, monthCursor.month)
    const cells: Array<Date | null> = Array.from({ length: leadingBlankCount }, () => null)
    for (let day = 1; day <= totalDays; day += 1) {
      cells.push(startOfDay(new Date(monthCursor.year, monthCursor.month - 1, day)))
    }
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [monthCursor])

  const getDayStatus = (dayIndex: number) => {
    const execution = executionsByDayIndex?.[dayIndex]
    if (execution?.status === 'completed' || completionDates?.[dayIndex]) return 'completed'
    if (execution?.status === 'in_progress') return 'in_progress'
    if (execution?.status === 'abandoned') return 'abandoned'
    if (dayIndex < startExecutionDay) return 'before_start'
    return 'pending'
  }

  const selectDay = (dayIndex: number) => {
    if (!isDayUnlocked(dayIndex, unlockedWeek)) return
    onSelectedDayChange(dayIndex)
  }

  const formatDayLabel = (date: Date) => formatMonthDayWeekday(date)

  const selectedStatusText =
    selectedDayIndex === progressDayIndex ? '今日推进' : selectedDate < startOfDay(new Date()) ? '历史安排' : '未来安排'

  return (
    <View className='schedule-calendar-panel'>
      <View className='calendar-head'>
        <View className='head-left'>
          <Text className='head-label'>按日期查看每日安排</Text>
          <Text className='head-title'>安排日历</Text>
          <Text className='head-meta'>
            已选第{selectedDayIndex}天 · {formatDayLabel(selectedDate)}
            {selectedSchedule?.totalDelayDays ? ` · 已顺延 ${selectedSchedule.totalDelayDays} 天` : ''}
            {selectedDayIndex === progressDayIndex ? ' · 今日推进' : ` · ${selectedStatusText}`}
          </Text>
        </View>
        <View className='head-actions'>
          <View
            className={`week-nav-btn ${currentWeek === 1 ? 'disabled' : ''}`}
            onClick={() => currentWeek > 1 && setCurrentWeek((prev) => prev - 1)}
          >
            <Text>‹</Text>
          </View>
          <Text className='week-label'>第 {currentWeek} 周</Text>
          <View
            className={`week-nav-btn ${currentWeek === totalWeeks ? 'disabled' : ''}`}
            onClick={() => currentWeek < totalWeeks && setCurrentWeek((prev) => prev + 1)}
          >
            <Text>›</Text>
          </View>
          <View className='expand-btn' onClick={() => setIsMonthExpanded((prev) => !prev)}>
            <Text>{isMonthExpanded ? '收起月历' : '展开月历'}</Text>
          </View>
        </View>
      </View>

      <View className='week-strip'>
        {weekDays.map((dayIndex) => {
          const day = trainingDays.find((entry: any) => entry.dayIndex === dayIndex)
          const scheduleInfo = scheduleModel.scheduleByDayIndex.get(dayIndex)
          const status = getDayStatus(dayIndex)
          const isSelected = selectedDayIndex === dayIndex
          const isProgressDay = dayIndex === progressDayIndex
          const isRecommended = dayIndex === currentDayIndex
          const isUnlocked = isDayUnlocked(dayIndex, unlockedWeek)

          return (
            <View
              key={dayIndex}
              className={`week-day-card ${isSelected ? 'selected' : ''} ${status} ${!isUnlocked ? 'locked' : ''} ${
                isRecommended && !isSelected && !todayCompleted ? 'recommended' : ''
              } ${isProgressDay && !isSelected ? 'progress' : ''}`}
              onClick={() => selectDay(dayIndex)}
            >
              {isProgressDay && (
                <Text className='card-badge progress-badge'>推进</Text>
              )}
              {isProgressDay && (scheduleInfo?.totalDelayDays ?? 0) > 0 && (
                <Text className='card-badge delay-badge'>+{scheduleInfo?.totalDelayDays}天</Text>
              )}
              <Text className='week-day-prefix'>DAY</Text>
              <Text className='week-day-date'>{dayIndex}</Text>
              <Text className='week-day-type'>{day?.type === 'rest' ? '恢复' : '训练'}</Text>
              <Text className='week-day-status'>
                {status === 'completed' || status === 'before_start'
                  ? '✓'
                  : status === 'in_progress'
                    ? '进行中'
                    : status === 'abandoned'
                      ? '跳过'
                      : !isUnlocked
                        ? '未解锁'
                        : ''}
              </Text>
            </View>
          )
        })}
        {Array.from({ length: 7 - weekDays.length }).map((_, index) => (
          <View key={`empty-${index}`} className='week-day-card empty' />
        ))}
      </View>

      {currentWeek > unlockedWeek && (
        <View className='unlock-hint'>
          <Text>
            第 {currentWeek} 周预计 {formatUnlockDate(getUnlockDate(currentWeek, planStartDate))} 解锁
          </Text>
        </View>
      )}

      {isMonthExpanded && (
        <View className='month-board'>
          <View className='month-head'>
            <View
              className='month-nav-btn'
              onClick={() =>
                setMonthCursor((prev) => {
                  const nextMonth = prev.month - 1
                  return nextMonth <= 0
                    ? { year: prev.year - 1, month: 12 }
                    : { year: prev.year, month: nextMonth }
                })
              }
            >
              <Text>‹</Text>
            </View>
            <Text className='month-title'>
              {formatYearMonth(new Date(monthCursor.year, monthCursor.month - 1, 1))}
            </Text>
            <View
              className='month-nav-btn'
              onClick={() =>
                setMonthCursor((prev) => {
                  const nextMonth = prev.month + 1
                  return nextMonth > 12
                    ? { year: prev.year + 1, month: 1 }
                    : { year: prev.year, month: nextMonth }
                })
              }
            >
              <Text>›</Text>
            </View>
          </View>

          <View className='month-weekdays'>
            {WEEK_LABELS.map((label) => (
              <View key={label} className='weekday-cell'>
                <Text>{label}</Text>
              </View>
            ))}
          </View>

          <View className='month-grid'>
            {monthGrid.map((dateCell, index) => {
              if (!dateCell) {
                return <View key={`blank-${index}`} className='date-cell empty' />
              }

              const mappedDayIndex = dayIndexByDateKey.get(toDateKey(dateCell))
              const postponedMarker = scheduleModel.postponedByDateKey.get(toDateKey(dateCell))
              const isUnlocked = mappedDayIndex ? isDayUnlocked(mappedDayIndex, unlockedWeek) : false
              const isSelected = mappedDayIndex === selectedDayIndex
              const status = mappedDayIndex ? getDayStatus(mappedDayIndex) : 'calendar_only'
              const isToday = toDateKey(dateCell) === toDateKey(startOfDay(new Date()))

              return (
                <View
                  key={toDateKey(dateCell)}
                  className={`date-cell ${mappedDayIndex ? 'plan' : 'outside'} ${postponedMarker ? 'postponed' : ''} ${isSelected ? 'selected' : ''} ${
                    status
                  } ${isToday ? 'today' : ''} ${mappedDayIndex && !isUnlocked ? 'locked' : ''}`}
                  onClick={() => mappedDayIndex && selectDay(mappedDayIndex)}
                >
                  <Text className='date-num'>{dateCell.getDate()}</Text>
                  <Text className='date-day-index'>{mappedDayIndex ? `D${mappedDayIndex}` : postponedMarker ? '顺延' : '-'}</Text>
                  <Text className='date-type'>
                    {mappedDayIndex
                      ? status === 'completed' || status === 'before_start'
                        ? '✓'
                        : status === 'in_progress'
                          ? '进行'
                          : status === 'abandoned'
                            ? '跳过'
                            : trainingDays.find((day: any) => day.dayIndex === mappedDayIndex)?.type === 'rest'
                              ? '恢'
                              : '训'
                      : postponedMarker
                        ? `→D${postponedMarker.targetDayIndex}`
                        : '-'}
                  </Text>
                </View>
              )
            })}
          </View>
        </View>
      )}

      <View className='calendar-tip'>
        <Text className='calendar-tip-text'>
          当前计划时间：
          {formatDayLabel(
            scheduleModel.scheduleByDayIndex.get(1)?.displayDate ||
              resolvePlanDayDate({
                dayIndex: 1,
                effectiveStartDate: planStartDate,
                fallbackAnchorDayIndex: progressDayIndex || currentDayIndex || 1
              })
          )}{' '}
          开始，已解锁到第 {unlockedWeek} 周。
        </Text>
        {scheduleModel.postponedDates.length > 0 && (
          <Text className='calendar-tip-text delay-tip'>浅橙色日期 = 顺延出来的额外休息日</Text>
        )}
      </View>
    </View>
  )
}

export default ScheduleCalendarPanel
