import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { studentActionLibService } from '@/services/studentActionLibService'
import './index.scss'

interface ActionItem {
  id: string
  name: string
  detail?: string | null
  positions?: string[] | null
  attrs?: string[] | null
  url?: string | null
  type?: string | null
  created_at?: string
}

function StudentActionLib() {
  const [actions, setActions] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const itemsPerPage = 20

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({ url: '/auth/login?returnTo=' + encodeURIComponent('/training/actions') })
      return
    }
    loadActions()
  }, [])

  useEffect(() => {
    if (searchTerm) {
      // 搜索时重置到第一页
      setCurrentPage(1)
      searchActions()
    } else {
      // 重置到第一页并加载
      setCurrentPage(1)
      loadActions(1)
    }
  }, [searchTerm])

  async function loadActions(page?: number) {
    const pageToLoad = page ?? currentPage
    try {
      setLoading(true)
      const res = await studentActionLibService.listActions({
        page: pageToLoad,
        limit: itemsPerPage,
        search: searchTerm || undefined
      })
      if (res) {
        if (pageToLoad === 1) {
          setActions(res.actions || [])
        } else {
          setActions(prev => [...prev, ...(res.actions || [])])
        }
        setTotalCount(res.totalCount || 0)
        setHasMore((res.actions?.length || 0) >= itemsPerPage)
      } else {
        if (pageToLoad === 1) {
          setActions([])
        }
        setHasMore(false)
      }
    } catch (e) {
      console.error('[student/action-lib] load:', e)
      if (pageToLoad === 1) {
        setActions([])
      }
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  async function searchActions() {
    try {
      setLoading(true)
      const res = await studentActionLibService.listActions({
        page: 1,
        limit: itemsPerPage,
        search: searchTerm || undefined
      })
      if (res) {
        setActions(res.actions || [])
        setTotalCount(res.totalCount || 0)
        setHasMore(false)
      } else {
        setActions([])
      }
    } catch (e) {
      console.error('[student/action-lib] search:', e)
      setActions([])
      Taro.showToast({ title: '搜索失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  function handleSearchInput(e: any) {
    setSearchTerm(e.detail.value)
  }

  function handleLoadMore() {
    if (!hasMore || loading) return
    const nextPage = currentPage + 1
    setCurrentPage(nextPage)
    loadActions(nextPage)
  }

  function handleActionClick(action: ActionItem) {
    if (!action?.id) {
      Taro.showToast({ title: '动作信息异常', icon: 'none' })
      return
    }
    const cacheKey = `action_detail_${action.id}`
    Taro.setStorageSync(cacheKey, action)
    Taro.navigateTo({
      url: `/training/action-detail/index?id=${encodeURIComponent(action.id)}`
    })
  }

  return (
    <View className="student-action-lib-page">
      {/* 功能提示 - 放在顶部 */}
      <View className="hint-card">
        <Text className="hint-text">添加、编辑、删除动作等功能请到电脑端使用</Text>
      </View>

      {/* 搜索栏 */}
      <View className="search-bar">
        <Input
          className="search-input"
          placeholder="搜索动作名称"
          value={searchTerm}
          onInput={handleSearchInput}
          confirmType="search"
        />
      </View>

      {loading && actions.length === 0 ? (
        <View className="loading-wrap">加载中...</View>
      ) : actions.length === 0 ? (
        <View className="empty-wrap">
          <Text className="empty-text">{searchTerm ? '未找到相关动作' : '暂无动作，请到电脑端添加'}</Text>
        </View>
      ) : (
        <ScrollView 
          scrollY 
          className="action-list"
          onScrollToLower={handleLoadMore}
          lowerThreshold={100}
        >
          {actions.map((action) => (
            <View 
              key={action.id} 
              className="action-card"
              onClick={() => handleActionClick(action)}
            >
              <View className="action-header">
                <Text className="action-name">{action.name || '未命名'}</Text>
                {action.type && (
                  <Text className="action-type">{action.type}</Text>
                )}
              </View>
              {action.detail && (
                <Text className="action-detail" numberOfLines={2}>
                  {action.detail}
                </Text>
              )}
              {action.positions && action.positions.length > 0 && (
                <View className="action-tags">
                  {action.positions.map((pos: string, idx: number) => (
                    <Text key={idx} className="tag">{pos}</Text>
                  ))}
                </View>
              )}
              {action.created_at && (
                <Text className="action-time">
                  {new Date(action.created_at).toLocaleDateString('zh-CN')}
                </Text>
              )}
            </View>
          ))}
          {hasMore && (
            <View className="load-more" onClick={handleLoadMore}>
              <Text className="load-more-text">加载更多</Text>
            </View>
          )}
          {!hasMore && actions.length > 0 && (
            <View className="no-more">
              <Text className="no-more-text">已加载全部 {totalCount} 个动作</Text>
            </View>
          )}
        </ScrollView>
      )}

      <BottomNav />
    </View>
  )
}

export default StudentActionLib
