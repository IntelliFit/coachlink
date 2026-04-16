import React from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import './index.scss'

export default function Privacy() {
  return (
    <View className="doc-page privacy-page">
      <ScrollView scrollY className="doc-scroll">
        <View className="doc-card">
          <Text className="doc-title">隐私政策</Text>
          <Text className="doc-content">
            教链 CoachLink（以下简称「我们」）重视您的隐私。本政策说明我们如何收集、使用、存储与保护您的个人信息。
          </Text>
          <Text className="doc-content">
            我们可能收集的信息包括：账号信息（手机号、邮箱等）、微信授权信息、训练与计划相关数据、设备信息等，用于账号登录、服务提供、产品改进与安全保障。我们不会向第三方出售您的个人信息。
          </Text>
          <Text className="doc-content">
            我们采用合理的技术与管理措施保护您的数据安全。您有权查询、更正或删除您的个人信息，可通过「我的」-「设置」或「联系/反馈」与我们联系。
          </Text>
          <Text className="doc-content">
            我们可能适时更新本政策，更新后将通过应用内通知或页面公示等方式告知。继续使用本服务即表示您同意更新后的隐私政策。完整条款以网页端 coachlink.fit 公示为准。
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}
