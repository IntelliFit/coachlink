import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { Lock } from '@nutui/icons-react-taro'
import Taro from '@tarojs/taro'
import { knowledgeService } from '@/services/knowledgeService'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

interface ArticleListItem {
  id: string
  coachId: string
  coachName: string
  coachAvatarUrl: string | null
  title: string
  summary: string
  free: boolean
  featured: boolean
  publishedAt: string | null
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatDate(dateText?: string): string {
  if (!dateText) return ''
  const time = new Date(dateText).getTime()
  if (!Number.isFinite(time)) return ''
  return new Date(time).toLocaleDateString('zh-CN')
}

export default function ArticlesPage() {
  const { effectiveTheme } = useTheme()
  const [articles, setArticles] = useState<ArticleListItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadArticles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await knowledgeService.listPublicArticles({ limit: 30, offset: 0 })
      const list = Array.isArray(res?.items) ? res.items : []
      const mapped: ArticleListItem[] = list
        .map((item: any) => {
          return {
            id: String(item?.id || ''),
            coachId: String(item?.coachId || ''),
            coachName: String(item?.coachName || '教练'),
            coachAvatarUrl: item?.coachAvatarUrl || null,
            title: String(item?.title || '未命名内容'),
            summary: stripHtml(String(item?.summary || '')).slice(0, 96) || '点击查看详情',
            free: !item?.priceCents && !item?.requiredTier,
            featured: !!item?.featured,
            publishedAt: item?.publishedAt || ''
          }
        })
        .filter((item) => !!item.id)
        .sort((a, b) => {
          const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
          const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
          return db - da
        })

      setArticles(mapped)
    } catch (error) {
      console.error('加载文章列表失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadArticles()
  }, [loadArticles])

  const handleArticleClick = (article: ArticleListItem) => {
    if (!article?.id) return
    Taro.navigateTo({
      url: `/content/content-detail?id=${encodeURIComponent(article.id)}`
    })
  }

  return (
    <View className={`articles-page theme-${effectiveTheme}`}>
      <View className='articles-header'>
        <Text className='articles-page-title'>精选好文</Text>
        <Text className='articles-page-sub'>平台编辑与教练发布的训练内容</Text>
        <Text className='articles-total'>共 {articles.length} 篇</Text>
      </View>

      {loading ? (
        <View className='articles-skeleton'>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} className='skeleton-card'>
              <View className='skeleton-line skeleton-line-sm' />
              <View className='skeleton-line skeleton-line-md' />
              <View className='skeleton-line skeleton-line-lg' />
              <View className='skeleton-line skeleton-line-md' />
            </View>
          ))}
        </View>
      ) : articles.length === 0 ? (
        <View className='articles-empty'>
          <Text className='articles-empty-text'>
            暂无文章。请教练在「内容管理」发布后，这里会自动展示。
          </Text>
        </View>
      ) : (
        <View className='articles-list'>
          {articles.map((article) => (
            <View
              key={article.id}
              className='article-card'
              onClick={() => handleArticleClick(article)}
            >
              <View className='article-card-top'>
                <View className='article-coach-info'>
                  <View className='article-coach-avatar'>
                    {article.coachAvatarUrl ? (
                      <Image className='article-coach-avatar-img' src={article.coachAvatarUrl} mode='aspectFill' />
                    ) : (
                      <View className='article-coach-avatar-placeholder'>
                        {article.coachName.slice(0, 1)}
                      </View>
                    )}
                  </View>
                  <Text className='article-coach-name'>{article.coachName}</Text>
                </View>
                <View className='article-card-top-right'>
                  {!article.free ? (
                    <View className='article-badge article-badge-locked'>
                      <Lock size={12} color='#99a2b3' style={{ marginRight: '4rpx' }} />
                      <Text>订阅内容</Text>
                    </View>
                  ) : article.free ? (
                    <View className='article-badge article-badge-free'>
                      <Text>免费</Text>
                    </View>
                  ) : (
                    <View className='article-badge article-badge-paid'>
                      <Text>付费</Text>
                    </View>
                  )}
                </View>
              </View>

              <Text className='article-card-title' numberOfLines={2}>{article.title}</Text>
              <Text className='article-card-summary' numberOfLines={2}>{article.summary}</Text>

              <View className='article-card-footer'>
                <Text className='article-date'>{formatDate(article.publishedAt)}</Text>
                <View className='article-link article-link-primary'>
                  <Text>阅读全文</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
