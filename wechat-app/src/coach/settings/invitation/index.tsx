import React, { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, Button, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { coachService } from '@/services/coach/coachService'
import BottomNav from '@/components/BottomNav'
import './index.scss'

function CoachInvitationSettings() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [coach, setCoach] = useState<any>(null)
  const [posterStatus, setPosterStatus] = useState<'queued' | 'generating' | 'ready' | 'failed'>('queued')
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const [posterUpdatedAt, setPosterUpdatedAt] = useState<string | null>(null)
  const [posterError, setPosterError] = useState<string | null>(null)
  const [polling, setPolling] = useState(true)
  const hasInitialized = useRef(false) // 跟踪是否已经初始化加载过

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({
        url: '/auth/login?returnTo=' + encodeURIComponent('/coach/settings/invitation')
      })
      return
    }
    loadData()
    // 不在这里调用 loadPosterStatus，让下面的 useEffect 统一处理
  }, [])

  useEffect(() => {
    // 等待 coach 数据加载完成后再加载海报状态
    if (!coach?.id) return
    
    // 首次立即加载（只加载一次）
    if (!hasInitialized.current) {
      hasInitialized.current = true
      loadPosterStatus()
    }
    
    // 只有在需要轮询时才设置定时器
    if (!polling) return
    
    const timer = setInterval(() => {
      loadPosterStatus()
    }, 2000) // 每2秒轮询一次
    
    return () => clearInterval(timer)
  }, [polling, coach?.id])

  async function loadData() {
    try {
      setLoading(true)
      const user = Taro.getStorageSync('user')
      const res = await coachService.getCoach({ userId: user?.id })
      if (res?.coach) {
        setCoach(res.coach)
      }
    } catch (e) {
      console.error('[coach/settings/invitation] load:', e)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  async function loadPosterStatus() {
    try {
      const res = await coachService.getPosterStatus('invitation_hd')
      if (res) {
        // 如果有图片URL，无论后端状态如何，都视为已就绪（修复后端状态不一致的问题）
        const effectiveStatus = res.imageUrl ? 'ready' : res.status
        
        setPosterStatus(effectiveStatus)
        setPosterUrl(res.imageUrl)
        setPosterUpdatedAt(res.updatedAt)
        setPosterError(res.lastError)
        
        // 如果有图片URL，无论状态如何都停止轮询（避免后端状态不一致导致的无限轮询）
        // 只有在状态为 generating 或 queued 且没有图片时才继续轮询
        if (res.imageUrl) {
          // 有图片就停止轮询，即使后端状态可能不是 ready
          setPolling(false)
        } else if (res.status === 'ready' || res.status === 'failed') {
          // 如果没有图片但状态是 ready 或 failed，也停止轮询（避免无限重试）
          setPolling(false)
        }
        // 其他情况（queued 或 generating 且没有图片）继续轮询
      }
    } catch (e) {
      console.error('[coach/settings/invitation] load poster:', e)
      // 出错时也停止轮询，避免无限重试
      setPolling(false)
    }
  }

  async function triggerPoster() {
    try {
      setRefreshing(true)
      setPolling(true)
      setPosterError(null)
      // 重置初始化标志，允许重新加载
      hasInitialized.current = false
      
      const res = await coachService.triggerPoster('invitation_hd')
      if (res?.success) {
        Taro.showToast({ title: '已开始生成海报', icon: 'success' })
        // 立即拉取一次状态
        setTimeout(() => {
          loadPosterStatus()
          hasInitialized.current = true
        }, 500)
      } else {
        Taro.showToast({ title: res?.message || '生成失败', icon: 'none' })
        setRefreshing(false)
      }
    } catch (e: any) {
      console.error('[coach/settings/invitation] trigger:', e)
      Taro.showToast({ title: e.message || '生成失败', icon: 'none' })
      setRefreshing(false)
    }
  }

  async function savePoster() {
    if (!posterUrl) {
      Taro.showToast({ title: '海报尚未就绪', icon: 'none' })
      return
    }

    try {
      // 小程序中保存图片到相册
      await Taro.downloadFile({
        url: posterUrl,
        success: (res) => {
          if (res.statusCode === 200) {
            Taro.saveImageToPhotosAlbum({
              filePath: res.tempFilePath,
              success: () => {
                Taro.showToast({ title: '海报已保存到相册', icon: 'success' })
              },
              fail: (err) => {
                if (err.errMsg.includes('auth deny')) {
                  Taro.showModal({
                    title: '需要授权',
                    content: '需要您授权保存图片到相册',
                    success: (modalRes) => {
                      if (modalRes.confirm) {
                        Taro.openSetting()
                      }
                    }
                  })
                } else {
                  Taro.showToast({ title: '保存失败', icon: 'none' })
                }
              }
            })
          }
        },
        fail: () => {
          Taro.showToast({ title: '下载失败', icon: 'none' })
        }
      })
    } catch (e: any) {
      console.error('[coach/settings/invitation] save:', e)
      Taro.showToast({ title: e.message || '保存失败', icon: 'none' })
    }
  }

  async function copyCode() {
    if (coach?.invitation_code) {
      Taro.setClipboardData({
        data: coach.invitation_code,
        success: () => {
          Taro.showToast({ title: '邀请码已复制', icon: 'success' })
        }
      })
    }
  }

  async function copyLink() {
    if (coach?.invitation_code) {
      const link = `https://coachlink.com/register?invite=${coach.invitation_code}`
      Taro.setClipboardData({
        data: link,
        success: () => {
          Taro.showToast({ title: '链接已复制', icon: 'success' })
        }
      })
    }
  }

  async function savePoster() {
    Taro.showToast({ title: '海报功能请在 web 端使用', icon: 'none' })
  }

  if (loading) {
    return (
      <View className="invitation-settings-page">
        <View className="loading-wrap">加载中...</View>
        <BottomNav />
      </View>
    )
  }

  return (
    <View className="invitation-settings-page">
      <ScrollView scrollY className="settings-scroll" style={{ paddingBottom: '70px' }}>
        <View className="settings-card">
          <Text className="card-title">邀请码</Text>
          <View className="code-section">
            <Text className="code-label">您的专属邀请码</Text>
            <Text className="code-value">{coach?.invitation_code || '未设置'}</Text>
            <Button className="copy-btn" onClick={copyCode}>复制邀请码</Button>
          </View>
        </View>

        <View className="settings-card">
          <Text className="card-title">邀请链接</Text>
          <View className="link-section">
            <Text className="link-value">{coach?.invitation_code ? `https://coachlink.com/register?invite=${coach.invitation_code}` : '未设置邀请码'}</Text>
            <Button className="copy-btn" onClick={copyLink}>复制链接</Button>
          </View>
        </View>

        <View className="settings-card">
          <View className="card-header">
            <Text className="card-title">邀请海报</Text>
            <View className="status-badge">
              <Text className={`status-text ${posterStatus === 'ready' ? 'ready' : ''}`}>
                {posterStatus === 'ready' ? '高清海报已就绪' : 
                 posterStatus === 'generating' ? '生成中...' : 
                 posterStatus === 'failed' ? '生成失败' : '排队中...'}
              </Text>
            </View>
          </View>
          
          {posterError && (
            <Text className="error-text">{posterError}</Text>
          )}
          
          {posterUrl ? (
            <View className="poster-section">
              <View 
                className="poster-image-wrapper"
                onClick={() => {
                  // 点击预览，用户可以在预览界面长按保存或截图
                  Taro.previewImage({
                    urls: [`${posterUrl}${posterUrl.includes('?') ? '&' : '?'}v=${posterUpdatedAt ? encodeURIComponent(posterUpdatedAt) : Date.now()}`],
                    current: `${posterUrl}${posterUrl.includes('?') ? '&' : '?'}v=${posterUpdatedAt ? encodeURIComponent(posterUpdatedAt) : Date.now()}`
                  })
                }}
              >
                <Image 
                  className="poster-image" 
                  src={`${posterUrl}${posterUrl.includes('?') ? '&' : '?'}v=${posterUpdatedAt ? encodeURIComponent(posterUpdatedAt) : Date.now()}`} 
                  mode="aspectFit" 
                />
                {/* 提示用户可以点击预览后截图保存 */}
                <View className="poster-hint">
                  <Text className="hint-text">点击预览，可在预览界面截图保存</Text>
                </View>
              </View>
              <View className="poster-actions">
                <Button 
                  className="refresh-btn" 
                  onClick={triggerPoster}
                  loading={refreshing}
                >
                  更新海报
                </Button>
              </View>
            </View>
          ) : (
            <View className="empty-poster-section">
              <Text className="empty-text">暂无海报</Text>
              <Button 
                className="generate-btn" 
                onClick={triggerPoster}
                loading={refreshing}
              >
                生成海报
              </Button>
            </View>
          )}
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default CoachInvitationSettings
