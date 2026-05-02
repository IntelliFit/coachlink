import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, Input, Textarea, Video } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { studentActionLibService } from '@/services/studentActionLibService'
import './index.scss'

const POSITIONS = ['胸部', '背部', '肩部', '手臂', '核心', '腿部', '臀部', '全身']
const ATTRS = ['力量', '耐力', '爆发力', '柔韧性', '平衡', '强度']
const TYPES = [
  { value: 'STRENGTH', label: '力量' },
  { value: 'CARDIO', label: '有氧' },
  { value: 'FLEXIBILITY', label: '柔韧' },
  { value: 'BALANCE', label: '平衡' }
]
const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024

export default function ActionEditPage() {
  const router = useRouter()
  const actionId = String(router.params?.id || '')
  const isEdit = !!actionId

  const [name, setName] = useState('')
  const [detail, setDetail] = useState('')
  const [url, setUrl] = useState('')
  const [selectedPositions, setSelectedPositions] = useState<string[]>([])
  const [selectedAttrs, setSelectedAttrs] = useState<string[]>([])
  const [type, setType] = useState('STRENGTH')
  const [reference1RM, setReference1RM] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [uploadingDemoVideo, setUploadingDemoVideo] = useState(false)
  const [demoVideoProgress, setDemoVideoProgress] = useState(0)
  const [videoPreviewError, setVideoPreviewError] = useState('')

  useEffect(() => {
    if (!isEdit) return
    void loadAction()
  }, [actionId, isEdit])

  useEffect(() => {
    setVideoPreviewError('')
  }, [url])

  const loadAction = async () => {
    try {
      const res = await studentActionLibService.listActions({ page: 1, limit: 500 })
      const action = res?.actions?.find((item: any) => item.id === actionId)

      if (!action) {
        Taro.showToast({ title: '未找到动作', icon: 'none' })
        return
      }

      setName(action.name || '')
      setDetail(action.detail || '')
      setUrl(action.url || '')
      setSelectedPositions(Array.isArray(action.positions) ? action.positions : [])
      setSelectedAttrs(Array.isArray(action.attrs) ? action.attrs : [])
      setType(action.type || 'STRENGTH')
      setReference1RM(action.reference_1rm ? String(action.reference_1rm) : '')
    } catch (error) {
      console.error('load action failed:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const togglePosition = (position: string) => {
    setSelectedPositions((prev) => (
      prev.includes(position) ? prev.filter((item) => item !== position) : [...prev, position]
    ))
  }

  const toggleAttr = (attr: string) => {
    setSelectedAttrs((prev) => (
      prev.includes(attr) ? prev.filter((item) => item !== attr) : [...prev, attr]
    ))
  }

  const handleChooseDemoVideo = async () => {
    try {
      const res = await Taro.chooseVideo({
        sourceType: ['album', 'camera'],
        compressed: true,
        maxDuration: 300
      })

      if (!res?.tempFilePath) return

      if (res.size && res.size > MAX_VIDEO_SIZE_BYTES) {
        Taro.showToast({ title: '视频需小于 200MB', icon: 'none' })
        return
      }

      setUploadingDemoVideo(true)
      setDemoVideoProgress(0)
      setVideoPreviewError('')

      const uploadRes = await studentActionLibService.uploadDemoVideo(
        res.tempFilePath,
        (progress) => setDemoVideoProgress(progress)
      )

      if (!uploadRes?.url) {
        Taro.showToast({ title: '上传失败', icon: 'none' })
        return
      }

      setUrl(uploadRes.url)
      Taro.showToast({ title: '视频已上传，可直接预览', icon: 'success' })
    } catch (error: any) {
      if (String(error?.errMsg || '').includes('cancel')) return
      console.error('upload demo video failed:', error)
      Taro.showToast({ title: error?.message || '上传失败', icon: 'none' })
    } finally {
      setUploadingDemoVideo(false)
      setDemoVideoProgress(0)
    }
  }

  const handleClearUrl = () => {
    setUrl('')
    setVideoPreviewError('')
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Taro.showToast({ title: '请输入动作名称', icon: 'none' })
      return
    }

    setSaving(true)
    try {
      const data = {
        name: name.trim(),
        detail: detail.trim() || null,
        url: url.trim() || null,
        positions: selectedPositions.length > 0 ? selectedPositions : null,
        attrs: selectedAttrs.length > 0 ? selectedAttrs : null,
        type
      }

      if (isEdit) {
        await studentActionLibService.updateAction({ id: actionId, ...data })
        if (reference1RM.trim()) {
          await studentActionLibService.batchUpdate1RM([{
            actionId,
            reference1RM: parseFloat(reference1RM)
          }])
        }
        Taro.showToast({ title: '更新成功', icon: 'success' })
      } else {
        await studentActionLibService.addAction(data)
        Taro.showToast({ title: '创建成功', icon: 'success' })
      }

      setTimeout(() => {
        Taro.navigateBack()
      }, 800)
    } catch (error) {
      console.error('save action failed:', error)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View className='action-edit-page'>
        <View className='loading'>
          <LoadingSpinner size={48} />
        </View>
        <BottomNav />
      </View>
    )
  }

  return (
    <View className='action-edit-page'>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          <View className='page-header'>
            <Text className='page-title'>{isEdit ? '编辑动作' : '新建动作'}</Text>
            <Text className='page-subtitle'>完善动作信息</Text>
          </View>

          <View className='form-section'>
            <Text className='section-title'>基础信息</Text>

            <View className='form-field'>
              <Text className='field-label'>动作名称 <Text className='required'>*</Text></Text>
              <Input
                className='field-input'
                value={name}
                onInput={(e) => setName(e.detail.value)}
                placeholder='例如：杠铃深蹲'
              />
            </View>

            <View className='form-field'>
              <Text className='field-label'>动作描述</Text>
              <Textarea
                className='field-textarea'
                value={detail}
                onInput={(e) => setDetail(e.detail.value)}
                placeholder='描述动作要领、注意事项或训练提示'
                maxlength={500}
              />
            </View>

            <View className='form-field'>
              <Text className='field-label'>演示视频</Text>
              <Input
                className='field-input'
                value={url}
                onInput={(e) => setUrl(e.detail.value)}
                placeholder='支持粘贴可直接播放的视频链接'
              />
              <Text className='field-hint'>和网站一致：可以上传视频，也可以粘贴视频直链，下面直接预览，不再只显示链接</Text>

              <View className='video-actions'>
                <View
                  className={`primary-btn compact ${uploadingDemoVideo ? 'disabled' : ''}`}
                  onClick={uploadingDemoVideo ? undefined : handleChooseDemoVideo}
                >
                  <Text>{uploadingDemoVideo ? `上传中 ${demoVideoProgress}%` : '上传视频'}</Text>
                </View>
                <View className='secondary-btn compact' onClick={handleClearUrl}>
                  <Text>清空</Text>
                </View>
              </View>

              {uploadingDemoVideo ? (
                <View className='progress-card'>
                  <View className='progress-track'>
                    <View className='progress-fill' style={{ width: `${demoVideoProgress}%` }} />
                  </View>
                  <Text className='progress-text'>正在处理视频并上传</Text>
                </View>
              ) : null}

              {url.trim() ? (
                <View className='video-preview-card'>
                  <Text className='video-preview-label'>视频预览</Text>
                  <Video
                    className='video-player'
                    src={url.trim()}
                    controls
                    showCenterPlayBtn
                    showPlayBtn
                    enablePlayGesture
                    objectFit='contain'
                    onError={(event: any) => {
                      console.error('video preview failed:', event)
                      setVideoPreviewError('当前链接暂时无法预览，请确认它是可直接播放的视频链接')
                    }}
                  />
                  {videoPreviewError ? (
                    <Text className='video-preview-error'>{videoPreviewError}</Text>
                  ) : (
                    <Text className='video-preview-tip'>支持上传后直接预览，也支持粘贴视频直链后预览</Text>
                  )}
                </View>
              ) : (
                <View className='video-preview-empty'>
                  <Text className='video-preview-empty-text'>上传视频或粘贴视频链接后，这里会直接显示可播放预览</Text>
                </View>
              )}
            </View>

            <View className='form-field'>
              <Text className='field-label'>1RM (kg)</Text>
              <Input
                className='field-input'
                type='digit'
                value={reference1RM}
                onInput={(e) => setReference1RM(e.detail.value)}
                placeholder='输入极限重量'
              />
              <Text className='field-hint'>用于自动计算训练重量</Text>
            </View>
          </View>

          <View className='form-section'>
            <Text className='section-title'>动作类型</Text>
            <View className='option-list'>
              {TYPES.map((item) => (
                <View
                  key={item.value}
                  className={`option-item ${type === item.value ? 'selected' : ''}`}
                  onClick={() => setType(item.value)}
                >
                  <Text>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='form-section'>
            <Text className='section-title'>训练部位（多选）</Text>
            <View className='option-list'>
              {POSITIONS.map((position) => (
                <View
                  key={position}
                  className={`option-item ${selectedPositions.includes(position) ? 'selected' : ''}`}
                  onClick={() => togglePosition(position)}
                >
                  <Text>{position}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='form-section'>
            <Text className='section-title'>动作属性（多选）</Text>
            <View className='option-list'>
              {ATTRS.map((attr) => (
                <View
                  key={attr}
                  className={`option-item ${selectedAttrs.includes(attr) ? 'selected' : ''}`}
                  onClick={() => toggleAttr(attr)}
                >
                  <Text>{attr}</Text>
                </View>
              ))}
            </View>
            <Text className='section-hint'>选择“强度”属性后，可以配合 1RM 做训练重量参考</Text>
          </View>

          <View className='bottom-actions'>
            <View className='secondary-btn' onClick={() => Taro.navigateBack()}>
              <Text>取消</Text>
            </View>
            <View
              className={`primary-btn ${saving ? 'disabled' : ''}`}
              onClick={saving ? undefined : handleSave}
            >
              <Text>{saving ? '保存中...' : '保存'}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}
