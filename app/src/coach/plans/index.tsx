import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { subscriptionService } from '@/services/subscriptionService'
import { trainingService } from '@/services/trainingService'
import { authService } from '@/services/authService'
import './index.scss'

function CoachPlans() {
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [activeSubscriptionId, setActiveSubscriptionId] = useState<string | null>(null)
  const [instances, setInstances] = useState<Record<string, any>>({})
  const [instanceLoading, setInstanceLoading] = useState<Record<string, boolean>>({})
  const [actions, setActions] = useState<Record<string, any>>({})
  const [selfPlan, setSelfPlan] = useState<any>(null)
  const [selfPlanLoading, setSelfPlanLoading] = useState(false)
  const [selfPlanActions, setSelfPlanActions] = useState<Record<string, any>>({})
  const [planMode, setPlanMode] = useState<'coach' | 'self'>('coach')
  const [loading, setLoading] = useState(true)

  const userId = authService.getCurrentUser()?.id

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // 1. 加载订阅
      const subsResponse = await subscriptionService.getCoachSubscriptions({ studentId: userId })
      const activeSubs = (subsResponse?.subscriptions || []).filter((s: any) => !!s?.id)
      setSubscriptions(activeSubs)
      if (activeSubs.length > 0) {
        setActiveSubscriptionId(activeSubs[0].id)
      }

      // 2. 加载自建计划
      setSelfPlanLoading(true)
      try {
        const selfRes = await trainingService.getInstance({ fetchSelf: true })
        if (selfRes?.instance) {
          setSelfPlan(selfRes.instance)
          setSelfPlanActions(selfRes.actions || {})
        }
      } catch (e) {
        console.error('加载自建计划失败:', e)
      } finally {
        setSelfPlanLoading(false)
      }

      // 3. 加载教练计划
      if (activeSubs.length > 0 && activeSubs[0].id) {
        const subId = activeSubs[0].id
        setInstanceLoading(prev => ({ ...prev, [subId]: true }))
        try {
          const res = await trainingService.getInstance({ subscriptionId: subId })
          if (res?.instance) {
            setInstances(prev => ({ ...prev, [subId]: res.instance }))
            setActions(prev => ({ ...prev, ...(res.actions || {}) }))
          }
        } catch (e) {
          console.error('加载教练计划失败:', e)
        } finally {
          setInstanceLoading(prev => ({ ...prev, [subId]: false }))
        }
      }

      // 设置默认显示模式
      if (activeSubs.length > 0) {
        setPlanMode('coach')
      } else if (selfPlan) {
        setPlanMode('self')
      }
    } catch (error) {
      console.error('加载数据失败:', error)
      Taro.showToast({
        title: '加载失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }, [userId, selfPlan])

  useDidShow(() => {
    loadData()
  })

  usePullDownRefresh(() => {
    loadData().finally(() => Taro.stopPullDownRefresh())
  })

  const handlePlanClick = (instanceId: string, sub?: any | null) => {
    const coachId = sub?.coach_id || sub?.coach?.id || ''
    const coachName = sub?.coach?.name || ''
    const coachQuery = coachId
      ? `&coachId=${encodeURIComponent(coachId)}${coachName ? `&coachName=${encodeURIComponent(coachName)}` : ''}`
      : ''

    Taro.navigateTo({
      url: `/coach/plans/dashboard/[id]?id=${encodeURIComponent(instanceId)}${coachQuery}`
    })
  }

  const getStatusConfig = (status?: string) => {
    const config: Record<string, { label: string; color: string }> = {
      active: { label: '进行中', color: '#10b981' },
      draft: { label: '草稿', color: '#f59e0b' },
      completed: { label: '已完成', color: '#3b82f6' },
      paused: { label: '已暂停', color: '#6b7280' },
      archived: { label: '已归档', color: '#9ca3af' }
    }
    return config[status || ''] || { label: status || '未知', color: '#6b7280' }
  }

  if (loading || selfPlanLoading) {
    return (
      <View className='coach-plans-page'>
        <ScrollView className='page-scroll' scrollY>
          <View className='loading-container'>
            <View className='skeleton-card'>
              <View className='skeleton-header' />
              <View className='skeleton-body'>
                <View className='skeleton-line' />
                <View className='skeleton-line' />
              </View>
            </View>
          </View>
        </ScrollView>
        <BottomNav />
      </View>
    )
  }

  const hasAnyPlan = subscriptions.length > 0 || selfPlan
  const hasBothPlans = subscriptions.length > 0 && selfPlan

  if (!hasAnyPlan) {
    return (
      <View className='coach-plans-page'>
        <ScrollView className='page-scroll' scrollY>
          <View className='empty-state'>
            <View className='empty-icon'>📋</View>
            <Text className='empty-title'>暂无训练计划</Text>
            <Text className='empty-desc'>订阅教练或创建自己的计划开始训练</Text>
            <View className='empty-actions'>
              <View className='action-btn primary' onClick={() => Taro.redirectTo({ url: '/discovery/index' })}>
                <Text>发现教练</Text>
              </View>
            </View>
          </View>
        </ScrollView>
        <BottomNav />
      </View>
    )
  }

  const activeInstance = planMode === 'coach' 
    ? (activeSubscriptionId ? instances[activeSubscriptionId] : null)
    : selfPlan

  return (
    <View className='coach-plans-page'>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          {/* 计划类型切换器 */}
          {hasBothPlans && (
            <View className='plan-switcher'>
              <View
                className={`switcher-btn ${planMode === 'coach' ? 'active' : ''}`}
                onClick={() => setPlanMode('coach')}
              >
                <Text>👤 教练计划</Text>
              </View>
              <View
                className={`switcher-btn ${planMode === 'self' ? 'active' : ''}`}
                onClick={() => setPlanMode('self')}
              >
                <Text>⭐ 我的计划</Text>
              </View>
            </View>
          )}

          {/* 教练计划列表 */}
          {planMode === 'coach' && subscriptions.length > 0 && (
            <View className='plans-section'>
              <View className='section-header'>
                <Text className='section-title'>教练计划</Text>
                <Text className='section-subtitle'>{subscriptions.length} 个订阅</Text>
              </View>
              {subscriptions.map((sub) => {
                const instance = instances[sub.id]
                const isLoading = instanceLoading[sub.id]
                if (isLoading) {
                  return (
                    <View key={sub.id} className='plan-card skeleton'>
                      <View className='skeleton-line' />
                      <View className='skeleton-line' />
                    </View>
                  )
                }
                if (!instance) {
                  return (
                    <View key={sub.id} className='plan-card waiting'>
                      <Text className='waiting-title'>计划制定中</Text>
                      <Text className='waiting-desc'>{sub.coach?.name || '教练'}正在为您制定计划</Text>
                    </View>
                  )
                }
                const statusConfig = getStatusConfig(instance.status)
                const trainingDays = (instance.training_days || []) as any[]
                const trainingDayCount = trainingDays.filter((d: any) => d.type === 'training').length
                return (
                  <View
                    key={sub.id}
                    className='plan-card'
                    onClick={() => handlePlanClick(instance.id, sub)}
                  >
                    <View className='plan-header'>
                      <View className='plan-title-wrap'>
                        <Text className='plan-title'>{instance.name || '定制训练计划'}</Text>
                        <View className='status-badge' style={{ backgroundColor: statusConfig.color + '20', color: statusConfig.color }}>
                          <Text>{statusConfig.label}</Text>
                        </View>
                      </View>
                      <Text className='plan-desc'>{instance.description || '这是教练为您量身打造的阶段性训练目标'}</Text>
                    </View>
                    <View className='plan-stats'>
                      <View className='stat-item'>
                        <Text className='stat-label'>训练日</Text>
                        <Text className='stat-value'>{trainingDayCount} 天</Text>
                      </View>
                      <View className='stat-item'>
                        <Text className='stat-label'>动作总数</Text>
                        <Text className='stat-value'>
                          {trainingDays.reduce((sum: number, day: any) => sum + (day.actionSets?.length || 0), 0)} 项
                        </Text>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          )}

          {/* 自建计划 */}
          {planMode === 'self' && selfPlan && (
            <View className='plans-section'>
              <View className='section-header'>
                <Text className='section-title'>我的自建计划</Text>
              </View>
              <View
                className='plan-card'
                onClick={() => handlePlanClick(selfPlan.id, null)}
              >
                <View className='plan-header'>
                  <View className='plan-title-wrap'>
                    <Text className='plan-title'>{selfPlan.name || '我的自建计划'}</Text>
                    <View className='status-badge' style={{ backgroundColor: '#10b98120', color: '#10b981' }}>
                      <Text>进行中</Text>
                    </View>
                  </View>
                  <Text className='plan-desc'>{selfPlan.description || '自我驱动，超越极限'}</Text>
                </View>
                <View className='plan-stats'>
                  <View className='stat-item'>
                    <Text className='stat-label'>训练日</Text>
                    <Text className='stat-value'>
                      {(selfPlan.training_days || []).filter((d: any) => d.type === 'training').length} 天
                    </Text>
                  </View>
                  <View className='stat-item'>
                    <Text className='stat-label'>动作总数</Text>
                    <Text className='stat-value'>
                      {(selfPlan.training_days || []).reduce((sum: number, day: any) => sum + (day.actionSets?.length || 0), 0)} 项
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default CoachPlans
