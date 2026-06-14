import React, { useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

function CoachDashboardTrainingExecution() {
  const { effectiveTheme } = useTheme()
  const params = Taro.getCurrentInstance().router?.params || {}
  const planId = String(params.id || params.planId || '').trim()
  const dayIndexRaw = String(params.dayIndex || params.day || '1')
  const readOnlyParam = String(params.readOnly || '').toLowerCase()
  const isReadOnly = readOnlyParam === 'true' || readOnlyParam === '1'
  const coachId = params.coachId ? decodeURIComponent(String(params.coachId)) : ''
  const coachName = params.coachName ? decodeURIComponent(String(params.coachName)) : ''

  const [errorMsg, setErrorMsg] = useState('')

  const dayIndex = useMemo(() => {
    const parsed = Number.parseInt(dayIndexRaw, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  }, [dayIndexRaw])

  useEffect(() => {
    if (!planId) {
      setErrorMsg('缺少计划参数，无法进入训练执行页')
      Taro.showToast({ title: '参数错误', icon: 'none' })
      return
    }

    const coachQuery = coachId
      ? `&coachId=${encodeURIComponent(coachId)}${coachName ? `&coachName=${encodeURIComponent(coachName)}` : ''}`
      : ''
    const readOnlyQuery = `&readOnly=${isReadOnly ? 'true' : 'false'}`
    const targetUrl = `/training/training-execution?instanceId=${encodeURIComponent(planId)}&dayIndex=${dayIndex}${readOnlyQuery}${coachQuery}`

    Taro.redirectTo({ url: targetUrl }).catch((redirectError) => {
      console.error('[coach/dashboard/training-execution] redirect failed:', redirectError)
      Taro.navigateTo({ url: targetUrl }).catch((navigateError) => {
        console.error('[coach/dashboard/training-execution] navigate failed:', navigateError)
        setErrorMsg('页面跳转失败，请返回后重试')
        Taro.showToast({ title: '跳转失败', icon: 'none' })
      })
    })
  }, [coachId, coachName, dayIndex, isReadOnly, planId])

  return (
    <View className={`training-execution-entry-page theme-${effectiveTheme}`}>
      <View className='entry-card'>
        <Text className='entry-title'>正在进入训练执行页...</Text>
        {errorMsg ? (
          <Text className='entry-error'>{errorMsg}</Text>
        ) : (
          <Text className='entry-desc'>请稍候，正在同步训练数据</Text>
        )}
      </View>
    </View>
  )
}

export default CoachDashboardTrainingExecution
