import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Image, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import {
  knowledgeService,
  type KnowledgeNodeListItem,
  type KnowledgeSearchResult,
  type KnowledgeTreeNode
} from '@/services/knowledgeService'
import { SCENARIO_QUICK_FIXES } from '@/constants/scenarioQuickFixes'
import './index.scss'

const NODE_TYPE_LABELS: Record<string, string> = {
  domain: '领域',
  category: '分类',
  topic: '主题',
  article: '文章',
  video: '视频',
  coach_article: '教练文章'
}

const BODY_REGION_OPTIONS = [
  { key: '斜方肌', label: '颈肩', icon: '🧠' },
  { key: '肩关节', label: '肩关节', icon: '🦾' },
  { key: '胸大肌', label: '胸部', icon: '🫁' },
  { key: '背阔肌', label: '背部', icon: '🧱' },
  { key: '腹直肌', label: '核心', icon: '🛡️' },
  { key: '髋关节', label: '髋部', icon: '🦵' },
  { key: '臀大肌', label: '臀部', icon: '🍑' },
  { key: '膝关节', label: '膝关节', icon: '🦿' },
  { key: '腓肠肌', label: '小腿', icon: '🏃' },
  { key: '踝关节', label: '踝关节', icon: '🦶' }
]

function stripHtml(html: string) {
  return (html || '').replace(/<[^>]*>/g, '').trim()
}

