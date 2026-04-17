import React, { useState, useEffect } from 'react'
import { View, Text, Input, Textarea, Button, ScrollView, Picker } from '@tarojs/components'
import { Check } from '@nutui/icons-react-taro'
import Taro from '@tarojs/taro'
import { coachService } from '@/services/coach/coachService'
import './index.scss'

type ContentType = 'text' | 'video' | 'image' | 'live' | 'plan'

const CONTENT_TYPE_OPTIONS: Array<{ label: string; value: ContentType }> = [
  { label: '图文文章', value: 'text' },
  { label: '视频内容', value: 'video' },
  { label: '图片内容', value: 'image' },
  { label: '直播预告', value: 'live' },
  { label: '训练计划', value: 'plan' }
]

const TIER_OPTIONS: Array<{ label: string; value: number; desc: string }> = [
  { label: '所有人可见', value: 0, desc: '未订阅学员也能查看' },
  { label: '仅订阅可见', value: 1, desc: '与 Web 教练端的订阅可见一致' },
  { label: '高级订阅可见', value: 2, desc: '保留给更高等级套餐' },
  { label: 'VIP 可见', value: 3, desc: '仅最高等级用户可见' }
]

function CoachContentEdit() {
  const contentId = Taro.getCurrentInstance().router?.params?.id
  const isEdit = !!contentId
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [contentType, setContentType] = useState<ContentType>('text')
  const [requiredTier, setRequiredTier] = useState(0)
  const [price, setPrice] = useState('0')
  const [tags, setTags] = useState<string[]>([])
  const [currentTag, setCurrentTag] = useState('')
  const [isFeatured, setIsFeatured] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [coachId, setCoachId] = useState<string>('')

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({ url: '/auth/login?returnTo=' + encodeURIComponent('/coach/content/edit') })
      return
    }
    loadCoach()
    if (isEdit && contentId) {
      loadContent()
    }
  }, [contentId])

  async function loadCoach() {
    try {
      const user = Taro.getStorageSync('user')
      const coachRes = await coachService.getCoach({ userId: user?.id })
      if (coachRes?.coach?.id) {
        setCoachId(coachRes.coach.id)
      }
    } catch (e) {
      console.error('[coach/content/edit] load coach:', e)
    }
  }

  async function loadContent() {
    if (!contentId) return
    try {
      setLoading(true)
      // 从列表中找到对应的内容（简化版，实际应该调用getContentById API）
      const user = Taro.getStorageSync('user')
      const coachRes = await coachService.getCoach({ userId: user?.id })
      if (!coachRes?.coach?.id) return
      
      const res = await coachService.getContents({ coachId: coachRes.coach.id, limit: 100, offset: 0 })
      const found = res?.contents?.find((c: any) => c.id === contentId)
      if (found) {
        setTitle(found.title || '')
        setContent(found.content || '')
        setContentType((found.content_type as ContentType) || 'text')
        setRequiredTier(Number(found.required_tier ?? 0))
        setPrice(found.price_cents ? (found.price_cents / 100).toString() : '0')
        setTags(found.tags || [])
        setIsFeatured(found.is_featured || false)
      }
    } catch (e) {
      console.error('[coach/content/edit] load:', e)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  function handleAddTag() {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setTags([...tags, currentTag.trim()])
      setCurrentTag('')
    }
  }

  function handleRemoveTag(tag: string) {
    setTags(tags.filter(t => t !== tag))
  }

  async function handleSave(isDraft: boolean = false) {
    if (!title.trim()) {
      Taro.showToast({ title: '请输入标题', icon: 'none' })
      return
    }
    if (!content.trim()) {
      Taro.showToast({ title: '请输入内容', icon: 'none' })
      return
    }
    if (!coachId) {
      Taro.showToast({ title: '教练信息加载失败', icon: 'none' })
      return
    }

    try {
      setSaving(true)
      const priceCents = Math.floor(parseFloat(price || '0') * 100)

      if (isEdit && contentId) {
        const res = await coachService.updateContent({
          id: contentId,
          title,
          content,
          content_type: contentType,
          required_tier: requiredTier,
          price_cents: priceCents,
          tags,
          is_featured: isFeatured,
          isDraft
        })
        if (res?.success) {
          Taro.showToast({ title: isDraft ? '草稿已保存' : '更新成功', icon: 'success' })
          setTimeout(() => Taro.navigateBack(), 1500)
        } else {
          Taro.showToast({ title: res?.message || '保存失败', icon: 'none' })
        }
      } else {
        const res = await coachService.publishContent({
          coachId,
          title,
          content,
          content_type: contentType,
          required_tier: requiredTier,
          price_cents: priceCents,
          tags,
          is_featured: isFeatured,
          isDraft
        })
        if (res?.success) {
          Taro.showToast({ title: isDraft ? '草稿已保存' : '发布成功', icon: 'success' })
          setTimeout(() => Taro.navigateBack(), 1500)
        } else {
          Taro.showToast({ title: res?.message || '保存失败', icon: 'none' })
        }
      }
    } catch (e) {
      console.error('[coach/content/edit] save:', e)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View className="coach-content-edit-page">
        <View className="loading-wrap">加载中...</View>
      </View>
    )
  }

  return (
    <View className="coach-content-edit-page">
      <View className="header">
        <Button className="back-btn" onClick={() => Taro.navigateBack()}>返回</Button>
        <Text className="title">{isEdit ? '编辑内容' : '新建内容'}</Text>
        <View style={{ width: '60px' }}></View>
      </View>

      <ScrollView scrollY className="form-content">
        <View className="form-item">
          <Text className="label">标题 *</Text>
          <Input
            className="input"
            value={title}
            onInput={(e) => setTitle(e.detail.value)}
            placeholder="请输入标题"
          />
        </View>

        <View className="form-item">
          <Text className="label">内容 *</Text>
          <Textarea
            className="textarea"
            value={content}
            onInput={(e) => setContent(e.detail.value)}
            placeholder="请输入内容"
            maxlength={-1}
            showConfirmBar={false}
          />
        </View>

        <View className="form-item">
          <Text className="label">内容类型</Text>
          <Picker
            mode="selector"
            range={CONTENT_TYPE_OPTIONS.map((item) => item.label)}
            value={Math.max(CONTENT_TYPE_OPTIONS.findIndex((item) => item.value === contentType), 0)}
            onChange={(e) => {
              const next = CONTENT_TYPE_OPTIONS[Number(e.detail.value)]?.value || 'text'
              setContentType(next)
            }}
          >
            <View className="picker-card">
              <Text className="picker-value">
                {CONTENT_TYPE_OPTIONS.find((item) => item.value === contentType)?.label || '图文文章'}
              </Text>
              <Text className="picker-hint">和网页端一致，用来区分图文/视频/计划等内容形态</Text>
            </View>
          </Picker>
        </View>

        <View className="form-item">
          <Text className="label">可见范围</Text>
          <Picker
            mode="selector"
            range={TIER_OPTIONS.map((item) => item.label)}
            value={Math.max(TIER_OPTIONS.findIndex((item) => item.value === requiredTier), 0)}
            onChange={(e) => {
              const next = TIER_OPTIONS[Number(e.detail.value)]?.value ?? 0
              setRequiredTier(next)
            }}
          >
            <View className="picker-card">
              <Text className="picker-value">
                {TIER_OPTIONS.find((item) => item.value === requiredTier)?.label || '所有人可见'}
              </Text>
              <Text className="picker-hint">
                {TIER_OPTIONS.find((item) => item.value === requiredTier)?.desc || '未订阅学员也能查看'}
              </Text>
            </View>
          </Picker>
        </View>

        <View className="form-item">
          <Text className="label">价格（元）</Text>
          <Input
            className="input"
            type="digit"
            value={price}
            onInput={(e) => setPrice(e.detail.value)}
            placeholder="0.00"
          />
          <Text className="hint">0元表示免费内容</Text>
        </View>

        <View className="form-item">
          <Text className="label">标签</Text>
          <View className="tag-input-group">
            <Input
              className="tag-input"
              value={currentTag}
              onInput={(e) => setCurrentTag(e.detail.value)}
              placeholder="输入标签后点击添加"
              onConfirm={handleAddTag}
            />
            <Button className="add-tag-btn" onClick={handleAddTag}>添加</Button>
          </View>
          <View className="tags-list">
            {tags.map((tag, index) => (
              <View key={index} className="tag-item">
                <Text className="tag-text">#{tag}</Text>
                <Text className="tag-remove" onClick={() => handleRemoveTag(tag)}>×</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="form-item">
          <View className="checkbox-group">
            <View className="checkbox-item" onClick={() => setIsFeatured(!isFeatured)}>
              <View className={`checkbox ${isFeatured ? 'checked' : ''}`}>
                {isFeatured && <View className="checkbox-icon"><Check size={12} color="#fff" /></View>}
              </View>
              <Text className="checkbox-label">设为精选内容</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View className="footer">
        <Button className="draft-btn" onClick={() => handleSave(true)} loading={saving}>
          保存草稿
        </Button>
        <Button className="publish-btn" onClick={() => handleSave(false)} loading={saving}>
          {isEdit ? '更新发布' : '立即发布'}
        </Button>
      </View>
    </View>
  )
}

export default CoachContentEdit
