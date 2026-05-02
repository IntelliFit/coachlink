import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { impromptuService, ImpromptuActionInput } from '@/services/impromptuService'
import { studentActionLibService } from '@/services/studentActionLibService'
import { authService } from '@/services/authService'
import type { ItemType, StudentActionRow } from '@/types/action'
import './index.scss'

interface TrainingItem {
  localId: string
  actionId: string
  actionName: string
  itemType: ItemType
  sets: number
  reps: number
  restSeconds: number
  weight: number | null
}

const DEFAULT_SETS = 4
const DEFAULT_REPS = 8
const DEFAULT_REST = 90
const ITEM_TYPE_OPTIONS: Array<{ value: ItemType; label: string; hint: string }> = [
  { value: 'STRENGTH', label: '力量', hint: '记录组数、次数、重量和休息。' },
  { value: 'CARDIO', label: '有氧', hint: '先加入动作，执行页再填写距离或时长。' },
  { value: 'DIET', label: '饮食', hint: '先加入条目，执行页再记录饮食内容。' },
  { value: 'HABIT', label: '习惯', hint: '先加入习惯项，执行页再完成打卡。' }
]

const createTrainingItem = (itemType: ItemType = 'STRENGTH'): TrainingItem => ({
  localId: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  actionId: '',
  actionName: '',
  itemType,
  sets: itemType === 'STRENGTH' ? DEFAULT_SETS : 1,
  reps: itemType === 'STRENGTH' ? DEFAULT_REPS : 0,
  restSeconds: itemType === 'STRENGTH' ? DEFAULT_REST : 0,
  weight: null
})

