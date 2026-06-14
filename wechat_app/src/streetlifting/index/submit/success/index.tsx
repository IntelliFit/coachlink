import React from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Check } from '@nutui/icons-react-taro'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

export default function StreetliftingSubmitSuccess() {
  const { effectiveTheme } = useTheme()
  return (
    <View className={`success-page theme-${effectiveTheme}`}>
      <Text className="success-icon"><Check size={20} /></Text>
      <Text className="success-title">提交成功</Text>
      <Text className="success-desc">感谢您的数据贡献</Text>
      <View className="btn" onClick={() => Taro.navigateBack()}>
        <Text>返回</Text>
      </View>
    </View>
  )
}
