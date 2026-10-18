import { View, Text, Image, Textarea, Picker } from '@tarojs/components'
import { StableInput as Input } from '@/components/StableInput'
import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { coachService } from '@/services/coach/coachService'
import { planLibService } from '@/services/coach/planLibService'
import { subscriptionService } from '@/services/subscriptionService'
import { authService } from '@/services/authService'
import { chatService } from '@/services/chatService'
import { refundAlipayOrder } from '@/services/paymentService'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

const FITNESS_LEVEL_LABEL_MAP: Record<string, string> = {
  beginner: '零基础',
  novice: '入门',
  intermediate: '进阶',
  advanced: '高阶',
  elite: '精英 / 职业'
}

interface StudentData {
  id: string
  coach_id?: string
  student_id: string
  start_date: string
  status: string
  subscribed_weeks?: number | null
  prior_training_weeks?: number | null
  order_id?: string | null
  last_payment_order_id?: string | null
  payment_method?: string | null
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

interface CoachReview {
  id: string
  review_text?: string | null
  created_at?: string | null
  updated_at?: string | null
}

interface PlanHistoryItem {
  id: string
  name?: string | null
  description?: string | null
  source?: string | null
  status?: string | null
  start_date?: string | null
  end_date?: string | null
  updated_at?: string | null
  total_days?: number | null
  total_training_days?: number | null
  plan_span_days?: number | null
}

type PlanHistorySource = 'all' | 'coach' | 'student'

type AutomationOverride = {
  initialPlanMode: string | null
  feedbackAdjustmentMode: string | null
  nextPhaseMode: string | null
  riskGuardMode: string | null
}

const AUTOMATION_DEFAULT_OVERRIDE: AutomationOverride = {
  initialPlanMode: null,
  feedbackAdjustmentMode: null,
  nextPhaseMode: null,
  riskGuardMode: null
}

const AUTOMATION_OPTIONS = {
  initialPlanMode: [
    { value: '', label: '继承全局' },
    { value: 'auto_publish', label: '自动发放' },
    { value: 'draft', label: '生成草稿' },
    { value: 'off', label: '关闭' }
  ],
  feedbackAdjustmentMode: [
    { value: '', label: '继承全局' },
    { value: 'draft_notify', label: '草稿并通知' },
    { value: 'auto_apply_low_risk', label: '低风险自动应用' },
    { value: 'auto_apply_safe', label: '安全反馈自动应用' },
    { value: 'off', label: '关闭' }
  ],
  nextPhaseMode: [
    { value: '', label: '继承全局' },
    { value: 'draft_notify', label: '提醒教练' },
    { value: 'auto_publish_if_credits', label: '额度足够自动发布' },
    { value: 'off', label: '关闭' }
  ],
  riskGuardMode: [
    { value: '', label: '继承全局' },
    { value: 'strict', label: '严格' },
    { value: 'normal', label: '普通' }
  ]
}

type QuestionnaireItem = Record<string, any> & {
  id?: string
  type?: 'tags' | 'times' | 'rm' | 'option' | 'text' | string
  question?: string
  options?: Array<string | number>
  userSelection?: string | number
  userSelections?: string[]
  userInputs?: Record<string, number>
  answer?: string
}

const FEEDBACK_DIFFICULTY_MAP: Record<number, string> = {
  1: '太轻松',
  2: '轻松',
  3: '刚好',
  4: '有点难',
  5: '太难了'
}

function normalizeAutomationOverride(row: any): AutomationOverride {
  return {
    initialPlanMode: row?.initial_plan_mode ?? null,
    feedbackAdjustmentMode: row?.feedback_adjustment_mode ?? null,
    nextPhaseMode: row?.next_phase_mode ?? null,
    riskGuardMode: row?.risk_guard_mode ?? null
  }
}

function getAutomationOptionIndex(
  options: Array<{ value: string; label: string }>,
  value: string | null
) {
  const index = options.findIndex((item) => item.value === (value || ''))
  return index >= 0 ? index : 0
}

function getAutomationOptionLabel(
  options: Array<{ value: string; label: string }>,
  value: string | null
) {
  return options[getAutomationOptionIndex(options, value)]?.label || options[0]?.label || ''
}

export default function StudentDetailPage() {
  const { effectiveTheme } = useTheme()
  const router = useRouter()
  const subscriptionId = router.params.id as string

  const [loading, setLoading] = useState(true)
  const [student, setStudent] = useState<StudentData | null>(null)
  const [planInstance, setPlanInstance] = useState<PlanInstance | null>(null)
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [showAllFeedbacks, setShowAllFeedbacks] = useState(false)
  const [coachReviews, setCoachReviews] = useState<CoachReview[]>([])
  const [reviewDraft, setReviewDraft] = useState('')
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null)
  const [savingReview, setSavingReview] = useState(false)
  const [priorWeeksInput, setPriorWeeksInput] = useState('0')
  const [subscribedWeeksInput, setSubscribedWeeksInput] = useState('0')
  const [savingSubscriptionWeeks, setSavingSubscriptionWeeks] = useState(false)
  const [questionnaireDraft, setQuestionnaireDraft] = useState<QuestionnaireItem[]>([])
  const [questionnaireEditing, setQuestionnaireEditing] = useState(false)
  const [questionnaireLoading, setQuestionnaireLoading] = useState(false)
  const [questionnaireSaving, setQuestionnaireSaving] = useState(false)
  const [refunding, setRefunding] = useState(false)
  const [planHistory, setPlanHistory] = useState<PlanHistoryItem[]>([])
  const [planHistoryTotal, setPlanHistoryTotal] = useState(0)
  const [planHistoryLoading, setPlanHistoryLoading] = useState(false)
  const [planHistoryPage, setPlanHistoryPage] = useState(1)
  const [planHistorySource, setPlanHistorySource] = useState<PlanHistorySource>('all')
  const [automationOverride, setAutomationOverride] = useState<AutomationOverride>(AUTOMATION_DEFAULT_OVERRIDE)
  const [automationSaving, setAutomationSaving] = useState(false)

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
      const [studentRes, instanceRes, reviewsRes, automationRes] = await Promise.all([
        coachService.getStudent({ subscriptionId, need1RM: true }),
        planLibService.getInstance({ subscriptionId }),
        subscriptionService.getCoachReviews({ subscriptionId }).catch(() => null),
        coachService.getStudentAutomationOverride({ subscriptionId }).catch(() => null)
      ])

