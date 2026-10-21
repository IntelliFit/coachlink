import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Textarea } from '@tarojs/components'
import { StableInput as Input } from '@/components/StableInput'
import Taro, { useRouter } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { studentActionLibService } from '@/services/studentActionLibService'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useTheme } from '@/hooks/useTheme'
import { isOneRMEligibleAction } from '@coachlink/core/src/actionLoadMode'

const POSITIONS = ['胸部', '背部', '肩部', '手臂', '核心', '腿部', '臀部', '全身']
const ATTRS = ['力量', '耐力', '爆发力', '柔韧性', '平衡', '强度']
const TYPES = ['STRENGTH', 'CARDIO', 'FLEXIBILITY', 'BALANCE']

// Rows arrive camelCase from Supabase, snake_case from older APIs.
const readFlag = (camel: unknown, snake: unknown) => Boolean(camel ?? snake)

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
  // 自动算重是用户的显式选择；「强度」只是训练参数字段，不能据此推断
  const [enableAutoWeightCompute, setEnableAutoWeightCompute] = useState(false)
  const [includesBodyWeight, setIncludesBodyWeight] = useState(false)
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
          setEnableAutoWeightCompute(readFlag(action.enableAutoWeightCompute, action.enable_auto_weight_compute))
          setIncludesBodyWeight(readFlag(action.includesBodyWeight, action.includes_body_weight))
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

  const isStrength = type === 'STRENGTH'
  const isOneRMEligible = isOneRMEligibleAction({ type, attrs: selectedAttrs, enableAutoWeightCompute })

  const handleSave = async () => {
    if (!name.trim()) {
      Taro.showToast({ title: '请输入动作名称', icon: 'none' })
      return
    }
    // 1RM 输入框只对符合条件的动作显示，隐藏时残留的内容不参与校验
    const parsedReference1RM = isOneRMEligible && reference1RM.trim() ? Number(reference1RM) : null
    if (parsedReference1RM !== null && (!Number.isFinite(parsedReference1RM) || parsedReference1RM <= 0)) {
      Taro.showToast({ title: '1RM 请输入大于 0 的数字，或留空', icon: 'none' })
      return
    }
    const autoWeight = isStrength && enableAutoWeightCompute

    setSaving(true)
    try {
      const data = {
        name: name.trim(),
        detail: detail.trim() || null,
        url: url.trim() || null,
        positions: selectedPositions.length > 0 ? selectedPositions : null,
        attrs: selectedAttrs.length > 0 ? selectedAttrs : null,
        type,
        // 必须显式传：力量动作更新时缺省该字段，服务端会把「包含自重」清掉
        enableAutoWeightCompute: autoWeight,
        includesBodyWeight: autoWeight && includesBodyWeight,
        reference_1rm: isOneRMEligible ? parsedReference1RM : null
      }

      const saved = isEdit
        ? await studentActionLibService.updateAction({ id: actionId, ...data })
        : await studentActionLibService.addAction(data)
      // 失败时 request 已弹出服务端原因，留在本页让用户修改
      if (!saved) return
      Taro.showToast({ title: isEdit ? '更新成功' : '创建成功', icon: 'success' })

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
          </View>

          {isStrength ? (
            <View className='form-section'>
              <Text className='section-title'>智能重量计算</Text>
              <Text className='section-desc'>
                开启后，计划里按 RM / %1RM 安排的组会根据 1RM 自动算出重量，需同时选择「强度」属性。死虫、俯卧撑这类自重或核心动作保持关闭即可。
              </Text>
              <View className='option-list'>
                <View
                  className={`option-item ${enableAutoWeightCompute ? 'selected' : ''}`}
                  onClick={() => setEnableAutoWeightCompute(prev => !prev)}
                >
                  <Text>按 1RM 自动算重</Text>
                </View>
                {enableAutoWeightCompute ? (
                  <View
                    className={`option-item ${includesBodyWeight ? 'selected' : ''}`}
                    onClick={() => setIncludesBodyWeight(prev => !prev)}
                  >
                    <Text>包含自重（如引体向上）</Text>
                  </View>
                ) : null}
              </View>
              {enableAutoWeightCompute && !selectedAttrs.includes('强度') ? (
                <Text className='section-hint'>还需在上方选择「强度」属性，自动算重才会生效</Text>
              ) : null}
              {isOneRMEligible ? (
                <View className='form-field onerm-field'>
                  <Text className='field-label'>参考 1RM (kg)</Text>
                  <Input
                    className='field-input'
                    type='digit'
                    value={reference1RM}
                    onInput={e => setReference1RM(e.detail.value)}
                    placeholder='未填写'
                  />
                  <Text className='field-hint'>用于自动计算训练重量，可留空</Text>
                </View>
              ) : null}
            </View>
          ) : null}

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
