import React, { useState, useEffect } from 'react'
import { View, Text, Video, Textarea, Button, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { coachVideoService } from '@/services/coach/coachVideoService'
import type { ExecutionSetVideoWithDetails } from '@/services/coach/coachVideoService'
import './index.scss'

function CoachVideosReview() {
  const videoId = Taro.getCurrentInstance().router?.params?.id
  const [video, setVideo] = useState<ExecutionSetVideoWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (!videoId) {
      Taro.showToast({ title: '参数错误', icon: 'none' })
      Taro.navigateBack()
      return
    }
    loadVideo()
  }, [videoId])

  async function loadVideo() {
    try {
      setLoading(true)
      // 从列表页获取视频数据（通过全局事件或存储）
      // 为了简化，这里先尝试从存储中获取，如果没有则从API获取
      const videosCache = Taro.getStorageSync('coach_videos_cache')
      let videoData: ExecutionSetVideoWithDetails | null = null

      if (videosCache && Array.isArray(videosCache)) {
        videoData = videosCache.find((v: ExecutionSetVideoWithDetails) => v.id === videoId) || null
      }

      if (!videoData) {
        // 如果缓存中没有，尝试从API获取列表并查找
        const res = await coachVideoService.getExecutionSetVideos({
          pagination: { page: 1, limit: 100 }
        })
        if (res?.videos) {
          videoData = res.videos.find(v => v.id === videoId) || null
          // 更新缓存
          Taro.setStorageSync('coach_videos_cache', res.videos)
        }
      }

      if (videoData) {
        setVideo(videoData)
        // 如果已点评，显示之前的评分和评论
        if (videoData.review_status === 'reviewed') {
          setRating((videoData as any).coach_rating || 0)
          setComment((videoData as any).coach_feedback || '')
        }
      } else {
        Taro.showToast({ title: '视频不存在', icon: 'none' })
        setTimeout(() => Taro.navigateBack(), 1500)
      }
    } catch (e) {
      console.error('[coach/videos/review] load:', e)
      Taro.showToast({ title: '加载失败', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 1500)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    if (!video || !videoId) return
    if (!comment.trim()) {
      Taro.showToast({ title: '请输入点评内容', icon: 'none' })
      return
    }

    try {
      setSubmitting(true)
      const res = await coachVideoService.reviewExecutionVideo(videoId, {
        rating: rating || 0,
        comment: comment.trim(),
        tips: []
      })

      if (res) {
        Taro.showToast({ title: '点评成功', icon: 'success' })
        // 更新缓存
        const videosCache = Taro.getStorageSync('coach_videos_cache')
        if (videosCache && Array.isArray(videosCache)) {
          const updatedVideos = videosCache.map((v: ExecutionSetVideoWithDetails) =>
            v.id === videoId ? { ...v, review_status: 'reviewed', coach_rating: rating, coach_feedback: comment } as any : v
          )
          Taro.setStorageSync('coach_videos_cache', updatedVideos)
        }
        // 更新当前视频状态
        if (video) {
          setVideo({ ...video, review_status: 'reviewed', coach_rating: rating, coach_feedback: comment } as any)
        }
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        Taro.showToast({ title: '点评失败', icon: 'none' })
      }
    } catch (e) {
      console.error('[coach/videos/review] submit:', e)
      Taro.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  function renderStars() {
    const stars = []
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <View
          key={i}
          className={`star ${i <= rating ? 'active' : ''}`}
          onClick={() => setRating(i)}
        >
          {i <= rating ? '★' : '☆'}
        </View>
      )
    }
    return stars
  }

  if (loading) {
    return (
      <View className="review-page">
        <View className="loading-wrap">加载中...</View>
      </View>
    )
  }

  if (!video) {
    return (
      <View className="review-page">
        <View className="empty-wrap">视频不存在</View>
      </View>
    )
  }

  const executionDetails = video.execution_details

  return (
    <View className="review-page">
      <ScrollView scrollY className="review-scroll">
        {/* 视频播放区域 */}
        <View className="video-section">
          <View className="video-header">
            <Text className="video-title">视频点评</Text>
            <Text className="video-subtitle">
              {video.student_name || '学员'} · {video.exercise_name || '动作视频'} · 第 {video.set_number || 1} 组
            </Text>
          </View>
          {video.video_url ? (
            <Video
              src={video.video_url}
              controls
              className="video-player"
              initialTime={0}
              id="review-video"
            />
          ) : (
            <View className="video-placeholder">
              <Text>视频链接不存在</Text>
            </View>
          )}
        </View>

        {/* 执行详情卡片 */}
        {executionDetails && (
          <View className="details-card">
            <View className="details-header">
              <Text className="details-title">训练执行数据</Text>
            </View>
            <View className="details-grid">
              {executionDetails.actual_reps !== undefined && (
                <View className="detail-item">
                  <Text className="detail-label">完成次数</Text>
                  <Text className="detail-value">
                    {executionDetails.actual_reps}
                    {executionDetails.planned_reps && ` / ${executionDetails.planned_reps}`}
                  </Text>
                </View>
              )}
              {executionDetails.actual_weight !== undefined && (
                <View className="detail-item">
                  <Text className="detail-label">重量</Text>
                  <Text className="detail-value">
                    {executionDetails.actual_weight}kg
                    {executionDetails.planned_weight && ` / ${executionDetails.planned_weight}`}
                  </Text>
                </View>
              )}
              {executionDetails.rpe !== undefined && (
                <View className="detail-item">
                  <Text className="detail-label">RPE</Text>
                  <Text className="detail-value rpe-value">{executionDetails.rpe}/10</Text>
                </View>
              )}
            </View>
            {executionDetails.planned_reps && executionDetails.actual_reps && (
              <View className="completion-bar">
                <View className="completion-info">
                  <Text className="completion-label">完成度</Text>
                  <Text className={`completion-value ${
                    executionDetails.actual_reps >= executionDetails.planned_reps ? 'success' : 'warning'
                  }`}>
                    {Math.round((executionDetails.actual_reps / executionDetails.planned_reps) * 100)}%
                  </Text>
                </View>
                <View className="progress-bar">
                  <View
                    className={`progress-fill ${
                      executionDetails.actual_reps >= executionDetails.planned_reps ? 'success' : 'warning'
                    }`}
                    style={{
                      width: `${Math.min((executionDetails.actual_reps / executionDetails.planned_reps) * 100, 100)}%`
                    }}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* 学员备注 */}
        {video.user_notes && (
          <View className="notes-card">
            <Text className="notes-label">学员备注</Text>
            <Text className="notes-content">"{video.user_notes}"</Text>
          </View>
        )}

        {/* 点评表单 */}
        <View className="review-form">
          <View className="form-section">
            <Text className="form-label">动作评分</Text>
            <View className={`stars-container ${video.review_status === 'reviewed' ? 'readonly' : ''}`}>
              {renderStars()}
            </View>
            {video.review_status === 'reviewed' && (
              <Text className="readonly-hint">已点评，不可修改</Text>
            )}
          </View>

          <View className="form-section">
            <Text className="form-label">点评反馈</Text>
            <Textarea
              value={comment}
              onInput={(e) => {
                if (video.review_status !== 'reviewed') {
                  setComment(e.detail.value)
                }
              }}
              placeholder={video.review_status === 'reviewed' ? '' : "请输入针对该动作的指导意见...&#10;&#10;参考要点：&#10;• 动作规范性评价&#10;• 技术要点提示&#10;• 改进建议&#10;• 训练强度建议"}
              className={`comment-input ${video.review_status === 'reviewed' ? 'readonly' : ''}`}
              maxlength={1000}
              showConfirmBar={false}
              disabled={video.review_status === 'reviewed'}
            />
          </View>
        </View>
      </ScrollView>

      {/* 底部提交按钮 */}
      {video.review_status !== 'reviewed' && (
        <View className="submit-bar">
          <Button
            className="submit-btn"
            onClick={handleSubmit}
            disabled={submitting || !comment.trim()}
            loading={submitting}
          >
            {submitting ? '提交中...' : '提交指导意见'}
          </Button>
        </View>
      )}
    </View>
  )
}

export default CoachVideosReview
