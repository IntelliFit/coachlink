import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Canvas } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { studentService } from '@/services/studentService'
import { studentActionLibService } from '@/services/studentActionLibService'
import './index.scss'

interface E1RMDataPoint {
  date: string
  value: number
}

interface PRRecord {
  id: string
  actionName: string
  value: number
  date: string
  videoUrl?: string
}

export default function E1RMChartPage() {
  const [actions, setActions] = useState<Array<{ id: string; name: string }>>([])
  const [selectedActionId, setSelectedActionId] = useState('')
  const [e1rmData, setE1rmData] = useState<E1RMDataPoint[]>([])
  const [prRecords, setPrRecords] = useState<PRRecord[]>([])

  const loadActions = useCallback(async () => {
    const res = await studentActionLibService.listActions({ page: 1, limit: 100 })
    if (res?.actions) {
      const actionList = res.actions.map((a: any) => ({ id: a.id, name: a.name }))
      setActions(actionList)
      if (actionList.length > 0) setSelectedActionId(actionList[0].id)
    }
  }, [])

  const loadE1RMData = useCallback(async () => {
    if (!selectedActionId) return
    const res = await studentService.getE1RMHistory(selectedActionId)
    if (res?.history) setE1rmData(res.history)
    if (res?.prRecords) setPrRecords(res.prRecords)
  }, [selectedActionId])

  useDidShow(() => { loadActions() })
  useEffect(() => { loadE1RMData() }, [loadE1RMData])

  const drawChart = () => {
    if (e1rmData.length < 2) return
    const query = Taro.createSelectorQuery()
    query.select('#e1rmCanvas').fields({ node: true, size: true }).exec((res) => {
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const width = 700, height = 400
      canvas.width = width; canvas.height = height
      ctx.clearRect(0, 0, width, height)
      
      const values = e1rmData.map(d => d.value)
      const maxValue = Math.max(...values) * 1.1
      const minValue = Math.min(...values) * 0.9
      const xStep = (width - 100) / (e1rmData.length - 1)
      const yScale = (height - 80) / (maxValue - minValue)

      ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(60, 20); ctx.lineTo(60, height - 40); ctx.lineTo(width - 20, height - 40); ctx.stroke()

      ctx.strokeStyle = '#1890ff'; ctx.lineWidth = 3; ctx.beginPath()
      e1rmData.forEach((point, index) => {
        const x = 60 + index * xStep
        const y = height - 40 - (point.value - minValue) * yScale
        index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.stroke()

      e1rmData.forEach((point, index) => {
        const x = 60 + index * xStep
        const y = height - 40 - (point.value - minValue) * yScale
        ctx.fillStyle = '#1890ff'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#333'; ctx.font = '24px sans-serif'; ctx.textAlign = 'center'
        ctx.fillText(String(point.value), x, y - 15)
      })
    })
  }

  useEffect(() => { if (e1rmData.length > 0) drawChart() }, [e1rmData])

  return (
    <View className='e1rm-chart-page'>
      <ScrollView className='page-scroll' scrollY>
        <View className='action-selector'>
          <Text className='label'>选择动作:</Text>
          <ScrollView className='action-list' scrollX>
            {actions.map(action => (
              <View key={action.id} className={`action-tag ${selectedActionId === action.id ? 'selected' : ''}`} onClick={() => setSelectedActionId(action.id)}>
                <Text>{action.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View className='chart-section'>
          <Text className='section-title'>E1RM 趋势</Text>
          {e1rmData.length >= 2 ? (
            <Canvas id='e1rmCanvas' type='2d' className='chart-canvas' />
          ) : (
            <View className='no-data'><Text>数据不足，无法绘制图表</Text></View>
          )}
        </View>

        <View className='pr-section'>
          <Text className='section-title'>PR 记录</Text>
          {prRecords.length === 0 ? (
            <View className='no-data'><Text>暂无 PR 记录</Text></View>
          ) : (
            <View className='pr-list'>
              {prRecords.map(pr => (
                <View key={pr.id} className='pr-item'>
                  <View className='pr-info'>
                    <Text className='pr-action'>{pr.actionName}</Text>
                    <Text className='pr-value'>{pr.value} kg</Text>
                    <Text className='pr-date'>{new Date(pr.date).toLocaleDateString()}</Text>
                  </View>
                  {pr.videoUrl && (
                    <View className='video-btn' onClick={() => Taro.previewMedia({ sources: [{ url: pr.videoUrl!, type: 'video' }] })}>
                      <Text> 观看视频</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
