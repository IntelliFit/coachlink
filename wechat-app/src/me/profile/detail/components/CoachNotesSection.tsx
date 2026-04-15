import React, { useState, useEffect } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { Skeleton } from '@nutui/nutui-react-taro'
import { Icon } from '@/components/Icon'
import { MessageSquare, ChevronDown } from 'lucide-react'
import { subscriptionService } from '@/services/subscriptionService'
import { coachService } from '@/services/coach/coachService'
import './CoachNotesSection.scss'

interface CoachNotesSectionProps {
  data: any
  userId: string
}

interface ReviewWithCoach {
  id: string
  coach_id?: string
  review_text?: string
  created_at?: string
  coach?: {
    name?: string
    avatar_url?: string
  }
}

const CoachNotesSection: React.FC<CoachNotesSectionProps> = ({ data, userId }) => {
  const [reviews, setReviews] = useState<ReviewWithCoach[]>([])
  const [loading, setLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    loadReviews()
  }, [userId])

  const loadReviews = async () => {
    try {
      setLoading(true)
      const res = await subscriptionService.getCoachReviews({ studentId: userId })
      if (res?.reviews) {
        // 获取每个评价对应的教练信息
        const reviewsWithCoachInfo = await Promise.all(
          res.reviews.map(async (review: any) => {
            let coach: any = null
            if (review.coach_id) {
              try {
                const coachRes = await coachService.getCoach({ id: review.coach_id })
                if (coachRes?.coach) {
                  coach = coachRes.coach
                }
              } catch (error) {
                console.error('获取教练信息失败:', error)
              }
            }
            return {
              ...review,
              coach
            }
          })
        )
        setReviews(reviewsWithCoachInfo)
      }
    } catch (error) {
      console.error('获取教练评价失败:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View className="coach-notes-section">
        <Skeleton animated rows={2} title={false} visible={false} className="coach-notes-skeleton" />
      </View>
    )
  }

  if (!reviews || reviews.length === 0) {
    return null
  }

  // 格式化日期
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  const latest = reviews[0]
  const rest = reviews.slice(1)

  return (
    <View className="coach-notes-section">
      <View className="section-header">
        <View className="header-left">
          <Icon component={MessageSquare} size={18} className="section-icon" />
          <Text className="section-title">教练评语</Text>
        </View>
        <Text className="review-count">{reviews.length} 条</Text>
      </View>

      {/* 最新评语 */}
      <View className="note-card latest">
        <View className="note-header">
          {latest.coach?.avatar_url ? (
            <Image 
              src={latest.coach.avatar_url} 
              mode="aspectFill"
              className="coach-avatar"
            />
          ) : (
            <View className="coach-avatar placeholder">
              <Text className="avatar-text">
                {latest.coach?.name?.charAt(0) || '教'}
              </Text>
            </View>
          )}
          <View className="coach-info">
            <Text className="coach-name">{latest.coach?.name || '教练'}</Text>
            <Text className="note-date">{formatDate(latest.created_at)}</Text>
          </View>
        </View>
        <Text className="note-content">{latest.review_text || latest.content || ''}</Text>
      </View>

      {/* 其他评语（可折叠） */}
      {rest.length > 0 && (
        <View className="rest-notes">
          <View 
            className="expand-trigger"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Text className="expand-text">
              {isExpanded ? '收起' : '查看全部评语'}
            </Text>
            <Icon 
              component={ChevronDown} 
              size={14}
              className={`expand-icon ${isExpanded ? 'expanded' : ''}`}
            />
          </View>

          <View className={`rest-notes-list ${isExpanded ? 'expanded' : ''}`}>
            {rest.map((note) => (
              <View key={note.id} className="note-card">
                <View className="note-header">
                  {note.coach?.avatar_url ? (
                    <Image 
                      src={note.coach.avatar_url} 
                      mode="aspectFill"
                      className="coach-avatar small"
                    />
                  ) : (
                    <View className="coach-avatar placeholder small">
                      <Text className="avatar-text">
                        {note.coach?.name?.charAt(0) || '教'}
                      </Text>
                    </View>
                  )}
                  <View className="coach-info">
                    <Text className="coach-name">{note.coach?.name || '教练'}</Text>
                    <Text className="note-date">{formatDate(note.created_at)}</Text>
                  </View>
                </View>
                <Text className="note-content">{note.review_text || note.content || ''}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

export default CoachNotesSection
