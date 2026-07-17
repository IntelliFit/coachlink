import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import './index.scss'

type ExecutionPlanNoticeMode = 'confirm' | 'read'

interface ExecutionPlanNoticePopupProps {
  visible: boolean
  mode?: ExecutionPlanNoticeMode
  planSource?: 'coach' | 'self'
  executionNotice?: string | null
  planName?: string | null
  confirmLabel?: string
  confirmLoading?: boolean
  onClose?: () => void
  onConfirm?: () => void
}

const SAFETY_BASELINES = [
  '出现锐痛、头晕、胸闷或其他异常不适时，先停止训练。',
  '重量、次数、RPE、视频和备注要按真实情况记录。',
  '看不懂动作或强度要求时，先暂停并联系教练确认。'
]

function ExecutionPlanNoticePopup({
  visible,
  mode = 'confirm',
  planSource = 'coach',
  executionNotice,
  planName,
  confirmLabel,
  confirmLoading = false,
  onClose,
  onConfirm
}: ExecutionPlanNoticePopupProps) {
  const [checked, setChecked] = useState(mode === 'read')
  const requiresConfirm = mode === 'confirm'
  const isSelfPlan = planSource === 'self'
  const coachNotice = String(executionNotice || '').trim()

  useEffect(() => {
    if (!visible) return
    setChecked(mode === 'read')
  }, [mode, visible])

  const finalConfirmLabel = useMemo(() => {
    if (confirmLabel) return confirmLabel
    return requiresConfirm ? '我已阅读，继续训练' : '我知道了'
  }, [confirmLabel, requiresConfirm])

  if (!visible) return null

  return (
    <View
      className='execution-plan-notice-mask'
      onClick={() => {
        if (!requiresConfirm) onClose?.()
      }}
    >
      <View className='execution-plan-notice-sheet' onClick={(e) => e.stopPropagation()}>
        <View className='execution-plan-notice-handle' />
        <Text className='execution-plan-notice-title'>执行计划阅读须知</Text>

        <ScrollView scrollY className='execution-plan-notice-scroll'>
          <View className='execution-plan-notice-card execution-plan-notice-card--intro'>
            <Text className='execution-plan-notice-card-title'>
              {isSelfPlan ? '先看这份计划的执行须知' : '先看教练给这份计划写的执行须知'}
            </Text>
            <Text className='execution-plan-notice-card-text'>
              {planName
                ? `开始「${planName}」之前，请先确认这份计划的执行要求、注意事项和记录方式。`
                : '开始训练前，请先确认这份计划的执行要求、注意事项和记录方式。'}
            </Text>
          </View>

          <View className='execution-plan-notice-card'>
            <Text className='execution-plan-notice-card-title'>{isSelfPlan ? '计划执行须知' : '教练执行须知'}</Text>
            <Text className='execution-plan-notice-card-text execution-plan-notice-card-text--prewrap'>
              {coachNotice || (isSelfPlan
                ? '这份计划暂未填写专属执行须知。开始前仍请遵守下面的平台安全底线，并按真实情况记录训练反馈。'
                : '教练暂未填写这份计划的专属执行须知。开始前仍请遵守下面的安全底线，并在不确定时先联系教练。')}
            </Text>
          </View>

          <View className='execution-plan-notice-card execution-plan-notice-card--safe'>
            <Text className='execution-plan-notice-card-title'>平台安全底线</Text>
            <View className='execution-plan-notice-safe-list'>
              {SAFETY_BASELINES.map((item, index) => (
                <View key={item} className='execution-plan-notice-safe-item'>
                  <View className='execution-plan-notice-safe-index'>
                    <Text>{index + 1}</Text>
                  </View>
                  <Text className='execution-plan-notice-safe-text'>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {requiresConfirm && (
          <View className='execution-plan-notice-check-row' onClick={() => setChecked((prev) => !prev)}>
            <View className={`execution-plan-notice-check ${checked ? 'checked' : ''}`}>
              <Text>{checked ? '✓' : ''}</Text>
            </View>
            <Text className='execution-plan-notice-check-text'>
              我已阅读并理解{isSelfPlan ? '这份计划的' : '教练设置的'}执行须知和平台安全底线，会按真实情况安全执行并记录反馈。
            </Text>
          </View>
        )}

        <View className={`execution-plan-notice-actions ${requiresConfirm && onClose ? 'execution-plan-notice-actions--split' : ''}`}>
          {!requiresConfirm && (
            <View className='execution-plan-notice-btn execution-plan-notice-btn--primary' onClick={() => (onConfirm || onClose)?.()}>
              <Text>{finalConfirmLabel}</Text>
            </View>
          )}
          {requiresConfirm && onClose && (
            <View className='execution-plan-notice-btn execution-plan-notice-btn--secondary' onClick={onClose}>
              <Text>暂不训练</Text>
            </View>
          )}
          {requiresConfirm && (
            <View
              className={`execution-plan-notice-btn execution-plan-notice-btn--primary ${
                !checked || confirmLoading ? 'disabled' : ''
              }`}
              onClick={() => {
                if (!checked || confirmLoading) return
                onConfirm?.()
              }}
            >
              <Text>{confirmLoading ? '处理中...' : finalConfirmLabel}</Text>
            </View>
          )}
          {!requiresConfirm && onClose && (
            <View className='execution-plan-notice-btn execution-plan-notice-btn--secondary' onClick={onClose}>
              <Text>关闭</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

export default ExecutionPlanNoticePopup
