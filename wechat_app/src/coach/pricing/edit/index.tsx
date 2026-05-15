import React, { useState, useEffect } from 'react'
import { View, Text, Input, Textarea, Button, ScrollView, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { coachService } from '@/services/coach/coachService'
import { authService } from '@/services/authService'
import './index.scss'

type PricingTier = 'basic' | 'standard' | 'vip'
type ProductType = 'single' | 'combo'

interface DurationOption {
  months: number
  price: number
}

interface Product {
  id: string
  tier: PricingTier
  type: ProductType
  name: string
  description?: string
  included_products?: string[]
  duration_options: DurationOption[]
}

const tierOptions = [
  { label: '特惠基础版', value: 'basic' },
  { label: '专业指导版', value: 'standard' },
  { label: '全能指导版', value: 'vip' }
]

const typeOptions = [
  { label: '单项目', value: 'single' },
  { label: '组合套餐', value: 'combo' }
]

function CoachPricingEdit() {
  const productId = Taro.getCurrentInstance().router?.params?.id
  const tier = Taro.getCurrentInstance().router?.params?.tier as PricingTier | undefined
  const [product, setProduct] = useState<Product>({
    id: productId || `prod_${Date.now()}`,
    tier: tier || 'basic',
    type: 'single',
    name: '',
    description: '',
    duration_options: [{ months: 1, price: 0 }]
  })
  const [saving, setSaving] = useState(false)
  const [tierIndex, setTierIndex] = useState(0)
  const [typeIndex, setTypeIndex] = useState(0)

  useEffect(() => {
    if (productId && productId !== 'new') {
      loadProduct()
    } else {
      // 设置默认层级
      const defaultTierIndex = tierOptions.findIndex(t => t.value === (tier || 'basic'))
      if (defaultTierIndex >= 0) {
        setTierIndex(defaultTierIndex)
      }
    }
  }, [productId])

  async function loadProduct() {
    try {
      const user = authService.getCurrentUser()
      const res = await coachService.getPricing({ userId: user?.id })
      if (res?.products) {
        const found = res.products.find((p: Product) => p.id === productId)
        if (found) {
          // price is stored in yuan; keep it numeric for the editor.
          const productWithNumericPrice = {
            ...found,
            duration_options: found.duration_options.map((opt: any) => ({
              ...opt,
              price: typeof opt.price === 'number' ? opt.price : parseFloat(opt.price) || 0
            }))
          }
          setProduct(productWithNumericPrice)
          const tierIdx = tierOptions.findIndex(t => t.value === found.tier)
          if (tierIdx >= 0) setTierIndex(tierIdx)
          const typeIdx = typeOptions.findIndex(t => t.value === found.type)
          if (typeIdx >= 0) setTypeIndex(typeIdx)
        }
      }
    } catch (e) {
      console.error('[pricing/edit] load:', e)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    }
  }

  function handleTierChange(e: any) {
    const index = e.detail.value
    setTierIndex(index)
    setProduct({ ...product, tier: tierOptions[index].value as PricingTier })
  }

  function handleTypeChange(e: any) {
    const index = e.detail.value
    setTypeIndex(index)
    setProduct({ ...product, type: typeOptions[index].value as ProductType })
  }

  function handleAddDurationOption() {
    setProduct({
      ...product,
      duration_options: [...product.duration_options, { months: 1, price: 0 }]
    })
  }

  function handleRemoveDurationOption(index: number) {
    if (product.duration_options.length <= 1) {
      Taro.showToast({ title: '至少保留一个时长选项', icon: 'none' })
      return
    }
    const newOptions = [...product.duration_options]
    newOptions.splice(index, 1)
    setProduct({ ...product, duration_options: newOptions })
  }

  function updateDurationOption(index: number, field: 'months' | 'price', value: string) {
    const newOptions = [...product.duration_options]
    if (field === 'months') {
      const numValue = parseInt(value) || 1
      newOptions[index] = { ...newOptions[index], months: numValue }
    } else {
      // price is stored in yuan to match Web pricing and payment APIs.
      const numValue = parseFloat(value) || 0
      newOptions[index] = { ...newOptions[index], price: numValue }
    }
    setProduct({ ...product, duration_options: newOptions })
  }

  async function handleSave() {
    if (!product.name.trim()) {
      Taro.showToast({ title: '请输入产品名称', icon: 'none' })
      return
    }

    // price is stored in yuan.
    if (product.duration_options.some(opt => opt.price <= 0)) {
      Taro.showToast({ title: '价格必须大于0', icon: 'none' })
      return
    }

    setSaving(true)
    try {
      const user = authService.getCurrentUser()
      const res = await coachService.getPricing({ userId: user?.id })
      let allProducts: Product[] = res?.products || []

      // 更新或添加产品
      const existingIndex = allProducts.findIndex(p => p.id === product.id)
      if (existingIndex >= 0) {
        allProducts[existingIndex] = product
      } else {
        allProducts.push(product)
      }

      // 保存所有产品
      const saveRes = await coachService.updatePricing({ products: allProducts })
      if (saveRes) {
        Taro.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        Taro.showToast({ title: '保存失败', icon: 'none' })
      }
    } catch (e: any) {
      console.error('[pricing/edit] save:', e)
      Taro.showToast({ title: e.message || '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className="pricing-edit-page">
      <ScrollView scrollY className="edit-scroll">
        <View className="form-section">
          <View className="form-item">
            <Text className="form-label">层级 *</Text>
            <Picker
              mode="selector"
              range={tierOptions}
              rangeKey="label"
              value={tierIndex}
              onChange={handleTierChange}
            >
              <View className="picker-view">
                <Text className="picker-text">{tierOptions[tierIndex].label}</Text>
                <Text className="picker-arrow">›</Text>
              </View>
            </Picker>
          </View>

          <View className="form-item">
            <Text className="form-label">服务类型 *</Text>
            <Picker
              mode="selector"
              range={typeOptions}
              rangeKey="label"
              value={typeIndex}
              onChange={handleTypeChange}
            >
              <View className="picker-view">
                <Text className="picker-text">{typeOptions[typeIndex].label}</Text>
                <Text className="picker-arrow">›</Text>
              </View>
            </Picker>
          </View>

          <View className="form-item">
            <Text className="form-label">方案名称 *</Text>
            <Input
              className="form-input"
              value={product.name}
              onInput={(e) => setProduct({ ...product, name: e.detail.value })}
              placeholder="输入服务名称"
            />
          </View>

          <View className="form-item">
            <Text className="form-label">详细介绍</Text>
            <Textarea
              className="form-textarea"
              value={product.description || ''}
              onInput={(e) => setProduct({ ...product, description: e.detail.value })}
              placeholder="简单介绍该方案的特色"
              maxlength={200}
            />
          </View>

          {product.type === 'combo' && (
            <View className="form-item">
              <Text className="form-label">包含细项</Text>
              <Input
                className="form-input"
                value={product.included_products?.join(', ') || ''}
                onInput={(e) => {
                  const items = e.detail.value.split(',').map(s => s.trim()).filter(s => s)
                  setProduct({ ...product, included_products: items })
                }}
                placeholder="项目1, 项目2（用逗号隔开）"
              />
            </View>
          )}

          <View className="form-item">
            <View className="form-label-row">
              <Text className="form-label">时长梯度与价格 *</Text>
              <Button
                className="add-btn"
                size="mini"
                onClick={handleAddDurationOption}
              >
                + 添加
              </Button>
            </View>
            <View className="duration-options">
              {product.duration_options.map((opt, idx) => (
                <View key={idx} className="duration-option">
                  <View className="duration-input-group">
                    <Input
                      className="duration-input"
                      type="number"
                      value={String(opt.months)}
                      onInput={(e) => updateDurationOption(idx, 'months', e.detail.value)}
                      placeholder="月数"
                    />
                    <Text className="duration-unit">个月</Text>
                  </View>
                  <View className="duration-input-group">
                    <Text className="duration-unit">¥</Text>
                    <Input
                      className="duration-input price-input"
                      type="digit"
                      value={String(Number(opt.price || 0).toFixed(2))}
                      onInput={(e) => updateDurationOption(idx, 'price', e.detail.value)}
                      placeholder="0.00"
                    />
                  </View>
                  {product.duration_options.length > 1 && (
                    <Button
                      className="remove-btn"
                      size="mini"
                      onClick={() => handleRemoveDurationOption(idx)}
                    >
                      删除
                    </Button>
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <View className="footer-actions">
        <Button className="cancel-btn" onClick={() => Taro.navigateBack()}>
          取消
        </Button>
        <Button className="save-btn" loading={saving} onClick={handleSave}>
          保存方案
        </Button>
      </View>
    </View>
  )
}

export default CoachPricingEdit
