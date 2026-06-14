import React from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

function CoachWalletOrder() {
  const { effectiveTheme } = useTheme()
  const orderId = Taro.getCurrentInstance().router?.params?.orderId
  return (
    <View className={`wallet-page theme-${effectiveTheme}`}>
      <Text>订单详情（{orderId || '-'}）</Text>
      <Text className='wallet-page-desc'>完整订单信息请在 web 端查看</Text>
    </View>
  )
}

export default CoachWalletOrder
