import React, { useEffect, useMemo, useState } from 'react'
import { Image, Input, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import { ClButton, ClChip, ClTabs, ClTag } from '@/components/ui'
import { useTheme } from '@/hooks/useTheme'
import { authService } from '@/services/authService'
import {
  knowledgeService,
  type KnowledgeSearchResult,
  type PublicArticleListItem,
  type PublicTrainingPlanLevel,
  type PublicTrainingPlanListItem
} from '@/services/knowledgeService'
import { getCapsuleLayout } from '@/utils/capsuleLayout'
import { groupKnowledgeBooks, type KnowledgeBookCollection } from '@/utils/knowledgeBooks'
import './index.scss'

const PLAN_LEVEL_LABELS: Record<PublicTrainingPlanLevel, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高阶'
}

type KnowledgeTab = 'plans' | 'articles' | 'books'

interface SpecialtyOption {
  key: string
  label: string
}

const PLAN_PAGE_SIZE = 20
const SPECIALTY_SAMPLE_SIZE = 50

function formatDate(value?: string | null) {
  if (!value) return ''
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? new Date(time).toLocaleDateString('zh-CN') : ''
}

/** Specialty chips come from the published plans themselves, ordered by their priority. */
function collectSpecialties(plans: PublicTrainingPlanListItem[]): SpecialtyOption[] {
  const seen = new Map<string, { label: string; priority: number }>()
  for (const plan of plans) {
    if (!plan.specialtyKey || !plan.specialtyLabel || seen.has(plan.specialtyKey)) continue
    seen.set(plan.specialtyKey, { label: plan.specialtyLabel, priority: plan.specialtyPriority ?? 999 })
  }
  return Array.from(seen.entries())
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([key, value]) => ({ key, label: value.label }))
}

