import React, { useState, useMemo, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { formatMonthDay } from '@/utils/dateFormat'
import { formatKgValueForGym } from '@/utils/weightQuantize'
import { ArrowLeft, ArrowRight, Check, Heart, Location } from '@nutui/icons-react-taro'
import './BrowseSection.scss'

interface BrowseSectionProps {
  instance: any
  actions: Record<string, any>
  currentDayIndex: number
  selectedDayIndex?: number
  onSelectedDayChange?: (dayIndex: number) => void
  completionDates?: Record<number, string>
  todayCompleted?: boolean
  coachId?: string
  coachName?: string
}

function BrowseSection({
  instance,
  actions,
  currentDayIndex,
  selectedDayIndex,
  onSelectedDayChange,
  completionDates = {},
  todayCompleted = false,
  coachId,
  coachName
}: BrowseSectionProps) {
  if (!instance) return null
  const [internalSelectedDayIndex, setInternalSelectedDayIndex] = useState(currentDayIndex)

  const activeSelectedDayIndex = typeof selectedDayIndex === 'number' ? selectedDayIndex : internalSelectedDayIndex
  const trainingDays = (instance?.training_days || []) as any[]
  const startExecutionDay = instance?.start_execution_day || 1

  // 计算总周数
  const totalWeeks = Math.ceil(trainingDays.length / 7)

  // 根据当前选中的天计算当前显示的周
  const [currentWeek, setCurrentWeek] = useState(() => {
    const startWeek = Math.ceil(currentDayIndex / 7)
    return Math.max(1, Math.min(startWeek, totalWeeks))
  })

  useEffect(() => {
    if (typeof selectedDayIndex !== 'number') {
      setInternalSelectedDayIndex(currentDayIndex)
    }
    const targetWeek = Math.ceil(currentDayIndex / 7)
    setCurrentWeek(Math.max(1, Math.min(targetWeek, totalWeeks || 1)))
  }, [currentDayIndex, totalWeeks, selectedDayIndex])

  // 计算当前周的训练日范围
  const weekDays = useMemo(() => {
    const startDay = (currentWeek - 1) * 7 + 1
    return Array.from({ length: 7 }, (_, i) => startDay + i).filter(d => d <= trainingDays.length)
  }, [currentWeek, trainingDays.length])

  const selectedDay = trainingDays.find(d => d.dayIndex === activeSelectedDayIndex)

  // 检查训练日是否已完成
  const isDayCompleted = (dayIndex: number): boolean => {
    return !!completionDates[dayIndex]
  }

  // 获取完成日期
  const getCompletedDate = (dayIndex: number): Date | null => {
    const dateStr = completionDates[dayIndex]
    return dateStr ? new Date(dateStr) : null
  }

  const handlePrevWeek = () => {
    if (currentWeek > 1) {
      setCurrentWeek(currentWeek - 1)
    }
  }

  const handleNextWeek = () => {
    if (currentWeek < totalWeeks) {
      setCurrentWeek(currentWeek + 1)
    }
  }

  const handleViewTraining = (dayIndex: number) => {
    // 跳转到训练执行页面
    if (instance?.id) {
      const coachQuery = coachId
        ? `&coachId=${encodeURIComponent(coachId)}${coachName ? `&coachName=${encodeURIComponent(coachName)}` : ''}`
        : ''
      Taro.navigateTo({
        url: `/training/training-execution?instanceId=${instance.id}&dayIndex=${dayIndex}&intent=preview${coachQuery}`
      }).catch(() => {
        Taro.showToast({
          title: '跳转失败',
          icon: 'none'
        })
      })
    }
  }

  const handleSelectDay = (dayIndex: number) => {
    if (onSelectedDayChange) {
      onSelectedDayChange(dayIndex)
      return
    }
    setInternalSelectedDayIndex(dayIndex)
  }

  return (
    <View className='browse-section'>
      {/* 标题和周切换 */}
      <View className='section-header'>
        <Text className='section-title'>浏览训练日</Text>
        <View className='week-nav'>
          <View
            className={`nav-btn ${currentWeek === 1 ? 'disabled' : ''}`}
            onClick={handlePrevWeek}
          >
            <ArrowLeft size={10} />
          </View>
          <Text className='week-text'>第 {currentWeek} 周</Text>
          <View
            className={`nav-btn ${currentWeek === totalWeeks ? 'disabled' : ''}`}
            onClick={handleNextWeek}
          >
            <ArrowRight size={10} />
          </View>
        </View>
      </View>

      {/* 周日历 */}
      <View className='week-calendar'>
        {weekDays.map((dayIndex) => {
          const day = trainingDays.find(d => d.dayIndex === dayIndex)
          const isTrainingDay = day && day.type === 'training'
          const isRecommended = dayIndex === currentDayIndex
          const isSelected = activeSelectedDayIndex === dayIndex
          const isBeforeStart = dayIndex < startExecutionDay
          const isCompleted = isDayCompleted(dayIndex)

          return (
            <View
              key={dayIndex}
              className={`calendar-day ${isSelected ? 'selected' : ''} ${isBeforeStart ? 'before-start' : ''} ${isCompleted ? 'completed' : ''} ${isRecommended && !isSelected && !todayCompleted ? 'recommended' : ''}`}
              onClick={() => handleSelectDay(dayIndex)}
            >
              {/* 完成标记 */}
              {(isBeforeStart || isCompleted) && (
                <View className='completed-mark'>
                  <Text className='mark-icon'><Check size={10} /></Text>
                </View>
              )}

              <Text className='day-label'>第{dayIndex}天</Text>
              <Text className='day-number'>{dayIndex}</Text>
              <Text className='day-type'>
                {isBeforeStart ? '已完成' : isCompleted ? <Check size={10} /> : isTrainingDay ? '训练' : '休息'}
              </Text>
              {isRecommended && !isSelected && !todayCompleted && (
                <Text className='recommended-dot'><Location size={10} /></Text>
              )}
            </View>
          )
        })}

        {/* 填充空位 */}
        {Array.from({ length: 7 - weekDays.length }).map((_, i) => (
          <View key={`empty-${i}`} className='calendar-day empty' />
        ))}
      </View>

      {/* 选中日期的详情 */}
      {selectedDay ? (
        selectedDay.type === 'training' ? (
          <View className='day-detail'>
            <View className='detail-header'>
              <Text className='detail-title'>
                第 {activeSelectedDayIndex} 天
                {isDayCompleted(activeSelectedDayIndex) && (
                  <Text className='completed-label'>
                    <Check size={10} /> {formatMonthDay(getCompletedDate(activeSelectedDayIndex))} 已完成
                  </Text>
                )}
              </Text>
              <Text className='detail-count'>
                {selectedDay.actionSets?.length || 0} 个动作
              </Text>
            </View>

            <View className='detail-actions'>
              {(selectedDay.actionSets || []).map((actionSet: any, idx: number) => {
                const actionId = actionSet.action_id || actionSet.actionId
                const action = actions[actionId]
                const params = actionSet.params || {}
                const load = params.load
                const intensity = params['强度'] || actionSet.intensity

                return (
                  <View key={idx} className='detail-action-item'>
                    <Text className='action-name'>
                      {idx + 1}. {action?.name || actionSet.set_name}
                    </Text>
                    <View className='action-info'>
                      <Text className='info-text'>
                        {params['组数'] || actionSet.sets || 1}组 × {params['次数'] || actionSet.reps || 1}次
                      </Text>
                      {(() => {
                        if (load !== null && load !== undefined) {
                          const numericLoad = Number(load)
                          if (!Number.isFinite(numericLoad)) return null

                          if (numericLoad < 0) {
                            return (
                              <Text className='info-weight assist'>
                                辅助{formatKgValueForGym(Math.abs(numericLoad))}kg
                              </Text>
                            )
                          }
                          if (numericLoad > 0) {
                            return (
                              <Text className='info-weight'>
                                {formatKgValueForGym(numericLoad)}kg
                              </Text>
                            )
                          }
                        }
                        if (intensity) {
                          return <Text className='info-intensity'>· {intensity}RM</Text>
                        }
                        return null
                      })()}
                    </View>
                  </View>
                )
              })}
            </View>

            {/* 查看/开始按钮 */}
            <View className='detail-btn' onClick={() => handleViewTraining(activeSelectedDayIndex)}>
              <Text className='btn-text'>
                查看训练安排
              </Text>
            </View>
          </View>
        ) : (
          <View className='rest-day-detail'>
            <Text className='rest-emoji'><Heart size={40} /></Text>
            <Text className='rest-title'>休息日</Text>
            <Text className='rest-desc'>今天好好休息，为下次训练做准备</Text>
          </View>
        )
      ) : (
        <View className='no-selection'>
          <Text className='no-selection-text'>请选择日期查看训练内容</Text>
        </View>
      )}
    </View>
  )
}

export default BrowseSection
