import React from 'react'
import { View, Text } from '@tarojs/components'
import type { Product, DurationOption, QueryCoachSubscription } from '../types'
import './PricingSection.scss'

export interface PricingSectionProps {
  products: Product[]
  onSelectProduct?: (product: Product, duration: DurationOption) => void
  userSubscription?: QueryCoachSubscription | null
  renewMode?: boolean
  onEnterRenewMode?: () => void
}

export default function PricingSection({
  products,
  onSelectProduct,
  userSubscription,
  renewMode,
  onEnterRenewMode
}: PricingSectionProps) {
  const showRenewBtn = ['active', 'expired', 'near_expiry'].includes(userSubscription?.status || '')
  const isActiveSub = userSubscription?.status === 'active'

  return (
    <View className='pricing-card'>
      {isActiveSub && (
        <View className='pricing-subscribed-banner'>
          <View className='pricing-subscribed-row'>
            <View className='pricing-subscribed-text'>
              <Text className='pricing-subscribed-title'>您已订阅该教练</Text>
              <Text className='pricing-subscribed-hint'>
                {renewMode
                  ? '续费模式：选择下方套餐并支付即可延长订阅。'
                  : '如需延长订阅，请点击右侧【续费】。'}
              </Text>
            </View>
            {showRenewBtn && !renewMode && onEnterRenewMode && (
              <View className='pricing-renew-btn' onClick={onEnterRenewMode}>
                <Text className='pricing-renew-btn-text'>续费</Text>
              </View>
            )}
            {renewMode && (
              <View className='pricing-renew-btn pricing-renew-btn-active'>
                <Text className='pricing-renew-btn-text'>已开启续费</Text>
              </View>
            )}
          </View>
        </View>
      )}
      <View className='pricing-header'>
        <Text className='section-title'>订阅价格</Text>
        <Text className='pricing-hint'>点击套餐后将在小程序内打开与网站一致的购买页，优先使用支付宝完成支付</Text>
      </View>
      {products.length === 0 ? (
        <Text className='pricing-empty'>暂无套餐</Text>
      ) : (
        products.map((p) => (
          <View key={p.id} className='product-item'>
            <Text className='product-name'>{p.name}</Text>
            {p.description ? (
              <Text className='product-desc'>{p.description}</Text>
            ) : null}
            <View className='duration-row'>
              {(p.duration_options || []).map((opt, i) => (
                <View
                  key={i}
                  className={`duration-option duration-option-clickable ${opt.is_recommend ? 'duration-option-rec' : ''}`}
                  onClick={() => onSelectProduct?.(p, opt)}
                >
                  <Text>{opt.months}个月 ¥{opt.price}</Text>
                </View>
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  )
}
