import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { coachService } from '@/services/coach/coachService'
import { authService } from '@/services/authService'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'

type PricingTier = 'basic' | 'standard' | 'vip'

const tierConfig = {
  basic: { label: '特惠基础版', color: '#3b82f6' },
  standard: { label: '专业指导版', color: '#10b981' },
  vip: { label: '全能指导版', color: '#8b5cf6' }
}

function CoachPricing() {
  const [pricings, setPricings] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({ url: '/auth/login?returnTo=' + encodeURIComponent('/coach/pricing') })
      return
    }
    loadPricing()
  }, [])

  // 页面显示时刷新数据（从编辑页返回时）
  Taro.useDidShow(() => {
    const token = Taro.getStorageSync('token')
    if (token) {
      loadPricing()
    }
  })

  async function loadPricing() {
    try {
      setLoading(true)
      const user = authService.getCurrentUser()
      const res = await coachService.getPricing({ userId: user?.id })
      const data = res as any
      
      // 设置旧版 pricings 数据
      if (data?.pricings && Array.isArray(data.pricings) && data.pricings.length > 0) {
        setPricings(data.pricings)
      } else {
        setPricings([])
      }
      
      // 设置新版 products 数据
      if (data?.products && Array.isArray(data.products) && data.products.length > 0) {
        setProducts(data.products)
      } else {
        setProducts([])
      }
    } catch (e) {
      console.error('[coach/pricing] load:', e)
      setPricings([])
      setProducts([])
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(productId: string) {
    const res = await Taro.showModal({
      title: '确认删除',
      content: '确定要删除这个定价方案吗？',
      confirmText: '删除',
      confirmColor: '#ef4444'
    })

    if (!res.confirm) return

    setDeleting(productId)
    try {
      const user = authService.getCurrentUser()
      const pricingRes = await coachService.getPricing({ userId: user?.id })
      let allProducts: any[] = pricingRes?.products || []

      // 删除指定产品
      allProducts = allProducts.filter(p => p.id !== productId)

      // 保存更新后的产品列表
      const saveRes = await coachService.updatePricing({ products: allProducts })
      if (saveRes) {
        Taro.showToast({ title: '删除成功', icon: 'success' })
        // 重新加载数据
        await loadPricing()
      } else {
        Taro.showToast({ title: '删除失败', icon: 'none' })
      }
    } catch (e: any) {
      console.error('[coach/pricing] delete:', e)
      Taro.showToast({ title: e.message || '删除失败', icon: 'none' })
    } finally {
      setDeleting(null)
    }
  }

  function handleEdit(productId: string) {
    console.log('[pricing] edit product:', productId)
    Taro.navigateTo({
      url: `/coach/pricing/edit?id=${productId}`
    }).catch((err) => {
      console.error('[pricing] navigate error:', err)
      Taro.showToast({ title: '跳转失败', icon: 'none' })
    })
  }

  function handleAdd(tier?: PricingTier) {
    const url = tier 
      ? `/coach/pricing/edit?id=new&tier=${tier}`
      : '/coach/pricing/edit?id=new'
    Taro.navigateTo({ url })
  }

  // 按层级分组产品
  const productsByTier: Record<PricingTier, any[]> = {
    basic: [],
    standard: [],
    vip: []
  }

  products.forEach((p: any) => {
    if (p.tier && productsByTier[p.tier as PricingTier]) {
      productsByTier[p.tier as PricingTier].push(p)
    }
  })

  // 旧版 pricings 数据（只读显示）
  const legacyPricings = pricings.map(p => ({
    id: p.id || `pricing_${p.title}`,
    title: p.title,
    description: p.features?.join('、') || '',
    priceInYuan: p.price || 0,
    months: 1,
    duration_options: []
  }))

  const hasProducts = products.length > 0
  const hasLegacyPricings = legacyPricings.length > 0

  return (
    <View className="coach-pricing-page">
      <View className="page-header">
        <Text className="page-title">订阅定价</Text>
        <View className="header-actions">
          <View className="add-all-btn" onClick={() => handleAdd()}>
            <Text className="add-all-btn-text">+ 添加方案</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View className="loading-wrap"><LoadingSpinner size={48} /></View>
      ) : !hasProducts && !hasLegacyPricings ? (
        <View className="empty-wrap">
          <Text className="empty-text">暂无定价方案</Text>
          <Button className="empty-add-btn" onClick={() => handleAdd()}>
            添加第一个方案
          </Button>
        </View>
      ) : (
        <ScrollView scrollY className="pricing-scroll">
          {/* 按层级显示产品 */}
          {(Object.keys(productsByTier) as PricingTier[]).map((tier) => {
            const tierProducts = productsByTier[tier]
            if (tierProducts.length === 0) return null

            return (
              <View key={tier} className="tier-section">
                <View className="tier-header">
                  <View className="tier-title-wrap">
                    <View 
                      className="tier-indicator" 
                      style={{ backgroundColor: tierConfig[tier].color }}
                    />
                    <Text className="tier-title">{tierConfig[tier].label}</Text>
                  </View>
                  <View className="tier-add-btn" onClick={() => handleAdd(tier)}>
                    <Text className="tier-add-btn-text">+ 添加</Text>
                  </View>
                </View>

                {tierProducts.map((product: any) => {
                  const priceInYuan = product.duration_options?.[0]?.price || 0
                  const months = product.duration_options?.[0]?.months || 1

                  return (
                    <View key={product.id} className="card">
                      <View className="card-header">
                        <Text className="card-title">{product.name}</Text>
                        <View className="card-actions">
                          <View className="edit-btn" onClick={() => handleEdit(product.id)}>
                            <Text className="action-btn-text">编辑</Text>
                          </View>
                          <View 
                            className={`delete-btn ${deleting === product.id ? 'loading' : ''}`}
                            onClick={() => handleDelete(product.id)}
                          >
                            <Text className="action-btn-text">
                              {deleting === product.id ? '删除中...' : '删除'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {product.description && (
                        <View className="row">
                          <Text className="label">描述</Text>
                          <Text className="value">{product.description}</Text>
                        </View>
                      )}

                      <View className="row">
                        <Text className="label">价格</Text>
                        <Text className="value price-value">
                          ¥{priceInYuan.toFixed(2)}
                          {months > 1 && <Text className="duration-text">/{months}个月</Text>}
                        </Text>
                      </View>

                      {product.duration_options && product.duration_options.length > 1 && (
                        <View className="row">
                          <Text className="label">可选时长</Text>
                          <View className="duration-tags">
                            {product.duration_options.map((opt: any, idx: number) => (
                              <View key={idx} className="duration-tag">
                                <Text className="tag-text">
                                  {opt.months}个月 ¥{Number(opt.price || 0).toFixed(2)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}

                      {product.type === 'combo' && product.included_products && product.included_products.length > 0 && (
                        <View className="row">
                          <Text className="label">包含项目</Text>
                          <Text className="value">{product.included_products.join('、')}</Text>
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>
            )
          })}

          {/* 旧版 pricings（只读） */}
          {hasLegacyPricings && (
            <View className="tier-section">
              <View className="tier-header">
                <Text className="tier-title">旧版定价（仅查看）</Text>
              </View>
              {legacyPricings.map((item) => (
                <View key={item.id} className="card legacy-card">
                  <View className="row">
                    <Text className="label">名称</Text>
                    <Text className="value">{item.title}</Text>
                  </View>
                  {item.description && (
                    <View className="row">
                      <Text className="label">描述</Text>
                      <Text className="value">{item.description}</Text>
                    </View>
                  )}
                  <View className="row">
                    <Text className="label">价格</Text>
                    <Text className="value">¥{item.priceInYuan.toFixed(2)}</Text>
                  </View>
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

export default CoachPricing
