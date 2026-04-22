import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, Input, Button, Textarea } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { trainingService } from '@/services/trainingService'
import { executionService } from '@/services/executionService'
import { impromptuService } from '@/services/impromptuService'
import { authService } from '@/services/authService'
import { studentActionLibService } from '@/services/studentActionLibService'
import { chatService } from '@/services/chatService'
import { buildPublicTrainingSharePath } from '@/utils/share'
import { formatKgValueForGym } from '@/utils/weightQuantize'
import {
  readTrainingExecutionSnapshot,
  syncTrainingExecutionToStorage,
  trainingExecutionSnapshotKey
} from '@/utils/trainingExecutionCache'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'

const RETURN_CONFIRM_STORAGE_KEY = 'today_training_last_confirmed_day'

interface SetData {
  set_number: number
  status: 'pending' | 'completed' | 'skipped'
  planned_reps?: string
  planned_weight?: string
  planned_rest_seconds?: number
  actual_weight?: number
  actual_reps?: number
  rpe?: number
  notes?: string
  video_url?: string
  is_pr?: boolean
  e1rm?: number
  is_auto_pr?: boolean
  diet_content?: string
  actual_distance?: number
  actual_duration?: number
  source?: string // 'student_extra' = 学员自行添加
}

interface ActionExecution {
  action_id: string
  action_name: string
  action_order: number
  source?: string // 'student_extra' = 学员自行添加
  sets: SetData[]
  total_sets: number
  completed_sets: number
}

const FEEDBACK_DIFFICULTY_OPTIONS = [
  { value: 1, label: '太轻松', icon: 'Clock' },
  { value: 2, label: '轻松', icon: 'Heart' },
  { value: 3, label: '刚好', icon: 'Power' },
  { value: 4, label: '有点难', icon: 'Target' },
  { value: 5, label: '太难了', icon: 'Power' }
]

/** 与动作 type 对应的展示文案（hero 标签、非力量摘要等） */
function getActionTypeMeta(type: string): { label: string; cue: string } {
  const t = String(type || 'STRENGTH').toUpperCase()
  const map: Record<string, { label: string; cue: string }> = {
    STRENGTH: { label: '力量', cue: '按计划完成组次与重量' },
    CARDIO: { label: '有氧', cue: '记录距离或训练时长' },
    DIET: { label: '饮食', cue: '按提示记录饮食内容' },
    HABIT: { label: '习惯', cue: '完成习惯打卡' }
  }
  return map[t] || map.STRENGTH
}

