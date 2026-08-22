import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Icon } from '@/components/Icon'
import { Trophy, Target, Zap, Dumbbell, Users, ChevronRight } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import { rankingService } from '@/services/rankingService'
import type { ListLeaderboardItem } from '@/types/leaderboard'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

function RankingIndex() {
  const { effectiveTheme } = useTheme()
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
      case 'motion_game_pullup':
      case 'motion_game_pushup':
        return Zap
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

  return (
    <PageThemeRoot>
    <View className={`ranking-page theme-${effectiveTheme}`}>
      <ScrollView className='ranking-scroll' scrollY>
        <View className='ranking-content'>
          <View className='ranking-hero'>
            <View className='ranking-hero-badge'>
              <Icon component={Trophy} size={14} color='#F7B267' />
              <Text className='ranking-hero-badge-text'>挑战已开启</Text>
            </View>
            <View className='ranking-hero-title-row'>
              <Text className='ranking-hero-title'>COACHLINK</Text>
              <Text className='ranking-hero-title ranking-hero-title-accent'>RANKING</Text>
            </View>
            <Text className='ranking-hero-desc'>
              记录你的每一次超越。在这个赛场上，汗水是唯一的入场券，实力是最高的话语权。
            </Text>
          </View>

          {loading ? (
            <View className='ranking-list'>
              {[1, 2, 3].map((i) => (
                <View key={i} className='ranking-card ranking-card-skeleton'>
                  <View className='skeleton-card-top'>
                    <View className='skeleton-icon' />
                    <View className='skeleton-meta' />
                  </View>
                  <View className='skeleton-line skeleton-title' />
                  <View className='skeleton-line skeleton-desc' />
                  <View className='skeleton-footer' />
                </View>
              ))}
            </View>
          ) : leaderboards.length === 0 ? (
            <View className='empty-state'>
              <View className='empty-icon'>
                <Text className='iconfont icon-ranking empty-icon-text' />
              </View>
              <Text className='empty-text'>暂无排行榜</Text>
              <Text className='empty-desc'>新的挑战开放后会显示在这里。</Text>
            </View>
          ) : (
            <View className='ranking-list'>
              {leaderboards.map((lb, index) => {
                const IconComp = getIcon(lb.type)
                const isFeatured = index === 1 || (leaderboards.length === 1 && index === 0)
                return (
                  <View
                    key={lb.id}
                    className={`ranking-card ${isFeatured ? 'ranking-card-featured' : ''}`}
                    onClick={() => handleCardClick(lb)}
                  >
                    <View className='card-top'>
                      <View className='card-icon-wrap'>
                        <Icon component={IconComp} size={24} color='currentColor' />
                      </View>
                      <View className='card-stats'>
                        <Icon component={Users} size={14} color='currentColor' />
                        <Text className='card-stats-text'>已参与: {lb.statusCount ?? 0}</Text>
                      </View>
                    </View>
                    <View className='card-body'>
                      <Text className='card-title'>{lb.title}</Text>
                      <Text className='card-desc'>
                        {lb.description || '暂无描述，参与挑战展现你的实力吧！'}
                      </Text>
                    </View>
                    <View className='card-footer'>
                      <Text className='card-cta'>立即挑战</Text>
                      <View className='card-arrow'>
                        <Icon component={ChevronRight} size={18} color='currentColor' />
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          )}

          <Text className='ranking-footnote'>* 排行榜实时更新，确保您的数据真实有效</Text>
        </View>
      </ScrollView>

      <BottomNav />
    </View>
    </PageThemeRoot>
  )
}

export default RankingIndex
