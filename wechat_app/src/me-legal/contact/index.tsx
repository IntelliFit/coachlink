import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

/**
 * 联系我们，文案与网页端 public/docs/contact.md 对齐
 */
export default function Contact() {
  const goFeedback = () => {
    Taro.navigateTo({ url: '/me-legal/feedback/index' })
  }

  return (
    <View className="doc-page">
      <ScrollView scrollY className="doc-scroll">
        <View className="doc-card">
          <Text className="doc-content">
            如您对本协议有任何疑问或建议，请通过以下方式联系我们：
          </Text>
          <View className="contact-info">
            <Text className="contact-label">客服邮箱</Text>
            <Text className="contact-value" selectable>2945463110@qq.com</Text>
            <Text className="contact-label">客服热线</Text>
            <Text className="contact-value" selectable>18115072586</Text>
            <Text className="contact-hint">（工作日 14:00-24:00）</Text>
          </View>
          <Text className="doc-content">
            如有合作洽谈、产品建议或问题反馈，也可通过下方「意见反馈」提交，我们会尽快处理。
          </Text>
          <View className="contact-actions">
            <View className="action-btn primary" onClick={goFeedback}>
              <Text>意见反馈</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
