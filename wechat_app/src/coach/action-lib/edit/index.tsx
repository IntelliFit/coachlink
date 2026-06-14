import React, { useState, useEffect } from 'react'
import { View, Text, Input, Textarea, Button, ScrollView, Picker } from '@tarojs/components'
import { Check } from '@nutui/icons-react-taro'
import Taro from '@tarojs/taro'
import { actionLibService } from '@/services/coach/actionLibService'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useTheme } from '@/hooks/useTheme'

const ACTION_TYPES = [
  { label: '力量训练', value: 'STRENGTH' },
  { label: '饮食管理', value: 'DIET' },
  { label: '有氧运动', value: 'CARDIO' },
  { label: '习惯打卡', value: 'HABIT' }
]

const POSITIONS = ['胸部', '背部', '腿部', '肩部', '手臂', '核心', '其他']
const ATTRS = ['组数', '次数', '强度', '持续时间', '休息时间']

function CoachActionLibEdit() {
  const { effectiveTheme } = useTheme()
  const actionId = Taro.getCurrentInstance().router?.params?.id
  const isEdit = !!actionId
  const [name, setName] = useState('')
  const [detail, setDetail] = useState('')
  const [url, setUrl] = useState('')
  const [type, setType] = useState('STRENGTH')
  const [positions, setPositions] = useState<string[]>([])
  const [attrs, setAttrs] = useState<string[]>(['组数', '次数', '强度', '休息时间'])
  const [enableAutoWeightCompute, setEnableAutoWeightCompute] = useState(false)
  const [includesBodyWeight, setIncludesBodyWeight] = useState(false)
  const [suggestedTime, setSuggestedTime] = useState('')
  const [calories, setCalories] = useState('')
  const [distance, setDistance] = useState('')
  const [duration, setDuration] = useState('')
  const [pace, setPace] = useState('')
  const [targetDuration, setTargetDuration] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({ url: '/auth/login?returnTo=' + encodeURIComponent('/coach/action-lib/edit') })
      return
    }
    if (isEdit && actionId) {
      loadAction()
    }
  }, [actionId])

  async function loadAction() {
    if (!actionId) return
    try {
      setLoading(true)
      const res = await actionLibService.listActions({ page: 1, limit: 100 })
      const found = res?.actions?.find((a: any) => a.id === actionId)
      if (found) {
        setName(found.name || '')
        setDetail(found.detail || '')
        setUrl(found.url || '')
        setType(found.type || 'STRENGTH')
        setPositions(found.positions || [])
        setAttrs(found.attrs || ['组数', '次数', '强度', '休息时间'])
        setEnableAutoWeightCompute(found.enableAutoWeightCompute || false)
        setIncludesBodyWeight(found.includesBodyWeight || false)
        setSuggestedTime(found.suggested_time || '')
        const schema = found.item_schema || {}
        if (schema.calories) setCalories(schema.calories.toString())
        if (schema.distance) setDistance((schema.distance / 1000).toString())
        if (schema.duration) setDuration((schema.duration / 60).toString())
        if (schema.pace) setPace(schema.pace.toString())
        if (schema.target_duration) setTargetDuration(schema.target_duration.toString())
      }
    } catch (e) {
      console.error('[coach/action-lib/edit] load:', e)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  function handlePositionChange(selected: string[]) {
    setPositions(selected)
  }

  function handleAttrChange(selected: string[]) {
    setAttrs(selected)
  }

  async function handleSave() {
    if (!name.trim()) {
      Taro.showToast({ title: '请输入动作名称', icon: 'none' })
      return
    }

    try {
      setSaving(true)
      const itemSchema: any = {}
      if (type === 'DIET' && calories) {
        itemSchema.calories = parseInt(calories)
      } else if (type === 'CARDIO') {
        if (distance) itemSchema.distance = parseFloat(distance) * 1000
        if (duration) itemSchema.duration = parseFloat(duration) * 60
        if (pace) itemSchema.pace = parseFloat(pace)
      } else if (type === 'HABIT' && targetDuration) {
        itemSchema.target_duration = parseInt(targetDuration)
      }

      const actionData: any = {
        name,
        detail: detail || undefined,
        url: url || undefined,
        type,
        positions: type === 'STRENGTH' ? positions : undefined,
        attrs: type === 'STRENGTH' ? attrs : undefined,
        enableAutoWeightCompute: type === 'STRENGTH' ? enableAutoWeightCompute : false,
        includesBodyWeight: type === 'STRENGTH' && enableAutoWeightCompute ? includesBodyWeight : false,
        suggested_time: type === 'DIET' && suggestedTime ? suggestedTime : undefined,
        item_schema: Object.keys(itemSchema).length > 0 ? itemSchema : undefined
      }

      if (isEdit && actionId) {
        actionData.id = actionId
        const res = await actionLibService.updateAction(actionData)
        if (res?.success) {
          Taro.showToast({ title: '更新成功', icon: 'success' })
          setTimeout(() => Taro.navigateBack(), 1500)
        } else {
          Taro.showToast({ title: res?.message || '保存失败', icon: 'none' })
        }
      } else {
        const res = await actionLibService.addAction(actionData)
        if (res?.success) {
          Taro.showToast({ title: '添加成功', icon: 'success' })
          setTimeout(() => Taro.navigateBack(), 1500)
        } else {
          Taro.showToast({ title: res?.message || '保存失败', icon: 'none' })
        }
      }
    } catch (e) {
      console.error('[coach/action-lib/edit] save:', e)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View className={`coach-action-lib-edit-page theme-${effectiveTheme}`}>
        <View className="loading-wrap"><LoadingSpinner size={48} /></View>
      </View>
    )
  }

  return (
    <View className={`coach-action-lib-edit-page theme-${effectiveTheme}`}>
      <View className="header">
        <Button className="back-btn" onClick={() => Taro.navigateBack()}>返回</Button>
        <Text className="title">{isEdit ? '编辑动作' : '新建动作'}</Text>
        <View style={{ width: '60px' }}></View>
      </View>

      <ScrollView scrollY className="form-content">
        <View className="form-item">
          <Text className="label">项目分类 *</Text>
          <Picker
            mode="selector"
            range={ACTION_TYPES}
            rangeKey="label"
            value={ACTION_TYPES.findIndex(t => t.value === type)}
            onChange={(e) => {
              const selected = ACTION_TYPES[e.detail.value]
              setType(selected.value)
              // 切换类型时重置相关字段
              if (selected.value !== 'STRENGTH') {
                setPositions([])
                setAttrs([])
                setEnableAutoWeightCompute(false)
                setIncludesBodyWeight(false)
              } else {
                setAttrs(['组数', '次数', '强度', '休息时间'])
              }
            }}
          >
            <View className="picker-view">
              {ACTION_TYPES.find(t => t.value === type)?.label || '请选择'}
            </View>
          </Picker>
        </View>

        <View className="form-item">
          <Text className="label">
            {type === 'DIET' ? '饮食名称' : type === 'HABIT' ? '习惯名称' : '动作名称'} *
          </Text>
          <Input
            className="input"
            value={name}
            onInput={(e) => setName(e.detail.value)}
            placeholder={type === 'DIET' ? '如：健康轻食午餐' : type === 'HABIT' ? '如：每日早起冥想' : '输入动作全称...'}
          />
        </View>

        {type === 'DIET' && (
          <>
            <View className="form-item">
              <Text className="label">热量估算 (kcal)</Text>
              <Input
                className="input"
                type="number"
                value={calories}
                onInput={(e) => setCalories(e.detail.value)}
                placeholder="请输入热量"
              />
            </View>
            <View className="form-item">
              <Text className="label">推荐进食时间</Text>
              <Input
                className="input"
                type="text"
                value={suggestedTime}
                onInput={(e) => setSuggestedTime(e.detail.value)}
                placeholder="如：08:00"
              />
            </View>
          </>
        )}

        {type === 'CARDIO' && (
          <>
            <View className="form-item">
              <Text className="label">距离 (km)</Text>
              <Input
                className="input"
                type="digit"
                value={distance}
                onInput={(e) => setDistance(e.detail.value)}
                placeholder="0"
              />
            </View>
            <View className="form-item">
              <Text className="label">时长 (min)</Text>
              <Input
                className="input"
                type="digit"
                value={duration}
                onInput={(e) => setDuration(e.detail.value)}
                placeholder="0"
              />
            </View>
            <View className="form-item">
              <Text className="label">配速 (m/k)</Text>
              <Input
                className="input"
                type="digit"
                value={pace}
                onInput={(e) => setPace(e.detail.value)}
                placeholder="0"
              />
            </View>
          </>
        )}

        {type === 'HABIT' && (
          <View className="form-item">
            <Text className="label">目标达成量 (分钟/次数)</Text>
            <Input
              className="input"
              type="number"
              value={targetDuration}
              onInput={(e) => setTargetDuration(e.detail.value)}
              placeholder="例如: 10"
            />
          </View>
        )}

        {type === 'STRENGTH' && (
          <>
            <View className="form-item">
              <View className="checkbox-group">
                <View className="checkbox-item" onClick={() => setEnableAutoWeightCompute(!enableAutoWeightCompute)}>
                  <View className={`checkbox ${enableAutoWeightCompute ? 'checked' : ''}`}>
                    {enableAutoWeightCompute && <View className="checkbox-icon"><Check size={12} color="#fff" /></View>}
                  </View>
                  <View className="checkbox-label-group">
                    <Text className="checkbox-label">智能重量计算</Text>
                    <Text className="checkbox-hint">将会计入学员问卷并支持在计划生成中为该动作自动计算负重</Text>
                  </View>
                </View>
              </View>
              {enableAutoWeightCompute && (
                <View className="checkbox-group" style={{ marginTop: '20px' }}>
                  <View className="checkbox-item" onClick={() => setIncludesBodyWeight(!includesBodyWeight)}>
                    <View className={`checkbox ${includesBodyWeight ? 'checked' : ''}`}>
                      {includesBodyWeight && <View className="checkbox-icon"><Check size={12} color="#fff" /></View>}
                    </View>
                    <View className="checkbox-label-group">
                      <Text className="checkbox-label">是否包含自身体重</Text>
                      <Text className="checkbox-hint">如引体向上，将会影响自动计算结果</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            <View className="form-item">
              <Text className="label">训练部位</Text>
              <Picker
                mode="multiSelector"
                range={[POSITIONS]}
                value={[positions.map(p => POSITIONS.indexOf(p)).filter(i => i >= 0)]}
                onChange={(e) => {
                  const selected = e.detail.value[0].map((i: number) => POSITIONS[i])
                  handlePositionChange(selected)
                }}
              >
                <View className="picker-view">
                  {positions.length > 0 ? positions.join(', ') : '请选择'}
                </View>
              </Picker>
            </View>

            <View className="form-item">
              <Text className="label">动作属性</Text>
              <Picker
                mode="multiSelector"
                range={[ATTRS]}
                value={[attrs.map(a => ATTRS.indexOf(a)).filter(i => i >= 0)]}
                onChange={(e) => {
                  const selected = e.detail.value[0].map((i: number) => ATTRS[i])
                  handleAttrChange(selected)
                }}
              >
                <View className="picker-view">
                  {attrs.length > 0 ? attrs.join(', ') : '请选择'}
                </View>
              </Picker>
            </View>
          </>
        )}

        <View className="form-item">
          <Text className="label">详细描述</Text>
          <Textarea
            className="textarea"
            value={detail}
            onInput={(e) => setDetail(e.detail.value)}
            placeholder="填写详细的操作要求、注意事项或习惯说明..."
            maxlength={-1}
            showConfirmBar={false}
          />
        </View>

        <View className="form-item">
          <Text className="label">演示视频 URL</Text>
          <Input
            className="input"
            value={url}
            onInput={(e) => setUrl(e.detail.value)}
            placeholder="https://..."
          />
        </View>
      </ScrollView>

      <View className="footer">
        <Button className="save-btn" onClick={handleSave} loading={saving}>
          {isEdit ? '更新' : '保存'}
        </Button>
      </View>
    </View>
  )
}

export default CoachActionLibEdit
