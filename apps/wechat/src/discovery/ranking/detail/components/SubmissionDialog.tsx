import React, { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Popup, Button, ConfigProvider } from '@nutui/nutui-react-taro'
import { StableNutInput as Input } from '@/components/StableNutInput'
import zhCN from '@nutui/nutui-react-taro/dist/locales/zh-CN'
import { rankingService } from '@/services/rankingService'
import type { LeaderboardFormInput } from '@/types/leaderboard'
import './SubmissionDialog.scss'

interface SubmissionDialogProps {
  visible: boolean
  onHide: () => void
  onSuccess?: () => void
  templateId: string
  formSchema: LeaderboardFormInput[]
  rankByField?: string
  needReview: boolean
}

function isValidUrl(s: string): boolean {
  if (!s?.trim()) return true
  try {
    const u = new URL(s.trim())
    return ['http:', 'https:'].includes(u.protocol)
  } catch {
    return false
  }
}

export default function SubmissionDialog({
  visible,
  onHide,
  onSuccess,
  templateId,
  formSchema,
  rankByField = 'weight',
  needReview
}: SubmissionDialogProps) {
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible && formSchema?.length) {
      const init: Record<string, any> = {}
      formSchema.forEach((f) => {
        init[f.name] = f.type === 'number' ? '' : ''
      })
      setFormData(init)
    }
  }, [visible, formSchema])

  const handleChange = (name: string, value: any) => {
    setFormData((p) => ({ ...p, [name]: value }))
  }

  const handleOptionSelect = (fieldName: string, options: string[]) => {
    Taro.showActionSheet({
      itemList: options,
      success: (res) => {
        handleChange(fieldName, options[res.tapIndex])
      }
    })
  }

  const handleSubmit = async () => {
    for (const f of formSchema) {
      if (f.type === 'number' && f.required) {
        const v = formData[f.name]
        if (v === '' || v == null || (typeof v === 'string' && !v.trim()) || (typeof v === 'number' && isNaN(v))) {
          Taro.showToast({ title: `${f.name} 是必填数值`, icon: 'none' })
          return
        }
      }
      if (f.type === 'video') {
        const v = formData[f.name]
        if (v && !isValidUrl(String(v))) {
          Taro.showToast({ title: '请输入有效的视频链接', icon: 'none' })
          return
        }
      }
    }
    const rankVal = formData[rankByField]
    if (rankVal === '' || rankVal == null || (typeof rankVal === 'string' && !rankVal.trim()) || (typeof rankVal === 'number' && isNaN(rankVal))) {
      Taro.showToast({ title: `${rankByField} 是排名数值，不能为空`, icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const formattedFormData = formSchema.map((f) => ({
        ...f,
        userInput: f.type === 'number' ? (parseFloat(formData[f.name]) || 0) : (formData[f.name] ?? '')
      }))
      const score = parseFloat(String(formData[rankByField])) || 0
      const firstVideo = formSchema.find((f) => f.type === 'video')
      const evidenceUrl = firstVideo ? (formData[firstVideo.name] || '') : ''

      const payload = {
        template_id: templateId,
        form_data: formattedFormData,
        score,
        evidence_url: evidenceUrl || null,
        status: 'pending'
      }

      const res = await rankingService.createEntry(payload)
      if (res) {
        Taro.showToast({ title: needReview ? '已提交审核' : '提交成功', icon: 'success' })
        onSuccess?.()
        onHide()
      } else {
        Taro.showToast({ title: '提交失败', icon: 'none' })
      }
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '提交失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <ConfigProvider locale={zhCN}>
      <Popup
        visible={visible}
        position="bottom"
        style={{ height: '70%', maxHeight: '560px' }}
        onClose={onHide}
        round
      >
        <View className="submission-popup">
          <Text className="submission-title">提交挑战成绩</Text>
          <View className="submission-form">
            {formSchema.map((f) => (
              <View key={f.name} className="form-field">
                <Text className="form-label">{f.name}</Text>
                {f.type === 'number' && (
                  <Input
                    type="digit"
                    placeholder="0.00"
                    value={String(formData[f.name] ?? '')}
                    onChange={(val) => handleChange(f.name, val)}
                    className="form-input"
                  />
                )}
                {f.type === 'option' && (
                  <View
                    className="form-input form-picker"
                    onClick={() => handleOptionSelect(f.name, f.type === "option" ? (f.options ?? []) : [])}
                  >
                    <Text className={formData[f.name] ? '' : 'placeholder'}>{formData[f.name] || '点击选择'}</Text>
                  </View>
                )}
                {f.type === 'text' && (
                  <Input
                    type="text"
                    placeholder={`输入${f.name}`}
                    value={formData[f.name] ?? ''}
                    onChange={(val) => handleChange(f.name, val)}
                    className="form-input"
                  />
                )}
                {f.type === 'video' && (
                  <Input
                    type="text"
                    placeholder="粘贴视频链接..."
                    value={formData[f.name] ?? ''}
                    onChange={(val) => handleChange(f.name, val)}
                    className="form-input"
                  />
                )}
              </View>
            ))}
          </View>
          <View className="submission-actions">
            <Button
              type="primary"
              block
              loading={loading}
              disabled={loading}
              onClick={handleSubmit}
              className="submit-btn-nut"
            >
              {needReview ? '提交审核' : '立即提交'}
            </Button>
          </View>
        </View>
      </Popup>
    </ConfigProvider>
  )
}
