import { useMemo, useState } from 'react'
import { View, Text, Textarea, Button, ScrollView, Image, Switch } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import { useTheme } from '@/hooks/useTheme'
import { authService } from '@/services/authService'
import {
  FEEDBACK_MAX_IMAGES,
  FeedbackCategory,
  submitFeedback,
  uploadFeedbackImage
} from '@/services/feedbackService'
import './index.scss'

const CONTENT_MAX_LENGTH = 500
const CONTACT_MAX_LENGTH = 120
const CONTENT_MIN_LENGTH = 5

const CATEGORY_OPTIONS: Array<{
  value: FeedbackCategory
  label: string
  description: string
}> = [
  { value: 'bug', label: '问题反馈', description: '报错、卡住、内容异常' },
  { value: 'suggestion', label: '功能建议', description: '想要的新功能或改进' },
  { value: 'experience', label: '体验反馈', description: '流程、视觉、文案体验' },
  { value: 'other', label: '其他', description: '合作、账号或别的事情' }
]

export default function Feedback() {
  const { effectiveTheme } = useTheme()
  const [category, setCategory] = useState<FeedbackCategory>('bug')
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [attachDiagnostics, setAttachDiagnostics] = useState(true)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  const contentCountText = useMemo(() => {
    return `${content.length}/${CONTENT_MAX_LENGTH}`
  }, [content.length])

  async function ensureAuthenticated() {
    if (authService.isAuthenticated()) return true

    const res = await Taro.showModal({
      title: '请先登录',
      content: '登录后才能提交反馈，方便我们跟进问题处理结果。',
      confirmText: '去登录',
      cancelText: '先不提交'
    })
    if (res.confirm) {
      Taro.navigateTo({
        url: authService.buildLoginUrl('/me-legal/feedback/index')
      })
    }
    return false
  }

  async function handleChooseImage() {
    if (uploadingImage || imageUrls.length >= FEEDBACK_MAX_IMAGES) return
    if (!(await ensureAuthenticated())) return

    const remaining = FEEDBACK_MAX_IMAGES - imageUrls.length
    try {
      const chooseRes = await Taro.chooseImage({
        count: remaining,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })
      const paths = chooseRes.tempFilePaths || []
      if (paths.length === 0) return

      setUploadingImage(true)
      const uploadedUrls: string[] = []
      for (const path of paths) {
        const uploaded = await uploadFeedbackImage(path)
        uploadedUrls.push(uploaded.imageUrl)
      }
      setImageUrls((prev) => [...prev, ...uploadedUrls].slice(0, FEEDBACK_MAX_IMAGES))
      Taro.showToast({ title: '截图已添加', icon: 'success' })
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '截图上传失败', icon: 'none' })
    } finally {
      setUploadingImage(false)
    }
  }

  function removeImage(url: string) {
    setImageUrls((prev) => prev.filter((item) => item !== url))
  }

  function previewImage(url: string) {
    Taro.previewImage({
      current: url,
      urls: imageUrls
    })
  }

  async function handleSubmit() {
    const trimmed = content.trim()
    if (trimmed.length < CONTENT_MIN_LENGTH) {
      Taro.showToast({ title: `请至少填写${CONTENT_MIN_LENGTH}个字`, icon: 'none' })
      return
    }
    if (!(await ensureAuthenticated())) return

    setLoading(true)
    try {
      await submitFeedback({
        category,
        content: trimmed,
        contact: contact.trim(),
        attachRecentRequests: attachDiagnostics,
        imageUrls
      })

      Taro.showToast({ title: '已收到反馈', icon: 'success' })
      setContent('')
      setContact('')
      setImageUrls([])
      setTimeout(() => {
        Taro.navigateBack().catch(() => Taro.redirectTo({ url: '/me/profile/index' }))
      }, 1000)
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '提交失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageThemeRoot>
      <View className={`feedback-page theme-${effectiveTheme}`}>
        <ScrollView scrollY className="feedback-scroll">
          <View className="feedback-hero">
            <Text className="feedback-kicker">CoachLink Feedback</Text>
            <Text className="feedback-title">一键反馈</Text>
            <Text className="feedback-desc">
              截图、设备信息和最近请求记录会帮助我们更快定位问题。
            </Text>
          </View>

          <View className="feedback-card">
            <View className="section-head">
              <Text className="section-title">反馈类型</Text>
              <Text className="section-tip">请选择最接近的一类</Text>
            </View>
            <View className="category-grid">
              {CATEGORY_OPTIONS.map((item) => (
                <View
                  key={item.value}
                  className={`category-item ${category === item.value ? 'active' : ''}`}
                  onClick={() => setCategory(item.value)}
                >
                  <Text className="category-label">{item.label}</Text>
                  <Text className="category-desc">{item.description}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className="feedback-card">
            <View className="section-head">
              <Text className="section-title">反馈内容</Text>
              <Text className="section-tip">{contentCountText}</Text>
            </View>
            <Textarea
              className="feedback-textarea"
              placeholder="请描述遇到的问题、你期望的结果，或希望我们改进的地方。"
              value={content}
              maxlength={CONTENT_MAX_LENGTH}
              showConfirmBar={false}
              onInput={(event) => setContent(event.detail.value)}
            />
          </View>

          <View className="feedback-card">
            <View className="section-head">
              <Text className="section-title">截图</Text>
              <Text className="section-tip">{imageUrls.length}/{FEEDBACK_MAX_IMAGES}</Text>
            </View>
            <View className="image-grid">
              {imageUrls.map((url) => (
                <View key={url} className="image-item">
                  <Image className="image-preview" src={url} mode="aspectFill" onClick={() => previewImage(url)} />
                  <View className="image-remove" onClick={() => removeImage(url)}>
                    <Text className="image-remove-text">×</Text>
                  </View>
                </View>
              ))}
              {imageUrls.length < FEEDBACK_MAX_IMAGES && (
                <View className="image-add" onClick={handleChooseImage}>
                  <Text className="image-add-plus">{uploadingImage ? '…' : '+'}</Text>
                  <Text className="image-add-text">{uploadingImage ? '上传中' : '添加截图'}</Text>
                </View>
              )}
            </View>
          </View>

          <View className="feedback-card">
            <View className="section-head">
              <Text className="section-title">联系方式</Text>
              <Text className="section-tip">选填</Text>
            </View>
            <Textarea
              className="contact-textarea"
              placeholder="手机号、微信号或其他便于联系你的方式"
              value={contact}
              maxlength={CONTACT_MAX_LENGTH}
              showConfirmBar={false}
              onInput={(event) => setContact(event.detail.value)}
            />
          </View>

          <View className="diagnostic-card">
            <View className="diagnostic-copy">
              <Text className="diagnostic-title">附带诊断信息</Text>
              <Text className="diagnostic-desc">包含最近请求记录、设备信息和控制台日志</Text>
            </View>
            <Switch
              checked={attachDiagnostics}
              color="#CF6D4E"
              onChange={(event) => setAttachDiagnostics(Boolean(event.detail.value))}
            />
          </View>

          <Button
            className="submit-btn"
            loading={loading}
            disabled={loading || uploadingImage || content.trim().length < CONTENT_MIN_LENGTH}
            onClick={handleSubmit}
          >
            提交反馈
          </Button>
        </ScrollView>
      </View>
    </PageThemeRoot>
  )
}
