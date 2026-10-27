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
                  ? '原套餐续费可延长服务；购买其他套餐将在旧权益用完后生效。'
                  : '续原套餐请点【续费】；可直接购买其他套餐，旧权益用完后接续。'}
              </Text>
              {(userSubscription?.queued_packages || []).map(item => (
                <Text key={item.id} className='pricing-subscribed-hint'>待生效：{item.product_name}（{item.purchased_weeks}周），旧权益用完后接续</Text>
              ))}
            </View>
            {showRenewBtn && !renewMode && onEnterRenewMode && (
              <View className='pricing-renew-btn' onClick={onEnterRenewMode}>
                <Text className='pricing-renew-btn-text'>续费</Text>
              </View>
            )}
            {renewMode && (
              <View className='pricing-renew-btn pricing-renew-btn-active'>
                <Text className='pricing-renew-btn-text'>续费中·请选择套餐</Text>
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
