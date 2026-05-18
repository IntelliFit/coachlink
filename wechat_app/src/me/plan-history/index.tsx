import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Text, ScrollView, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { Calendar, File } from '@nutui/icons-react-taro'
import BottomNav from '@/components/BottomNav'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { authService } from '@/services/authService'
import { request } from '@/utils/request'
import { formatDateYMD } from '@/utils/dateFormat'
import './index.scss'

interface PlanHistoryItem {
  id: string
  name: string
  description?: string
  status: string
  source: string | null
  start_date: string | null
  end_date: string | null
  total_days?: number
  total_training_days?: number
  plan_span_days?: number
  completion_rate?: number
}

function PlanHistoryPage() {
  const [plans, setPlans] = useState<PlanHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [sourceFilter, setSourceFilter] = useState<'all' | 'coach' | 'student'>('all')
  const didInitFilterEffectRef = useRef(false)
  const limit = 10

  const loadHistory = useCallback(async (targetPage = 1, targetSource = sourceFilter) => {
    try {
      setLoading(true)
      const userId = authService.getCurrentUser()?.id
      if (!userId) {
        Taro.showToast({ title: '请先登录', icon: 'none' })
        return
      }

      const res = await request<{ plans: PlanHistoryItem[]; totalCount: number }>({
        url: '/api/student/plan-lib/list-history',
        method: 'POST',
        data: { page: targetPage, limit, source: targetSource }
      })

      if (res.success && res.data) {
        if (targetPage === 1) {
          setPlans(res.data.plans || [])
        } else {
          setPlans(prev => [...prev, ...(res.data.plans || [])])
        }
        setTotalCount(res.data.totalCount || 0)
      }
    } catch (error) {
      console.error('加载历史计划失败:', error)
      Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [limit, sourceFilter])

  useDidShow(() => {
    setPage(1)
    loadHistory(1, sourceFilter)
  })

  usePullDownRefresh(() => {
    setPage(1)
    loadHistory(1, sourceFilter).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    if (!loading && plans.length < totalCount) {
      const nextPage = page + 1
      setPage(nextPage)
      loadHistory(nextPage, sourceFilter)
    }
  })

  useEffect(() => {
    if (!didInitFilterEffectRef.current) {
      didInitFilterEffectRef.current = true
      return
    }
    setPage(1)
    loadHistory(1, sourceFilter)
  }, [loadHistory, sourceFilter])

  const getStatusConfig = (status: string) => {
    const config: Record<string, { label: string; color: string }> = {
      active: { label: '进行中', color: '#10b981' },
      completed: { label: '已完成', color: '#3b82f6' },
      archived: { label: '已归档', color: '#f59e0b' }
    }
    return config[status] || { label: status, color: '#6b7280' }
  }

  const getSourceLabel = (source: string | null) => {
    return source === 'coach' ? '教练指派' : '我的计划'
  }

  const formatDateRange = (start: string | null, end: string | null) => {
    if (!start) return '-'
    const startDate = formatDateYMD(start)
    const endDate = end ? formatDateYMD(end) : '至今'
    return `${startDate} - ${endDate}`
  }

  const getTrainingDayCount = (plan: PlanHistoryItem) =>
    plan.total_training_days ?? plan.total_days ?? null

  const handlePlanClick = (planId: string) => {
    Taro.navigateTo({ url: `/me/plan-history/detail/index?id=${planId}` })
  }

  return (
    <View className='plan-history-page'>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          <View className='page-header'>
            <View className='calendar-entry' onClick={() => Taro.navigateTo({ url: '/me/training-history/index' })}>
              <Text>训练记录</Text>
            </View>
          </View>

          <View className='filter-bar'>
            <View
              className={`filter-item ${sourceFilter === 'all' ? 'active' : ''}`}
              onClick={() => setSourceFilter('all')}
            >
              <Text>全部计划</Text>
            </View>
            <View
              className={`filter-item ${sourceFilter === 'coach' ? 'active' : ''}`}
              onClick={() => setSourceFilter('coach')}
            >
              <Text>教练指派</Text>
            </View>
            <View
              className={`filter-item ${sourceFilter === 'student' ? 'active' : ''}`}
              onClick={() => setSourceFilter('student')}
            >
              <Text>我的计划</Text>
            </View>
          </View>

          {loading && page === 1 ? (
            <View className='loading-wrap'>
              <LoadingSpinner size={48} />
            </View>
          ) : plans.length === 0 ? (
            <View className='empty-state'>
              <Text className='empty-title'>暂无计划</Text>
              <Text className='empty-desc'>全部计划会显示在这里</Text>
              <View className='empty-actions'>
                <View className='empty-action primary' onClick={() => Taro.navigateTo({ url: '/pages/index/index' })}>
                  <Text>去今日训练</Text>
                </View>
                <View className='empty-action secondary' onClick={() => Taro.navigateTo({ url: '/me/plan-lib/index' })}>
                  <Text>去我的计划库</Text>
                </View>
              </View>
            </View>
          ) : (
            <View className='plans-list'>
              {plans.map((plan) => {
                const statusConfig = getStatusConfig(plan.status)
                const trainingDayCount = getTrainingDayCount(plan)
                return (
                  <View
                    key={plan.id}
                    className='plan-card'
                    onClick={() => handlePlanClick(plan.id)}
                  >
                    <View className='plan-header'>
                      <Text className='plan-name'>{plan.name}</Text>
                      <View className='plan-badges'>
                        <View className='status-badge' style={{ backgroundColor: statusConfig.color + '20', color: statusConfig.color }}>
                          <Text>{statusConfig.label}</Text>
                        </View>
                        <View className='source-badge'>
                          <Text>{getSourceLabel(plan.source)}</Text>
                        </View>
                      </View>
                    </View>
                    <View className='plan-info'>
                      <View className='info-item'>
                        <View className='info-icon'><Calendar /></View>
                        <Text className='info-text'>{formatDateRange(plan.start_date, plan.end_date)}</Text>
                      </View>
                      {trainingDayCount !== null && (
                        <View className='info-item'>
                          <View className='info-icon'><File /></View>
                          <Text className='info-text'>共 {trainingDayCount} 个训练日</Text>
                        </View>
                      )}
                    </View>
                    {plan.completion_rate !== undefined && (
                      <View className='plan-progress'>
                        <View className='progress-header'>
                          <Text className='progress-label'>完成度</Text>
                          <Text className='progress-value'>{plan.completion_rate}%</Text>
                        </View>
                        <View className='progress-bar'>
                          <View
                            className='progress-fill'
                            style={{ width: `${plan.completion_rate}%` }}
                          />
                        </View>
                      </View>
                    )}
                    {plan.description && (
                      <Text className='plan-desc'>{plan.description}</Text>
                    )}
                  </View>
                )
              })}
              {plans.length >= totalCount && totalCount > 0 && (
                <View className='load-more'>
                  <Text>已加载全部 {totalCount} 条记录</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default PlanHistoryPage