/** 计划间歇秒数展示（hero / 组卡片） */
function formatRestSummary(seconds?: number | null): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(Number(seconds))) {
    return '间歇未设'
  }
  const s = Math.max(0, Math.round(Number(seconds)))
  if (s <= 0) return '无间歇'
  if (s < 60) return `间歇 ${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  if (r === 0) return `间歇 ${m}分钟`
  return `间歇 ${m}分${r}秒`
}

/** 休息倒计时 mm:ss */
function formatTimerValue(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

function syncExpandUIFromExecution(
  data: any,
  setExpandedAction: (n: number) => void,
  setCurrentSetIndex: (n: number) => void
) {
  const actionExecutions = data?.action_executions || []
  if (actionExecutions.length > 0) {
    const firstPendingActionIdx = actionExecutions.findIndex((action: ActionExecution) =>
      (action.sets || []).some((s: SetData) => s.status === 'pending')
    )
    const targetActionIdx = firstPendingActionIdx >= 0 ? firstPendingActionIdx : 0
    const targetAction = actionExecutions[targetActionIdx]
    const pendingSetIndex = targetAction?.sets?.findIndex((s: SetData) => s.status === 'pending') ?? 0
    setExpandedAction(targetActionIdx)
    setCurrentSetIndex(pendingSetIndex >= 0 ? pendingSetIndex : 0)
  } else {
    setExpandedAction(0)
    setCurrentSetIndex(0)
  }
}

function TrainingExecution() {
  const instance = Taro.getCurrentInstance()
  const instanceId = instance.router?.params?.instanceId as string
  const impromptuId = instance.router?.params?.impromptuId as string
  const isImpromptuMode = !!impromptuId
  const dayIndex = parseInt(instance.router?.params?.dayIndex || '1')
  const readOnlyParam = String(instance.router?.params?.readOnly || '').toLowerCase()
  const isReadOnly = !isImpromptuMode && (readOnlyParam === 'true' || readOnlyParam === '1')
  const coachId = instance.router?.params?.coachId ? decodeURIComponent(instance.router.params.coachId) : ''
  const coachName = instance.router?.params?.coachName ? decodeURIComponent(instance.router.params.coachName) : ''
  
  const [loading, setLoading] = useState(true)
  const [execution, setExecution] = useState<any>(null)
  const [actions, setActions] = useState<Record<string, any>>({})
  const [planInstance, setPlanInstance] = useState<any>(null)
  const [expandedAction, setExpandedAction] = useState<number>(0)
  const [currentSetIndex, setCurrentSetIndex] = useState(0)
  const [expandedSetKey, setExpandedSetKey] = useState<string | null>(null)
  const [editingSetKey, setEditingSetKey] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [restTimer, setRestTimer] = useState(0)
  const [isResting, setIsResting] = useState(false)
  
  // 当前组的输入状态
  const [weight, setWeight] = useState<number | null>(null)
  const [weightInput, setWeightInput] = useState('')
  const [reps, setReps] = useState<number | null>(null)
  const [rpe, setRpe] = useState<number | null>(null)
  const [setNotes, setSetNotes] = useState('')
  const [markAsPR, setMarkAsPR] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [uploadingVideo, setUploadingVideo] = useState(false)

  // 非力量项目（饮食/有氧/习惯）表单状态
  const [itemStates, setItemStates] = useState<Record<number, { dietContent?: string; cardioDistance?: number | null; cardioDuration?: number | null }>>({})
  const [addingExtraSet, setAddingExtraSet] = useState(false)
  const [addingExtraAction, setAddingExtraAction] = useState(false)
  const [showActionPicker, setShowActionPicker] = useState(false)
  const [actionPickerList, setActionPickerList] = useState<any[]>([])
  const [actionKeyword, setActionKeyword] = useState('')
  const [removingSet, setRemovingSet] = useState(false)
  const [removingAction, setRemovingAction] = useState(false)
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false)
  const [feedbackContent, setFeedbackContent] = useState('')
  const [feedbackDifficulty, setFeedbackDifficulty] = useState<number>(3)
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [pendingSharePath, setPendingSharePath] = useState('')

  const userId = authService.getCurrentUser()?.id

  const syncExecutionToCaches = useCallback(
    (exec: any) => {
      if (!userId || !exec) return
      const scopeKey = trainingExecutionSnapshotKey({
        isImpromptuMode,
        impromptuId,
        instanceId,
        dayIndex
      })
      if (!scopeKey) return
      syncTrainingExecutionToStorage({
        userId,
        scopeKey,
        instanceId: isImpromptuMode ? undefined : instanceId,
        dayIndex,
        isImpromptuMode,
        execution: exec,
        planInstance: planInstance || undefined,
        actions: actions || {}
      })
    },
    [userId, isImpromptuMode, impromptuId, instanceId, dayIndex, planInstance, actions]
  )

  const parseInputNumber = useCallback((value: string, mode: 'int' | 'float' = 'float') => {
    const trimmed = String(value ?? '').trim()
    if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') {
      return null
    }
    const parsed = mode === 'int' ? parseInt(trimmed, 10) : parseFloat(trimmed)
    if (!Number.isFinite(parsed)) return null
    return parsed
  }, [])

  const formatInputValue = useCallback((value?: number | null) => {
    return value === null || value === undefined || !Number.isFinite(value) ? '' : String(value)
  }, [])

  const filteredActionPickerList = useMemo(() => {
    const keyword = actionKeyword.trim().toLowerCase()
    if (!keyword) return actionPickerList
    return actionPickerList.filter((action) => String(action?.name || '').toLowerCase().includes(keyword))
  }, [actionKeyword, actionPickerList])

  const lightweightProgress = useMemo(() => {
    const list = Array.isArray(execution?.action_executions) ? execution.action_executions : []
    return list.reduce((acc, item: ActionExecution) => {
      const actionType = String(actions?.[item?.action_id]?.type || 'STRENGTH').toUpperCase()
      if (!['DIET', 'CARDIO', 'HABIT'].includes(actionType)) {
        return acc
      }

      const completedBySets = (item?.completed_sets || 0) >= Math.max(1, item?.total_sets || 1)
      const completedByStatus = item?.sets?.some((set) => set?.status === 'completed')
      const isCompleted = completedBySets || !!completedByStatus

      acc.total += 1
      if (isCompleted) {
        acc.completed += 1
      } else {
        acc.pending += 1
      }
      return acc
    }, { total: 0, completed: 0, pending: 0 })
  }, [actions, execution?.action_executions])

  const canFinishWholeDay = isImpromptuMode || lightweightProgress.pending <= 0

  const actionExecutions = useMemo(
    () => (Array.isArray(execution?.action_executions) ? execution.action_executions : []) as ActionExecution[],
    [execution?.action_executions]
  )

  const trainingCardSlots = useMemo(() => {
    const slots: { actionIdx: number; setIdx: number }[] = []
    actionExecutions.forEach((action, actionIdx) => {
      const t = String(actions?.[action.action_id]?.type || 'STRENGTH').toUpperCase()
      if (['DIET', 'CARDIO', 'HABIT'].includes(t)) {
        slots.push({ actionIdx, setIdx: 0 })
      } else {
        (action.sets || []).forEach((_, setIdx) => {
          slots.push({ actionIdx, setIdx })
        })
      }
    })
    return slots
  }, [actionExecutions, actions])

  const currentCardSlotIndex = useMemo(
    () => trainingCardSlots.findIndex((s) => s.actionIdx === expandedAction && s.setIdx === currentSetIndex),
    [trainingCardSlots, expandedAction, currentSetIndex]
  )

  const setKeyOf = useCallback((actionIndex: number, setIndex: number) => `${actionIndex}:${setIndex}`, [])

  const isWeightRequiredForSet = useCallback((set?: SetData | null) => {
    const planned = String(set?.planned_weight || '').trim().toLowerCase()
    if (!planned) return true
    if (planned.includes('kg')) return true
    if (/^-?\d+(\.\d+)?$/.test(planned)) return true
    if (planned.includes('rm') || planned.includes('%')) return false
    return true
  }, [])

  const hydrateSetInputs = useCallback((set?: SetData | null, options?: { allowCompleted?: boolean }) => {
    const allowCompleted = !!options?.allowCompleted
    if (!set || (set.status === 'completed' && !allowCompleted)) {
      setWeight(null)
      setWeightInput('')
      setReps(null)
      setRpe(null)
      setSetNotes('')
      setMarkAsPR(false)
      setVideoUrl('')
      return
    }

    setWeight(set.actual_weight ?? null)
    setWeightInput(formatInputValue(set.actual_weight))
    setReps(set.actual_reps ?? null)
    setRpe(set.rpe ?? null)
    setSetNotes(set.notes || '')
    setMarkAsPR(!!set.is_pr)
    setVideoUrl(set.video_url || '')
  }, [formatInputValue])

  const applyTrainingCardSlot = useCallback(
    (slot: { actionIdx: number; setIdx: number }) => {
      setExpandedAction(slot.actionIdx)
      setCurrentSetIndex(slot.setIdx)
      setExpandedSetKey(null)
      setEditingSetKey(null)
      const set = actionExecutions[slot.actionIdx]?.sets?.[slot.setIdx]
      hydrateSetInputs(set)
    },
    [actionExecutions, hydrateSetInputs]
  )

  const handleManualPrevCard = useCallback(() => {
    const idx = currentCardSlotIndex
    if (idx <= 0) {
      Taro.showToast({ title: '已是第一项', icon: 'none' })
      return
    }
    applyTrainingCardSlot(trainingCardSlots[idx - 1])
  }, [applyTrainingCardSlot, currentCardSlotIndex, trainingCardSlots])

  const handleManualNextCard = useCallback(() => {
    const idx = currentCardSlotIndex
    if (idx < 0 || trainingCardSlots.length === 0) return
    const cur = trainingCardSlots[idx]
    const act = actionExecutions[cur.actionIdx]
    const t = String(actions?.[act?.action_id]?.type || 'STRENGTH').toUpperCase()
    const isLight = ['DIET', 'CARDIO', 'HABIT'].includes(t)

    const goNext = () => {
      if (idx >= trainingCardSlots.length - 1) {
        Taro.showToast({ title: '已是最后一项', icon: 'none' })
        return
      }
      applyTrainingCardSlot(trainingCardSlots[idx + 1])
    }

    if (isReadOnly) {
      goNext()
      return
    }

    if (!isLight) {
      const set = act?.sets?.[cur.setIdx]
      if (set?.status === 'pending') {
        Taro.showModal({
          title: '跳过本组？',
          content: '未记录本组就进入下一项，将无法保证今日训练数据完整。仍要使用「下一项」吗？',
          confirmText: '仍要跳过',
          success: (res) => {
            if (res.confirm) goNext()
          }
        })
        return
      }
      goNext()
      return
    }

    const done = (act?.completed_sets || 0) >= 1
    if (!done) {
      Taro.showModal({
        title: '跳过此项？',
        content: '未完成打卡就进入下一项，可能影响今日完成度。仍要继续吗？',
        confirmText: '仍要跳过',
        success: (res) => {
          if (res.confirm) goNext()
        }
      })
      return
    }
    goNext()
  }, [
    actionExecutions,
    actions,
    applyTrainingCardSlot,
    currentCardSlotIndex,
    isReadOnly,
    trainingCardSlots
  ])

  useEffect(() => {
    if (!execution || trainingCardSlots.length === 0) return
    if (currentCardSlotIndex >= 0) return
    applyTrainingCardSlot(trainingCardSlots[0])
  }, [applyTrainingCardSlot, currentCardSlotIndex, execution, trainingCardSlots])

  const buildPreviewExecution = useCallback(
    (targetInstance: any, actionMap: Record<string, any>, targetDayIndex: number) => {
      const trainingDays = Array.isArray(targetInstance?.training_days) ? targetInstance.training_days : []
      const day = trainingDays.find((item: any) => Number(item?.dayIndex) === Number(targetDayIndex))
      if (!day || day.type !== 'training') {
        return {
          id: `preview-${targetDayIndex}`,
          status: 'preview',
          day_index: targetDayIndex,
          action_executions: []
        }
      }

      const actionSets = Array.isArray(day.actionSets) ? day.actionSets : []
      const actionExecutions: ActionExecution[] = actionSets.map((item: any, actionIdx: number) => {
        const actionId = String(item?.action_id || item?.actionId || '')
        const actionDetail = actionMap[actionId] || {}
        const params = item?.params || {}
        const rawSetCount = Number(params['组数'] ?? item?.sets ?? 1)
        const setCount = Number.isFinite(rawSetCount) && rawSetCount > 0 ? Math.max(1, Math.floor(rawSetCount)) : 1
        const rawLoad = params?.load
        let plannedWeight = ''
        if (rawLoad !== null && rawLoad !== undefined && String(rawLoad).trim() !== '') {
          const directLoad = Number(rawLoad)
          const parsedLoad = Number.isFinite(directLoad)
            ? directLoad
            : (() => {
                const matched = String(rawLoad).match(/-?\d+(\.\d+)?/)
                if (!matched) return NaN
                return Number(matched[0])
              })()

          if (Number.isFinite(parsedLoad)) {
            if (parsedLoad < 0) {
              plannedWeight = `辅助${formatKgValueForGym(Math.abs(parsedLoad))}kg`
            } else if (parsedLoad > 0) {
              plannedWeight = `${formatKgValueForGym(parsedLoad)}kg`
            }
          }
        }

        // Do not fallback to legacy "item.weight" to avoid stale action-library values overriding plan load.
        if (!plannedWeight) {
          const intensity = Number(params?.['强度'] ?? item?.intensity)
          if (Number.isFinite(intensity) && intensity > 0) {
            plannedWeight = `${String(intensity).replace(/\.0+$/, '')}RM`
          }
        }
        const plannedReps = String(params?.['次数'] ?? item?.reps ?? '').trim()
        const actionName = String(actionDetail?.name || item?.action_name || item?.set_name || '动作')

        const sets: SetData[] = Array.from({ length: setCount }).map((_, setIdx) => ({
          set_number: setIdx + 1,
          status: 'pending',
          planned_weight: plannedWeight,
          planned_reps: plannedReps
        }))

        return {
          action_id: actionId || `${actionIdx}`,
          action_name: actionName,
          action_order: actionIdx + 1,
          sets,
          total_sets: sets.length,
          completed_sets: 0
        }
      })

      return {
        id: `preview-${targetDayIndex}`,
        status: 'preview',
        day_index: targetDayIndex,
        action_executions: actionExecutions
      }
    },
    []
  )

  // 开始或恢复训练（T03：先 checkToday 判断今日是否已有进行中记录，若有则恢复；即兴模式直接 get）
  const startTraining = useCallback(async () => {
    if (!userId) {
      Taro.showToast({ title: '参数错误', icon: 'none' })
      return
    }
    if (!isImpromptuMode && !instanceId) {
      Taro.showToast({ title: '参数错误', icon: 'none' })
      return
    }

    try {
      const scopeKey = trainingExecutionSnapshotKey({
        isImpromptuMode,
        impromptuId,
        instanceId,
        dayIndex
      })
      const snap = userId && scopeKey ? readTrainingExecutionSnapshot(userId, scopeKey) : null
      if (snap?.execution) {
        setExecution(snap.execution)
        if (snap.planInstance) setPlanInstance(snap.planInstance)
        if (snap.actions && Object.keys(snap.actions).length > 0) setActions(snap.actions)
        syncExpandUIFromExecution(snap.execution, setExpandedAction, setCurrentSetIndex)
        setLoading(false)
      } else {
        setLoading(true)
      }

      if (isImpromptuMode && impromptuId) {
        // 即兴训练：直接获取执行记录
        const data = await impromptuService.get(impromptuId)
        if (!data) {
          Taro.showToast({ title: '无法加载即兴执行记录', icon: 'none' })
          return
        }
        setExecution(data)
        const impromptuPlan = {
          id: 'impromptu',
          name: '即兴锻炼',
          description: '即兴训练模式',
          source: 'impromptu'
        }
        setPlanInstance(impromptuPlan)
        // 从 action_executions 构建 actions map
        const actionMap: Record<string, any> = {}
        ;(data.action_executions || []).forEach((item: any) => {
          if (item?.action_id) {
            actionMap[item.action_id] = {
              id: item.action_id,
              name: item.action_name || '动作',
              type: 'STRENGTH',
              attrs: ['组数', '次数', '强度', '休息时间']
            }
          }
        })
        setActions(actionMap)
        syncExpandUIFromExecution(data, setExpandedAction, setCurrentSetIndex)
        if (userId && scopeKey) {
          syncTrainingExecutionToStorage({
            userId,
            scopeKey,
            dayIndex,
            isImpromptuMode: true,
            execution: data,
            planInstance: impromptuPlan,
            actions: actionMap
          })
        }
      } else {
        // 计划训练
        const instanceRes = await trainingService.getInstance({ id: instanceId })
        const instanceActions = instanceRes?.actions || {}
        if (instanceRes?.actions) setActions(instanceRes.actions)
        if (instanceRes?.instance) setPlanInstance(instanceRes.instance)

        const checkRes = await executionService.checkToday(instanceId, dayIndex)
        let data: any = null
        if (checkRes?.id) {
          data = await executionService.getExecution(checkRes.id)
        }
        if (!data && !isReadOnly) {
          data = await executionService.startExecution(instanceId, dayIndex)
        }
        if (!data && isReadOnly) {
          data = buildPreviewExecution(instanceRes?.instance, instanceActions, dayIndex)
        }

        if (data) {
          setExecution(data)
          syncExpandUIFromExecution(data, setExpandedAction, setCurrentSetIndex)
          if (userId && scopeKey) {
            syncTrainingExecutionToStorage({
              userId,
              scopeKey,
              instanceId,
              dayIndex,
              isImpromptuMode: false,
              execution: data,
              planInstance: instanceRes?.instance,
              actions: instanceActions
            })
          }
        } else {
          Taro.showToast({ title: '加载失败', icon: 'none' })
        }
      }
    } catch (e: any) {
      console.error('开始训练失败:', e)
      Taro.showToast({ title: e.message || '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [instanceId, impromptuId, isImpromptuMode, dayIndex, userId, isReadOnly, buildPreviewExecution])

  useDidShow(() => {
    startTraining()
  })

  usePullDownRefresh(() => {
    startTraining().finally(() => Taro.stopPullDownRefresh())
  })

  useEffect(() => {
    const current = execution?.action_executions?.[expandedAction]?.sets?.[currentSetIndex]
    const currentKey = current ? setKeyOf(expandedAction, currentSetIndex) : null
    hydrateSetInputs(current, {
      allowCompleted: !!currentKey && editingSetKey === currentKey
    })
  }, [editingSetKey, execution, expandedAction, currentSetIndex, hydrateSetInputs, setKeyOf])

  useEffect(() => {
    if (!isResting || restTimer <= 0) return
    const timer = setInterval(() => {
      setRestTimer((prev) => {
        if (prev <= 1) {
          setIsResting(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isResting, restTimer])

  // 选择视频（注意：微信小程序本地存储约 10MB 限制，视频过大会触发 writeFile 超限，建议大视频用「粘贴链接」）
  const handleChooseVideo = async () => {
    if (isReadOnly) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!execution?.id) return
    const actionId = execution?.action_executions?.[expandedAction]?.action_id
    if (!actionId) return
    try {
      const res = await Taro.chooseVideo({
        sourceType: ['album', 'camera'],
        maxDuration: 30, // 缩短以减小体积，避免本地存储超限
        compressed: true, // 压缩后再上传
        camera: 'back'
      })
      setUploadingVideo(true)
      const uploadRes = await executionService.uploadSetVideo(
        res.tempFilePath,
        execution.id,
        actionId,
        currentSetIndex + 1
      )
      const url = uploadRes?.video_url || uploadRes?.url
      if (url) {
        setVideoUrl(url)
        Taro.showToast({ title: '视频上传成功', icon: 'success' })
      } else {
        Taro.showToast({ title: '上传失败', icon: 'none' })
      }
    } catch (e: any) {
      console.error('选择视频失败:', e)
      const msg = e?.errMsg || e?.message || '选择视频失败'
      const hint = msg.includes('storage limit') || msg.includes('file storage')
        ? '本地存储已满或视频过大，请用「粘贴链接」上传'
        : msg
      Taro.showToast({ title: hint, icon: 'none', duration: 3000 })
    } finally {
      setUploadingVideo(false)
    }
  }

  // 粘贴视频链接
  const handlePasteVideoLink = async () => {
    if (isReadOnly) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!execution?.id) return
    const actionId = execution?.action_executions?.[expandedAction]?.action_id
    if (!actionId) return
    Taro.showModal({
      title: '粘贴视频链接',
      editable: true,
      placeholderText: '请输入视频链接（如B站、YouTube等）',
      success: async (res) => {
        if (res.confirm && res.content) {
          try {
            const linkRes = await executionService.addSetVideoLink(
              execution.id,
              actionId,
              currentSetIndex + 1,
              res.content
            )
            if (linkRes) {
              setVideoUrl(linkRes.video_url || res.content)
              Taro.showToast({ title: '链接添加成功', icon: 'success' })
            } else {
              Taro.showToast({ title: '添加失败', icon: 'none' })
            }
          } catch (e: any) {
            Taro.showToast({ title: (e as Error).message || '添加失败', icon: 'none' })
          }
        }
      }
    })
  }

  const handleContactCoach = useCallback(async () => {
    if (isImpromptuMode) {
      Taro.showToast({ title: '即兴锻炼暂无教练会话', icon: 'none' })
      return
    }
    if (!coachId || !userId) {
      Taro.showToast({ title: '教练信息缺失', icon: 'none' })
      return
    }
    if (coachId === userId) {
      Taro.showToast({ title: '无法与自己发起会话', icon: 'none' })
      return
    }

    try {
      const room = await chatService.getChatroom({ members: [userId, coachId] })
      if (room?.id) {
        await Taro.navigateTo({
          url: `/me/messages/chat/index?roomId=${room.id}&peerName=${encodeURIComponent(coachName || '教练')}`
        })
        return
      }
    } catch (error) {
      console.error('[training-execution] open coach chat failed:', error)
    }

    await Taro.navigateTo({
      url: `/me/messages/index?coachId=${encodeURIComponent(coachId)}${coachName ? `&coachName=${encodeURIComponent(coachName)}` : ''}`
    })
  }, [coachId, coachName, isImpromptuMode, userId])

  const handleBackToTodayTraining = useCallback(() => {
    Taro.navigateBack().catch(() => {
      Taro.redirectTo({ url: '/pages/index/index' }).catch(() => {
        Taro.reLaunch({ url: '/pages/index/index' }).catch(() => {
          Taro.showToast({ title: '跳转失败，请手动返回', icon: 'none' })
        })
      })
    })
  }, [])

  // 完成一组
  const handleCompleteSet = async () => {
    if (isReadOnly) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!execution) return

    const actionExecutions = execution.action_executions || []
    const currentAction = actionExecutions[expandedAction]
    if (!currentAction) return

    // 验证必填项
    const currentSet = currentAction.sets[currentSetIndex]
    if (!currentSet) return
    const currentSetKey = setKeyOf(expandedAction, currentSetIndex)
    const isEditing = editingSetKey === currentSetKey

    if (isWeightRequiredForSet(currentSet) && (weight === null || weight === undefined)) {
      Taro.showToast({ title: '请输入重量', icon: 'none' })
      return
    }

    try {
      setCompleting(true)

      const data = isImpromptuMode
        ? await impromptuService.completeSet(
            execution.id,
            expandedAction,
            currentSetIndex,
            { actualWeight: weight, actualReps: reps, notes: setNotes || undefined }
          )
        : await executionService.completeSet(
            execution.id,
            expandedAction,
            currentSetIndex,
            {
              actualWeight: weight,
              actualReps: reps,
              rpe: rpe,
              notes: setNotes || undefined,
              videoUrl: videoUrl || undefined,
              isPR: markAsPR
            }
          )

      if (data) {
        // 更新本地状态
        const updatedExecution = { ...execution }
        const updatedActionExecutions = [...updatedExecution.action_executions]
        const updatedAction = { ...updatedActionExecutions[expandedAction] }
        const updatedSets = [...updatedAction.sets]
        updatedSets[currentSetIndex] = {
          ...updatedSets[currentSetIndex],
          status: 'completed',
          actual_weight: weight,
          actual_reps: reps,
          rpe: rpe,
          notes: setNotes,
          video_url: videoUrl,
          is_pr: markAsPR,
          e1rm: data?.autoE1RM?.e1rm ?? updatedSets[currentSetIndex]?.e1rm,
          is_auto_pr: !!data?.autoE1RM?.isPR
        }
        updatedAction.sets = updatedSets
        updatedAction.completed_sets = updatedSets.filter((s: SetData) => s.status === 'completed').length
        updatedActionExecutions[expandedAction] = updatedAction
        updatedExecution.action_executions = updatedActionExecutions
        setExecution(updatedExecution)
        syncExecutionToCaches(updatedExecution)

        // 重置输入状态
        setWeight(null)
        setWeightInput('')
        setReps(null)
        setRpe(null)
        setSetNotes('')
        setMarkAsPR(false)
        setVideoUrl('')
        setEditingSetKey(null)
        setExpandedSetKey(currentSetKey)

        if (!isEditing) {
          const restSeconds = Number(currentSet.planned_rest_seconds || 90)
          if (Number.isFinite(restSeconds) && restSeconds > 0) {
            setRestTimer(restSeconds)
            setIsResting(true)
          }

          // 移动到下一组
          const nextSetIndex = updatedSets.findIndex((s: SetData, idx: number) => idx > currentSetIndex && s.status === 'pending')
          if (nextSetIndex >= 0) {
            setCurrentSetIndex(nextSetIndex)
          } else {
            // 当前动作完成，移动到下一个动作
            const nextActionIndex = updatedActionExecutions.findIndex((a: ActionExecution, idx: number) => idx > expandedAction && a.completed_sets < a.total_sets)
            if (nextActionIndex >= 0) {
              setExpandedAction(nextActionIndex)
              const nextAction = updatedActionExecutions[nextActionIndex]
              const nextPendingSet = nextAction.sets?.findIndex((s: SetData) => s.status === 'pending') ?? 0
              setCurrentSetIndex(nextPendingSet >= 0 ? nextPendingSet : 0)
            } else {
              const allCompleted = updatedActionExecutions.every((a: ActionExecution) => a.completed_sets >= a.total_sets)
              if (allCompleted) {
                Taro.showToast({ title: '全部动作已完成，可点击「完成训练」', icon: 'none', duration: 1800 })
              }
            }
          }
        }

        Taro.showToast({ title: isEditing ? '已更新本组' : '完成', icon: 'success' })
      } else {
        Taro.showToast({ title: '保存失败', icon: 'none' })
      }
    } catch (e: any) {
      console.error('完成组失败:', e)
      Taro.showToast({ title: e.message || '保存失败', icon: 'none' })
    } finally {
      setCompleting(false)
    }
  }

  const handlePostFinishFlow = useCallback((sharePath?: string) => {
    const targetSharePath = String(sharePath || '').trim()
    if (targetSharePath) {
      Taro.showModal({
        title: '训练完成！',
        content: '是否分享本次训练成果？',
        confirmText: '去分享',
        cancelText: '返回',
        success: (shareRes) => {
          if (shareRes.confirm) {
            Taro.navigateTo({ url: targetSharePath })
          } else {
            Taro.navigateBack()
          }
        }
      })
      return
    }

    Taro.showToast({ title: '训练完成！', icon: 'success' })
    setTimeout(() => {
      Taro.navigateBack()
    }, 1200)
  }, [])

  const handleSkipFeedback = useCallback(() => {
    const sharePath = pendingSharePath
    setShowFeedbackDialog(false)
    setFeedbackContent('')
    setFeedbackDifficulty(3)
    setPendingSharePath('')
    handlePostFinishFlow(sharePath)
  }, [handlePostFinishFlow, pendingSharePath])

  const handleSubmitFeedback = useCallback(async () => {
    if (!execution?.id || feedbackSubmitting) return

    const content = feedbackContent.trim()
    if (!content) {
      Taro.showToast({ title: '请先填写反馈内容', icon: 'none' })
      return
    }

    const sharePath = pendingSharePath
    setFeedbackSubmitting(true)
    try {
      const res = await executionService.submitFeedback({
        executionId: execution.id,
        content,
        difficultyRating: feedbackDifficulty
      })
      if (res) {
        Taro.showToast({ title: '反馈已发送', icon: 'success' })
      } else {
        Taro.showToast({ title: '反馈发送失败，已继续', icon: 'none' })
      }
    } catch (e: any) {
      const message = String(e?.message || '')
      if (message.includes('已提交过反馈')) {
        Taro.showToast({ title: '本次训练已提交过反馈', icon: 'none' })
      } else {
        Taro.showToast({ title: '反馈发送失败，已继续', icon: 'none' })
      }
    } finally {
      setFeedbackSubmitting(false)
      setShowFeedbackDialog(false)
      setFeedbackContent('')
      setFeedbackDifficulty(3)
      setPendingSharePath('')
      handlePostFinishFlow(sharePath)
    }
  }, [execution?.id, feedbackContent, feedbackDifficulty, feedbackSubmitting, handlePostFinishFlow, pendingSharePath])

  // 完成训练
  const handleFinishTraining = async () => {
    if (isReadOnly) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!execution) return

    if (!isImpromptuMode && !canFinishWholeDay) {
      Taro.showModal({
        title: '轻任务未完成',
        content: `还有 ${lightweightProgress.pending} 个轻任务待打卡，请先完成后再结束训练。`,
        confirmText: '返回今日安排',
        cancelText: '继续训练',
        success: (res) => {
          if (res.confirm) {
            handleBackToTodayTraining()
          }
        }
      })
      return
    }

    const actionExecutions = execution.action_executions || []
    const totalSets = actionExecutions.reduce((sum: number, item: ActionExecution) => sum + (item.total_sets || 0), 0)
    const completedSets = actionExecutions.reduce((sum: number, item: ActionExecution) => sum + (item.completed_sets || 0), 0)
    const pendingSets = Math.max(0, totalSets - completedSets)
    const modalContent = pendingSets > 0
      ? `还有 ${pendingSets} 组未完成，确认现在结束训练吗？`
      : '确定要完成本次训练吗？'

    Taro.showModal({
      title: '确认完成训练',
      content: modalContent,
      success: async (res) => {
        if (res.confirm) {
          try {
            setCompleting(true)

            const finishRes = isImpromptuMode
              ? await impromptuService.finish(impromptuId)
              : await executionService.finishTraining(execution.id)

            if (finishRes !== null) {
              if (!isImpromptuMode && dayIndex) {
                Taro.setStorageSync(RETURN_CONFIRM_STORAGE_KEY, {
                  dayIndex,
                  ts: Date.now()
                })
              }

              let sharePath = ''

              if (!isImpromptuMode && execution?.id) {
                try {
                  const shareInfo = await executionService.getShareInfo(execution.id)
                  if (shareInfo?.shareToken) {
                    sharePath = buildPublicTrainingSharePath(shareInfo.shareToken)
                    Taro.setStorageSync('last_training_share_path', sharePath)
                  }
                } catch (e: any) {
                  console.error('获取分享信息失败:', e)
                }
              }

              const shouldAskFeedback = !isImpromptuMode && (
                planInstance?.source === 'coach' ||
                (!!coachId && coachId !== userId)
              )
              if (shouldAskFeedback) {
                setPendingSharePath(sharePath)
                setShowFeedbackDialog(true)
                return
              }

              handlePostFinishFlow(sharePath)
            } else {
              Taro.showToast({ title: '完成失败', icon: 'none' })
            }
          } catch (e: any) {
            Taro.showToast({ title: e.message || '完成失败', icon: 'none' })
          } finally {
            setCompleting(false)
          }
        }
      }
    })
  }

  const handleQuickFinishTraining = async () => {
    if (isReadOnly) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!execution) return

    if (!isImpromptuMode && !canFinishWholeDay) {
      Taro.showModal({
        title: '轻任务未完成',
        content: `还有 ${lightweightProgress.pending} 个轻任务待打卡，请先完成后再结束训练。`,
        confirmText: '返回今日安排',
        cancelText: '继续训练',
        success: (res) => {
          if (res.confirm) {
            handleBackToTodayTraining()
          }
        }
      })
      return
    }

    const actionExecutions = execution.action_executions || []
    const totalSets = actionExecutions.reduce((sum: number, item: ActionExecution) => sum + (item.total_sets || 0), 0)
    const completedSets = actionExecutions.reduce((sum: number, item: ActionExecution) => sum + (item.completed_sets || 0), 0)
    const pendingSets = Math.max(0, totalSets - completedSets)

    if (pendingSets <= 0) {
      await handleFinishTraining()
      return
    }

    Taro.showModal({
      title: '确认一键完成训练',
      content: `还有 ${pendingSets} 组未完成，将按计划默认值自动补齐后完成训练，是否继续？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            setCompleting(true)

            const finishRes = isImpromptuMode
              ? await impromptuService.finish(impromptuId)
              : await executionService.finishTraining({ executionId: execution.id, mode: 'quick' })

            if (finishRes !== null) {
              if (!isImpromptuMode && dayIndex) {
                Taro.setStorageSync(RETURN_CONFIRM_STORAGE_KEY, {
                  dayIndex,
                  ts: Date.now()
                })
              }

              let sharePath = ''

              if (!isImpromptuMode && execution?.id) {
                try {
                  const shareInfo = await executionService.getShareInfo(execution.id)
                  if (shareInfo?.shareToken) {
                    sharePath = buildPublicTrainingSharePath(shareInfo.shareToken)
                    Taro.setStorageSync('last_training_share_path', sharePath)
                  }
                } catch (e: any) {
                  console.error('获取分享信息失败:', e)
                }
              }

              const shouldAskFeedback = !isImpromptuMode && (
                planInstance?.source === 'coach' ||
                (!!coachId && coachId !== userId)
              )
              if (shouldAskFeedback) {
                setPendingSharePath(sharePath)
                setShowFeedbackDialog(true)
                return
              }

              handlePostFinishFlow(sharePath)
            } else {
              Taro.showToast({ title: '完成失败', icon: 'none' })
            }
          } catch (e: any) {
            Taro.showToast({ title: e.message || '完成失败', icon: 'none' })
          } finally {
            setCompleting(false)
          }
        }
      }
    })
  }

  // 跳过今日
  const handleSkipDay = async () => {
    if (isReadOnly) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!instanceId || !dayIndex) return
    Taro.showModal({
      title: '跳过今日',
      content: '确定要跳过今天的训练吗？',
      success: async (res) => {
        if (res.confirm) {
          const ok = await executionService.skipDay(instanceId, dayIndex)
          if (ok) {
            Taro.showToast({ title: '已跳过', icon: 'success' })
            setTimeout(() => Taro.navigateBack(), 800)
          } else {
            Taro.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
  }

  // 完成非力量项目（饮食/有氧/习惯）
  const handleCompleteItem = async (actionIndex: number) => {
    if (isReadOnly) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!execution) return
    const actionExec = execution.action_executions[actionIndex]
    const action = actions[actionExec?.action_id]
    const itemType = (action?.type || 'STRENGTH') as 'DIET' | 'CARDIO' | 'HABIT'
    if (itemType === 'STRENGTH') return

    const state = itemStates[actionIndex] || {}
    const cardioDistance = state.cardioDistance !== null && state.cardioDistance !== undefined
      ? Number(state.cardioDistance)
      : null
    const cardioDuration = state.cardioDuration !== null && state.cardioDuration !== undefined
      ? Number(state.cardioDuration)
      : null
    if (itemType === 'CARDIO') {
      const hasDistance = Number.isFinite(cardioDistance) && (cardioDistance as number) > 0
      const hasDuration = Number.isFinite(cardioDuration) && (cardioDuration as number) > 0
      if (!hasDistance && !hasDuration) {
        Taro.showToast({ title: '请填写有氧距离或时长', icon: 'none' })
        return
      }
    }

    try {
      setCompleting(true)
      const res = await executionService.completeItem({
        executionId: execution.id,
        actionIndex,
        itemType,
        completed: true,
        actualContent: itemType === 'DIET' ? state.dietContent : undefined,
        actualDistance: itemType === 'CARDIO' && Number.isFinite(cardioDistance) && (cardioDistance as number) > 0
          ? (cardioDistance as number) * 1000
          : undefined,
        actualDuration: itemType === 'CARDIO' && Number.isFinite(cardioDuration) && (cardioDuration as number) > 0
          ? (cardioDuration as number) * 60
          : undefined
      })
      if (res) {
        const updated = { ...execution }
        const ae = updated.action_executions[actionIndex]
        if (ae?.sets?.[0]) {
          ae.sets[0] = {
            ...ae.sets[0],
            status: 'completed',
            diet_content: state.dietContent,
            actual_distance: Number.isFinite(cardioDistance) && (cardioDistance as number) > 0
              ? (cardioDistance as number) * 1000
              : undefined,
            actual_duration: Number.isFinite(cardioDuration) && (cardioDuration as number) > 0
              ? (cardioDuration as number) * 60
              : undefined
          }
        }
        ae.completed_sets = 1
        setExecution(updated)
        syncExecutionToCaches(updated)
        setItemStates((prev) => ({ ...prev, [actionIndex]: {} }))
        Taro.showToast({ title: '完成', icon: 'success' })
        const nextIdx = (updated.action_executions || []).findIndex(
          (item: ActionExecution, idx: number) => idx > actionIndex && item.completed_sets < item.total_sets
        )
        if (nextIdx >= 0) {
          setExpandedAction(nextIdx)
          const nextPendingSet = updated.action_executions[nextIdx]?.sets?.findIndex((s: SetData) => s.status === 'pending') ?? 0
          setCurrentSetIndex(nextPendingSet >= 0 ? nextPendingSet : 0)
        } else {
          const allCompleted = (updated.action_executions || []).every(
            (item: ActionExecution) => item.completed_sets >= item.total_sets
          )
          if (allCompleted) {
            Taro.showToast({ title: '全部动作已完成，可点击「完成训练」', icon: 'none', duration: 1800 })
          }
        }
      } else {
        Taro.showToast({ title: '保存失败', icon: 'none' })
      }
    } catch (e: any) {
      Taro.showToast({ title: e.message || '保存失败', icon: 'none' })
    } finally {
      setCompleting(false)
    }
  }

  // 添加额外组
  const handleAddExtraSet = async (actionIndex: number) => {
    if (isReadOnly) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!execution || addingExtraSet) return
    try {
      setAddingExtraSet(true)
      const res = isImpromptuMode
        ? await impromptuService.addExtraSet(execution.id, actionIndex, undefined)
        : await executionService.addExtraSet(execution.id, actionIndex)
      if (res) {
        const updated = { ...execution }
        const ae = updated.action_executions[actionIndex]
        ae.sets.push({
          set_number: res.newSetIndex + 1,
          status: 'pending',
          planned_weight: '',
          planned_reps: '',
          source: 'student_extra'
        })
        ae.total_sets = ae.sets.length
        setExecution(updated)
        syncExecutionToCaches(updated)
        setCurrentSetIndex(res.newSetIndex)
        Taro.showToast({ title: `已添加第${res.newSetIndex + 1}组`, icon: 'success' })
      } else {
        Taro.showToast({ title: '添加失败', icon: 'none' })
      }
    } catch (e: any) {
      Taro.showToast({ title: (e as Error).message || '添加失败', icon: 'none' })
    } finally {
      setAddingExtraSet(false)
    }
  }

  // 加载动作列表（用于添加动作）
  const loadActionPicker = useCallback(async () => {
    try {
      const res = await studentActionLibService.listActions({ page: 1, limit: 100 })
      const list = (res?.actions || [])
        .filter((a: any) => a.type === 'STRENGTH' || !a.type)
        .sort((a: any, b: any) => String(a?.name || '').localeCompare(String(b?.name || ''), 'zh-CN'))
      setActionPickerList(list)
      setActionKeyword('')
    } catch (error) {
      console.error('[training-execution] load action picker failed:', error)
      setActionPickerList([])
      Taro.showToast({ title: '加载动作失败', icon: 'none' })
    }
  }, [])

  const handleOpenExecMenu = useCallback(() => {
    const items: string[] = []
    if (!isImpromptuMode && !!coachId && coachId !== userId) {
      items.push('联系教练')
    }
    if (!isImpromptuMode && !isReadOnly) {
      items.push('跳过本日')
    }
    if (!isReadOnly) {
      items.push('添加动作')
    }
    if (items.length === 0) {
      Taro.showToast({ title: '暂无可选操作', icon: 'none' })
      return
    }
    Taro.showActionSheet({
      itemList: items,
      success: (res) => {
        const choice = items[res.tapIndex]
        if (choice === '联系教练') {
          void handleContactCoach()
        } else if (choice === '跳过本日') {
          void handleSkipDay()
        } else if (choice === '添加动作') {
          setShowActionPicker(true)
          void loadActionPicker()
        }
      }
    })
  }, [coachId, handleContactCoach, handleSkipDay, isImpromptuMode, isReadOnly, loadActionPicker, userId])

  // 删除额外组（仅限 student_extra）
  const handleDeleteExtraSet = async (actionIndex: number, setIdx: number) => {
    if (isReadOnly) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!execution || removingSet) return
    const actionExec = execution.action_executions[actionIndex]
    const set = actionExec?.sets?.[setIdx]
    if (set?.source !== 'student_extra') return
    Taro.showModal({
      title: '删除组',
      content: '确定要删除这组吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          setRemovingSet(true)
          const ok = isImpromptuMode
            ? await impromptuService.deleteExtraSet(execution.id, actionIndex, setIdx)
            : await executionService.deleteExtraSet(execution.id, actionIndex, setIdx)
          if (ok) {
            const updated = { ...execution }
            const ae = updated.action_executions[actionIndex]
            ae.sets.splice(setIdx, 1)
            ae.sets.forEach((s: any, i: number) => { s.set_number = i + 1 })
            ae.total_sets = ae.sets.length
            setExecution(updated)
            syncExecutionToCaches(updated)
            const nextIndex = Math.max(0, Math.min(currentSetIndex, ae.sets.length - 1))
            setCurrentSetIndex(nextIndex)
            Taro.showToast({ title: '已删除', icon: 'success' })
          } else {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        } catch (e: any) {
          Taro.showToast({ title: e.message || '删除失败', icon: 'none' })
        } finally {
          setRemovingSet(false)
        }
      }
    })
  }

  // 删除额外动作（仅限 student_extra）
  const handleDeleteExtraExercise = async (actionIndex: number) => {
    if (isReadOnly) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!execution || removingAction) return
    const actionExec = execution.action_executions[actionIndex]
    if (actionExec?.source !== 'student_extra') return
    Taro.showModal({
      title: '删除动作',
      content: `确定要删除「${actionExec.action_name}」吗？`,
      success: async (res) => {
        if (!res.confirm) return
        try {
          setRemovingAction(true)
          const ok = isImpromptuMode
            ? await impromptuService.deleteExtraExercise(execution.id, actionIndex)
            : await executionService.deleteExtraExercise(execution.id, actionIndex)
          if (ok) {
            const updated = { ...execution }
            updated.action_executions.splice(actionIndex, 1)
            setExecution(updated)
            syncExecutionToCaches(updated)
            setExpandedAction(Math.min(expandedAction, Math.max(0, updated.action_executions.length - 1)))
            setCurrentSetIndex(0)
            Taro.showToast({ title: '已删除', icon: 'success' })
          } else {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        } catch (e: any) {
          Taro.showToast({ title: e.message || '删除失败', icon: 'none' })
        } finally {
          setRemovingAction(false)
        }
      }
    })
  }

  // 添加额外动作
  const handleAddExtraExercise = async (action: any) => {
    if (isReadOnly) {
      Taro.showToast({ title: '只读模式不可修改', icon: 'none' })
      return
    }
    if (!execution || addingExtraAction) return
    try {
      setAddingExtraAction(true)
      const res = isImpromptuMode
        ? await impromptuService.addExtraExercise(execution.id, action.id, action.name || '未知动作', [{ weight: null, reps: null }])
        : await executionService.addExtraExercise(execution.id, action.id, action.name || '未知动作')
      if (res) {
        const updated = { ...execution }
        updated.action_executions.push({
          action_id: action.id,
          action_name: action.name || '未知动作',
          action_order: res.newActionIndex + 1,
          source: 'student_extra',
          sets: [{ set_number: 1, status: 'pending', planned_weight: '', planned_reps: '', source: 'student_extra' }],
          total_sets: 1,
          completed_sets: 0
        })
        setExecution(updated)
        syncExecutionToCaches(updated)
        setExpandedAction(res.newActionIndex)
        setCurrentSetIndex(0)
        setShowActionPicker(false)
        Taro.showToast({ title: `已添加：${action.name}`, icon: 'success' })
      } else {
        Taro.showToast({ title: '添加失败', icon: 'none' })
      }
    } catch (e: any) {
      Taro.showToast({ title: (e as Error).message || '添加失败', icon: 'none' })
    } finally {
      setAddingExtraAction(false)
    }
  }

  if (loading) {
    return (
      <View className="training-execution-page">
        <ScrollView scrollY className="execution-scroll">
          <View className="execution-page-content">
            <View className="loading-wrap">
              <LoadingSpinner size={48} />
            </View>
          </View>
        </ScrollView>
      </View>
    )
  }

  if (!execution) {
    return (
      <View className="training-execution-page">
        <ScrollView scrollY className="execution-scroll">
          <View className="execution-page-content">
            <View className="error-wrap">
              <Text>加载失败，请重试</Text>
              <Button onClick={startTraining}>重试</Button>
            </View>
          </View>
        </ScrollView>
      </View>
    )
  }

  const focusAction = actionExecutions[expandedAction]
  const currentSet = focusAction?.sets?.[currentSetIndex]

  const handleEditCompletedSet = (actionIdx: number, setIdx: number, set: SetData) => {
    const targetKey = setKeyOf(actionIdx, setIdx)
    setExpandedAction(actionIdx)
    setCurrentSetIndex(setIdx)
    setExpandedSetKey(targetKey)
    setEditingSetKey(targetKey)
    hydrateSetInputs(set, { allowCompleted: true })
  }

  const handleCancelEditCompletedSet = () => {
    setEditingSetKey(null)
    const current = actionExecutions?.[expandedAction]?.sets?.[currentSetIndex]
    hydrateSetInputs(current)
  }

  const handleSkipRest = () => {
    setRestTimer(0)
    setIsResting(false)
  }

  const handleAddRestTime = (seconds: number) => {
    setRestTimer((prev) => Math.max(0, prev + seconds))
    setIsResting(true)
  }

  // 计算总进度
  const totalSets = actionExecutions.reduce((sum: number, a: ActionExecution) => sum + (a.total_sets || 0), 0)
  const completedSets = actionExecutions.reduce((sum: number, a: ActionExecution) => sum + (a.completed_sets || 0), 0)
  const pendingSetsCount = Math.max(0, totalSets - completedSets)
  const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0
  const shouldShowQuickFinishButton = !isImpromptuMode && canFinishWholeDay && pendingSetsCount > 0
  const planTitle = String(planInstance?.name || (isImpromptuMode ? '即兴锻炼' : '训练执行')).trim()
  const focusActionDetail = focusAction ? actions[focusAction.action_id] : null
  const focusActionType = String(focusActionDetail?.type || 'STRENGTH').toUpperCase()
  const focusActionMeta = getActionTypeMeta(focusActionType)
  const focusIsStrength = focusActionType === 'STRENGTH'
  const slotPositionLabel =
    trainingCardSlots.length > 0 && currentCardSlotIndex >= 0
      ? `${currentCardSlotIndex + 1} / ${trainingCardSlots.length}`
      : '—'
  const allSlotsDone = totalSets > 0 && completedSets >= totalSets
  const strengthSetTotal = focusIsStrength && focusAction ? Math.max(1, focusAction.total_sets || focusAction.sets?.length || 1) : 0
  const strengthSetPositionLabel =
    focusIsStrength && focusAction ? `${Math.min(currentSetIndex + 1, strengthSetTotal)} / ${strengthSetTotal} 组` : ''

  const flashStrengthSet = focusIsStrength ? focusAction?.sets?.[currentSetIndex] : null
  const flashSetKey =
    focusIsStrength && flashStrengthSet ? setKeyOf(expandedAction, currentSetIndex) : ''
  const flashSetCompleted = !!flashStrengthSet && flashStrengthSet.status === 'completed'
  const flashSetEditing = !!flashSetKey && editingSetKey === flashSetKey
  const flashShowSetForm = focusIsStrength && !!flashStrengthSet && !isReadOnly && (!flashSetCompleted || flashSetEditing)
  const flashPlannedRepsText = String(flashStrengthSet?.planned_reps || '').trim()
    ? `${flashStrengthSet?.planned_reps}次`
    : '自选'
  const flashPlannedSummary = flashStrengthSet
    ? [flashStrengthSet.planned_weight || null, flashPlannedRepsText].filter(Boolean).join(' × ')
    : ''
  const flashActualSummary = flashStrengthSet
    ? [
        flashStrengthSet.actual_weight !== null && flashStrengthSet.actual_weight !== undefined
          ? `${flashStrengthSet.actual_weight}kg`
          : null,
        flashStrengthSet.actual_reps !== null && flashStrengthSet.actual_reps !== undefined
          ? `${flashStrengthSet.actual_reps}次`
          : null,
        flashStrengthSet.rpe ? `RPE ${flashStrengthSet.rpe}` : null
      ]
        .filter(Boolean)
        .join(' · ')
    : ''
  const flashStateText = flashSetEditing ? '编辑中' : flashSetCompleted ? '已完成' : '当前组'
  const flashShowCompletedDetails = focusIsStrength && flashSetCompleted && !flashShowSetForm

  return (
    <View className="training-execution-page">
      <ScrollView scrollY className="execution-scroll">
        <View className="execution-page-content execution-page-content--flash">
          <View className="exec-focus-header">
            <View className="exec-back-pill" onClick={() => void handleBackToTodayTraining()}>
              <Text className="exec-back-pill-text">‹</Text>
            </View>
            <Text className="exec-page-title">训练计划</Text>
            <View className="exec-header-more-hit" onClick={handleOpenExecMenu}>
              <Text className="exec-header-more-dots">⋯</Text>
            </View>
          </View>

          <View className="exec-focus-hero-card">
            <Text className="exec-plan-title">{planTitle || '训练执行'}</Text>
            <Text className="exec-day-line">
              {isImpromptuMode ? '即兴锻炼' : `${isReadOnly ? '只读 · ' : ''}第 ${dayIndex} 天`}
              {totalSets > 0 ? ` · 组进度 ${completedSets} / ${totalSets}` : ''}
            </Text>
            <View className="exec-progress-track">
              <View className="exec-progress-fill" style={{ width: `${progress}%` }} />
            </View>
            <Text className="exec-progress-caption">今日完成度 {Math.round(progress)}%</Text>
            {lightweightProgress.pending > 0 ? (
              <Text className="exec-light-hint">今日安排另有 {lightweightProgress.pending} 个轻任务待打卡</Text>
            ) : null}
            <View className="exec-coach-row">
              <Text className="exec-coach-label">教练 {coachName?.trim() ? coachName : '—'}</Text>
              {isReadOnly ? <Text className="exec-coach-readonly">只读</Text> : null}
            </View>
          </View>

          <View className="exec-flash-stack">
            {isResting ? (
              <View className="exec-rest-strip">
                <Text className="exec-rest-strip-time">{formatTimerValue(restTimer)}</Text>
                <View className="exec-rest-strip-mid">
                  <Text className="exec-rest-strip-label">组间休息</Text>
                  <Text className="exec-rest-strip-hint">结束休息后继续下一组</Text>
                </View>
                <View className="exec-rest-strip-actions">
                  <Text className="exec-rest-chip" onClick={() => handleAddRestTime(30)}>
                    +30秒
                  </Text>
                  <Text className="exec-rest-chip exec-rest-chip--primary" onClick={handleSkipRest}>
                    跳过
                  </Text>
                </View>
              </View>
            ) : null}

            <View className="exec-flash-card">
              {actionExecutions.length === 0 ? (
                <Text className="exec-flash-empty">今日暂无训练动作</Text>
              ) : allSlotsDone ? (
                <View className="exec-flash-done">
                  <Text className="exec-flash-done-title">今日训练项已全部完成</Text>
                  <Text className="exec-flash-done-desc">
                    {canFinishWholeDay
                      ? '点击下方「完成训练」结束今日训练'
                      : `还可返回今日安排完成 ${lightweightProgress.pending} 个轻任务`}
                  </Text>
                </View>
              ) : !focusAction ? (
                <Text className="exec-flash-empty">加载训练项…</Text>
              ) : !focusIsStrength ? (
                <>
                  <View className="exec-flash-card-head">
                    <View className="exec-flash-head-row">
                      <Text className="exec-flash-badge">{focusActionMeta.label}</Text>
                      <Text className="exec-flash-slot-pos">卡片 {slotPositionLabel}</Text>
                    </View>
                    <Text className="exec-flash-action-title">
                      {focusAction.action_name || focusActionDetail?.name || '未知动作'}
                    </Text>
                    <Text className="exec-flash-cue">{focusActionMeta.cue}</Text>
                    {!isReadOnly && focusAction.source === 'student_extra' && (
                      <Text className="exec-flash-delete-action" onClick={() => handleDeleteExtraExercise(expandedAction)}>
                        删除此动作
                      </Text>
                    )}
                  </View>
                  <View className="non-strength-card">
                    {focusAction.completed_sets > 0 ? (
                      <View className="item-completed">
                        <Text className="item-done-text">已打卡完成</Text>
                        {focusAction.sets?.[0]?.diet_content && (
                          <Text className="item-detail">内容：{focusAction.sets[0].diet_content}</Text>
                        )}
                        {focusAction.sets?.[0]?.actual_distance && (
                          <Text className="item-detail">
                            距离：{(focusAction.sets[0].actual_distance / 1000).toFixed(1)} km
                          </Text>
                        )}
                        {focusAction.sets?.[0]?.actual_duration && (
                          <Text className="item-detail">
                            时长：{Math.round((focusAction.sets[0].actual_duration || 0) / 60)} 分钟
                          </Text>
                        )}
                      </View>
                    ) : isReadOnly ? (
                      <View className="item-readonly">
                        <Text className="item-readonly-text">该项目暂无完成记录（只读模式）</Text>
                      </View>
                    ) : (
                      <View className="item-form">
                        <Text className="item-form-title">{focusActionMeta.label}打卡</Text>
                        {focusActionType === 'DIET' && (
                          <View className="compact-note-row">
                            <Text className="compact-input-label">内容</Text>
                            <Input
                              className="compact-note-input"
                              value={itemStates[expandedAction]?.dietContent || ''}
                              placeholder="吃了什么、补了什么"
                              onInput={(e) =>
                                setItemStates((prev) => ({
                                  ...prev,
                                  [expandedAction]: { ...prev[expandedAction], dietContent: e.detail.value }
                                }))
                              }
                            />
                          </View>
                        )}
                        {focusActionType === 'CARDIO' && (
                          <View className="compact-input-grid two-cols">
                            <View className="compact-input-card">
                              <Text className="compact-input-label">距离</Text>
                              <Input
                                type="digit"
                                className="compact-input-field"
                                value={itemStates[expandedAction]?.cardioDistance?.toString() || ''}
                                placeholder="0"
                                onInput={(e) => {
                                  const parsed = parseInputNumber(e.detail.value, 'float')
                                  setItemStates((prev) => ({
                                    ...prev,
                                    [expandedAction]: {
                                      ...prev[expandedAction],
                                      cardioDistance: parsed === null ? null : Math.max(0, parsed)
                                    }
                                  }))
                                }}
                              />
                            </View>
                            <View className="compact-input-card">
                              <Text className="compact-input-label">时长</Text>
                              <Input
                                type="number"
                                className="compact-input-field"
                                value={itemStates[expandedAction]?.cardioDuration?.toString() || ''}
                                placeholder="0"
                                onInput={(e) => {
                                  const parsed = parseInputNumber(e.detail.value, 'int')
                                  setItemStates((prev) => ({
                                    ...prev,
                                    [expandedAction]: {
                                      ...prev[expandedAction],
                                      cardioDuration: parsed === null ? null : Math.max(0, Math.floor(parsed))
                                    }
                                  }))
                                }}
                              />
                            </View>
                          </View>
                        )}
                        <Button
                          type="primary"
                          className="complete-btn"
                          onClick={() => handleCompleteItem(expandedAction)}
                          loading={completing}
                        >
                          完成打卡
                        </Button>
                      </View>
                    )}
                  </View>
                </>
              ) : (
                <>
                  <View className="exec-flash-card-head">
                    <View className="exec-flash-head-row">
                      <Text className="exec-flash-badge">{focusActionMeta.label}</Text>
                      <Text className="exec-flash-slot-pos">卡片 {slotPositionLabel}</Text>
                    </View>
                    <Text className="exec-flash-action-title">
                      {focusAction.action_name || focusActionDetail?.name || '未知动作'}
                    </Text>
                    <Text className="exec-flash-set-pos">{strengthSetPositionLabel}</Text>
                    <Text className="exec-flash-plan-line">
                      计划 {flashPlannedSummary || '待填写'} · {formatRestSummary(flashStrengthSet?.planned_rest_seconds)}
                    </Text>
                    {!isReadOnly && focusAction.source === 'student_extra' && (
                      <Text className="exec-flash-delete-action" onClick={() => handleDeleteExtraExercise(expandedAction)}>
                        删除此动作
                      </Text>
                    )}
                  </View>
                  {!flashStrengthSet ? (
                    <Text className="exec-flash-empty">暂无本组数据</Text>
                  ) : (
                    <View
                      className={`set-item flash-set-item current ${flashSetCompleted ? 'completed' : ''} ${flashShowCompletedDetails ? 'expanded-details' : ''}`}
                    >
                      <View className="set-header set-header--static">
                        <View className="set-index-pill">
                          <Text className="set-index-number">{flashStrengthSet.set_number}</Text>
                          <Text className="set-index-label">组</Text>
                        </View>
                        <View className="set-header-main">
                          <View className="set-header-top">
                            <Text className="set-main-summary">
                              {flashSetCompleted ? flashActualSummary || '已完成' : flashPlannedSummary || '待输入本组数据'}
                            </Text>
                            <Text className={`set-state-pill ${flashSetCompleted ? 'done' : 'active'}`}>{flashStateText}</Text>
                          </View>
                          <View className="set-header-bottom">
                            <Text className="set-subline">计划：{flashPlannedSummary || '未填写'}</Text>
                            <Text className="set-subline">{formatRestSummary(flashStrengthSet.planned_rest_seconds)}</Text>
                            {flashStrengthSet.is_pr && <Text className="set-tag pr">PR</Text>}
                            {flashStrengthSet.is_auto_pr && <Text className="set-tag auto">新纪录</Text>}
                            {flashStrengthSet.video_url && <Text className="set-tag">视频</Text>}
                          </View>
                        </View>
                        {!isReadOnly && flashStrengthSet.source === 'student_extra' && (
                          <Text className="set-delete-btn" onClick={() => handleDeleteExtraSet(expandedAction, currentSetIndex)}>
                            删除
                          </Text>
                        )}
                      </View>

                      {flashShowSetForm && (
                        <View className="set-input">
                          <View className="compact-input-grid">
                            <View className="compact-input-card">
                              <Text className="compact-input-label">重量</Text>
                              <Input
                                type="digit"
                                className="compact-input-field"
                                value={weightInput}
                                placeholder={flashStrengthSet.planned_weight || '0'}
                                onInput={(e) => {
                                  const nextValue = e.detail.value
                                  setWeightInput(nextValue)
                                  setWeight(parseInputNumber(nextValue, 'float'))
                                }}
                              />
                            </View>
                            <View className="compact-input-card">
                              <Text className="compact-input-label">次数</Text>
                              <Input
                                type="number"
                                className="compact-input-field"
                                value={reps?.toString() || ''}
                                placeholder={flashStrengthSet.planned_reps || '0'}
                                onInput={(e) => {
                                  const parsed = parseInputNumber(e.detail.value, 'int')
                                  setReps(parsed === null ? null : Math.max(0, Math.floor(parsed)))
                                }}
                              />
                            </View>
                            <View className="compact-input-card">
                              <Text className="compact-input-label">RPE</Text>
                              <Input
                                type="number"
                                className="compact-input-field"
                                value={rpe?.toString() || ''}
                                placeholder="1-10"
                                onInput={(e) => {
                                  const parsed = parseInputNumber(e.detail.value, 'int')
                                  setRpe(parsed === null ? null : Math.min(10, Math.max(1, Math.floor(parsed))))
                                }}
                              />
                            </View>
                          </View>

                          <View className="compact-note-row">
                            <Text className="compact-input-label">备注</Text>
                            <Input
                              className="compact-note-input"
                              value={setNotes}
                              placeholder="记录手感、节奏或动作问题"
                              onInput={(e) => setSetNotes(e.detail.value)}
                            />
                          </View>

                          <View className="set-tool-row">
                            <Button size="mini" className="ghost-tool-btn" onClick={handleChooseVideo} loading={uploadingVideo}>
                              选视频
                            </Button>
                            <Button size="mini" className="ghost-tool-btn" onClick={handlePasteVideoLink}>
                              贴链接
                            </Button>
                            <Text className={`pr-toggle-chip ${markAsPR ? 'active' : ''}`} onClick={() => setMarkAsPR(!markAsPR)}>
                              {markAsPR ? '已标记 PR' : '标记 PR'}
                            </Text>
                          </View>

                          {videoUrl && <Text className="video-url">{videoUrl.substring(0, 60)}...</Text>}

                          <Button type="primary" className="complete-btn" onClick={handleCompleteSet} loading={completing}>
                            完成本组
                          </Button>
                        </View>
                      )}

                      {!flashSetCompleted && isReadOnly && (
                        <View className="readonly-set-tip">
                          <Text className="readonly-set-tip-text">该组暂无执行记录（只读模式）</Text>
                        </View>
                      )}

                      {flashShowCompletedDetails && (
                        <View className="set-details">
                          <View className="detail-grid">
                            <View className="detail-cell">
                              <Text className="detail-label">计划</Text>
                              <Text className="detail-value">{flashPlannedSummary || '未填写'}</Text>
                            </View>
                            <View className="detail-cell">
                              <Text className="detail-label">实际</Text>
                              <Text className="detail-value">{flashActualSummary || '未填写'}</Text>
                            </View>
                            <View className="detail-cell">
                              <Text className="detail-label">休息</Text>
                              <Text className="detail-value">{formatRestSummary(flashStrengthSet.planned_rest_seconds)}</Text>
                            </View>
                            <View className="detail-cell">
                              <Text className="detail-label">e1RM</Text>
                              <Text className="detail-value">
                                {flashStrengthSet.e1rm !== null && flashStrengthSet.e1rm !== undefined
                                  ? `${flashStrengthSet.e1rm}kg`
                                  : '未生成'}
                              </Text>
                            </View>
                          </View>

                          {!!flashStrengthSet.notes && (
                            <View className="detail-note">
                              <Text className="detail-label">备注</Text>
                              <Text className="detail-note-text">{flashStrengthSet.notes}</Text>
                            </View>
                          )}

                          {!!flashStrengthSet.video_url && (
                            <View className="detail-note">
                              <Text className="detail-label">视频</Text>
                              <Text className="detail-link">{flashStrengthSet.video_url}</Text>
                            </View>
                          )}

                          {!isReadOnly && (
                            <View className="detail-actions">
                              <Button
                                size="mini"
                                className="ghost-tool-btn"
                                onClick={() => handleEditCompletedSet(expandedAction, currentSetIndex, flashStrengthSet)}
                              >
                                编辑本组
                              </Button>
                              {flashSetEditing && (
                                <Button size="mini" className="ghost-tool-btn" onClick={handleCancelEditCompletedSet}>
                                  取消编辑
                                </Button>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}
                  {!isReadOnly && (
                    <View className="extra-set-btn-wrap">
                      <Button
                        size="mini"
                        className="add-extra-set-btn"
                        onClick={() => handleAddExtraSet(expandedAction)}
                        disabled={addingExtraSet}
                      >
                        {addingExtraSet ? '添加中...' : '+ 新增一组'}
                      </Button>
                    </View>
                  )}
                </>
              )}
            </View>

            <View className="exec-card-nav">
              <Text
                className={`exec-nav-btn ${currentCardSlotIndex <= 0 ? 'disabled' : ''}`}
                onClick={currentCardSlotIndex > 0 ? handleManualPrevCard : undefined}
              >
                上一项
              </Text>
              <Text className="exec-nav-counter">{slotPositionLabel}</Text>
              <Text
                className={`exec-nav-btn ${
                  currentCardSlotIndex < 0 || currentCardSlotIndex >= trainingCardSlots.length - 1 ? 'disabled' : ''
                }`}
                onClick={
                  currentCardSlotIndex >= 0 && currentCardSlotIndex < trainingCardSlots.length - 1
                    ? handleManualNextCard
                    : undefined
                }
              >
                下一项
              </Text>
            </View>
            <Text className="exec-nav-hint">顺序完成更利于统计；跳过未完成的组会提示确认，可能影响今日完成度。</Text>
          </View>

        {/* 动作选择弹层 */}
        {showActionPicker && (
          <View className="action-picker-mask" onClick={() => setShowActionPicker(false)}>
            <View className="action-picker-panel" onClick={(e) => e.stopPropagation()}>
              <Text className="picker-title">选择动作</Text>
              <Input
                className="picker-search-input"
                value={actionKeyword}
                placeholder="搜索动作"
                onInput={(e) => setActionKeyword(e.detail.value)}
              />
              <ScrollView scrollY className="picker-list">
                {filteredActionPickerList.map((a) => (
                  <View key={a.id} className="picker-item" onClick={() => handleAddExtraExercise(a)}>
                    <Text>{a.name || '未命名'}</Text>
                  </View>
                ))}
                {filteredActionPickerList.length === 0 && <Text className="picker-empty">暂无匹配动作</Text>}
              </ScrollView>
              <Button size="mini" onClick={() => setShowActionPicker(false)}>取消</Button>
            </View>
          </View>
        )}

        {/* 完成训练按钮 */}
        {!isReadOnly && (
          <View className="footer-section">
            {!canFinishWholeDay && !isImpromptuMode && (
              <Text className="finish-hint">仍有 {lightweightProgress.pending} 个轻任务待完成</Text>
            )}
            <Button
              type="primary"
              className={`finish-btn ${!canFinishWholeDay && !isImpromptuMode ? 'warning' : ''}`}
              onClick={
                !canFinishWholeDay && !isImpromptuMode
                  ? handleBackToTodayTraining
                  : shouldShowQuickFinishButton
                    ? handleQuickFinishTraining
                    : handleFinishTraining
              }
              loading={completing}
            >
              {!canFinishWholeDay && !isImpromptuMode
                ? '返回今日安排继续轻任务'
                : shouldShowQuickFinishButton
                  ? '一键完成训练'
                  : '完成训练'}
            </Button>
          </View>
        )}
        </View>
      </ScrollView>

      {showFeedbackDialog && (
        <View className="feedback-modal-mask">
          <View className="feedback-modal" onClick={(e) => e.stopPropagation()}>
            <View className="feedback-modal-header">
              <Text className="feedback-modal-title">训练感受如何？</Text>
              <Text className="feedback-modal-subtitle">写一句反馈，教练会在沟通中看到</Text>
            </View>

            <View className="feedback-difficulty-wrap">
              {FEEDBACK_DIFFICULTY_OPTIONS.map((item) => (
                <View
                  key={item.value}
                  className={`difficulty-option ${feedbackDifficulty === item.value ? 'active' : ''}`}
                  onClick={() => {
                    if (!feedbackSubmitting) setFeedbackDifficulty(item.value)
                  }}
                >
                  {(() => { const Icon = require("@nutui/icons-react-taro")[item.icon]; return <Icon size={20} />; })()}
                  <Text className="difficulty-label">{item.label}</Text>
                </View>
              ))}
            </View>

            <Textarea
              className="feedback-input"
              maxlength={500}
              value={feedbackContent}
              placeholder="例如：深蹲感觉可以加一点重量，卧推动作还不稳定..."
              onInput={(e) => setFeedbackContent(String(e.detail.value || '').slice(0, 500))}
            />
            <Text className="feedback-count">{feedbackContent.length}/500</Text>

            <View className="feedback-actions">
              <Button
                size="mini"
                className="feedback-skip-btn"
                disabled={feedbackSubmitting}
                onClick={handleSkipFeedback}
              >
                跳过
              </Button>
              <Button
                size="mini"
                type="primary"
                className="feedback-submit-btn"
                loading={feedbackSubmitting}
                disabled={!feedbackContent.trim()}
                onClick={() => void handleSubmitFeedback()}
              >
                发送给教练
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

export default TrainingExecution
