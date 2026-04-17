import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Input, Image } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { coachService } from '@/services/coach/coachService'
import { planLibService } from '@/services/coach/planLibService'
import { subscriptionService } from '@/services/subscriptionService'
import { authService } from '@/services/authService'
import { chatService } from '@/services/chatService'
import './index.scss'

type SortMode = 'subscription_created_desc' | 'subscription_created_asc' | 'subscription_updated_desc'
type PaymentTab = 'pending' | 'history'

interface StudentListResponse {
  students: any[]
  total?: number
  pagination?: {
    page: number
    limit: number
    total: number
  }
}

interface WaitingSubscriptionsResponse {
  manualSubscriptions: any[]
  systemSubscriptions: any[]
}

const PAGE_SIZE = 10

const SORT_OPTIONS: Array<{ label: string; value: SortMode }> = [
  { label: '订阅时间（新->旧）', value: 'subscription_created_desc' },
  { label: '订阅时间（旧->新）', value: 'subscription_created_asc' },
  { label: '最近更新', value: 'subscription_updated_desc' }
]

function CoachStudents() {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalRecords, setTotalRecords] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('subscription_created_desc')
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)

  const [manualWaitingCount, setManualWaitingCount] = useState(0)
  const [systemWaitingCount, setSystemWaitingCount] = useState(0)
  const [paymentDialogVisible, setPaymentDialogVisible] = useState(false)
  const [paymentTab, setPaymentTab] = useState<PaymentTab>('pending')
  const [waitingLoading, setWaitingLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)
  const [manualWaitingSubscriptions, setManualWaitingSubscriptions] = useState<any[]>([])
  const [systemWaitingSubscriptions, setSystemWaitingSubscriptions] = useState<any[]>([])
  const [paymentHistorySubscriptions, setPaymentHistorySubscriptions] = useState<any[]>([])
  const [selectedManualIds, setSelectedManualIds] = useState<string[]>([])

  const [bulkAiGenerating, setBulkAiGenerating] = useState(false)
  const [aiGeneratingStudentId, setAiGeneratingStudentId] = useState<string | null>(null)
  const [excludedNoPlanIds, setExcludedNoPlanIds] = useState<string[]>([])

  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE))
  const waitingTotal = manualWaitingCount + systemWaitingCount

  const currentSortLabel = useMemo(() => {
    return SORT_OPTIONS.find((item) => item.value === sortMode)?.label || '订阅时间（新->旧）'
  }, [sortMode])

  const selectedManualRows = useMemo(() => {
    if (!selectedManualIds.length) return []
    const selectedSet = new Set(selectedManualIds)
    return manualWaitingSubscriptions.filter((item) => selectedSet.has(String(item?.id || '')))
  }, [manualWaitingSubscriptions, selectedManualIds])

  const studentMapByStudentId = useMemo(() => {
    const map = new Map<string, any>()
    students.forEach((item) => {
      const key = String(item?.student_id || '')
      if (key) {
        map.set(key, item)
      }
    })
    return map
  }, [students])

  const noPlanStudentIdsOnPage = useMemo(() => {
    return students
      .filter((item) => !item?.plan)
      .map((item) => String(item?.id || ''))
      .filter(Boolean)
  }, [students])

  const selectedNoPlanIdsOnPage = useMemo(() => {
    if (!noPlanStudentIdsOnPage.length) return []
    const excludedSet = new Set(excludedNoPlanIds)
    return noPlanStudentIdsOnPage.filter((id) => !excludedSet.has(id))
  }, [excludedNoPlanIds, noPlanStudentIdsOnPage])

  const allNoPlanSelectedOnPage = useMemo(() => {
    return noPlanStudentIdsOnPage.length > 0 && selectedNoPlanIdsOnPage.length === noPlanStudentIdsOnPage.length
  }, [noPlanStudentIdsOnPage.length, selectedNoPlanIdsOnPage.length])

  const loadWaitingData = useCallback(async (options?: { showLoading?: boolean }) => {
    try {
      if (options?.showLoading) {
        setWaitingLoading(true)
      }

      const waitingRes = await coachService.getPaymentWaitingStudents() as WaitingSubscriptionsResponse | null
      const manual = Array.isArray(waitingRes?.manualSubscriptions) ? waitingRes?.manualSubscriptions : []
      const system = Array.isArray(waitingRes?.systemSubscriptions) ? waitingRes?.systemSubscriptions : []

      setManualWaitingSubscriptions(manual)
      setSystemWaitingSubscriptions(system)
      setManualWaitingCount(manual.length)
      setSystemWaitingCount(system.length)

      const validIds = new Set(manual.map((item) => String(item?.id || '')))
      setSelectedManualIds((prev) => prev.filter((id) => validIds.has(id)))
    } catch (error) {
      console.error('[coach/students] load waiting data failed:', error)
      setManualWaitingSubscriptions([])
      setSystemWaitingSubscriptions([])
      setManualWaitingCount(0)
      setSystemWaitingCount(0)
      setSelectedManualIds([])
    } finally {
      if (options?.showLoading) {
        setWaitingLoading(false)
      }
    }
  }, [])

  const loadPaymentHistory = useCallback(async () => {
    try {
      setHistoryLoading(true)
      const res = await coachService.getPaymentConfirmationHistory({ limit: 50 })
      const rows = Array.isArray(res?.subscriptions) ? res.subscriptions : []
      setPaymentHistorySubscriptions(rows)
    } catch (error) {
      console.error('[coach/students] load payment history failed:', error)
      setPaymentHistorySubscriptions([])
      Taro.showToast({ title: '加载历史失败', icon: 'none' })
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  const loadStudents = useCallback(async (
    options?: {
      targetPage?: number
      showPageLoading?: boolean
      skipWaitingCounts?: boolean
    }
  ) => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({ url: '/auth/login?returnTo=' + encodeURIComponent('/coach/students') })
      return
    }

    const targetPage = options?.targetPage ?? page
    const showPageLoading = options?.showPageLoading ?? true

    try {
      if (showPageLoading) {
        setLoading(true)
      }

      const res = await coachService.listStudents({
        pagination: { page: targetPage, limit: PAGE_SIZE },
        search: debouncedSearch || undefined,
        sort: { mode: sortMode }
      }) as StudentListResponse | null

      const nextStudents = Array.isArray(res?.students) ? res?.students : []
      const nextTotal = Number(res?.pagination?.total ?? res?.total ?? 0)

      setStudents(nextStudents)
      setTotalRecords(Number.isFinite(nextTotal) ? nextTotal : 0)

      if (!nextStudents.some((item) => item?.id === expandedStudentId)) {
        setExpandedStudentId(null)
      }

      if (!options?.skipWaitingCounts) {
        await loadWaitingData({ showLoading: false })
      }
    } catch (error) {
      console.error('[coach/students] load failed:', error)
      setStudents([])
      setTotalRecords(0)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      if (showPageLoading) {
        setLoading(false)
      }
    }
  }, [debouncedSearch, expandedStudentId, loadWaitingData, page, sortMode])

  useDidShow(() => {
    void loadStudents({ targetPage: page, showPageLoading: true })
  })

  usePullDownRefresh(() => {
    loadStudents({ targetPage: page, showPageLoading: false, skipWaitingCounts: false })
      .finally(() => Taro.stopPullDownRefresh())
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextSearch = (searchInput || '').trim()
      if (nextSearch !== debouncedSearch) {
        setDebouncedSearch(nextSearch)
        setPage(0)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [debouncedSearch, searchInput])

  useEffect(() => {
    void loadStudents({ targetPage: page, showPageLoading: true })
  }, [debouncedSearch, sortMode, page])

  useEffect(() => {
    if (!paymentDialogVisible) return
    if (paymentTab !== 'history') return
    void loadPaymentHistory()
  }, [loadPaymentHistory, paymentDialogVisible, paymentTab])

  const getStudentName = useCallback((student: any) => {
    return student?.profile?.nickname || student?.profile?.full_name || student?.student_id || '学员'
  }, [])

  const getStudentIdLabel = useCallback((student: any) => {
    const raw = String(student?.id || student?.student_id || '').trim()
    if (!raw) return '--'
    return raw.slice(0, 8).toUpperCase()
  }, [])

  const getTierLabel = useCallback((tier: number) => {
    const t = Number(tier)
    if (t === 3) return '全能指导'
    if (t === 2) return '专业指导'
    return '特惠版'
  }, [])

  const getPlanStatus = useCallback((student: any) => {
    const plan = student?.plan
    if (!plan) return '未配置'
    if (plan?.status === 'completed') return '已完成'
    if (plan?.status === 'paused') return '已暂停'
    return '进行中'
  }, [])

  const getProgressPercent = useCallback((student: any) => {
    const plan = student?.plan
    if (plan?.status === 'completed') return 100
    const completed = Number(student?.progress?.completed || 0)
    const total = Number(student?.progress?.total || 0)
    if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) return 0
    return Math.max(0, Math.min(100, Math.round((completed / total) * 100)))
  }, [])

  const getWaitingStudentName = useCallback((subscription: any) => {
    const studentId = String(subscription?.student_id || '')
    if (studentId && studentMapByStudentId.has(studentId)) {
      return getStudentName(studentMapByStudentId.get(studentId))
    }
    if (studentId) return `学员 ${studentId.slice(0, 6).toUpperCase()}`
    return '学员'
  }, [getStudentName, studentMapByStudentId])

  const getWaitingStudentAvatar = useCallback((subscription: any) => {
    const studentId = String(subscription?.student_id || '')
    if (studentId && studentMapByStudentId.has(studentId)) {
      return String(studentMapByStudentId.get(studentId)?.profile?.avatar_url || '')
    }
    return ''
  }, [studentMapByStudentId])

  const formatDateTime = useCallback((value: any) => {
    if (!value) return '--'
    const dt = new Date(value)
    if (Number.isNaN(dt.getTime())) return '--'
    const yyyy = dt.getFullYear()
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const dd = String(dt.getDate()).padStart(2, '0')
    const hh = String(dt.getHours()).padStart(2, '0')
    const min = String(dt.getMinutes()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`
  }, [])

  const getMoneyYuanText = useCallback((value: any, unit?: string) => {
    const amount = Number(value || 0)
    if (!Number.isFinite(amount) || amount <= 0) return ''
    const fen = unit === 'yuan' ? Math.round(amount * 100) : Math.round(amount)
    return `¥${(fen / 100).toFixed(2)}`
  }, [])

  const goDetail = useCallback((student: any) => {
    if (!student?.id) {
      Taro.showToast({ title: '学员数据异常，请刷新重试', icon: 'none' })
      return
    }
    Taro.navigateTo({
      url: '/coach/students/detail?id=' + encodeURIComponent(student.id) + '&studentId=' + encodeURIComponent(student.student_id || '')
    }).catch((error) => {
      console.error('[coach/students] go detail failed:', error)
      Taro.showToast({ title: '页面跳转失败', icon: 'none' })
    })
  }, [])

  const goPlan = useCallback((student: any) => {
    if (!student?.id) {
      Taro.showToast({ title: '学员数据异常，请刷新重试', icon: 'none' })
      return
    }
    Taro.navigateTo({
      url: '/coach/students/plan?id=' + encodeURIComponent(student.id)
    }).catch((error) => {
      console.error('[coach/students] go plan failed:', error)
      Taro.showToast({ title: '页面跳转失败', icon: 'none' })
    })
  }, [])

  const contactStudent = useCallback(async (student: any) => {
    const coachId = authService.getCurrentUser()?.id
    const studentId = student?.student_id
    if (!coachId || !studentId) {
      Taro.showToast({ title: '学员信息异常，请刷新重试', icon: 'none' })
      return
    }
    if (coachId === studentId) {
      Taro.showToast({ title: '无法与自己发起会话', icon: 'none' })
      return
    }

    const peerName = student?.profile?.full_name || student?.profile?.nickname || '学员'
    try {
      const room = await chatService.getChatroom({ members: [coachId, studentId] })
      if (!room?.id) {
        Taro.showToast({ title: '创建会话失败，请稍后重试', icon: 'none' })
        return
      }
      await Taro.navigateTo({
        url: `/me/messages/chat/index?roomId=${room.id}&peerName=${encodeURIComponent(peerName)}`
      })
    } catch (error) {
      console.error('[coach/students] contact student failed:', error)
      Taro.showToast({ title: '打开会话失败，请稍后重试', icon: 'none' })
    }
  }, [])

  const buildUpdateDataForConfirm = useCallback((subscription: any) => {
    const paymentData = subscription?.payment_data
    const offlinePayment = paymentData?.offline_payment
    const pendingRenew = paymentData?.pending_renew

    const updateData: Record<string, any> = {
      id: subscription?.id,
      status: 'active'
    }

    if (offlinePayment?.expires_at) {
      updateData.end_date = offlinePayment.expires_at
    }

    const weeks = Number(pendingRenew?.additional_weeks || 0)
    if (weeks > 0) {
      updateData.subscribed_weeks = Number(subscription?.subscribed_weeks || 0) + weeks

      const base = subscription?.end_date ? new Date(subscription.end_date) : new Date()
      const now = new Date()
      const effectiveBase = base.getTime() < now.getTime() ? now : base
      effectiveBase.setDate(effectiveBase.getDate() + weeks * 7)
      updateData.end_date = effectiveBase.toISOString()
    }

    if (
      weeks <= 0 &&
      !offlinePayment?.expires_at &&
      subscription?.end_date &&
      new Date(subscription.end_date).getTime() <= Date.now()
    ) {
      updateData.end_date = null
    }

    if (paymentData && typeof paymentData === 'object' && !Array.isArray(paymentData)) {
      updateData.payment_data = {
        ...paymentData,
        pending_renew: null
      }
    }

    return updateData
  }, [])

  const confirmManualSubscriptions = useCallback(async (ids: string[], closeAfter: boolean) => {
    if (!ids.length) {
      Taro.showToast({ title: '请先选择待确认学员', icon: 'none' })
      return
    }

    const targets = manualWaitingSubscriptions.filter((item) => ids.includes(String(item?.id || '')))
    if (!targets.length) {
      Taro.showToast({ title: '待确认数据已更新，请重试', icon: 'none' })
      return
    }

    setPaymentSubmitting(true)
    try {
      await Promise.all(targets.map((subscription) => {
        const updateData = buildUpdateDataForConfirm(subscription)
        return subscriptionService.updateSubscription(updateData as any)
      }))

      Taro.showToast({ title: `已确认 ${targets.length} 位学员`, icon: 'none' })
      setSelectedManualIds([])

      await Promise.all([
        loadWaitingData({ showLoading: false }),
        loadStudents({ targetPage: page, showPageLoading: false, skipWaitingCounts: true })
      ])

      if (paymentTab === 'history') {
        await loadPaymentHistory()
      }

      if (closeAfter) {
        setPaymentDialogVisible(false)
      }
    } catch (error) {
      console.error('[coach/students] confirm manual payment failed:', error)
      Taro.showToast({ title: '确认失败，请稍后重试', icon: 'none' })
    } finally {
      setPaymentSubmitting(false)
    }
  }, [buildUpdateDataForConfirm, loadPaymentHistory, loadStudents, loadWaitingData, manualWaitingSubscriptions, page, paymentTab])

  const dismissSystemSubscription = useCallback(async (subscriptionId: string) => {
    if (!subscriptionId) return
    setPaymentSubmitting(true)
    try {
      await subscriptionService.updateSubscription({
        id: subscriptionId,
        coach_seen_at: new Date().toISOString()
      })
      await loadWaitingData({ showLoading: false })
      Taro.showToast({ title: '已忽略该通知', icon: 'none' })
    } catch (error) {
      console.error('[coach/students] dismiss system waiting failed:', error)
      Taro.showToast({ title: '忽略失败，请稍后重试', icon: 'none' })
    } finally {
      setPaymentSubmitting(false)
    }
  }, [loadWaitingData])

  const markAllSystemAsSeen = useCallback(async () => {
    if (!systemWaitingSubscriptions.length) return
    const nowIso = new Date().toISOString()
    try {
      await Promise.all(systemWaitingSubscriptions.map((item) => (
        subscriptionService.updateSubscription({
          id: item?.id,
          coach_seen_at: nowIso
        })
      )))
      await loadWaitingData({ showLoading: false })
    } catch (error) {
      console.error('[coach/students] mark all system seen failed:', error)
    }
  }, [loadWaitingData, systemWaitingSubscriptions])

  const handleToggleExpand = useCallback((studentId: string) => {
    setExpandedStudentId((prev) => (prev === studentId ? null : studentId))
  }, [])

  const handlePickSort = useCallback(() => {
    const itemList = SORT_OPTIONS.map((item) => `${item.value === sortMode ? '✓ ' : ''}${item.label}`)
    Taro.showActionSheet({
      itemList,
      success: (res) => {
        const selected = SORT_OPTIONS[res.tapIndex]
        if (!selected) return
        if (selected.value !== sortMode) {
          setSortMode(selected.value)
          setPage(0)
        }
      }
    })
  }, [sortMode])

  const handleOpenPaymentDialog = useCallback(async () => {
    setPaymentDialogVisible(true)
    setPaymentTab('pending')
    await loadWaitingData({ showLoading: true })
  }, [loadWaitingData])

  const handleClosePaymentDialog = useCallback(async () => {
    setPaymentDialogVisible(false)
    setSelectedManualIds([])
    setPaymentTab('pending')
    await markAllSystemAsSeen()
  }, [markAllSystemAsSeen])

  const handleToggleManualSelect = useCallback((subscriptionId: string) => {
    setSelectedManualIds((prev) => {
      if (prev.includes(subscriptionId)) {
        return prev.filter((id) => id !== subscriptionId)
      }
      return [...prev, subscriptionId]
    })
  }, [])

  const handleSelectAllManual = useCallback(() => {
    if (!manualWaitingSubscriptions.length) return
    const allIds = manualWaitingSubscriptions.map((item) => String(item?.id || '')).filter(Boolean)
    if (selectedManualIds.length >= allIds.length) {
      setSelectedManualIds([])
      return
    }
    setSelectedManualIds(allIds)
  }, [manualWaitingSubscriptions, selectedManualIds.length])

  const handleToggleNoPlanSelect = useCallback((subscriptionId: string) => {
    if (!subscriptionId) return
    setExcludedNoPlanIds((prev) => {
      const set = new Set(prev)
      if (set.has(subscriptionId)) {
        set.delete(subscriptionId)
      } else {
        set.add(subscriptionId)
      }
      return Array.from(set)
    })
  }, [])

  const handleToggleSelectAllNoPlanOnPage = useCallback(() => {
    if (!noPlanStudentIdsOnPage.length) return
    setExcludedNoPlanIds((prev) => {
      const set = new Set(prev)
      if (allNoPlanSelectedOnPage) {
        noPlanStudentIdsOnPage.forEach((id) => set.add(id))
      } else {
        noPlanStudentIdsOnPage.forEach((id) => set.delete(id))
      }
      return Array.from(set)
    })
  }, [allNoPlanSelectedOnPage, noPlanStudentIdsOnPage])

  const extractReceiptInfoFromNote = useCallback((rawNote: string) => {
    const note = String(rawNote || '').trim()
    if (!note) return { cleanNote: '', receiptUrl: '' }

    const receiptMatch = note.match(/付款凭证[:：]\s*(https?:\/\/[^\s]+)/)
    if (!receiptMatch) {
      return { cleanNote: note, receiptUrl: '' }
    }

    const receiptUrl = String(receiptMatch?.[1] || '').trim()
    const cleanNote = note.replace(/付款凭证[:：]\s*https?:\/\/[^\s]+/g, '').trim()
    return { cleanNote, receiptUrl }
  }, [])

  const getPaymentTypeMeta = useCallback((subscription: any, kind: 'manual' | 'system' | 'history') => {
    const offlinePayment = subscription?.payment_data?.offline_payment
    if (kind === 'system') {
      if (String(subscription?.status || '') === 'inactive') {
        return { label: '平台待支付', className: 'info' }
      }
      return { label: '平台已确认', className: 'success' }
    }
    if (offlinePayment) {
      return { label: '线下已支付', className: 'warning' }
    }
    return { label: '扫码支付', className: 'info' }
  }, [])

  const handleAiGenerateStudent = useCallback(async (student: any) => {
    const subscriptionId = String(student?.id || '')
    if (!subscriptionId) {
      Taro.showToast({ title: '学员数据异常，请刷新后重试', icon: 'none' })
      return
    }
    if (student?.plan) {
      Taro.showToast({ title: '该学员已有计划', icon: 'none' })
      return
    }

    setAiGeneratingStudentId(subscriptionId)
    try {
      const res = await planLibService.createAiInstance({
        subscriptionId,
        startWeek: 1,
        startDay: 1,
        keepOriginalIndex: true
      })

      if (!res?.template) {
        Taro.showToast({ title: '生成失败，请稍后重试', icon: 'none' })
        return
      }

      const templateName = String(res.template?.name || '').trim()
      const fallbackName = `${getStudentName(student)}的计划`
      const nextName = templateName && !/AI\s*生成计划/.test(templateName) ? templateName : fallbackName

      setStudents((prev) => prev.map((item) => {
        if (String(item?.id || '') !== subscriptionId) return item
        return {
          ...item,
          plan: {
            name: nextName,
            description: res.template?.description || '暂无描述',
            status: res.template?.status || 'active'
          }
        }
      }))

      Taro.showToast({ title: 'AI 生成成功', icon: 'none' })
    } catch (error: any) {
      console.error('[coach/students] create ai instance failed:', error)
      Taro.showToast({ title: error?.message || '生成失败，请稍后重试', icon: 'none' })
    } finally {
      setAiGeneratingStudentId(null)
    }
  }, [getStudentName])

  const handleBulkAiGenerate = useCallback(() => {
    if (bulkAiGenerating) return

    const excludedCount = excludedNoPlanIds.length
    const modalContent = excludedCount > 0
      ? `将为未配置计划学员批量生成训练计划，已取消勾选 ${excludedCount} 位将跳过。是否继续？`
      : '将为所有未配置计划的学员批量生成训练计划（与网页端一致）。是否继续？'

    Taro.showModal({
      title: '批量快速生成',
      content: modalContent,
      confirmText: '开始生成',
      success: async (res) => {
        if (!res.confirm) return
        setBulkAiGenerating(true)
        try {
          const response = await planLibService.bulkCreateAiInstances({
            mode: 'no_plan',
            excludedSubscriptionIds: excludedNoPlanIds,
            startWeek: 1,
            startDay: 1,
            keepOriginalIndex: true
          })

          const successCount = Number(response?.successCount || 0)
          const failedCount = Number(response?.failedCount || 0)
          Taro.showToast({
            title: failedCount > 0 ? `成功${successCount} 失败${failedCount}` : `成功生成 ${successCount} 个`,
            icon: 'none',
            duration: 2600
          })

          await loadStudents({ targetPage: page, showPageLoading: false, skipWaitingCounts: false })
        } catch (error) {
          console.error('[coach/students] bulk ai generate failed:', error)
          Taro.showToast({ title: '批量生成失败，请稍后重试', icon: 'none' })
        } finally {
          setBulkAiGenerating(false)
        }
      }
    })
  }, [bulkAiGenerating, excludedNoPlanIds, loadStudents, page])

  const renderLoading = () => (
    <View className='skeleton-list'>
      {Array.from({ length: 5 }).map((_, idx) => (
        <View key={idx} className='skeleton-card'>
          <View className='skeleton-line title' />
          <View className='skeleton-line' />
          <View className='skeleton-line short' />
        </View>
      ))}
    </View>
  )

  const renderPaymentCard = (subscription: any, kind: 'manual' | 'system' | 'history') => {
    const subscriptionId = String(subscription?.id || '')
    const studentName = getWaitingStudentName(subscription)
    const avatar = getWaitingStudentAvatar(subscription)
    const selected = selectedManualIds.includes(subscriptionId)
    const offlinePayment = subscription?.payment_data?.offline_payment
    const pendingRenew = subscription?.payment_data?.pending_renew
    const amountText = getMoneyYuanText(offlinePayment?.amount, offlinePayment?.amount_unit)
    const monthlyPriceText = getMoneyYuanText(subscription?.monthly_price)
    const confirmSource = String(subscription?.payment_confirmed_by || '')
    const paymentTypeMeta = getPaymentTypeMeta(subscription, kind)
    const noteInfo = extractReceiptInfoFromNote(String(subscription?.remind_coach_note || ''))
    const noteText = noteInfo.cleanNote
    const receiptUrl = String(offlinePayment?.receipt_url || noteInfo.receiptUrl || '').trim()

    return (
      <View key={subscriptionId} className='payment-card'>
        <View className='payment-card-main'>
          {kind === 'manual' ? (
            <View
              className={`payment-check ${selected ? 'checked' : ''}`}
              onClick={() => handleToggleManualSelect(subscriptionId)}
            >
              <Text>{selected ? '✓' : ''}</Text>
            </View>
          ) : (
            <View className='payment-check placeholder' />
          )}

          {avatar ? (
            <Image className='payment-avatar' src={avatar} mode='aspectFill' />
          ) : (
            <View className='payment-avatar placeholder'>
              <Text>{studentName.charAt(0)}</Text>
            </View>
          )}

          <View className='payment-meta'>
            <View className='payment-top-row'>
              <Text className='payment-name'>{studentName}</Text>
              {kind === 'manual' && <View className='payment-tag warning'><Text>需确认</Text></View>}
              {kind === 'system' && <View className='payment-tag success'><Text>系统通知</Text></View>}
              {kind === 'history' && (
                <View className={`payment-tag ${confirmSource === 'system' ? 'success' : 'warning'}`}>
                  <Text>{confirmSource === 'system' ? '系统确认' : '教练确认'}</Text>
                </View>
              )}
            </View>

            <View className='payment-info-row'>
              <Text className='payment-info-label'>支付方式</Text>
              <View className={`payment-tag ${paymentTypeMeta.className}`}>
                <Text>{paymentTypeMeta.label}</Text>
              </View>
            </View>

            <View className='payment-info-row'>
              <Text className='payment-info-label'>套餐</Text>
              <Text className='payment-info-value'>{getTierLabel(Number(subscription?.tier || 1))}</Text>
            </View>

            <View className='payment-info-row'>
              <Text className='payment-info-label'>申请时间</Text>
              <Text className='payment-info-value'>{formatDateTime(subscription?.created_at)}</Text>
            </View>

            {kind === 'history' && (
              <View className='payment-info-row'>
                <Text className='payment-info-label'>确认时间</Text>
                <Text className='payment-info-value'>{formatDateTime(subscription?.payment_confirmed_at)}</Text>
              </View>
            )}

            {!!monthlyPriceText && (
              <View className='payment-info-row'>
                <Text className='payment-info-label'>月费</Text>
                <Text className='payment-info-value'>{monthlyPriceText}</Text>
              </View>
            )}

            {offlinePayment?.expires_at && (
              <View className='payment-info-row'>
                <Text className='payment-info-label'>到期时间</Text>
                <Text className='payment-info-value'>{formatDateTime(offlinePayment.expires_at)}</Text>
              </View>
            )}

            {!!amountText && (
              <View className='payment-info-row'>
                <Text className='payment-info-label'>线下金额</Text>
                <Text className='payment-info-value'>{amountText}</Text>
              </View>
            )}

            {Number(pendingRenew?.additional_weeks || 0) > 0 && (
              <View className='payment-info-row'>
                <Text className='payment-info-label'>续费周数</Text>
                <Text className='payment-info-value'>{Number(pendingRenew.additional_weeks)} 周</Text>
              </View>
            )}

            {noteText && (
              <View className='payment-note'>
                <Text>{noteText}</Text>
              </View>
            )}

            {!!receiptUrl && (
              <View
                className='payment-receipt'
                onClick={() => {
                  Taro.previewImage({
                    current: receiptUrl,
                    urls: [receiptUrl]
                  })
                }}
              >
                <Text className='payment-receipt-label'>支付凭证</Text>
                <Image className='payment-receipt-img' src={receiptUrl} mode='aspectFill' />
              </View>
            )}
          </View>
        </View>

        {kind !== 'history' && (
          <View className='payment-actions'>
            {kind === 'manual' ? (
              <View
                className={`payment-action-btn primary ${paymentSubmitting ? 'disabled' : ''}`}
                onClick={() => {
                  if (paymentSubmitting) return
                  void confirmManualSubscriptions([subscriptionId], false)
                }}
              >
                <Text>确认支付</Text>
              </View>
            ) : (
              <View
                className={`payment-action-btn ghost ${paymentSubmitting ? 'disabled' : ''}`}
                onClick={() => {
                  if (paymentSubmitting) return
                  void dismissSystemSubscription(subscriptionId)
                }}
              >
                <Text>忽略通知</Text>
              </View>
            )}
          </View>
        )}
      </View>
    )
  }

  return (
    <View className='coach-students-page'>
      <View className='page-header'>
        <View className='header-main'>
          <Text className='header-title'>学员管理</Text>
          <Text className='header-subtitle'>{totalRecords} 位学员</Text>
        </View>
      </View>

      <View className='toolbar-card'>
        <View className='search-box'>
          <Text className='search-icon'>⌕</Text>
          <Input
            value={searchInput}
            onInput={(e) => setSearchInput(e.detail.value)}
            placeholder='搜索学员昵称/手机号'
            className='search-input'
          />
          {!!searchInput && (
            <Text
              className='search-clear'
              onClick={(e) => {
                e.stopPropagation()
                setSearchInput('')
              }}
            >
              ×
            </Text>
          )}
        </View>

        <View className='toolbar-actions'>
          <View className='toolbar-btn sort-btn' onClick={handlePickSort}>
            <Text className='toolbar-btn-text'>{currentSortLabel}</Text>
          </View>

          <View className='toolbar-btn ai-btn' onClick={handleBulkAiGenerate}>
            <Text className='toolbar-btn-text'>{bulkAiGenerating ? '批量生成中...' : '批量快速生成'}</Text>
          </View>

          <View className='toolbar-btn waiting-btn' onClick={() => void handleOpenPaymentDialog()}>
            <Text className='toolbar-btn-text'>待支付确认</Text>
            {waitingTotal > 0 && (
              <View className='waiting-badge'>
                <Text>{waitingTotal}</Text>
              </View>
            )}
          </View>
        </View>

        {noPlanStudentIdsOnPage.length > 0 && (
          <View className='bulk-select-row'>
            <Text className='bulk-select-text'>
              本页未配置 {noPlanStudentIdsOnPage.length} 位，已勾选 {selectedNoPlanIdsOnPage.length} 位
            </Text>
            <View className='bulk-select-actions'>
              <View className='bulk-select-link' onClick={handleToggleSelectAllNoPlanOnPage}>
                <Text>{allNoPlanSelectedOnPage ? '清空本页' : '全选本页'}</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {loading ? (
        renderLoading()
      ) : students.length === 0 ? (
        <View className='empty-wrap'>
          <Text className='empty-title'>暂无学员</Text>
          <Text className='empty-desc'>尝试调整搜索条件或稍后刷新</Text>
        </View>
      ) : (
        <ScrollView scrollY className='student-list'>
          {students.map((student) => {
            const studentId = String(student?.id || '')
            const expanded = expandedStudentId === studentId
            const unreviewed = Math.max(0, Number(student?.uploaded || 0) - Number(student?.reviewed || 0))
            const progressPercent = getProgressPercent(student)
            const progressCompleted = Number(student?.progress?.completed || 0)
            const progressTotal = Number(student?.progress?.total || 0)
            const planStatus = getPlanStatus(student)
            const subscribedWeeks = Number(student?.subscribed_weeks || 0)
            const tierLabel = getTierLabel(Number(student?.tier || 1))
            const avatarUrl = String(student?.profile?.avatar_url || '')
            const name = getStudentName(student)
            const isNoPlan = !student?.plan
            const aiGenerating = aiGeneratingStudentId === studentId
            const noPlanSelected = isNoPlan && !excludedNoPlanIds.includes(studentId)

            return (
              <View key={studentId} className={`student-card ${expanded ? 'expanded' : ''}`}>
                <View className='card-summary' onClick={() => handleToggleExpand(studentId)}>
                  <View className='summary-left'>
                    {isNoPlan ? (
                      <View
                        className={`student-select-check ${noPlanSelected ? 'checked' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleNoPlanSelect(studentId)
                        }}
                      >
                        <Text>{noPlanSelected ? '✓' : ''}</Text>
                      </View>
                    ) : (
                      <View className='student-select-check disabled' />
                    )}

                    {avatarUrl ? (
                      <Image className='avatar' src={avatarUrl} mode='aspectFill' />
                    ) : (
                      <View className='avatar placeholder'>
                        <Text>{name.charAt(0)}</Text>
                      </View>
                    )}

                    <View className='summary-meta'>
                      <View className='name-row'>
                        <Text className='student-name'>{name}</Text>
                        <View className='tier-chip'><Text>{tierLabel}</Text></View>
                      </View>
                      <Text className='student-id'>ID: {getStudentIdLabel(student)}</Text>
                      <View className='status-row'>
                        <View className={`status-chip status-${planStatus === '进行中' ? 'active' : planStatus === '已完成' ? 'completed' : planStatus === '已暂停' ? 'paused' : 'none'}`}>
                          <Text>{planStatus}</Text>
                        </View>
                        <View className={`status-chip ${unreviewed > 0 ? 'pending' : 'clean'}`}>
                          <Text>待评 {unreviewed}</Text>
                        </View>
                        <View className='status-chip weeks'>
                          <Text>{subscribedWeeks > 0 ? `${subscribedWeeks}周计划` : '未配置周期'}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View className='summary-right'>
                    <View
                      className='profile-btn'
                      onClick={(e) => {
                        e.stopPropagation()
                        goDetail(student)
                      }}
                    >
                      <Text>档案</Text>
                    </View>
                    <Text className={`expand-arrow ${expanded ? 'open' : ''}`}>›</Text>
                  </View>
                </View>

                {expanded && (
                  <View className='card-detail'>
                    <View className='plan-panel' onClick={() => goPlan(student)}>
                      <View className='plan-panel-left'>
                        <View className={`plan-dot ${planStatus === '进行中' ? 'active' : planStatus === '已完成' ? 'completed' : 'none'}`} />
                        <View className='plan-copy'>
                          <Text className='plan-name'>{student?.plan?.name || '未配置计划（点击进入）'}</Text>
                          <Text className='plan-desc'>{student?.plan?.description || '当前未配置训练计划'}</Text>
                        </View>
                      </View>
                      <Text className='plan-arrow'>›</Text>
                    </View>

                    <View className='stats-grid'>
                      <View className='stats-item'>
                        <Text className='stats-label'>训练进度</Text>
                        <View className='stats-row'>
                          <Text className='stats-value'>{progressPercent}%</Text>
                          <Text className='stats-hint'>{progressCompleted}/{progressTotal} 训练日</Text>
                        </View>
                        <View className='progress-track'>
                          <View className={`progress-fill ${planStatus === '已完成' ? 'completed' : ''}`} style={{ width: `${progressPercent}%` }} />
                        </View>
                      </View>

                      <View className='stats-item'>
                        <Text className='stats-label'>点评/视频</Text>
                        <View className='review-row'>
                          <Text className='review-number'>{Number(student?.reviewed || 0)}</Text>
                          <Text className='review-divider'>/</Text>
                          <Text className='review-number'>{Number(student?.uploaded || 0)}</Text>
                        </View>
                        <Text className={`review-hint ${unreviewed > 0 ? 'warning' : ''}`}>
                          {unreviewed > 0 ? `${unreviewed} 条待点评` : '全部完成'}
                        </Text>
                      </View>
                    </View>

                    <View className='detail-actions' onClick={(e) => e.stopPropagation()}>
                      <View className='action-link action-primary' onClick={() => goPlan(student)}>
                        <Text>{student?.plan ? '查看计划' : '创建计划'}</Text>
                      </View>

                      {isNoPlan && (
                        <View
                          className={`action-link action-ai ${aiGenerating ? 'disabled' : ''}`}
                          onClick={() => {
                            if (aiGenerating) return
                            void handleAiGenerateStudent(student)
                          }}
                        >
                          <Text>{aiGenerating ? 'AI生成中...' : 'AI生成'}</Text>
                        </View>
                      )}

                      <View className='action-link action-secondary' onClick={() => void contactStudent(student)}>
                        <Text>联系学员</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )
          })}
        </ScrollView>
      )}

      {!loading && totalRecords > 0 && (
        <View className='pager'>
          <View
            className={`pager-btn ${page <= 0 ? 'disabled' : ''}`}
            onClick={() => {
              if (page <= 0) return
              setPage((prev) => Math.max(0, prev - 1))
            }}
          >
            <Text>上一页</Text>
          </View>
          <Text className='pager-text'>第 {page + 1} / {totalPages} 页</Text>
          <View
            className={`pager-btn ${page >= totalPages - 1 ? 'disabled' : ''}`}
            onClick={() => {
              if (page >= totalPages - 1) return
              setPage((prev) => Math.min(totalPages - 1, prev + 1))
            }}
          >
            <Text>下一页</Text>
          </View>
        </View>
      )}

      {paymentDialogVisible && (
        <View className='payment-dialog-mask' onClick={() => void handleClosePaymentDialog()}>
          <View
            className='payment-dialog-panel'
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <View className='payment-dialog-header'>
              <Text className='payment-dialog-title'>待支付确认</Text>
              <Text className='payment-dialog-subtitle'>{manualWaitingSubscriptions.length + systemWaitingSubscriptions.length} 条记录</Text>
              <Text className='payment-dialog-close' onClick={() => void handleClosePaymentDialog()}>×</Text>
            </View>

            <View className='payment-tabs'>
              <View
                className={`payment-tab ${paymentTab === 'pending' ? 'active' : ''}`}
                onClick={() => setPaymentTab('pending')}
              >
                <Text>待确认</Text>
              </View>
              <View
                className={`payment-tab ${paymentTab === 'history' ? 'active' : ''}`}
                onClick={() => setPaymentTab('history')}
              >
                <Text>历史</Text>
              </View>
            </View>

            <ScrollView scrollY className='payment-dialog-body'>
              {paymentTab === 'pending' ? (
                waitingLoading ? (
                  <View className='payment-skeleton-wrap'>
                    <View className='payment-skeleton' />
                    <View className='payment-skeleton' />
                    <View className='payment-skeleton' />
                  </View>
                ) : (
                  <View className='payment-sections'>
                    {manualWaitingSubscriptions.length > 0 && (
                      <View className='payment-section'>
                        <View className='payment-section-header'>
                          <Text className='payment-section-title'>需要确认（{manualWaitingSubscriptions.length}）</Text>
                          <View className='payment-select-all' onClick={handleSelectAllManual}>
                            <Text>
                              {selectedManualIds.length >= manualWaitingSubscriptions.length
                                ? '取消全选'
                                : '全选'}
                            </Text>
                          </View>
                        </View>

                        {manualWaitingSubscriptions.map((subscription) => renderPaymentCard(subscription, 'manual'))}
                      </View>
                    )}

                    {systemWaitingSubscriptions.length > 0 && (
                      <View className='payment-section'>
                        <View className='payment-section-header'>
                          <Text className='payment-section-title'>系统通知（{systemWaitingSubscriptions.length}）</Text>
                        </View>

                        {systemWaitingSubscriptions.map((subscription) => renderPaymentCard(subscription, 'system'))}
                      </View>
                    )}

                    {manualWaitingSubscriptions.length === 0 && systemWaitingSubscriptions.length === 0 && (
                      <View className='empty-wrap payment-empty'>
                        <Text className='empty-title'>暂无待确认支付</Text>
                        <Text className='empty-desc'>后续有新支付提醒会在这里展示</Text>
                      </View>
                    )}
                  </View>
                )
              ) : (
                historyLoading ? (
                  <View className='payment-skeleton-wrap'>
                    <View className='payment-skeleton' />
                    <View className='payment-skeleton' />
                    <View className='payment-skeleton' />
                  </View>
                ) : (
                  <View className='payment-sections'>
                    {paymentHistorySubscriptions.map((subscription) => renderPaymentCard(subscription, 'history'))}
                    {paymentHistorySubscriptions.length === 0 && (
                      <View className='empty-wrap payment-empty'>
                        <Text className='empty-title'>暂无历史记录</Text>
                        <Text className='empty-desc'>确认过的支付会展示在这里</Text>
                      </View>
                    )}
                  </View>
                )
              )}
            </ScrollView>

            {paymentTab === 'pending' && (
              <View className='payment-dialog-footer'>
                <View className='payment-footer-text'>
                  <Text>已选择 {selectedManualRows.length} 位学员</Text>
                </View>
                <View
                  className={`payment-footer-btn ${selectedManualRows.length <= 0 || paymentSubmitting ? 'disabled' : ''}`}
                  onClick={() => {
                    if (selectedManualRows.length <= 0 || paymentSubmitting) return
                    void confirmManualSubscriptions(selectedManualRows.map((item) => String(item?.id || '')), false)
                  }}
                >
                  <Text>{paymentSubmitting ? '处理中...' : '确认支付'}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      <BottomNav />
    </View>
  )
}

export default CoachStudents
