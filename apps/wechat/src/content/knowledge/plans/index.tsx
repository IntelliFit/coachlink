import React, { useCallback, useEffect, useState } from 'react'
import { Input, Text, View } from '@tarojs/components'
import { Search } from '@nutui/icons-react-taro'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import { useTheme } from '@/hooks/useTheme'
import {
  knowledgeService,
  type PublicTrainingPlanLevel,
  type PublicTrainingPlanListItem
} from '@/services/knowledgeService'
import './index.scss'

const PAGE_SIZE = 30
const LEVELS: Array<{ value: 'all' | PublicTrainingPlanLevel; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'beginner', label: '入门' },
  { value: 'intermediate', label: '进阶' },
  { value: 'advanced', label: '高阶' }
]
const LEVEL_LABELS: Record<PublicTrainingPlanLevel, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高阶'
}

export default function TrainingPlanLibraryPage() {
  const { effectiveTheme } = useTheme()
  const [plans, setPlans] = useState<PublicTrainingPlanListItem[]>([])
  const [total, setTotal] = useState(0)
  const [level, setLevel] = useState<'all' | PublicTrainingPlanLevel>('all')
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadPlans = useCallback(async (reset = true) => {
    if (reset) setLoading(true)
    else setLoadingMore(true)
    try {
      const offset = reset ? 0 : plans.length
      const result = await knowledgeService.listTrainingPlans({
        level,
        limit: PAGE_SIZE,
        offset,
        search: activeQuery || undefined
      })
      setPlans((current) => reset ? (result.plans || []) : [...current, ...(result.plans || [])])
      setTotal(result.total || 0)
    } catch (error) {
      console.error('[knowledge/plans] load:', error)
      if (reset) setPlans([])
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [activeQuery, level, plans.length])

  useEffect(() => {
    void loadPlans(true)
  }, [activeQuery, level])

  usePullDownRefresh(() => {
    void loadPlans(true).finally(() => Taro.stopPullDownRefresh())
  })

  function submitSearch() {
    setActiveQuery(query.trim())
  }

  async function handlePlanClick(plan: PublicTrainingPlanListItem) {
    if (plan.entryKind === 'reference' && plan.sourceUrl) {
      const result = await Taro.showModal({
        title: '来源计划',
        content: `该条目由 ${plan.author || plan.sourceName || '原作者'} 发布，当前仅保留来源索引，尚未复制第三方完整处方。`,
        confirmText: '复制链接',
        cancelText: '取消'
      })
      if (result.confirm) {
        await Taro.setClipboardData({ data: plan.sourceUrl })
      }
      return
    }
    Taro.navigateTo({
      url: `/content/knowledge/plan-detail?id=${encodeURIComponent(plan.slug || plan.id)}`
    })
  }

  return (
    <PageThemeRoot>
      <View className={`plan-library-page theme-${effectiveTheme}`}>
        <View className='plan-library-hero'>
          <Text className='plan-library-title'>训练计划</Text>
          <Text className='plan-library-subtitle'>共 {total} 套已发布计划，按目标和水平挑选。</Text>
        </View>

        <View className='plan-library-tools'>
          <View className='plan-search-row'>
            <View className='plan-search-input-wrap'>
              <Search size={18} color='#9CA3AF' />
              <Input
                className='plan-search-input'
                value={query}
                placeholder='搜索名称、运动或目标'
                onInput={(event) => setQuery(event.detail.value)}
                onConfirm={submitSearch}
              />
            </View>
            <View className='plan-search-button' onClick={submitSearch}><Text>搜索</Text></View>
          </View>
          <View className='plan-level-list'>
            {LEVELS.map((option) => (
              <View
                key={option.value}
                className={`plan-level-option ${level === option.value ? 'active' : ''}`}
                onClick={() => setLevel(option.value)}
              >
                <Text>{option.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {loading ? (
          <View className='plan-library-loading'><LoadingSpinner size={56} /></View>
        ) : plans.length > 0 ? (
          <View className='plan-library-list'>
            {plans.map((plan) => (
              <View
                key={plan.id}
                className='plan-library-card'
                onClick={() => void handlePlanClick(plan)}
              >
                <View className='plan-library-card-top'>
                  <Text className='plan-library-specialty' numberOfLines={1}>
                    {plan.specialtyLabel || plan.goal}
                  </Text>
                  <Text className={`plan-library-level ${plan.level}`}>{LEVEL_LABELS[plan.level]}</Text>
                </View>
                <Text className='plan-library-card-title' numberOfLines={2}>{plan.name}</Text>
                <Text className='plan-library-card-desc' numberOfLines={2}>
                  {plan.description || '查看完整训练安排与适用人群'}
                </Text>
                {plan.entryKind === 'reference' && (
                  <Text className='plan-library-source' numberOfLines={1}>
                    来源索引 · {plan.author || plan.sourceName || '原作者'}
                  </Text>
                )}
                <View className='plan-library-meta'>
                  <Text>{plan.weeks}周</Text>
                  <Text>{plan.daysPerWeek}天/周</Text>
                  <Text>{plan.sport}</Text>
                </View>
              </View>
            ))}
            {plans.length < total && (
              <View className='load-more-button' onClick={() => void loadPlans(false)}>
                {loadingMore ? <LoadingSpinner size={40} /> : <Text>加载更多</Text>}
              </View>
            )}
          </View>
        ) : (
          <View className='plan-library-empty'><Text>没有找到匹配的训练计划。</Text></View>
        )}
      </View>
    </PageThemeRoot>
  )
}
