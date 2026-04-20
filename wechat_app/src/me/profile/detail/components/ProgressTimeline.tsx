import React, { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { executionService } from '@/services/executionService'
import './ProgressTimeline.scss'
import { Star, Clock } from '@nutui/icons-react-taro'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface ProgressTimelineProps {
  data: any
}

const ProgressTimeline: React.FC<ProgressTimelineProps> = ({ data }) => {
  const [prRecords, setPrRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPRRecords()
  }, [])

  const fetchPRRecords = async () => {
    try {
      setLoading(true)
      const records = await executionService.getPRRecords(20)
      setPrRecords(records || [])
    } catch (error) {
      console.error('获取PR记录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePR = async (recordId: string) => {
    Taro.showModal({
      title: '删除记录',
      content: '确定要删除这条进步记录吗？',
      success: async (res) => {
        if (res.confirm) {
          const ok = await executionService.deletePRRecord(recordId)
          if (ok) {
            Taro.showToast({ title: '已删除', icon: 'success' })
            fetchPRRecords()
          } else {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }

  const handleAddManualPR = () => {
    Taro.showModal({
      title: '手动记录 PR',
      content: '请在训练执行页完成某一组后，勾选「标记为PR」来记录进步。或在网页端 coachlink.fit 的档案页进行手动添加。',
      showCancel: false,
      confirmText: '知道了'
    })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  if (loading) {
    return (
      <View className='progress-timeline'>
        <LoadingSpinner size={48} />
      </View>
    )
  }

  if (prRecords.length === 0) {
    return (
      <View className='progress-timeline'>
        <View className='timeline-header'>
          <View className='timeline-icon'><Clock size={14} color="#CF6D4E" /></View>
          <Text className='timeline-title'>进步足迹</Text>
          <View className='add-pr-btn' onClick={handleAddManualPR}>
            <Text>+ 手动记录 PR</Text>
          </View>
        </View>
        <View className='empty-state'>
          <View className='empty-icon'><Star /></View>
          <Text className='empty-text'>暂无进步记录</Text>
          <Text className='empty-hint'>在训练中标记进步组来记录突破</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='progress-timeline'>
      <View className='timeline-header'>
        <View className='timeline-icon'><Clock size={14} color="#CF6D4E" /></View>
        <Text className='timeline-title'>进步足迹</Text>
        <Text className='record-count'>（{prRecords.length} 个记录）</Text>
        <View className='add-pr-btn' onClick={handleAddManualPR}>
          <Text>+ 手动记录 PR</Text>
        </View>
      </View>
      
      <View className='timeline-list'>
        {prRecords.map((record, index) => (
          <View key={record.id} className='timeline-item'>
            {/* 时间线装饰 */}
            <View className='timeline-decoration'>
              <View className='timeline-dot' />
              {index < prRecords.length - 1 && <View className='timeline-line' />}
            </View>
            
            {/* 内容卡片 */}
            <View className='item-card'>
              {/* 日期行 */}
              <View className='card-header'>
                <View className='item-date'><Calendar /> {formatDate(record.date_achieved)}</View>
                <View className='new-record-badge'>
                  <Text className='badge-text'> 新纪录</Text>
                </View>
              </View>
              
              {/* 动作标题 */}
              <Text className='item-title'>{record.exercise_name} 新纪录！</Text>
              
              {/* 计算公式 */}
              <View className='formula-box'>
                <Text className='formula-text'>
                   {record.weight}kg × {record.reps}次 = e1RM {record.e1rm ? record.e1rm.toFixed(1) : '-'}kg
                </Text>
              </View>
              
              {/* 完成状态 */}
              <Text className='status-text'>成功完成</Text>
              
              {/* 详情标签 */}
              <View className='detail-tags'>
                <View className='detail-tag'>
                  <Text className='tag-label'>重量:</Text>
                  <Text className='tag-value'>{record.weight}kg</Text>
                </View>
                <View className='detail-tag'>
                  <Text className='tag-label'>次数:</Text>
                  <Text className='tag-value'>{record.reps}</Text>
                </View>
              </View>

              {/* 操作区：查看视频（有则显示）+ 删除 */}
              <View className='card-actions'>
                {record.video_url && (
                  <View
                    className='view-video-btn'
                    onClick={() => {
                      Taro.setStorageSync('pr_video_url', record.video_url)
                      Taro.navigateTo({ url: '/common/common/video-player/index?source=pr' })
                    }}
                  >
                    <Text> 查看视频</Text>
                  </View>
                )}
                <View className='delete-pr-btn' onClick={() => handleDeletePR(record.id)}>
                  <Text>删除</Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

export default ProgressTimeline
