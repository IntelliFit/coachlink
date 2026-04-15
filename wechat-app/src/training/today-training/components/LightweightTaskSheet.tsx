import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import { LightweightTask } from './lightweightTypes'
import { buildLightweightSummary } from '../lib/dayModules'
import './LightweightTaskSheet.scss'

interface LightweightTaskSheetProps {
  visible: boolean
  task: LightweightTask | null
  saving?: boolean
  onClose: () => void
  onSubmit: (payload: {
    dietContent?: string
    cardioDistance?: number | null
    cardioDuration?: number | null
  }) => void
}

function LightweightTaskSheet({ visible, task, saving = false, onClose, onSubmit }: LightweightTaskSheetProps) {
  const [dietContent, setDietContent] = useState('')
  const [cardioDistance, setCardioDistance] = useState<string>('')
  const [cardioDuration, setCardioDuration] = useState<string>('')

  const summaryText = useMemo(() => {
    if (!task) return ''
    return buildLightweightSummary(task).summary
  }, [task])

  useEffect(() => {
    if (!task || !visible) {
      setDietContent('')
      setCardioDistance('')
      setCardioDuration('')
      return
    }

    const firstSet = task.executionItem?.sets?.[0] || {}
    const customData = task.customData || {}

    setDietContent(String(firstSet?.diet_content || customData?.content || '').trim())
    setCardioDistance(
      firstSet?.actual_distance || customData?.distance
        ? `${Number(firstSet?.actual_distance || customData?.distance) / 1000}`
        : ''
    )
    setCardioDuration(
      firstSet?.actual_duration || customData?.duration
        ? `${Math.round(Number(firstSet?.actual_duration || customData?.duration) / 60)}`
        : ''
    )
  }, [task, visible])

  if (!visible || !task) return null

  const handleSubmit = () => {
    if (task.itemType === 'CARDIO') {
      const distance = cardioDistance.trim() ? Number(cardioDistance.trim()) : null
      const duration = cardioDuration.trim() ? Number(cardioDuration.trim()) : null
      onSubmit({
        cardioDistance: Number.isFinite(distance as number) ? distance : null,
        cardioDuration: Number.isFinite(duration as number) ? duration : null
      })
      return
    }

    if (task.itemType === 'DIET') {
      onSubmit({ dietContent: dietContent.trim() })
      return
    }

    onSubmit({})
  }

  return (
    <View className='lightweight-sheet-mask' onClick={onClose}>
      <View className='lightweight-sheet-panel' onClick={(e) => e.stopPropagation()}>
        <Text className='sheet-title'>{task.title}</Text>
        <Text className='sheet-summary'>{summaryText}</Text>
        {task.noteText && (
          <View className='sheet-tip note'>
            <Text>{task.noteText}</Text>
          </View>
        )}
        {task.detailText && (
          <View className='sheet-tip'>
            <Text>{task.detailText}</Text>
          </View>
        )}

        {task.itemType === 'DIET' && (
          <View className='sheet-field'>
            <Text className='field-label'>饮食记录</Text>
            <Input
              className='field-input'
              value={dietContent}
              placeholder='例：鸡胸肉 + 西蓝花 + 米饭'
              onInput={(e) => setDietContent(e.detail.value)}
            />
          </View>
        )}

        {task.itemType === 'CARDIO' && (
          <View className='sheet-field-row'>
            <View className='sheet-field'>
              <Text className='field-label'>距离(km)</Text>
              <Input
                type='digit'
                className='field-input'
                value={cardioDistance}
                placeholder='可选'
                onInput={(e) => setCardioDistance(e.detail.value)}
              />
            </View>
            <View className='sheet-field'>
              <Text className='field-label'>时长(分钟)</Text>
              <Input
                type='number'
                className='field-input'
                value={cardioDuration}
                placeholder='可选'
                onInput={(e) => setCardioDuration(e.detail.value)}
              />
            </View>
          </View>
        )}

        {task.itemType === 'HABIT' && (
          <View className='sheet-tip'>
            <Text>完成后会记录为习惯打卡。</Text>
          </View>
        )}

        <View className='sheet-actions'>
          <View className='sheet-btn secondary' onClick={onClose}>
            <Text>取消</Text>
          </View>
          <View className={`sheet-btn primary ${saving ? 'disabled' : ''}`} onClick={handleSubmit}>
            <Text>{saving ? '提交中...' : task.isCompleted ? '更新记录' : '完成打卡'}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

export default LightweightTaskSheet
