import React from 'react'
import { View, Text } from '@tarojs/components'
import type { Product, DurationOption, QueryCoachSubscription } from '../types'
import './PricingSection.scss'

export interface PricingSectionProps {
  products: Product[]
  onSelectProduct?: (product: Product, duration: DurationOption) => void
  userSubscription?: QueryCoachSubscription | null
  renewMode?: boolean
  receivingAccountReady?: boolean
  onEnterRenewMode?: () => void
  onStartTestRenew?: () => void
}

export default function PricingSection({
  products,
  onSelectProduct,
  userSubscription,
  renewMode,
  receivingAccountReady = true,
  onEnterRenewMode,
  onStartTestRenew
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
                  ? '续费模式：选择当前套餐的时长并支付即可延长订阅。'
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
          {onStartTestRenew && (
            <View className='pricing-test-row'>
              <View className='pricing-test-btn' onClick={onStartTestRenew}>
                <Text className='pricing-test-btn-text'>1元续费测试（加1个月）</Text>
              </View>
            </View>
          )}
        </View>
      )}
      <View className='pricing-header'>
        <Text className='section-title'>订阅价格</Text>
        <Text className='pricing-hint'>选择套餐后，将通过汇付微信支付完成教练服务订阅，收入按规则分账给教练</Text>
      </View>
      {!receivingAccountReady && (
        <View className='pricing-receiving-warning'>
          <Text className='pricing-receiving-title'>教练汇付收款账户尚未开通</Text>
          <Text className='pricing-receiving-desc'>暂时不能通过平台购买或续费，请稍后再试或联系教练。</Text>
        </View>
      )}
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
                  className={`duration-option ${receivingAccountReady ? 'duration-option-clickable' : 'duration-option-disabled'} ${opt.is_recommend ? 'duration-option-rec' : ''}`}
                  onClick={() => {
                    if (receivingAccountReady) onSelectProduct?.(p, opt)
                  }}
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
