import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { coachVideoService } from '@/services/coach/coachVideoService'
import type { ExecutionSetVideoWithDetails } from '@/services/coach/coachVideoService'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useTheme } from '@/hooks/useTheme'

type FilterStatus = 'pending' | 'reviewed' | ''

function CoachVideos() {
  const { effectiveTheme } = useTheme()
  const [videos, setVideos] = useState<ExecutionSetVideoWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('pending')

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({ url: '/auth/login?returnTo=' + encodeURIComponent('/coach/videos') })
      return
    }
    loadVideos()
  }, [filter])

  async function loadVideos() {
    try {
      setLoading(true)
      const res = await coachVideoService.getExecutionSetVideos({
        pagination: { page: 1, limit: 100 },
        reviewStatus: filter === '' ? undefined : filter
      })
      if (res) {
        setVideos(res.videos || [])
        // 缓存视频数据供点评页使用
        Taro.setStorageSync('coach_videos_cache', res.videos || [])
      } else {
        setVideos([])
      }
    } catch (e) {
      console.error('[coach/videos] load:', e)
      setVideos([])
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  function openReview(v: ExecutionSetVideoWithDetails) {
    // 确保当前视频数据已缓存
    const videosCache = Taro.getStorageSync('coach_videos_cache') || []
    const cachedVideo = videosCache.find((item: ExecutionSetVideoWithDetails) => item.id === v.id)
    if (!cachedVideo) {
      // 如果缓存中没有，更新缓存
      const updatedCache = [...videosCache, v]
      Taro.setStorageSync('coach_videos_cache', updatedCache)
    }
    Taro.navigateTo({
      url: '/coach/videos/review?id=' + encodeURIComponent(v.id)
    }).catch(() => {
      Taro.showToast({ title: '跳转失败', icon: 'none' })
    })
  }

  return (
    <View className={`coach-videos-page theme-${effectiveTheme}`}>
      <View className="filter-bar">
        <Text
          className={'filter-btn ' + (filter === 'pending' ? 'active' : '')}
          onClick={() => setFilter('pending')}
        >
          待点评
        </Text>
        <Text
          className={'filter-btn ' + (filter === 'reviewed' ? 'active' : '')}
          onClick={() => setFilter('reviewed')}
        >
          已点评
        </Text>
      </View>
      {loading ? (
        <View className="loading-wrap"><LoadingSpinner size={48} /></View>
      ) : videos.length === 0 ? (
        <View className="empty-wrap">暂无视频</View>
      ) : (
        <ScrollView scrollY className="video-list">
          {videos.map((v) => (
            <View key={v.id} className="video-card">
              <View className="card-row">
                <Text className="student-name">{v.student_name || v.student_id || '学员'}</Text>
                <Text className={'status-tag ' + (v.review_status === 'reviewed' ? 'reviewed' : '')}>
                  {v.review_status === 'reviewed' ? '已点评' : '待点评'}
                </Text>
              </View>
              <Text className="exercise-name">{v.exercise_name || '动作视频'}</Text>
              <View className="card-actions">
                {v.review_status !== 'reviewed' ? (
                  <View
                    className="review-btn"
                    onClick={() => openReview(v)}
                  >
                    <Text className="review-btn-text">去点评</Text>
                    <Text className="review-btn-icon">→</Text>
                  </View>
                ) : (
                  <View
                    className="review-btn reviewed-btn"
                    onClick={() => openReview(v)}
                  >
                    <Text className="review-btn-text">查看点评</Text>
                    <Text className="review-btn-icon">→</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
      <BottomNav />
    </View>
  )
}

export default CoachVideos
