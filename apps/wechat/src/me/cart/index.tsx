import React, { useState, useEffect, useCallback } from 'react'
import { WECHAT_FREE_RELEASE } from '@coachlink/core'
import FreeReleaseInfo from '@/components/FreeReleaseInfo'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { authService } from '@/services/authService'
import { request } from '@/utils/request'
import './index.scss'
import { File, Notice } from '@nutui/icons-react-taro'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useTheme } from '@/hooks/useTheme'

interface CartItem {
  id: string
  productId: string
  productName: string
  productTier: string
  coachId: string
  coachName: string
  durationMonths: number
  price: number
}

function CartPage() {
  const { effectiveTheme } = useTheme()
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadCart = useCallback(async () => {
    try {
      setLoading(true)
      const userId = authService.getCurrentUser()?.id
      if (!userId) {
        Taro.showToast({ title: '请先登录', icon: 'none' })
        return
      }

      const res = await request<{ items: CartItem[]; total: number }>({
        url: '/api/cart/list',
        method: 'POST',
        data: {}
      })
      if (res.success && res.data) {
        setItems(res.data.items || [])
      }
    } catch (error) {
      console.error('加载购物车失败:', error)
      Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadCart()
  })

  usePullDownRefresh(() => {
    loadCart().finally(() => Taro.stopPullDownRefresh())
  })

  const handleRemove = async (itemId: string) => {
    try {
      await request({
        url: '/api/cart/remove',
        method: 'POST',
        data: { itemId }
      })
      Taro.showToast({ title: '已移除', icon: 'success' })
      loadCart()
    } catch (error) {
      Taro.showToast({ title: '移除失败', icon: 'none' })
    }
  }

  const handleSubscribe = (item: CartItem) => {
    if (!item.coachId) {
      Taro.showToast({
        title: '缺少教练信息，无法发起订阅',
        icon: 'none'
      })
      return
    }

    Taro.navigateTo({
      url: `/discovery/coach-profile?id=${encodeURIComponent(item.coachId)}&tab=1`
    })
  }

  const goPurchaseHistory = () => {
    Taro.navigateTo({ url: '/me/purchase-history/index' })
  }

  const getTotalPrice = () => {
    return items.reduce((sum, item) => sum + item.price, 0)
  }

  const getTierLabel = (tier: string) => {
    const labels: Record<string, string> = {
      'basic': '特惠基础版',
      'standard': '专业指导版',
      'vip': '全能指导版'
    }
    return labels[tier] || tier
  }

  if (loading) {
    return (
      <View className={`cart-page theme-${effectiveTheme}`}>
        <ScrollView className='page-scroll' scrollY>
          <View className='loading-wrap'>
            <LoadingSpinner size={48} />
          </View>
        </ScrollView>
        <BottomNav />
      </View>
    )
  }

  return (
    <View className={`cart-page theme-${effectiveTheme}`}>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          <View className='page-header'>
            <Text className='page-title'>待结算订阅</Text>
            <Text className='page-subtitle'>
              {items.length > 0 ? `共 ${items.length} 项待结算订阅，请进入教练主页选择套餐并完成支付` : '这里只保留待结算订阅，已支付订单请看购买记录'}
            </Text>
          </View>

          <View className='role-notice'>
            <Text className='role-notice-title'>这里和购买记录不是一回事</Text>
            <Text className='role-notice-desc'>
              这里放的是还没完成支付的订阅清单；购买记录里才是已下单、已支付或已退款的订单历史。
            </Text>
            <View className='role-notice-link' onClick={goPurchaseHistory}>
              <Text>查看购买记录</Text>
            </View>
          </View>

          {items.length === 0 ? (
            <View className='empty-state'>
              <View className='empty-icon'><File /></View>
              <Text className='empty-title'>暂无待结算订阅</Text>
              <Text className='empty-desc'>如果你已经完成支付，请去购买记录查看；如果还没选服务，可以继续去发现。</Text>
              <View 
                className='empty-btn'
                onClick={() => Taro.redirectTo({ url: '/discovery/index' })}
              >
                <Text>去发现</Text>
              </View>
            </View>
          ) : (
            <>
              <View className='items-list'>
                {items.map((item) => (
                  <View key={item.id} className='cart-item'>
                    <View className='item-content'>
                      <Text className='item-name'>{item.productName}</Text>
                      <View className='item-badge'>
                        <Text>{getTierLabel(item.productTier)}</Text>
                      </View>
                      <View className='item-info'>
                        <Text className='info-text'>教练：{item.coachName}</Text>
                        <Text className='info-text'>时长：{item.durationMonths} 个月</Text>
                        <View className='price-row'>
                          <Text className='price-label'>价格：</Text>
                          <Text className='price-value'>¥{item.price.toFixed(2)}</Text>
                        </View>
                      </View>
                    </View>
                    <View className='item-actions'>
                      <View 
                        className='action-btn subscribe'
                        onClick={() => handleSubscribe(item)}
                      >
                        <Text>立即订阅</Text>
                      </View>
                      <View 
                        className='action-btn delete'
                        onClick={() => handleRemove(item.id)}
                      >
                        <Text>删除</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              <View className='cart-summary'>
                <View className='summary-row'>
                  <Text className='summary-label'>共 {items.length} 项待结算订阅</Text>
                  <Text className='summary-total'>总计：¥{getTotalPrice().toFixed(2)}</Text>
                </View>
                <View className='summary-notice'>
                  <View className='summary-notice-text'><Notice /> 点击立即订阅后将进入教练主页，请确认套餐并通过汇付微信支付完成教练服务订阅。</View>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default function CartReleasePage() {
  return WECHAT_FREE_RELEASE
    ? <FreeReleaseInfo title='暂未开放' description='你可以继续使用训练记录、计划管理和训练工具。' />
    : <CartPage />
}