const clampPositiveInt = (value: string, fallback: number) => {
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const getItemTypeLabel = (itemType: ItemType) =>
  ITEM_TYPE_OPTIONS.find((option) => option.value === itemType)?.label || '力量'

const getItemTypeHint = (itemType: ItemType) =>
  ITEM_TYPE_OPTIONS.find((option) => option.value === itemType)?.hint || ITEM_TYPE_OPTIONS[0].hint

const buildTrainingItemFromAction = (
  action: StudentActionRow,
  params?: Record<string, unknown>,
  itemTypeOverride?: ItemType,
  localId?: string
): TrainingItem => {
  const itemType = itemTypeOverride || action.type || 'STRENGTH'
  const sets = itemType === 'STRENGTH'
    ? Math.max(1, Number(params?.['缁勬暟'] || params?.sets || 3))
    : 1
  const reps = itemType === 'STRENGTH'
    ? Math.max(1, Number(params?.['娆℃暟'] || params?.reps || 10))
    : 0
  const restSeconds = itemType === 'STRENGTH'
    ? Math.max(0, Number(params?.['浼戞伅鏃堕棿'] || params?.rest_seconds || 90))
    : 0
  const loadRaw = params?.load
  const weight = itemType === 'STRENGTH' && loadRaw !== undefined && loadRaw !== null && loadRaw !== ''
    ? Number(loadRaw)
    : null

  return {
    localId: localId || `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actionId: action.id,
    actionName: action.name,
    itemType,
    sets,
    reps,
    restSeconds,
    weight: Number.isFinite(weight) ? weight : null
  }
}

export default function ImpromptuTraining() {
  const [actions, setActions] = useState<StudentActionRow[]>([])
  const [loadingActions, setLoadingActions] = useState(true)
  const [trainingItems, setTrainingItems] = useState<TrainingItem[]>([createTrainingItem('STRENGTH')])
  const [starting, setStarting] = useState(false)
  const [showActionPicker, setShowActionPicker] = useState(false)
  const [pickingItemIndex, setPickingItemIndex] = useState<number | null>(null)
  const [pickerKeyword, setPickerKeyword] = useState('')
  const [scrollIntoId, setScrollIntoId] = useState('')

  const loadActions = useCallback(async () => {
    try {
      setLoadingActions(true)
      let bootstrapRecommendedIds: string[] = []
      let bootstrapWorkoutDraft: Array<{
        actionId: string
        itemType: ItemType
        params?: Record<string, unknown>
      }> = []

      try {
        const bootstrapRes = await studentActionLibService.bootstrapFromProfile({
          minActions: 8,
          importLimit: 10
        })
        bootstrapRecommendedIds = bootstrapRes?.recommendedActionIds || []
        bootstrapWorkoutDraft = (bootstrapRes?.workoutDraft || []) as typeof bootstrapWorkoutDraft
      } catch (bootstrapError) {
        console.warn('bootstrap from profile failed:', bootstrapError)
      }

      const res = await studentActionLibService.listActions({ page: 1, limit: 1000 })
      const loadedActions = ((res?.actions || []) as StudentActionRow[]).map((action) => ({
        ...action,
        type: action.type || 'STRENGTH'
      }))
      setActions(loadedActions)

      if (loadedActions.length > 0) {
        setTrainingItems((prev) => {
          const shouldAutofill = prev.length === 1 && !prev[0]?.actionId
          if (!shouldAutofill) return prev

          if (bootstrapWorkoutDraft.length > 0) {
            const draftItems = bootstrapWorkoutDraft
              .map((draft, index) => {
                const matched = loadedActions.find((action) => action.id === draft.actionId)
                if (!matched) return null
                return buildTrainingItemFromAction(matched, draft.params, draft.itemType, `item-${Date.now()}-${index}`)
              })
              .filter((item): item is TrainingItem => !!item)
              .slice(0, 5)

            if (draftItems.length > 0) {
              return draftItems
            }
          }

          const preferred = (bootstrapRecommendedIds.length > 0
            ? loadedActions.filter((action) => bootstrapRecommendedIds.includes(action.id))
            : loadedActions
          ).slice(0, 3)

          if (preferred.length > 0) {
            return preferred.map((action, index) => buildTrainingItemFromAction(action, undefined, action.type || 'STRENGTH', `item-${Date.now()}-${index}`))
          }

          return prev
        })
      }
    } catch (error) {
      console.error('load impromptu actions failed:', error)
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
    void loadActions()
  }, [loadActions])

  const appendItem = useCallback((itemType: ItemType = 'STRENGTH') => {
    setTrainingItems((prev) => [...prev, createTrainingItem(itemType)])
  }, [])

  const removeItem = useCallback((index: number) => {
    setTrainingItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
  }, [])

  const handleItemChange = useCallback((index: number, patch: Partial<TrainingItem>) => {
    setTrainingItems((prev) => prev.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    )))
  }, [])

  const handleSwitchItemType = useCallback((index: number, itemType: ItemType) => {
    setTrainingItems((prev) => prev.map((item, itemIndex) => (
      itemIndex === index
        ? {
            ...createTrainingItem(itemType),
            localId: item.localId
          }
        : item
    )))
  }, [])

  const openActionPicker = useCallback((index: number) => {
    setPickingItemIndex(index)
    setPickerKeyword('')
    setShowActionPicker(true)
  }, [])

  const handleSelectAction = useCallback((action: StudentActionRow) => {
    if (pickingItemIndex === null) return
    handleItemChange(pickingItemIndex, {
      actionId: action.id,
      actionName: action.name
    })
    setShowActionPicker(false)
    setPickingItemIndex(null)
    Taro.showToast({ title: `已选择 ${action.name}`, icon: 'success' })
  }, [handleItemChange, pickingItemIndex])

  const pickerItemType = pickingItemIndex !== null
    ? trainingItems[pickingItemIndex]?.itemType || 'STRENGTH'
    : 'STRENGTH'

  const filteredActions = useMemo(() => {
    const keyword = pickerKeyword.trim().toLowerCase()
    return actions
      .filter((action) => {
        const actionType = action.type || 'STRENGTH'
        if (pickerItemType === 'STRENGTH') {
          return actionType === 'STRENGTH'
        }
        return actionType === pickerItemType
      })
      .filter((action) => String(action.name || '').toLowerCase().includes(keyword))
      .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'zh-CN'))
  }, [actions, pickerItemType, pickerKeyword])

  const handleStart = useCallback(async () => {
    const invalidItem = trainingItems.find((item) => !item.actionId)
    if (invalidItem) {
      Taro.showToast({ title: '请先为所有项目选择动作', icon: 'none' })
      return
    }

    setStarting(true)
    try {
      const payload: ImpromptuActionInput[] = trainingItems.map((item) => {
        const action = actions.find((candidate) => candidate.id === item.actionId)
        const isStrength = (item.itemType || 'STRENGTH') === 'STRENGTH'
        return {
          actionId: item.actionId,
          actionName: action?.name || item.actionName || '未命名动作',
          sets: isStrength ? item.sets : 1,
          reps: isStrength ? item.reps : null,
          weight: isStrength ? item.weight : null,
          restSeconds: isStrength ? item.restSeconds : 0
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
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '开始失败，请稍后再试', icon: 'none' })
    } finally {
      setStarting(false)
    }
  }, [actions, trainingItems])

  const handleBack = useCallback(() => {
    Taro.navigateTo({ url: '/pages/index/index' })
  }, [])

  const scrollToForm = useCallback(() => {
    setScrollIntoId('impromptu-form-anchor')
    setTimeout(() => setScrollIntoId(''), 120)
  }, [])

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
        <View className='intro-copy'>
          <Text className='intro-title'>先选动作与条目，再进入标准执行页训练。</Text>
          <Text className='intro-subtitle'>力量、有氧、饮食、习惯都可以混排，和网站即兴页保持一致。</Text>
        </View>
        <View className='intro-actions'>
          <View className='intro-btn intro-btn-outline' onClick={scrollToForm}>
            <Text>继续即兴</Text>
          </View>
          <View className='intro-btn intro-btn-primary' onClick={() => Taro.navigateTo({ url: '/me/plan-lib/create/index' })}>
            <Text>AI 长期计划</Text>
          </View>
        </View>
      </View>

      <ScrollView scrollY className='page-scroll' scrollIntoView={scrollIntoId}>
        <View id='impromptu-form-anchor' className='form-card'>
          <View className='form-actions'>
            <View className='btn-add' onClick={() => appendItem('STRENGTH')}>
              <Text>+ 添加项目</Text>
            </View>
            <View
              className={`btn-start ${trainingItems.length === 0 || starting || loadingActions ? 'disabled' : ''}`}
              onClick={handleStart}
            >
              <Text>{starting ? '开始中...' : '开始训练'}</Text>
            </View>
          </View>

          {trainingItems.length === 0 && (
            <View className='empty-hint'>
              <Text>暂时还没有项目，先添加一个动作吧。</Text>
            </View>
          )}

          {trainingItems.map((item, index) => {
            const isStrength = item.itemType === 'STRENGTH'
            return (
              <View key={item.localId} className='training-item'>
                <View className='item-header'>
                  <View className='item-header-main'>
                    <Text className='item-index'>#{index + 1}</Text>
                    <View className='item-title-group'>
                      <Text className='item-title'>{item.actionName || '选择动作'}</Text>
                      <Text className='item-subtitle'>{getItemTypeLabel(item.itemType)}</Text>
                    </View>
                  </View>
                  <View className='btn-remove' onClick={() => removeItem(index)}>
                    <Text>删除</Text>
                  </View>
                </View>

                <View className='type-switcher'>
                  {ITEM_TYPE_OPTIONS.map((option) => (
                    <View
                      key={option.value}
                      className={`type-chip ${item.itemType === option.value ? 'active' : ''}`}
                      onClick={() => handleSwitchItemType(index, option.value)}
                    >
                      <Text>{option.label}</Text>
                    </View>
                  ))}
                </View>

                <View className='action-picker-trigger' onClick={() => openActionPicker(index)}>
                  <View className='action-picker-copy'>
                    <Text className={item.actionId ? 'action-name' : 'action-placeholder'}>
                      {item.actionName || `选择${getItemTypeLabel(item.itemType)}动作`}
                    </Text>
                    <Text className='action-hint'>{getItemTypeHint(item.itemType)}</Text>
                  </View>
                  <Text className='picker-arrow'>▾</Text>
                </View>

                {isStrength ? (
                  <View className='item-params'>
                    <View className='param-row'>
                      <Text className='param-label'>组数</Text>
                      <Input
                        className='param-input'
                        type='number'
                        value={String(item.sets)}
                        onInput={(e) => handleItemChange(index, { sets: clampPositiveInt(e.detail.value, 1) })}
                      />
                    </View>
                    <View className='param-row'>
                      <Text className='param-label'>次数</Text>
                      <Input
                        className='param-input'
                        type='number'
                        value={String(item.reps)}
                        onInput={(e) => handleItemChange(index, { reps: clampPositiveInt(e.detail.value, 1) })}
                      />
                    </View>
                    <View className='param-row'>
                      <Text className='param-label'>休息(秒)</Text>
                      <Input
                        className='param-input'
                        type='number'
                        value={String(item.restSeconds)}
                        onInput={(e) => handleItemChange(index, { restSeconds: Math.max(0, clampPositiveInt(e.detail.value, 0)) })}
                      />
                    </View>
                    <View className='param-row'>
                      <Text className='param-label'>重量(kg)</Text>
                      <Input
                        className='param-input'
                        type='digit'
                        placeholder='可选'
                        value={item.weight != null ? String(item.weight) : ''}
                        onInput={(e) => {
                          const value = e.detail.value.trim()
                          handleItemChange(index, { weight: value === '' ? null : Number(value) })
                        }}
                      />
                    </View>
                  </View>
                ) : (
                  <View className='lightweight-hint'>
                    <Text>这类项目会在执行页单独填写实际内容，不需要现在录入组数和重量。</Text>
                  </View>
                )}
              </View>
            )
          })}
        </View>
      </ScrollView>

      {showActionPicker && (
        <View className='action-picker-mask' onClick={() => { setShowActionPicker(false); setPickingItemIndex(null) }}>
          <View className='action-picker-panel' onClick={(e) => e.stopPropagation()}>
            <Text className='picker-title'>选择{getItemTypeLabel(pickerItemType)}动作</Text>
            <Input
              className='picker-search-input'
              value={pickerKeyword}
              placeholder='搜索动作'
              onInput={(e) => setPickerKeyword(e.detail.value)}
            />
            <ScrollView scrollY className='picker-list'>
              {filteredActions.map((action) => (
                <View
                  key={action.id}
                  className='picker-item'
                  onClick={() => handleSelectAction(action)}
                >
                  <Text className='picker-item-title'>{action.name || '未命名动作'}</Text>
                  <Text className='picker-item-type'>{getItemTypeLabel(action.type || 'STRENGTH')}</Text>
                </View>
              ))}
              {filteredActions.length === 0 && (
                <Text className='picker-empty'>没有找到匹配动作</Text>
              )}
            </ScrollView>
            <Button size='mini' onClick={() => { setShowActionPicker(false); setPickingItemIndex(null) }}>取消</Button>
          </View>
        </View>
      )}
    </View>
  )
}
