import React from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

function CoachWalletBind() {
  const { effectiveTheme } = useTheme()
  return (
    <View className={`wallet-page theme-${effectiveTheme}`}>
      <Text>绑定收款方式</Text>
      <Text className='wallet-page-desc'>请在 web 端完成支付宝等收款绑定</Text>
    </View>
  )
}

export default CoachWalletBind
