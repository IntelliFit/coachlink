import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, Image, Input } from '@tarojs/components'
import { Search, Target } from '@nutui/icons-react-taro'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import {
  knowledgeService,
  type KnowledgeNodeListItem,
  type KnowledgeSearchResult
} from '@/services/knowledgeService'
import { groupKnowledgeBooks, type KnowledgeBookCollection } from '@/utils/knowledgeBooks'
import './index.scss'

const QUICK_TAGS = ['深蹲', '拉伸', '减脂', '增肌']

const BODY_REGION_OPTIONS = [
  { key: '斜方肌', label: '颈肩' },
  { key: '肩关节', label: '肩关节' },
  { key: '胸大肌', label: '胸部' },
  { key: '背阔肌', label: '背部' },
  { key: '腹直肌', label: '核心' },
  { key: '髋关节', label: '髋部' },
  { key: '臀大肌', label: '臀部' },
  { key: '膝关节', label: '膝关节' },
  { key: '腓肠肌', label: '小腿' },
  { key: '踝关节', label: '踝关节' }
]

const BODY_MODE_OPTIONS = [
  {
    key: 'screening' as const,
    label: '先筛查',
    description: '先看是不是当前动作受限或疼痛的关键环节'
  },
  {
    key: 'training' as const,
    label: '再训练',
    description: '再看动作选择、发力路径和逐步加量'
  }
]

const BODY_VIEW_OPTIONS = [
  { key: 'front' as const, label: '前视图', imageUrl: '/assets/body-map/body-front.svg' },
  { key: 'back' as const, label: '后视图', imageUrl: '/assets/body-map/body-back.svg' }
]

