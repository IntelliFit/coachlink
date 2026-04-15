import { useState } from 'react'
import { View, Text, Textarea, Button, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { request } from '@/utils/request'
import './index.scss'

/** 常问问题（与网页端 feedback 一致） */
const FAQ_QUESTIONS = [
  { id: 1, question: '如何创建训练计划？', category: '功能使用' },
  { id: 2, question: '视频上传失败怎么办？', category: '问题反馈' },
  { id: 3, question: '如何添加学员？', category: '功能使用' },
  { id: 4, question: '订阅功能如何使用？', category: '功能使用' },
  { id: 5, question: '视频播放卡顿', category: '问题反馈' },
  { id: 6, question: '如何修改个人信息？', category: '功能使用' }
]

export default function Feedback() {
  const [content, setContent] = useState('')
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleQuestionClick = (question: string) => {
    setSelectedQuestion(question)
    const base = content.trim()
    if (base) {
      setContent(base + '\n\n' + question)
    } else {
      setContent(question)
    }
  }

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if (!trimmed) {
      Taro.showToast({ title: '请填写反馈内容', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const res = await request<{ success: boolean; message: string }>({
        url: '/api/feedback/submit',
        method: 'POST',
        data: {
          content: trimmed,
          relatedQuestion: selectedQuestion?.trim() || undefined
        }
      })

      if (res.success) {
        Taro.showToast({ title: '提交成功，感谢反馈', icon: 'success' })
        setContent('')
        setSelectedQuestion(null)
        setTimeout(() => Taro.navigateBack(), 1500)
      } else {
        Taro.showToast({ title: res.message || '提交失败', icon: 'none' })
      }
    } catch (e: any) {
      Taro.showToast({ title: (e as Error).message || '提交失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const clearSelected = () => {
    setSelectedQuestion(null)
    setContent('')
  }

  return (
    <View className="feedback-page">
      <ScrollView scrollY className="feedback-scroll">
        <View className="feedback-header">
          <Text className="feedback-title">意见反馈</Text>
          <Text className="feedback-desc">您的建议是我们改进的动力</Text>
        </View>

        <View className="form-card section">
          <Text className="section-title">常问问题</Text>
          <View className="faq-list">
            {FAQ_QUESTIONS.map((faq) => (
              <View
                key={faq.id}
                className={`faq-item ${selectedQuestion === faq.question ? 'active' : ''}`}
                onClick={() => handleQuestionClick(faq.question)}
              >
                <Text className="faq-question">{faq.question}</Text>
                <Text className="faq-category">{faq.category}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="form-card section">
          <Text className="label">您的反馈（必填）</Text>
          {selectedQuestion ? (
            <View className="selected-row">
              <Text className="selected-tag">已选：{selectedQuestion}</Text>
              <Text className="clear-btn" onClick={clearSelected}>清除</Text>
            </View>
          ) : null}
          <Textarea
            className="textarea"
            placeholder="请描述您的问题或建议…"
            value={content}
            onInput={(e) => setContent(e.detail.value)}
            maxlength={2000}
            showConfirmBar={false}
          />
          <Text className="hint">{content.length} / 2000 字 · 未登录时仍可提交</Text>
          <Button className="submit-btn" onClick={handleSubmit} loading={loading} disabled={!content.trim()}>
            提交反馈
          </Button>
        </View>
      </ScrollView>
    </View>
  )
}
