import React from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

export default function StreetliftingSubmit() {
  const { effectiveTheme } = useTheme()
  return (
    <View className={`doc-page theme-${effectiveTheme}`}>
      <ScrollView scrollY className="doc-scroll">
        <View className="doc-card">
          <Text className="doc-title">提交数据</Text>
          <Text className="doc-content">提交您的街健力量数据需选择项目、填写重量与次数等。为保障数据准确，请到网页端 coachlink.fit 完成提交。</Text>
          <View className="link-btn" onClick={() => Taro.navigateBack()}><Text>返回</Text></View>
        </View>
      </ScrollView>
    </View>
  )
}
