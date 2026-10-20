import React, { useEffect, useState } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { ClButton, ClSectionHeader, ClTag } from '@/components/ui'
import { knowledgeService, type PublicTrainingPlanListItem } from '@/services/knowledgeService'
import { resolveWeappImageThumbnailUrl } from '@/utils/mediaUrl'
import './StarterHome.scss'

const ACTION_IMAGE_BASE = 'https://cdn-assets.coachlink.fit/action-reference-images/reviewed-library-2026-10-07'

export interface QuickStartTemplate {
  key: string
  name: string
  meta: string
  image: string
  /** Query passed to the impromptu action picker. */
  pickerQuery: string
}

/** Quick starts open the public library pre-filtered, so a brand-new user never lands on an empty "常用" tab. */
export const QUICK_START_TEMPLATES: QuickStartTemplate[] = [
  { key: 'push', name: '推 · 胸肩三头', meta: '卧推、臂屈伸、推举', image: `${ACTION_IMAGE_BASE}/barbell-bench-press-88a2268aee53.png`, pickerQuery: 'itemType=STRENGTH&source=public&muscle=chest' },
  { key: 'pull', name: '拉 · 背和二头', meta: '引体、划船、弯举', image: `${ACTION_IMAGE_BASE}/weighted-pullup-2fd59b72aa5e.png`, pickerQuery: 'itemType=STRENGTH&source=public&muscle=back' },
  { key: 'legs', name: '腿 · 臀腿', meta: '深蹲、硬拉、分腿蹲', image: `${ACTION_IMAGE_BASE}/high-bar-squat-f6adaebdf53c.png`, pickerQuery: 'itemType=STRENGTH&source=public&muscle=legs' },
  { key: 'street', name: '街健 · 徒手', meta: '引体、俯卧撑、双杠', image: `${ACTION_IMAGE_BASE}/parallel-bar-dip-3243b1ac37b4.png`, pickerQuery: 'itemType=STREET&source=public' }
]

const LEVEL_LABELS: Record<string, string> = { beginner: '入门', intermediate: '进阶', advanced: '高阶' }

interface StarterHomeProps {
  dateLabel: string
  guest: boolean
  /** Subscribed but the coach has not published a plan yet. */
  waitingCoach: boolean
  onQuickStart: (template?: QuickStartTemplate) => void
  onFindCoach: () => void
  onContactCoach: () => void
  onOpenPlan: (plan: PublicTrainingPlanListItem) => void
  onAllPlans: () => void
  onMore?: () => void
}

/** Home for users without an active plan: guests, new users and students waiting for their coach. */
function StarterHome({
  dateLabel,
  guest,
  waitingCoach,
  onQuickStart,
  onFindCoach,
  onContactCoach,
  onOpenPlan,
  onAllPlans,
  onMore
}: StarterHomeProps): React.ReactElement {
  const [plans, setPlans] = useState<PublicTrainingPlanListItem[]>([])

  useEffect(() => {
    // The plan list API requires login; guests would only get 401s in the console.
    if (guest) return undefined
    let cancelled = false
    const load = async () => {
      try {
        const beginner = await knowledgeService.listTrainingPlans({ level: 'beginner', limit: 3 })
        const list = beginner.plans.length > 0
          ? beginner.plans
          : (await knowledgeService.listTrainingPlans({ limit: 3 })).plans
        if (!cancelled) setPlans(list)
      } catch (error) {
        console.warn('[starter-home] load plans failed', error)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [guest])

  return (
    <View className='tt-starter'>
      <View className='tt-starter__header'>
        <Text className='tt-starter__date'>{dateLabel}</Text>
        <Text className='tt-starter__title'>{waitingCoach ? '教练正在制定计划' : '今天练点什么？'}</Text>
      </View>

      {waitingCoach && (
        <View className='tt-starter__notice'>
          <Text className='tt-starter__notice-text'>计划发布后会自动出现在这里。等待期间可以先自己练。</Text>
          <Text className='tt-starter__notice-link' onClick={onContactCoach}>联系教练 ›</Text>
        </View>
      )}

      <View className='tt-starter__section'>
        <ClSectionHeader title='快速开练' meta='动作和组数可在训练中改' />
        <View className='tt-starter__grid'>
          {QUICK_START_TEMPLATES.map((template) => (
            <View
              key={template.key}
              className='tt-starter__template'
              hoverClass='tt-starter__template--pressed'
              hoverStayTime={60}
              ariaRole='button'
              ariaLabel={`快速开练：${template.name}`}
              onClick={() => onQuickStart(template)}
            >
              <Image className='tt-starter__template-image' src={resolveWeappImageThumbnailUrl(template.image, 360)} mode='aspectFit' lazyLoad />
              <View className='tt-starter__template-copy'>
                <Text className='tt-starter__template-name'>{template.name}</Text>
                <Text className='tt-starter__template-meta'>{template.meta}</Text>
              </View>
            </View>
          ))}
        </View>
        <ClButton block onClick={() => onQuickStart()}>自己选动作开练</ClButton>
      </View>

      {plans.length > 0 && (
        <View className='tt-starter__section'>
          <ClSectionHeader title='跟着免费计划练' actionText='全部计划' onAction={onAllPlans} />
          <ScrollView scrollX className='tt-starter__plans' showScrollbar={false}>
            <View className='tt-starter__plans-row'>
              {plans.map((plan) => (
                <View key={plan.id} className='tt-starter__plan' onClick={() => onOpenPlan(plan)}>
                  <View className='tt-starter__plan-tags'>
                    {plan.specialtyLabel ? <ClTag tone='clay'>{plan.specialtyLabel}</ClTag> : null}
                    <ClTag>{LEVEL_LABELS[plan.level] || plan.level}</ClTag>
                  </View>
                  <Text className='tt-starter__plan-name'>{plan.name}</Text>
                  <Text className='tt-starter__plan-meta cl-num'>{plan.weeks} 周 · {plan.daysPerWeek} 天/周</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      <View className='tt-starter__coach' hoverClass='tt-starter__coach--pressed' onClick={onFindCoach}>
        <View className='tt-starter__coach-copy'>
          <Text className='tt-starter__coach-title'>想有人带你练？</Text>
          <Text className='tt-starter__coach-desc'>教练按你的情况排计划、看训练视频纠动作</Text>
        </View>
        <Text className='tt-starter__coach-link'>看看教练 ›</Text>
      </View>

      {guest ? (
        <Text className='tt-starter__hint'>开始记录训练时需要登录，训练记录会同步保存。</Text>
      ) : onMore ? (
        <Text className='tt-starter__more' onClick={onMore}>我的计划库 · 训练记录说明</Text>
      ) : null}
    </View>
  )
}

export default StarterHome
