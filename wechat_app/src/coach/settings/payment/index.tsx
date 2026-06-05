import React from 'react'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import './index.scss'

function CoachPaymentSettings() {
  return (
    <View className="payment-settings-page">
      <ScrollView scrollY className="settings-scroll" style={{ paddingBottom: '70px' }}>
        <View className="settings-card">
          <Text className="card-title">个人收款码已停用</Text>
          <Text className="card-desc">
            学员给教练的订阅付款统一走汇付平台通道，不再支持上传或展示微信、支付宝个人收款码。
          </Text>
          <Button
            className="upload-btn"
            onClick={() => Taro.navigateTo({ url: '/coach/wallet/merchant' })}
          >
            去开通汇付收款账户
          </Button>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default CoachPaymentSettings
