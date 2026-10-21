import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { authService } from '@/services/authService'
import {
  knowledgeService,
  type PublicTrainingPlanDetail,
  type PublicTrainingPlanLevel
} from '@/services/knowledgeService'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import { ClButton, ClCard, ClChip, ClTag } from '@/components/ui'
import { useTheme } from '@/hooks/useTheme'
import { countWeeks, toPlanDetailDays, weekOfDay, type PlanDetailDay } from './planDetailFormat'
import './index.scss'

const PLAN_LEVEL_LABELS: Record<PublicTrainingPlanLevel, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '专业'
}

function DayCard({ day }: { day: PlanDetailDay }) {
  if (day.isRest) {
    return (
      <View className='pd-rest-day'>
        <Text className='pd-rest-day__title'>第 {day.dayIndex} 天</Text>
        <Text className='pd-rest-day__label'>休息{day.note ? ` · ${day.note}` : ''}</Text>
      </View>
    )
  }

  return (
    <ClCard padding='none' className='pd-day'>
      <View className='pd-day__head'>
        <View className='pd-day__heading'>
          <Text className='pd-day__title'>第 {day.dayIndex} 天</Text>
          {day.note ? <Text className='pd-day__note'>{day.note}</Text> : null}
        </View>
        <Text className='pd-day__count'>{day.actions.length} 个动作</Text>
      </View>
      {day.actions.map((action, index) => (
        <View key={action.key} className='pd-action'>
          <Text className='pd-action__index'>{index + 1}</Text>
          <View className='pd-action__body'>
            <View className='pd-action__line'>
              <Text className='pd-action__name'>{action.name}</Text>
              <Text className='pd-action__volume'>{action.volume}</Text>
            </View>
            {action.meta ? <Text className='pd-action__meta'>{action.meta}</Text> : null}
          </View>
        </View>
      ))}
    </ClCard>
  )
}

