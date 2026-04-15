import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { coachService } from '@/services/coach/coachService'
import './index.scss'

type ContentType = 'text' | 'video' | 'image' | 'live' | 'plan'
type TierFilter = 'all' | 0 | 1 | 2 | 3
type TypeFilter = 'all' | ContentType

const CONTENT_TYPE_OPTIONS: Array<{ label: string; value: TypeFilter }> = [
  { label: '全部类型', value: 'all' },
  { label: '图文', value: 'text' },
  { label: '视频', value: 'video' },
  { label: '图片', value: 'image' },
  { label: '直播', value: 'live' },
  { label: '计划', value: 'plan' }
]

const TIER_OPTIONS: Array<{ label: string; value: TierFilter }> = [
  { label: '全部权限', value: 'all' },
  { label: '所有人', value: 0 },
  { label: '仅订阅', value: 1 },
  { label: '高级订阅', value: 2 },
  { label: 'VIP', value: 3 }
]

function formatDateText(value?: string | null) {
  if (!value) return '暂无时间'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '暂无时间'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function stripHtml(input: any) {
  return String(input || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getContentTypeLabel(type?: string | null) {
  const map: Record<string, string> = {
    text: '图文',
    video: '视频',
    image: '图片',
    live: '直播',
    plan: '计划'
  }
  return map[String(type || '')] || '内容'
}

function getTierLabel(tier?: number | null) {
  const map: Record<number, string> = {
    0: '所有人可见',
    1: '仅订阅可见',
    2: '高级订阅可见',
    3: 'VIP 可见'
  }
  return map[Number(tier ?? 0)] || '所有人可见'
}

function formatPrice(priceCents?: number | null) {
  const value = Number(priceCents ?? 0)
  if (!Number.isFinite(value) || value <= 0) return '免费'
  return `¥${(value / 100).toFixed(2)}`
}

function CoachContent() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')

  const loadContent = useCallback(async () => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({ url: '/auth/login?returnTo=' + encodeURIComponent('/coach/content') })
      return
    }

    try {
      setLoading(true)
      const user = Taro.getStorageSync('user')
      const coachRes = await coachService.getCoach({ userId: user?.id })
      if (!coachRes?.coach?.id) {
        setList([])
        return
      }

      const res = await coachService.getContents({ coachId: coachRes.coach.id, limit: 100, offset: 0 })
      setList(Array.isArray(res?.contents) ? res.contents : [])
    } catch (error) {
      console.error('[coach/content] load:', error)
      setList([])
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadContent()
  }, [loadContent])

  useDidShow(() => {
    void loadContent()
  })

  const filteredList = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()

    return list.filter((item) => {
      const matchesKeyword = !keyword || String(item?.title || '').toLowerCase().includes(keyword) || stripHtml(item?.content).toLowerCase().includes(keyword)
      const matchesType = typeFilter === 'all' || item?.content_type === typeFilter
      const matchesTier = tierFilter === 'all' || Number(item?.required_tier ?? 0) === tierFilter
      return matchesKeyword && matchesType && matchesTier
    })
  }, [list, searchKeyword, tierFilter, typeFilter])

  const stats = useMemo(() => {
    const freeCount = list.filter((item) => Number(item?.required_tier ?? 0) === 0).length
    const subscriptionCount = list.filter((item) => Number(item?.required_tier ?? 0) > 0).length
    const featuredCount = list.filter((item) => !!item?.is_featured).length
    return {
      total: list.length,
      freeCount,
      subscriptionCount,
      featuredCount
    }
  }, [list])

  const handleCreate = useCallback(() => {
    Taro.navigateTo({ url: '/coach/content/edit' })
  }, [])

  const handleEdit = useCallback((content: any) => {
    Taro.navigateTo({ url: `/coach/content/edit?id=${content.id}` })
  }, [])

  const handleDelete = useCallback(async (content: any) => {
    const res = await Taro.showModal({
      title: '确认删除',
      content: `确定删除「${content?.title || '未命名内容'}」吗？删除后无法恢复。`,
      confirmText: '删除',
      confirmColor: '#dc2626'
    })

    if (!res.confirm) return

    try {
      const deleteRes = await coachService.deleteContent(content.id)
      if (deleteRes?.success) {
        Taro.showToast({ title: '删除成功', icon: 'success' })
        await loadContent()
        return
      }
      Taro.showToast({ title: deleteRes?.message || '删除失败', icon: 'none' })
    } catch (error) {
      console.error('[coach/content] delete:', error)
      Taro.showToast({ title: '删除失败', icon: 'none' })
    }
  }, [loadContent])

  return (
    <View className='coach-content-page'>
      <ScrollView scrollY className='page-scroll'>
        <View className='hero-card'>
          <View className='hero-card__content'>
            <Text className='hero-card__eyebrow'>内容管理</Text>
            <Text className='hero-card__title'>按类型、权益和精选状态来管内容</Text>
            <Text className='hero-card__desc'>
              这边补齐网页端最关键的心智：先看全量内容，再按可见范围和内容类型筛选，而不是只看一个简单列表。
            </Text>
          </View>
          <View className='hero-card__action' onClick={handleCreate}>
            <Text className='hero-card__action-text'>新建内容</Text>
          </View>
        </View>

        <View className='stats-grid'>
          <View className='stat-card'>
            <Text className='stat-card__label'>内容总数</Text>
            <Text className='stat-card__value'>{stats.total}</Text>
          </View>
          <View className='stat-card'>
            <Text className='stat-card__label'>所有人可见</Text>
            <Text className='stat-card__value'>{stats.freeCount}</Text>
          </View>
          <View className='stat-card'>
            <Text className='stat-card__label'>订阅可见</Text>
            <Text className='stat-card__value'>{stats.subscriptionCount}</Text>
          </View>
          <View className='stat-card'>
            <Text className='stat-card__label'>精选内容</Text>
            <Text className='stat-card__value'>{stats.featuredCount}</Text>
          </View>
        </View>

        <View className='search-card'>
          <Input
            className='search-input'
            value={searchKeyword}
            placeholder='搜索标题或正文关键词'
            onInput={(event) => setSearchKeyword(event.detail.value)}
          />
        </View>

        <View className='filter-group'>
          <Text className='filter-group__label'>可见范围</Text>
          <View className='filter-row'>
            {TIER_OPTIONS.map((option) => (
              <View
                key={String(option.value)}
                className={`filter-chip ${tierFilter === option.value ? 'active' : ''}`}
                onClick={() => setTierFilter(option.value)}
              >
                <Text className='filter-chip__text'>{option.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='filter-group'>
          <Text className='filter-group__label'>内容类型</Text>
          <View className='filter-row'>
            {CONTENT_TYPE_OPTIONS.map((option) => (
              <View
                key={String(option.value)}
                className={`filter-chip ${typeFilter === option.value ? 'active' : ''}`}
                onClick={() => setTypeFilter(option.value)}
              >
                <Text className='filter-chip__text'>{option.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {loading ? (
          <View className='empty-wrap'>加载中...</View>
        ) : filteredList.length === 0 ? (
          <View className='empty-wrap'>
            <Text className='empty-title'>没有匹配的内容</Text>
            <Text className='empty-desc'>可以尝试调整搜索词、权限范围或内容类型筛选。</Text>
            <View className='empty-action' onClick={handleCreate}>
              <Text className='empty-action__text'>去新建一篇内容</Text>
            </View>
          </View>
        ) : (
          <View className='content-list'>
            {filteredList.map((item) => {
              const excerpt = stripHtml(item?.content).slice(0, 88) || '暂无内容摘要'

              return (
                <View key={item.id} className='content-card'>
                  <View className='content-card__head'>
                    <View className='content-card__title-wrap'>
                      <Text className='content-card__title'>{item?.title || '未命名内容'}</Text>
                      <Text className='content-card__meta'>
                        更新于 {formatDateText(item?.updated_at || item?.created_at)}
                      </Text>
                    </View>
                    {item?.is_featured ? <Text className='content-badge featured'>精选</Text> : null}
                  </View>

                  <View className='content-card__badge-row'>
                    <Text className='content-badge type'>{getContentTypeLabel(item?.content_type)}</Text>
                    <Text className='content-badge tier'>{getTierLabel(item?.required_tier)}</Text>
                    <Text className={`content-badge price ${Number(item?.price_cents ?? 0) > 0 ? 'paid' : 'free'}`}>
                      {formatPrice(item?.price_cents)}
                    </Text>
                  </View>

                  <Text className='content-card__desc'>
                    {excerpt}
                    {stripHtml(item?.content).length > 88 ? '...' : ''}
                  </Text>

                  {Array.isArray(item?.tags) && item.tags.length > 0 ? (
                    <View className='content-card__tags'>
                      {item.tags.slice(0, 4).map((tag: string) => (
                        <Text key={`${item.id}-${tag}`} className='content-tag'>#{tag}</Text>
                      ))}
                    </View>
                  ) : null}

                  <View className='content-card__stats'>
                    <Text className='content-stat'>浏览 {Number(item?.views_count ?? 0)}</Text>
                    <Text className='content-stat'>点赞 {Number(item?.likes_count ?? 0)}</Text>
                    <Text className='content-stat'>评论 {Number(item?.comments_count ?? 0)}</Text>
                  </View>

                  <View className='content-card__actions'>
                    <View className='action-link edit' onClick={() => handleEdit(item)}>
                      <Text className='action-link__text'>编辑</Text>
                    </View>
                    <View className='action-link danger' onClick={() => void handleDelete(item)}>
                      <Text className='action-link__text'>删除</Text>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default CoachContent
