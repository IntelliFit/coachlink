import { View, Text, Image } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { coachService } from '@/services/coach/coachService'
import { planLibService } from '@/services/coach/planLibService'
import { authService } from '@/services/authService'
import { chatService } from '@/services/chatService'
import './index.scss'

interface StudentData {
  id: string
  student_id: string
  start_date: string
  status: string
  profile: {
    nickname: string
    avatar_url: string
    full_name: string
    phone: string
    gender: string
    age: number
    height: number
    weight: number
    fitness_goal: string
    fitness_level: string
    sport_cards: any[]
  }
  subscribe_data: any[]
}

interface PlanInstance {
  id: string
  name: string
  description: string
  status: string
  progress: number
  current_day: number
  total_days: number
  start_date: string
}

interface Feedback {
  id?: string
  day_index: number
  content: string | null
  difficulty_rating?: number | null
  created_at?: string
  instance_id?: string
  coach_reply?: string | null
  is_read?: boolean
}

const FEEDBACK_DIFFICULTY_MAP: Record<number, string> = {
  1: '太轻松',
  2: '轻松',
  3: '刚好',
  4: '有点难',
  5: '太难了'
}

export default function StudentDetailPage() {
  const router = useRouter()
  const subscriptionId = router.params.id as string

  const [loading, setLoading] = useState(true)
  const [student, setStudent] = useState<StudentData | null>(null)
  const [planInstance, setPlanInstance] = useState<PlanInstance | null>(null)
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [showAllFeedbacks, setShowAllFeedbacks] = useState(false)

  useEffect(() => {
    if (!subscriptionId) {
      Taro.showToast({ title: '缺少学员参数', icon: 'none' })
      return
    }
    loadStudentData()
  }, [subscriptionId])

  const loadStudentData = async () => {
    try {
      setLoading(true)
      
      // 并行加载学员数据、计划实例
      const [studentRes, instanceRes] = await Promise.all([
        coachService.getStudent({ subscriptionId, need1RM: true }),
        planLibService.getInstance({ subscriptionId })
      ])

      if (studentRes?.student) {
        setStudent(studentRes.student)
      }

      if (instanceRes?.instance) {
        setPlanInstance(instanceRes.instance)
        
        // 加载学员反馈
        if (instanceRes.instance.id) {
          const feedbackRes = await coachService.getStudentFeedbacks({
            instanceId: instanceRes.instance.id,
            markRead: true
          })
          if (feedbackRes?.feedbacks) {
            setFeedbacks(feedbackRes.feedbacks)
          }
        }
      } else {
        setPlanInstance(null)
        setFeedbacks([])
      }
    } catch (error) {
      console.error('加载学员数据失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const openStudentChat = async (options?: { draft?: string }) => {
    const coachId = authService.getCurrentUser()?.id
    const studentId = student?.student_id
    if (!coachId || !studentId) {
      Taro.showToast({ title: '学员信息不完整', icon: 'none' })
      return
    }
    if (coachId === studentId) {
      Taro.showToast({ title: '无法与自己发起会话', icon: 'none' })
      return
    }

    const peerName = student?.profile?.nickname || student?.profile?.full_name || '学员'
    try {
      const room = await chatService.getChatroom({ members: [coachId, studentId] })
      if (!room?.id) {
        Taro.showToast({ title: '创建会话失败，请稍后重试', icon: 'none' })
        return
      }
      const draftText = (options?.draft || '').trim()
      const draftQuery = draftText ? `&draft=${encodeURIComponent(draftText.slice(0, 180))}` : ''
      await Taro.navigateTo({
        url: `/me/messages/chat/index?roomId=${room.id}&peerName=${encodeURIComponent(peerName)}${draftQuery}`
      })
    } catch (error) {
      console.error('[coach/student-detail] open chat failed:', error)
      Taro.showToast({ title: '打开会话失败，请稍后重试', icon: 'none' })
    }
  }

  const buildFeedbackDraft = (feedback: Feedback) => {
    const dayText = Number.isFinite(Number(feedback.day_index)) && Number(feedback.day_index) > 0
      ? `第${Math.floor(Number(feedback.day_index))}天`
      : '当天训练'
    const difficultyText = feedback.difficulty_rating
      ? `难度反馈：${FEEDBACK_DIFFICULTY_MAP[feedback.difficulty_rating] || `${feedback.difficulty_rating}/5`}`
      : ''
    const contentText = (feedback.content || '').trim()
    return [
      `我看到了你 ${dayText} 的训练反馈。`,
      difficultyText,
      contentText ? `你写到：${contentText}` : ''
    ].filter(Boolean).join('\n')
  }

  const handleWriteFeedback = () => {
    void openStudentChat()
  }

  const handleReplyFeedback = async (feedback: Feedback) => {
    void openStudentChat({ draft: buildFeedbackDraft(feedback) })
  }

  const handleGoPlanWithFeedbackDay = (feedback: Feedback) => {
    if (!subscriptionId) return
    const day = Number(feedback.day_index)
    const hasValidDay = Number.isFinite(day) && day > 0
    Taro.navigateTo({
      url:
        '/coach/students/plan?id=' +
        encodeURIComponent(subscriptionId) +
        (hasValidDay ? '&focusDay=' + encodeURIComponent(String(Math.floor(day))) : '') +
        '&openFeedback=1'
    }).catch((err) => {
      console.error('[coach/students/detail] go plan with feedback day failed:', err)
      Taro.showToast({ title: '页面跳转失败', icon: 'none' })
    })
  }

  const handleEditPlan = () => {
    if (!subscriptionId || !planInstance) {
      return
    }
    Taro.navigateTo({
      url: '/coach/students/plan?id=' + encodeURIComponent(subscriptionId)
    }).catch((err) => {
      console.error('[coach/students/detail] go plan failed:', err)
      Taro.showToast({ title: '页面跳转失败', icon: 'none' })
    })
  }

  const handleAssignPlan = () => {
    if (!subscriptionId) {
      Taro.showToast({ title: '缺少学员参数', icon: 'none' })
      return
    }
    Taro.navigateTo({
      url:
        '/coach/students/assign-plan?subscriptionId=' +
        encodeURIComponent(subscriptionId) +
        '&studentId=' +
        encodeURIComponent(student?.student_id || '')
    }).catch((err) => {
      console.error('[coach/students/detail] go assign plan failed:', err)
      Taro.showToast({ title: '页面跳转失败', icon: 'none' })
    })
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return dateString
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDifficultyLabel = (rating?: number) => {
    if (!rating) return ''
    const map: Record<number, string> = {
      1: '太轻松',
      2: '轻松',
      3: '刚好',
      4: '有点难',
      5: '太难了'
    }
    return map[rating] || ''
  }

  // 渲染骨架屏
  const renderSkeleton = () => (
    <View className='skeleton-page'>
      <View className='skeleton-card'>
        <View className='skeleton-header'>
          <View className='skeleton-avatar' />
          <View className='skeleton-info'>
            <View className='skeleton-line' style={{ width: '40%' }} />
            <View className='skeleton-line' style={{ width: '60%' }} />
          </View>
        </View>
      </View>
      <View className='skeleton-card'>
        <View className='skeleton-line' style={{ width: '30%' }} />
        <View className='skeleton-line' style={{ width: '80%' }} />
        <View className='skeleton-line' style={{ width: '70%' }} />
      </View>
    </View>
  )

  if (loading) {
    return renderSkeleton()
  }

  if (!student) {
    return (
      <View className='student-detail-page'>
        <Text className='error-text'>无法加载学员信息</Text>
      </View>
    )
  }

  const profile = student.profile
  const displayedFeedbacks = showAllFeedbacks ? feedbacks : feedbacks.slice(0, 3)

  return (
    <View className='student-detail-page'>
      {/* 学员基本信息卡片 */}
      <View className='info-card'>
        <View className='profile-header'>
          <View className='avatar-wrapper'>
            {profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                mode='aspectFill'
                className='avatar-image'
              />
            ) : (
              <View className='avatar-placeholder'>
                <Text className='avatar-text'>
                  {(profile?.nickname || 'U').charAt(0)}
                </Text>
              </View>
            )}
          </View>
          <View className='profile-info'>
            <Text className='name'>{profile?.nickname || profile?.full_name || '未命名学员'}</Text>
            <View className='profile-tags'>
              {profile?.gender && (
                <View className='tag'><Text className='tag-text'>{profile.gender === 'male' ? '男' : '女'}</Text></View>
              )}
              {profile?.age && (
                <View className='tag'><Text className='tag-text'>{profile.age}岁</Text></View>
              )}
              {profile?.fitness_level && (
                <View className='tag tag-primary'><Text className='tag-text'>{profile.fitness_level}</Text></View>
              )}
            </View>
          </View>
        </View>

        <View className='divider' />

        <View className='profile-details'>
          {profile?.height && profile?.weight && (
            <View className='detail-item'>
              <Text className='label'>身高/体重</Text>
              <Text className='value'>{profile.height}cm / {profile.weight}kg</Text>
            </View>
          )}
          {profile?.fitness_goal && (
            <View className='detail-item'>
              <Text className='label'>健身目标</Text>
              <Text className='value'>{profile.fitness_goal}</Text>
            </View>
          )}
          <View className='detail-item'>
            <Text className='label'>订阅开始</Text>
            <Text className='value'>{formatDate(student.start_date)}</Text>
          </View>
        </View>
      </View>

      {/* 当前计划卡片 */}
      <View className='plan-card'>
        <View className='card-header'>
          <Text className='card-title'>当前计划</Text>
        </View>
        
        {planInstance ? (
          <View className='plan-content'>
            <View className='plan-header'>
              <Text className='plan-name'>{planInstance.name}</Text>
              <View
                className={`status-tag ${
                  planInstance.status === 'active'
                    ? 'status-active'
                    : planInstance.status === 'paused'
                      ? 'status-paused'
                      : 'status-paused'
                }`}
              >
                <Text className='status-text'>
                  {planInstance.status === 'active'
                    ? '进行中'
                    : planInstance.status === 'paused'
                      ? '已暂停'
                      : '已完成'}
                </Text>
              </View>
            </View>
            
            <View className='progress-section'>
              <View className='progress-header'>
                <Text className='progress-text'>完成进度</Text>
                <Text className='progress-value'>{planInstance.progress || 0}%</Text>
              </View>
              <View className='progress-bar'>
                <View 
                  className='progress-fill' 
                  style={{ width: `${planInstance.progress || 0}%` }}
                />
              </View>
              <Text className='progress-detail'>
                第 {planInstance.current_day || 0} 天 / 共 {planInstance.total_days || 0} 天
              </Text>
            </View>

            <View className='btn-primary' onClick={handleEditPlan}>
              <Text className='btn-text'>编辑计划</Text>
            </View>
          </View>
        ) : (
          <View className='no-plan'>
            <Text className='no-plan-text'>暂无进行中的计划</Text>
            <View className='btn-primary' onClick={handleAssignPlan}>
              <Text className='btn-text'>分配计划</Text>
            </View>
          </View>
        )}
      </View>

      {/* 学员反馈卡片 */}
      <View className='feedbacks-card'>
        <View className='card-header'>
          <Text className='card-title'>学员反馈</Text>
          <View className='btn-small-primary' onClick={handleWriteFeedback}>
            <Text className='btn-text'>联系学员</Text>
          </View>
        </View>
        
        {feedbacks.length > 0 ? (
          <View className='feedback-list'>
            {displayedFeedbacks.map((feedback, idx) => (
              <View key={`${feedback.day_index}-${feedback.created_at || idx}`} className='feedback-item'>
                <View className='feedback-header'>
                  <Text className='feedback-day'>第 {feedback.day_index} 天</Text>
                  <Text className='feedback-date'>{formatDateTime(feedback.created_at || '')}</Text>
                  {feedback.difficulty_rating && (
                    <View className='difficulty-tag'>
                      <Text className='tag-text'>{getDifficultyLabel(feedback.difficulty_rating)}</Text>
                    </View>
                  )}
                </View>
                <Text className='feedback-content'>{feedback.content || '（无文字反馈）'}</Text>
                {feedback.coach_reply && (
                  <View className='coach-reply'>
                    <Text className='reply-label'>教练回复</Text>
                    <Text className='reply-content'>{feedback.coach_reply}</Text>
                  </View>
                )}
                
                <View className='reply-section'>
                  <View className='btn-small-default' onClick={() => handleGoPlanWithFeedbackDay(feedback)}>
                    <Text className='btn-text'>定位计划日</Text>
                  </View>
                  <View className='btn-small-primary' onClick={() => void handleReplyFeedback(feedback)}>
                    <Text className='btn-text'>继续沟通</Text>
                  </View>
                </View>
              </View>
            ))}
            
            {feedbacks.length > 3 && (
              <View 
                className='show-more' 
                onClick={() => setShowAllFeedbacks(!showAllFeedbacks)}
              >
                <Text className='show-more-text'>
                  {showAllFeedbacks ? '收起' : `查看全部 ${feedbacks.length} 条反馈`}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <Text className='no-data'>暂无反馈</Text>
        )}
      </View>

      {/* 底部占位 */}
      <View className='bottom-spacer' />
    </View>
  )
}