function KnowledgeBase() {
  const { effectiveTheme } = useTheme()
  const [isGuest, setIsGuest] = useState(false)
  const [activeTab, setActiveTab] = useState<KnowledgeTab>('plans')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>([])
  const [specialty, setSpecialty] = useState('all')
  const [trainingPlans, setTrainingPlans] = useState<PublicTrainingPlanListItem[]>([])
  const [trainingPlanTotal, setTrainingPlanTotal] = useState(0)
  const [articles, setArticles] = useState<PublicArticleListItem[]>([])
  const [articleTotal, setArticleTotal] = useState(0)
  const [bookCollections, setBookCollections] = useState<KnowledgeBookCollection<any>[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [loadingArticles, setLoadingArticles] = useState(true)
  const [loadingBooks, setLoadingBooks] = useState(true)

  const capsule = useMemo(() => getCapsuleLayout(), [])

  useEffect(() => {
    const session = authService.getAuthSession({ normalize: true })
    const guest = !session.isAuthenticated
    setIsGuest(guest)
    void loadSpecialtiesAndPlans()
    void loadArticles()
    if (guest) {
      setLoadingBooks(false)
    } else {
      void loadBooks()
    }
  }, [])

  async function loadSpecialtiesAndPlans() {
    try {
      const result = await knowledgeService.listTrainingPlans({
        level: 'all',
        specialty: 'all',
        limit: SPECIALTY_SAMPLE_SIZE,
        offset: 0
      })
      const plans = result.plans || []
      setSpecialties(collectSpecialties(plans))
      setTrainingPlans(plans.slice(0, PLAN_PAGE_SIZE))
      setTrainingPlanTotal(result.total || 0)
    } catch (error) {
      console.error('[knowledge] load training plans:', error)
      setTrainingPlans([])
    } finally {
      setLoadingPlans(false)
    }
  }

  async function loadPlansFor(nextSpecialty: string) {
    setSpecialty(nextSpecialty)
    setLoadingPlans(true)
    try {
      const result = await knowledgeService.listTrainingPlans({
        level: 'all',
        specialty: nextSpecialty,
        limit: PLAN_PAGE_SIZE,
        offset: 0
      })
      setTrainingPlans(result.plans || [])
    } catch (error) {
      console.error('[knowledge] load training plans:', error)
      setTrainingPlans([])
    } finally {
      setLoadingPlans(false)
    }
  }

  async function loadArticles() {
    try {
      const result = await knowledgeService.listPublicArticles({ limit: 10, offset: 0 })
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
      setBookCollections(groupKnowledgeBooks(result?.books || []))
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

  function clearSearch() {
    setSearched(false)
    setSearchKeyword('')
    setSearchResults([])
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

  const tabs = [
    { key: 'plans' as const, label: '训练计划', count: trainingPlanTotal || undefined },
    { key: 'articles' as const, label: '文章', count: articleTotal || undefined },
    { key: 'books' as const, label: '书籍', count: !isGuest && bookCollections.length ? bookCollections.length : undefined }
  ]

  const renderState = (text: string, action?: React.ReactNode) => (
    <View className='kb-state'>
      <Text className='kb-state__text'>{text}</Text>
      {action}
    </View>
  )

  const renderPlans = () => (
    <View className='kb-panel'>
      {specialties.length > 0 ? (
        <ScrollView scrollX className='kb-chips' showScrollbar={false}>
          <View className='kb-chips__row'>
            <ClChip selected={specialty === 'all'} onClick={() => specialty !== 'all' && void loadPlansFor('all')}>全部</ClChip>
            {specialties.map((item) => (
              <ClChip key={item.key} selected={specialty === item.key} onClick={() => specialty !== item.key && void loadPlansFor(item.key)}>
                {item.label}
              </ClChip>
            ))}
          </View>
        </ScrollView>
      ) : null}
      {loadingPlans ? (
        <View className='kb-state'><LoadingSpinner size={48} /></View>
      ) : trainingPlans.length === 0 ? (
        renderState(isGuest ? '登录后可浏览全部训练计划。' : '暂无已发布训练计划。', isGuest ? (
          <ClButton variant='secondary' size='md' onClick={() => Taro.navigateTo({ url: '/auth/login' })}>去登录</ClButton>
        ) : undefined)
      ) : (
        <View className='kb-list'>
          {trainingPlans.map((plan) => (
            <View key={plan.id} className='kb-plan' hoverClass='kb-plan--pressed' hoverStayTime={60} onClick={() => void handlePlanClick(plan)}>
              <View className='kb-plan__tags'>
                {plan.specialtyLabel || plan.goal ? <ClTag tone='clay'>{plan.specialtyLabel || plan.goal}</ClTag> : null}
                <ClTag>{PLAN_LEVEL_LABELS[plan.level] || plan.level}</ClTag>
                {plan.entryKind === 'reference' ? <ClTag tone='outline'>来源索引</ClTag> : null}
                <Text className='kb-plan__meta cl-num'>{plan.weeks} 周 · {plan.daysPerWeek} 天/周</Text>
              </View>
              <Text className='kb-plan__name'>{plan.name}</Text>
              <Text className='kb-plan__desc'>{plan.description || '查看完整训练安排与适用人群'}</Text>
            </View>
          ))}
          <Text className='kb-more' onClick={() => Taro.navigateTo({ url: '/content/knowledge/plans/index' })}>全部计划 ›</Text>
        </View>
      )}
    </View>
  )

  const renderArticles = () => (
    <View className='kb-panel'>
      {loadingArticles ? (
        <View className='kb-state'><LoadingSpinner size={48} /></View>
      ) : articles.length === 0 ? (
        renderState('教练发布文字内容后，会自动汇入这里。')
      ) : (
        <View className='kb-list'>
          {articles.map((article) => (
            <View
              key={article.id}
              className='kb-article'
              hoverClass='kb-article--pressed'
              hoverStayTime={60}
              onClick={() => Taro.navigateTo({ url: `/content/content-detail?id=${encodeURIComponent(article.id)}` })}
            >
              <Text className='kb-article__title'>{article.title}</Text>
              {article.summary ? <Text className='kb-article__summary'>{article.summary}</Text> : null}
              <View className='kb-article__author'>
                <View className='kb-article__avatar'>
                  {article.coachAvatarUrl ? (
                    <Image className='kb-article__avatar-img' src={article.coachAvatarUrl} mode='aspectFill' />
                  ) : (
                    <Text>{article.coachName.slice(0, 1)}</Text>
                  )}
                </View>
                <Text className='kb-article__name'>{article.coachName}</Text>
                {article.featured ? <ClTag tone='clay'>精选</ClTag> : null}
                <Text className='kb-article__date cl-num'>{formatDate(article.publishedAt)}</Text>
              </View>
            </View>
          ))}
          <Text className='kb-more' onClick={() => Taro.navigateTo({ url: '/content/articles' })}>全部文章 ›</Text>
        </View>
      )}
    </View>
  )

  const renderBooks = () => (
    <View className='kb-panel'>
      {loadingBooks ? (
        <View className='kb-state'><LoadingSpinner size={48} /></View>
      ) : isGuest ? (
        renderState('登录后可阅读和保存书籍笔记。', (
          <ClButton variant='secondary' size='md' onClick={() => Taro.navigateTo({ url: '/auth/login' })}>去登录</ClButton>
        ))
      ) : bookCollections.length === 0 ? (
        renderState('暂无书籍笔记。')
      ) : (
        <View className='kb-list'>
          {bookCollections.map((collection) => (
            <View
              key={collection.slug}
              className='kb-book'
              hoverClass='kb-book--pressed'
              hoverStayTime={60}
              onClick={() => Taro.navigateTo({ url: `/content/knowledge/book-detail?id=${collection.representativeBook.id}` })}
            >
              <View className='kb-book__cover'><Text>{collection.displayTitle.slice(0, 1)}</Text></View>
              <View className='kb-book__body'>
                <Text className='kb-book__title'>{collection.displayTitle}</Text>
                {collection.summary ? <Text className='kb-book__summary'>{collection.summary}</Text> : null}
                <Text className='kb-book__count'>{collection.chapterCount > 0 ? `${collection.chapterCount} 篇读书笔记` : '进入阅读'}</Text>
              </View>
              <Text className='kb-book__arrow'>›</Text>
            </View>
          ))}
          <Text className='kb-more' onClick={() => Taro.navigateTo({ url: '/content/knowledge/books/index' })}>全部书籍 ›</Text>
        </View>
      )}
    </View>
  )

  const renderSearch = () => (
    <View className='kb-panel'>
      <View className='kb-search-head'>
        <Text className='kb-search-head__title'>“{searchKeyword.trim()}”的搜索结果</Text>
        <Text className='kb-search-head__clear' onClick={clearSearch}>清空</Text>
      </View>
      {searching ? (
        <View className='kb-state'><LoadingSpinner size={48} /></View>
      ) : searchResults.length === 0 ? (
        renderState('暂无匹配内容，换个关键词试试。')
      ) : (
        <View className='kb-list'>
          {searchResults.map((result) => (
            <View key={result.id} className='kb-result' onClick={() => handleResultClick(result)}>
              <View className='kb-result__body'>
                <Text className='kb-result__title'>{result.title}</Text>
                <Text className='kb-result__desc'>{result.description || '点击查看内容'}</Text>
              </View>
              <Text className='kb-book__arrow'>›</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )

  return (
    <PageThemeRoot>
      <View className={`kb-page ${effectiveTheme === 'dark' ? 'cl-theme-dark' : ''}`}>
        <View className='kb-head' style={{ paddingTop: `${capsule.top + capsule.height + 12}px` }}>
          <Text className='kb-head__title'>知识库</Text>
          <View className='kb-search'>
            <Text className='kb-search__icon'>⌕</Text>
            <Input
              className='kb-search__input'
              placeholder='搜索计划、文章或书籍'
              value={searchKeyword}
              confirmType='search'
              onInput={(event) => setSearchKeyword(event.detail.value)}
              onConfirm={() => void handleSearch()}
            />
            {searchKeyword ? (
              <View className='kb-search__clear' ariaRole='button' ariaLabel='清空搜索' onClick={clearSearch}><Text>×</Text></View>
            ) : null}
          </View>
          {!searched ? <ClTabs items={tabs} activeKey={activeTab} onChange={(key) => setActiveTab(key as KnowledgeTab)} /> : null}
        </View>

        {searched
          ? renderSearch()
          : activeTab === 'plans'
            ? renderPlans()
            : activeTab === 'articles'
              ? renderArticles()
              : renderBooks()}

        <BottomNav />
      </View>
    </PageThemeRoot>
  )
}

export default KnowledgeBase
