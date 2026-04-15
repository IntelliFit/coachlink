import React from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

export default function StreetliftingMethodology() {
  return (
    <View className="doc-page">
      <ScrollView scrollY className="doc-scroll">
        <View className="doc-card">
          <Text className="doc-title">计算方法论</Text>
          <Text className="doc-content">街健力量指数采用多项目系数与 DOTS 等标准，详见网页端 coachlink.fit 说明。</Text>
          <View className="link-btn" onClick={() => Taro.navigateBack()}><Text>返回</Text></View>
        </View>
      </ScrollView>
    </View>
  )
}
