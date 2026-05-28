import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Image, Input } from '@tarojs/components'
import { Search, Target } from '@nutui/icons-react-taro'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import maleFrontSvgRaw from '@/assets/body-map/maleFrontSvg'
import maleBackSvgRaw from '@/assets/body-map/maleBackSvg'
import femaleFrontSvgRaw from '@/assets/body-map/femaleFrontSvg'
import femaleBackSvgRaw from '@/assets/body-map/femaleBackSvg'
import {
  knowledgeService,
  type KnowledgeNodeListItem,
  type PublicTrainingPlanLevel,
  type PublicTrainingPlanListItem,
  type KnowledgeSearchResult
} from '@/services/knowledgeService'
import { authService } from '@/services/authService'
import { studentService } from '@/services/studentService'
import { groupKnowledgeBooks, type KnowledgeBookCollection } from '@/utils/knowledgeBooks'
import { svgToDataUri } from '@/utils/svgToDataUri'
import './index.scss'

const QUICK_TAGS = ['深蹲', '拉伸', '减脂', '增肌']

const PLAN_SPECIALTY_FILTERS = [
  { key: 'all', label: '专项精选' },
  { key: 'bench_press', label: '卧推' },
  { key: 'squat', label: '深蹲' },
  { key: 'powerlifting', label: '力量举' },
  { key: 'weighted_pullup', label: '负重引体' },
  { key: 'weighted_dip', label: '负重双杠' },
  { key: 'posture', label: '体态纠正' },
  { key: 'foundation', label: '基础入门' }
]

const PLAN_LEVEL_LABELS: Record<PublicTrainingPlanLevel, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '专业'
}

const BODY_REGION_OPTIONS = [
  { key: '胸部', label: '胸部' },
  { key: '肩部', label: '肩部' },
  { key: '大臂', label: '大臂' },
  { key: '小臂', label: '小臂' },
  { key: '腹部', label: '核心' },
  { key: '背部', label: '背部' },
  { key: '臀部', label: '臀部' },
  { key: '大腿', label: '大腿' },
  { key: '小腿', label: '小腿' },
  { key: '关节', label: '关节' }
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
  { key: 'front' as const, label: '前视图' },
  { key: 'back' as const, label: '后视图' }
]

const BODY_REGION_HIT_AREAS = {
  front: [
    { key: '关节', x: 17, y: 22, width: 66, height: 70 },
    { key: '肩部', x: 18, y: 19, width: 64, height: 11 },
    { key: '胸部', x: 27, y: 25, width: 46, height: 13 },
    { key: '大臂', x: 12, y: 28, width: 76, height: 17 },
    { key: '小臂', x: 7, y: 39, width: 86, height: 18 },
    { key: '腹部', x: 34, y: 36, width: 32, height: 24 },
    { key: '大腿', x: 27, y: 57, width: 46, height: 24 },
    { key: '小腿', x: 29, y: 78, width: 42, height: 17 }
  ],
  back: [
    { key: '关节', x: 17, y: 22, width: 66, height: 70 },
    { key: '肩部', x: 18, y: 18, width: 64, height: 12 },
    { key: '背部', x: 26, y: 24, width: 48, height: 30 },
    { key: '大臂', x: 11, y: 29, width: 78, height: 18 },
    { key: '小臂', x: 7, y: 42, width: 86, height: 17 },
    { key: '臀部', x: 31, y: 53, width: 38, height: 13 },
    { key: '大腿', x: 27, y: 62, width: 46, height: 21 },
    { key: '小腿', x: 29, y: 80, width: 42, height: 15 }
  ]
} as const

function parseSvgCategoryMap(svg: string): Record<string, string> {
  const map: Record<string, string> = {}
  const regex = /<g[^>]*data-name="([^"]+)"[^>]*category="([^"]+)"[^>]*>/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(svg)) !== null) {
    map[match[1]] = match[2]
  }
  return map
}

