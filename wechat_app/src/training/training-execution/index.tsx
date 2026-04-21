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
import { Clock, Heart, Power, Target } from '@nutui/icons-react-taro'
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
      setLoading(true)

      if (isImpromptuMode && impromptuId) {
        // 即兴训练：直接获取执行记录
        const data = await impromptuService.get(impromptuId)
        if (!data) {
          Taro.showToast({ title: '无法加载即兴执行记录', icon: 'none' })
          return
        }
        setExecution(data)
        setPlanInstance({
          id: 'impromptu',
          name: '即兴锻炼',
          description: '即兴训练模式',
          source: 'impromptu'
        })
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
        const actionExecutions = data.action_executions || []
        if (actionExecutions.length > 0) {
          for (let i = 0; i < actionExecutions.length; i++) {
            const action = actionExecutions[i]
            const pendingSetIndex = action.sets?.findIndex((s: SetData) => s.status === 'pending')
            if (pendingSetIndex !== -1) {
              setExpandedAction(i)
              setCurrentSetIndex(pendingSetIndex)
              break
            }
          }
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
          const actionExecutions = data.action_executions || []
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
        <View className="loading-wrap">
          <LoadingSpinner size={48} />
        </View>
      </View>
    )
  }

  if (!execution) {
    return (
      <View className="training-execution-page">
        <View className="error-wrap">
          <Text>加载失败，请重试</Text>
          <Button onClick={startTraining}>重试</Button>
        </View>
      </View>
    )
  }

  const actionExecutions = execution.action_executions || []
  const currentAction = actionExecutions[expandedAction]
  const currentSet = currentAction?.sets?.[currentSetIndex]

  const handleExpandAction = (actionIdx: number) => {
    setExpandedAction(actionIdx)
    setExpandedSetKey(null)
    setEditingSetKey(null)
    const nextAction = actionExecutions[actionIdx]
    const pendingIdx = nextAction?.sets?.findIndex((s: SetData) => s.status === 'pending') ?? -1
    if (pendingIdx >= 0) {
      setCurrentSetIndex(pendingIdx)
      return
    }
    setCurrentSetIndex(0)
  }

  const handlePressSet = (actionIdx: number, setIdx: number) => {
    const targetSet = actionExecutions?.[actionIdx]?.sets?.[setIdx]
    if (!targetSet) return

    const targetKey = setKeyOf(actionIdx, setIdx)
    if (targetSet.status === 'completed') {
      setExpandedSetKey((prev) => (prev === targetKey ? null : targetKey))
      return
    }

    setExpandedAction(actionIdx)
    setCurrentSetIndex(setIdx)
    setExpandedSetKey(null)
    setEditingSetKey(null)
  }

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
  const completedActions = actionExecutions.reduce((sum: number, a: ActionExecution) => {
    return sum + ((a.completed_sets || 0) >= (a.total_sets || 0) ? 1 : 0)
  }, 0)
  const planTitle = String(planInstance?.name || (isImpromptuMode ? '即兴锻炼' : '训练执行')).trim()
  const heroTimerValue = isResting ? formatTimerValue(restTimer) : '00:00'
  const heroTimerLabel = isResting ? '自动休息中' : pendingSetsCount > 0 ? '准备下一组' : '今日已完成'
  const currentActionName = String(currentAction?.action_name || '').trim() || '等待选择动作'
  const currentActionType = String(actions?.[currentAction?.action_id]?.type || 'STRENGTH').toUpperCase()
  const currentActionMeta = getActionTypeMeta(currentActionType)
  const currentPlannedSummary = currentSet
    ? [currentSet.planned_weight || null, currentSet.planned_reps ? `${currentSet.planned_reps}次` : null].filter(Boolean).join(' × ')
    : ''
  const currentActualSummary = currentSet
    ? [
        currentSet.actual_weight !== null && currentSet.actual_weight !== undefined ? `${currentSet.actual_weight}kg` : null,
        currentSet.actual_reps !== null && currentSet.actual_reps !== undefined ? `${currentSet.actual_reps}次` : null,
        currentSet.rpe ? `RPE ${currentSet.rpe}` : null
      ].filter(Boolean).join(' · ')
    : ''
  const currentRestLabel = formatRestSummary(currentSet?.planned_rest_seconds)

  return (
    <View className="training-execution-page">
      <ScrollView scrollY className="execution-scroll">
        <View className="execution-shell">
          <View className="hero-section">
            <View className="hero-topbar">
              <Text className="back-btn" onClick={() => Taro.navigateBack()}>返回</Text>
              <Text className="hero-day-label">{isImpromptuMode ? '即兴锻炼' : `${isReadOnly ? '只读查看 · ' : ''}第${dayIndex}天`}</Text>
              <View className="hero-top-actions">
                {!isImpromptuMode && !!coachId && coachId !== userId && (
                  <Text className="hero-link-btn" onClick={() => void handleContactCoach()}>联系教练</Text>
                )}
                {!isImpromptuMode && !isReadOnly && (
                  <Text className="hero-link-btn muted" onClick={handleSkipDay}>跳过</Text>
                )}
              </View>
            </View>

            <View className="hero-main">
              <View className="hero-timer-card">
                <Text className="hero-timer-value">{heroTimerValue}</Text>
                <Text className="hero-timer-label">{heroTimerLabel}</Text>
              </View>
              <View className="hero-summary">
                <Text className="hero-title">{planTitle || '训练执行'}</Text>
                <Text className="hero-subtitle">
                  {currentActionName}
                  {currentPlannedSummary ? ` · ${currentPlannedSummary}` : ''}
                </Text>
                <View className="hero-chip-row">
                  <Text className="hero-chip">{currentActionMeta.label}</Text>
                  <Text className="hero-chip">{currentRestLabel}</Text>
                  {currentActualSummary ? <Text className="hero-chip success">{currentActualSummary}</Text> : null}
                  {isReadOnly ? <Text className="hero-chip warning">只读模式</Text> : null}
                </View>
              </View>
            </View>

            <View className="hero-stats">
              <View className="hero-stat-card">
                <Text className="hero-stat-label">动作</Text>
                <Text className="hero-stat-value">{actionExecutions.length}</Text>
              </View>
              <View className="hero-stat-card">
                <Text className="hero-stat-label">组进度</Text>
                <Text className="hero-stat-value">{completedSets}/{totalSets}</Text>
              </View>
              <View className="hero-stat-card">
                <Text className="hero-stat-label">已完成</Text>
                <Text className="hero-stat-value">{completedActions}</Text>
              </View>
              <View className="hero-stat-card">
                <Text className="hero-stat-label">轻任务</Text>
                <Text className="hero-stat-value">{lightweightProgress.pending}</Text>
              </View>
            </View>

            <View className="progress-section">
              <View className="progress-bar">
                <View className="progress-fill" style={{ width: `${progress}%` }} />
              </View>
              <Text className="progress-text">已完成 {Math.round(progress)}%</Text>
            </View>
          </View>

          <View className="actions-section">
            {actionExecutions.map((action: ActionExecution, actionIdx: number) => {
              const actionDetail = actions[action.action_id]
              const actionType = String(actionDetail?.type || 'STRENGTH').toUpperCase()
              const actionMeta = getActionTypeMeta(actionType)
              const isStrength = actionType === 'STRENGTH'
              const isExpanded = expandedAction === actionIdx
              const isCompleted = action.completed_sets >= action.total_sets
              const firstSet = action.sets?.[0]
              const actionSummary = isStrength
                ? [
                    firstSet?.planned_weight || null,
                    firstSet?.planned_reps ? `${firstSet.planned_reps}次` : null,
                    formatRestSummary(firstSet?.planned_rest_seconds)
                  ].filter(Boolean).join(' · ')
                : actionMeta.cue

              return (
                <View
                  key={actionIdx}
                  className={`action-card action-tone-${actionType.toLowerCase()} ${isExpanded ? 'expanded' : ''} ${isCompleted ? 'completed' : ''}`}
                >
                  <View className="action-header" onClick={() => handleExpandAction(actionIdx)}>
                    <View className="action-info">
                      <Text className="action-number">{actionIdx + 1}</Text>
                      <View className="action-copy">
                        <Text className="action-name">{action.action_name || actionDetail?.name || '未知动作'}</Text>
                        <View className="action-meta-row">
                          <Text className="action-type-pill">{actionMeta.label}</Text>
                          {actionSummary ? <Text className="action-summary">{actionSummary}</Text> : null}
                        </View>
                      </View>
                    </View>
                    <View className="action-progress">
                      <Text className={`action-progress-pill ${isCompleted ? 'done' : ''}`}>{action.completed_sets}/{action.total_sets}组</Text>
                      {!isReadOnly && action.source === 'student_extra' && (
                        <Text
                          className="action-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteExtraExercise(actionIdx)
                          }}
                        >
                          删除
                        </Text>
                      )}
                    </View>
                  </View>

                {isExpanded && (
                  <View className="action-content">
                    {isStrength ? (
                      <>
                        <View className="sets-list">
                          {action.sets?.map((set: SetData, setIdx: number) => {
                            const isCurrentSet = setIdx === currentSetIndex
                            const isCompletedSet = set.status === 'completed'
                            const setKey = setKeyOf(actionIdx, setIdx)
                            const isExpandedSet = expandedSetKey === setKey
                            const isEditingThisSet = editingSetKey === setKey
                            const showSetForm = isCurrentSet && !isReadOnly && (!isCompletedSet || isEditingThisSet)
                            const plannedRepsText = String(set.planned_reps || '').trim() ? `${set.planned_reps}次` : '自选'
                            const plannedSummary = [set.planned_weight || null, plannedRepsText].filter(Boolean).join(' × ')
                            const actualSummary = [
                              set.actual_weight !== null && set.actual_weight !== undefined ? `${set.actual_weight}kg` : null,
                              set.actual_reps !== null && set.actual_reps !== undefined ? `${set.actual_reps}次` : null,
                              set.rpe ? `RPE ${set.rpe}` : null
                            ].filter(Boolean).join(' · ')
                            const stateText = isEditingThisSet
                              ? '编辑中'
                              : isCompletedSet
                                ? '已完成'
                                : isCurrentSet
                                  ? '当前组'
                                  : '待完成'

                            return (
                              <View
                                key={setIdx}
                                className={`set-item ${isCurrentSet ? 'current' : ''} ${isCompletedSet ? 'completed' : ''} ${isExpandedSet ? 'expanded-details' : ''}`}
                              >
                                <View className="set-header" onClick={() => handlePressSet(actionIdx, setIdx)}>
                                  <View className="set-index-pill">
                                    <Text className="set-index-number">{set.set_number}</Text>
                                    <Text className="set-index-label">组</Text>
                                  </View>
                                  <View className="set-header-main">
                                    <View className="set-header-top">
                                      <Text className="set-main-summary">{isCompletedSet ? actualSummary || '已完成' : plannedSummary || '待输入本组数据'}</Text>
                                      <Text className={`set-state-pill ${isCompletedSet ? 'done' : isCurrentSet ? 'active' : ''}`}>{stateText}</Text>
                                    </View>
                                    <View className="set-header-bottom">
                                      <Text className="set-subline">计划：{plannedSummary || '未填写'}</Text>
                                      <Text className="set-subline">{formatRestSummary(set.planned_rest_seconds)}</Text>
                                      {set.is_pr && <Text className="set-tag pr">PR</Text>}
                                      {set.is_auto_pr && <Text className="set-tag auto">新纪录</Text>}
                                      {set.video_url && <Text className="set-tag">视频</Text>}
                                    </View>
                                  </View>
                                  {!isReadOnly && set.source === 'student_extra' && (
                                    <Text
                                      className="set-delete-btn"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteExtraSet(actionIdx, setIdx)
                                      }}
                                    >
                                      删除
                                    </Text>
                                  )}
                                </View>

                                {showSetForm && (
                                  <View className="set-input">
                                    <View className="compact-input-grid">
                                      <View className="compact-input-card">
                                        <Text className="compact-input-label">重量</Text>
                                        <Input
                                          type="digit"
                                          className="compact-input-field"
                                          value={weightInput}
                                          placeholder={set.planned_weight || '0'}
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
                                          placeholder={set.planned_reps || '0'}
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
                                      <Text
                                        className={`pr-toggle-chip ${markAsPR ? 'active' : ''}`}
                                        onClick={() => setMarkAsPR(!markAsPR)}
                                      >
                                        {markAsPR ? '已标记 PR' : '标记 PR'}
                                      </Text>
                                    </View>

                                    {videoUrl && <Text className="video-url">{videoUrl.substring(0, 60)}...</Text>}

                                    <Button
                                      type="primary"
                                      className="complete-btn"
                                      onClick={handleCompleteSet}
                                      loading={completing}
                                    >
                                      完成本组
                                    </Button>
                                  </View>
                                )}

                                {isCurrentSet && !isCompletedSet && isReadOnly && (
                                  <View className="readonly-set-tip">
                                    <Text className="readonly-set-tip-text">该组暂无执行记录（只读模式）</Text>
                                  </View>
                                )}

                                {isCompletedSet && isExpandedSet && (
                                  <View className="set-details">
                                    <View className="detail-grid">
                                      <View className="detail-cell">
                                        <Text className="detail-label">计划</Text>
                                        <Text className="detail-value">{plannedSummary || '未填写'}</Text>
                                      </View>
                                      <View className="detail-cell">
                                        <Text className="detail-label">实际</Text>
                                        <Text className="detail-value">{actualSummary || '未填写'}</Text>
                                      </View>
                                      <View className="detail-cell">
                                        <Text className="detail-label">休息</Text>
                                        <Text className="detail-value">{formatRestSummary(set.planned_rest_seconds)}</Text>
                                      </View>
                                      <View className="detail-cell">
                                        <Text className="detail-label">e1RM</Text>
                                        <Text className="detail-value">
                                          {set.e1rm !== null && set.e1rm !== undefined ? `${set.e1rm}kg` : '未生成'}
                                        </Text>
                                      </View>
                                    </View>

                                    {!!set.notes && (
                                      <View className="detail-note">
                                        <Text className="detail-label">备注</Text>
                                        <Text className="detail-note-text">{set.notes}</Text>
                                      </View>
                                    )}

                                    {!!set.video_url && (
                                      <View className="detail-note">
                                        <Text className="detail-label">视频</Text>
                                        <Text className="detail-link">{set.video_url}</Text>
                                      </View>
                                    )}

                                    {!isReadOnly && (
                                      <View className="detail-actions">
                                        <Button size="mini" className="ghost-tool-btn" onClick={() => handleEditCompletedSet(actionIdx, setIdx, set)}>
                                          编辑本组
                                        </Button>
                                        {isEditingThisSet && (
                                          <Button size="mini" className="ghost-tool-btn" onClick={handleCancelEditCompletedSet}>
                                            取消编辑
                                          </Button>
                                        )}
                                      </View>
                                    )}
                                  </View>
                                )}
                              </View>
                            )
                          })}
                        </View>
                        {!isReadOnly && (
                          <View className="extra-set-btn-wrap">
                            <Button
                              size="mini"
                              className="add-extra-set-btn"
                              onClick={() => handleAddExtraSet(actionIdx)}
                              disabled={addingExtraSet}
                            >
                              {addingExtraSet ? '添加中...' : '+ 新增一组'}
                            </Button>
                          </View>
                        )}
                      </>
                    ) : (
                      <View className="non-strength-card">
                        {action.completed_sets > 0 ? (
                          <View className="item-completed">
                            <Text className="item-done-text">已打卡完成</Text>
                            {action.sets?.[0]?.diet_content && <Text className="item-detail">内容：{action.sets[0].diet_content}</Text>}
                            {action.sets?.[0]?.actual_distance && <Text className="item-detail">距离：{(action.sets[0].actual_distance / 1000).toFixed(1)} km</Text>}
                            {action.sets?.[0]?.actual_duration && <Text className="item-detail">时长：{Math.round((action.sets[0].actual_duration || 0) / 60)} 分钟</Text>}
                          </View>
                        ) : isReadOnly ? (
                          <View className="item-readonly">
                            <Text className="item-readonly-text">该项目暂无完成记录（只读模式）</Text>
                          </View>
                        ) : (
                          <View className="item-form">
                            <Text className="item-form-title">{actionMeta.label}打卡</Text>
                            {actionType === 'DIET' && (
                              <View className="compact-note-row">
                                <Text className="compact-input-label">内容</Text>
                                <Input
                                  className="compact-note-input"
                                  value={itemStates[actionIdx]?.dietContent || ''}
                                  placeholder="吃了什么、补了什么"
                                  onInput={(e) => setItemStates((prev) => ({ ...prev, [actionIdx]: { ...prev[actionIdx], dietContent: e.detail.value } }))}
                                />
                              </View>
                            )}
                            {actionType === 'CARDIO' && (
                              <View className="compact-input-grid two-cols">
                                <View className="compact-input-card">
                                  <Text className="compact-input-label">距离</Text>
                                  <Input
                                    type="digit"
                                    className="compact-input-field"
                                    value={itemStates[actionIdx]?.cardioDistance?.toString() || ''}
                                    placeholder="0"
                                    onInput={(e) => {
                                      const parsed = parseInputNumber(e.detail.value, 'float')
                                      setItemStates((prev) => ({
                                        ...prev,
                                        [actionIdx]: {
                                          ...prev[actionIdx],
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
                                    value={itemStates[actionIdx]?.cardioDuration?.toString() || ''}
                                    placeholder="0"
                                    onInput={(e) => {
                                      const parsed = parseInputNumber(e.detail.value, 'int')
                                      setItemStates((prev) => ({
                                        ...prev,
                                        [actionIdx]: {
                                          ...prev[actionIdx],
                                          cardioDuration: parsed === null ? null : Math.max(0, Math.floor(parsed))
                                        }
                                      }))
                                    }}
                                  />
                                </View>
                              </View>
                            )}
                            <Button type="primary" className="complete-btn" onClick={() => handleCompleteItem(actionIdx)} loading={completing}>
                              完成打卡
                            </Button>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )
          })}
        </View>

        {!isReadOnly && (
          <View className="add-action-wrap">
            <Button
              size="mini"
              className="add-action-btn"
              onClick={async () => {
                setShowActionPicker(true)
                await loadActionPicker()
              }}
              disabled={addingExtraAction}
            >
              {addingExtraAction ? '添加中...' : '+ 添加动作'}
            </Button>
          </View>
        )}
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

      {isResting && (
        <View className="rest-timer-mask">
          <View className="rest-timer-panel">
            <Text className="rest-timer-emoji"><Clock size={20} /></Text>
            <Text className="rest-timer-value">
              {Math.floor(restTimer / 60)}:{String(restTimer % 60).padStart(2, '0')}
            </Text>
            <Text className="rest-timer-label">组间休息</Text>
            <View className="rest-timer-actions">
              <Button size="mini" onClick={() => handleAddRestTime(30)}>
                +30秒
              </Button>
              <Button size="mini" onClick={handleSkipRest}>
                跳过休息
              </Button>
            </View>
          </View>
        </View>
      )}

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
