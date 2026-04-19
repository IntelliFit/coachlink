import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { request } from '@/utils/request'
import { Book, Calendar, Calculator, Edit, List, Location } from '@nutui/icons-react-taro'
import './index.scss'

export default function StreetliftingIndex() {
  const [stats, setStats] = useState<{ totalCount: number; lastUpdated: string | null }>({ totalCount: 0, lastUpdated: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await request<{ totalCount?: number; lastUpdated?: string }>({
          url: '/api/streetlifting-index/stats',
          method: 'POST',
          data: {}
        })
        if (res.success && res.data) {
          setStats({
            totalCount: res.data.totalCount ?? 0,
            lastUpdated: res.data.lastUpdated ?? null
          })
        }
      } catch (e) {
        console.error('[streetlifting-index] stats:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const nav = (path: string) => Taro.navigateTo({ url: path })

  return (
    <View className="streetlifting-page">
      <ScrollView scrollY className="streetlifting-scroll">
        <View className="hero">
          <Text className="hero-title">街健力量指数</Text>
          <Text className="hero-desc">世界首创的街健力量评估体系，基于真实数据持续迭代。</Text>
        </View>

        {loading ? (
          <View className="stats-card"><Text className="stats-loading">加载中…</Text></View>
        ) : (
          <View className="stats-card">
            <Text className="stats-value">{stats.totalCount}</Text>
            <Text className="stats-label">条数据</Text>
            {stats.lastUpdated && (
              <Text className="stats-meta">更新于 {stats.lastUpdated.slice(0, 10)}</Text>
            )}
          </View>
        )}

        <View className="nav-grid">
          <View className="nav-item primary" onClick={() => nav('/streetlifting/index/calculator')}>
            <Text className="nav-icon"><Calculator size={20} /></Text>
            <Text className="nav-text">计算我的力量分</Text>
          </View>
          <View className="nav-item" onClick={() => nav('/streetlifting/index/data')}>
            <Text className="nav-icon"><List size={20} /></Text>
            <Text className="nav-text">社区数据</Text>
          </View>
          <View className="nav-item" onClick={() => nav('/streetlifting/index/locations')}>
            <Text className="nav-icon"><Location size={20} /></Text>
            <Text className="nav-text">场地/地点</Text>
          </View>
          <View className="nav-item" onClick={() => nav('/streetlifting/index/methodology')}>
            <Text className="nav-icon"><Book size={20} /></Text>
            <Text className="nav-text">计算方法论</Text>
          </View>
          <View className="nav-item" onClick={() => nav('/streetlifting/index/stories')}>
            <Text className="nav-icon"><Calendar size={20} /></Text>
            <Text className="nav-text">故事</Text>
          </View>
          <View className="nav-item" onClick={() => nav('/streetlifting/index/submit')}>
            <Text className="nav-icon"><Edit size={20} /></Text>
            <Text className="nav-text">提交数据</Text>
          </View>
        </View>

        <View className="web-hint">
          <Text>完整计算器与历史数据请在网页端 coachlink.fit 使用</Text>
        </View>
      </ScrollView>
    </View>
  )
}