function formatShortDate(dateLike?: string | null) {
  if (!dateLike) return ''
  const date = new Date(dateLike)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type LibraryEntry = KnowledgeTreeNode | KnowledgeNodeListItem | KnowledgeSearchResult

function KnowledgeBase() {
  const [books, setBooks] = useState<any[]>([])
  const [articles, setArticles] = useState<any[]>([])
  const [tree, setTree] = useState<KnowledgeTreeNode[]>([])
  const [loadingBooks, setLoadingBooks] = useState(true)
  const [loadingArticles, setLoadingArticles] = useState(true)
  const [loadingTree, setLoadingTree] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedBodyRegion, setSelectedBodyRegion] = useState<string>('')
  const [bodyRegionNodes, setBodyRegionNodes] = useState<KnowledgeNodeListItem[]>([])
  const [loadingBodyRegion, setLoadingBodyRegion] = useState(false)
  const [focusedNodeTitle, setFocusedNodeTitle] = useState('')
  const [focusedNodes, setFocusedNodes] = useState<KnowledgeNodeListItem[]>([])
  const [focusedArticles, setFocusedArticles] = useState<KnowledgeNodeListItem[]>([])
  const [loadingFocusedNodes, setLoadingFocusedNodes] = useState(false)
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([])

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({ url: '/auth/login?returnTo=' + encodeURIComponent('/content/knowledge') })
      return
    }
    void loadHome()
  }, [])

  async function loadHome() {
    await Promise.all([
      loadBooks(),
      loadArticles(),
      loadTree()
    ])
  }

  async function loadBooks() {
    try {
      setLoadingBooks(true)
      const res = await knowledgeService.listKnowledgeBooks({
        is_published: true,
        is_free: true,
        page: 0,
        limit: 6
      })
      const sortedBooks = (res?.books || [])
        .sort((a: any, b: any) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        )
        .slice(0, 6)
      setBooks(sortedBooks)
    } catch (e) {
      console.error('[knowledge] load books:', e)
      setBooks([])
    } finally {
      setLoadingBooks(false)
    }
  }

  async function loadArticles() {
    try {
      setLoadingArticles(true)
      const res = await knowledgeService.listCoachContents({
        limit: 6,
        offset: 0
      })
      setArticles(res?.items || [])
    } catch (e) {
      console.error('[knowledge] load articles:', e)
      setArticles([])
    } finally {
      setLoadingArticles(false)
    }
  }

  async function loadTree() {
    try {
      setLoadingTree(true)
      const res = await knowledgeService.getTree()
      setTree(res || [])
      setExpandedNodeIds((res || []).slice(0, 2).map((item) => item.id))
    } catch (e) {
      console.error('[knowledge] load tree:', e)
      setTree([])
    } finally {
      setLoadingTree(false)
    }
  }

  async function openNodeCollection(nodeId: string, title: string) {
    try {
      setFocusedNodeTitle(title)
      setLoadingFocusedNodes(true)
      const res = await knowledgeService.listNodes({ parentId: nodeId })
      setFocusedNodes(res.nodes || [])
      setFocusedArticles(res.articles || [])
      if ((res.nodes?.length || 0) === 0 && (res.articles?.length || 0) === 0) {
        Taro.showToast({ title: '该节点下暂无内容', icon: 'none' })
      }
    } catch (error) {
      console.error('[knowledge] open node collection:', error)
      Taro.showToast({ title: '加载节点失败', icon: 'none' })
      setFocusedNodes([])
      setFocusedArticles([])
    } finally {
      setLoadingFocusedNodes(false)
    }
  }

  function handleBookClick(book: any) {
    Taro.navigateTo({ url: `/content/knowledge/book-detail?id=${book.id}` })
  }

  function handleArticleClick(item: any) {
    Taro.navigateTo({ url: `/content/content-detail?id=${item.content.id}` })
  }

  function openKnowledgeEntry(item: LibraryEntry) {
    const nodeType = item.node_type
    if (nodeType === 'coach_article' || (item as any).is_coach_content) {
      Taro.navigateTo({ url: `/content/content-detail?id=${item.id}` })
      return
    }
    if (nodeType === 'article' || nodeType === 'video') {
      Taro.navigateTo({ url: `/content/knowledge/node-detail?id=${item.id}` })
      return
    }
    void openNodeCollection(item.id, item.title)
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
      return
    }
    void openNodeCollection(result.id, result.title)
    setSearched(false)
  }

  async function handleBodyRegionClick(regionKey: string) {
    if (selectedBodyRegion === regionKey) {
      setSelectedBodyRegion('')
      setBodyRegionNodes([])
      return
    }

    setSelectedBodyRegion(regionKey)
    setLoadingBodyRegion(true)
    try {
      const res = await knowledgeService.listNodes({ bodyRegion: regionKey })
      setBodyRegionNodes(res.nodes || [])
    } catch (e) {
      console.error('[knowledge] load body region:', e)
      setBodyRegionNodes([])
      Taro.showToast({ title: '加载部位内容失败', icon: 'none' })
    } finally {
      setLoadingBodyRegion(false)
    }
  }

  function toggleTreeNode(nodeId: string) {
    setExpandedNodeIds((prev) => (
      prev.includes(nodeId)
        ? prev.filter((id) => id !== nodeId)
        : [...prev, nodeId]
    ))
  }

  const focusedEntries = useMemo(
    () => [...focusedNodes, ...focusedArticles],
    [focusedArticles, focusedNodes]
  )

  function renderEntryCard(item: LibraryEntry, source: 'region' | 'focused') {
    const isLeaf = item.node_type === 'article'
      || item.node_type === 'video'
      || item.node_type === 'coach_article'
      || Boolean((item as any).is_coach_content)
    const helperText = isLeaf
      ? '点击查看内容'
      : source === 'region'
        ? '点击查看该部位下的子节点'
        : '点击继续展开'

    return (
      <View key={`${source}-${item.id}`} className='entry-card' onClick={() => openKnowledgeEntry(item)}>
        <View className='entry-main'>
          <View className='entry-title-row'>
            <Text className='entry-title' numberOfLines={1}>{item.title}</Text>
            <Text className='entry-type'>{NODE_TYPE_LABELS[item.node_type] || item.node_type}</Text>
          </View>
          {!!item.description && (
            <Text className='entry-desc' numberOfLines={2}>{item.description}</Text>
          )}
          <Text className='entry-helper'>{helperText}</Text>
        </View>
        <Text className='entry-arrow'>›</Text>
      </View>
    )
  }

  function renderTreeNode(node: KnowledgeTreeNode, depth = 0): React.ReactNode {
    const children = node.children || []
    const hasChildren = children.length > 0
    const isExpanded = expandedNodeIds.includes(node.id)
    const isLeaf = node.node_type === 'article'
      || node.node_type === 'video'
      || node.node_type === 'coach_article'
      || Boolean(node.is_coach_content)

    return (
      <View key={node.id} className='tree-node-block'>
        <View
          className={`tree-node-row depth-${Math.min(depth, 2)}`}
          onClick={() => {
            if (hasChildren && !isLeaf) {
              toggleTreeNode(node.id)
            } else {
              openKnowledgeEntry(node)
            }
          }}
        >
          <View className='tree-node-main'>
            <Text className='tree-node-title' numberOfLines={1}>{node.title}</Text>
            {!!node.description && (
              <Text className='tree-node-desc' numberOfLines={1}>{node.description}</Text>
            )}
          </View>
          <Text className='tree-node-arrow'>
            {hasChildren && !isLeaf ? (isExpanded ? '－' : '＋') : '›'}
          </Text>
        </View>
        {hasChildren && isExpanded && (
          <View className='tree-node-children'>
            {children.map((child) => renderTreeNode(child, depth + 1))}
          </View>
        )}
      </View>
    )
  }

  return (
    <View className='knowledge-page'>
      <ScrollView scrollY className='knowledge-scroll'>
        <View className='page-shell'>
          <View className='hero-section'>
            <Text className='hero-badge'>知识库升级中</Text>
            <Text className='page-title'>知识库</Text>
            <Text className='page-desc'>现在先把 Web 端最重要的 4 层结构迁进来：搜索、场景急救箱、身体部位入口、知识体系。</Text>
          </View>

          <View className='search-section'>
            <View className='search-input-wrap'>
              <Text>🔍</Text>
              <Input
                className='search-input'
                placeholder='搜索知识点、部位或动作...'
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
            {['深蹲', '肩关节', '拉伸', '臀大肌'].map((term) => (
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
                        <View className='entry-title-row'>
                          <Text className='entry-title' numberOfLines={1}>{result.title}</Text>
                          <Text className='entry-type'>{NODE_TYPE_LABELS[result.node_type] || result.node_type}</Text>
                        </View>
                        {!!result.description && (
                          <Text className='entry-desc' numberOfLines={2}>{result.description}</Text>
                        )}
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
              <Text className='section-title'>场景急救箱</Text>
              <Text className='section-caption'>按场景直接开始，不必先懂完整体系</Text>
            </View>
            <View className='scenario-grid'>
              {SCENARIO_QUICK_FIXES.map((scenario) => (
                <View
                  key={scenario.slug}
                  className='scenario-card'
                  onClick={() => Taro.navigateTo({ url: `/me/toolbox/scenario/index?slug=${scenario.slug}` })}
                >
                  <Text className='scenario-icon'>{scenario.icon}</Text>
                  <Text className='scenario-title'>{scenario.title}</Text>
                  <Text className='scenario-desc' numberOfLines={2}>{scenario.description}</Text>
                  <Text className='scenario-meta'>约 {scenario.durationMinutes} 分钟</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='section'>
            <View className='section-head'>
              <Text className='section-title'>身体部位入口</Text>
              <Text className='section-caption'>先点部位，再看对应知识</Text>
            </View>
            <View className='region-grid'>
              {BODY_REGION_OPTIONS.map((region) => (
                <View
                  key={region.key}
                  className={`region-card ${selectedBodyRegion === region.key ? 'active' : ''}`}
                  onClick={() => void handleBodyRegionClick(region.key)}
                >
                  <Text className='region-icon'>{region.icon}</Text>
                  <Text className='region-label'>{region.label}</Text>
                </View>
              ))}
            </View>

            {selectedBodyRegion && (
              <View className='collection-panel'>
                <View className='collection-head'>
                  <Text className='collection-title'>{selectedBodyRegion} 相关知识</Text>
                  <Text className='collection-action' onClick={() => {
                    setSelectedBodyRegion('')
                    setBodyRegionNodes([])
                  }}>收起</Text>
                </View>
                {loadingBodyRegion ? (
                  <View className='empty-panel'><Text className='empty-panel-text'>加载中...</Text></View>
                ) : bodyRegionNodes.length === 0 ? (
                  <View className='empty-panel'><Text className='empty-panel-text'>这个部位暂时还没有内容。</Text></View>
                ) : (
                  <View className='entry-list'>
                    {bodyRegionNodes.map((item) => renderEntryCard(item, 'region'))}
                  </View>
                )}
              </View>
            )}
          </View>

          <View className='section'>
            <View className='section-head'>
              <Text className='section-title'>知识体系</Text>
              <Text className='section-caption'>从领域到主题，逐层展开</Text>
            </View>
            {loadingTree ? (
              <View className='empty-panel'><Text className='empty-panel-text'>知识体系加载中...</Text></View>
            ) : tree.length === 0 ? (
              <View className='empty-panel'><Text className='empty-panel-text'>知识体系还在整理中。</Text></View>
            ) : (
              <View className='tree-panel'>
                {tree.map((node) => renderTreeNode(node))}
              </View>
            )}
          </View>

          {focusedNodeTitle && (
            <View className='section'>
              <View className='section-head'>
                <Text className='section-title'>{focusedNodeTitle}</Text>
                <Text className='section-caption'>当前节点下的可浏览内容</Text>
              </View>
              {loadingFocusedNodes ? (
                <View className='empty-panel'><Text className='empty-panel-text'>加载中...</Text></View>
              ) : focusedEntries.length === 0 ? (
                <View className='empty-panel'><Text className='empty-panel-text'>这个节点下暂时还没有子内容。</Text></View>
              ) : (
                <View className='entry-list'>
                  {focusedEntries.map((item) => renderEntryCard(item, 'focused'))}
                </View>
              )}
            </View>
          )}

          <View className='section'>
            <View className='section-head'>
              <Text className='section-title'>最新书籍笔记</Text>
            </View>
            {loadingBooks ? (
              <View className='empty-panel'><Text className='empty-panel-text'>加载中...</Text></View>
            ) : books.length > 0 ? (
              <View className='books-grid'>
                {books.map((book) => (
                  <View
                    key={book.id}
                    className='book-card'
                    onClick={() => handleBookClick(book)}
                  >
                    {book.cover_image ? (
                      <Image className='book-cover' src={book.cover_image} mode='aspectFill' />
                    ) : (
                      <View className='book-cover-placeholder'>
                        <Text>📘</Text>
                      </View>
                    )}
                    <Text className='book-title' numberOfLines={1}>{book.title || '未命名书籍'}</Text>
                    {!!book.summary && (
                      <Text className='book-summary' numberOfLines={2}>{book.summary}</Text>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <View className='empty-panel'><Text className='empty-panel-text'>暂无书籍</Text></View>
            )}
          </View>

          <View className='section'>
            <View className='section-head'>
              <Text className='section-title'>最新技术文章</Text>
            </View>
            {loadingArticles ? (
              <View className='empty-panel'><Text className='empty-panel-text'>加载中...</Text></View>
            ) : articles.length > 0 ? (
              <View className='articles-list'>
                {articles.map((item) => (
                  <View
                    key={item.content.id}
                    className='article-card'
                    onClick={() => handleArticleClick(item)}
                  >
                    <View className='article-header'>
                      <Text className='article-author'>{item.coach?.name || '教练'}</Text>
                      <Text className='article-date'>{formatShortDate(item.content?.created_at)}</Text>
                    </View>
                    <Text className='article-title' numberOfLines={2}>{item.content.title || '未命名文章'}</Text>
                    <Text className='article-content' numberOfLines={3}>
                      {stripHtml(item.content.content || '') || '点击查看详情'}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View className='empty-panel'><Text className='empty-panel-text'>暂无文章</Text></View>
            )}
          </View>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default KnowledgeBase
