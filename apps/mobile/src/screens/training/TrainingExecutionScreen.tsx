import { useEffect, useMemo, useRef, useState } from 'react'
import { isTimedTrainingSet, getActualDurationSeconds, getPlannedDurationSeconds, formatRecordedTrainingSet } from '@coachlink/core/src/trainingSetMetrics'
import { buildPlannedSetPreviews } from '@coachlink/core/src/planSetPrescriptions'
import { canStartPlanDay, executionCapabilities, resolveTrainingIntent, type TrainingIntent } from '@coachlink/core/src/trainingAccess'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { apiClient, fetchWithTimeout, getStoredToken } from '../../api'
import { API_BASE_URL } from '../../config'
import { Page } from '../../components/Page'
import { SectionCard } from '../../components/SectionCard'
import { IconFont } from '../../components/IconFont'
import { colors, radius, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'
import { openExternalUrl } from '../../externalLinks'
import { useAuth } from '../../providers/AuthProvider'
import { executionSnapshotKey, readExecutionSnapshot, syncTrainingExecutionToCache } from './trainingCache'
import {
  displayLoad,
  normalizeExecution,
  normalizeTrainingItemType,
  parseNumberInput,
  pickData,
} from './trainingModel'
import {
  clearRestTimerDeadline,
  persistRestTimerDeadline,
  readRestTimerDeadline,
} from './restTimerCache'

type Props = NativeStackScreenProps<RootStackParamList, 'TrainingExecution'>
type DraftValue = { weight: string; reps: string; rpe: string; notes: string; isPr: boolean; videoUrl: string; videoId?: string }
type ItemDraftValue = { content: string; distance: string; duration: string; notes: string }
type PickerAction = { id?: string; name: string; type?: string; source: 'mine' | 'public' }

function draftKey(actionIndex: number, setIndex: number) {
  return `${actionIndex}:${setIndex}`
}

function buildPlanPreview(planData: any, dayIndex: number) {
  const instance = planData?.instance
  const actions = planData?.actions || {}
  const day = (instance?.training_days || []).find(
    (item: any) => Number(item?.dayIndex ?? item?.day_index) === Number(dayIndex),
  )
  const actionExecutions = (day?.actionSets || []).map((item: any, actionIndex: number) => {
    const actionId = item?.action_id || item?.actionId
    const action = actions[actionId] || {}
    const params = item?.params || {}
    const itemType = normalizeTrainingItemType(item?.itemType || action?.type)
    return {
      action_id: actionId,
      action_name: action?.name || item?.set_name || `任务 ${actionIndex + 1}`,
      attrs: action?.attrs,
      item_type: itemType,
      params,
      custom_data: params.custom_data || {},
      status: 'pending',
      sets: buildPlannedSetPreviews({ ...item, itemType }),
    }
  })
  return normalizeExecution({
    instance_id: instance?.id,
    day_index: dayIndex,
    status: 'preview',
    action_executions: actionExecutions,
    execution_notice: instance?.execution_notice || instance?.executionNotice,
  })
}

function formatRestTime(seconds: number) {
  const safe = Math.max(0, Math.ceil(seconds))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

function formatElapsedTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  if (safe >= 86400) {
    const days = Math.floor(safe / 86400)
    const hours = Math.floor((safe % 86400) / 3600)
    const minutes = Math.floor((safe % 3600) / 60)
    return `${days}天 ${hours}小时 ${minutes}分钟`
  }
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secondsPart = safe % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secondsPart).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(secondsPart).padStart(2, '0')}`
}

export function TrainingExecutionScreen({ route, navigation }: Props) {
  const params = route.params || {}
  const { user } = useAuth()
  const userId = user?.id ? String(user.id) : ''
  const isImpromptu = Boolean((params as any).impromptuId)
  const [intent, setIntent] = useState(() => resolveTrainingIntent(params.intent, params.readOnly))
  const readOnly = !isImpromptu && intent === 'preview'
  const [cloudReady, setCloudReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [canStartPreview, setCanStartPreview] = useState(false)
  const loadInFlight = useRef<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [execution, setExecution] = useState<any | null>(null)
  const [drafts, setDrafts] = useState<Record<string, DraftValue>>({})
  const [itemDrafts, setItemDrafts] = useState<Record<number, ItemDraftValue>>({})
  const [planActions, setPlanActions] = useState<Record<string, any>>({})
  const [feedbackContent, setFeedbackContent] = useState('')
  const [feedbackDifficulty, setFeedbackDifficulty] = useState(3)
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [restDeadlineAt, setRestDeadlineAt] = useState(0)
  const [restRemaining, setRestRemaining] = useState(0)
  const [restTimerMinimized, setRestTimerMinimized] = useState(false)
  const [pickerVisible, setPickerVisible] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerActions, setPickerActions] = useState<PickerAction[]>([])
  const [expandedSetKey, setExpandedSetKey] = useState('')
  const [uploadingVideoKey, setUploadingVideoKey] = useState('')

  const cacheKey = useMemo(() => {
    if ((params as any).impromptuId) return executionSnapshotKey({ mode: 'impromptu', id: (params as any).impromptuId })
    return executionSnapshotKey({ mode: 'plan', instanceId: params.instanceId, dayIndex: params.dayIndex || 1 })
  }, [params])
  const requestScope = `${userId}:${cacheKey}:${params.intent || ''}:${params.readOnly || false}`
  const currentScope = useRef(requestScope)
  currentScope.current = requestScope

  async function syncExecution(next: any) {
    setExecution(next)
    if (!userId) return
    await syncTrainingExecutionToCache({
      userId,
      key: cacheKey,
      isImpromptu,
      instanceId: params.instanceId,
      dayIndex: Number(params.dayIndex || next?.day_index || 1),
      execution: next,
    }).catch((error) => {
      // 云端写入已经成功时，本地缓存失败不能误报为业务操作失败。
      console.warn('[mobile-training] failed to persist execution cache', error)
    })
  }

  async function hydrateFromCloud(requestedIntent?: TrainingIntent, restartTimedOut = false) {
    const scope = requestScope
    if (loadInFlight.current === scope) return
    if (!(params as any).impromptuId && !params.instanceId) {
      setLoading(false)
      return
    }
    loadInFlight.current = scope
    const isCurrent = () => currentScope.current === scope
    const commit = async (next: any) => { if (isCurrent()) await syncExecution(next) }
    const loadIntent = requestedIntent || intent
    if (requestedIntent) setIntent(requestedIntent)
    setCloudReady(false)
    setLoadError('')
    setSyncing(true)
    try {
      if (isImpromptu) {
        const res = await apiClient.request('/api/impromptu/get', {
          method: 'POST',
          body: { id: (params as any).impromptuId },
          timeoutMs: 15000,
        })
        await commit(normalizeExecution(pickData(res)))
      } else {
        const planRes = await apiClient.request('/api/plan-lib/get-instance', {
          method: 'POST',
          body: { id: params.instanceId },
          timeoutMs: 15000,
        })
        const planData = pickData(planRes) || {}
        if (!isCurrent()) return
        setPlanActions(planData.actions || {})
        setCanStartPreview(canStartPlanDay({ trainingDays: planData.instance?.training_days || [],
          progressDayIndex: Number(planData.recommendedDayIndex || 1), targetDayIndex: Number(params.dayIndex || 1),
          executionsByDayIndex: planData.executionsByDayIndex }))
        if (loadIntent !== 'execute') {
          const dayIndex = Number(params.dayIndex || 1)
          const existing = planData.executionsByDayIndex?.[dayIndex]
          if (existing) await commit(normalizeExecution(existing))
          else setExecution(buildPlanPreview(planData, dayIndex))
        } else {
          const res = await apiClient.request('/api/execution/start', {
            method: 'POST',
            body: { instanceId: params.instanceId, dayIndex: params.dayIndex || 1, restartTimedOut },
            timeoutMs: 15000,
          })
          const normalized = normalizeExecution(pickData(res))
          await commit(normalized)
        }
      }
      if (isCurrent()) setCloudReady(true)
    } catch (error) {
      if (isCurrent()) setLoadError(error instanceof Error ? error.message : '加载失败，请稍后重试')
    } finally {
      if (loadInFlight.current === scope) loadInFlight.current = null
      if (isCurrent()) { setSyncing(false); setLoading(false) }
    }
  }

  const progressText = execution ? `${execution.completed_sets || 0}/${execution.total_sets || 0}` : '-'
  const status = String(execution?.status || '').toLowerCase()
  const isCompleted = status === 'completed' || status === 'finished'
  const capabilities = executionCapabilities(execution, isImpromptu ? 'execute' : intent, cloudReady)
  const canEditRecords = !syncing && (capabilities.canRecord || (!isImpromptu && capabilities.canCorrect))
  const operationDisabled = syncing || !capabilities.canRecord

  useEffect(() => {
    let alive = true
    const routeIntent = resolveTrainingIntent(params.intent, params.readOnly)
    setIntent(routeIntent)
    setCloudReady(false)
    setExecution(null)
    setLoading(true)
    async function boot() {
      const cached = await readExecutionSnapshot(userId, cacheKey).catch((error) => {
        console.warn('[mobile-training] failed to read execution cache', error)
        return null
      })
      if (alive && cached) {
        setExecution(normalizeExecution(cached))
        setLoading(false)
      }
      if (alive) await hydrateFromCloud(routeIntent)
    }
    void boot()
    return () => {
      alive = false
    }
  }, [cacheKey, userId, params.intent, params.readOnly])

  useEffect(() => {
    const startedAt = new Date(execution?.started_at || execution?.created_at || Date.now()).getTime()
    const completedAt = new Date(execution?.completed_at || execution?.updated_at || Date.now()).getTime()
    const tick = () => {
      const base = Number.isFinite(startedAt) ? startedAt : Date.now()
      const end = isCompleted && Number.isFinite(completedAt) ? Math.max(base, completedAt) : Date.now()
      setElapsedSeconds(Math.max(0, Math.floor((end - base) / 1000)))
    }
    tick()
    if (!capabilities.canRecord) return
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [execution?.started_at, execution?.created_at, execution?.completed_at, execution?.updated_at, isCompleted, capabilities.canRecord])

  useEffect(() => {
    const executionId = String(execution?.id || '')
    if (!executionId || !userId || !capabilities.canRecord) return
    let active = true
    void readRestTimerDeadline(userId, executionId).then((deadlineAt) => {
      if (!active || deadlineAt <= Date.now()) return
      setRestDeadlineAt(deadlineAt)
      setRestTimerMinimized(true)
    })
    return () => {
      active = false
    }
  }, [execution?.id, capabilities.canRecord, userId])

  useEffect(() => {
    if (!restDeadlineAt) {
      setRestRemaining(0)
      return
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((restDeadlineAt - Date.now()) / 1000))
      setRestRemaining(remaining)
      if (remaining === 0) {
        setRestDeadlineAt(0)
        setRestTimerMinimized(false)
        if (execution?.id) void clearRestTimerDeadline(userId, String(execution.id))
      }
    }
    tick()
    const timer = setInterval(tick, 500)
    return () => clearInterval(timer)
  }, [execution?.id, restDeadlineAt, userId])

  const elapsedText = formatElapsedTime(elapsedSeconds)
  const elapsedLabel = isCompleted && elapsedSeconds >= 86400 ? '跨天完成，历时' : isCompleted ? '本次用时' : '训练总时长'

  function startRestTimer(seconds: number) {
    if (!capabilities.canRecord || !execution?.id) return
    const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 90
    const deadlineAt = Date.now() + safeSeconds * 1000
    setRestDeadlineAt(deadlineAt)
    setRestRemaining(safeSeconds)
    setRestTimerMinimized(false)
    void persistRestTimerDeadline(userId, String(execution.id), deadlineAt)
  }

  function adjustRestTimer(deltaSeconds: number) {
    if (!execution?.id) return
    const currentRemaining = Math.max(0, Math.ceil((restDeadlineAt - Date.now()) / 1000))
    const nextRemaining = Math.max(1, currentRemaining + deltaSeconds)
    const deadlineAt = Date.now() + nextRemaining * 1000
    setRestDeadlineAt(deadlineAt)
    setRestRemaining(nextRemaining)
    void persistRestTimerDeadline(userId, String(execution.id), deadlineAt)
  }

  function skipRestTimer() {
    setRestDeadlineAt(0)
    setRestRemaining(0)
    setRestTimerMinimized(false)
    if (execution?.id) void clearRestTimerDeadline(userId, String(execution.id))
  }

  function setDraft(actionIndex: number, setIndex: number, patch: Partial<DraftValue>) {
    const key = draftKey(actionIndex, setIndex)
    setDrafts((current) => {
      const base: DraftValue = current[key] || { weight: '', reps: '', rpe: '', notes: '', isPr: false, videoUrl: '' }
      return { ...current, [key]: { ...base, ...patch } }
    })
  }

  function getDraft(actionIndex: number, setIndex: number, set: any): DraftValue {
    const existing = drafts[draftKey(actionIndex, setIndex)]
    if (existing) return existing
    const action = execution?.action_executions?.find((item: any) => item.actionIndex === actionIndex)
    const timed = isTimedTrainingSet(set, action)
    const seconds = getActualDurationSeconds(set) ?? (set.status === 'completed' ? null : getPlannedDurationSeconds(set, action))
    return {
      weight: set.actualWeight != null ? String(set.actualWeight) : set.plannedWeight != null ? String(set.plannedWeight).replace(/[^\d.-]/g, '') : '',
      reps: timed ? (seconds === null ? '' : String(seconds)) : set.actualReps != null ? String(set.actualReps) : set.plannedReps != null ? String(set.plannedReps).replace(/[^\d.-]/g, '') : '',
      rpe: set.rpe != null ? String(set.rpe) : '',
      notes: String(set.notes || ''),
      isPr: Boolean(set.isPr || (!timed && set.isAutoPr)),
      videoUrl: String(set.videoUrl || ''),
    }
  }

  async function uploadSetVideo(action: any, set: any) {
    if (!canEditRecords) return
    const key = draftKey(action.actionIndex, set.setIndex)
    if (!execution?.id || (!isImpromptu && !action.actionId) || uploadingVideoKey) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.72,
      videoMaxDuration: 90,
    })
    const asset = result.canceled ? null : result.assets[0]
    if (!asset?.uri) return
    if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
      Alert.alert('视频过大', '单个训练视频请小于 50MB。')
      return
    }
    setUploadingVideoKey(key)
    try {
      const token = await getStoredToken()
      const type = asset.mimeType || 'video/mp4'
      const ext = type.split('/')[1] || 'mp4'
      const formData = new FormData()
      formData.append('file', { uri: asset.uri, name: asset.fileName || `training-set-${Date.now()}.${ext}`, type } as any)
      formData.append('executionId', String(execution.id))
      if (action.actionId) formData.append('actionId', String(action.actionId))
      formData.append('actionIndex', String(action.actionIndex))
      formData.append('setNumber', String(set.setNumber))
      const endpoint = isImpromptu ? '/api/impromptu/upload-set-video' : '/api/execution/upload-set-video'
      const response = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      }, 180_000)
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success || !payload?.data?.video_url) throw new Error(payload?.message || '视频上传失败')
      setDraft(action.actionIndex, set.setIndex, { videoUrl: String(payload.data.video_url), videoId: String(payload.data.id || '') })
    } catch (error) {
      Alert.alert('视频上传失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setUploadingVideoKey('')
    }
  }

  async function ensureVideoLinkSaved(action: any, set: any, draft: DraftValue) {
    const url = draft.videoUrl.trim()
    if (!url || draft.videoId) return
    if (!/^https?:\/\//i.test(url)) throw new Error('视频链接需以 http:// 或 https:// 开头')
    const endpoint = isImpromptu ? '/api/impromptu/add-set-video-link' : '/api/execution/add-set-video-link'
    const payload = await apiClient.request<any>(endpoint, {
      method: 'POST',
      body: {
        executionId: execution.id,
        actionId: action.actionId,
        actionIndex: action.actionIndex,
        setNumber: set.setNumber,
        videoUrl: url,
      },
      timeoutMs: 15000,
    })
    setDraft(action.actionIndex, set.setIndex, { videoId: String(payload?.id || '') })
  }

  function getActionItemType(action: any) {
    return normalizeTrainingItemType(
      action?.itemType || action?.item_type || planActions[action?.actionId]?.type,
    )
  }

  function getItemDraft(action: any): ItemDraftValue {
    const existing = itemDrafts[action.actionIndex]
    if (existing) return existing
    return {
      content: String(action.actualContent || ''),
      distance: action.actualDistance ? String(Number(action.actualDistance) / 1000) : '',
      duration: action.actualDuration ? String(Number(action.actualDuration) / 60) : '',
      notes: String(action.notes || ''),
    }
  }

  function setItemDraft(actionIndex: number, patch: Partial<ItemDraftValue>) {
    setItemDrafts((current) => ({
      ...current,
      [actionIndex]: {
        ...(current[actionIndex] || { content: '', distance: '', duration: '', notes: '' }),
        ...patch,
      },
    }))
  }

  async function completeItem(action: any) {
    if (!execution?.id || operationDisabled || isImpromptu) return
    const itemType = getActionItemType(action)
    if (itemType === 'STRENGTH') return
    const draft = getItemDraft(action)
    const distance = parseNumberInput(draft.distance)
    const duration = parseNumberInput(draft.duration)
    if (itemType === 'CARDIO' && (!distance || distance <= 0) && (!duration || duration <= 0)) {
      Alert.alert('请补充记录', '有氧任务至少填写距离或时长。')
      return
    }

    setSyncing(true)
    try {
      const res = await apiClient.request('/api/execution/complete-item', {
        method: 'POST',
        body: {
          executionId: execution.id,
          actionIndex: action.actionIndex,
          itemType,
          completed: true,
          actualContent: itemType === 'DIET' ? draft.content.trim() || undefined : undefined,
          actualDistance: itemType === 'CARDIO' && distance ? distance * 1000 : undefined,
          actualDuration: itemType === 'CARDIO' && duration ? duration * 60 : undefined,
          notes: draft.notes.trim() || undefined,
        },
        timeoutMs: 15000,
      })
      const data = pickData(res) || {}
      const nextActions = execution.action_executions.map((item: any) => {
        if (item.actionIndex !== action.actionIndex) return item
        return {
          ...item,
          status: 'completed',
          completed: true,
          actualContent: itemType === 'DIET' ? draft.content.trim() : item.actualContent,
          actualDistance: itemType === 'CARDIO' && distance ? distance * 1000 : item.actualDistance,
          actualDuration: itemType === 'CARDIO' && duration ? duration * 60 : item.actualDuration,
          notes: draft.notes.trim(),
          sets: item.sets.map((set: any, index: number) =>
            index === 0 ? { ...set, status: 'completed', notes: draft.notes.trim() } : set,
          ),
        }
      })
      const next = {
        ...execution,
        action_executions: nextActions,
        completed_sets: Number(data.completedItems ?? execution.completed_sets + 1),
        total_sets: Number(data.totalItems ?? execution.total_sets),
        status:
          Number(data.totalItems || 0) > 0 && Number(data.completedItems || 0) >= Number(data.totalItems)
            ? 'completed'
            : execution.status,
      }
      await syncExecution(next)
    } catch (error) {
      Alert.alert('打卡失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setSyncing(false)
    }
  }

  async function completeSet(action: any, set: any) {
    const actionIndex = action.actionIndex
    const setIndex = set.setIndex
    if (!execution?.id || !canEditRecords) return
    const draft = getDraft(actionIndex, setIndex, set)
    const actualWeight = parseNumberInput(draft.weight)
    const actualReps = parseNumberInput(draft.reps)
    const timed = isTimedTrainingSet(set, action)
    if (actualReps == null || actualReps <= 0) {
      Alert.alert(timed ? '请填写保持时长' : '请填写次数', timed ? '请填写实际保持的秒数。' : '完成组前需要填写大于 0 的实际次数。')
      return
    }
    const plannedLoad = String(set.plannedWeight ?? '').toLowerCase()
    if (!timed && actualWeight === null && !plannedLoad.includes('rm') && !plannedLoad.includes('%')) {
      Alert.alert('请填写外加重量', '徒手训练可点击“自重 / 无负重”。')
      return
    }
    setSyncing(true)
    try {
      await ensureVideoLinkSaved(action, set, draft)
      const body: any = {
        executionId: execution.id,
        actionIndex,
        setIndex,
        actionId: action.actionId,
        actualWeight: timed ? null : actualWeight,
        actualReps: timed ? null : actualReps,
        actualDuration: timed ? actualReps : undefined,
        notes: draft.notes.trim() || undefined,
      }
      if (!isImpromptu) {
        body.rpe = parseNumberInput(draft.rpe)
        body.is_pr = draft.isPr
        body.has_video = Boolean(draft.videoUrl.trim())
      }
      const res = await apiClient.request(isImpromptu ? '/api/impromptu/complete-set' : '/api/execution/complete-set', { method: 'POST', body, timeoutMs: 15000 })
      const data = pickData(res)
      const responseExecution = Array.isArray(data?.action_executions)
        ? normalizeExecution(data)
        : execution
      const next = patchCompletedSet(responseExecution, actionIndex, setIndex, {
        actualWeight: body.actualWeight,
        actualReps: body.actualReps,
        actualDuration: body.actualDuration,
        rpe: body.rpe,
        notes: draft.notes.trim(),
        isPr: draft.isPr,
        isAutoPr: Boolean(data?.autoE1RM?.isPR),
        e1rm: timed ? null : data?.autoE1RM?.e1rm,
        videoUrl: draft.videoUrl.trim(),
        completedSets: data?.completedSets,
        totalSets: data?.totalSets,
      })
      await syncExecution(next)
      if (data?.autoE1RM?.isPR) {
        Alert.alert('刷新个人纪录', `本组估算 1RM 为 ${Number(data.autoE1RM.e1rm).toFixed(1)} kg。`)
      }
      if (set.status !== 'completed') startRestTimer(Number(set.plannedRestSeconds || 90))
    } catch (error) {
      Alert.alert('记录失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setSyncing(false)
    }
  }

  function patchCompletedSet(current: any, actionIndex: number, setIndex: number, values: { actualWeight: number | null; actualReps: number | null; actualDuration?: number; rpe?: number | null; notes?: string; isPr?: boolean; isAutoPr?: boolean; e1rm?: number | null; videoUrl?: string; completedSets?: number; totalSets?: number }) {
    const nextActions = current.action_executions.map((action: any) => {
      if (action.actionIndex !== actionIndex) return action
      const nextSets = action.sets.map((item: any) => item.setIndex === setIndex
        ? { ...item, status: 'completed', actualWeight: values.actualWeight, actualReps: values.actualReps, actualDuration: values.actualDuration ?? item.actualDuration, rpe: values.rpe ?? item.rpe, notes: values.notes ?? item.notes, isPr: values.isPr ?? item.isPr, isAutoPr: values.isAutoPr ?? item.isAutoPr, e1rm: values.e1rm === null ? null : values.e1rm ?? item.e1rm, hasVideo: Boolean(values.videoUrl || item.videoUrl), videoUrl: values.videoUrl || item.videoUrl }
        : item)
      return { ...action, sets: nextSets }
    })
    return {
      ...current,
      action_executions: nextActions,
      completed_sets: Number(values.completedSets ?? nextActions.reduce((sum: number, action: any) => sum + action.sets.filter((item: any) => item.status === 'completed').length, 0)),
      total_sets: Number(values.totalSets ?? current.total_sets ?? nextActions.reduce((sum: number, action: any) => sum + action.sets.length, 0)),
    }
  }

  async function addSet(actionIndex: number, action: any) {
    if (!execution?.id || operationDisabled) return
    const last = action.sets[action.sets.length - 1]
    setSyncing(true)
    try {
      await apiClient.request(isImpromptu ? '/api/impromptu/extra-content/add-extra-set' : '/api/execution/extra-content/add-extra-set', {
        method: 'POST',
        body: {
          executionId: execution.id,
          actionIndex,
          weight: last?.actualWeight ?? last?.plannedWeight ?? null,
          reps: last?.actualReps ?? last?.plannedReps ?? null,
        },
        timeoutMs: 15000,
      })
      await hydrateFromCloud()
    } catch (error) {
      Alert.alert('加组失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setSyncing(false)
    }
  }

  async function deleteSet(actionIndex: number, setIndex: number) {
    if (!execution?.id || operationDisabled) return
    Alert.alert('删除这一组', '只允许删除训练中额外添加的组。确定继续？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSyncing(true)
            try {
              await apiClient.request(isImpromptu ? '/api/impromptu/extra-content/delete-extra-set' : '/api/execution/extra-content/delete-extra-set', {
                method: 'POST',
                body: { executionId: execution.id, actionIndex, setIndex },
                timeoutMs: 15000,
              })
              await hydrateFromCloud()
            } catch (error) {
              Alert.alert('删除失败', error instanceof Error ? error.message : '只有额外添加的组可以删除')
            } finally {
              setSyncing(false)
            }
          })()
        },
      },
    ])
  }

  async function deleteExercise(actionIndex: number) {
    if (!execution?.id || operationDisabled) return
    Alert.alert('删除动作', '只允许删除训练中额外添加的动作。确定继续？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSyncing(true)
            try {
              await apiClient.request(isImpromptu ? '/api/impromptu/extra-content/delete-extra-exercise' : '/api/execution/extra-content/delete-extra-exercise', {
                method: 'POST',
                body: { executionId: execution.id, actionIndex },
                timeoutMs: 15000,
              })
              await hydrateFromCloud()
            } catch (error) {
              Alert.alert('删除失败', error instanceof Error ? error.message : '只有额外添加的动作可以删除')
            } finally {
              setSyncing(false)
            }
          })()
        },
      },
    ])
  }

  async function loadPickerActions(search = pickerQuery) {
    setPickerLoading(true)
    try {
      const [mineRes, publicRes] = await Promise.allSettled([
        apiClient.request('/api/student/action-lib/list-actions', { method: 'POST', body: { page: 1, limit: 40, search }, timeoutMs: 10000 }),
        apiClient.request('/api/public-action-lib/list-actions', { method: 'POST', body: { page: 1, limit: 40, search, status: 'published' }, timeoutMs: 10000 }),
      ])
      const mine = mineRes.status === 'fulfilled' ? pickActionRows(mineRes.value, 'mine') : []
      const seen = new Set(mine.map((item) => item.name))
      const pub = publicRes.status === 'fulfilled' ? pickActionRows(publicRes.value, 'public').filter((item) => !seen.has(item.name)) : []
      setPickerActions([...mine, ...pub])
    } finally {
      setPickerLoading(false)
    }
  }

  function openActionPicker() {
    if (operationDisabled) return
    setPickerVisible(true)
    void loadPickerActions('')
  }

  function pickActionRows(payload: any, source: 'mine' | 'public'): PickerAction[] {
    const data = pickData(payload)
    const rows = ['actions', 'items', 'data'].flatMap((key) => Array.isArray(data?.[key]) ? data[key] : [])
    return rows.map((row: any) => ({
      id: row.id,
      name: String(row.name || row.action_name || '').trim(),
      type: row.type || row.category || row.muscle_group,
      source,
    })).filter((row) => {
      if (!row.name) return false
      const type = String(row.type || '').toUpperCase()
      return !['DIET', 'CARDIO', 'HABIT', 'REST'].includes(type)
    })
  }

  async function ensureStudentAction(row: PickerAction): Promise<PickerAction> {
    if (row.source === 'mine') return row
    try {
      const res = await apiClient.request('/api/public-action-lib/add-to-my-lib', {
        method: 'POST',
        body: { actionId: row.id, targetActionType: 'student' },
        timeoutMs: 15000,
      })
      const action = pickData(res)?.action
      if (action?.id) return { id: action.id, name: action.name || row.name, type: action.type || row.type, source: 'mine' }
    } catch {}

    const mineRes = await apiClient.request('/api/student/action-lib/list-actions', { method: 'POST', body: { page: 1, limit: 50, search: row.name }, timeoutMs: 10000 })
    const existing = pickActionRows(mineRes, 'mine').find((item) => item.name === row.name)
    return existing || row
  }

  async function addExercise(row: PickerAction) {
    if (!execution?.id || operationDisabled) return
    setSyncing(true)
    try {
      const action = await ensureStudentAction(row)
      if (!action.id) throw new Error('动作缺少 ID，无法加入训练')
      await apiClient.request(isImpromptu ? '/api/impromptu/extra-content/add-extra-exercise' : '/api/execution/extra-content/add-extra-exercise', {
        method: 'POST',
        body: {
          executionId: execution.id,
          actionId: action.id,
          actionName: action.name,
          sets: [{ weight: null, reps: null }],
        },
        timeoutMs: 15000,
      })
      setPickerVisible(false)
      await hydrateFromCloud()
    } catch (error) {
      Alert.alert('添加失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setSyncing(false)
    }
  }

  async function finish() {
    if (!execution?.id || operationDisabled) return
    setSyncing(true)
    try {
      const res = await apiClient.request(isImpromptu ? '/api/impromptu/finish' : '/api/execution/finish', { method: 'POST', body: { executionId: execution.id }, timeoutMs: 15000 })
      const data = pickData(res) || {}
      const next = normalizeExecution({
        ...execution,
        ...data,
        status: data.status || 'completed',
        action_executions: data.action_executions || execution.action_executions,
      })
      await syncExecution(next)
      skipRestTimer()
      Alert.alert('训练已完成', '本次训练记录已保存。')
    } catch (error) {
      Alert.alert('完成失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setSyncing(false)
    }
  }

  async function submitTrainingFeedback() {
    if (!execution?.id || isImpromptu || feedbackSubmitting || feedbackSubmitted) return
    const content = feedbackContent.trim()
    if (!content) {
      Alert.alert('请填写反馈', '简单说说本次训练的感受，教练会据此调整后续计划。')
      return
    }
    setFeedbackSubmitting(true)
    try {
      await apiClient.request('/api/execution/submit-feedback', {
        method: 'POST',
        body: {
          executionId: execution.id,
          content,
          difficultyRating: feedbackDifficulty,
        },
        timeoutMs: 15000,
      })
      setFeedbackSubmitted(true)
      await syncExecution({ ...execution, app_feedback_submitted: true })
    } catch (feedbackError) {
      const message = feedbackError instanceof Error ? feedbackError.message : '请稍后重试'
      if (message.includes('已提交过反馈')) {
        setFeedbackSubmitted(true)
        await syncExecution({ ...execution, app_feedback_submitted: true })
      } else {
        Alert.alert('反馈提交失败', message)
      }
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  if (loading && !execution) {
    return (
      <Page title="训练执行" subtitle="正在进入训练">
        <SectionCard title="同步训练记录" description="优先读取本地缓存，同时拉取云端最新数据。">
          <ActivityIndicator color={colors.brand} />
        </SectionCard>
      </Page>
    )
  }

  if (!execution) {
    return (
      <Page title="训练执行" subtitle="还没有可执行的训练记录">
        <SectionCard title="尚未开始训练" description={loadError || '未取得训练记录，请重新核对。'}>
          <Pressable onPress={() => void hydrateFromCloud()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>重新核对并重试</Text>
          </Pressable>
          <Pressable onPress={() => navigation.replace('ImpromptuTraining')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>开始即兴锻炼</Text>
          </Pressable>
        </SectionCard>
      </Page>
    )
  }

  return (
    <Page title={isImpromptu ? '即兴训练' : '训练执行'} subtitle={syncing ? '正在同步训练记录...' : readOnly ? '只读查看，不会创建或修改训练记录' : isCompleted ? '本次训练已完成' : '记录当前组，云端返回后更新本地缓存'}>
      {loadError ? <SectionCard title="未能同步训练" description={loadError}>
        <Pressable disabled={syncing} onPress={() => void hydrateFromCloud()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>重新核对并重试</Text>
        </Pressable>
      </SectionCard> : null}
      {capabilities.canRecover ? <SectionCard title="上次训练已超时" description="已有记录仍保留。如果实际已经练完，请按实际日期补记完成；否则可以重新训练这一天。">
        <Pressable disabled={syncing} onPress={() => Alert.alert('重新训练', '保留原记录并重新开始这一天？', [
          { text: '取消', style: 'cancel' }, { text: '重新开始', onPress: () => { void hydrateFromCloud('execute', true) } },
        ])} style={styles.primaryButton}><Text style={styles.primaryButtonText}>重新训练这一天</Text></Pressable>
      </SectionCard> : null}
      <View style={styles.hero}>
        <View>
          <Text style={styles.heroLabel}>{isImpromptu ? '自由训练' : `计划第 ${params.dayIndex || execution.day_index || 1} 天`}</Text>
          <Text style={styles.heroTitle}>{progressText}</Text>
          <Text style={styles.heroSub}>已完成 / 总组数 · {elapsedLabel} {elapsedText}</Text>
        </View>
        <View style={styles.heroIcon}><IconFont name="icon-dumbbell" color={colors.brand} size={28} /></View>
      </View>

      {execution.execution_notice ? (
        <SectionCard title="执行计划阅读须知" description={String(execution.execution_notice)} />
      ) : null}

      {readOnly ? (
        <View style={styles.readOnlyBanner}>
          <IconFont name="icon-time" color={colors.brand} size={18} />
          <View style={styles.readOnlyMain}>
            <Text style={styles.readOnlyTitle}>计划预览，尚未开始</Text>
            <Text style={styles.readOnlyText}>预览不会创建或修改训练记录。开始前会重新核对云端进度。</Text>
            <Pressable disabled={syncing} onPress={() => void hydrateFromCloud(canStartPreview ? 'execute' : 'preview')} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{canStartPreview ? '核对并开始训练' : '刷新计划状态'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {restRemaining > 0 && restTimerMinimized ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`继续组间休息，剩余 ${formatRestTime(restRemaining)}`} onPress={() => setRestTimerMinimized(false)} style={styles.restBubble}>
          <Text style={styles.restBubbleLabel}>组间休息</Text>
          <Text style={styles.restBubbleValue}>{formatRestTime(restRemaining)}</Text>
        </Pressable>
      ) : null}

      {execution.action_executions.map((action: any) => {
        const itemType = getActionItemType(action)
        const actionCompleted =
          action.status === 'completed' ||
          action.completed ||
          action.sets.every((set: any) => set.status === 'completed')
        if (itemType !== 'STRENGTH') {
          const itemDraft = getItemDraft(action)
          const typeLabel = itemType === 'DIET' ? '饮食任务' : itemType === 'CARDIO' ? '有氧任务' : '习惯打卡'
          return (
            <SectionCard key={`${action.actionIndex}-${action.actionName}`} title={action.actionName} description={`${typeLabel} · ${actionCompleted ? '已完成' : '待完成'}`}>
              {itemType === 'DIET' ? (
                <TextInput
                  value={itemDraft.content}
                  editable={!actionCompleted && !operationDisabled}
                  onChangeText={(value) => setItemDraft(action.actionIndex, { content: value })}
                  placeholder="记录实际饮食内容（可选）"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  style={styles.itemTextarea}
                />
              ) : null}
              {itemType === 'CARDIO' ? (
                <View style={styles.itemInputRow}>
                  <TextInput
                    value={itemDraft.distance}
                    editable={!actionCompleted && !operationDisabled}
                    onChangeText={(value) => setItemDraft(action.actionIndex, { distance: value })}
                    keyboardType="decimal-pad"
                    placeholder="距离 km"
                    placeholderTextColor={colors.textMuted}
                    style={styles.itemInput}
                  />
                  <TextInput
                    value={itemDraft.duration}
                    editable={!actionCompleted && !operationDisabled}
                    onChangeText={(value) => setItemDraft(action.actionIndex, { duration: value })}
                    keyboardType="decimal-pad"
                    placeholder="时长 min"
                    placeholderTextColor={colors.textMuted}
                    style={styles.itemInput}
                  />
                </View>
              ) : null}
              <TextInput
                value={itemDraft.notes}
                editable={!actionCompleted && !operationDisabled}
                onChangeText={(value) => setItemDraft(action.actionIndex, { notes: value })}
                placeholder="备注（可选）"
                placeholderTextColor={colors.textMuted}
                style={styles.itemInput}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${action.actionName}，${actionCompleted ? '已完成' : itemType === 'HABIT' ? '立即打卡' : '完成任务'}`}
                accessibilityState={{ disabled: actionCompleted || operationDisabled, busy: syncing }}
                disabled={actionCompleted || operationDisabled}
                onPress={() => completeItem(action)}
                style={[styles.itemDoneButton, (actionCompleted || operationDisabled) && styles.doneButtonDisabled]}
              >
                <Text style={styles.doneButtonText}>{actionCompleted ? '已完成' : itemType === 'HABIT' ? '立即打卡' : '完成任务'}</Text>
              </Pressable>
            </SectionCard>
          )
        }

        return (
          <SectionCard key={`${action.actionIndex}-${action.actionName}`} title={action.actionName} description={`${action.sets.filter((set: any) => set.status === 'completed').length}/${action.sets.length} 组已完成`}>
            {action.sets.map((set: any) => {
              const draft = getDraft(action.actionIndex, set.setIndex, set)
              const completed = set.status === 'completed'
              const setKey = draftKey(action.actionIndex, set.setIndex)
              const expanded = expandedSetKey === setKey
              const uploadingVideo = uploadingVideoKey === setKey
              const canEditSet = canEditRecords
              return (
                <View key={set.setIndex} style={[styles.setRow, completed && styles.setCompleted]}>
                  <View style={styles.setHead}>
                    <View style={styles.setTitleRow}>
                      <Text style={styles.setTitle}>第 {set.setNumber} 组</Text>
                      {set.isPr || draft.isPr ? <Text style={styles.prTag}>PR</Text> : null}
                      {set.isAutoPr && !isTimedTrainingSet(set, action) ? <Text style={styles.autoPrTag}>自动纪录</Text> : null}
                      {set.videoUrl || draft.videoUrl ? <Text style={styles.videoTag}>视频</Text> : null}
                      {set.notes || draft.notes ? <Text style={styles.noteTag}>备注</Text> : null}
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={`删除第 ${set.setNumber} 组`} accessibilityState={{ disabled: operationDisabled }} disabled={operationDisabled} onPress={() => deleteSet(action.actionIndex, set.setIndex)} style={styles.deleteSetButton}>
                      <Text style={[styles.deleteText, operationDisabled && styles.disabledText]}>删除</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.setPlan}>计划 {isTimedTrainingSet(set, action) ? `保持 ${getPlannedDurationSeconds(set, action) ?? '-'} 秒` : displayLoad(set.plannedWeight, set.plannedReps)}{set.plannedRestSeconds ? ` · 休息 ${set.plannedRestSeconds} 秒` : ''}</Text>
                  {completed && <Text style={styles.setPlan}>{formatRecordedTrainingSet(set, action)}</Text>}
                  <View style={styles.inputs}>
                    {!isTimedTrainingSet(set, action) && <TextInput accessibilityLabel={`第 ${set.setNumber} 组外加重量`} value={draft.weight} editable={canEditSet} onChangeText={(value) => setDraft(action.actionIndex, set.setIndex, { weight: value })} keyboardType="decimal-pad" placeholder="外加重量 kg" placeholderTextColor={colors.textMuted} style={styles.input} />}
                    <TextInput accessibilityLabel={`第 ${set.setNumber} 组${isTimedTrainingSet(set, action) ? '保持秒数' : '次数'}`} value={draft.reps} editable={canEditSet} onChangeText={(value) => setDraft(action.actionIndex, set.setIndex, { reps: value })} keyboardType="number-pad" placeholder={isTimedTrainingSet(set, action) ? '保持秒数' : '次数'} placeholderTextColor={colors.textMuted} style={styles.input} />
                    {!isImpromptu ? <TextInput accessibilityLabel={`第 ${set.setNumber} 组 RPE`} value={draft.rpe} editable={canEditSet} onChangeText={(value) => setDraft(action.actionIndex, set.setIndex, { rpe: value })} keyboardType="decimal-pad" placeholder="RPE" placeholderTextColor={colors.textMuted} style={styles.input} /> : null}
                    <Pressable accessibilityRole="button" accessibilityLabel={`${completed ? '保存' : '完成'}第 ${set.setNumber} 组`} accessibilityState={{ disabled: !canEditSet || uploadingVideo, busy: syncing || uploadingVideo }} disabled={!canEditSet || uploadingVideo} onPress={() => completeSet(action, set)} style={[styles.doneButton, (!canEditSet || uploadingVideo) && styles.doneButtonDisabled]}>
                      <Text style={styles.doneButtonText}>{completed ? '保存' : '完成'}</Text>
                    </Pressable>
                  </View>
                  {!isTimedTrainingSet(set, action) && <Pressable accessibilityRole="button" disabled={!canEditSet} onPress={() => setDraft(action.actionIndex, set.setIndex, { weight: '0' })} style={styles.setMoreButton}><Text style={styles.setMoreText}>{draft.weight === '0' ? '已选自重 / 无负重' : '自重 / 无负重'}</Text></Pressable>}
                  <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? '收起' : '展开'}第 ${set.setNumber} 组详细记录`} accessibilityState={{ expanded }} onPress={() => setExpandedSetKey(expanded ? '' : setKey)} style={styles.setMoreButton}>
                    <Text style={styles.setMoreText}>{expanded ? '收起详细记录' : '备注、PR 与组视频'}</Text>
                    <IconFont name={expanded ? 'icon-left' : 'icon-right-arrow'} color={colors.brand} size={14} />
                  </Pressable>
                  {expanded ? (
                    <View style={styles.setMorePanel}>
                      <TextInput
                        value={draft.notes}
                        editable={canEditSet}
                        onChangeText={(value) => setDraft(action.actionIndex, set.setIndex, { notes: value })}
                        placeholder="记录动作感受、疼痛或技术提示（可选）"
                        placeholderTextColor={colors.textMuted}
                        maxLength={500}
                        multiline
                        textAlignVertical="top"
                        style={styles.setNotesInput}
                      />
                      <Text style={styles.setNotesCount}>{draft.notes.length}/500</Text>
                      {!isImpromptu ? (
                        <Pressable accessibilityRole="checkbox" accessibilityLabel={`第 ${set.setNumber} 组标记为进步组`} accessibilityState={{ checked: draft.isPr, disabled: !canEditSet }} disabled={!canEditSet} onPress={() => setDraft(action.actionIndex, set.setIndex, { isPr: !draft.isPr })} style={[styles.prToggle, draft.isPr && styles.prToggleActive, !canEditSet && styles.doneButtonDisabled]}>
                          <IconFont name="icon-star" color={draft.isPr ? '#FFFFFF' : colors.brand} size={16} />
                          <View style={styles.prToggleMain}>
                            <Text style={[styles.prToggleTitle, draft.isPr && styles.prToggleTitleActive]}>{draft.isPr ? '已标记进步组' : '标记为进步组'}</Text>
                            <Text style={[styles.prToggleHint, draft.isPr && styles.prToggleHintActive]}>自动 PR 仍由系统按估算 1RM 独立判断</Text>
                          </View>
                        </Pressable>
                      ) : <Text style={styles.setHelper}>即兴训练会自动计算估算 1RM 和 PR，无需手动标记。</Text>}
                      {(
                        <>
                          <View style={styles.videoActionRow}>
                            <Pressable accessibilityRole="button" accessibilityLabel={draft.videoUrl ? `替换第 ${set.setNumber} 组视频` : `选择第 ${set.setNumber} 组视频`} accessibilityState={{ disabled: !canEditSet || uploadingVideo, busy: uploadingVideo }} disabled={!canEditSet || uploadingVideo} onPress={() => void uploadSetVideo(action, set)} style={[styles.videoActionButton, (!canEditSet || uploadingVideo) && styles.doneButtonDisabled]}>
                              {uploadingVideo ? <ActivityIndicator color={colors.brand} size="small" /> : <IconFont name="icon-video" color={colors.brand} size={17} />}
                              <Text style={styles.videoActionText}>{uploadingVideo ? '上传中…' : draft.videoUrl ? '替换视频' : '选择视频'}</Text>
                            </Pressable>
                            {draft.videoUrl ? (
                              <Pressable accessibilityRole="button" accessibilityLabel="预览本组训练视频" onPress={() => void openExternalUrl(draft.videoUrl, { errorTitle: '视频预览失败' })} style={styles.videoPreviewButton}><Text style={styles.videoPreviewText}>预览</Text></Pressable>
                            ) : null}
                          </View>
                          <TextInput
                            value={draft.videoUrl}
                            editable={canEditSet && !uploadingVideo}
                            onChangeText={(value) => setDraft(action.actionIndex, set.setIndex, { videoUrl: value, videoId: undefined })}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                            placeholder="也可以粘贴公开视频链接"
                            placeholderTextColor={colors.textMuted}
                            style={styles.videoUrlInput}
                          />
                          <Text style={styles.setHelper}>本地视频限 50MB；完成或保存本组时会确认关联到这组记录。</Text>
                        </>
                      )}
                      {completed && canEditSet ? <Text style={styles.editCompletedHint}>修改已完成组后，请点“保存”同步到云端。</Text> : null}
                    </View>
                  ) : null}
                </View>
              )
            })}
            <Pressable accessibilityRole="button" accessibilityLabel={`为${action.actionName}新增一组`} accessibilityState={{ disabled: operationDisabled, busy: syncing }} disabled={operationDisabled} onPress={() => addSet(action.actionIndex, action)} style={[styles.addButton, operationDisabled && styles.finishDisabled]}>
              <Text style={styles.addButtonText}>新增一组</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`删除额外动作${action.actionName}`} accessibilityState={{ disabled: operationDisabled, busy: syncing }} disabled={operationDisabled} onPress={() => deleteExercise(action.actionIndex)} style={[styles.deleteButton, operationDisabled && styles.finishDisabled]}>
              <Text style={styles.deleteButtonText}>删除额外动作</Text>
            </Pressable>
          </SectionCard>
        )
      })}

      <Pressable accessibilityRole="button" accessibilityLabel="添加训练动作" accessibilityState={{ disabled: operationDisabled, busy: syncing }} disabled={operationDisabled} onPress={openActionPicker} style={[styles.addExerciseButton, operationDisabled && styles.finishDisabled]}>
        <Text style={styles.addExerciseButtonText}>添加动作</Text>
      </Pressable>

      <Pressable accessibilityRole="button" accessibilityLabel={readOnly ? '只读查看' : isCompleted ? '训练已完成' : '完成训练'} accessibilityState={{ disabled: operationDisabled, busy: syncing }} disabled={operationDisabled} onPress={finish} style={[styles.finishButton, operationDisabled && styles.finishDisabled]}>
        <Text style={styles.finishButtonText}>{readOnly ? '只读查看' : isCompleted ? '训练已完成' : '完成训练'}</Text>
      </Pressable>

      {isCompleted ? (
        <SectionCard title="训练反馈" description="难度与文字反馈会同步给教练，并用于后续计划调整。">
          {feedbackSubmitted || execution.app_feedback_submitted ? (
            <View style={styles.feedbackSuccess}>
              <IconFont name="icon-send" color="#087A63" size={18} />
              <Text style={styles.feedbackSuccessText}>反馈已发送给教练</Text>
            </View>
          ) : (
            <>
              <Text style={styles.feedbackLabel}>本次训练难度</Text>
              <View style={styles.difficultyRow}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`训练难度 ${value}，${['', '很轻松', '偏轻松', '刚刚好', '有挑战', '非常吃力'][value]}`} accessibilityState={{ selected: feedbackDifficulty === value }} onPress={() => setFeedbackDifficulty(value)} style={[styles.difficultyChip, feedbackDifficulty === value && styles.difficultyChipActive]}>
                    <Text style={[styles.difficultyText, feedbackDifficulty === value && styles.difficultyTextActive]}>{value}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.difficultyHint}>{['', '很轻松', '偏轻松', '刚刚好', '有挑战', '非常吃力'][feedbackDifficulty]}</Text>
              <TextInput
                value={feedbackContent}
                onChangeText={setFeedbackContent}
                maxLength={500}
                multiline
                placeholder="例如：深蹲最后两组比较吃力，左膝略有不适…"
                placeholderTextColor={colors.textMuted}
                style={styles.feedbackInput}
              />
              <Text style={styles.feedbackCount}>{feedbackContent.length}/500</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="发送训练反馈给教练" accessibilityState={{ disabled: feedbackSubmitting || !feedbackContent.trim(), busy: feedbackSubmitting }} disabled={feedbackSubmitting || !feedbackContent.trim()} onPress={submitTrainingFeedback} style={[styles.feedbackButton, (feedbackSubmitting || !feedbackContent.trim()) && styles.finishDisabled]}>
                {feedbackSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.feedbackButtonText}>发送给教练</Text>}
              </Pressable>
            </>
          )}
        </SectionCard>
      ) : null}

      {isCompleted ? (
        <SectionCard title="训练打卡图" description="生成本次训练的分享卡片，保留小程序分享页的训练容量、组数、PR 统计。">
          <Pressable accessibilityRole="button" accessibilityLabel="分享本次训练" onPress={() => navigation.navigate('TrainingShare', { executionId: execution?.id })} style={styles.shareButton}>
            <IconFont name="icon-share" color={colors.brand} size={18} />
            <Text style={styles.shareButtonText}>分享本次训练</Text>
          </Pressable>
        </SectionCard>
      ) : null}

      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>添加动作</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="关闭动作选择" onPress={() => setPickerVisible(false)} style={styles.modalCloseButton}><Text style={styles.modalClose}>关闭</Text></Pressable>
            </View>
            <View style={styles.pickerSearch}>
              <TextInput accessibilityLabel="搜索要添加的动作" value={pickerQuery} onChangeText={setPickerQuery} placeholder="搜索动作" placeholderTextColor={colors.textMuted} style={styles.pickerInput} returnKeyType="search" onSubmitEditing={() => loadPickerActions()} />
              <Pressable accessibilityRole="button" accessibilityLabel="搜索要添加的动作" accessibilityState={{ disabled: pickerLoading, busy: pickerLoading }} disabled={pickerLoading} onPress={() => loadPickerActions()} style={[styles.pickerSearchButton, pickerLoading && styles.finishDisabled]}><Text style={styles.pickerSearchText}>搜索</Text></Pressable>
            </View>
            {pickerLoading ? <ActivityIndicator color={colors.brand} /> : null}
            <ScrollView style={styles.pickerList}>
              {pickerActions.map((row) => (
                <Pressable key={`${row.source}-${row.id || row.name}`} accessibilityRole="button" accessibilityLabel={`添加动作${row.name}`} accessibilityHint={row.source === 'mine' ? '来自我的动作库' : '来自公共动作库'} onPress={() => addExercise(row)} style={styles.pickerRow}>
                  <View style={styles.pickerRowMain}>
                    <Text style={styles.pickerName}>{row.name}</Text>
                    <Text style={styles.pickerMeta}>{row.source === 'mine' ? '我的动作' : '公共动作'}{row.type ? ` · ${row.type}` : ''}</Text>
                  </View>
                  <IconFont name="icon-right-arrow" color={colors.textMuted} size={16} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={restRemaining > 0 && !restTimerMinimized} transparent animationType="fade" onRequestClose={() => setRestTimerMinimized(true)}>
        <Pressable accessibilityRole="button" accessibilityLabel="最小化休息计时" style={styles.restBackdrop} onPress={() => setRestTimerMinimized(true)}>
          <Pressable accessible={false} style={styles.restPanel} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.restEmoji}>休</Text>
            <Text style={styles.restTime}>{formatRestTime(restRemaining)}</Text>
            <Text style={styles.restLabel}>组间休息</Text>
            <View style={styles.restActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="休息时间减少 10 秒" onPress={() => adjustRestTimer(-10)} style={styles.restAction}><Text style={styles.restActionText}>-10 秒</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="休息时间增加 10 秒" onPress={() => adjustRestTimer(10)} style={styles.restAction}><Text style={styles.restActionText}>+10 秒</Text></Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="跳过休息" onPress={skipRestTimer} style={styles.restPrimary}><Text style={styles.restPrimaryText}>跳过休息</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="最小化休息计时" onPress={() => setRestTimerMinimized(true)} style={styles.restMinimize}><Text style={styles.restMinimizeText}>最小化</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Page>
  )
}

const styles = StyleSheet.create({
  hero: { minHeight: 132, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.xl, padding: spacing.md, backgroundColor: '#1F1F1F' },
  heroLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 13, fontWeight: '700' },
  heroTitle: { marginTop: spacing.xs, color: '#FFFFFF', fontSize: 36, fontWeight: '900' },
  heroSub: { color: 'rgba(255,255,255,0.72)', fontSize: 13 },
  heroIcon: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  readOnlyBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: '#EBC0B3' },
  readOnlyMain: { flex: 1, gap: 4 },
  readOnlyTitle: { color: colors.brand, fontSize: 14, fontWeight: '900' },
  readOnlyText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  restBubble: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: spacing.sm, borderRadius: radius.lg, backgroundColor: '#1F1F1F' },
  restBubbleLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 13, fontWeight: '700' },
  restBubbleValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  setRow: { gap: spacing.xs, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  setCompleted: { borderRadius: radius.md, paddingHorizontal: spacing.xs, backgroundColor: '#F8F8F8' },
  setHead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  setTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  setTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  prTag: { overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 3, color: '#9A3412', backgroundColor: '#FFEDD5', fontSize: 10, fontWeight: '900' },
  autoPrTag: { overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 3, color: '#087A63', backgroundColor: '#E9F8F3', fontSize: 10, fontWeight: '900' },
  videoTag: { overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 3, color: '#2563EB', backgroundColor: '#EFF6FF', fontSize: 10, fontWeight: '900' },
  noteTag: { overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 3, color: colors.textSecondary, backgroundColor: colors.surfaceMuted, fontSize: 10, fontWeight: '900' },
  setPlan: { color: colors.textSecondary, fontSize: 12 },
  deleteSetButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: colors.danger, fontSize: 12, fontWeight: '800' },
  disabledText: { color: colors.textMuted },
  inputs: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  input: { flex: 1, minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.xs, color: colors.text, backgroundColor: colors.surfaceMuted, fontSize: 14 },
  doneButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.brand },
  doneButtonDisabled: { backgroundColor: colors.textMuted },
  doneButtonText: { color: '#FFFFFF', fontWeight: '900' },
  setMoreButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.brandSoft },
  setMoreText: { color: colors.brand, fontSize: 12, fontWeight: '900' },
  setMorePanel: { gap: spacing.xs, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  setNotesInput: { minHeight: 80, borderRadius: radius.md, padding: spacing.sm, color: colors.text, backgroundColor: colors.surfaceMuted, fontSize: 13, lineHeight: 20 },
  setNotesCount: { alignSelf: 'flex-end', color: colors.textMuted, fontSize: 11 },
  prToggle: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: '#EBC0B3' },
  prToggleActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  prToggleMain: { flex: 1, gap: 3 },
  prToggleTitle: { color: colors.brand, fontSize: 13, fontWeight: '900' },
  prToggleTitleActive: { color: '#FFFFFF' },
  prToggleHint: { color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
  prToggleHintActive: { color: 'rgba(255,255,255,0.82)' },
  videoActionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  videoActionButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.brandSoft },
  videoActionText: { color: colors.brand, fontSize: 12, fontWeight: '900' },
  videoPreviewButton: { minHeight: 48, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.md, backgroundColor: colors.surfaceMuted },
  videoPreviewText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  videoUrlInput: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.sm, color: colors.text, backgroundColor: colors.surfaceMuted, fontSize: 12 },
  setHelper: { color: colors.textMuted, fontSize: 11, lineHeight: 17 },
  editCompletedHint: { borderRadius: radius.md, padding: spacing.xs, color: colors.brandDark, backgroundColor: colors.brandSoft, fontSize: 11, lineHeight: 17 },
  itemInputRow: { flexDirection: 'row', gap: spacing.xs },
  itemInput: { flex: 1, minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.sm, color: colors.text, backgroundColor: colors.surfaceMuted, fontSize: 14 },
  itemTextarea: { minHeight: 88, borderRadius: radius.md, padding: spacing.sm, color: colors.text, backgroundColor: colors.surfaceMuted, fontSize: 14, textAlignVertical: 'top' },
  itemDoneButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.brand },
  addButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.surface },
  addButtonText: { color: colors.brand, fontWeight: '900' },
  deleteButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  deleteButtonText: { color: colors.danger, fontWeight: '800' },
  addExerciseButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.surface },
  addExerciseButtonText: { color: colors.brand, fontSize: 15, fontWeight: '900' },
  finishButton: { minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand },
  finishDisabled: { opacity: 0.5 },
  finishButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  feedbackSuccess: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.lg, backgroundColor: '#E9F8F3' },
  feedbackSuccessText: { color: '#087A63', fontSize: 14, fontWeight: '900' },
  feedbackLabel: { color: colors.text, fontSize: 14, fontWeight: '800' },
  difficultyRow: { flexDirection: 'row', gap: spacing.xs },
  difficultyChip: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  difficultyChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  difficultyText: { color: colors.textSecondary, fontSize: 15, fontWeight: '900' },
  difficultyTextActive: { color: '#FFFFFF' },
  difficultyHint: { color: colors.brand, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  feedbackInput: { minHeight: 104, padding: spacing.sm, borderRadius: radius.lg, color: colors.text, backgroundColor: colors.surfaceMuted, fontSize: 14, lineHeight: 20, textAlignVertical: 'top' },
  feedbackCount: { color: colors.textMuted, fontSize: 11, textAlign: 'right' },
  feedbackButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.brand },
  feedbackButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  shareButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.pill, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border },
  shareButtonText: { color: colors.brand, fontSize: 15, fontWeight: '900' },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.36)' },
  modalPanel: { maxHeight: '82%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.sm, gap: spacing.sm, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  modalCloseButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  modalClose: { color: colors.brand, fontSize: 14, fontWeight: '900' },
  pickerSearch: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.lg, paddingHorizontal: spacing.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pickerInput: { flex: 1, color: colors.text, fontSize: 15 },
  pickerSearchButton: { minHeight: 48, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.sm, backgroundColor: colors.brand },
  pickerSearchText: { color: '#FFFFFF', fontWeight: '800' },
  pickerList: { maxHeight: 440 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerRowMain: { flex: 1, gap: 4 },
  pickerName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  pickerMeta: { color: colors.textSecondary, fontSize: 12 },
  restBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: 'rgba(0,0,0,0.52)' },
  restPanel: { width: '100%', maxWidth: 360, alignItems: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface },
  restEmoji: { width: 56, height: 56, textAlign: 'center', textAlignVertical: 'center', borderRadius: radius.pill, color: colors.brand, backgroundColor: colors.brandSoft, fontSize: 24, fontWeight: '900', lineHeight: 56 },
  restTime: { color: colors.text, fontSize: 52, fontWeight: '900', fontVariant: ['tabular-nums'] },
  restLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  restActions: { flexDirection: 'row', gap: spacing.sm },
  restAction: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.lg, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  restActionText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  restPrimary: { width: '100%', minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.brand },
  restPrimaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  restMinimize: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md },
  restMinimizeText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
})