      setAutomationOverride(normalizeAutomationOverride((automationRes as any)?.override))

      if (studentRes?.student) {
        setStudent(studentRes.student)
        setPriorWeeksInput(String(studentRes.student.prior_training_weeks ?? 0))
        setSubscribedWeeksInput(String(studentRes.student.subscribed_weeks ?? 0))
        setQuestionnaireDraft(normalizeQuestionnaireData(studentRes.student.subscribe_data))
        setQuestionnaireEditing(false)
        void loadPlanHistory(studentRes.student.student_id, { page: 1, source: 'all' })
      }

      setCoachReviews(Array.isArray((reviewsRes as any)?.reviews) ? (reviewsRes as any).reviews : [])

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

  const loadPlanHistory = async (
    studentId?: string,
    options?: { page?: number; source?: PlanHistorySource; append?: boolean }
  ) => {
    if (!studentId) return
    const page = options?.page || 1
    const source = options?.source || planHistorySource
    setPlanHistoryLoading(true)
    try {
      const historyRes = await coachService.getStudentPlanHistory({
        studentId,
        page,
        limit: 5,
        source
      })
      const nextPlans = Array.isArray(historyRes?.plans) ? historyRes.plans : []
      setPlanHistory((current) => options?.append ? [...current, ...nextPlans] : nextPlans)
      setPlanHistoryTotal(Number(historyRes?.totalCount || 0))
      setPlanHistoryPage(page)
      setPlanHistorySource(source)
    } catch (error) {
      console.error('[coach/student-detail] load plan history failed:', error)
      if (!options?.append) setPlanHistory([])
      setPlanHistoryTotal(0)
    } finally {
      setPlanHistoryLoading(false)
    }
  }

  function cloneQuestionnaireItems(items: QuestionnaireItem[]) {
    return JSON.parse(JSON.stringify(items || [])) as QuestionnaireItem[]
  }

  function normalizeQuestionnaireData(data: any): QuestionnaireItem[] {
    if (Array.isArray(data)) return cloneQuestionnaireItems(data)
    if (Array.isArray(data?.answers)) {
      return data.answers.map((item: any) => ({
        type: 'text',
        question: String(item?.question || '未命名问卷项'),
        userSelection: String(item?.answer || '')
      }))
    }
    return []
  }

