import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { authService } from '@/services/authService'
import { request } from '@/utils/request'
import './index.scss'

// 与后端 PurchaseHistoryItem 对齐，兼容 orders 列表
interface PurchaseItem {
  id: string | number
  subject?: string
  productName?: string
  coachName?: string
  price?: number
  amount?: number
  durationMonths?: number
  status: string
  created_at?: string
  createdAt?: string
  paid_at?: string
  paidAt?: string
}

function PurchaseHistoryPage() {
  const [purchases, setPurchases] = useState<PurchaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const limit = 10

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true)
      const userId = authService.getCurrentUser()?.id
      if (!userId) {
        Taro.showToast({ title: '请先登录', icon: 'none' })
        return
      }

      const res = await request<{ orders: PurchaseItem[]; total: number }>({
        url: '/api/purchase-history/list',
        method: 'GET',
        data: { page, limit }
      })
      if (res.success && res.data) {
        const list = (res.data.orders || []).map((o) => ({
          ...o,
          productName: o.subject ?? o.productName ?? '订单',
          price: o.amount ?? o.price ?? 0,
          created_at: o.createdAt ?? o.created_at,
          paid_at: o.paidAt ?? o.paid_at,
          durationMonths: o.durationMonths ?? 0
        }))
        if (page === 1) {
          setPurchases(list)
        } else {
          setPurchases(prev => [...prev, ...list])
        }
        setTotalCount(res.data.total ?? 0)
      }
    } catch (error) {
      console.error('加载购买记录失败:', error)
      Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [page])

  useDidShow(() => {
    setPage(1)
    loadHistory()
  })

  usePullDownRefresh(() => {
    setPage(1)
    loadHistory().finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    if (!loading && purchases.length < totalCount) {
      setPage(prev => prev + 1)
    }
  })

  useEffect(() => {
    if (page > 1) {
      loadHistory()
    }
  }, [page])

  const getStatusConfig = (status: string) => {
    const config: Record<string, { label: string; color: string }> = {
      'paid': { label: '已支付', color: '#10b981' },
      'pending': { label: '待支付', color: '#f59e0b' },
      'cancelled': { label: '已取消', color: '#6b7280' },
      'refunded': { label: '已退款', color: '#ef4444' }
    }
    return config[status] || { label: status, color: '#6b7280' }
  }

  return (
    <View className='purchase-history-page'>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          <View className='page-header'>
            <Text className='page-title'>购买记录</Text>
            <Text className='page-subtitle'>查看您的订阅购买历史</Text>
          </View>

          {loading && page === 1 ? (
            <View className='loading-wrap'>
              <Text>加载中...</Text>
            </View>
          ) : purchases.length === 0 ? (
            <View className='empty-state'>
              <Text className='empty-icon'>📝</Text>
              <Text className='empty-title'>暂无购买记录</Text>
              <Text className='empty-desc'>您还没有任何购买记录</Text>
            </View>
          ) : (
            <View className='purchases-list'>
              {purchases.map((purchase) => {
                const statusConfig = getStatusConfig(purchase.status)
                return (
                  <View key={purchase.id} className='purchase-item'>
                    <View className='item-header'>
                      <Text className='item-name'>{purchase.productName}</Text>
                      <View className='status-badge' style={{ backgroundColor: statusConfig.color + '20', color: statusConfig.color }}>
                        <Text>{statusConfig.label}</Text>
                      </View>
                    </View>
                    <View className='item-info'>
                      <Text className='info-text'>教练：{purchase.coachName}</Text>
                      <Text className='info-text'>时长：{purchase.durationMonths} 个月</Text>
                      <View className='price-row'>
                        <Text className='price-label'>金额：</Text>
                        <Text className='price-value'>¥{(purchase.price ?? purchase.amount ?? 0).toFixed(2)}</Text>
                      </View>
                    </View>
                    <View className='item-footer'>
                      <Text className='time-text'>
                        {(purchase.paid_at ?? purchase.paidAt)
                          ? `支付时间：${new Date(purchase.paid_at ?? purchase.paidAt ?? '').toLocaleString('zh-CN')}`
                          : `创建时间：${new Date(purchase.created_at ?? purchase.createdAt ?? '').toLocaleString('zh-CN')}`
                        }
                      </Text>
                    </View>
                  </View>
                )
              })}
              {purchases.length >= totalCount && totalCount > 0 && (
                <View className='load-more'>
                  <Text>已加载全部 {totalCount} 条记录</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default PurchaseHistoryPage
