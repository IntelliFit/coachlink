import React from 'react'
import { View, Text } from '@tarojs/components'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

function CoachWalletBind() {
  const { effectiveTheme } = useTheme()
  return (
    <View className={`wallet-page theme-${effectiveTheme}`}>
      <Text>绑定汇付收款方式</Text>
      <Text className='wallet-page-desc'>请在汇付收款账户中绑定本人结算银行卡</Text>
    </View>
  )
}

export default CoachWalletBind