  const getQuestionnaireKey = (item: QuestionnaireItem) => {
    if (item.id) return `id:${item.id}`
    if (item.type === 'tags' || item.type === 'times' || item.type === 'rm') return `type:${item.type}`
    if (item.question) return `${item.type || 'text'}:${item.question}`
    return String(item.type || 'text')
  }

  const mergeQuestionnaireAnswers = (
    questions: QuestionnaireItem[],
    existingAnswers: QuestionnaireItem[]
  ) => {
    const answerMap = new Map<string, QuestionnaireItem>()
    existingAnswers.forEach((item) => answerMap.set(getQuestionnaireKey(item), item))
    return questions.map((question) => {
      const answer = answerMap.get(getQuestionnaireKey(question))
      if (!answer) return question
      if (question.type === 'tags') return { ...question, userSelections: answer.userSelections || [] }
      if (question.type === 'rm') return { ...question, userInputs: answer.userInputs || {} }
      if (question.type === 'times' || question.type === 'option' || question.type === 'text') {
        return { ...question, userSelection: answer.userSelection ?? answer.answer ?? '' }
      }
      return { ...question, ...answer }
    })
  }

  const getQuestionText = (item: QuestionnaireItem) => {
    if (item.question && String(item.question).trim()) return String(item.question)
    if (item.type === 'tags') return '训练目标/项目偏好'
    if (item.type === 'times') return '每周训练次数'
    if (item.type === 'rm') return '基础 1RM 数据'
    return '未命名问卷项'
  }

  const getAnswerText = (item: QuestionnaireItem) => {
    if (typeof item.answer === 'string' && item.answer.trim()) return item.answer
    if (item.type === 'tags') {
      const selections = Array.isArray(item.userSelections) ? item.userSelections : []
      return selections.length ? selections.join('、') : '未选择'
    }
    if (item.type === 'times') {
      return item.userSelection ? `${item.userSelection} 次/周` : '未填写'
    }
    if (item.type === 'option') {
      const options = Array.isArray(item.options) ? item.options : []
      const selectedIndex = Number(item.userSelection)
      if (Number.isInteger(selectedIndex) && options[selectedIndex] !== undefined) {
        return String(options[selectedIndex])
      }
      return item.userSelection !== undefined && item.userSelection !== '' ? String(item.userSelection) : '未填写'
    }
    if (item.type === 'rm') {
      const inputs = item.userInputs || {}
      const entries = Object.entries(inputs).filter(([, value]) => Number(value) > 0)
      return entries.length
        ? entries.map(([key, value]) => `${key}: ${value}kg`).join('、')
        : '未填写'
    }
    return item.userSelection !== undefined && item.userSelection !== ''
      ? String(item.userSelection)
      : '未填写'
  }

  const updateQuestionnaireDraftItem = (
    index: number,
    updater: (item: QuestionnaireItem) => QuestionnaireItem
  ) => {
    setQuestionnaireDraft((current) => current.map((item, itemIndex) => (
      itemIndex === index ? updater(item) : item
    )))
  }

  const handleOpenQuestionnaireEdit = async () => {
    if (!student) return
    setQuestionnaireLoading(true)
    try {
      const currentAnswers = normalizeQuestionnaireData(student.subscribe_data)
      let nextDraft = currentAnswers
      if (student.coach_id) {
        const res = await coachService.getQuestionnaires({ coachId: student.coach_id })
        const questions = normalizeQuestionnaireData((res as any)?.questionnaires)
        if (questions.length > 0) {
          nextDraft = mergeQuestionnaireAnswers(questions, currentAnswers)
        }
      }
      if (!nextDraft.length) {
        Taro.showToast({ title: '暂无可编辑问卷', icon: 'none' })
        return
      }
      setQuestionnaireDraft(nextDraft)
      setQuestionnaireEditing(true)
    } catch (error) {
      console.error('[coach/student-detail] open questionnaire edit failed:', error)
      Taro.showToast({ title: '加载问卷失败', icon: 'none' })
    } finally {
      setQuestionnaireLoading(false)
    }
  }

