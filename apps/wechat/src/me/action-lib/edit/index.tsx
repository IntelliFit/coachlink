import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Input, Textarea } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { studentActionLibService } from '@/services/studentActionLibService'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useTheme } from '@/hooks/useTheme'

const POSITIONS = ['胸部', '背部', '肩部', '手臂', '核心', '腿部', '臀部', '全身']
const ATTRS = ['力量', '耐力', '爆发力', '柔韧性', '平衡', '强度']
const TYPES = ['STRENGTH', 'CARDIO', 'FLEXIBILITY', 'BALANCE']

export default function ActionEditPage() {
  const { effectiveTheme } = useTheme()
  const router = useRouter()
  const actionId = router.params.id as string
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

  useEffect(() => {
    if (isEdit) {
      loadAction()
    }
  }, [actionId])

  const loadAction = async () => {
    try {
      const res = await studentActionLibService.listActions({ page: 1, limit: 500 })
      if (res?.actions) {
        const action = res.actions.find((a: any) => a.id === actionId)
        if (action) {
          setName(action.name || '')
          setDetail(action.detail || '')
          setUrl(action.url || '')
          setSelectedPositions(Array.isArray(action.positions) ? action.positions : [])
          setSelectedAttrs(Array.isArray(action.attrs) ? action.attrs : [])
          setType(action.type || 'STRENGTH')
          setReference1RM(action.reference_1rm ? String(action.reference_1rm) : '')
        }
      }
    } catch (error) {
      console.error('加载动作失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const togglePosition = (pos: string) => {
    setSelectedPositions(prev =>
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
    )
  }

  const toggleAttr = (attr: string) => {
    setSelectedAttrs(prev =>
      prev.includes(attr) ? prev.filter(a => a !== attr) : [...prev, attr]
    )
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
        if (reference1RM) {
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
      console.error('保存失败:', error)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View className={`action-edit-page theme-${effectiveTheme}`}>
        <View className="loading"><LoadingSpinner size={48} /></View>
        <BottomNav />
      </View>
    )
  }

  return (
    <View className={`action-edit-page theme-${effectiveTheme}`}>
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
                onInput={e => setName(e.detail.value)}
                placeholder='例如：杠铃深蹲'
              />
            </View>

            <View className='form-field'>
              <Text className='field-label'>动作描述</Text>
              <Textarea
                className='field-textarea'
                value={detail}
                onInput={e => setDetail(e.detail.value)}
                placeholder='描述动作要领、注意事项...'
                maxlength={500}
              />
            </View>

            <View className='form-field'>
              <Text className='field-label'>参考视频链接</Text>
              <Input
                className='field-input'
                value={url}
                onInput={e => setUrl(e.detail.value)}
                placeholder='https://...'
              />
            </View>

            <View className='form-field'>
              <Text className='field-label'>1RM (kg)</Text>
              <Input
                className='field-input'
                type='digit'
                value={reference1RM}
                onInput={e => setReference1RM(e.detail.value)}
                placeholder='输入极限重量'
              />
              <Text className='field-hint'>用于自动计算训练重量</Text>
            </View>
          </View>

          <View className='form-section'>
            <Text className='section-title'>动作类型</Text>
            <View className='option-list'>
              {TYPES.map(t => (
                <View
                  key={t}
                  className={`option-item ${type === t ? 'selected' : ''}`}
                  onClick={() => setType(t)}
                >
                  <Text>{t === 'STRENGTH' ? '力量' : t === 'CARDIO' ? '有氧' : t === 'FLEXIBILITY' ? '柔韧' : '平衡'}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='form-section'>
            <Text className='section-title'>训练部位（多选）</Text>
            <View className='option-list'>
              {POSITIONS.map(pos => (
                <View
                  key={pos}
                  className={`option-item ${selectedPositions.includes(pos) ? 'selected' : ''}`}
                  onClick={() => togglePosition(pos)}
                >
                  <Text>{pos}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='form-section'>
            <Text className='section-title'>动作属性（多选）</Text>
            <View className='option-list'>
              {ATTRS.map(attr => (
                <View
                  key={attr}
                  className={`option-item ${selectedAttrs.includes(attr) ? 'selected' : ''}`}
                  onClick={() => toggleAttr(attr)}
                >
                  <Text>{attr}</Text>
                </View>
              ))}
            </View>
            <Text className='section-hint'>选择「强度」属性将启用1RM自动计算</Text>
          </View>

          <View className='bottom-actions'>
            <View className='secondary-btn' onClick={() => Taro.navigateBack()}>
              <Text>取消</Text>
            </View>
            <View 
              className={`primary-btn ${saving ? 'loading' : ''}`}
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
