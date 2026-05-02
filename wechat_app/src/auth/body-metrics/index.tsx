import React, { useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import WheelPicker from '@/components/WheelPicker'
import './index.scss'

interface BodyMetricsPageProps {}

const HEIGHT_MIN = 100
const HEIGHT_MAX = 250
const WEIGHT_MIN = 30
const WEIGHT_MAX = 200
const WEIGHT_STEP = 0.5

const BodyMetricsPage: React.FC<BodyMetricsPageProps> = () => {
  const params = Taro.getCurrentInstance().router?.params as any
  const returnUrl = params?.returnUrl || '/auth/student-onboarding'
  const initialHeight = Number(params?.height || 170)
  const initialWeight = Number(params?.weight || 65)

  const heightItems = useMemo(() => {
    const arr: string[] = []
    for (let h = HEIGHT_MIN; h <= HEIGHT_MAX; h++) {
      arr.push(`${h} cm`)
    }
    return arr
  }, [])

  const weightItems = useMemo(() => {
    const arr: string[] = []
    for (let w = WEIGHT_MIN; w <= WEIGHT_MAX; w += WEIGHT_STEP) {
      arr.push(`${w.toFixed(1)} kg`)
    }
    return arr
  }, [])

  const [heightIndex, setHeightIndex] = useState(() => {
    const idx = initialHeight - HEIGHT_MIN
    return Math.max(0, Math.min(idx, heightItems.length - 1))
  })

  const [weightIndex, setWeightIndex] = useState(() => {
    const idx = Math.round((initialWeight - WEIGHT_MIN) / WEIGHT_STEP)
    return Math.max(0, Math.min(idx, weightItems.length - 1))
  })

  const selectedHeight = HEIGHT_MIN + heightIndex
  const selectedWeight = Number((WEIGHT_MIN + weightIndex * WEIGHT_STEP).toFixed(1))

  const handleConfirm = () => {
    Taro.eventCenter.trigger('onboarding:bodyMetrics', { height: selectedHeight, weight: selectedWeight })
    Taro.navigateBack()
  }

  return (
    <View className='body-metrics-page'>
      <View className='bm-header'>
        <View className='bm-step-dots'>
          <View className='bm-step-dot' />
          <View className='bm-step-dot bm-step-dot--active' />
          <View className='bm-step-dot' />
        </View>
        <Text className='bm-title'>身体数据</Text>
        <Text className='bm-desc'>选择你的身高和体重，推荐计划会更精准。</Text>
      </View>

      <View className='bm-preview'>
        <View className='bm-preview-card'>
          <Text className='bm-preview-label'>身高</Text>
          <Text className='bm-preview-value'>{selectedHeight}</Text>
          <Text className='bm-preview-unit'>cm</Text>
        </View>
        <View className='bm-preview-card'>
          <Text className='bm-preview-label'>体重</Text>
          <Text className='bm-preview-value'>{selectedWeight}</Text>
          <Text className='bm-preview-unit'>kg</Text>
        </View>
      </View>

      <View className='bm-pickers'>
        <View className='bm-picker-col'>
          <Text className='bm-picker-label'>身高</Text>
          <WheelPicker
            items={heightItems}
            selectedIndex={heightIndex}
            onChange={setHeightIndex}
            indicatorStyle='height: 80rpx; background: rgba(207, 109, 78, 0.08); border-radius: 16rpx;'
          />
        </View>
        <View className='bm-picker-divider' />
        <View className='bm-picker-col'>
          <Text className='bm-picker-label'>体重</Text>
          <WheelPicker
            items={weightItems}
            selectedIndex={weightIndex}
            onChange={setWeightIndex}
            indicatorStyle='height: 80rpx; background: rgba(207, 109, 78, 0.08); border-radius: 16rpx;'
          />
        </View>
      </View>

      <View className='bm-footer'>
        <View className='bm-btn' onClick={handleConfirm}>
          <Text className='bm-btn-text'>确认</Text>
        </View>
      </View>
    </View>
  )
}

export default BodyMetricsPage
