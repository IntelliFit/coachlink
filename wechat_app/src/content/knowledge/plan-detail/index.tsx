import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Clock, Calendar, Success } from '@nutui/icons-react-taro'
import { authService } from '@/services/authService'
import {
  knowledgeService,
  type PublicTrainingPlanDetail,
  type PublicTrainingPlanLevel
} from '@/services/knowledgeService'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import './index.scss'

const PLAN_LEVEL_LABELS: Record<PublicTrainingPlanLevel, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '专业'
}

function getTrainingDayCount(plan: PublicTrainingPlanDetail) {
  return plan.trainingDays.filter((day) => day.type === 'training').length
}

function toNumber(value: any) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function formatRest(value: any) {
  const seconds = toNumber(value)
  if (seconds === null || seconds <= 0) return '按动作安排'
  if (seconds % 60 === 0) return `${seconds / 60} 分钟`
  if (seconds > 120) return `${(seconds / 60).toFixed(1)} 分钟`
  return `${seconds} 秒`
}

function formatMetric(value: any, fallback = '按计划') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function getActionDetail(action: any) {
  const params = action?.params || {}
  const actionId = String(action?.actionId || action?.action_id || '').trim()
  return {
    actionId,
    actionName: String(
      action?.actionName ||
      action?.action_name ||
      action?.setName ||
      action?.set_name ||
      ''
    ).trim() || '未命名动作',
    sets: formatMetric(params['组数'] ?? params.sets ?? action?.sets ?? 1),
    reps: formatMetric(params['次数'] ?? params.reps ?? action?.reps ?? ''),
    rest: formatRest(params['休息时间'] ?? params.rest_seconds ?? action?.rest_seconds ?? null),
    intensity: formatMetric(params['强度'] ?? params.intensity ?? action?.intensity ?? '', ''),
    load: toNumber(params.load ?? action?.load ?? null)
  }
}

