import React, { useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Calendar } from '@nutui/icons-react-taro'
import {
  buildDayModuleModel,
  buildLightweightSummary,
  buildStrengthMeta,
  ExecutionStatus,
  formatPlanDayLabel,
  NormalizedDayTask,
  resolvePlanDayDate
} from '../lib/dayModules'
import './TodayTrainingCard.scss'

interface TodayTrainingCardProps {
  day: any
  actions: Record<string, any>
  instanceId: string
  dayIndex: number
  coachId?: string
  coachName?: string
  executionStatus?: ExecutionStatus
  execution?: any
  heading?: string
  subheading?: string
  dateLabel?: string | null
  dateMeta?: {
    delayDays?: number
    originalDateLabel?: string | null
  } | null
  onOpenLightweightTask?: (task: NormalizedDayTask) => void
  onAddLightweightTask?: () => void
  onDeleteLightweightTask?: (task: NormalizedDayTask) => void
}

function TodayTrainingCard({
  day,
  actions,
  instanceId,
  dayIndex,
  coachId,
  coachName,
  executionStatus = 'none',
  execution,
  heading = '今日安排',
  subheading,
  dateLabel,
  dateMeta,
  onOpenLightweightTask,
  onAddLightweightTask,
  onDeleteLightweightTask
}: TodayTrainingCardProps) {
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [showAllStrengthTasks, setShowAllStrengthTasks] = useState(false)
  const [infoTask, setInfoTask] = useState<NormalizedDayTask | null>(null)

  const moduleModel = useMemo(
    () =>
      buildDayModuleModel({
        day,
        actions,
        execution,
        executionStatus
      }),
    [day, actions, execution, executionStatus]
  )

  const {
    strengthTasks,
    lightweightTasks,
    lightweightGroups,
    moduleCount,
    completedModuleCount,
    remainingModuleCount,
    dayCompleted,
    trainingCompleted,
    trainingInProgress,
    strengthCompletedSetCount,
    strengthTotalSetCount,
    lightweightCompletedCount
  } = moduleModel

  const previewGroups = useMemo(() => {
    if (showAllTasks) return lightweightGroups
    const maxCards = 4
    let used = 0
    return lightweightGroups
      .map((group) => {
        if (used >= maxCards) return { ...group, items: [] }
        const remain = maxCards - used
        const nextItems = group.items.slice(0, remain)
        used += nextItems.length
        return { ...group, items: nextItems }
      })
      .filter((group) => group.items.length > 0)
  }, [lightweightGroups, showAllTasks])

  const lightweightHiddenCount = Math.max(
    0,
    lightweightTasks.length - previewGroups.reduce((sum, group) => sum + group.items.length, 0)
  )
  const visibleStrengthTasks = useMemo(() => {
    const previewLimit = 6
    return showAllStrengthTasks ? strengthTasks : strengthTasks.slice(0, previewLimit)
  }, [showAllStrengthTasks, strengthTasks])
  const hiddenStrengthTaskCount = Math.max(0, strengthTasks.length - visibleStrengthTasks.length)

  const openExecution = (focusAction?: number) => {
    const coachQuery = coachId
      ? `&coachId=${encodeURIComponent(coachId)}${coachName ? `&coachName=${encodeURIComponent(coachName)}` : ''}`
      : ''
    const focusQuery = typeof focusAction === 'number' ? `&focusAction=${focusAction}` : ''
    Taro.navigateTo({
      url: `/training/training-execution?instanceId=${instanceId}&dayIndex=${dayIndex}${coachQuery}${focusQuery}`
    }).catch(() => {
      Taro.showToast({
        title: '跳转失败',
        icon: 'none'
      })
    })
  }

  const handleOpenTask = (task: NormalizedDayTask) => {
    if (onOpenLightweightTask) {
      onOpenLightweightTask(task)
      return
    }
    openExecution(task.executionIndex)
  }

  const displayDateLabel =
    dateLabel ||
    formatPlanDayLabel(
      resolvePlanDayDate({
        dayIndex
      })
    )
  const headerSubtitle = subheading || `第${dayIndex}天 · ${moduleCount} 个任务模块`

  return (
    <>
      <View className={`training-card ${dayCompleted ? 'day-completed' : ''}`}>
        <View className='card-head'>
          <View className='head-copy'>
            {displayDateLabel && (
              <View className='date-row'>
                <Text className='date-icon'><Calendar size={20} /></Text>
                <Text className='date-text'>{displayDateLabel}</Text>
              </View>
            )}
            <Text className='card-title'>{heading}</Text>
            <Text className='card-subtitle'>{headerSubtitle}</Text>
            {!!dateMeta?.delayDays && dateMeta.delayDays > 0 && (
              <View className='delay-banner'>
                <Text className='delay-banner-title'>已顺延 {dateMeta.delayDays} 天</Text>
                {!!dateMeta?.originalDateLabel && (
                  <Text className='delay-banner-desc'>原计划 {dateMeta.originalDateLabel}</Text>
                )}
              </View>
            )}
          </View>

          <View className='head-metrics'>
            <View className='metric-card'>
              <Text className='metric-label'>训练打卡</Text>
              <Text className='metric-value'>
                {strengthTasks.length === 0
                  ? '今日无力量训练'
                  : trainingCompleted
                    ? '已完成'
                    : trainingInProgress
                      ? '进行中'
                      : '待开始'}
              </Text>
            </View>
            <View className='metric-card success'>
              <Text className='metric-label'>今日安排</Text>
              <Text className='metric-value'>
                {moduleCount === 0 ? '暂无任务' : dayCompleted ? '已打卡完成' : `${completedModuleCount}/${moduleCount} 模块`}
              </Text>
            </View>
            <View className='metric-card'>
              <Text className='metric-label'>总模块</Text>
              <Text className='metric-value numeric'>{moduleCount}</Text>
            </View>
            <View className='metric-card primary'>
              <Text className='metric-label'>剩余</Text>
              <Text className='metric-value numeric'>{remainingModuleCount}</Text>
            </View>
          </View>
        </View>

        {dayCompleted && (
          <View className='done-banner'>
            <Text className='done-title'>今日安排已完成</Text>
            <Text className='done-desc'>力量训练和轻量任务都已记录完成，稍后也可以回看训练和打卡记录。</Text>
          </View>
        )}

        {strengthTasks.length > 0 && (
          <View className='strength-panel'>
            <View className='panel-top'>
              <View className='panel-copy'>
                <View className='panel-tag'>
                  <Text>训练模块</Text>
                  <Text>STRENGTH</Text>
                </View>
                <View className='panel-title-row'>
                  <Text className='panel-title'>连续力量训练</Text>
                  <View
                    className={`panel-status ${
                      trainingCompleted ? 'completed' : trainingInProgress ? 'in-progress' : 'pending'
                    }`}
                  >
                    <Text>{trainingCompleted ? '已完成' : trainingInProgress ? '进行中' : '待开始'}</Text>
                  </View>
                </View>
                <Text className='panel-desc'>
                  力量训练进入专门执行页，集中处理重量、次数、RPE、休息、视频与 PR 记录。
                </Text>
              </View>

              <View className='strength-stats'>
                <View className='strength-stat'>
                  <Text className='stat-label'>动作</Text>
                  <Text className='stat-value'>{strengthTasks.length}</Text>
                </View>
                <View className='strength-stat'>
                  <Text className='stat-label'>计划组数</Text>
                  <Text className='stat-value'>{strengthTotalSetCount}</Text>
                </View>
                <View className='strength-stat'>
                  <Text className='stat-label'>完成进度</Text>
                  <Text className='stat-value'>
                    {strengthCompletedSetCount}/{strengthTotalSetCount}
                  </Text>
                </View>
              </View>
            </View>

            <View className='strength-list'>
              {visibleStrengthTasks.map((task) => {
                const meta = buildStrengthMeta(task)
                return (
                  <View key={`${task.index}-${task.title}`} className='strength-item' onClick={() => openExecution(task.executionIndex)}>
                    <View className='strength-item-main'>
                      <Text className='strength-item-title'>{task.title}</Text>
                      <Text className='strength-item-meta'>
                        {meta.summary}
                        {meta.loadText ? ` · ${meta.loadText}` : ''}
                        {meta.restText ? ` · ${meta.restText}` : ''}
                      </Text>
                    </View>
                    {task.noteText && <Text className='strength-item-note'>{task.noteText}</Text>}
                  </View>
                )
              })}
            </View>

            {strengthTasks.length > 6 && (
              <View className='strength-toggle' onClick={() => setShowAllStrengthTasks((prev) => !prev)}>
                <Text>
                  {showAllStrengthTasks
                    ? '收起训练动作'
                    : `展开查看全部训练动作${hiddenStrengthTaskCount > 0 ? `（还有 ${hiddenStrengthTaskCount} 项）` : ''}`}
                </Text>
              </View>
            )}

            <View className='strength-actions'>
              <View
                className={`main-action-btn ${
                  trainingCompleted ? 'ghost' : trainingInProgress ? 'warning' : 'success'
                }`}
                onClick={() => openExecution()}
              >
                <Text>{trainingCompleted ? '查看训练记录' : trainingInProgress ? '继续训练' : '开始训练'}</Text>
              </View>
              <View className='strength-tip'>
                <Text>这里的主按钮只代表力量训练打卡；轻量任务在下方单独记录，但会一起汇总到今日安排进度。</Text>
              </View>
            </View>
          </View>
        )}

        {(lightweightTasks.length > 0 || onAddLightweightTask) && (
          <View className='lightweight-panel'>
            <View className='lightweight-header'>
              <View>
                <Text className='lightweight-title'>轻量任务</Text>
                <Text className='lightweight-subtitle'>饮食、有氧和习惯单独执行，完成后会立即回写到当天进度。</Text>
              </View>
              <View className='lightweight-header-right'>
                {lightweightTasks.length > 0 && (
                  <Text className='lightweight-progress'>
                    {lightweightCompletedCount}/{lightweightTasks.length} 已完成
                  </Text>
                )}
                {onAddLightweightTask && (
                  <View className='lightweight-add-small' onClick={onAddLightweightTask}>
                    <Text>新增轻任务</Text>
                  </View>
                )}
              </View>
            </View>

            {lightweightTasks.length === 0 ? (
              <View className='lightweight-empty'>
                <Text className='empty-title'>这一天还没有轻任务</Text>
                <Text className='empty-desc'>可以从你的动作库里追加饮食、有氧或习惯任务，单独记录，不影响力量训练页结构。</Text>
                {onAddLightweightTask && (
                  <View className='empty-action' onClick={onAddLightweightTask}>
                    <Text>去新增轻任务</Text>
                  </View>
                )}
              </View>
            ) : (
              <>
                {previewGroups.map((group) => (
                  <View key={group.slot} className='lightweight-group'>
                    <View className='group-divider'>
                      <View className='divider-line' />
                      <Text className='group-slot'>{group.slot}</Text>
                      <View className='divider-line' />
                    </View>

                    <View className='lightweight-list'>
                      {group.items.map((task) => {
                        const meta = buildLightweightSummary(task)
                        return (
                          <View key={`${task.executionIndex}-${task.actionId || task.title}`} className={`lightweight-card ${meta.accentClass}`}>
                            <View className='lightweight-card-head'>
                              <View className='lightweight-copy'>
                                <View className='title-row'>
                                  <Text className='task-icon'>{meta.icon}</Text>
                                  <Text className='task-title'>{task.title}</Text>
                                </View>
                                <Text className='task-summary'>{meta.summary}</Text>
                                <Text className='task-extra'>{meta.extra}</Text>
                              </View>
                              <View className={`task-badge ${task.isCompleted ? 'done' : ''}`}>
                                <Text>{task.isCompleted ? '已打卡' : '待处理'}</Text>
                              </View>
                            </View>

                            {task.noteText && (
                              <View className='task-note'>
                                <Text>{task.noteText}</Text>
                              </View>
                            )}

                            <View className='task-actions'>
                              <View className='task-actions-left'>
                                {task.isStudentExtra && onDeleteLightweightTask && (
                                  <View className='task-icon-btn delete' onClick={() => onDeleteLightweightTask(task)}>
                                    <Text>删</Text>
                                  </View>
                                )}
                                {task.detailText && (
                                  <View className='task-icon-btn' onClick={() => setInfoTask(task)}>
                                    <Text>i</Text>
                                  </View>
                                )}
                              </View>
                              <View className='task-open-btn' onClick={() => handleOpenTask(task)}>
                                <Text>{meta.actionLabel}</Text>
                              </View>
                            </View>
                          </View>
                        )
                      })}
                    </View>
                  </View>
                ))}

                {lightweightHiddenCount > 0 && (
                  <View className='lightweight-toggle' onClick={() => setShowAllTasks(true)}>
                    <Text>展开查看全部轻量任务（还有 {lightweightHiddenCount} 项）</Text>
                  </View>
                )}
                {showAllTasks && lightweightTasks.length > 4 && (
                  <View className='lightweight-toggle' onClick={() => setShowAllTasks(false)}>
                    <Text>收起轻量任务</Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </View>

      {infoTask && (
        <View className='task-info-mask' onClick={() => setInfoTask(null)}>
          <View className='task-info-dialog' onClick={(e) => e.stopPropagation()}>
            <Text className='info-title'>{infoTask.title}</Text>
            <Text className='info-desc'>{infoTask.detailText}</Text>
            <View className='info-close' onClick={() => setInfoTask(null)}>
              <Text>关闭</Text>
            </View>
          </View>
        </View>
      )}
    </>
  )
}

export default TodayTrainingCard