function PlanDetailPage() {
  const { effectiveTheme } = useTheme()
  const router = useRouter()
  const planId = String(router.params.id || '')
  const [plan, setPlan] = useState<PublicTrainingPlanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeWeek, setActiveWeek] = useState(1)

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
      setActiveWeek(1)
    } catch (error) {
      console.error('[knowledge/plan-detail] load failed:', error)
      setPlan(null)
    } finally {
      setLoading(false)
    }
  }

  const days = useMemo(() => toPlanDetailDays(plan?.trainingDays || []), [plan])
  const weekCount = useMemo(() => countWeeks(days, plan?.weeks), [days, plan])
  const weekDays = useMemo(() => days.filter((day) => weekOfDay(day.dayIndex) === activeWeek), [days, activeWeek])
  const trainingDayCount = useMemo(() => days.filter((day) => !day.isRest).length, [days])

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
        content: '可在「我的计划库」里调整组数、次数和休息，再点「应用」开始训练。',
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

  const rootClass = `pd-page ${effectiveTheme === 'dark' ? 'cl-theme-dark' : ''}`

  if (loading) {
    return (
      <PageThemeRoot>
        <View className={rootClass}>
          <View className='pd-state'>
            <LoadingSpinner size={56} />
          </View>
        </View>
      </PageThemeRoot>
    )
  }

  if (!plan) {
    return (
      <PageThemeRoot>
        <View className={rootClass}>
          <View className='pd-state'>
            <Text className='pd-state__title'>计划不存在</Text>
            <Text className='pd-state__desc'>这个训练计划可能已经下线，先返回知识库看看其他计划。</Text>
            <ClButton variant='secondary' size='md' onClick={() => Taro.navigateBack()}>返回</ClButton>
          </View>
        </View>
      </PageThemeRoot>
    )
  }

  const kicker = [plan.specialtyLabel || plan.goal, plan.sport].filter(Boolean).join(' · ')
  const chips = Array.from(new Set([...(plan.equipment || []), ...(plan.tags || [])]))

  return (
    <PageThemeRoot>
      <View className={rootClass}>
        <ScrollView className='pd-scroll' scrollY>
          <View className='pd-shell'>
            <View className='pd-hero'>
              <View className='pd-hero__topline'>
                {kicker ? <Text className='pd-hero__kicker'>{kicker}</Text> : <View />}
                <ClTag tone='solid'>{PLAN_LEVEL_LABELS[plan.level] || '入门'}</ClTag>
              </View>
              <Text className='pd-hero__title'>{plan.name}</Text>
              {plan.description ? <Text className='pd-hero__desc'>{plan.description}</Text> : null}

              <View className='pd-stats'>
                <View className='pd-stat'>
                  <Text className='pd-stat__value'>{plan.weeks}</Text>
                  <Text className='pd-stat__label'>周</Text>
                </View>
                <View className='pd-stat'>
                  <Text className='pd-stat__value'>{plan.daysPerWeek}</Text>
                  <Text className='pd-stat__label'>天 / 周</Text>
                </View>
                <View className='pd-stat'>
                  <Text className='pd-stat__value'>{trainingDayCount}</Text>
                  <Text className='pd-stat__label'>个训练日</Text>
                </View>
              </View>

              {chips.length > 0 && (
                <View className='pd-tags'>
                  {chips.map((chip) => <ClTag key={chip}>{chip}</ClTag>)}
                  {plan.templateKind === 'parameterized' && <ClTag tone='clay'>可按 1RM 调整</ClTag>}
                </View>
              )}
            </View>

            {plan.audience ? (
              <View className='pd-section'>
                <Text className='pd-section__title'>适合谁</Text>
                <Text className='pd-section__text'>{plan.audience}</Text>
              </View>
            ) : null}

            {Array.isArray(plan.actionSlots) && plan.actionSlots.length > 0 && (
              <View className='pd-section'>
                <Text className='pd-section__title'>可替换动作</Text>
                <ClCard padding='none'>
                  {plan.actionSlots.map((slot: any) => (
                    <View key={slot.key || slot.label} className='pd-slot'>
                      <Text className='pd-slot__label'>{slot.label || slot.key}</Text>
                      <Text className='pd-slot__value'>{slot.defaultActionName || '加入后选择'}</Text>
                    </View>
                  ))}
                </ClCard>
              </View>
            )}

            <View className='pd-section'>
              <Text className='pd-section__title'>训练安排</Text>
              {weekCount > 1 && (
                <ScrollView scrollX className='pd-weeks' showScrollbar={false}>
                  <View className='pd-weeks__row'>
                    {Array.from({ length: weekCount }, (_, index) => index + 1).map((week) => (
                      <ClChip key={week} selected={week === activeWeek} onClick={() => setActiveWeek(week)}>
                        {`第 ${week} 周`}
                      </ClChip>
                    ))}
                  </View>
                </ScrollView>
              )}
              <View className='pd-days'>
                {weekDays.length > 0
                  ? weekDays.map((day) => <DayCard key={day.dayIndex} day={day} />)
                  : <Text className='pd-section__text'>这一周暂无安排</Text>}
              </View>
            </View>

            {plan.notes.length > 0 && (
              <View className='pd-section'>
                <Text className='pd-section__title'>注意事项</Text>
                <ClCard>
                  {plan.notes.map((note) => (
                    <View key={note} className='pd-note'>
                      <View className='pd-note__dot' />
                      <Text className='pd-note__text'>{note}</Text>
                    </View>
                  ))}
                </ClCard>
              </View>
            )}
          </View>
        </ScrollView>

        <View className='pd-bottom'>
          <ClButton block loading={saving} loadingText='加入中…' onClick={handleAddToMyPlan}>
            加入我的计划
          </ClButton>
        </View>
      </View>
    </PageThemeRoot>
  )
}

export default PlanDetailPage
