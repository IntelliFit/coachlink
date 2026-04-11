import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { trainingService, PlanInstance } from '@/services/trainingService'
import { subscriptionService } from '@/services/subscriptionService'
import './index.scss'

function PlanCurrent() {
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<any>(null)

  const [coachInstance, setCoachInstance] = useState<PlanInstance | null>(null)
  const [coachDayIndex, setCoachDayIndex] = useState(1)
  const [coachCompletionDates, setCoachCompletionDates] = useState<Record<number, string>>({})

  const [selfInstance, setSelfInstance] = useState<PlanInstance | null>(null)
  const [selfDayIndex, setSelfDayIndex] = useState(1)
  const [selfCompletionDates, setSelfCompletionDates] = useState<Record<number, string>>({})

  const [planMode, setPlanMode] = useState<'coach' | 'self'>('coach')

  const instance = planMode === 'coach' ? coachInstance : selfInstance
  const completionDates = planMode === 'coach' ? coachCompletionDates : selfCompletionDates
  const currentDayIndex = planMode === 'coach' ? coachDayIndex : selfDayIndex

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const user = Taro.getStorageSync('user')
      const userId = user?.id || null
      if (!userId) {
        Taro.redirectTo({
          url: '/auth/login?returnTo=' + encodeURIComponent('/training/plan/current')
        })
        setLoading(false)
        return
      }

      const subsResponse = await subscriptionService.getCoachSubscriptions({ studentId: userId })
      const activeSubs = (subsResponse?.subscriptions || []).filter((s: any) => !!s?.id)

      let coachRes: any = null
      let coachSub: any = null
      if (activeSubs.length > 0) {
        for (const s of activeSubs) {
          try {
            const result = await trainingService.getInstance({ subscriptionId: s.id })
            if (result?.instance) {
              coachRes = result
              coachSub = s
              break
            }
          } catch (e) {
            console.error('[plan/current] load coach plan:', e)
          }
        }
      }

      let selfRes: any = null
      try {
        selfRes = await trainingService.getInstance({ fetchSelf: true })
      } catch (e) {
        console.error('[plan/current] load self plan:', e)
      }

      setSubscription(coachSub || activeSubs[0] || null)

      if (coachRes?.instance) {
        setCoachInstance(coachRes.instance)
        try {
          const nextDayData = await trainingService.getNextTrainingDay({ instanceId: coachRes.instance.id })
          if (nextDayData) {
            setCoachDayIndex(nextDayData.nextDayIndex)
            setCoachCompletionDates(nextDayData.completionDates || {})
          } else {
            setCoachDayIndex(coachRes.instance.start_execution_day || 1)
          }
        } catch {
          setCoachDayIndex(coachRes.instance.start_execution_day || 1)
        }
      }

      if (selfRes?.instance) {
        setSelfInstance(selfRes.instance)
        try {
          const nextDayData = await trainingService.getNextTrainingDay({ instanceId: selfRes.instance.id })
          if (nextDayData) {
            setSelfDayIndex(nextDayData.nextDayIndex)
            setSelfCompletionDates(nextDayData.completionDates || {})
          } else {
            setSelfDayIndex(selfRes.instance.start_execution_day || 1)
          }
        } catch {
          setSelfDayIndex(selfRes.instance.start_execution_day || 1)
        }
      }

      if (coachRes?.instance) setPlanMode('coach')
      else if (selfRes?.instance) setPlanMode('self')
    } catch (error) {
      console.error('[plan/current] loadData:', error)
      Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  Taro.useDidShow(() => {
    loadData()
  })

  const hasAnyPlan = coachInstance || selfInstance
  const hasBothPlans = coachInstance && selfInstance

  const goToDiscovery = () => {
    Taro.navigateTo({ url: '/discovery/index' })
  }

  const goToPlanLib = () => {
    Taro.navigateTo({ url: '/me/plan-lib/index' })
  }

  const goToAllPlans = () => {
    Taro.navigateTo({ url: '/me/plan-history/index' })
  }

  const goToTodayTraining = () => {
    Taro.redirectTo({ url: '/training/today-training' })
  }

  const goToTrainingExecution = (instanceId: string, dayIndex: number, options?: { coachId?: string; coachName?: string }) => {
    const coachId = options?.coachId || ''
    const coachName = options?.coachName || ''
    const coachQuery = coachId
      ? `&coachId=${encodeURIComponent(coachId)}${coachName ? `&coachName=${encodeURIComponent(coachName)}` : ''}`
      : ''
    Taro.navigateTo({
      url: `/training/training-execution?instanceId=${instanceId}&dayIndex=${dayIndex}${coachQuery}`
    }).catch(() => {
      Taro.showToast({ title: '跳转失败', icon: 'none' })
    })
  }

  if (loading) {
    return (
      <View className="plan-current-page">
        <ScrollView className="page-scroll" scrollY>
          <View className="loading-container">
            <View className="skeleton-card">
              <View className="skeleton-header" />
              <View className="skeleton-body">
                <View className="skeleton-line" />
                <View className="skeleton-line" />
                <View className="skeleton-line" />
              </View>
            </View>
            <View className="skeleton-card">
              <View className="skeleton-header" />
              <View className="skeleton-body">
                <View className="skeleton-line" />
                <View className="skeleton-line" />
              </View>
            </View>
          </View>
        </ScrollView>
        <BottomNav />
      </View>
    )
  }

  if (!hasAnyPlan) {
    const hasActiveSubscription = !!subscription?.id
    const coachName = subscription?.coach?.name || subscription?.coach?.title || ''

    if (hasActiveSubscription) {
      return (
        <View className="plan-current-page">
          <ScrollView className="page-scroll" scrollY>
            <View className="page-content">
              <View className="empty-card waiting-card">
                <View className="empty-icon-wrapper">
                  <View className="empty-icon-bg" />
                  <View className="empty-icon-inner">
                    <Text className="empty-icon">🎯</Text>
                  </View>
                </View>
                <Text className="empty-title">计划正在制定中</Text>
                <Text className="empty-desc">
                  {coachName
                    ? `您的教练「${coachName}」正在为您制定训练计划，请耐心等待。`
                    : '您的教练正在为您制定训练计划，请耐心等待。'}
                </Text>
                <View className="empty-actions">
                  <View className="action-btn primary" onClick={goToTodayTraining}>
                    <Text>📋</Text>
                    <Text>今日训练</Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
          <BottomNav />
        </View>
      )
    }

    return (
      <View className="plan-current-page">
        <ScrollView className="page-scroll" scrollY>
          <View className="page-content">
            <View className="empty-card">
              <View className="empty-icon-wrapper">
                <View className="empty-icon-bg" />
                <View className="empty-icon-inner">
                  <Text className="empty-icon">📅</Text>
                </View>
              </View>
              <Text className="empty-title">开启您的训练旅程</Text>
              <Text className="empty-desc">
                订阅教练获取专业计划，或在计划库中创建专属训练
              </Text>
              <View className="empty-actions">
                <View className="action-btn primary" onClick={goToDiscovery}>
                  <Text>🧭</Text>
                  <Text>发现教练</Text>
                </View>
                <View className="action-btn secondary" onClick={goToPlanLib}>
                  <Text>📚</Text>
                  <Text>我的计划库</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
        <BottomNav />
      </View>
    )
  }

  const trainingDays = (instance?.training_days || []) as Array<{ dayIndex: number; type: string; actionSets?: any[] }>
  const sortedDays = [...trainingDays].sort((a, b) => a.dayIndex - b.dayIndex)
  const trainingDayCount = sortedDays.filter(d => d.type === 'training').length
  const completedCount = Object.keys(completionDates).length

  return (
    <View className="plan-current-page">
      <ScrollView className="page-scroll" scrollY>
        <View className="page-content">
          {hasBothPlans && (
            <View className="plan-switcher">
              <View
                className={`switcher-btn ${planMode === 'coach' ? 'active' : ''}`}
                onClick={() => setPlanMode('coach')}
              >
                <Text className="switcher-icon">👤</Text>
                <Text>教练计划</Text>
              </View>
              <View
                className={`switcher-btn ${planMode === 'self' ? 'active' : ''}`}
                onClick={() => setPlanMode('self')}
              >
                <Text className="switcher-icon">⭐</Text>
                <Text>我的计划</Text>
              </View>
            </View>
          )}

          {subscription?.coach && instance?.source !== 'self' && (
            <View className="coach-card">
              <View className="card-bg-decor decor-1" />
              <View className="card-bg-decor decor-2" />
              <View className="card-content">
                <View className="coach-avatar">
                  <View className="avatar-box">
                    <Text className="avatar-text">
                      {subscription.coach.name?.charAt(0) || 'C'}
                    </Text>
                  </View>
                </View>
                <View className="coach-info">
                  <View className="info-labels">
                    <Text className="pro-badge">教练计划</Text>
                  </View>
                  <Text className="coach-name">{subscription.coach.name || '未知教练'}</Text>
                  <Text className="coach-title">{subscription.coach.title || '资深健身专家'}</Text>
                </View>
              </View>
            </View>
          )}

          {instance?.source === 'self' && (
            <View className="coach-card self-plan-card">
              <View className="card-bg-decor decor-1" />
              <View className="card-bg-decor decor-2" />
              <View className="card-content">
                <View className="coach-avatar">
                  <View className="avatar-box">
                    <Text className="avatar-text">ME</Text>
                  </View>
                </View>
                <View className="coach-info">
                  <View className="info-labels">
                    <Text className="pro-badge">自建计划</Text>
                  </View>
                  <Text className="coach-name">{instance.name || '我的计划'}</Text>
                  <Text className="coach-title">自我驱动，超越极限</Text>
                </View>
              </View>
            </View>
          )}

          <View className="stats-row">
            <View className="stat-item">
              <Text className="stat-value">{completedCount}</Text>
              <Text className="stat-label">已完成</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-item">
              <Text className="stat-value">{trainingDayCount}</Text>
              <Text className="stat-label">训练日</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-item">
              <Text className="stat-value">{sortedDays.length}</Text>
              <Text className="stat-label">总天数</Text>
            </View>
          </View>

          <View className="section-header">
            <Text className="section-title">训练安排</Text>
            <Text className="section-subtitle">共 {sortedDays.length} 天</Text>
          </View>

          <View className="day-list">
            {sortedDays.map((day) => {
              const isRest = day.type === 'rest'
              const isCompleted = !!completionDates[day.dayIndex]
              const isCurrent = day.dayIndex === currentDayIndex && !isCompleted

              return (
                <View
                  key={day.dayIndex}
                  className={`day-item ${isRest ? 'day-rest' : ''} ${isCompleted ? 'day-completed' : ''} ${isCurrent ? 'day-current' : ''}`}
                  onClick={() => {
                    if (isRest) return
                    if (instance?.id) {
                      const coachId = planMode === 'coach'
                        ? (subscription?.coach_id || subscription?.coach?.id || '')
                        : ''
                      const coachName = planMode === 'coach'
                        ? (subscription?.coach?.name || '')
                        : ''
                      goToTrainingExecution(instance.id, day.dayIndex, {
                        coachId: coachId || undefined,
                        coachName: coachName || undefined
                      })
                    }
                  }}
                >
                  <View className="day-left">
                    <View className={`day-icon ${isRest ? 'icon-rest' : 'icon-training'}`}>
                      <Text className="day-icon-text">{isRest ? '🌙' : '⚡'}</Text>
                    </View>
                    <View className="day-info">
                      <Text className="day-name">第 {day.dayIndex} 天</Text>
                      <Text className="day-meta">
                        {isRest
                          ? '休息日'
                          : isCompleted
                            ? `已完成${completionDates[day.dayIndex] ? ` · ${completionDates[day.dayIndex].slice(0, 10)}` : ''}`
                            : (day.actionSets?.length || 0) + ' 个动作'}
                      </Text>
                    </View>
                  </View>
                  {!isRest && (
                    <View className="day-right">
                      {isCompleted ? (
                        <Text className="day-badge completed">已完成</Text>
                      ) : (
                        <Text className="day-badge action">去训练</Text>
                      )}
                    </View>
                  )}
                </View>
              )
            })}
          </View>

          <View className="bottom-actions">
            <View className="action-btn primary" onClick={goToTodayTraining}>
              <Text>📋</Text>
              <Text>今日训练</Text>
            </View>
            <View className="action-btn secondary" onClick={goToAllPlans}>
              <Text>🗂</Text>
              <Text>全部计划</Text>
            </View>
          </View>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default PlanCurrent