function KnowledgeBase() {
  const [bookCollections, setBookCollections] = useState<KnowledgeBookCollection<any>[]>([])
  const [loadingBooks, setLoadingBooks] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedBodyRegion, setSelectedBodyRegion] = useState('')
  const [bodyMode, setBodyMode] = useState<'screening' | 'training'>('screening')
  const [bodyView, setBodyView] = useState<'front' | 'back'>('front')
  const [bodyRegionNodes, setBodyRegionNodes] = useState<KnowledgeNodeListItem[]>([])
  const [loadingBodyRegion, setLoadingBodyRegion] = useState(false)

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({ url: '/auth/login?returnTo=' + encodeURIComponent('/content/knowledge') })
      return
    }
    void loadBooks()
  }, [])

  useEffect(() => {
    if (!selectedBodyRegion) return
    void loadBodyRegion(selectedBodyRegion, bodyMode)
  }, [bodyMode, selectedBodyRegion])

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

  async function loadBodyRegion(regionKey: string, mode: 'screening' | 'training') {
    setLoadingBodyRegion(true)
    try {
      const res = await knowledgeService.listNodes({
        bodyRegion: regionKey,
        mode,
        limit: 6
      })
      setBodyRegionNodes(res.nodes || [])
    } catch (e) {
      console.error('[knowledge] load body region:', e)
      setBodyRegionNodes([])
      Taro.showToast({ title: '加载部位内容失败', icon: 'none' })
    } finally {
      setLoadingBodyRegion(false)
    }
  }

  async function handleSearch(keyword?: string) {
    const q = (keyword ?? searchKeyword).trim()
    if (!q) return
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

  async function handleBodyRegionClick(regionKey: string) {
    if (selectedBodyRegion === regionKey) {
      setSelectedBodyRegion('')
      setBodyRegionNodes([])
      return
    }

    setSelectedBodyRegion(regionKey)
    await loadBodyRegion(regionKey, bodyMode)
  }

  return (
    <View className='knowledge-page page-with-float-nav'>
      <ScrollView scrollY className='knowledge-scroll page-scroll'>
        <View className='page-shell'>
          <View className='hero-section'>
            <Text className='hero-title'>知识库</Text>
            <Text className='hero-subtitle'>点击身体部位，共建训练知识</Text>
          </View>

          <View className='search-section'>
            <View className='search-input-wrap'>
              <Search size={18} color='#9CA3AF' />
              <Input
                className='search-input'
                placeholder='搜索知识点...'
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
                  setSearchKeyword(term)
                  void handleSearch(term)
                }}
              >
                <Text>{term}</Text>
              </View>
            ))}
          </View>

          {searched && (
            <View className='search-results-section'>
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
                  收起
                </Text>
              </View>
              {searching ? (
                <View className='search-loading'>搜索中...</View>
              ) : searchResults.length === 0 ? (
                <View className='empty-panel'>
                  <Text className='empty-panel-text'>没有找到相关内容，试试其他关键词。</Text>
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

          <View className='section'>
            <View className='section-head'>
              <View>
                <Text className='section-title'>书籍笔记</Text>
                <Text className='section-caption'>先看每一本书，再进入书内章节</Text>
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
                      <Text>📙</Text>
                    </View>
                    <View className='book-row-main'>
                      <View className='book-row-title-wrap'>
                        <Text className='book-row-title'>{collection.displayTitle}</Text>
                        {collection.chapterCount > 0 && (
                          <Text className='book-row-badge'>{collection.chapterCount} 篇章节</Text>
                        )}
                      </View>
                      <Text className='book-row-summary' numberOfLines={2}>{collection.summary}</Text>
                      <Text className='book-row-link'>进入本书</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className='empty-panel'><Text className='empty-panel-text'>暂无书籍</Text></View>
            )}
          </View>

          <View className='section'>
            <View className='section-head section-head-stack'>
              <View>
                <Text className='section-title'>人体地图</Text>
                <Text className='section-caption'>
                  {BODY_MODE_OPTIONS.find((item) => item.key === bodyMode)?.description}
                </Text>
              </View>
              <View className='mode-switch'>
                {BODY_MODE_OPTIONS.map((option) => (
                  <View
                    key={option.key}
                    className={`mode-chip ${bodyMode === option.key ? 'active' : ''}`}
                    onClick={() => setBodyMode(option.key)}
                  >
                    <Text>{option.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View className='body-map-card'>
              <View className='body-map-toolbar'>
                <Text className='body-map-toolbar-label'>人体图</Text>
                <View className='body-view-switch'>
                  {BODY_VIEW_OPTIONS.map((option) => (
                    <View
                      key={option.key}
                      className={`body-view-chip ${bodyView === option.key ? 'active' : ''}`}
                      onClick={() => setBodyView(option.key)}
                    >
                      <Text>{option.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <Image
                className='body-map-image'
                src={BODY_VIEW_OPTIONS.find((item) => item.key === bodyView)?.imageUrl || BODY_VIEW_OPTIONS[0].imageUrl}
                mode='aspectFit'
              />
            </View>

            <View className='region-grid'>
              {BODY_REGION_OPTIONS.map((region) => (
                <View
                  key={region.key}
                  className={`region-card ${selectedBodyRegion === region.key ? 'active' : ''}`}
                  onClick={() => void handleBodyRegionClick(region.key)}
                >
                  <View className='region-icon'>
                    <Target size={20} color='#CF6D4E' />
                  </View>
                  <Text className='region-label'>{region.label}</Text>
                </View>
              ))}
            </View>

            {selectedBodyRegion && (
              <View className='collection-panel'>
                <View className='collection-head'>
                  <Text className='collection-title'>{selectedBodyRegion} 相关文章</Text>
                  <Text className='collection-action' onClick={() => {
                    setSelectedBodyRegion('')
                    setBodyRegionNodes([])
                  }}>收起</Text>
                </View>
                {loadingBodyRegion ? (
                  <View className='empty-panel'><LoadingSpinner size={48} /></View>
                ) : bodyRegionNodes.length === 0 ? (
                  <View className='empty-panel'><Text className='empty-panel-text'>这个部位暂时还没有内容。</Text></View>
                ) : (
                  <View className='entry-list'>
                    {bodyRegionNodes.map((item) => (
                      <View
                        key={item.id}
                        className='entry-card'
                        onClick={() => Taro.navigateTo({ url: `/content/knowledge/node-detail?id=${item.id}` })}
                      >
                        <View className='entry-main'>
                          <Text className='entry-title' numberOfLines={1}>{item.title}</Text>
                          {!!item.description && (
                            <Text className='entry-desc' numberOfLines={2}>{item.description}</Text>
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
          </View>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default KnowledgeBase
