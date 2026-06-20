import React, { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Clock, Heart, Location, Power, Star, Target } from '@nutui/icons-react-taro'
import './RestDayCard.scss'

interface RestDayCardProps {
  dayIndex: number
}

function RestDayCard({ dayIndex }: RestDayCardProps) {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <>
      <View className='rest-day-card'>
        <View className='rest-main'>
          <View className='rest-hero'>
            <Text className='rest-emoji'><Heart size={40} /></Text>
          </View>
          <View className='rest-title-row'>
            <Text className='rest-title'>今日休息日</Text>
            <View className='rest-info-btn' onClick={() => setShowInfo(true)}>
              <Text>i</Text>
            </View>
          </View>
          <Text className='rest-subtitle'>休息不是懒惰，而是成长的必经之路</Text>
          <Text className='rest-desc'>
            第 {dayIndex} 天是恢复日。休息日会自动顺延；到训练日会停住，直到你完成/跳过（确认后才继续推进）。
          </Text>
          <Text className='rest-quote'>"强者懂得何时发力，智者懂得何时休息"</Text>
        </View>

        <View className='rest-tips'>
          <View className='tips-title-row'>
            <Star size={14} color='#9a3412' />
            <Text className='tips-title'>休息日行动指南</Text>
          </View>
          <View className='tips-grid'>
            <View className='tip-item'>
              <Text className='tip-icon'><Clock size={14} /></Text>
              <Text className='tip-text'>充足睡眠 7-9 小时</Text>
            </View>
            <View className='tip-item'>
              <Text className='tip-icon'><Heart size={14} /></Text>
              <Text className='tip-text'>补足蛋白和碳水</Text>
            </View>
            <View className='tip-item'>
              <Text className='tip-icon'><Location size={14} /></Text>
              <Text className='tip-text'>散步、瑜伽、拉伸</Text>
            </View>
            <View className='tip-item'>
              <Text className='tip-icon'><Heart size={14} /></Text>
              <Text className='tip-text'>补水 2-3 升</Text>
            </View>
          </View>
        </View>
      </View>

      {showInfo && (
        <View className='rest-info-mask' onClick={() => setShowInfo(false)}>
          <View className='rest-info-dialog' onClick={(e) => e.stopPropagation()}>
            <Text className='dialog-title'>为什么休息如此重要？</Text>
            <View className='dialog-grid'>
              <View className='dialog-card'>
                <Text className='dialog-icon'><Power size={12} /></Text>
                <Text className='dialog-card-title'>肌肉重建</Text>
                <Text className='dialog-card-text'>训练撕裂肌肉纤维，休息时肌肉修复并超量恢复。</Text>
              </View>
              <View className='dialog-card'>
                <Text className='dialog-icon'><Power size={24} /></Text>
                <Text className='dialog-card-title'>能量储备</Text>
                <Text className='dialog-card-text'>补充肌糖原储备，为下次训练爆发重新蓄力。</Text>
              </View>
              <View className='dialog-card'>
                <Text className='dialog-icon'><Target size={24} /></Text>
                <Text className='dialog-card-title'>神经修复</Text>
                <Text className='dialog-card-text'>中枢神经系统恢复后，动作质量和长期进步都会更稳。</Text>
              </View>
            </View>
            <View className='dialog-foot'>
              <Text className='dialog-foot-title'>今天可以这样做</Text>
              <Text className='dialog-foot-text'>睡眠、补水、拉伸、散步、营养补充，都是训练计划的一部分。</Text>
            </View>
            <View className='dialog-close' onClick={() => setShowInfo(false)}>
              <Text>我知道了</Text>
            </View>
          </View>
        </View>
      )}
    </>
  )
}

export default RestDayCard