function highlightSvgCategory(svg: string, selectedRegion: string) {
  let result = svg
    .replace(/fill:#fff/gi, 'fill:#222222')
    .replace(/fill="#fff"/gi, 'fill="#222222"')

  if (!selectedRegion) return result

  const categoryMap = parseSvgCategoryMap(svg)
  const dataNamesToHighlight = Object.entries(categoryMap)
    .filter(([, category]) => category === selectedRegion)
    .map(([dataName]) => dataName)

  for (const dataName of dataNamesToHighlight) {
    const safeName = dataName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(<g[^>]*data-name="${safeName}"[^>]*>)([\\s\\S]*?)(</g>)`, 'g')
    result = result.replace(regex, (_match, open, content, close) => {
      const highlighted = content
        .replace(/fill:#222222/gi, 'fill:#CF6D4E')
        .replace(/fill="#222222"/gi, 'fill="#CF6D4E"')
      return open + highlighted + close
    })
  }

  return result
}

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
  const [isGuest, setIsGuest] = useState(false)
  const [bodyMapGender, setBodyMapGender] = useState<'male' | 'female'>('male')
  const [planSpecialty, setPlanSpecialty] = useState('all')
  const [trainingPlans, setTrainingPlans] = useState<PublicTrainingPlanListItem[]>([])
  const [loadingTrainingPlans, setLoadingTrainingPlans] = useState(true)
  const bodyMapImageUrl = useMemo(() => {
    const svgRaw = bodyMapGender === 'female'
      ? (bodyView === 'front' ? femaleFrontSvgRaw : femaleBackSvgRaw)
      : (bodyView === 'front' ? maleFrontSvgRaw : maleBackSvgRaw)
    const svg = highlightSvgCategory(svgRaw, selectedBodyRegion)
    return svgToDataUri(
      svg.replace(
        /<svg\s/,
        '<svg style="width:100%;height:100%;display:block;" preserveAspectRatio="xMidYMid meet" '
      )
    )
  }, [bodyMapGender, bodyView, selectedBodyRegion])
  const bodyMapHitAreas = BODY_REGION_HIT_AREAS[bodyView]

  useEffect(() => {
    const session = authService.getAuthSession({ normalize: true })
    setIsGuest(!session.isAuthenticated)
    void loadBooks()
    void loadTrainingPlans('all')
    if (session.userId) {
      void loadBodyMapGender(session.userId)
    }
  }, [])

  async function loadTrainingPlans(specialty: string) {
    try {
      setLoadingTrainingPlans(true)
      const res = await knowledgeService.listTrainingPlans({
        level: 'all',
        specialty,
        limit: specialty === 'all' ? 12 : 16,
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

  function handlePlanSpecialtyChange(specialty: string) {
    setPlanSpecialty(specialty)
    void loadTrainingPlans(specialty)
  }

  async function loadBodyMapGender(userId: string) {
    try {
      const res = await studentService.getStudentProfile(userId)
      const gender = String(res?.profile?.gender || '').toLowerCase()
      setBodyMapGender(gender === 'female' || gender.includes('女') ? 'female' : 'male')
    } catch (e) {
      console.warn('[knowledge] load body map gender:', e)
    }
  }

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

          {isGuest && (
            <View className='empty-panel' style={{ marginBottom: '24rpx' }}>
              <Text className='empty-panel-text'>
                这里可以先浏览知识和路径内容，登录后再同步收藏、购买记录和个人训练数据。
              </Text>
            </View>
          )}

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
            <View className='section-head section-head-stack'>
              <View>
                <Text className='section-title'>专项训练计划库</Text>
                <Text className='section-caption'>
                  卧推、深蹲、力量举、负重引体、双杠和体态纠正优先展示
                </Text>
              </View>
              <View className='plan-filter-row'>
                {PLAN_SPECIALTY_FILTERS.map((filter) => (
                  <View
                    key={filter.key}
                    className={`plan-filter-chip ${planSpecialty === filter.key ? 'active' : ''}`}
                    onClick={() => handlePlanSpecialtyChange(filter.key)}
                  >
                    <Text>{filter.label}</Text>
                  </View>
                ))}
              </View>
            </View>
            {loadingTrainingPlans ? (
              <View className='empty-panel'><LoadingSpinner size={48} /></View>
            ) : trainingPlans.length === 0 ? (
              <View className='empty-panel'>
                <Text className='empty-panel-text'>暂无训练计划模板</Text>
              </View>
            ) : (
              <ScrollView scrollX className='builtin-plan-scroll' enhanced showScrollbar={false}>
                <View className='builtin-plan-track'>
                  {trainingPlans.map((plan) => (
                    <View
                      key={plan.id}
                      className='builtin-plan-card'
                      onClick={() => Taro.navigateTo({ url: `/content/knowledge/plan-detail?id=${encodeURIComponent(plan.slug || plan.id)}` })}
                    >
                      <View className='builtin-plan-topline'>
                        <Text className='builtin-plan-sport'>{plan.specialtyLabel || plan.goal}</Text>
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
                      <View className='builtin-plan-tags'>
                        {[plan.goal, ...plan.tags].filter(Boolean).slice(0, 3).map((tag) => (
                          <Text key={tag}>{tag}</Text>
                        ))}
                      </View>
                      <Text className='builtin-plan-link'>查看并加入</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>

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
              <View className='body-map-stage'>
                <View className='body-map-zoom'>
                  <Image
                    className='body-map-image'
                    src={bodyMapImageUrl}
                    mode='aspectFit'
                  />
                  <View className='body-map-hit-layer'>
                    {bodyMapHitAreas.map((area) => (
                      <View
                        key={`${bodyView}-${area.key}`}
                        className={`body-map-hit-area ${area.key === '关节' ? 'joint' : ''} ${selectedBodyRegion === area.key ? 'active' : ''}`}
                        style={{
                          left: `${area.x}%`,
                          top: `${area.y}%`,
                          width: `${area.width}%`,
                          height: `${area.height}%`
                        }}
                        onClick={() => void handleBodyRegionClick(area.key)}
                      />
                    ))}
                  </View>
                </View>
              </View>
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
