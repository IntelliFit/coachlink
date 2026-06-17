import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import { Search } from '@nutui/icons-react-taro'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import {
  knowledgeService,
  type PublicTrainingPlanLevel,
  type PublicTrainingPlanListItem,
  type KnowledgeSearchResult
} from '@/services/knowledgeService'
import { authService } from '@/services/authService'
import { groupKnowledgeBooks, type KnowledgeBookCollection } from '@/utils/knowledgeBooks'
import './index.scss'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import { useTheme } from '@/hooks/useTheme'

const QUICK_TAGS = ['平台期', '动作标准', '肩腕腰痛', '训练计划']

const FOCUS_TOPICS = [
  {
    title: '训练计划与平台期',
    description: '负重引体、卧推、深蹲、力量举与体态纠正等高需求方向。',
    actionLabel: '搜索相关计划',
    query: '平台期 训练计划 负重引体 卧推 深蹲'
  },
  {
    title: '动作标准与自查',
    description: '引体、臂屈伸、深蹲、卧推、硬拉的检查表与常见代偿。',
    actionLabel: '查看动作自查',
    query: '动作标准 自查 引体 臂屈伸 深蹲 卧推 硬拉'
  },
  {
    title: '伤病避险与恢复',
    description: '肩、腕、肘、腰背等高频不适的训练调整和避险边界。',
    actionLabel: '查看避险资料',
    query: '伤病 康复 疼痛 肩 手腕 肘 腰背'
  }
]

const PLAN_LEVEL_LABELS: Record<PublicTrainingPlanLevel, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高阶'
}