function PlanDetailPage() {
  const router = useRouter()
  const planId = String(router.params.id || '')
  const [plan, setPlan] = useState<PublicTrainingPlanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!planId) {
      setLoading(false)
      setPlan(null)
      return
    }
    void loadPlan()
  }, [planId])

  const loadPlan = async () => {
    try {
      setLoading(true)
      const detail = await knowledgeService.getTrainingPlan(planId)
      setPlan(detail)
    } catch (error) {
      console.error('[knowledge/plan-detail] load failed:', error)
      setPlan(null)
    } finally {
      setLoading(false)
    }
  }

  const handleAddToMyPlan = async () => {
    if (!plan || saving) return
    const session = authService.getAuthSession({ normalize: true })
    if (!session.isAuthenticated) {
      const returnTo = `/content/knowledge/plan-detail?id=${encodeURIComponent(plan.id)}`
      Taro.navigateTo({
        url: `/auth/login?returnTo=${encodeURIComponent(returnTo)}`
      })
      return
    }

    try {
      setSaving(true)
      const result = await knowledgeService.copyTrainingPlanToFavorite(plan.slug || plan.id)
      if (!result?.favorite) {
        throw new Error('save favorite failed')
      }

      const modal = await Taro.showModal({
        title: '已加入我的计划',
        content: '系统会优先复用你已有的动作库动作；没有的动作会自动补进你的动作库，再保存到我的计划里。',
        confirmText: '去查看',
        cancelText: '继续浏览'
      })
      if (modal.confirm) {
        Taro.navigateTo({ url: '/me/plan-lib/index' })
      }
    } catch (error) {
      console.error('[knowledge/plan-detail] save builtin plan failed:', error)
      Taro.showToast({ title: '加入失败，请稍后重试', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View className='builtin-plan-detail-page'>
        <View className='loading-state'>
          <LoadingSpinner size={56} />
        </View>
      </View>
    )
  }

  if (!plan) {
    return (
      <View className='builtin-plan-detail-page'>
        <View className='empty-state'>
          <Text className='empty-title'>计划不存在</Text>
          <Text className='empty-desc'>这个训练计划可能已经下线，先返回知识库看看其他计划。</Text>
          <View className='empty-btn' onClick={() => Taro.navigateBack()}>
            <Text>返回</Text>
          </View>
        </View>
      </View>
    )
  }

  const trainingDayCount = getTrainingDayCount(plan)

  return (
    <View className='builtin-plan-detail-page'>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-shell'>
          <View className='hero-card'>
            <View className='hero-topline'>
              <Text className='hero-kicker'>{plan.sport}</Text>
              <Text className={`level-badge ${plan.level}`}>{PLAN_LEVEL_LABELS[plan.level]}</Text>
            </View>
            <Text className='hero-title'>{plan.name}</Text>
            <Text className='hero-desc'>{plan.description}</Text>
            {plan.templateKind === 'parameterized' && (
              <View className='parameter-badge'>
                <Text>可参数化：后续可按动作槽位和 1RM 调整</Text>
              </View>
            )}
            <View className='meta-grid'>
              <View className='meta-card'>
                <Calendar size={18} color='#CF6D4E' />
                <Text className='meta-value'>{plan.weeks} 周</Text>
                <Text className='meta-label'>计划周期</Text>
              </View>
              <View className='meta-card'>
                <Clock size={18} color='#CF6D4E' />
                <Text className='meta-value'>{plan.daysPerWeek} 天/周</Text>
                <Text className='meta-label'>训练频率</Text>
              </View>
              <View className='meta-card'>
                <Success size={18} color='#CF6D4E' />
                <Text className='meta-value'>{trainingDayCount} 天</Text>
                <Text className='meta-label'>训练日数</Text>
              </View>
            </View>
          </View>

          <View className='section-card'>
            <Text className='section-title'>适合谁</Text>
            <Text className='section-text'>{plan.audience}</Text>
          </View>

          <View className='section-card'>
            <Text className='section-title'>器械与标签</Text>
            <View className='chip-row'>
              {[...plan.equipment, ...plan.tags].map((tag) => (
                <View key={tag} className='chip'>
                  <Text>{tag}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='section-card'>
            <Text className='section-title'>动作库说明</Text>
            <Text className='section-text'>
              加入我的计划时，会优先复用你已有的动作库动作；如果模板里有你还没有的动作，系统会自动补进你的动作库，再保存到我的计划里。
            </Text>
            <Text className='section-subtext'>
              后续你可以直接在计划编辑器里改组数、次数、休息和 1RM，不会卡在“动作不存在”。
            </Text>
          </View>

          {Array.isArray(plan.actionSlots) && plan.actionSlots.length > 0 && (
            <View className='section-card'>
              <Text className='section-title'>可替换项目</Text>
              <View className='slot-list'>
                {plan.actionSlots.map((slot: any) => (
                  <View key={slot.key || slot.label} className='slot-row'>
                    <Text className='slot-label'>{slot.label || slot.key}</Text>
                    <Text className='slot-value'>{slot.defaultActionName || '加入后选择动作'}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View className='section-card'>
            <Text className='section-title'>训练安排</Text>
            <View className='day-list'>
              {plan.trainingDays.slice(0, 14).map((day) => (
                <View key={day.dayIndex} className={`day-card ${day.type === 'rest' ? 'rest' : ''}`}>
                  <View className='day-head'>
                    <Text className='day-title'>第 {day.dayIndex} 天</Text>
                    <Text className='day-type'>{day.type === 'rest' ? '休息' : `${day.actionSets.length} 项训练`}</Text>
                  </View>
                  <Text className='day-note'>{day.note}</Text>
                  {day.type === 'training' && (
                    <View className='action-detail-list'>
                      {day.actionSets.slice(0, 4).map((action, index) => {
                        const detail = getActionDetail(action)
                        return (
                          <View key={`${day.dayIndex}-${index}`} className='action-detail-card'>
                            <View className='action-detail-head'>
                              <Text className='action-detail-title'>
                                {index + 1}. {detail.actionName}
                              </Text>
                              <Text className={`action-detail-badge ${detail.actionId ? 'bound' : 'pending'}`}>
                                {detail.actionId ? '已绑定动作库' : '加入后自动补齐'}
                              </Text>
                            </View>
                            <View className='action-detail-metrics'>
                              <View className='metric-pill'>
                                <Text className='metric-pill-label'>组数</Text>
                                <Text className='metric-pill-value'>{detail.sets}</Text>
                              </View>
                              <View className='metric-pill'>
                                <Text className='metric-pill-label'>次数</Text>
                                <Text className='metric-pill-value'>{detail.reps || '按计划'}</Text>
                              </View>
                              <View className='metric-pill'>
                                <Text className='metric-pill-label'>休息</Text>
                                <Text className='metric-pill-value'>{detail.rest}</Text>
                              </View>
                              {detail.intensity && (
                                <View className='metric-pill accent'>
                                  <Text className='metric-pill-label'>强度</Text>
                                  <Text className='metric-pill-value'>{detail.intensity}</Text>
                                </View>
                              )}
                              {detail.load !== null && (
                                <View className='metric-pill'>
                                  <Text className='metric-pill-label'>重量</Text>
                                  <Text className='metric-pill-value'>{detail.load} kg</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        )
                      })}
                      {day.actionSets.length > 4 && (
                        <Text className='action-preview more'>还有 {day.actionSets.length - 4} 项...</Text>
                      )}
                    </View>
                  )}
                </View>
              ))}
              {plan.trainingDays.length > 14 && (
                <Text className='more-days'>已展示前 2 周，加入我的计划后可查看完整 {plan.weeks} 周安排。</Text>
              )}
            </View>
          </View>

          <View className='section-card'>
            <Text className='section-title'>注意事项</Text>
            {plan.notes.map((note) => (
              <Text key={note} className='note-line'>• {note}</Text>
            ))}
          </View>
        </View>
      </ScrollView>

      <View className='bottom-bar'>
        <View className='secondary-btn' onClick={() => Taro.navigateBack()}>
          <Text>返回</Text>
        </View>
        <View className='primary-btn' onClick={handleAddToMyPlan}>
          <Text>{saving ? '加入中...' : '加入我的计划'}</Text>
        </View>
      </View>
    </View>
  )
}

export default PlanDetailPage
