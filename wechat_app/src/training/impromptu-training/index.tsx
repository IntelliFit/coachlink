import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { impromptuService, ImpromptuActionInput } from '@/services/impromptuService'
import { studentActionLibService } from '@/services/studentActionLibService'
import { authService } from '@/services/authService'
import './index.scss'

interface TrainingItem {
  localId: string
  actionId: string
  actionName: string
  sets: number
  reps: number
  restSeconds: number
  weight: number | null
}

const DEFAULT_SETS = 4
const DEFAULT_REPS = 8
const DEFAULT_REST = 90

export default function ImpromptuTraining() {
  const [actions, setActions] = useState<any[]>([])
  const [loadingActions, setLoadingActions] = useState(true)
  const [trainingItems, setTrainingItems] = useState<TrainingItem[]>([
    {
      localId: `item-${Date.now()}`,
      actionId: '',
      actionName: '',
      sets: DEFAULT_SETS,
      reps: DEFAULT_REPS,
      restSeconds: DEFAULT_REST,
      weight: null
    }
  ])
  const [starting, setStarting] = useState(false)
  const [showActionPicker, setShowActionPicker] = useState(false)
  const [pickingItemIndex, setPickingItemIndex] = useState<number | null>(null)

  const loadActions = useCallback(async () => {
    try {
      setLoadingActions(true)
      const res = await studentActionLibService.listActions({ page: 1, limit: 1000 })
      const list = (res?.actions || []).filter((a: any) => a.type === 'STRENGTH' || !a.type)
      setActions(list)
    } catch (e) {
      console.error('加载动作失败:', e)
      Taro.showToast({ title: '无法加载动作库', icon: 'none' })
    } finally {
      setLoadingActions(false)
    }
  }, [])

  useEffect(() => {
    const user = authService.getCurrentUser()
    if (!user?.id) {
      Taro.redirectTo({
        url: `/auth/login?returnTo=${encodeURIComponent('/training/impromptu-training')}`
      })
      return
    }
    loadActions()
  }, [loadActions])

  const appendItem = () => {
    setTrainingItems(prev => [
      ...prev,
      {
        localId: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        actionId: '',
        actionName: '',
        sets: DEFAULT_SETS,
        reps: DEFAULT_REPS,
        restSeconds: DEFAULT_REST,
        weight: null
      }
    ])
  }

  const removeItem = (index: number) => {
    setTrainingItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleSelectAction = (index: number, action: any) => {
    setTrainingItems(prev => prev.map((it, i) =>
      i === index
        ? {
            ...it,
            actionId: action.id,
            actionName: action.name || '未命名'
          }
        : it
    ))
    setShowActionPicker(false)
    setPickingItemIndex(null)
    Taro.showToast({ title: `已选择：${action.name}`, icon: 'success' })
  }

  const handleItemChange = (index: number, field: keyof TrainingItem, value: number | string | null) => {
    setTrainingItems(prev => prev.map((it, i) => i === index ? { ...it, [field]: value } : it))
  }

  const handleStart = async () => {
    const invalidItem = trainingItems.find(item => !item.actionId)
    if (invalidItem) {
      Taro.showToast({ title: '请为所有项目选择动作', icon: 'none' })
      return
    }

    setStarting(true)
    try {
      const payload: ImpromptuActionInput[] = trainingItems.map(item => {
        const action = actions.find(a => a.id === item.actionId)
        return {
          actionId: item.actionId,
          actionName: action?.name || item.actionName || '未知动作',
          sets: item.sets,
          reps: item.reps,
          weight: item.weight,
          restSeconds: item.restSeconds
        }
      })

      const data = await impromptuService.start(payload)
      if (!data?.id) {
        throw new Error('创建即兴训练失败')
      }

      Taro.showToast({ title: '开始成功', icon: 'success' })
      Taro.navigateTo({
        url: `/training/training-execution?impromptuId=${data.id}&dayIndex=1`
      })
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '开始失败，请稍后再试', icon: 'none' })
    } finally {
      setStarting(false)
    }
  }

  const handleBack = () => {
    Taro.navigateTo({ url: '/pages/index/index' })
  }

  const openActionPicker = (index: number) => {
    setPickingItemIndex(index)
    setShowActionPicker(true)
  }

  return (
    <View className='impromptu-training-page'>
      <View className='page-header'>
        <View className='header-left' onClick={handleBack}>
          <Text className='back-icon'>←</Text>
          <Text className='back-text'>返回训练</Text>
        </View>
        <Text className='page-title'>即兴锻炼</Text>
        <View className='header-placeholder' />
      </View>

      <View className='intro-card'>
        <Text className='intro-title'>先选动作与组次，再进入标准执行页训练</Text>
        <View className='intro-actions'>
          <View className='intro-btn' onClick={() => Taro.navigateTo({ url: '/me/plan-lib/create/index' })}>
            <Text>AI 长期计划</Text>
          </View>
        </View>
      </View>

      <ScrollView scrollY className='page-scroll'>
        <View className='form-card'>
          <View className='form-actions'>
            <View className='btn-add' onClick={appendItem} onKeyDown={() => {}}>
              <Text>+ 添加项目</Text>
            </View>
            <View
              className={`btn-start ${trainingItems.length === 0 || starting || loadingActions ? 'disabled' : ''}`}
              onClick={handleStart}
            >
              <Text>{starting ? '开始中…' : '开始训练'}</Text>
            </View>
          </View>

          {trainingItems.length === 0 && (
            <View className='empty-hint'>
              <Text>暂无训练项，请先添加项目</Text>
            </View>
          )}

          {trainingItems.map((item, idx) => (
            <View key={item.localId} className='training-item'>
              <View className='item-header'>
                <Text className='item-index'>#{idx + 1}</Text>
                <View className='item-action-row'>
                  <View
                    className='action-picker-trigger'
                    onClick={() => openActionPicker(idx)}
                  >
                    <Text className={item.actionId ? 'action-name' : 'action-placeholder'}>
                      {item.actionName || '选择动作'}
                    </Text>
                    <Text className='picker-arrow'>▼</Text>
                  </View>
                  <View className='btn-remove' onClick={() => removeItem(idx)}>
                    <Text>删除</Text>
                  </View>
                </View>
              </View>
              <View className='item-params'>
                <View className='param-row'>
                  <Text className='param-label'>组数</Text>
                  <Input
                    className='param-input'
                    type='number'
                    value={String(item.sets)}
                    onInput={e => handleItemChange(idx, 'sets', parseInt(e.detail.value, 10) || 1)}
                  />
                </View>
                <View className='param-row'>
                  <Text className='param-label'>次数</Text>
                  <Input
                    className='param-input'
                    type='number'
                    value={String(item.reps)}
                    onInput={e => handleItemChange(idx, 'reps', parseInt(e.detail.value, 10) || 1)}
                  />
                </View>
                <View className='param-row'>
                  <Text className='param-label'>休息(秒)</Text>
                  <Input
                    className='param-input'
                    type='number'
                    value={String(item.restSeconds)}
                    onInput={e => handleItemChange(idx, 'restSeconds', parseInt(e.detail.value, 10) || 60)}
                  />
                </View>
                <View className='param-row'>
                  <Text className='param-label'>重量(kg)</Text>
                  <Input
                    className='param-input'
                    type='digit'
                    placeholder='可选'
                    value={item.weight != null ? String(item.weight) : ''}
                    onInput={e => {
                      const v = e.detail.value
                      handleItemChange(idx, 'weight', v === '' ? null : parseFloat(v))
                    }}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {showActionPicker && (
        <View className='action-picker-mask' onClick={() => { setShowActionPicker(false); setPickingItemIndex(null) }}>
          <View className='action-picker-panel' onClick={e => e.stopPropagation()}>
            <Text className='picker-title'>选择动作</Text>
            <ScrollView scrollY className='picker-list'>
              {actions.map(a => (
                <View
                  key={a.id}
                  className='picker-item'
                  onClick={() => pickingItemIndex !== null && handleSelectAction(pickingItemIndex, a)}
                >
                  <Text>{a.name || '未命名'}</Text>
                </View>
              ))}
              {actions.length === 0 && <Text className='picker-empty'>暂无力量动作</Text>}
            </ScrollView>
            <Button size='mini' onClick={() => { setShowActionPicker(false); setPickingItemIndex(null) }}>取消</Button>
          </View>
        </View>
      )}
    </View>
  )
}
