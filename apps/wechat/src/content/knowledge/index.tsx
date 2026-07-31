import React, { useEffect, useState } from 'react'
import { Image, Input, ScrollView, Text, View } from '@tarojs/components'
import { Search } from '@nutui/icons-react-taro'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import { useTheme } from '@/hooks/useTheme'
import { authService } from '@/services/authService'
import {
  knowledgeService,
  type KnowledgeSearchResult,
  type PublicArticleListItem,
  type PublicTrainingPlanLevel,
  type PublicTrainingPlanListItem
} from '@/services/knowledgeService'
import { groupKnowledgeBooks, type KnowledgeBookCollection } from '@/utils/knowledgeBooks'
import './index.scss'

const PLAN_LEVEL_LABELS: Record<PublicTrainingPlanLevel, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高阶'
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? new Date(time).toLocaleDateString('zh-CN') : ''
}

function KnowledgeBase() {
  const { effectiveTheme } = useTheme()
  const [isGuest, setIsGuest] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [trainingPlans, setTrainingPlans] = useState<PublicTrainingPlanListItem[]>([])
  const [trainingPlanTotal, setTrainingPlanTotal] = useState(0)
  const [articles, setArticles] = useState<PublicArticleListItem[]>([])
  const [articleTotal, setArticleTotal] = useState(0)
  const [bookCollections, setBookCollections] = useState<KnowledgeBookCollection<any>[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [loadingArticles, setLoadingArticles] = useState(true)
  const [loadingBooks, setLoadingBooks] = useState(true)

  useEffect(() => {
    const session = authService.getAuthSession({ normalize: true })
    const guest = !session.isAuthenticated
    setIsGuest(guest)
    void loadTrainingPlans()
    void loadArticles()
    if (guest) {
      setLoadingBooks(false)
    } else {
      void loadBooks()
    }
  }, [])

  async function loadTrainingPlans() {
    try {
      const result = await knowledgeService.listTrainingPlans({
        level: 'all',
        specialty: 'all',
        limit: 6,
        offset: 0
      })
      setTrainingPlans(result.plans || [])
      setTrainingPlanTotal(result.total || 0)
    } catch (error) {
      console.error('[knowledge] load training plans:', error)
      setTrainingPlans([])
    } finally {
      setLoadingPlans(false)
    }
  }

  async function loadArticles() {
    try {
      const result = await knowledgeService.listPublicArticles({ limit: 4, offset: 0 })
      setArticles(result.items || [])
      setArticleTotal(result.total || 0)
    } catch (error) {
      console.error('[knowledge] load articles:', error)
      setArticles([])
    } finally {
      setLoadingArticles(false)
    }
  }

  async function loadBooks() {
    try {
      const result = await knowledgeService.listKnowledgeBooks({
        is_published: true,
        page: 0,
        limit: 1000
      })
      setBookCollections(groupKnowledgeBooks(result?.books || []).slice(0, 4))
    } catch (error) {
      console.error('[knowledge] load books:', error)
      setBookCollections([])
    } finally {
      setLoadingBooks(false)
    }
  }

  async function handleSearch() {
    const query = searchKeyword.trim()
    if (!query) return
    setSearching(true)
    setSearched(true)
    try {
      setSearchResults(await knowledgeService.search(query))
    } catch (error) {
      console.error('[knowledge] search:', error)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  function handleResultClick(result: KnowledgeSearchResult) {
    if (result.node_type === 'article' || result.node_type === 'video') {
      Taro.navigateTo({ url: `/content/knowledge/node-detail?id=${result.id}` })
    }
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
      <View className={`knowledge-page page-with-float-nav theme-${effectiveTheme}`}>
        <ScrollView scrollY className='knowledge-scroll page-scroll'>
          <View className='page-shell'>
            <View className='hero-section'>
              <Text className='hero-title'>知识库</Text>
              <Text className='hero-subtitle'>训练计划、精选好文和书籍笔记，都集中在这里。</Text>
            </View>

            <View className='search-section'>
              <View className='search-input-wrap'>
                <Search size={18} color='#9CA3AF' />
                <Input
                  className='search-input'
                  placeholder='搜索计划、文章或书籍'
                  value={searchKeyword}
                  onInput={(event) => setSearchKeyword(event.detail.value)}
                  onConfirm={() => void handleSearch()}
                />
              </View>
              <View className='search-btn' onClick={() => void handleSearch()}>
                <Text>搜索</Text>
              </View>
            </View>

            {searched && (
              <View className='section search-results-section'>
                <View className='section-head'>
                  <Text className='section-title'>搜索结果</Text>
                  <Text
                    className='section-action'
                    onClick={() => {
                      setSearched(false)
                      setSearchKeyword('')
                      setSearchResults([])
                    }}
                  >
                    清空
                  </Text>
                </View>
                {searching ? (
                  <View className='empty-panel'><LoadingSpinner size={48} /></View>
                ) : searchResults.length > 0 ? (
                  <View className='entry-list'>
                    {searchResults.map((result) => (
                      <View key={result.id} className='entry-card' onClick={() => handleResultClick(result)}>
                        <View className='entry-main'>
                          <Text className='entry-title' numberOfLines={1}>{result.title}</Text>
                          <Text className='entry-desc' numberOfLines={2}>
                            {result.description || '点击查看内容'}
                          </Text>
                        </View>
                        <Text className='entry-arrow'>›</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View className='empty-panel'><Text className='empty-panel-text'>暂无匹配内容。</Text></View>
                )}
              </View>
            )}

            <View className='section'>
              <View className='section-head'>
                <View>
                  <Text className='section-title'>训练计划</Text>
                  <Text className='section-caption'>
                    {trainingPlanTotal > 0 ? `${trainingPlanTotal} 套已发布计划` : '按目标与水平挑选计划'}
                  </Text>
                </View>
                <Text
                  className='section-action'
                  onClick={() => Taro.navigateTo({ url: '/content/knowledge/plans/index' })}
                >
                  全部计划
                </Text>
              </View>
              {loadingPlans ? (
                <View className='empty-panel'><LoadingSpinner size={48} /></View>
              ) : trainingPlans.length > 0 ? (
                <ScrollView scrollX className='horizontal-scroll' enhanced showScrollbar={false}>
                  <View className='horizontal-track'>
                    {trainingPlans.map((plan) => (
                      <View
                        key={plan.id}
                        className='plan-card'
                        onClick={() => void handlePlanClick(plan)}
                      >
                        <View className='plan-topline'>
                          <Text className='plan-specialty' numberOfLines={1}>{plan.specialtyLabel || plan.goal}</Text>
                          <Text className={`plan-level ${plan.level}`}>{PLAN_LEVEL_LABELS[plan.level]}</Text>
                        </View>
                        <Text className='plan-title' numberOfLines={2}>{plan.name}</Text>
                        <Text className='plan-description' numberOfLines={2}>
                          {plan.description || '查看完整训练安排与适用人群'}
                        </Text>
                        <View className='plan-meta'>
                          <Text>{plan.weeks}周</Text>
                          <Text>{plan.daysPerWeek}天/周</Text>
                          {plan.entryKind === 'reference' && <Text>来源索引</Text>}
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <View className='empty-panel'><Text className='empty-panel-text'>暂无已发布训练计划。</Text></View>
              )}
            </View>

            <View className='section'>
              <View className='section-head'>
                <View>
                  <Text className='section-title'>精选好文</Text>
                  <Text className='section-caption'>
                    {articleTotal > 0 ? `${articleTotal} 篇平台与教练内容` : '平台编辑与教练的训练经验'}
                  </Text>
                </View>
                <Text
                  className='section-action'
                  onClick={() => Taro.navigateTo({ url: '/content/articles' })}
                >
                  全部好文
                </Text>
              </View>
              {loadingArticles ? (
                <View className='empty-panel'><LoadingSpinner size={48} /></View>
              ) : articles.length > 0 ? (
                <View className='article-list'>
                  {articles.map((article) => (
                    <View
                      key={article.id}
                      className='article-card'
                      onClick={() => Taro.navigateTo({
                        url: `/content/content-detail?id=${encodeURIComponent(article.id)}`
                      })}
                    >
                      <View className='article-author'>
                        <View className='article-avatar'>
                          {article.coachAvatarUrl ? (
                            <Image className='article-avatar-image' src={article.coachAvatarUrl} mode='aspectFill' />
                          ) : (
                            <Text>{article.coachName.slice(0, 1)}</Text>
                          )}
                        </View>
                        <Text className='article-coach-name'>{article.coachName}</Text>
                        {article.featured && <Text className='article-featured'>精选</Text>}
                      </View>
                      <Text className='article-title' numberOfLines={2}>{article.title}</Text>
                      <Text className='article-summary' numberOfLines={2}>{article.summary || '阅读全文'}</Text>
                      <Text className='article-date'>{formatDate(article.publishedAt)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View className='empty-panel'>
                  <Text className='empty-panel-text'>教练发布文字内容后，会自动汇入这里。</Text>
                </View>
              )}
            </View>

            <View className='section'>
              <View className='section-head'>
                <View>
                  <Text className='section-title'>书籍笔记</Text>
                  <Text className='section-caption'>经典训练书籍的重点整理</Text>
                </View>
                {!isGuest && (
                  <Text
                    className='section-action'
                    onClick={() => Taro.navigateTo({ url: '/content/knowledge/books/index' })}
                  >
                    全部书籍
                  </Text>
                )}
              </View>
              {loadingBooks ? (
                <View className='empty-panel'><LoadingSpinner size={48} /></View>
              ) : isGuest ? (
                <View className='empty-panel guest-books'>
                  <Text className='empty-panel-text'>登录后可阅读和保存书籍笔记。</Text>
                  <View className='login-button' onClick={() => Taro.navigateTo({ url: '/auth/login' })}>
                    <Text>去登录</Text>
                  </View>
                </View>
              ) : bookCollections.length > 0 ? (
                <View className='book-list'>
                  {bookCollections.map((collection) => (
                    <View
                      key={collection.slug}
                      className='book-card'
                      onClick={() => Taro.navigateTo({
                        url: `/content/knowledge/book-detail?id=${collection.representativeBook.id}`
                      })}
                    >
                      <View className='book-icon'><Text>书</Text></View>
                      <View className='book-main'>
                        <Text className='book-title' numberOfLines={1}>{collection.displayTitle}</Text>
                        <Text className='book-summary' numberOfLines={2}>{collection.summary}</Text>
                        <Text className='book-count'>
                          {collection.chapterCount > 0 ? `${collection.chapterCount} 篇笔记` : '进入阅读'}
                        </Text>
                      </View>
                      <Text className='entry-arrow'>›</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View className='empty-panel'><Text className='empty-panel-text'>暂无书籍笔记。</Text></View>
              )}
            </View>
          </View>
        </ScrollView>
        <BottomNav />
      </View>
    </PageThemeRoot>
  )
}

export default KnowledgeBase