function KnowledgeBase() {
  const { effectiveTheme } = useTheme()
  const [bookCollections, setBookCollections] = useState<KnowledgeBookCollection<any>[]>([])
  const [loadingBooks, setLoadingBooks] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [isGuest, setIsGuest] = useState(false)
  const [trainingPlans, setTrainingPlans] = useState<PublicTrainingPlanListItem[]>([])
  const [loadingTrainingPlans, setLoadingTrainingPlans] = useState(true)

  useEffect(() => {
    const session = authService.getAuthSession({ normalize: true })
    setIsGuest(!session.isAuthenticated)
    void loadBooks()
    void loadTrainingPlans()
  }, [])

  async function loadTrainingPlans() {
    try {
      setLoadingTrainingPlans(true)
      const res = await knowledgeService.listTrainingPlans({
        level: 'all',
        specialty: 'all',
        limit: 8,
        offset: 0
      })
      setTrainingPlans(res.plans || [])
    } catch (e) {
      console.error('[knowledge] load training plans:', e)
      setTrainingPlans([])
    } finally {
      setLoadingTrainingPlans(false)
    }
  }

  async function loadBooks() {
    try {
      setLoadingBooks(true)
      const res = await knowledgeService.listKnowledgeBooks({
        is_published: true,
        page: 0,
        limit: 20
      })
      const collections = groupKnowledgeBooks(res?.books || [])
      setBookCollections(collections.slice(0, 4))
    } catch (e) {
      console.error('[knowledge] load books:', e)
      setBookCollections([])
    } finally {
      setLoadingBooks(false)
    }
  }

  async function handleSearch(keyword?: string) {
    const q = (keyword ?? searchKeyword).trim()
    if (!q) return
    setSearchKeyword(q)
    setSearching(true)
    setSearched(true)
    try {
      const results = await knowledgeService.search(q)
      setSearchResults(results)
    } catch (e) {
      console.error('[knowledge] search:', e)
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

  return (
    <PageThemeRoot>
    <View className={`knowledge-page page-with-float-nav theme-${effectiveTheme}`}>
      <ScrollView scrollY className='knowledge-scroll page-scroll'>
        <View className='page-shell'>
          <View className='hero-section'>
            <Text className='hero-title'>知识库</Text>
            <Text className='hero-subtitle'>训练计划、动作标准、伤病避险与书籍资料。</Text>
          </View>

          {isGuest && (
            <View className='empty-panel guest-panel'>
              <Text className='empty-panel-text'>
                当前可先浏览公开资料。登录后可继续使用收藏、购买记录和个人训练数据。
              </Text>
            </View>
          )}

          <View className='construction-notice'>
            <Text className='construction-notice-title'>知识库仍在建设中</Text>
            <Text className='construction-notice-copy'>
              当前先开放最核心的训练与学习资料。涉及疼痛、麻木、放射痛、急性损伤或长期不适时，本页内容不能替代医疗诊断，应优先线下就医或做运动康复评估。
            </Text>
          </View>

          <View className='search-section'>
            <View className='search-input-wrap'>
              <Search size={18} color='#9CA3AF' />
              <Input
                className='search-input'
                placeholder='搜索动作、计划、伤病或书籍...'
                value={searchKeyword}
                onInput={(e) => setSearchKeyword(e.detail.value)}
                onConfirm={() => handleSearch()}
                focus={false}
              />
            </View>
            <View className='search-btn' onClick={() => handleSearch()}>
              <Text>搜索</Text>
            </View>
          </View>

          <View className='quick-tags'>
            {QUICK_TAGS.map((term) => (
              <View
                key={term}
                className='quick-tag'
                onClick={() => {
                  void handleSearch(term)
                }}
              >
                <Text>{term}</Text>
              </View>
            ))}
          </View>

          {searched && (
            <View id='knowledge-search-results' className='search-results-section'>
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
                <View className='search-loading'>搜索中...</View>
              ) : searchResults.length === 0 ? (
                <View className='empty-panel'>
                  <Text className='empty-panel-text'>暂无匹配内容。</Text>
                </View>
              ) : (
                <View className='entry-list'>
                  {searchResults.map((result) => (
                    <View key={result.id} className='entry-card' onClick={() => handleResultClick(result)}>
                      <View className='entry-main'>
                        <Text className='entry-title' numberOfLines={1}>{result.title}</Text>
                        {!!result.description && (
                          <Text className='entry-desc' numberOfLines={2}>{result.description}</Text>
                        )}
                        <Text className='entry-helper'>点击查看内容</Text>
                      </View>
                      <Text className='entry-arrow'>›</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View className='focus-topic-section'>
            <View className='section-head section-head-stack'>
              <View>
                <Text className='section-kicker'>精选专题</Text>
                <Text className='section-title'>先看最常见的问题</Text>
              </View>
            </View>
            <View className='focus-topic-list'>
              {FOCUS_TOPICS.map((topic, index) => (
                <View key={topic.title} className='focus-topic-card' onClick={() => void handleSearch(topic.query)}>
                  <View className='focus-topic-index'>
                    <Text>{index + 1}</Text>
                  </View>
                  <View className='focus-topic-main'>
                    <Text className='focus-topic-title'>{topic.title}</Text>
                    <Text className='focus-topic-desc' numberOfLines={2}>{topic.description}</Text>
                    <Text className='focus-topic-action'>{topic.actionLabel}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View id='knowledge-plans' className='section'>
            <View className='section-head section-head-stack'>
              <View>
                <Text className='section-title'>重点训练计划</Text>
                <Text className='section-caption'>
                  优先展示平台期、专项力量和体态纠正方向，便于直接复制使用。
                </Text>
              </View>
            </View>
            {loadingTrainingPlans ? (
              <View className='empty-panel'><LoadingSpinner size={48} /></View>
            ) : trainingPlans.length === 0 ? (
              <View className='empty-panel'>
                <Text className='empty-panel-text'>暂无训练计划。</Text>
              </View>
            ) : (
              <ScrollView scrollX className='builtin-plan-scroll' enhanced showScrollbar={false}>
                <View className='builtin-plan-track'>
                  {trainingPlans.slice(0, 8).map((plan) => (
                    <View
                      key={plan.id}
                      className='builtin-plan-card'
                      onClick={() => Taro.navigateTo({ url: `/content/knowledge/plan-detail?id=${encodeURIComponent(plan.slug || plan.id)}` })}
                    >
                      <View className='builtin-plan-topline'>
                        <Text className='builtin-plan-sport' numberOfLines={1}>{plan.specialtyLabel || plan.goal}</Text>
                        <Text className={`builtin-plan-level ${plan.level}`}>
                          {PLAN_LEVEL_LABELS[plan.level]}
                        </Text>
                      </View>
                      <Text className='builtin-plan-title' numberOfLines={2}>{plan.name}</Text>
                      <Text className='builtin-plan-desc' numberOfLines={2}>{plan.description}</Text>
                      <View className='builtin-plan-meta'>
                        <Text>{plan.weeks}周</Text>
                        <Text>{plan.daysPerWeek}天/周</Text>
                        <Text>{plan.sport}</Text>
                      </View>
                      <Text className='builtin-plan-link'>查看并加入</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>

          <View id='knowledge-books' className='section'>
            <View className='section-head'>
              <View>
                <Text className='section-title'>书籍笔记</Text>
                <Text className='section-caption'>深度资料保留在这里，适合需要理解原理时阅读。</Text>
              </View>
            </View>
            {loadingBooks ? (
              <View className='empty-panel'><LoadingSpinner size={48} /></View>
            ) : bookCollections.length > 0 ? (
              <View className='book-list'>
                {bookCollections.map((collection) => (
                  <View
                    key={collection.slug}
                    className='book-row-card'
                    onClick={() => Taro.navigateTo({ url: `/content/knowledge/book-detail?id=${collection.representativeBook.id}` })}
                  >
                    <View className='book-row-icon'>
                      <Text>书</Text>
                    </View>
                    <View className='book-row-main'>
                      <View className='book-row-title-wrap'>
                        <Text className='book-row-title'>{collection.displayTitle}</Text>
                        {collection.chapterCount > 0 && (
                          <Text className='book-row-badge'>{collection.chapterCount} 篇</Text>
                        )}
                      </View>
                      <Text className='book-row-summary' numberOfLines={2}>{collection.summary}</Text>
                      <Text className='book-row-link'>进入阅读</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className='empty-panel'>
                <Text className='empty-panel-text'>暂无书籍笔记。</Text>
              </View>
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
