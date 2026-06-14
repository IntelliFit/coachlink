import React, { useState } from 'react'
import { Text, ScrollView, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { Notice } from '@nutui/icons-react-taro'
import BottomNav from '@/components/BottomNav'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { request } from '@/utils/request'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

function PlanHistoryDetail() {
  const { effectiveTheme } = useTheme()
  const router = useRouter()
  const planId = router.params?.id
  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    if (planId) {
      loadPlanDetail()
    }
  })

  const loadPlanDetail = async () => {
    try {
      setLoading(true)
      const res = await request({
        url: `/api/student/plan-lib/history/${planId}`,
        method: 'GET'
      })
      if (res.success && res.data) {
        setPlan(res.data)
      }
    } catch (error) {
      console.error('加载计划详情失败:', error)
      Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const getStatusLabel = (status: string) => {
    if (status === 'active') return '进行中'
    if (status === 'completed') return '已完成'
    if (status === 'archived') return '已归档'
    return status || '-'
  }

  const getSourceLabel = (source: string | null) => {
    return source === 'coach' ? '教练指派' : '我的计划'
  }

  const formatDate = (value?: string | null) => {
    return value ? new Date(value).toLocaleDateString('zh-CN') : null
  }

  const trainingDayCount = plan
    ? plan.total_training_days ?? plan.total_days ?? null
    : null

  if (loading) {
    return (
      <View className={`plan-history-detail-page theme-${effectiveTheme}`}>
        <ScrollView className='page-scroll' scrollY>
          <View className='loading-wrap'>
            <LoadingSpinner size={48} />
          </View>
        </ScrollView>
        <BottomNav />
      </View>
    )
  }

  if (!plan) {
    return (
      <View className={`plan-history-detail-page theme-${effectiveTheme}`}>
        <ScrollView className='page-scroll' scrollY>
          <View className='empty-wrap'>
            <Text>计划不存在</Text>
          </View>
        </ScrollView>
        <BottomNav />
      </View>
    )
  }

  return (
    <View className={`plan-history-detail-page theme-${effectiveTheme}`}>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          <View className='plan-header'>
            <Text className='plan-name'>{plan.name}</Text>
            <Text className='plan-desc'>{plan.description || '无描述'}</Text>
          </View>

          <View className='plan-info-section'>
            <View className='info-item'>
              <Text className='info-label'>状态</Text>
              <Text className='info-value'>{getStatusLabel(plan.status)}</Text>
            </View>
            <View className='info-item'>
              <Text className='info-label'>来源</Text>
              <Text className='info-value'>{getSourceLabel(plan.source)}</Text>
            </View>
            {plan.start_date && (
              <View className='info-item'>
                <Text className='info-label'>开始时间</Text>
                <Text className='info-value'>{formatDate(plan.start_date)}</Text>
              </View>
            )}
            {plan.end_date && (
              <View className='info-item'>
                <Text className='info-label'>结束时间</Text>
                <Text className='info-value'>{formatDate(plan.end_date)}</Text>
              </View>
            )}
            {trainingDayCount !== null && (
              <View className='info-item'>
                <Text className='info-label'>训练日</Text>
                <Text className='info-value'>{trainingDayCount} 个训练日</Text>
              </View>
            )}
            {plan.completion_rate !== undefined && (
              <View className='info-item'>
                <Text className='info-label'>完成度</Text>
                <Text className='info-value'>{plan.completion_rate}%</Text>
              </View>
            )}
          </View>

          <View className='notice-box'>
            <View className='notice-text'>
              <Notice /> 详细训练记录和数据分析请在网页端查看
            </View>
          </View>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default PlanHistoryDetail
