import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { executionService } from '@/services/executionService'
import { trainingHistoryService } from '@/services/trainingHistoryService'
import type { TrainingDayHistoryItem } from '@/services/trainingHistoryService'
import { formatHourMinute } from '@/utils/dateFormat'
import {
  buildSharePath,
  buildPublicTrainingSharePath,
  createSharePayload,
  createTimelinePayload,
  openCoachLinkShareMenu
} from '@/utils/share'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useTheme } from '@/hooks/useTheme'

const getMonthKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const getSourceLabel = (sourceType: string) => {
  if (sourceType === 'IMPROMPTU') return '即兴'
  if (sourceType === 'SELF_PLAN') return '我的计划'
  return '教练计划'
}

export default function TrainingHistoryPage() {
  const { effectiveTheme } = useTheme()
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [calendarDays, setCalendarDays] = useState<Record<string, number>>({})
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [dayItems, setDayItems] = useState<TrainingDayHistoryItem[]>([])
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [monthStats, setMonthStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadingDay, setLoadingDay] = useState(false)
  const [sharingItemId, setSharingItemId] = useState<string | null>(null)

  const monthKey = useMemo(() => getMonthKey(currentMonth), [currentMonth])
  const sharePayload = useMemo(
    () =>
      createSharePayload({
        title: 'CoachLink 训练记录：回看每一次打卡与进步',
        path: buildSharePath('/me/training-history/index')
      }),
    []
  )

  useShareAppMessage(() => sharePayload)
  useShareTimeline(() => createTimelinePayload(sharePayload))

  const monthGrid = useMemo(() => {
    const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const startWeekday = first.getDay()
    const daysInMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0
    ).getDate()
    const cells: Array<{ day: number | null; dateKey: string | null }> = []
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ day: null, dateKey: null })
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${monthKey}-${String(day).padStart(2, '0')}`
      cells.push({ day, dateKey: date })
    }
    return cells
  }, [currentMonth, monthKey])

  useEffect(() => {
    openCoachLinkShareMenu()
  }, [])

  useEffect(() => {
    const loadMonth = async () => {
      setLoading(true)
      try {
        const [calendar, stats] = await Promise.all([
          trainingHistoryService.getCalendar(monthKey),
          trainingHistoryService.getMonthShare(monthKey)
        ])
        const dayMap: Record<string, number> = {}
        for (const item of calendar?.days || []) {
          dayMap[item.date] = item.sessions
        }
        setCalendarDays(dayMap)
        setMonthStats(stats || null)
      } catch (error) {
        Taro.showToast({ title: '训练记录加载失败', icon: 'none' })
      } finally {
        setLoading(false)
      }
    }
    loadMonth()
  }, [monthKey])

  const loadDay = async (date: string) => {
    setLoadingDay(true)
    try {
      const data = await trainingHistoryService.getDayHistory(date)
      setDayItems(data?.items || [])
      setExpandedItemId(null)
      setSelectedDate(date)
    } catch (error) {
      Taro.showToast({ title: '当天记录加载失败', icon: 'none' })
    } finally {
      setLoadingDay(false)
    }
  }

  const handleImpromptu = () => {
    Taro.navigateTo({ url: '/me/action-lib/index?mode=impromptu-select&source=frequent&itemType=STRENGTH' })
  }

  const handleShareHistoryItem = useCallback(async (item: TrainingDayHistoryItem) => {
    if (!item?.id || item.status !== 'completed') {
      Taro.showToast({ title: '仅已完成训练支持分享', icon: 'none' })
      return
    }

    setSharingItemId(item.id)
    try {
      const shareInfo = await executionService.getShareInfo(item.id)
      const sharePath = buildPublicTrainingSharePath(shareInfo?.shareToken)
      if (!sharePath) {
        Taro.showToast({ title: '当前记录暂不支持分享', icon: 'none' })
        return
      }
      Taro.navigateTo({ url: sharePath })
    } catch (error) {
      console.error('[training-history] share failed', error)
      Taro.showToast({ title: '分享链接生成失败', icon: 'none' })
    } finally {
      setSharingItemId((prev) => (prev === item.id ? null : prev))
    }
  }, [])

  return (
    <View className={`training-history-page theme-${effectiveTheme}`}>
      <View className='page-header'>
        <View className='header-left' onClick={() => Taro.navigateBack()}>
          <Text className='back-icon'>←</Text>
        </View>
        <View className='impromptu-btn' onClick={handleImpromptu}>
          <Text> 即兴锻炼</Text>
        </View>
      </View>

      <ScrollView scrollY className='page-scroll'>
        {loading ? (
          <View className='calendar-card loading'>
            <LoadingSpinner size={48} />
          </View>
        ) : (
          <View className='calendar-card'>
            <View className='calendar-nav'>
              <Text className='month-label'>{monthKey}</Text>
              <View className='nav-btns'>
                <Text
                  className='nav-btn'
                  onClick={() =>
                    setCurrentMonth(
                      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
                    )
                  }
                >
                  ‹
                </Text>
                <Text
                  className='nav-btn'
                  onClick={() =>
                    setCurrentMonth(
                      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
                    )
                  }
                >
                  ›
                </Text>
              </View>
            </View>
            <View className='calendar-grid'>
              {['日', '一', '二', '三', '四', '五', '六'].map(w => (
                <View key={w} className='weekday-cell'>
                  <Text>{w}</Text>
                </View>
              ))}
              {monthGrid.map((cell, idx) => (
                <View
                  key={`${cell.dateKey || 'blank'}-${idx}`}
                  className={`day-cell ${!cell.dateKey ? 'empty' : ''} ${selectedDate === cell.dateKey ? 'selected' : ''}`}
                  onClick={() => cell.dateKey && loadDay(cell.dateKey)}
                >
                  {cell.day && (
                    <>
                      <Text className='day-num'>{cell.day}</Text>
                      {cell.dateKey && calendarDays[cell.dateKey] > 0 && (
                        <Text className='day-sessions'>{calendarDays[cell.dateKey]}次</Text>
                      )}
                    </>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {monthStats && (
          <View className='stats-card'>
            <View className='stat-row'>
              <View className='stat-item'>
                <Text className='stat-label'>训练天数</Text>
                <Text className='stat-value'>{monthStats.trainingDays}</Text>
              </View>
              <View className='stat-item'>
                <Text className='stat-label'>训练次数</Text>
                <Text className='stat-value'>{monthStats.totalSessions}</Text>
              </View>
            </View>
            <View className='stat-row'>
              <View className='stat-item'>
                <Text className='stat-label'>完成组数</Text>
                <Text className='stat-value'>{monthStats.totalSets}</Text>
              </View>
              <View className='stat-item'>
                <Text className='stat-label'>来源占比</Text>
                <Text className='stat-value stat-breakdown'>
                  即兴{monthStats.sourceBreakdown?.impromptu || 0} / 我的{monthStats.sourceBreakdown?.selfPlan || 0} / 教练{monthStats.sourceBreakdown?.coachPlan || 0}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View className='detail-card'>
          <Text className='detail-title'>
            {selectedDate ? `${selectedDate} 训练明细` : '选择日期查看训练明细'}
          </Text>
          {loadingDay ? (
            <LoadingSpinner size={48} />
          ) : dayItems.length === 0 ? (
            <Text className='empty-text'>暂无训练记录</Text>
          ) : (
            <View className='detail-list'>
              {dayItems.map(item => (
                <View
                  key={`${item.sourceType}-${item.id}`}
                  className='detail-item'
                  onClick={() => setExpandedItemId(prev => (prev === item.id ? null : item.id))}
                >
                  <View className='detail-item-header'>
                    <View>
                      <Text className='item-title'>{item.title}</Text>
                      <Text className='item-time'>
                        {formatHourMinute(item.startedAt)}
                      </Text>
                    </View>
                    <View className='item-tags'>
                      <Text className='tag source'>{getSourceLabel(item.sourceType)}</Text>
                      <Text className='tag sets'>
                        {item.completedSets}/{item.totalSets}组
                      </Text>
                    </View>
                  </View>
                  {expandedItemId === item.id && (
                    <View className='detail-item-expand'>
                      {Array.isArray(item.actionSummaries) && item.actionSummaries.length > 0 ? (
                        item.actionSummaries.map((action: any, idx: number) => (
                          <View key={idx} className='action-row'>
                            <Text>{action.actionName}</Text>
                            <Text className='action-sets'>
                              {action.completedSets}/{action.totalSets}组
                            </Text>
                          </View>
                        ))
                      ) : (
                        <Text className='empty-text'>暂无动作明细</Text>
                      )}
                      {item.status === 'completed' && (
                        <View className='item-actions'>
                          <View
                            className={`share-action ${sharingItemId === item.id ? 'disabled' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleShareHistoryItem(item)
                            }}
                          >
                            <Text>{sharingItemId === item.id ? '正在准备分享...' : '分享本次训练'}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
