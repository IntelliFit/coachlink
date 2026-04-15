import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { trainingService, PlanInstance } from '@/services/trainingService'
import { executionService } from '@/services/executionService'
import './index.scss'

interface DayExecutionSummary {
  id?: string
  status?: string
  day_index?: number
  day_number?: number
  completed_sets?: number
  total_sets?: number
}

type TemporalStatus = 'past' | 'today' | 'future'

const getStartOfDay = (date: Date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function CoachPlanDashboard() {
  const params = Taro.getCurrentInstance().router?.params || {}
  const planId = String(params.id || '').trim()
  const coachId = params.coachId ? decodeURIComponent(String(params.coachId)) : ''
  const coachName = params.coachName ? decodeURIComponent(String(params.coachName)) : ''

  const [loading, setLoading] = useState(true)
  const [instance, setInstance] = useState<PlanInstance | null>(null)
  const [nextDayIndex, setNextDayIndex] = useState(1)
  const [completionDates, setCompletionDates] = useState<Record<number, string>>({})
  const [executionMap, setExecutionMap] = useState<Record<number, DayExecutionSummary | null>>({})
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [selectedDayIndex, setSelectedDayIndex] = useState(1)

  const sortedDays = useMemo(() => {
    const days = (instance?.training_days || []) as Array<{ dayIndex: number; type: 'training' | 'rest'; actionSets?: any[] }>
    return [...days].sort((a, b) => a.dayIndex - b.dayIndex)
  }, [instance?.training_days])

  const totalWeeks = useMemo(() => {
    return Math.max(1, Math.ceil(sortedDays.length / 7))
  }, [sortedDays.length])

  const getWeekByDayIndex = useCallback((dayIdx: number) => {
    return Math.max(1, Math.floor((Math.max(1, dayIdx) - 1) / 7) + 1)
  }, [])

  const getPlannedDate = useCallback((dayIdx: number) => {
    if (!instance?.start_date) return null
    const base = new Date(instance.start_date)
    if (Number.isNaN(base.getTime())) return null
    const start = getStartOfDay(base)
    start.setDate(start.getDate() + dayIdx - 1)
    return start
  }, [instance?.start_date])

  const getTemporalStatus = useCallback((dayIdx: number): TemporalStatus => {
    const plannedDate = getPlannedDate(dayIdx)
    if (plannedDate) {
      const today = getStartOfDay(new Date())
      if (plannedDate.getTime() < today.getTime()) return 'past'
      if (plannedDate.getTime() > today.getTime()) return 'future'
      return 'today'
    }

    if (dayIdx < nextDayIndex) return 'past'
    if (dayIdx > nextDayIndex) return 'future'
    return 'today'
  }, [getPlannedDate, nextDayIndex])

  const formatDateLabel = useCallback((dayIdx: number) => {
    const plannedDate = getPlannedDate(dayIdx)
    if (!plannedDate) return ''
    const month = String(plannedDate.getMonth() + 1).padStart(2, '0')
    const day = String(plannedDate.getDate()).padStart(2, '0')
    return `${month}-${day}`
  }, [getPlannedDate])

  const loadData = useCallback(async () => {
    if (!planId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      const [instanceRes, nextDayRes] = await Promise.all([
        trainingService.getInstance({ id: planId }),
        trainingService.getNextTrainingDay({ instanceId: planId }).catch(() => null)
      ])

      const loadedInstance = instanceRes?.instance || null
      const resolvedNextDayIndex = nextDayRes?.nextDayIndex || loadedInstance?.start_execution_day || 1
      const resolvedCompletionDates = nextDayRes?.completionDates || {}

      setInstance(loadedInstance)
      setNextDayIndex(resolvedNextDayIndex)
      setCompletionDates(resolvedCompletionDates)

      const todayRes = await executionService.checkToday(planId, resolvedNextDayIndex).catch(() => null)
      setExecutionMap((prev) => ({
        ...prev,
        [resolvedNextDayIndex]: todayRes || null
      }))

      setSelectedDayIndex(resolvedNextDayIndex)
      setSelectedWeek(getWeekByDayIndex(resolvedNextDayIndex))
    } catch (error) {
      console.error('[coach/plans/dashboard] loadData error:', error)
      Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
      setInstance(null)
    } finally {
      setLoading(false)
    }
  }, [getWeekByDayIndex, planId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useDidShow(() => {
    void loadData()
  })

  const hasExecutionForSelectedDay = useMemo(() => {
    return Object.prototype.hasOwnProperty.call(executionMap, selectedDayIndex)
  }, [executionMap, selectedDayIndex])

  useEffect(() => {
    if (!planId || !selectedDayIndex) return
    if (hasExecutionForSelectedDay) return

    let cancelled = false
    executionService
      .checkToday(planId, selectedDayIndex)
      .then((res) => {
        if (cancelled) return
        setExecutionMap((prev) => ({
          ...prev,
          [selectedDayIndex]: res || null
        }))
      })
      .catch(() => {
        if (cancelled) return
        setExecutionMap((prev) => ({
          ...prev,
          [selectedDayIndex]: null
        }))
      })

    return () => {
      cancelled = true
    }
  }, [hasExecutionForSelectedDay, planId, selectedDayIndex])

  const weekDays = useMemo(() => {
    return sortedDays.filter((day) => getWeekByDayIndex(day.dayIndex) === selectedWeek)
  }, [getWeekByDayIndex, selectedWeek, sortedDays])

  useEffect(() => {
    if (!weekDays.length) return
    const isSelectedInCurrentWeek = weekDays.some((day) => day.dayIndex === selectedDayIndex)
    if (!isSelectedInCurrentWeek) {
      setSelectedDayIndex(weekDays[0].dayIndex)
    }
  }, [selectedDayIndex, weekDays])

  const selectedDay = useMemo(() => {
    const matched = sortedDays.find((day) => day.dayIndex === selectedDayIndex)
    return matched || sortedDays[0] || null
  }, [selectedDayIndex, sortedDays])

  const selectedExecution = selectedDay ? executionMap[selectedDay.dayIndex] || null : null
  const selectedStatus = selectedExecution?.status || (selectedDay && completionDates[selectedDay.dayIndex] ? 'completed' : 'none')
  const selectedProgressText = selectedExecution && (selectedExecution.total_sets || 0) > 0
    ? `${selectedExecution.completed_sets || 0}/${selectedExecution.total_sets || 0} 组`
    : (selectedStatus === 'completed' ? '已完成' : '未开始')
  const selectedTemporalStatus = selectedDay ? getTemporalStatus(selectedDay.dayIndex) : 'today'
  const selectedReadOnly = !!selectedDay && selectedDay.type === 'training' && selectedTemporalStatus !== 'today'

  const coachQuery = useMemo(() => {
    if (!coachId) return ''
    return `&coachId=${encodeURIComponent(coachId)}${coachName ? `&coachName=${encodeURIComponent(coachName)}` : ''}`
  }, [coachId, coachName])

  const goExecution = useCallback((dayIndex: number) => {
    if (!instance?.id) return

    const temporalStatus = getTemporalStatus(dayIndex)
    const readOnly = temporalStatus !== 'today'

    Taro.navigateTo({
      url: `/coach/plans/dashboard/[id]/training-execution?id=${encodeURIComponent(instance.id)}&dayIndex=${dayIndex}&readOnly=${readOnly ? 'true' : 'false'}${coachQuery}`
    }).catch((error) => {
      console.error('[coach/plans/dashboard] goExecution error:', error)
      Taro.showToast({ title: '页面跳转失败', icon: 'none' })
    })
  }, [coachQuery, getTemporalStatus, instance?.id])

  const handleDayAction = useCallback(() => {
    if (!selectedDay || selectedDay.type !== 'training') return
    goExecution(selectedDay.dayIndex)
  }, [goExecution, selectedDay])

  if (!planId) {
    return (
      <View className='plan-dashboard-page'>
        <View className='loading-wrap'>参数错误</View>
        <BottomNav />
      </View>
    )
  }

  if (loading) {
    return (
      <View className='plan-dashboard-page'>
        <ScrollView scrollY className='dashboard-scroll'>
          <View className='skeleton-card'>
            <View className='skeleton-line title' />
            <View className='skeleton-line' />
            <View className='skeleton-line short' />
          </View>
          <View className='skeleton-card'>
            <View className='skeleton-line title' />
            <View className='skeleton-line' />
            <View className='skeleton-line' />
          </View>
        </ScrollView>
        <BottomNav />
      </View>
    )
  }

  if (!instance) {
    return (
      <View className='plan-dashboard-page'>
        <ScrollView scrollY className='dashboard-scroll'>
          <View className='empty-card'>
            <Text className='empty-title'>未找到训练计划</Text>
            <Text className='empty-desc'>该计划可能已失效或暂无权限访问</Text>
            <View className='empty-btn' onClick={() => Taro.navigateBack()}>
              <Text>返回</Text>
            </View>
          </View>
        </ScrollView>
        <BottomNav />
      </View>
    )
  }

  const trainingDayCount = sortedDays.filter((day) => day.type === 'training').length
  const completedTrainingDays = Object.keys(completionDates).length
  const canGoPrevWeek = selectedWeek > 1
  const canGoNextWeek = selectedWeek < totalWeeks
  const actionLabel = !selectedDay || selectedDay.type !== 'training'
    ? '休息日'
    : selectedStatus === 'in_progress'
      ? '继续训练'
      : selectedStatus === 'completed'
        ? '查看记录'
        : selectedReadOnly
          ? '查看计划'
          : '开始训练'

  return (
    <View className='plan-dashboard-page'>
      <ScrollView scrollY className='dashboard-scroll'>
        <View className='plan-card'>
          <Text className='plan-title'>{instance.name || '训练计划'}</Text>
          <Text className='plan-desc'>{instance.description || '计划详情'}</Text>

          <View className='stats-row'>
            <View className='stat-item'>
              <Text className='stat-value'>{completedTrainingDays}</Text>
              <Text className='stat-label'>已完成</Text>
            </View>
            <View className='stat-item'>
              <Text className='stat-value'>{trainingDayCount}</Text>
              <Text className='stat-label'>训练日</Text>
            </View>
            <View className='stat-item'>
              <Text className='stat-value'>{sortedDays.length}</Text>
              <Text className='stat-label'>总天数</Text>
            </View>
          </View>
        </View>

        <View className='week-card'>
          <View className='week-header'>
            <View className={`week-switch-btn ${canGoPrevWeek ? '' : 'disabled'}`} onClick={() => canGoPrevWeek && setSelectedWeek((w) => w - 1)}>
              <Text>‹</Text>
            </View>
            <Text className='week-title'>第 {selectedWeek} 周</Text>
            <View className={`week-switch-btn ${canGoNextWeek ? '' : 'disabled'}`} onClick={() => canGoNextWeek && setSelectedWeek((w) => w + 1)}>
              <Text>›</Text>
            </View>
          </View>

          <View className='week-days'>
            {weekDays.map((day) => {
              const dayExecution = executionMap[day.dayIndex]
              const dayStatus = dayExecution?.status || (completionDates[day.dayIndex] ? 'completed' : 'none')
              const selected = selectedDay?.dayIndex === day.dayIndex
              const temporal = getTemporalStatus(day.dayIndex)
              const isReadOnlyDay = day.type === 'training' && temporal !== 'today'

              return (
                <View
                  key={day.dayIndex}
                  className={`week-day-item ${selected ? 'selected' : ''} ${day.type === 'rest' ? 'rest' : ''}`}
                  onClick={() => setSelectedDayIndex(day.dayIndex)}
                >
                  <Text className='week-day-title'>第{day.dayIndex}天</Text>
                  <Text className='week-day-date'>{formatDateLabel(day.dayIndex) || '--'}</Text>
                  {day.type === 'rest' ? (
                    <Text className='week-day-status rest'>休息</Text>
                  ) : dayStatus === 'completed' ? (
                    <Text className='week-day-status completed'>已完成</Text>
                  ) : dayStatus === 'in_progress' ? (
                    <Text className='week-day-status progress'>进行中</Text>
                  ) : isReadOnlyDay ? (
                    <Text className='week-day-status readonly'>只读</Text>
                  ) : (
                    <Text className='week-day-status pending'>待训练</Text>
                  )}
                </View>
              )
            })}
          </View>
        </View>

        <View className='today-card'>
          <View className='today-head'>
            <Text className='today-title'>{selectedDay ? `第 ${selectedDay.dayIndex} 天` : '训练日'}</Text>
            <Text
              className={`today-status ${
                selectedStatus === 'in_progress'
                  ? 'status-progress'
                  : selectedStatus === 'completed'
                    ? 'status-done'
                    : 'status-pending'
              }`}
            >
              {selectedStatus === 'in_progress' ? '进行中' : selectedStatus === 'completed' ? '已完成' : '待开始'}
            </Text>
          </View>
          <Text className='today-desc'>
            {selectedDay?.type === 'rest'
              ? '休息日，无需训练'
              : `${selectedProgressText}${selectedReadOnly ? ' · 只读查看' : ''}`}
          </Text>
          {selectedDay?.type === 'training' && selectedReadOnly && (
            <Text className='readonly-note'>该训练日不是今天，按网页逻辑仅支持只读查看</Text>
          )}
          <View
            className={`today-action ${selectedDay?.type !== 'training' ? 'disabled' : ''}`}
            onClick={handleDayAction}
          >
            <Text>{actionLabel}</Text>
          </View>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default CoachPlanDashboard
