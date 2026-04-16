/**
 * 微信支付占位页
 * 微信支付资质申请中，暂无实际支付功能
 * 当前统一改为在小程序内打开网站购买页，优先使用支付宝支付
 */
import React from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import './index.scss'
import { Lock } from '@nutui/icons-react-taro'

export default function WechatPaymentPlaceholder() {
  const router = useRouter()

  const handleOpenPayment = () => {
    const query = Object.entries(router.params || {})
      .filter(([, value]) => value != null && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&')

    Taro.navigateTo({
      url: query
        ? `/me/payment/webview/index?${query}`
        : `/me/payment/webview/index?url=${encodeURIComponent('https://coachlink.fit/me/membership/subscribe?from=wechat')}`
    })
  }

  return (
    <View className='wechat-payment-page'>
      <View className='icon-wrap'>
        <View className='icon-text'><Lock /></View>
      </View>
      <Text className='title'>微信支付功能接入中</Text>
      <Text className='desc'>
        微信支付资质正在申请中，暂不支持小程序内微信支付。
      </Text>
      <Text className='hint'>
        当前会在小程序内打开与网站一致的购买页，优先使用支付宝完成支付
      </Text>
      <View className='action-btn' onClick={handleOpenPayment}>
        <Text>打开支付宝购买页</Text>
      </View>
      <View className='back-btn' onClick={() => Taro.navigateBack()}>
        <Text>返回</Text>
      </View>
    </View>
  )
}
