import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { coachService } from '@/services/coach/coachService'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'

function CoachRevenue() {
  const [data, setData] = useState<{ totalRevenue: number; subscriptionRevenue: number; contentPurchaseRevenue: number; items: any[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({ url: '/auth/login?returnTo=' + encodeURIComponent('/coach/revenue') })
      return
    }
    loadRevenue()
  }, [])

  async function loadRevenue() {
    try {
      setLoading(true)
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const res = await coachService.getRevenueDetails({ month })
      const d = res as any
      if (d) {
        setData({
          totalRevenue: d.totalRevenue ?? (d.subscriptionRevenue ?? 0) + (d.contentPurchaseRevenue ?? 0),
          subscriptionRevenue: d.subscriptionRevenue ?? 0,
          contentPurchaseRevenue: d.contentPurchaseRevenue ?? 0,
          items: d.items ?? []
        })
      } else setData(null)
    } catch (e) {
      console.error('[coach/revenue] load:', e)
      setData(null)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="coach-revenue-page">
      {loading ? (
        <View className="loading-wrap"><LoadingSpinner size={48} /></View>
      ) : !data ? (
        <View className="empty-wrap">暂无数据</View>
      ) : (
        <ScrollView scrollY>
          <View className="summary">
            <View className="row">
              <Text>本月总收入</Text>
              <Text className="total">¥{(data.totalRevenue ?? 0).toFixed(2)}</Text>
            </View>
            <View className="row">
              <Text>订阅收入</Text>
              <Text>¥{(data.subscriptionRevenue ?? 0).toFixed(2)}</Text>
            </View>
            <View className="row">
              <Text>内容收入</Text>
              <Text>¥{(data.contentPurchaseRevenue ?? 0).toFixed(2)}</Text>
            </View>
          </View>
          {data.items?.length > 0 && (
            <View className="list">
              {data.items.map((item: any, i: number) => (
                <View key={item.id || i} className="item">
                  <View className="row">
                    <Text className="desc">{item.description || item.subject || '收入'}</Text>
                    <Text className="amount">+¥{(item.amount ?? 0).toFixed(2)}</Text>
                  </View>
                  {(item.createdAt || item.created_at) && (
                    <Text className="desc">{new Date(item.createdAt || item.created_at).toLocaleString()}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
      <BottomNav />
    </View>
  )
}

export default CoachRevenue
