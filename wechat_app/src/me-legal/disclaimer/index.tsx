import React from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import './index.scss'

export default function Disclaimer() {
  return (
    <View className="doc-page disclaimer-page">
      <ScrollView scrollY className="doc-scroll">
        <View className="doc-card">
          <Text className="doc-content">
            本平台所提供之训练计划、动作说明、营养建议等仅供参考，不构成任何医疗、康复或专业建议。用户在参与任何运动前，应根据自身健康状况咨询医生或专业人士。
          </Text>
          <Text className="doc-content">
            因使用本平台内容或服务而产生的任何身体损伤、健康问题或财产损失，本平台不承担法律责任。用户应自行承担运动风险，并确保在安全环境下进行训练。
          </Text>
          <Text className="doc-content">
            完整免责条款以网页端公示为准，如有疑问请通过「联系/反馈」与我们联系。
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}