  const handleSaveQuestionnaire = async () => {
    if (!student?.id) return
    setQuestionnaireSaving(true)
    try {
      const saved = await subscriptionService.updateQuestionnaire({
        id: student.id,
        questionnaires: questionnaireDraft
      })
      if (!saved) throw new Error('update questionnaire failed')
      setStudent((prev) => prev ? { ...prev, subscribe_data: questionnaireDraft } : prev)
      setQuestionnaireEditing(false)
      Taro.showToast({ title: '问卷已更新', icon: 'none' })
    } catch (error) {
      console.error('[coach/student-detail] save questionnaire failed:', error)
      Taro.showToast({ title: '保存问卷失败', icon: 'none' })
    } finally {
      setQuestionnaireSaving(false)
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

  const handleOpenPlanHistoryItem = (plan: PlanHistoryItem) => {
    if (!plan?.id || !subscriptionId) {
      return
    }
    if (planInstance?.id && plan.id === planInstance.id) {
      handleEditPlan()
      return
    }
    Taro.navigateTo({
      url:
        '/coach/students/plan?id=' +
        encodeURIComponent(subscriptionId) +
        '&instanceId=' +
        encodeURIComponent(plan.id) +
        '&readonly=1'
    }).catch((err) => {
      console.error('[coach/students/detail] go history plan failed:', err)
      Taro.showToast({ title: '页面跳转失败', icon: 'none' })
    })
  }

  const getPlanSourceLabel = (source?: string | null) => {
    if (source === 'student' || source === 'self') return '学员自建'
    if (source === 'coach') return '教练计划'
    if (source === 'ai') return 'AI 生成'
    return '计划'
  }

  const getPlanStatusLabel = (status?: string | null) => {
    if (status === 'active') return '进行中'
    if (status === 'paused') return '已暂停'
    if (status === 'completed') return '已完成'
    if (status === 'archived') return '已归档'
    if (status === 'scheduled') return '待开始'
    return status || '-'
  }

  const handleChangePlanHistorySource = (source: PlanHistorySource) => {
    if (!student?.student_id || planHistoryLoading || source === planHistorySource) return
    setPlanHistory([])
    setPlanHistorySource(source)
    setPlanHistoryPage(1)
    void loadPlanHistory(student.student_id, { page: 1, source })
  }

  const handleLoadMorePlanHistory = () => {
    if (!student?.student_id || planHistoryLoading) return
    if (planHistory.length >= planHistoryTotal) return
    void loadPlanHistory(student.student_id, {
      page: planHistoryPage + 1,
      source: planHistorySource,
      append: true
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

  const handleSaveAutomationOverride = async () => {
    if (!subscriptionId) return
    setAutomationSaving(true)
    try {
      const res = await coachService.updateStudentAutomationOverride({
        subscriptionId,
        initialPlanMode: automationOverride.initialPlanMode || null,
        feedbackAdjustmentMode: automationOverride.feedbackAdjustmentMode || null,
        nextPhaseMode: automationOverride.nextPhaseMode || null,
        riskGuardMode: automationOverride.riskGuardMode || null
      })
      if (!res) throw new Error('save automation override failed')
      setAutomationOverride(normalizeAutomationOverride((res as any).override))
      Taro.showToast({ title: '自动化设置已保存', icon: 'success' })
    } catch (error) {
      console.error('[coach/student-detail] save automation override failed:', error)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setAutomationSaving(false)
    }
  }

  const normalizeWeeks = (value: string, fallback = 0) => {
    const next = Math.max(0, Math.floor(Number(value) || fallback))
    return next
  }

  const handleSaveSubscriptionWeeks = async () => {
    if (!student?.id) return
    const priorWeeks = normalizeWeeks(priorWeeksInput)
    const subscribedWeeks = normalizeWeeks(subscribedWeeksInput)
    setSavingSubscriptionWeeks(true)
    try {
      const res = await subscriptionService.updateSubscription({
        id: student.id,
        prior_training_weeks: priorWeeks,
        subscribed_weeks: subscribedWeeks
      })
      if (!res) throw new Error('update subscription failed')
      setStudent((prev) => prev ? {
        ...prev,
        prior_training_weeks: priorWeeks,
        subscribed_weeks: subscribedWeeks
      } : prev)
      Taro.showToast({ title: '订阅周期已更新', icon: 'none' })
    } catch (error) {
      console.error('[coach/student-detail] save subscription weeks failed:', error)
      Taro.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
    } finally {
      setSavingSubscriptionWeeks(false)
    }
  }

  const handleEditReview = (review: CoachReview) => {
    setEditingReviewId(review.id)
    setReviewDraft(review.review_text || '')
  }

  const handleSaveCoachReview = async () => {
    const text = reviewDraft.trim()
    if (!text) {
      Taro.showToast({ title: '请输入记录内容', icon: 'none' })
      return
    }
    if (!student?.student_id || !student?.coach_id) {
      Taro.showToast({ title: '学员或教练信息不完整', icon: 'none' })
      return
    }
    setSavingReview(true)
    try {
      const res = editingReviewId
        ? await subscriptionService.updateCoachReview({ reviewId: editingReviewId, reviewText: text })
        : await subscriptionService.createCoachReview({
          subscriptionId,
          studentId: student.student_id,
          coachId: student.coach_id,
          reviewText: text,
          mediaUrls: []
        })
      const nextReview = (res as any)?.review
      if (!nextReview) throw new Error('save review failed')
      setCoachReviews((prev) => {
        if (editingReviewId) {
          return prev.map((item) => item.id === editingReviewId ? nextReview : item)
        }
        return [nextReview, ...prev]
      })
      setReviewDraft('')
      setEditingReviewId(null)
      Taro.showToast({ title: '教练记录已保存', icon: 'none' })
    } catch (error) {
      console.error('[coach/student-detail] save coach review failed:', error)
      Taro.showToast({ title: '保存记录失败', icon: 'none' })
    } finally {
      setSavingReview(false)
    }
  }

  const handleDeleteReview = (review: CoachReview) => {
    if (!review?.id) return
    Taro.showModal({
      title: '删除教练记录',
      content: '删除后不可恢复，是否继续？',
      confirmText: '删除',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const deleted = await subscriptionService.deleteCoachReview({ reviewId: review.id })
          if (!deleted) throw new Error('delete review failed')
          setCoachReviews((prev) => prev.filter((item) => item.id !== review.id))
          if (editingReviewId === review.id) {
            setEditingReviewId(null)
            setReviewDraft('')
          }
          Taro.showToast({ title: '已删除', icon: 'none' })
        } catch (error) {
          console.error('[coach/student-detail] delete coach review failed:', error)
          Taro.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  }

  const handleRefund = () => {
    const orderId = student?.last_payment_order_id || student?.order_id
    if (!orderId || refunding) return
    Taro.showModal({
      title: '确认退款',
      content: '退款会同步取消订阅并扣减教练钱包余额，确认继续？',
      confirmText: '退款',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (!res.confirm) return
        setRefunding(true)
        try {
          const result = await refundAlipayOrder({
            orderId,
            refundReason: '教练/学员申请退款',
            showErrorToast: false
          })
          if (!result.success) throw new Error(result.message || 'refund failed')
          setStudent((prev) => prev ? {
            ...prev,
            status: 'cancelled',
            order_id: null,
            last_payment_order_id: null,
            payment_method: null
          } : prev)
          Taro.showToast({ title: '退款成功，订阅已取消', icon: 'none' })
        } catch (error) {
          console.error('[coach/student-detail] refund failed:', error)
          Taro.showToast({ title: '退款失败，请稍后重试', icon: 'none' })
        } finally {
          setRefunding(false)
        }
      }
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
  const renderQuestionnaireEditorItem = (item: QuestionnaireItem, index: number) => {
    const options = Array.isArray(item.options) ? item.options.map((option) => String(option)) : []

    if (item.type === 'tags') {
      const selections = Array.isArray(item.userSelections) ? item.userSelections : []
      return (
        <View className='question-editor-control'>
          {options.length > 0 ? (
            <View className='question-option-row'>
              {options.map((option) => {
                const active = selections.includes(option)
                return (
                  <View
                    key={`${index}-${option}`}
                    className={`question-option-chip ${active ? 'active' : ''}`}
                    onClick={() => updateQuestionnaireDraftItem(index, (current) => {
                      const currentSelections = Array.isArray(current.userSelections) ? current.userSelections : []
                      return {
                        ...current,
                        userSelections: currentSelections.includes(option)
                          ? currentSelections.filter((itemValue) => itemValue !== option)
                          : [...currentSelections, option]
                      }
                    })}
                  >
                    <Text>{option}</Text>
                  </View>
                )
              })}
            </View>
          ) : (
            <Input
              className='question-input'
              value={selections.join('、')}
              placeholder='用顿号分隔多个选项'
              onInput={(event) => updateQuestionnaireDraftItem(index, (current) => ({
                ...current,
                userSelections: event.detail.value.split(/[、,，]/).map((value) => value.trim()).filter(Boolean)
              }))}
            />
          )}
        </View>
      )
    }

    if (item.type === 'times') {
      const timesOptions = options.length > 0 ? options : ['1', '2', '3', '4', '5', '6', '7']
      return (
        <View className='question-option-row'>
          {timesOptions.map((option) => {
            const active = String(item.userSelection || '') === option
            return (
              <View
                key={`${index}-times-${option}`}
                className={`question-option-chip ${active ? 'active' : ''}`}
                onClick={() => updateQuestionnaireDraftItem(index, (current) => ({
                  ...current,
                  userSelection: Number(option)
                }))}
              >
                <Text>{option}次</Text>
              </View>
            )
          })}
        </View>
      )
    }

    if (item.type === 'option') {
      return (
        <View className='question-option-row'>
          {options.map((option, optionIndex) => {
            const active = Number(item.userSelection) === optionIndex || String(item.userSelection || '') === option
            return (
              <View
                key={`${index}-option-${option}`}
                className={`question-option-chip ${active ? 'active' : ''}`}
                onClick={() => updateQuestionnaireDraftItem(index, (current) => ({
                  ...current,
                  userSelection: optionIndex
                }))}
              >
                <Text>{option}</Text>
              </View>
            )
          })}
        </View>
      )
    }

    if (item.type === 'rm') {
      const actionKeys = Array.isArray(item.actionIds) && item.actionIds.length > 0
        ? item.actionIds
        : Object.keys(item.userInputs || {})
      return (
        <View className='rm-input-list'>
          {actionKeys.length > 0 ? actionKeys.map((actionId) => (
            <View key={`${index}-rm-${actionId}`} className='rm-input-row'>
              <Text className='rm-action-name'>{actionId}</Text>
              <Input
                className='question-input'
                type='digit'
                value={String((item.userInputs || {})[actionId] || '')}
                placeholder='kg'
                onInput={(event) => updateQuestionnaireDraftItem(index, (current) => ({
                  ...current,
                  userInputs: {
                    ...(current.userInputs || {}),
                    [actionId]: Number(event.detail.value) || 0
                  }
                }))}
              />
            </View>
          )) : (
            <Text className='question-empty'>暂无 1RM 动作项</Text>
          )}
        </View>
      )
    }

    return (
      <Textarea
        className='question-textarea'
        value={String(item.userSelection ?? item.answer ?? '')}
        placeholder='填写问卷答案'
        maxlength={1000}
        autoHeight
        onInput={(event) => updateQuestionnaireDraftItem(index, (current) => ({
          ...current,
          userSelection: event.detail.value
        }))}
      />
    )
  }

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
      <View className={`student-detail-page theme-${effectiveTheme}`}>
        <Text className='error-text'>无法加载学员信息</Text>
      </View>
    )
  }

  const profile = student.profile
  const displayedFeedbacks = showAllFeedbacks ? feedbacks : feedbacks.slice(0, 3)
  const canRefundSubscription = student.payment_method === 'platform_alipay' && Boolean(student.last_payment_order_id || student.order_id)
  const questionnaireItems = questionnaireEditing ? questionnaireDraft : normalizeQuestionnaireData(student.subscribe_data)

  return (
    <View className={`student-detail-page theme-${effectiveTheme}`}>
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
                <View className='tag tag-primary'><Text className='tag-text'>{FITNESS_LEVEL_LABEL_MAP[profile.fitness_level] || profile.fitness_level}</Text></View>
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

      <View className='automation-card'>
        <View className='card-header'>
          <Text className='card-title'>单学员自动化覆盖</Text>
          <View
            className={`btn-small-primary ${automationSaving ? 'disabled' : ''}`}
            onClick={() => {
              if (automationSaving) return
              handleSaveAutomationOverride()
            }}
          >
            <Text className='btn-text'>{automationSaving ? '保存中' : '保存'}</Text>
          </View>
        </View>
        <View className='automation-list'>
          {([
            ['initialPlanMode', '首个计划', AUTOMATION_OPTIONS.initialPlanMode],
            ['feedbackAdjustmentMode', '反馈调整', AUTOMATION_OPTIONS.feedbackAdjustmentMode],
            ['nextPhaseMode', '下一阶段', AUTOMATION_OPTIONS.nextPhaseMode],
            ['riskGuardMode', '风险保护', AUTOMATION_OPTIONS.riskGuardMode]
          ] as const).map(([key, label, options]) => (
            <View className='automation-row' key={key}>
              <Text className='automation-label'>{label}</Text>
              <Picker
                mode='selector'
                range={options.map((option) => option.label)}
                value={getAutomationOptionIndex(options, automationOverride[key])}
                onChange={(event) => {
                  const index = Number(event.detail.value || 0)
                  const nextValue = options[index]?.value || null
                  setAutomationOverride((prev) => ({
                    ...prev,
                    [key]: nextValue || null
                  }))
                }}
              >
                <View className='automation-value'>
                  <Text>{getAutomationOptionLabel(options, automationOverride[key])}</Text>
                  <Text className='automation-chevron'>›</Text>
                </View>
              </Picker>
            </View>
          ))}
        </View>
        <Text className='automation-note'>疼痛、伤病等高风险反馈始终需要教练确认。</Text>
      </View>

      <View className='questionnaire-card'>
        <View className='card-header'>
          <Text className='card-title'>入营问卷</Text>
          <View className='questionnaire-actions'>
            {questionnaireEditing ? (
              <>
                <View
                  className='btn-small-default'
                  onClick={() => {
                    setQuestionnaireDraft(normalizeQuestionnaireData(student.subscribe_data))
                    setQuestionnaireEditing(false)
                  }}
                >
                  <Text className='btn-text'>取消</Text>
                </View>
                <View
                  className={`btn-small-primary ${questionnaireSaving ? 'disabled' : ''}`}
                  onClick={() => {
                    if (questionnaireSaving) return
                    void handleSaveQuestionnaire()
                  }}
                >
                  <Text className='btn-text'>{questionnaireSaving ? '保存中...' : '保存'}</Text>
                </View>
              </>
            ) : (
              <View
                className={`btn-small-primary ${questionnaireLoading ? 'disabled' : ''}`}
                onClick={() => {
                  if (questionnaireLoading) return
                  void handleOpenQuestionnaireEdit()
                }}
              >
                <Text className='btn-text'>{questionnaireLoading ? '加载中...' : '编辑'}</Text>
              </View>
            )}
          </View>
        </View>

        {questionnaireItems.length > 0 ? (
          <View className='questionnaire-list'>
            {questionnaireItems.map((item, index) => (
              <View key={`${item.id || item.type || 'question'}-${index}`} className='questionnaire-item'>
                <View className='questionnaire-index'>
                  <Text>{String(index + 1).padStart(2, '0')}</Text>
                </View>
                <View className='questionnaire-body'>
                  <Text className='questionnaire-question'>{getQuestionText(item)}</Text>
                  {questionnaireEditing ? (
                    renderQuestionnaireEditorItem(item, index)
                  ) : (
                    <Text className='questionnaire-answer'>{getAnswerText(item)}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text className='no-data'>暂无问卷数据</Text>
        )}
      </View>

      <View className='manage-card'>
        <View className='card-header'>
          <Text className='card-title'>订阅与教练记录</Text>
          {canRefundSubscription ? (
            <View
              className={`btn-small-default danger ${refunding ? 'disabled' : ''}`}
              onClick={() => {
                if (refunding) return
                handleRefund()
              }}
            >
              <Text className='btn-text'>{refunding ? '退款中...' : '退款'}</Text>
            </View>
          ) : null}
        </View>

        <View className='week-edit-grid'>
          <View className='week-edit-field'>
            <Text className='field-label'>迁入前训练周数</Text>
            <Input
              className='week-input'
              type='number'
              value={priorWeeksInput}
              onInput={(e) => setPriorWeeksInput(e.detail.value)}
            />
          </View>
          <View className='week-edit-field'>
            <Text className='field-label'>购买周数</Text>
            <Input
              className='week-input'
              type='number'
              value={subscribedWeeksInput}
              onInput={(e) => setSubscribedWeeksInput(e.detail.value)}
            />
          </View>
        </View>
        <View
          className={`btn-primary ${savingSubscriptionWeeks ? 'disabled' : ''}`}
          onClick={() => {
            if (savingSubscriptionWeeks) return
            void handleSaveSubscriptionWeeks()
          }}
        >
          <Text className='btn-text'>{savingSubscriptionWeeks ? '保存中...' : '保存订阅周期'}</Text>
        </View>

        <View className='review-editor'>
          <Text className='field-label'>教练私密记录</Text>
          <Textarea
            className='review-textarea'
            value={reviewDraft}
            placeholder='记录阶段判断、沟通重点、伤病禁忌或后续调整依据'
            maxlength={1200}
            autoHeight
            onInput={(e) => setReviewDraft(e.detail.value)}
          />
          <View className='review-editor-actions'>
            {editingReviewId && (
              <View
                className='btn-small-default'
                onClick={() => {
                  setEditingReviewId(null)
                  setReviewDraft('')
                }}
              >
                <Text className='btn-text'>取消编辑</Text>
              </View>
            )}
            <View
              className={`btn-small-primary ${savingReview ? 'disabled' : ''}`}
              onClick={() => {
                if (savingReview) return
                void handleSaveCoachReview()
              }}
            >
              <Text className='btn-text'>{savingReview ? '保存中...' : editingReviewId ? '更新记录' : '新增记录'}</Text>
            </View>
          </View>
        </View>

        <View className='coach-review-list'>
          {coachReviews.length > 0 ? coachReviews.slice(0, 5).map((review) => (
            <View key={review.id} className='coach-review-item'>
              <Text className='coach-review-time'>{formatDateTime(review.updated_at || review.created_at || '')}</Text>
              <Text className='coach-review-content'>{review.review_text || '（空记录）'}</Text>
              <View className='review-item-actions'>
                <View className='btn-small-default' onClick={() => handleEditReview(review)}>
                  <Text className='btn-text'>编辑</Text>
                </View>
                <View className='btn-small-default danger' onClick={() => handleDeleteReview(review)}>
                  <Text className='btn-text'>删除</Text>
                </View>
              </View>
            </View>
          )) : (
            <Text className='no-data'>暂无教练记录</Text>
          )}
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

      <View className='plan-history-card'>
        <View className='card-header'>
          <Text className='card-title'>计划历史</Text>
          <Text className='history-total'>{planHistoryTotal > 0 ? `共 ${planHistoryTotal} 个` : ''}</Text>
        </View>
        <View className='history-filter-row'>
          {([
            { value: 'all', label: '全部' },
            { value: 'coach', label: '教练计划' },
            { value: 'student', label: '学员自建' }
          ] as Array<{ value: PlanHistorySource; label: string }>).map((item) => (
            <View
              key={item.value}
              className={`history-filter-chip ${planHistorySource === item.value ? 'active' : ''}`}
              onClick={() => handleChangePlanHistorySource(item.value)}
            >
              <Text>{item.label}</Text>
            </View>
          ))}
        </View>

        {planHistoryLoading && planHistory.length === 0 ? (
          <Text className='no-data'>加载计划历史中...</Text>
        ) : planHistory.length > 0 ? (
          <View className='plan-history-list'>
            {planHistory.map((plan) => (
              <View key={plan.id} className='plan-history-item' onClick={() => handleOpenPlanHistoryItem(plan)}>
                <View className='plan-history-main'>
                  <Text className='plan-history-name'>{plan.name || '未命名计划'}</Text>
                  <Text className='plan-history-desc'>{plan.description || '暂无描述'}</Text>
                </View>
                <View className='plan-history-meta-row'>
                  <Text className={`plan-history-status status-${plan.status || 'unknown'}`}>
                    {getPlanStatusLabel(plan.status)}
                  </Text>
                  <Text className='plan-history-meta'>{getPlanSourceLabel(plan.source)}</Text>
                  <Text className='plan-history-meta'>{plan.total_days || 0} 天</Text>
                  <Text className='plan-history-meta'>{formatDateTime(plan.updated_at || plan.start_date || '')}</Text>
                </View>
              </View>
            ))}
            {planHistory.length < planHistoryTotal && (
              <View className='history-more-btn' onClick={handleLoadMorePlanHistory}>
                <Text>{planHistoryLoading ? '加载中...' : '加载更多'}</Text>
              </View>
            )}
          </View>
        ) : (
          <Text className='no-data'>暂无历史计划</Text>
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
