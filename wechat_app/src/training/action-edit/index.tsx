import React, { useState } from 'react'
import { View, Text, Input, Textarea } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { addAction, handleApiError } from '@/services/actionLibPageService'
import type { ItemType, StudentActionInsert } from '@/types/action'
import { TYPE_META } from '@/constants/action'
import './index.scss'

const TYPE_OPTIONS: { value: ItemType; label: string }[] = [
  { value: 'STRENGTH', label: '力量' },
  { value: 'DIET', label: '饮食' },
  { value: 'CARDIO', label: '有氧' },
  { value: 'HABIT', label: '习惯' }
]

export default function ActionEditPage() {
  const router = useRouter()
  const id = router.params?.id
  const isAdd = !id

  const [name, setName] = useState('')
  const [detail, setDetail] = useState('')
  const [type, setType] = useState<ItemType>('STRENGTH')
  const [positionsStr, setPositionsStr] = useState('')
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    const trimName = name.trim()
    if (!trimName) {
      Taro.showToast({ title: '请输入动作名称', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      const positions = positionsStr
        .split(/[,，、\s]+/)
        .map(s => s.trim())
        .filter(Boolean)
      const payload: StudentActionInsert = {
        name: trimName,
        detail: detail.trim() || undefined,
        type,
        positions: positions.length ? positions : undefined,
        url: url.trim() || undefined
      }
      await addAction(payload)
      Taro.showToast({ title: '添加成功', icon: 'success' })
      setTimeout(() => {
        Taro.navigateBack()
      }, 800)
    } catch (e) {
      handleApiError(e, '添加失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className="action-edit-page">
      <View className="form-group">
        <Text className="form-label">
          动作名称<Text className="required">*</Text>
        </Text>
        <Input
          className="form-input"
          placeholder="请输入动作名称"
          value={name}
          onInput={e => setName(e.detail.value)}
          maxlength={100}
        />
      </View>

      <View className="form-group">
        <Text className="form-label">动作描述</Text>
        <Textarea
          className="form-input form-textarea"
          placeholder="选填，简要描述该动作"
          value={detail}
          onInput={e => setDetail(e.detail.value)}
          maxlength={500}
        />
      </View>

      <View className="form-group">
        <Text className="form-label">训练部位</Text>
        <Input
          className="form-input"
          placeholder="选填，如：胸、背、腿，多个用逗号分隔"
          value={positionsStr}
          onInput={e => setPositionsStr(e.detail.value)}
        />
      </View>

      <View className="form-group">
        <Text className="form-label">动作类型</Text>
        <View className="type-options">
          {TYPE_OPTIONS.map(opt => (
            <Text
              key={opt.value}
              className={`type-option ${type === opt.value ? 'active' : ''}`}
              onClick={() => setType(opt.value)}
            >
              {opt.label}
            </Text>
          ))}
        </View>
      </View>

      <View className="form-group">
        <Text className="form-label">演示视频链接</Text>
        <Input
          className="form-input"
          placeholder="选填"
          value={url}
          onInput={e => setUrl(e.detail.value)}
        />
      </View>

      <View className="submit-wrap">
        <View
          className={`btn-submit ${submitting ? 'disabled' : ''}`}
          onClick={() => !submitting && handleSubmit()}
        >
          {isAdd ? '添加动作' : '保存'}
        </View>
      </View>
    </View>
  )
}
