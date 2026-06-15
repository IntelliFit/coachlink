import { useState, useEffect } from 'react'
import { View, Text, Canvas } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Star } from '@nutui/icons-react-taro'
import { request } from '@/utils/request'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useTheme } from '@/hooks/useTheme'

interface ShareData {
  workoutName: string
  completedAt: string
  totalSets: number
  totalReps: number
  totalVolume: number
  prCount: number
  duration: number
}

interface ShareInfoData {
  planName: string
  completedAt: string
  totalVolume: number
  totalSets: number
  durationMinutes: number
  prRecords?: Array<{
    exerciseName: string
    weight: number
    reps: number
  }>
}

export default function SharePage() {
  const { effectiveTheme } = useTheme()
  const router = useRouter()
  const executionId = router.params.executionId as string
  
  const [data, setData] = useState<ShareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (executionId) {
      loadData()
    }
  }, [executionId])

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await request<ShareInfoData>({
        url: '/api/execution/share-info',
        method: 'POST',
        data: { id: executionId }
      })
      if (res.success && res.data) {
        setData({
          workoutName: res.data.planName || '今日训练',
          completedAt: res.data.completedAt,
          totalSets: res.data.totalSets || 0,
          totalReps: 0,
          totalVolume: res.data.totalVolume || 0,
          prCount: res.data.prRecords?.length || 0,
          duration: res.data.durationMinutes || 0
        })
      }
    } catch (error) {
      console.error('加载分享数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 生成分享卡片
  const generateCard = async () => {
    setGenerating(true)
    
    const query = Taro.createSelectorQuery()
    query.select('#shareCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        
        // 设置画布尺寸
        canvas.width = 750
        canvas.height = 1000
        
        // 绘制背景
        const gradient = ctx.createLinearGradient(0, 0, 750, 1000)
        gradient.addColorStop(0, '#667eea')
        gradient.addColorStop(1, '#764ba2')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, 750, 1000)
        
        // 绘制标题
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 48px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('训练完成！', 375, 150)
        
        // 绘制训练名称
        ctx.font = '36px sans-serif'
        ctx.fillText(data?.workoutName || '今日训练', 375, 220)
        
        // 绘制数据
        ctx.font = 'bold 72px sans-serif'
        ctx.fillText(String(data?.totalVolume || 0), 375, 400)
        ctx.font = '28px sans-serif'
        ctx.fillText('总容量 (kg)', 375, 450)
        
        ctx.font = 'bold 48px sans-serif'
        ctx.fillText(`${data?.totalSets || 0} 组`, 250, 580)
        ctx.fillText(`${data?.prCount || 0} PR`, 500, 580)
        
        // 保存图片
        Taro.canvasToTempFilePath({
          canvas,
          success: (res) => {
            Taro.saveImageToPhotosAlbum({
              filePath: res.tempFilePath,
              success: () => {
                Taro.showToast({ title: '保存成功', icon: 'success' })
              },
              fail: () => {
                Taro.previewImage({ urls: [res.tempFilePath] })
              }
            })
          },
          fail: () => {
            Taro.showToast({ title: '生成失败', icon: 'none' })
          },
          complete: () => {
            setGenerating(false)
          }
        })
      })
  }

  if (loading) {
    return (
      <View className={`share-page theme-${effectiveTheme}`}>
        <View className="loading"><LoadingSpinner size={48} /></View>
      </View>
    )
  }

  return (
    <View className={`share-page theme-${effectiveTheme}`}>
      <Canvas id='shareCanvas' type='2d' className='share-canvas' style={{ position: 'absolute', left: '-9999px' }} />
      
      {/* 预览卡片 */}
      <View className='preview-card'>
        <View className='card-header'>
          <View className='title'><Star size={20} /><Text style={{ marginLeft: 4 }}>训练完成！</Text></View>
          <Text className='subtitle'>{data?.workoutName}</Text>
          <Text className='date'>{new Date(data?.completedAt || '').toLocaleDateString()}</Text>
        </View>
        
        <View className='stats-section'>
          <View className='main-stat'>
            <Text className='value'>{data?.totalVolume}</Text>
            <Text className='label'>总容量 (kg)</Text>
          </View>
          
          <View className='sub-stats'>
            <View className='sub-stat'>
              <Text className='value'>{data?.totalSets}</Text>
              <Text className='label'>组数</Text>
            </View>
            <View className='sub-stat'>
              <Text className='value'>{data?.totalReps}</Text>
              <Text className='label'>次数</Text>
            </View>
            <View className='sub-stat highlight'>
              <Text className='value'>{data?.prCount}</Text>
              <Text className='label'>PR</Text>
            </View>
          </View>
        </View>
        
        <View className='footer'>
          <Text>来自 CoachLink 健身</Text>
        </View>
      </View>

      {/* 分享按钮 */}
      <View className='share-actions'>
        <View className={`share-btn ${generating ? 'loading' : ''}`} onClick={generateCard}>
          <Text>{generating ? '生成中...' : '保存分享卡片'}</Text>
        </View>
        <View className='share-btn secondary' onClick={() => Taro.navigateBack()}>
          <Text>返回</Text>
        </View>
      </View>
    </View>
  )
}
