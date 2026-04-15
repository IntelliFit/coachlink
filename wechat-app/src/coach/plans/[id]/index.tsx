import React, { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

function CoachPlanDetail() {
  const params = Taro.getCurrentInstance().router?.params || {}
  const planId = String(params.id || '').trim()
  const coachId = params.coachId ? decodeURIComponent(String(params.coachId)) : ''
  const coachName = params.coachName ? decodeURIComponent(String(params.coachName)) : ''
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!planId) {
      setErrorMsg('缺少计划参数，无法进入计划详情')
      Taro.showToast({ title: '参数错误', icon: 'none' })
      return
    }

    const coachQuery = coachId
      ? `&coachId=${encodeURIComponent(coachId)}${coachName ? `&coachName=${encodeURIComponent(coachName)}` : ''}`
      : ''
    const targetUrl = `/coach/plans/dashboard/[id]?id=${encodeURIComponent(planId)}${coachQuery}`

    Taro.redirectTo({ url: targetUrl }).catch((redirectError) => {
      console.error('[coach/plans/[id]] redirect failed:', redirectError)
      Taro.navigateTo({ url: targetUrl }).catch((navigateError) => {
        console.error('[coach/plans/[id]] navigate failed:', navigateError)
        setErrorMsg('页面跳转失败，请返回后重试')
      })
    })
  }, [coachId, coachName, planId])

  return (
    <View className='plan-detail-entry-page'>
      <View className='entry-card'>
        <Text className='entry-title'>正在进入计划看板...</Text>
        {errorMsg ? (
          <Text className='entry-error'>{errorMsg}</Text>
        ) : (
          <Text className='entry-desc'>请稍候，正在同步计划信息</Text>
        )}
      </View>
    </View>
  )
}

export default CoachPlanDetail

