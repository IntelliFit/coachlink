import { View, Text } from '@tarojs/components'
import { useState, useEffect, useRef, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { request } from '@/utils/request'
import './index.scss'

// 页面状态（后端当前无任务轮询接口，保留 async_pending 作为“已提交”态）
type PollStatus = 'idle' | 'polling' | 'success' | 'error' | 'async_pending'

export default function GeneratePlanWaiting() {
  const [loading, setLoading] = useState(false)
  const [tip, setTip] = useState<string>('正在为您制定训练计划...')
  const [pollStatus, setPollStatus] = useState<PollStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const autoStartedRef = useRef(false)

  const params = Taro.getCurrentInstance().router?.params || {}
  const coachId = (params.coachId ?? params.coach_id ?? '') as string
  const domain = (params.domain ?? '') as string
  const taskId = (params.taskId ?? '') as string // 可选的任务ID

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
  }, [])

  const startFakeProgress = useCallback(() => {
    clearProgressTimer()
    setProgress(12)
    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => (prev >= 85 ? 85 : prev + 8))
    }, 450)
  }, [clearProgressTimer])

  // 快速生成计划
  const handleQuickGenerate = useCallback(async () => {
    if (!coachId) {
      Taro.showToast({ title: '缺少教练 ID', icon: 'none' })
      return
    }

    clearProgressTimer()
    setError(null)

    try {
      setLoading(true)
      setPollStatus('polling')
      setTip('正在为您快速生成计划...')
      setProgress(0)
      startFakeProgress()

      const res = await request<{ planId?: string; taskId?: string }>({
        url: '/api/user/generate-quick-plan',
        method: 'POST',
        data: { coachId, domain },
        showErrorToast: true
      })

      if (res.success) {
        if (res.data?.planId) {
          // 直接返回了 planId，说明同步生成成功
          setPollStatus('success')
          setTip('计划生成成功！')
          setProgress(100)
          
          setTimeout(() => {
            Taro.redirectTo({
              url: '/me/plan-history/index'
            })
          }, 800)
        } else if (res.data?.taskId) {
          // 后端返回 taskId，但当前小程序尚未接入任务轮询
          setPollStatus('async_pending')
          setError(null)
          setTip('生成请求已提交为异步任务。请稍后在“全部计划”查看结果，或重新提交。')
          setProgress(100)
        } else {
          // 没有返回 planId 或 taskId，直接跳转到统一的全部计划入口
          setPollStatus('success')
          setProgress(100)
          setTip('请求已提交')
          setTimeout(() => {
            handleGoPlans()
          }, 1000)
        }
      } else {
        setPollStatus('error')
        setError(res.message || '生成失败，请重试')
        setTip(res.message || '生成失败')
      }
    } catch (e: any) {
      setPollStatus('error')
      setError(e?.message || '生成失败，请重试')
      setTip(e?.message || '生成失败')
    } finally {
      clearProgressTimer()
      setLoading(false)
    }
  }, [coachId, domain, clearProgressTimer, startFakeProgress])

  // 重试
  const handleRetry = () => {
    setError(null)
    setPollStatus('idle')
    setProgress(0)
    handleQuickGenerate()
  }

  // 前往统一的全部计划入口
  const handleGoPlans = () => {
    Taro.redirectTo({ url: '/me/plan-history/index' })
  }

  // 返回
  const handleBack = () => {
    Taro.navigateBack()
  }

  // 页面进入后自动触发一次生成；如存在旧 taskId，提示后允许用户手动触发。
  useEffect(() => {
    if (!coachId) {
      setPollStatus('error')
      setError('缺少教练信息，请返回重新选择。')
      return
    }

    if (autoStartedRef.current) return
    autoStartedRef.current = true

    if (taskId) {
      setTip('检测到历史任务请求。当前版本暂不支持任务轮询，建议稍后在“全部计划”查看，或点击“重新生成”。')
      setPollStatus('async_pending')
      setProgress(100)
      return
    }

    handleQuickGenerate()
  }, [coachId, taskId, handleQuickGenerate])

  useEffect(() => {
    return () => {
      clearProgressTimer()
    }
  }, [clearProgressTimer])

  // 渲染状态图标
  const renderStatusIcon = () => {
    switch (pollStatus) {
      case 'success':
        return <Text className='icon success'>✓</Text>
      case 'error':
        return <Text className='icon error'>✗</Text>
      case 'async_pending':
        return <Text className='icon pending'>⏳</Text>
      case 'polling':
      default:
        return (
          <View className='loading-spinner'>
            <View className='spinner' />
          </View>
        )
    }
  }

  return (
    <View className='generate-plan-waiting-page'>
      <View className='waiting-card'>
        <View className='icon-wrap'>
          {renderStatusIcon()}
        </View>
        
        <Text className='title'>
          {pollStatus === 'success' ? '计划生成成功' : 
           pollStatus === 'error' ? '生成失败' :
           pollStatus === 'async_pending' ? '生成请求已提交' :
           '计划创建请求已提交'}
        </Text>
        
        <Text className='desc'>
          {domain ? `您已选择「${domain === 'weighted_pullup' ? '负重引体' : domain === 'weighted_dips' ? '负重臂屈伸' : '引体+臂屈伸组合'}」训练域。` : ''}
          {error || tip}
        </Text>

        {/* 进度条 */}
        {pollStatus === 'polling' && (
          <View className='progress-section'>
            <View className='progress-bar'>
              <View 
                className='progress-fill' 
                style={{ width: `${progress}%` }}
              />
            </View>
            <Text className='progress-text'>{progress}%</Text>
          </View>
        )}

        <View className='actions'>
          {/* 成功状态 */}
          {pollStatus === 'success' && (
            <View className='btn primary' onClick={handleGoPlans}>
              <Text>查看全部计划</Text>
            </View>
          )}

          {/* 错误/超时状态 */}
          {pollStatus === 'error' && (
            <>
              <View className='btn primary' onClick={handleRetry}>
                <Text>重新生成</Text>
              </View>
              <View className='btn secondary' onClick={handleGoPlans}>
                <Text>查看全部计划</Text>
              </View>
            </>
          )}

          {/* 异步任务已提交状态 */}
          {pollStatus === 'async_pending' && (
            <>
              <View className='btn primary' onClick={handleGoPlans}>
                <Text>查看全部计划</Text>
              </View>
              <View className='btn secondary' onClick={handleRetry}>
                <Text>重新生成</Text>
              </View>
            </>
          )}

          {/* 初始/轮询状态 */}
          {(pollStatus === 'idle' || pollStatus === 'polling') && (
            <>
              <View className='btn primary' onClick={handleGoPlans}>
                <Text>前往全部计划</Text>
              </View>
              <View
                className={`btn secondary ${loading ? 'disabled' : ''}`}
                onClick={loading ? undefined : handleQuickGenerate}
              >
                <Text>{loading ? '生成中...' : '智能快速生成'}</Text>
              </View>
            </>
          )}
        </View>
      </View>

      <View className='back-btn' onClick={handleBack}>
        <Text>返回</Text>
      </View>
    </View>
  )
}
