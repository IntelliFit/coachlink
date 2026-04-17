import React from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

/**
 * 新用户引导/入驻说明。引导教练/健身房申请，需登录后跳转申请页。
 * 与网页端一致：教练与健身房均跳转同一申请页，通过 role 区分。
 */
export default function Onboarding() {
  const goApply = (role: 'coach' | 'gym') => {
    const query = role === 'gym' ? '?role=gym' : ''
    const url = '/coach/application' + query
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.navigateTo({
        url: `/auth/login?returnTo=${encodeURIComponent(url)}`
      })
      return
    }
    Taro.navigateTo({ url })
  }

  return (
    <View className="onboarding-page">
      <ScrollView scrollY className="onboarding-scroll">
        <View className="doc-card">
          <Text className="doc-title">加入教链</Text>
          <Text className="doc-content">
            教链为教练与健身房提供学员管理、计划制定、视频点评、知识库与收益等一站式能力。入驻审核通过后即可开始服务学员。
          </Text>
          <Text className="doc-content">
            请根据您的身份选择下方入口，未登录将先跳转登录，登录后会自动进入申请页。
          </Text>
          <View className="actions">
            <View className="btn primary" onClick={() => goApply('coach')}>
              <Text>我是教练，立即入驻</Text>
            </View>
            <View className="btn secondary" onClick={() => goApply('gym')}>
              <Text>我是健身房，申请合作</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
