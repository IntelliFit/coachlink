import React, { useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

export default function RouteAliasPage() {
  const { effectiveTheme } = useTheme()
  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params || {}
    const url = '/coach/overview'
      .replace('{id}', encodeURIComponent((params.id || '') as string))
      .replace('{slug}', encodeURIComponent((params.slug || '') as string))
      .replace('{orderId}', encodeURIComponent((params.orderId || '') as string))
    Taro.redirectTo({ url }).catch(() => Taro.reLaunch({ url: url.split('?')[0] }))
  }, [])

  return (
    <View className={`route-alias-page theme-${effectiveTheme}`}>
      <Text className='route-alias-text'>正在跳转...</Text>
    </View>
  )
}
