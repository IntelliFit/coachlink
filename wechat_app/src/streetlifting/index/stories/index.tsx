import React from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

export default function StreetliftingStories() {
  const { effectiveTheme } = useTheme()
  return (
    <View className={`doc-page theme-${effectiveTheme}`}>
      <ScrollView scrollY className="doc-scroll">
        <View className="doc-card">
          <Text className="doc-title">故事</Text>
          <Text className="doc-content">街健力量指数相关故事与案例。完整内容请在网页端 coachlink.fit 查看。</Text>
          <View className="link-btn" onClick={() => Taro.navigateBack()}><Text>返回</Text></View>
        </View>
      </ScrollView>
    </View>
  )
}
