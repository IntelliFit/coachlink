import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

/**
 * 关于我们，文案与网页端 public/docs/about.md 对齐
 */
export default function About() {
  const goContact = () => {
    Taro.navigateTo({ url: '/me/contact/index' })
  }

  return (
    <View className="doc-page">
      <ScrollView scrollY className="doc-scroll">
        <View className="doc-card">
          <Text className="doc-title">关于我们</Text>
          <Text className="doc-content">
            CoachLink（教链）是一个面向训练人群的在线训练服务平台，帮助用户更高效地发现教练、选择服务、完成训练与记录进步。
          </Text>
          <Text className="doc-subtitle">我们提供的主要服务</Text>
          <Text className="doc-content">
            · 教练订阅/训练计划服务：用户可选择教练提供的订阅方案，获取周期化训练计划与执行支持。\n
            · 训练执行与记录：结构化记录每次训练（组数、重量、PR 等），形成可追踪的训练档案。\n
            · 视频沟通与反馈：训练视频与记录联动，提升远程指导的沟通效率。\n
            · 智能工具：在合规范围内提供计划生成、导入与辅助工具，帮助用户更快开始训练。
          </Text>
          <Text className="doc-subtitle">服务范围说明（合规披露）</Text>
          <Text className="doc-content">
            本平台提供的是与训练相关的服务与数字化工具支持，不包含教育培训、新闻资讯、金融理财、招聘、风控投资等业务内容。
          </Text>
          <Text className="doc-subtitle">联系方式</Text>
          <Text className="doc-content">
            如需联系平台，请前往「联系我们」页面。
          </Text>
          <View className="contact-actions">
            <View className="action-btn primary" onClick={goContact}>
              <Text>联系我们</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
