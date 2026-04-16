import React from 'react'
import { View, Text } from '@tarojs/components'
import { LightweightTask } from './lightweightTypes'
import { ArrowUp, Check, Heart, More } from '@nutui/icons-react-taro'
import './LightweightTaskSection.scss'

interface LightweightTaskSectionProps {
  tasks: LightweightTask[]
  onOpenTask: (task: LightweightTask) => void
  onAddTask?: () => void
  onDeleteTask?: (task: LightweightTask) => void
}

const TYPE_ICON: Record<string, string> = {
  DIET: 'Heart',
  CARDIO: 'ArrowUp',
  HABIT: 'Check'
}

function LightweightTaskSection({ tasks, onOpenTask, onAddTask, onDeleteTask }: LightweightTaskSectionProps) {
  const completedCount = tasks.filter((task) => task.isCompleted).length

  return (
    <View className='lightweight-section'>
      <View className='lightweight-header'>
        <View>
          <Text className='lightweight-title'>轻任务</Text>
          <Text className='lightweight-subtitle'>饮食 / 有氧 / 习惯可独立打卡</Text>
        </View>
        <View className='lightweight-summary'>
          <Text>{completedCount}/{tasks.length || 0}</Text>
        </View>
      </View>

      {tasks.length === 0 ? (
        <View className='lightweight-empty'>
          <Text className='empty-title'>当日还没有轻任务</Text>
          <Text className='empty-desc'>可在动作库中新增饮食、有氧、习惯任务</Text>
          {onAddTask && (
            <View className='empty-add-btn' onClick={onAddTask}>
              <Text>+ 新增轻任务</Text>
            </View>
          )}
        </View>
      ) : (
        <View className='task-list'>
          {tasks.map((task) => (
            <View key={task.key} className={`task-card ${task.isCompleted ? 'done' : ''}`}>
              <View className='task-main' onClick={() => onOpenTask(task)}>
                {(() => { const Icon = require("@nutui/icons-react-taro")[TYPE_ICON[task.itemType] || 'More']; return <Icon size={18} />; })()}
                <View className='task-content'>
                  <Text className='task-title'>{task.title}</Text>
                  <Text className='task-summary'>{task.summary}</Text>
                </View>
                <View className={`task-badge ${task.isCompleted ? 'done' : 'todo'}`}>
                  <Text>{task.isCompleted ? '已完成' : '待打卡'}</Text>
                </View>
              </View>

              <View className='task-actions'>
                <View className='task-open-btn' onClick={() => onOpenTask(task)}>
                  <Text>{task.isCompleted ? '查看' : '去打卡'}</Text>
                </View>
                {task.isStudentExtra && onDeleteTask && (
                  <View className='task-delete-btn' onClick={() => onDeleteTask(task)}>
                    <Text>删除</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {tasks.length > 0 && onAddTask && (
        <View className='lightweight-add-btn' onClick={onAddTask}>
          <Text>+ 新增轻任务</Text>
        </View>
      )}
    </View>
  )
}

export default LightweightTaskSection
