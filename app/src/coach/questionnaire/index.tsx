import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { coachService } from '@/services/coach/coachService'
import './index.scss'

interface QuestionnaireTemplateItem {
  id: string
  name?: string
  is_active: boolean
  version?: number | null
  created_at?: string | null
  updated_at?: string | null
  is_default?: boolean
}

interface QuestionnaireSummary {
  questionCount: number
  questionTypes: string[]
  hasBranching: boolean
  hasConfiguredRM: boolean
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  text: '文本',
  option: '单选',
  times: '训练频率',
  tags: '训练偏好',
  rm: '1RM'
}

function formatTemplateDate(value?: string | null) {
  if (!value) return '暂无更新时间'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '暂无更新时间'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function buildSummary(questions: any[]): QuestionnaireSummary {
  const questionTypes = Array.from(
    new Set(
      questions
        .map((item) => QUESTION_TYPE_LABELS[String(item?.type || '')] || null)
        .filter(Boolean)
    )
  ) as string[]

  return {
    questionCount: questions.length,
    questionTypes,
    hasBranching: questions.some((item) => {
      const branching = item?.branching
      if (!branching || typeof branching !== 'object') return false
      const rules = branching?.rules
      const hasRules = !!rules && typeof rules === 'object' && Object.keys(rules).length > 0
      return hasRules || branching?.defaultNext !== undefined
    }),
    hasConfiguredRM: questions.some((item) => item?.type === 'rm' && Array.isArray(item?.actionIds) && item.actionIds.length > 0)
  }
}

function CoachQuestionnaire() {
  const [templates, setTemplates] = useState<QuestionnaireTemplateItem[]>([])
  const [summaryMap, setSummaryMap] = useState<Record<string, QuestionnaireSummary>>({})
  const [defaultId, setDefaultId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string>('')

  const loadData = useCallback(async () => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({ url: '/auth/login?returnTo=' + encodeURIComponent('/coach/questionnaire') })
      return
    }

    try {
      setLoading(true)
      const user = Taro.getStorageSync('user')
      const coachRes = await coachService.getCoach({ userId: user?.id })
      if (!coachRes?.coach?.id) {
        setTemplates([])
        setSummaryMap({})
        setDefaultId(null)
        return
      }

      const listRes = await coachService.listQuestionnaires({ coachId: coachRes.coach.id })
      const items = Array.isArray(listRes?.items) ? listRes.items : []

      setTemplates(items)
      setDefaultId(listRes?.defaultId || null)

      const summaryEntries = await Promise.all(
        items.map(async (item) => {
          try {
            const detail = await coachService.getQuestionnaireById({ id: item.id })
            const questions = Array.isArray(detail?.questionnaires) ? detail.questionnaires : []
            return [item.id, buildSummary(questions)] as const
          } catch (error) {
            console.warn('[coach/questionnaire] load summary failed:', error)
            return [item.id, buildSummary([])] as const
          }
        })
      )

      setSummaryMap(Object.fromEntries(summaryEntries))
    } catch (error) {
      console.error('[coach/questionnaire] load:', error)
      setTemplates([])
      setSummaryMap({})
      setDefaultId(null)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useDidShow(() => {
    void loadData()
  })

  const onlineTemplate = useMemo(
    () => templates.find((item) => item.is_active) || null,
    [templates]
  )

  const draftTemplate = useMemo(
    () => templates.find((item) => !item.is_active) || null,
    [templates]
  )

  const defaultTemplate = useMemo(
    () => templates.find((item) => item.id === defaultId) || onlineTemplate || null,
    [defaultId, onlineTemplate, templates]
  )

  const onlineSummary = onlineTemplate ? summaryMap[onlineTemplate.id] : null
  const draftSummary = draftTemplate ? summaryMap[draftTemplate.id] : null

  const openEditor = useCallback((mode: 'online' | 'draft') => {
    Taro.navigateTo({ url: `/coach/questionnaire/edit?mode=${mode}` }).catch((error) => {
      console.error('[coach/questionnaire] navigate edit failed:', error)
      Taro.showToast({ title: '页面跳转失败', icon: 'none' })
    })
  }, [])

  const handleCopyFromOnline = useCallback(async () => {
    if (!onlineTemplate?.id) {
      openEditor('draft')
      return
    }

    try {
      setBusyAction('copy')
      const res = await coachService.duplicateQuestionnaire({ id: onlineTemplate.id })
      if (res?.success) {
        Taro.showToast({ title: '已生成草稿', icon: 'success' })
        await loadData()
        openEditor('draft')
        return
      }
      Taro.showToast({ title: res?.message || '复制失败', icon: 'none' })
    } catch (error) {
      console.error('[coach/questionnaire] copy:', error)
      Taro.showToast({ title: '复制失败', icon: 'none' })
    } finally {
      setBusyAction('')
    }
  }, [loadData, onlineTemplate?.id, openEditor])

  const handlePublishDraft = useCallback(async () => {
    if (!draftTemplate?.id) {
      Taro.showToast({ title: '当前还没有草稿', icon: 'none' })
      return
    }

    const confirmRes = await Taro.showModal({
      title: '发布草稿',
      content: '发布后，学员端将立即使用这份线上问卷。确定继续吗？',
      confirmText: '发布',
      confirmColor: '#0f766e'
    })

    if (!confirmRes.confirm) return

    try {
      setBusyAction('publish')
      const res = await coachService.publishQuestionnaire({ id: draftTemplate.id })
      if (res?.success) {
        Taro.showToast({ title: '已发布上线', icon: 'success' })
        await loadData()
        return
      }
      Taro.showToast({ title: res?.message || '发布失败', icon: 'none' })
    } catch (error) {
      console.error('[coach/questionnaire] publish:', error)
      Taro.showToast({ title: '发布失败', icon: 'none' })
    } finally {
      setBusyAction('')
    }
  }, [draftTemplate?.id, loadData])

  const handleSetDefault = useCallback(async (templateId: string) => {
    try {
      setBusyAction(`default-${templateId}`)
      const res = await coachService.setDefaultQuestionnaire({ id: templateId })
      if (res?.success) {
        Taro.showToast({ title: '已设为默认问卷', icon: 'success' })
        await loadData()
        return
      }
      Taro.showToast({ title: res?.message || '设置失败', icon: 'none' })
    } catch (error) {
      console.error('[coach/questionnaire] set default:', error)
      Taro.showToast({ title: '设置失败', icon: 'none' })
    } finally {
      setBusyAction('')
    }
  }, [loadData])

  const renderTemplateCard = (template: QuestionnaireTemplateItem, variant: 'online' | 'draft') => {
    const summary = summaryMap[template.id] || buildSummary([])
    const isDefault = template.is_default || defaultId === template.id
    const actionMode = template.is_active ? 'online' : 'draft'
    const actionText = template.is_active ? '查看线上配置' : '继续编辑草稿'

    return (
      <View key={template.id} className={`template-card ${variant}`}>
        <View className='template-card__head'>
          <View className='template-card__title-wrap'>
            <Text className='template-card__title'>
              {template.name || (template.is_active ? '线上版本' : '草稿版本')}
            </Text>
            <View className='template-card__badge-row'>
              <Text className={`template-badge ${variant}`}>
                {template.is_active ? '当前线上' : '草稿'}
              </Text>
              {isDefault ? <Text className='template-badge default'>默认问卷</Text> : null}
            </View>
          </View>
          <Text className='template-card__version'>v{template.version ?? 1}</Text>
        </View>

        <Text className='template-card__meta'>
          共 {summary.questionCount} 题 · 最近更新 {formatTemplateDate(template.updated_at || template.created_at)}
        </Text>

        <View className='template-card__chips'>
          {summary.questionTypes.length > 0 ? (
            summary.questionTypes.map((label) => (
              <Text key={`${template.id}-${label}`} className='template-chip'>{label}</Text>
            ))
          ) : (
            <Text className='template-chip muted'>暂未配置题目</Text>
          )}
        </View>

        <View className='template-card__insights'>
          <Text className='template-insight'>
            {summary.hasBranching ? '含条件分支逻辑' : '当前为顺序问卷'}
          </Text>
          <Text className='template-insight'>
            {summary.hasConfiguredRM ? '已配置 1RM 动作采集' : '尚未配置 1RM 动作'}
          </Text>
        </View>

        <View className='template-card__actions'>
          <View className='action-pill primary' onClick={() => openEditor(actionMode)}>
            <Text className='action-pill__text'>{actionText}</Text>
          </View>

          {!template.is_active ? (
            <View
              className={`action-pill success ${busyAction === 'publish' ? 'disabled' : ''}`}
              onClick={() => {
                if (busyAction) return
                void handlePublishDraft()
              }}
            >
              <Text className='action-pill__text'>{busyAction === 'publish' ? '发布中...' : '发布为线上'}</Text>
            </View>
          ) : !isDefault ? (
            <View
              className={`action-pill subtle ${busyAction === `default-${template.id}` ? 'disabled' : ''}`}
              onClick={() => {
                if (busyAction) return
                void handleSetDefault(template.id)
              }}
            >
              <Text className='action-pill__text'>
                {busyAction === `default-${template.id}` ? '设置中...' : '设为默认'}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View className='coach-questionnaire-page'>
        <View className='loading-wrap'>加载中...</View>
        <BottomNav />
      </View>
    )
  }

  return (
    <View className='coach-questionnaire-page'>
      <ScrollView scrollY className='page-scroll'>
        <View className='hero-card'>
          <View className='hero-card__content'>
            <Text className='hero-card__eyebrow'>学员问卷设置</Text>
            <Text className='hero-card__title'>把线上版和草稿版分开管理</Text>
            <Text className='hero-card__desc'>
              网页端的核心心智是“线上问卷给学员真实使用，调整先写进草稿，确认后再发布”。小程序这里也按同样流程收口。
            </Text>
          </View>

          <View
            className='hero-card__action'
            onClick={() => {
              if (draftTemplate) {
                openEditor('draft')
                return
              }
              void handleCopyFromOnline()
            }}
          >
            <Text className='hero-card__action-text'>
              {draftTemplate ? '编辑草稿' : (onlineTemplate ? '从线上复制草稿' : '新建问卷')}
            </Text>
          </View>
        </View>

        <View className='summary-card'>
          <View className='summary-item'>
            <Text className='summary-item__label'>线上版本</Text>
            <Text className='summary-item__value'>
              {onlineSummary ? `${onlineSummary.questionCount} 题` : '未配置'}
            </Text>
          </View>
          <View className='summary-item'>
            <Text className='summary-item__label'>草稿版本</Text>
            <Text className='summary-item__value'>
              {draftSummary ? `${draftSummary.questionCount} 题` : '未创建'}
            </Text>
          </View>
          <View className='summary-item'>
            <Text className='summary-item__label'>默认问卷</Text>
            <Text className='summary-item__value'>
              {defaultTemplate?.name || (defaultTemplate?.is_active ? '线上版本' : '草稿版本') || '未设置'}
            </Text>
          </View>
        </View>

        <View className='section-card'>
          <View className='section-head'>
            <View>
              <Text className='section-title'>当前线上版本</Text>
              <Text className='section-subtitle'>学员在订阅和资料页里实际看到的就是这份</Text>
            </View>
          </View>

          {onlineTemplate ? (
            renderTemplateCard(onlineTemplate, 'online')
          ) : (
            <View className='empty-state'>
              <Text className='empty-state__title'>还没有线上问卷</Text>
              <Text className='empty-state__desc'>建议先在草稿里整理题目，再发布给学员使用。</Text>
              <View className='inline-action' onClick={() => openEditor('draft')}>
                <Text className='inline-action__text'>去新建草稿</Text>
              </View>
            </View>
          )}
        </View>

        <View className='section-card'>
          <View className='section-head'>
            <View>
              <Text className='section-title'>草稿工作区</Text>
              <Text className='section-subtitle'>所有改动先在这里排练，确认后再发布上线</Text>
            </View>
          </View>

          {draftTemplate ? (
            renderTemplateCard(draftTemplate, 'draft')
          ) : (
            <View className='empty-state'>
              <Text className='empty-state__title'>当前没有草稿</Text>
              <Text className='empty-state__desc'>可以从线上版本复制一份草稿，或者直接创建一份新的问卷结构。</Text>
              <View
                className={`inline-action ${busyAction === 'copy' ? 'disabled' : ''}`}
                onClick={() => {
                  if (busyAction) return
                  void handleCopyFromOnline()
                }}
              >
                <Text className='inline-action__text'>
                  {busyAction === 'copy' ? '处理中...' : (onlineTemplate ? '从线上复制草稿' : '直接新建问卷')}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default CoachQuestionnaire
