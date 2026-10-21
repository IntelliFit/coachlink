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
import { ClButton, ClTag } from '@/components/ui'
import { toBeijingDateKey } from '@coachlink/core/src/beijingTime'

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
        autoSelectDay(dayMap)
      } catch (error) {
        Taro.showToast({ title: '训练记录加载失败', icon: 'none' })
      } finally {
        setLoading(false)
      }
    }
    loadMonth()
  }, [monthKey])

  // Open on something useful: the latest trained day up to today in this month, else today.
  const autoSelectRef = React.useRef(false)
  const autoSelectDay = (dayMap: Record<string, number>) => {
    if (autoSelectRef.current) return
    const today = toBeijingDateKey(new Date())
    const trained = Object.keys(dayMap).filter((date) => dayMap[date] > 0 && date <= today).sort()
    const pick = trained[trained.length - 1] || (today.startsWith(monthKey) ? today : '')
    if (!pick) return
    autoSelectRef.current = true
    void loadDay(pick)
  }

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

  const today = toBeijingDateKey(new Date())
  const [yearText, monthText] = monthKey.split('-')
  const stats = [
    { key: 'days', label: '训练天数', value: monthStats?.trainingDays ?? 0 },
    { key: 'sessions', label: '训练次数', value: monthStats?.totalSessions ?? 0 },
    { key: 'sets', label: '完成组数', value: monthStats?.totalSets ?? 0 }
  ]
  const shiftMonth = (delta: number) => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1))

  return (
    <View className={`th-page theme-${effectiveTheme} ${effectiveTheme === 'dark' ? 'cl-theme-dark' : ''}`}>
      <ScrollView scrollY className='th-scroll'>
        <View className='th-body'>
          <View className='th-stats'>
            {stats.map((item) => (
              <View key={item.key} className='th-stat'>
                <Text className='th-stat__value cl-num'>{item.value}</Text>
                <Text className='th-stat__label'>本月{item.label}</Text>
              </View>
            ))}
          </View>
          {monthStats ? (
            <Text className='th-source'>
              即兴 {monthStats.sourceBreakdown?.impromptu || 0} 次 · 我的计划 {monthStats.sourceBreakdown?.selfPlan || 0} 次 · 教练计划 {monthStats.sourceBreakdown?.coachPlan || 0} 次
            </Text>
          ) : null}

          <View className='th-calendar'>
            <View className='th-calendar__nav'>
              <Text className='th-calendar__month cl-num'>{yearText}年{Number(monthText)}月</Text>
              <View className='th-calendar__arrows'>
                <View className='th-calendar__arrow' ariaRole='button' ariaLabel='上个月' onClick={() => shiftMonth(-1)}><Text>‹</Text></View>
                <View className='th-calendar__arrow' ariaRole='button' ariaLabel='下个月' onClick={() => shiftMonth(1)}><Text>›</Text></View>
              </View>
            </View>
            {loading ? (
              <View className='th-calendar__loading'><LoadingSpinner size={48} /></View>
            ) : (
              <View className='th-calendar__grid'>
                {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
                  <Text key={w} className='th-calendar__weekday'>{w}</Text>
                ))}
                {monthGrid.map((cell, idx) => {
                  const sessions = cell.dateKey ? calendarDays[cell.dateKey] || 0 : 0
                  const classes = [
                    'th-day',
                    !cell.dateKey ? 'th-day--empty' : '',
                    sessions > 0 ? 'th-day--trained' : '',
                    cell.dateKey === today ? 'th-day--today' : '',
                    selectedDate === cell.dateKey ? 'th-day--selected' : ''
                  ].filter(Boolean).join(' ')
                  return (
                    <View
                      key={`${cell.dateKey || 'blank'}-${idx}`}
                      className={classes}
                      ariaRole={cell.dateKey ? 'button' : undefined}
                      ariaLabel={cell.dateKey ? `${cell.day}日${sessions > 0 ? `，训练 ${sessions} 次` : ''}` : undefined}
                      onClick={() => cell.dateKey && loadDay(cell.dateKey)}
                    >
                      {cell.day ? <Text className='th-day__num cl-num'>{cell.day}</Text> : null}
                      {sessions > 0 ? <View className='th-day__dot' /> : null}
                    </View>
                  )
                })}
              </View>
            )}
          </View>

          <View className='th-detail'>
            <Text className='th-detail__title'>
              {selectedDate ? `${Number(selectedDate.slice(5, 7))}月${Number(selectedDate.slice(8, 10))}日的训练` : '选择日期查看训练明细'}
            </Text>
            {loadingDay ? (
              <View className='th-calendar__loading'><LoadingSpinner size={48} /></View>
            ) : dayItems.length === 0 ? (
              <Text className='th-empty'>{selectedDate ? '这天没有训练记录' : '点日历上的日期查看当天训练'}</Text>
            ) : (
              <View className='th-list'>
                {dayItems.map((item) => {
                  const expanded = expandedItemId === item.id
                  return (
                    <View
                      key={`${item.sourceType}-${item.id}`}
                      className='th-item'
                      onClick={() => setExpandedItemId((prev) => (prev === item.id ? null : item.id))}
                    >
                      <View className='th-item__head'>
                        <View className='th-item__copy'>
                          <Text className='th-item__title'>{item.title}</Text>
                          <Text className='th-item__meta cl-num'>
                            {formatHourMinute(item.startedAt)} · {item.completedSets}/{item.totalSets} 组
                          </Text>
                        </View>
                        <ClTag tone={item.sourceType === 'COACH_PLAN' ? 'clay' : 'neutral'}>{getSourceLabel(item.sourceType)}</ClTag>
                        <Text className={`th-item__arrow ${expanded ? 'th-item__arrow--open' : ''}`}>›</Text>
                      </View>
                      {expanded ? (
                        <View className='th-item__body'>
                          {Array.isArray(item.actionSummaries) && item.actionSummaries.length > 0 ? (
                            item.actionSummaries.map((action: any, idx: number) => (
                              <View key={idx} className='th-action'>
                                <Text className='th-action__name'>{action.actionName}</Text>
                                <Text className='th-action__sets cl-num'>{action.completedSets}/{action.totalSets} 组</Text>
                              </View>
                            ))
                          ) : (
                            <Text className='th-empty'>暂无动作明细</Text>
                          )}
                          {item.status === 'completed' ? (
                            <Text
                              className={`th-item__share ${sharingItemId === item.id ? 'th-item__share--busy' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleShareHistoryItem(item)
                              }}
                            >
                              {sharingItemId === item.id ? '正在准备分享…' : '分享本次训练 ›'}
                            </Text>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  )
                })}
              </View>
            )}
          </View>

          <ClButton variant='secondary' block onClick={handleImpromptu}>开始即兴训练</ClButton>
        </View>
      </ScrollView>
    </View>
  )
}
