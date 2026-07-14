import { useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTheme } from '@/hooks/useTheme'

export default function TrainingActionsRedirect() {
  const { effectiveTheme } = useTheme()
  useEffect(() => {
    Taro.redirectTo({ url: '/me/action-lib/index?tab=public' })
  }, [])

  return (
    <View className={`training-actions-redirect-page theme-${effectiveTheme}`} style={{ minHeight: '100vh', background: '#242429', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#f5f5f5', fontSize: '28rpx' }}>正在进入动作库...</Text>
    </View>
  )
}
