import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { coachService } from '@/services/coach/coachService'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useTheme } from '@/hooks/useTheme'

interface QuestionnaireTemplateItem {
  id: string
  name?: string
  status: 'active' | 'draft'
  editorType: 'simple' | 'flow'
  is_default?: boolean
  version?: number | null
  created_at?: string | null
  updated_at?: string | null
}

interface QuestionnaireSummary {
  questionCount: number
  questionTypes: string[]
  hasBranching: boolean
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  text: '纯文本',
  option: '选项题',
  times: '训练频率（旧）',
  tags: '训练偏好（旧）',
  rm: '1RM（旧）',
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
  }
}

function CoachQuestionnaire() {
  const { effectiveTheme } = useTheme()
  const [templates, setTemplates] = useState<QuestionnaireTemplateItem[]>([])
  const [summaryMap, setSummaryMap] = useState<Record<string, QuestionnaireSummary>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string>('')

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
        return
      }

      const listRes = await coachService.listQuestionnaires({ coachId: coachRes.coach.id })
      const items = (Array.isArray(listRes?.items) ? listRes.items : []) as QuestionnaireTemplateItem[]

      setTemplates(items)

      const summaryEntries = await Promise.all(
        items.map(async (item) => {
          try {
            const detail: any = await coachService.getQuestionnaireById({ id: item.id })
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

  const sortedTemplates = useMemo(() => {
    const list = [...templates]
    list.sort((a, b) => {
      // active first, default first, then by updated_at desc
      if (a.status === 'active' && b.status !== 'active') return -1
      if (a.status !== 'active' && b.status === 'active') return 1
      if (a.is_default && !b.is_default) return -1
      if (!a.is_default && b.is_default) return 1
      const ad = a.updated_at || a.created_at || ''
      const bd = b.updated_at || b.created_at || ''
      return bd.localeCompare(ad)
    })
    return list
  }, [templates])

  const openEditor = useCallback((id?: string) => {
    const url = id
      ? `/coach/questionnaire/edit?id=${encodeURIComponent(id)}`
      : `/coach/questionnaire/edit`
    Taro.navigateTo({ url }).catch((error) => {
      console.error('[coach/questionnaire] navigate edit failed:', error)
      Taro.showToast({ title: '页面跳转失败', icon: 'none' })
    })
  }, [])

  const handleSetDefault = useCallback(async (id: string) => {
    try {
      setBusyId(id)
      const res = await coachService.setDefaultQuestionnaire({ id })
      if (res?.success) {
        Taro.showToast({ title: '已设为默认', icon: 'success' })
        await loadData()
      } else {
        Taro.showToast({ title: res?.message || '操作失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[coach/questionnaire] set default:', error)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      setBusyId('')
    }
  }, [loadData])

  const handleDuplicate = useCallback(async (id: string) => {
    try {
      setBusyId(id)
      const res = await coachService.duplicateQuestionnaire({ id })
      if (res?.success) {
        Taro.showToast({ title: '已复制一份副本', icon: 'success' })
        await loadData()
      } else {
        Taro.showToast({ title: res?.message || '复制失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[coach/questionnaire] duplicate:', error)
      Taro.showToast({ title: '复制失败', icon: 'none' })
    } finally {
      setBusyId('')
    }
  }, [loadData])

  const renderTemplateCard = (template: QuestionnaireTemplateItem) => {
    const summary = summaryMap[template.id] || buildSummary([])
    const isActive = template.status === 'active'
    const busy = busyId === template.id

    return (
      <View key={template.id} className={`template-card ${isActive ? 'online' : 'draft'}`}>
        <View className='template-card__head'>
          <View className='template-card__title-wrap'>
            <Text className='template-card__title'>
              {template.name || (isActive ? '已发布问卷' : '编辑中问卷')}
            </Text>
            <View className='template-card__badge-row'>
              <Text className={`template-badge ${isActive ? 'online' : 'draft'}`}>
                {isActive ? '已发布' : '编辑中'}
              </Text>
              <Text className='template-badge editor-type'>
                {template.editorType === 'flow' ? '流程图式' : '列表式'}
              </Text>
              {template.is_default && (
                <Text className='template-badge default'>默认</Text>
              )}
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
          {summary.hasBranching && (
            <Text className='template-chip'>含条件分支</Text>
          )}
        </View>

        <View className='template-card__actions'>
          <View className='action-pill primary' onClick={() => openEditor(template.id)}>
            <Text className='action-pill__text'>编辑</Text>
          </View>
          <View
            className={`action-pill ${busy ? 'disabled' : ''}`}
            onClick={() => {
              if (busy) return
              void handleDuplicate(template.id)
            }}
          >
            <Text className='action-pill__text'>{busy ? '处理中...' : '复制一份'}</Text>
          </View>
          {!template.is_default && (
            <View
              className={`action-pill ${busy ? 'disabled' : ''}`}
              onClick={() => {
                if (busy) return
                void handleSetDefault(template.id)
              }}
            >
              <Text className='action-pill__text'>{busy ? '处理中...' : '设为默认'}</Text>
            </View>
          )}
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View className={`coach-questionnaire-page theme-${effectiveTheme}`}>
        <View className="loading-wrap"><LoadingSpinner size={48} /></View>
        <BottomNav />
      </View>
    )
  }

  return (
    <View className={`coach-questionnaire-page theme-${effectiveTheme}`}>
      <ScrollView scrollY className='page-scroll'>
        <View className='hero-card'>
          <View className='hero-card__content'>
            <Text className='hero-card__eyebrow'>学员问卷管理</Text>
            <Text className='hero-card__title'>多份问卷,一份上线</Text>
            <Text className='hero-card__desc'>
              你可以维护任意多份问卷模板,但同一时间只会有一份「已发布」,学员实际填写的就是它。
            </Text>
          </View>

          <View className='hero-card__action' onClick={() => openEditor()}>
            <Text className='hero-card__action-text'>+ 新建问卷</Text>
          </View>
        </View>

        <View className='section-card'>
          <View className='section-head'>
            <View>
              <Text className='section-title'>问卷列表</Text>
              <Text className='section-subtitle'>每行一份问卷;已发布的会自动作为学员填写的版本</Text>
            </View>
          </View>

          {sortedTemplates.length > 0 ? (
            sortedTemplates.map((template) => renderTemplateCard(template))
          ) : (
            <View className='empty-state'>
              <Text className='empty-state__title'>还没有任何问卷</Text>
              <Text className='empty-state__desc'>点上方「新建问卷」开始,先选「列表式」最省心。</Text>
              <View className='inline-action' onClick={() => openEditor()}>
                <Text className='inline-action__text'>新建问卷</Text>
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
