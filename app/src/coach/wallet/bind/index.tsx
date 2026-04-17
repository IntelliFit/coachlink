import React from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

function CoachWalletBind() {
  return (
    <View className='wallet-page'>
      <Text>绑定收款方式</Text>
      <Text className='wallet-page-desc'>请在 web 端完成支付宝等收款绑定</Text>
    </View>
  )
}

export default CoachWalletBind
