import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { planLibService } from '@/services/coach/planLibService'
import { formatDateYMD } from '@/utils/dateFormat'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'

type TemplateType = '' | 'beginner' | 'strength'

export default function CoachPlanLib() {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [templateType, setTemplateType] = useState<TemplateType>('')
  const [tagOptions, setTagOptions] = useState<string[]>([])
  const [selectedTag, setSelectedTag] = useState('')

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({ url: '/auth/login?returnTo=' + encodeURIComponent('/coach/plan-lib') })
      return
    }
    void Promise.all([loadTemplates(), loadTags()])
  }, [])

  useDidShow(() => {
    const token = Taro.getStorageSync('token')
    if (!token) return
    void loadTemplates()
  })

  const loadTags = async () => {
    try {
      const res = await planLibService.getUniqueTemplateTags({ search, type: templateType })
      setTagOptions(Array.isArray(res?.tags) ? res.tags : [])
    } catch (error) {
      console.warn('[coach/plan-lib] load tags failed:', error)
      setTagOptions([])
    }
  }

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const res = await planLibService.listTemplates({
        page: 1,
        limit: 100,
        search,
        type: templateType
      })
      const nextTemplates = Array.isArray(res?.templates) ? res.templates : []
      const filteredByTag = selectedTag
        ? nextTemplates.filter((template) => Array.isArray(template.tags) && template.tags.includes(selectedTag))
        : nextTemplates
      setTemplates(filteredByTag)
    } catch (error) {
      console.error('[coach/plan-lib] load failed:', error)
      setTemplates([])
      Taro.showToast({ title: '模板加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    setSearch(searchDraft.trim())
    setSelectedTag('')
    setLoading(true)
    try {
      const [templatesRes, tagsRes] = await Promise.all([
        planLibService.listTemplates({ page: 1, limit: 100, search: searchDraft.trim(), type: templateType }),
        planLibService.getUniqueTemplateTags({ search: searchDraft.trim(), type: templateType })
      ])
      setTemplates(Array.isArray(templatesRes?.templates) ? templatesRes.templates : [])
      setTagOptions(Array.isArray(tagsRes?.tags) ? tagsRes.tags : [])
    } catch (error) {
      console.error('[coach/plan-lib] search failed:', error)
      Taro.showToast({ title: '搜索失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleTypeChange = async (value: TemplateType) => {
    setTemplateType(value)
    setSelectedTag('')
    setLoading(true)
    try {
      const [templatesRes, tagsRes] = await Promise.all([
        planLibService.listTemplates({ page: 1, limit: 100, search, type: value }),
        planLibService.getUniqueTemplateTags({ search, type: value })
      ])
      setTemplates(Array.isArray(templatesRes?.templates) ? templatesRes.templates : [])
      setTagOptions(Array.isArray(tagsRes?.tags) ? tagsRes.tags : [])
    } catch (error) {
      console.error('[coach/plan-lib] change type failed:', error)
      Taro.showToast({ title: '筛选失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    Taro.navigateTo({ url: '/coach/plan-lib/create' })
  }

  const handleEdit = (id: string) => {
    Taro.navigateTo({ url: '/coach/plan-lib/edit?id=' + encodeURIComponent(id) })
  }

  const handleCopy = async (id: string) => {
    try {
      await planLibService.copyTemplate({ id })
      Taro.showToast({ title: '已复制模板', icon: 'success' })
      await loadTemplates()
    } catch (error) {
      console.error('[coach/plan-lib] copy failed:', error)
      Taro.showToast({ title: '复制失败', icon: 'none' })
    }
  }

  const handleDelete = async (id: string) => {
    const res = await Taro.showModal({
      title: '删除模板',
      content: '删除后不可恢复，确认继续吗？'
    })
    if (!res.confirm) return
    try {
      await planLibService.deleteTemplate({ id })
      Taro.showToast({ title: '模板已删除', icon: 'success' })
      await loadTemplates()
    } catch (error) {
      console.error('[coach/plan-lib] delete failed:', error)
      Taro.showToast({ title: '删除失败', icon: 'none' })
    }
  }

  return (
    <View className='coach-plan-lib-page'>
      <ScrollView scrollY className='coach-plan-lib-page__scroll'>
        <View className='coach-plan-lib-page__content'>
          <View className='coach-plan-lib-page__hero'>
            <View>
              <Text className='coach-plan-lib-page__title'>计划库</Text>
              <Text className='coach-plan-lib-page__subtitle'>搜索、筛选、复制和管理模板</Text>
            </View>
            <View className='coach-plan-lib-page__create' onClick={handleCreate}>
              <Text>新建模板</Text>
            </View>
          </View>

          <View className='coach-plan-lib-page__search-card'>
            <Input
              className='coach-plan-lib-page__search-input'
              value={searchDraft}
              placeholder='搜索模板名称或描述'
              onInput={(event) => setSearchDraft(event.detail.value)}
              onConfirm={() => void handleSearch()}
            />
            <View className='coach-plan-lib-page__search-btn' onClick={() => void handleSearch()}>
              <Text>搜索</Text>
            </View>
          </View>

          <View className='coach-plan-lib-page__filters'>
            {[
              { label: '全部类型', value: '' as TemplateType },
              { label: '新手训练', value: 'beginner' as TemplateType },
              { label: '力量训练', value: 'strength' as TemplateType }
            ].map((option) => (
              <View
                key={option.label}
                className={`coach-plan-lib-page__filter-chip ${templateType === option.value ? 'active' : ''}`}
                onClick={() => void handleTypeChange(option.value)}
              >
                <Text>{option.label}</Text>
              </View>
            ))}
          </View>

          {tagOptions.length > 0 ? (
            <View className='coach-plan-lib-page__filters tags'>
              <View
                className={`coach-plan-lib-page__filter-chip ${selectedTag === '' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedTag('')
                  void loadTemplates()
                }}
              >
                <Text>全部标签</Text>
              </View>
              {tagOptions.map((tag) => (
                <View
                  key={tag}
                  className={`coach-plan-lib-page__filter-chip ${selectedTag === tag ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedTag(tag)
                    const filtered = templates.filter((template) => Array.isArray(template.tags) && template.tags.includes(tag))
                    setTemplates(filtered)
                  }}
                >
                  <Text>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {loading ? (
            <View className="coach-plan-lib-page__empty"><LoadingSpinner size={48} /></View>
          ) : templates.length === 0 ? (
            <View className='coach-plan-lib-page__empty'>当前没有匹配的模板</View>
          ) : (
            <View className='coach-plan-lib-page__list'>
              {templates.map((template) => (
                <View key={template.id} className='coach-plan-lib-page__card'>
                  <View className='coach-plan-lib-page__card-main' onClick={() => handleEdit(template.id)}>
                    <Text className='coach-plan-lib-page__card-title'>{template.name || '未命名模板'}</Text>
                    <Text className='coach-plan-lib-page__card-desc'>{template.description || '暂无模板说明'}</Text>
                    <View className='coach-plan-lib-page__meta-row'>
                      <Text>
                        {(template.trainingDaysCount ?? template.training_days_count ?? template.days_count ?? 0)} 天训练
                      </Text>
                      <Text>{formatDateYMD(template.updated_at || template.created_at || '')}</Text>
                    </View>
                    {Array.isArray(template.tags) && template.tags.length > 0 ? (
                      <View className='coach-plan-lib-page__tag-row'>
                        {template.tags.slice(0, 4).map((tag: string) => (
                          <Text key={`${template.id}-${tag}`} className='coach-plan-lib-page__tag'>{tag}</Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                  <View className='coach-plan-lib-page__card-actions'>
                    <Text className='coach-plan-lib-page__link' onClick={() => handleCopy(template.id)}>复制</Text>
                    <Text className='coach-plan-lib-page__link danger' onClick={() => handleDelete(template.id)}>删除</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}
