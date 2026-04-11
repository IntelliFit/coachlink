import React, { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Icon } from '@/components/Icon'
import { Trophy, Target, Zap, Dumbbell, Users, ChevronRight } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import { rankingService } from '@/services/rankingService'
import type { ListLeaderboardItem } from '@/types/leaderboard'
import './index.scss'

function RankingIndex() {
  const [leaderboards, setLeaderboards] = useState<ListLeaderboardItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let token: string | null = null
    try {
      token = Taro.getStorageSync('token')
    } catch (e) {
      console.error('[ranking] get token:', e)
    }
    if (!token) {
      Taro.redirectTo({
        url: '/auth/login?returnTo=' + encodeURIComponent('/discovery/ranking')
      }).catch((err) => {
        console.error('[ranking] redirectTo 失败:', err);
        // 如果 redirectTo 失败，尝试使用 reLaunch
        Taro.reLaunch({ url: '/auth/login?returnTo=' + encodeURIComponent('/discovery/ranking') });
      })
      return
    }
    loadLeaderboards()
  }, [])

  async function loadLeaderboards() {
    try {
      setLoading(true)
      const res = await rankingService.listLeaderboard({
        page: 1,
        limit: 20,
        countStatus: 'approved'
      })
      if (res?.leaderboards?.length) {
        const sorted = [...res.leaderboards].sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        )
        setLeaderboards(sorted)
      } else {
        setLeaderboards([])
      }
    } catch (e) {
      console.error('[ranking] load:', e)
      setLeaderboards([])
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  function getIcon(type: string | null) {
    switch (type) {
      case 'time':
        return Target
      case 'weight':
        return Dumbbell
      case 'reps':
        return Zap
      default:
        return Trophy
    }
  }

  function handleCardClick(lb: ListLeaderboardItem) {
    Taro.navigateTo({ url: '/discovery/ranking/detail?id=' + lb.id })
  }

  const renderSkeleton = () => (
    <View className="skeleton-list">
      {[1, 2, 3].map((i) => (
        <View key={i} className="skeleton-card">
          <View className="skeleton-row">
            <View className="skeleton-icon" />
            <View className="skeleton-line skeleton-title" />
          </View>
          <View className="skeleton-line skeleton-desc" />
          <View className="skeleton-line skeleton-desc" />
        </View>
      ))}
    </View>
  )

  return (
    <View className="ranking-page">
      <View className="page-header">
        <View className="header-content">
          <View className="title-section">
            <Text className="page-title">排行榜</Text>
            <Text className="page-subtitle">记录每一次超越，实力是最高的话语权</Text>
          </View>
        </View>
      </View>

      {loading ? (
        renderSkeleton()
      ) : leaderboards.length === 0 ? (
        <View className="empty-state">
          <Text className="empty-icon">🏆</Text>
          <Text className="empty-text">暂无排行榜</Text>
        </View>
      ) : (
        <View className="ranking-list">
          {leaderboards.map((lb) => {
            const IconComp = getIcon(lb.type)
            return (
              <View
                key={lb.id}
                className="ranking-card"
                onClick={() => handleCardClick(lb)}
              >
                <View className="card-top">
                  <View className="card-icon-wrap">
                    <Icon component={IconComp} size={24} color="#F49227" />
                  </View>
                  <View className="card-stats">
                    <Icon component={Users} size={14} color="currentColor" />
                    <Text style={{ marginLeft: 4 }}>已参与 {lb.statusCount ?? 0}</Text>
                  </View>
                </View>
                <View className="card-body">
                  <Text className="card-title">{lb.title}</Text>
                  <Text className="card-desc">
                    {lb.description || '暂无描述，参与挑战展现你的实力吧！'}
                  </Text>
                </View>
                <View className="card-footer">
                  <Text className="card-cta">立即挑战</Text>
                  <View className="card-arrow">
                    <Icon component={ChevronRight} size={18} color="currentColor" />
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      )}

      <BottomNav />
    </View>
  )
}

export default RankingIndex
