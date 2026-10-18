import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, Input, Textarea, Image } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh, useRouter } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { studentActionLibService } from '@/services/studentActionLibService'
import {
  addPublicToMyLib,
  listPublicActions,
  publishMyAction,
  submitPublicActionEdit,
  togglePublicLike
} from '@/services/actionLibPageService'
import type { PublicActionItemDto } from '@/types/action'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'
import { resolveWeappMediaUrl } from '@/utils/mediaUrl'
import { impromptuService } from '@/services/impromptuService'
import { authService } from '@/services/authService'
import {
  findLatestInProgressImpromptuSnapshot,
  persistTrainingExecutionSnapshot,
  trainingExecutionSnapshotKey
} from '@/utils/trainingExecutionCache'
import { persistFrequentActionCache, readFrequentActionCache } from '@/utils/actionLibraryCache'

interface Action {
  id: string
  name: string
  detail?: string | null
  type?: string | null
  attrs?: string[] | null
  positions?: string[] | null
  reference_1rm?: number | null
  url?: string | null
  canonical_action_id?: string | null
  category?: string | null
  item_schema?: Record<string, unknown> | null
  suggested_time?: string | null
  reference_image_url?: string | null
  usage_count?: number
  last_used_at?: string | null
}

type TabKey = 'frequent' | 'mine' | 'public'
type LibraryMode = 'STRENGTH' | 'STREET' | 'CARDIO'
type PublicPresetKey = 'all' | 'beginner' | 'upper' | 'core' | 'bodyweight'

interface FilterOption {
  key: string
  label: string
  keywords: string[]
}

const MUSCLE_FILTERS: FilterOption[] = [
  { key: 'all', label: '全部', keywords: [] },
  { key: 'chest', label: '胸', keywords: ['胸', '胸部', '上胸', '下胸', '卧推', '推胸'] },
  { key: 'back', label: '背', keywords: ['背', '背部', '引体', '划船', '下拉'] },
  { key: 'legs', label: '腿', keywords: ['腿', '腿部', '股四头', '腘绳', '深蹲', '硬拉'] },
  { key: 'shoulder', label: '肩', keywords: ['肩', '肩部', '三角肌', '推举'] },
  { key: 'arms', label: '手臂', keywords: ['手臂', '二头', '三头', '肱二头', '肱三头', '弯举', '臂屈伸'] },
  { key: 'core', label: '核心', keywords: ['核心', '腹', '腹部', '腰腹', '平板'] },
  { key: 'glutes', label: '臀部', keywords: ['臀', '臀部', '髋'] },
  { key: 'functional', label: '功能性', keywords: ['功能', '稳定', '灵活', '爆发', '平衡'] }
]

const EQUIPMENT_FILTERS: FilterOption[] = [
  { key: 'all', label: '全部器械', keywords: [] },
  { key: 'barbell', label: '杠铃', keywords: ['杠铃'] },
  { key: 'dumbbell', label: '哑铃', keywords: ['哑铃'] },
  { key: 'bodyweight', label: '徒手', keywords: ['徒手', '自重', '俯卧撑', '引体'] },
  { key: 'machine', label: '器械', keywords: ['器械', '固定器械', '史密斯', '坐姿'] },
  { key: 'cable', label: '绳索', keywords: ['绳索', '龙门架', '滑轮'] }
]

const STREET_FILTERS: FilterOption[] = [
  { key: 'all', label: '全部', keywords: [] },
  { key: 'push', label: '推力', keywords: ['推力', '街头健身·推'] },
  { key: 'pull', label: '拉力', keywords: ['拉力', '街头健身·拉'] },
  { key: 'mixed', label: '综合', keywords: ['混合类动作', '街头健身·综合'] },
  { key: 'static', label: '静态', keywords: ['秒', '支撑', '倒立', '水平', '俄挺', '人旗'] },
  { key: 'dynamic', label: '动力', keywords: ['次数', '引体', '俯卧撑', '双力臂', '上压'] }
]

const CARDIO_FILTERS: FilterOption[] = [
  { key: 'all', label: '全部', keywords: [] },
  { key: 'run', label: '跑步', keywords: ['跑', '冲刺'] },
  { key: 'bike', label: '单车', keywords: ['单车', '骑行'] },
  { key: 'row', label: '划船', keywords: ['划船'] },
  { key: 'rope', label: '跳绳', keywords: ['跳绳'] },
  { key: 'swim', label: '游泳', keywords: ['游泳'] },
  { key: 'hiit', label: '间歇', keywords: ['hiit', '间歇', '波比', '战绳', '跳箱', '登山跑'] },
  { key: 'low', label: '低冲击', keywords: ['低冲击', '快走', '椭圆机'] }
]

const STREET_WORKOUT_COMMON_NAMES = new Set(['跪姿俯卧撑', '平板支撑', '击掌俯卧撑', '反手引体'])

const PUBLIC_PRESETS: Array<{ key: PublicPresetKey; label: string; search?: string }> = [
  { key: 'all', label: '全部' },
  { key: 'beginner', label: '新手推荐', search: '基础' },
  { key: 'upper', label: '胸肩手臂', search: '胸 肩 手臂' },
  { key: 'core', label: '腰背核心', search: '核心 背' },
  { key: 'bodyweight', label: '徒手可练', search: '徒手' }
]

const ACTION_TYPES = [
  { value: 'STRENGTH', label: '力量' },
  { value: 'CARDIO', label: '有氧' },
  { value: 'DIET', label: '饮食' },
  { value: 'HABIT', label: '习惯' }
]

const ACTION_POSITIONS = ['胸部', '背部', '肩部', '手臂', '核心', '腿部', '臀部', '全身']
const ACTION_ATTRS = ['力量', '耐力', '爆发力', '柔韧性', '平衡', '强度']

function formatShortDate(dateLike?: string | null) {
  if (!dateLike) return ''
  const date = new Date(dateLike)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function asList(value?: string[] | null) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function getSearchText(action: {
  name?: string | null
  detail?: string | null
  positions?: string[] | null
  attrs?: string[] | null
  type?: string | null
  category?: string | null
}) {
  return [
    action.name,
    action.detail,
    action.type,
    action.category,
    ...asList(action.positions),
    ...asList(action.attrs)
  ].filter(Boolean).join(' ').toLowerCase()
}

function isStreetWorkoutAction(action: Action | PublicActionItemDto) {
  const source = getSearchText(action)
  const canonicalId = String(action.canonical_action_id || '')
  return source.includes('街头健身') || canonicalId.startsWith('street_workout_') || STREET_WORKOUT_COMMON_NAMES.has(action.name)
}

function matchesLibraryMode(action: Action | PublicActionItemDto, mode: LibraryMode) {
  const type = String(action.type || 'STRENGTH').toUpperCase()
  if (mode === 'CARDIO') return type === 'CARDIO'
  if (type !== 'STRENGTH') return false
  return mode === 'STREET' ? isStreetWorkoutAction(action) : !isStreetWorkoutAction(action)
}

function matchesFilter(action: Action | PublicActionItemDto, filter: FilterOption) {
  if (filter.key === 'all') return true
  const source = getSearchText(action)
  return filter.keywords.some(keyword => source.includes(keyword.toLowerCase()))
}

function getActionInitial(name?: string | null) {
  return (name || '动').trim().slice(0, 1)
}

function getActionMeta(action: Action | PublicActionItemDto) {
  const positions = asList(action.positions).slice(0, 2)
  const attrs = asList(action.attrs).slice(0, 2)
  return [...positions, ...attrs].slice(0, 3)
}

function getPrimaryPosition(action: Action | PublicActionItemDto) {
  return asList(action.positions)[0] || '全身'
}

function normalizeText(value?: string | null) {
  const nextValue = value?.trim() || ''
  return nextValue || null
}

function normalizeList(value?: string[] | null) {
  if (!Array.isArray(value) || value.length === 0) return null
  return value
}

function cacheAndOpenActionDetail(action: {
  id: string
  name: string
  detail?: string | null
  positions?: string[] | null
  attrs?: string[] | null
  type?: string | null
  url?: string | null
  reference_image_url?: string | null
}) {
  if (!action?.id) {
    Taro.showToast({ title: '动作信息异常', icon: 'none' })
    return
  }
  Taro.setStorageSync(`action_detail_${action.id}`, {
    id: action.id,
    name: action.name,
    detail: action.detail,
    positions: action.positions,
    attrs: action.attrs,
    type: action.type,
    url: action.url,
    reference_image_url: action.reference_image_url ?? null
  })
  Taro.navigateTo({
    url: `/training/action-detail?id=${encodeURIComponent(action.id)}`
  })
}

export default function ActionLibPage() {
  const { effectiveTheme } = useTheme()
  const router = useRouter()
  const isPlanSelectionMode = router.params?.mode === 'plan-select'
  const isImpromptuSelectionMode = router.params?.mode === 'impromptu-select'
  const isSelectionMode = isPlanSelectionMode || isImpromptuSelectionMode
  const requestedMode = String(router.params?.itemType || '').toUpperCase() === 'CARDIO'
    ? 'CARDIO'
    : String(router.params?.itemType || '').toUpperCase() === 'STREET'
      ? 'STREET'
      : 'STRENGTH'
  const requestedTab = String(router.params?.source || router.params?.tab || '').toLowerCase()
  const initialTab: TabKey = isPlanSelectionMode
    ? 'public'
    : isImpromptuSelectionMode
      ? (requestedTab === 'mine' || requestedTab === 'public' || requestedTab === 'frequent'
          ? requestedTab
          : requestedMode === 'STRENGTH' ? 'frequent' : 'public')
      : requestedTab === 'public' ? 'public' : 'mine'
  const [libraryMode, setLibraryMode] = useState<LibraryMode>(requestedMode)
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [mySearchTerm, setMySearchTerm] = useState('')
  const [publishingActionId, setPublishingActionId] = useState<string | null>(null)
  const [frequentActions, setFrequentActions] = useState<Action[]>([])
  const [frequentLoading, setFrequentLoading] = useState(false)
  const [selectedActions, setSelectedActions] = useState<Action[]>([])
  const [startingImpromptu, setStartingImpromptu] = useState(false)
  const [checkingCurrentImpromptu, setCheckingCurrentImpromptu] = useState(isImpromptuSelectionMode)

  const [publicSearchTerm, setPublicSearchTerm] = useState('')
  const publicActionType = libraryMode === 'CARDIO' ? 'CARDIO' : 'STRENGTH'
  const mySearchTermRef = useRef('')
  const publicSearchTermRef = useRef('')
  const hasHandledInitialShowRef = useRef(false)
  mySearchTermRef.current = mySearchTerm
  publicSearchTermRef.current = publicSearchTerm
  const [publicActions, setPublicActions] = useState<PublicActionItemDto[]>([])
  const [publicLoading, setPublicLoading] = useState(false)
  const [addingPublicId, setAddingPublicId] = useState<string | null>(null)
  const [likingPublicId, setLikingPublicId] = useState<string | null>(null)
  const [selectedPublicPreset, setSelectedPublicPreset] = useState<PublicPresetKey>('all')
  const [publicOnlyWithDemo, setPublicOnlyWithDemo] = useState(false)

  const [selectedMuscle, setSelectedMuscle] = useState('all')
  const [selectedEquipment, setSelectedEquipment] = useState('all')

  const [showEditSuggestion, setShowEditSuggestion] = useState(false)
  const [editingPublicAction, setEditingPublicAction] = useState<PublicActionItemDto | null>(null)
  const [editName, setEditName] = useState('')
  const [editDetail, setEditDetail] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editType, setEditType] = useState('STRENGTH')
  const [editPositions, setEditPositions] = useState<string[]>([])
  const [editAttrs, setEditAttrs] = useState<string[]>([])
  const [submittingEdit, setSubmittingEdit] = useState(false)

  useEffect(() => {
    if (isPlanSelectionMode) {
      setActiveTab('public')
    } else if (isImpromptuSelectionMode) {
      setActiveTab(requestedTab === 'mine' || requestedTab === 'public' || requestedTab === 'frequent'
        ? requestedTab
        : requestedMode === 'STRENGTH' ? 'frequent' : 'public')
    } else if (router.params?.tab === 'public') {
      setActiveTab('public')
    }
  }, [isImpromptuSelectionMode, isPlanSelectionMode, requestedMode, requestedTab, router.params?.tab])

  const loadActions = useCallback(async (search = mySearchTermRef.current) => {
    try {
      setLoading(true)
      const res = await studentActionLibService.listActions({
        page: 1,
        limit: 500,
        search
      })
      setActions(res?.actions || [])
    } catch (error) {
      console.error('加载动作库失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPublicLibrary = useCallback(async (search = publicSearchTermRef.current) => {
    try {
      setPublicLoading(true)
      const res = await listPublicActions({
        page: 1,
        limit: 500,
        search: search || undefined,
        type: publicActionType,
        viewerActionType: 'student'
      })
      setPublicActions(res?.actions || [])
    } catch (error) {
      console.error('加载公共动作库失败:', error)
      Taro.showToast({ title: '公共动作库加载失败', icon: 'none' })
    } finally {
      setPublicLoading(false)
    }
  }, [publicActionType])

  const loadFrequentActions = useCallback(async () => {
    try {
      setFrequentLoading(true)
      const userId = authService.getCurrentUser()?.id || ''
      const cached = readFrequentActionCache(userId)
      if (cached) setFrequentActions(cached)
      const remote = await impromptuService.listFrequentActions()
      setFrequentActions(remote)
      persistFrequentActionCache(userId, remote)
    } catch (error) {
      console.error('加载常用动作失败:', error)
      setFrequentActions([])
    } finally {
      setFrequentLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isImpromptuSelectionMode) return
    let cancelled = false
    const user = authService.getCurrentUser()
    if (!user?.id) {
      Taro.redirectTo({
        url: `/auth/login?returnTo=${encodeURIComponent('/me/action-lib/index?mode=impromptu-select')}`
      })
      return
    }

    const resume = (execution: any) => {
      if (cancelled || !execution?.id) return false
      const scopeKey = trainingExecutionSnapshotKey({
        isImpromptuMode: true,
        impromptuId: execution.id,
        dayIndex: 1
      })
      persistTrainingExecutionSnapshot(user.id, scopeKey, {
        execution,
        planInstance: {
          id: 'impromptu',
          name: '即兴锻炼',
          description: '即兴训练模式',
          source: 'impromptu'
        }
      })
      Taro.redirectTo({
        url: `/training/training-execution?impromptuId=${encodeURIComponent(execution.id)}&dayIndex=1`
      })
      return true
    }

    const initialize = async () => {
      const localSnapshot = findLatestInProgressImpromptuSnapshot(user.id)
      if (localSnapshot?.execution && resume(localSnapshot.execution)) return
      try {
        const current = await impromptuService.getCurrent()
        if (current && resume(current)) return
      } finally {
        if (!cancelled) setCheckingCurrentImpromptu(false)
      }
    }
    void initialize()
    return () => {
      cancelled = true
    }
  }, [isImpromptuSelectionMode])

  useDidShow(() => {
    if (!hasHandledInitialShowRef.current) {
      hasHandledInitialShowRef.current = true
      return
    }
    if (activeTab === 'frequent') {
      loadFrequentActions()
    } else if (activeTab === 'public') {
      loadPublicLibrary()
    } else {
      loadActions()
    }
  })

  useEffect(() => {
    if (activeTab === 'frequent') {
      loadFrequentActions()
    } else if (activeTab === 'public') {
      loadPublicLibrary()
    } else {
      loadActions()
    }
  }, [activeTab, loadActions, loadFrequentActions, loadPublicLibrary])

  usePullDownRefresh(() => {
    const loader = activeTab === 'frequent'
      ? loadFrequentActions()
      : activeTab === 'public' ? loadPublicLibrary() : loadActions()
    loader.finally(() => Taro.stopPullDownRefresh())
  })

  const primaryFilters = useMemo(() => (
    libraryMode === 'STREET' ? STREET_FILTERS : libraryMode === 'CARDIO' ? CARDIO_FILTERS : MUSCLE_FILTERS
  ), [libraryMode])

  const activeMuscleFilter = useMemo(
    () => primaryFilters.find(item => item.key === selectedMuscle) || primaryFilters[0],
    [primaryFilters, selectedMuscle]
  )

  const activeEquipmentFilter = useMemo(
    () => EQUIPMENT_FILTERS.find(item => item.key === selectedEquipment) || EQUIPMENT_FILTERS[0],
    [selectedEquipment]
  )

  const displayedMineActions = useMemo(() => {
    return actions.filter(action =>
      matchesLibraryMode(action, libraryMode) &&
      matchesFilter(action, activeMuscleFilter) &&
      (libraryMode !== 'STRENGTH' || matchesFilter(action, activeEquipmentFilter))
    )
  }, [actions, activeEquipmentFilter, activeMuscleFilter, libraryMode])

  const displayedFrequentActions = useMemo(() => {
    const search = mySearchTerm.trim().toLowerCase()
    return frequentActions.filter(action =>
      matchesLibraryMode(action, libraryMode) &&
      (!search || getSearchText(action).includes(search)) &&
      matchesFilter(action, activeMuscleFilter) &&
      (libraryMode !== 'STRENGTH' || matchesFilter(action, activeEquipmentFilter))
    )
  }, [activeEquipmentFilter, activeMuscleFilter, frequentActions, libraryMode, mySearchTerm])

  const displayedPublicActions = useMemo(() => {
    return publicActions.filter(action =>
      matchesLibraryMode(action, libraryMode) &&
      (!publicOnlyWithDemo || !!action.url?.trim()) &&
      matchesFilter(action, activeMuscleFilter) &&
      (libraryMode !== 'STRENGTH' || matchesFilter(action, activeEquipmentFilter))
    )
  }, [activeEquipmentFilter, activeMuscleFilter, libraryMode, publicActions, publicOnlyWithDemo])

  const handleSelectSystemLibrary = (type: LibraryMode) => {
    if (libraryMode === type) return
    setLibraryMode(type)
    if (activeTab === 'frequent' && !frequentActions.some(action => matchesLibraryMode(action, type))) {
      setActiveTab('public')
    }
    setPublicSearchTerm('')
    setMySearchTerm('')
    setSelectedPublicPreset('all')
    setPublicOnlyWithDemo(false)
    setSelectedMuscle('all')
    setSelectedEquipment('all')
  }

  const handleCreate = () => {
    Taro.navigateTo({ url: '/me/action-lib/edit/index' })
  }

  const handleOpenCoachLibrary = () => {
    Taro.navigateTo({ url: '/training/copy-from-coach' })
  }

  const handleEdit = (id: string) => {
    Taro.navigateTo({ url: `/me/action-lib/edit/index?id=${id}` })
  }

  const handleDelete = async (id: string) => {
    const res = await Taro.showModal({
      title: '删除确认',
      content: '确定要删除这个动作吗？'
    })
    if (!res.confirm) return

    try {
      await studentActionLibService.deleteAction({ id })
      Taro.showToast({ title: '删除成功', icon: 'success' })
      loadActions()
    } catch (error) {
      Taro.showToast({ title: '删除失败', icon: 'none' })
    }
  }

  const handleViewReferences = async (action: Action) => {
    try {
      const res = await studentActionLibService.getActionReferences(action.id)
      if (res?.references && res.references.length > 0) {
        const list = res.references.map(r => `· ${r.planName} - 第${r.dayIndex}天`).join('\n')
        Taro.showModal({
          title: `${action.name} 被引用`,
          content: list,
          showCancel: false
        })
      } else {
        Taro.showToast({ title: '暂无计划引用', icon: 'none' })
      }
    } catch (error) {
      Taro.showToast({ title: '查询失败', icon: 'none' })
    }
  }

  const handlePublishAction = async (action: Action) => {
    if (!action.url?.trim()) {
      const modal = await Taro.showModal({
        title: '贡献前先补演示',
        content: '公共动作库至少需要演示视频。现在去编辑这个动作吗？',
        confirmText: '去完善',
        cancelText: '稍后'
      })
      if (modal.confirm) handleEdit(action.id)
      return
    }

    const modal = await Taro.showModal({
      title: '贡献到公共动作库',
      content: '贡献后，其他用户可以浏览、点赞、加入，并提交纠错建议。确认继续吗？',
      confirmText: '确认贡献',
      cancelText: '再检查下'
    })
    if (!modal.confirm) return

    try {
      setPublishingActionId(action.id)
      await publishMyAction(action.id, 'student')
      Taro.showToast({ title: '已贡献', icon: 'success' })
      loadPublicLibrary(publicSearchTerm.trim())
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '贡献失败', icon: 'none' })
    } finally {
      setPublishingActionId(null)
    }
  }

  const handleSubmitSearch = () => {
    if (activeTab === 'public') {
      setSelectedPublicPreset('all')
      loadPublicLibrary(publicSearchTerm.trim())
    } else if (activeTab === 'mine') {
      loadActions(mySearchTerm.trim())
    }
  }

  const handleClearSearch = () => {
    if (activeTab === 'public') {
      setPublicSearchTerm('')
      setSelectedPublicPreset('all')
      loadPublicLibrary('')
    } else if (activeTab === 'mine') {
      setMySearchTerm('')
      loadActions('')
    } else {
      setMySearchTerm('')
    }
  }

  const handleSelectPublicPreset = async (preset: PublicPresetKey) => {
    setSelectedPublicPreset(preset)
    const option = PUBLIC_PRESETS.find(item => item.key === preset)
    const nextSearch = option?.search || ''
    setPublicSearchTerm(nextSearch)
    await loadPublicLibrary(nextSearch)
  }

  const handlePublicAdd = async (actionId: string) => {
    try {
      setAddingPublicId(actionId)
      await addPublicToMyLib(actionId)
      setPublicActions(prev => prev.map(item => item.id === actionId ? { ...item, isAdded: true } : item))
      Taro.showToast({ title: '已加入动作库', icon: 'success' })
      loadActions()
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '加入失败', icon: 'none' })
    } finally {
      setAddingPublicId(null)
    }
  }

  const findMyActionForPublic = async (action: PublicActionItemDto) => {
    const response = await studentActionLibService.listActions({
      page: 1,
      limit: 1000,
      search: action.name || ''
    })
    const candidates = response?.actions || []
    return candidates.find((item) => (
      (action.canonical_action_id && item.canonical_action_id === action.canonical_action_id) ||
      item.name.trim() === action.name.trim()
    )) || null
  }

  const handleSelectPublicAction = async (action: PublicActionItemDto) => {
    if (!isSelectionMode || addingPublicId) return

    try {
      setAddingPublicId(action.id)
      let selectedAction = action.isAdded ? await findMyActionForPublic(action) : null
      if (!selectedAction) {
        try {
          selectedAction = await addPublicToMyLib(action.id)
        } catch (error) {
          selectedAction = await findMyActionForPublic(action)
          if (!selectedAction) throw error
        }
      }

      const normalizedAction: Action = {
        id: selectedAction.id,
        name: selectedAction.name,
        type: selectedAction.type || action.type || 'STRENGTH',
        detail: selectedAction.detail || action.detail || null,
        positions: selectedAction.positions || action.positions || null,
        attrs: selectedAction.attrs || action.attrs || null,
        category: selectedAction.category || action.category || null,
        item_schema: selectedAction.item_schema || (action.item_schema as Record<string, unknown> | null) || null,
        suggested_time: selectedAction.suggested_time || action.suggested_time || null,
        canonical_action_id: selectedAction.canonical_action_id || action.canonical_action_id || null,
        reference_image_url: selectedAction.reference_image_url || action.reference_image_url || null
      }
      setPublicActions((current) => current.map((item) => item.id === action.id ? { ...item, isAdded: true } : item))
      if (isPlanSelectionMode) {
        const eventChannel = (Taro.getCurrentInstance().page as any)?.getOpenerEventChannel?.()
        if (!eventChannel) throw new Error('无法返回上一页，请重新进入动作库')
        eventChannel.emit('selectPlanAction', {
          ...normalizedAction,
          enableAutoWeightCompute: selectedAction.enableAutoWeightCompute ?? action.enableAutoWeightCompute ?? null,
          includesBodyWeight: selectedAction.includesBodyWeight ?? action.includesBodyWeight ?? null
        })
        await Taro.navigateBack()
      } else {
        setSelectedActions((current) => {
          const exists = current.some((item) => item.id === normalizedAction.id)
          return exists ? current.filter((item) => item.id !== normalizedAction.id) : [...current, normalizedAction]
        })
      }
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '选择动作失败', icon: 'none' })
    } finally {
      setAddingPublicId(null)
    }
  }

  const toggleOwnedSelection = (action: Action) => {
    if (!isImpromptuSelectionMode) return
    setSelectedActions((current) => {
      const exists = current.some((item) => item.id === action.id)
      return exists ? current.filter((item) => item.id !== action.id) : [...current, action]
    })
  }

  const isSelectedAction = (action: Action | PublicActionItemDto) => selectedActions.some((item) => (
    item.id === action.id ||
    (!!item.canonical_action_id && item.canonical_action_id === action.canonical_action_id) ||
    item.name.trim() === action.name.trim()
  ))

  const handleStartImpromptu = async () => {
    if (startingImpromptu || selectedActions.length === 0) return
    const user = authService.getCurrentUser()
    if (!user?.id) {
      Taro.navigateTo({ url: '/auth/login' })
      return
    }

    try {
      setStartingImpromptu(true)
      const data = await impromptuService.start(selectedActions.map((action) => ({
        actionId: action.id,
        actionName: action.name,
        itemType: String(action.type || 'STRENGTH').toUpperCase() === 'CARDIO' ? 'CARDIO' : 'STRENGTH',
        attrs: action.attrs || null,
        category: action.category || null,
        itemSchema: action.item_schema || null,
        suggestedTime: action.suggested_time || null,
        sets: 1,
        reps: null,
        weight: null,
        restSeconds: 90
      })))
      if (!data?.id) throw new Error('创建即兴训练失败')

      const scopeKey = trainingExecutionSnapshotKey({
        isImpromptuMode: true,
        impromptuId: data.id,
        dayIndex: 1
      })
      const actionMap = selectedActions.reduce<Record<string, any>>((acc, action) => {
        acc[action.id] = {
          ...action,
          type: String(action.type || 'STRENGTH').toUpperCase() === 'CARDIO' ? 'CARDIO' : 'STRENGTH'
        }
        return acc
      }, {})
      persistTrainingExecutionSnapshot(user.id, scopeKey, {
        execution: data,
        planInstance: {
          id: 'impromptu',
          name: '即兴锻炼',
          description: '即兴训练模式',
          source: 'impromptu'
        },
        actions: actionMap
      })
      await Taro.redirectTo({
        url: `/training/training-execution?impromptuId=${encodeURIComponent(data.id)}&dayIndex=1`
      })
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '开始失败，请稍后再试', icon: 'none' })
    } finally {
      setStartingImpromptu(false)
    }
  }

  const handlePublicLike = async (actionId: string) => {
    try {
      setLikingPublicId(actionId)
      const res = await togglePublicLike(actionId)
      setPublicActions(prev => prev.map(item =>
        item.id === actionId
          ? { ...item, isLiked: res.liked, like_count: res.likeCount }
          : item
      ))
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '点赞失败', icon: 'none' })
    } finally {
      setLikingPublicId(null)
    }
  }

  const openEditSuggestion = (action: PublicActionItemDto) => {
    setEditingPublicAction(action)
    setEditName(action.name || '')
    setEditDetail(action.detail || '')
    setEditUrl(action.url || '')
    setEditType(action.type || 'STRENGTH')
    setEditPositions(asList(action.positions))
    setEditAttrs(asList(action.attrs))
    setShowEditSuggestion(true)
  }

  const closeEditSuggestion = () => {
    setShowEditSuggestion(false)
    setEditingPublicAction(null)
    setSubmittingEdit(false)
  }

  const toggleEditPosition = (position: string) => {
    setEditPositions(prev => prev.includes(position) ? prev.filter(item => item !== position) : [...prev, position])
  }

  const toggleEditAttr = (attr: string) => {
    setEditAttrs(prev => prev.includes(attr) ? prev.filter(item => item !== attr) : [...prev, attr])
  }

  const handleSubmitEditSuggestion = async () => {
    if (!editingPublicAction) return

    if (!editName.trim()) {
      Taro.showToast({ title: '请输入动作名称', icon: 'none' })
      return
    }

    try {
      setSubmittingEdit(true)
      await submitPublicActionEdit({
        actionId: editingPublicAction.id,
        name: editName.trim(),
        detail: normalizeText(editDetail),
        url: normalizeText(editUrl),
        positions: normalizeList(editPositions),
        attrs: normalizeList(editAttrs),
        type: editType || null,
        item_schema: (editingPublicAction.item_schema as Record<string, unknown> | null) ?? null,
        suggested_time: editingPublicAction.suggested_time ?? null,
        enableAutoWeightCompute: editingPublicAction.enableAutoWeightCompute ?? false,
        includesBodyWeight: editingPublicAction.includesBodyWeight ?? false,
        canonical_action_id: editingPublicAction.canonical_action_id ?? null
      })
      Taro.showToast({ title: '公共动作已更新', icon: 'success' })
      closeEditSuggestion()
      void loadPublicLibrary()
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '提交失败', icon: 'none' })
      setSubmittingEdit(false)
    }
  }

  const renderFilterRail = () => (
    <View className='filter-rail'>
      {primaryFilters.map(item => (
        <View
          key={item.key}
          className={`rail-item ${selectedMuscle === item.key ? 'active' : ''}`}
          onClick={() => setSelectedMuscle(item.key)}
        >
          <Text>{item.label}</Text>
        </View>
      ))}
    </View>
  )

  const renderEquipmentChips = () => (
    <ScrollView scrollX className='equipment-scroll' showScrollbar={false}>
      <View className='equipment-list'>
        {EQUIPMENT_FILTERS.map(item => (
          <View
            key={item.key}
            className={`equipment-chip ${selectedEquipment === item.key ? 'active' : ''}`}
            onClick={() => setSelectedEquipment(item.key)}
          >
            <Text>{item.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )

  const renderMineList = () => {
    const list = activeTab === 'frequent' ? displayedFrequentActions : displayedMineActions
    const listLoading = activeTab === 'frequent' ? frequentLoading : loading
    if (listLoading) {
      return (
        <View className='loading-container'>
          {[1, 2, 3, 4].map(i => <View key={i} className='skeleton-card' />)}
        </View>
      )
    }

    if (list.length === 0) {
      return (
        <View className='empty-state'>
          <Text className='empty-title'>{activeTab === 'frequent' ? '还没有常用动作' : '没有匹配动作'}</Text>
          <Text className='empty-desc'>{activeTab === 'frequent' ? '常用来自个人动作和训练记录；点上方「公共动作」查看完整动作库' : '换个分类、器械或关键词试试'}</Text>
        </View>
      )
    }

    return (
      <View className='mine-list'>
        {list.map(action => {
          const isPublishing = publishingActionId === action.id
          const selected = isSelectedAction(action)
          const meta = getActionMeta(action)
          const referenceImageUrl = resolveWeappMediaUrl(action.reference_image_url)
          return (
            <View key={action.id} className={`mine-card ${selected ? 'selected' : ''}`}>
              {referenceImageUrl ? (
                <View className='action-cover-wrap mine-cover' onClick={() => isImpromptuSelectionMode ? toggleOwnedSelection(action) : handleEdit(action.id)}>
                  <Image className='action-cover' src={referenceImageUrl} mode='aspectFill' />
                </View>
              ) : (
                <View className='action-avatar' onClick={() => isImpromptuSelectionMode ? toggleOwnedSelection(action) : handleEdit(action.id)}>
                  <Text>{getActionInitial(action.name)}</Text>
                </View>
              )}
              <View className='mine-main' onClick={() => isImpromptuSelectionMode ? toggleOwnedSelection(action) : handleEdit(action.id)}>
                <Text className='action-title'>{action.name}</Text>
                <Text className='action-subtitle'>
                  {getPrimaryPosition(action)} · {libraryMode === 'STREET' ? '街健' : libraryMode === 'CARDIO' ? '有氧' : '力量'}
                  {activeTab === 'frequent' && action.usage_count ? ` · 练过${action.usage_count}次` : ''}
                </Text>
                <View className='tag-row'>
                  {meta.map((item, index) => <Text key={`${item}-${index}`} className='tag'>{item}</Text>)}
                  {action.reference_1rm ? <Text className='tag strong'>1RM {action.reference_1rm}kg</Text> : null}
                </View>
              </View>
              {isImpromptuSelectionMode ? (
                <View className='mine-actions selection-actions'>
                  <Text className={`mini-action select ${selected ? 'selected' : ''}`} onClick={() => toggleOwnedSelection(action)}>
                    {selected ? '已选' : '选择'}
                  </Text>
                  <Text className='mini-action' onClick={() => cacheAndOpenActionDetail(action)}>要点</Text>
                </View>
              ) : (
                <View className='mine-actions'>
                  <Text className='mini-action' onClick={() => cacheAndOpenActionDetail(action)}>要点</Text>
                  <Text className='mini-action' onClick={() => handleViewReferences(action)}>引用</Text>
                  <Text
                    className={`mini-action ${isPublishing ? 'disabled' : ''}`}
                    onClick={() => {
                      if (!isPublishing) void handlePublishAction(action)
                    }}
                  >
                    {isPublishing ? '贡献中' : '贡献'}
                  </Text>
                  <Text className='mini-action danger' onClick={() => handleDelete(action.id)}>删</Text>
                </View>
              )}
            </View>
          )
        })}
      </View>
    )
  }

  const renderPublicList = () => {
    if (publicLoading) {
      return (
        <View className='card-grid'>
          {[1, 2, 3, 4].map(i => <View key={i} className='public-card skeleton-card' />)}
        </View>
      )
    }

    if (displayedPublicActions.length === 0) {
      const streetReviewPending = libraryMode === 'STREET' && !publicSearchTerm &&
        !publicActions.some(action => isStreetWorkoutAction(action))
      return (
        <View className='empty-state'>
          <Text className='empty-title'>{streetReviewPending ? '街健动作正在核验' : '没有匹配动作'}</Text>
          <Text className='empty-desc'>{streetReviewPending ? '示范图片正在核验，确认动作准确后会逐步恢复' : '换个肌群、器械或关键词试试'}</Text>
        </View>
      )
    }

    return (
      <View className='card-grid'>
        {displayedPublicActions.map(action => {
          const isAdding = addingPublicId === action.id
          const isLiking = likingPublicId === action.id
          const selected = isSelectedAction(action)
          const meta = getActionMeta(action)
          const referenceImageUrl = resolveWeappMediaUrl(action.reference_image_url)
          return (
            <View key={action.id} className={`public-card ${selected ? 'selected' : ''}`}>
              <View className='card-marker'><Text>{action.url ? '演示' : '要点'}</Text></View>
              <View className='card-count'><Text>{action.like_count || 0}赞</Text></View>
              <View className='action-cover-wrap' onClick={() => isSelectionMode ? void handleSelectPublicAction(action) : cacheAndOpenActionDetail(action)}>
                {referenceImageUrl ? (
                  <Image className='action-cover' src={referenceImageUrl} mode='aspectFill' />
                ) : (
                  <View className='action-avatar large'>
                    <Text>{getActionInitial(action.name)}</Text>
                  </View>
                )}
              </View>
              <Text className='card-title' onClick={() => isSelectionMode ? void handleSelectPublicAction(action) : cacheAndOpenActionDetail(action)}>{action.name || '未命名动作'}</Text>
              <Text className='card-subtitle'>{getPrimaryPosition(action)}</Text>
              <View className='tag-row compact'>
                {meta.slice(0, 2).map((item, index) => <Text key={`${item}-${index}`} className='tag'>{item}</Text>)}
              </View>
              <View className='card-actions'>
                <Text className='card-link' onClick={() => cacheAndOpenActionDetail(action)}>动作要点</Text>
                <Text
                  className={`card-link ${isLiking ? 'disabled' : ''}`}
                  onClick={() => {
                    if (!isLiking) void handlePublicLike(action.id)
                  }}
                >
                  {action.isLiked ? '已赞' : '点赞'}
                </Text>
              </View>
              {isSelectionMode ? (
                <View className='card-actions bottom'>
                  <Text
                    className={`card-primary ${isAdding ? 'disabled' : ''}`}
                    onClick={() => {
                      if (!isAdding) void handleSelectPublicAction(action)
                    }}
                  >
                    {isAdding ? '选择中' : selected ? '已选择' : isImpromptuSelectionMode ? '加入并选择' : '选择此动作'}
                  </Text>
                </View>
              ) : (
                <View className='card-actions bottom'>
                  <Text className='card-link subtle' onClick={() => openEditSuggestion(action)}>纠错</Text>
                  <Text
                    className={`card-primary ${(action.isAdded || isAdding) ? 'disabled' : ''}`}
                    onClick={() => {
                      if (!action.isAdded && !isAdding) void handlePublicAdd(action.id)
                    }}
                  >
                    {action.isAdded ? '已加入' : isAdding ? '加入中' : '加入'}
                  </Text>
                </View>
              )}
            </View>
          )
        })}
      </View>
    )
  }

  return (
    <View className={`action-lib-page theme-${effectiveTheme} ${isSelectionMode ? 'selection-mode' : ''}`}>
      <View className='top-bar'>
        <View className='close-btn' onClick={() => Taro.navigateBack().catch(() => Taro.reLaunch({ url: '/pages/index/index' }))}>
          <Text>×</Text>
        </View>
        <View className='search-pill'>
          <Text className='search-icon'>⌕</Text>
          <Input
            className='search-input'
            placeholder='输入动作名字搜索'
            value={activeTab === 'public' ? publicSearchTerm : mySearchTerm}
            onInput={(e) => {
              const nextValue = e.detail.value
              if (activeTab === 'public') setPublicSearchTerm(nextValue)
              else setMySearchTerm(nextValue)
            }}
            confirmType='search'
            onConfirm={handleSubmitSearch}
          />
          {(activeTab === 'public' ? publicSearchTerm : mySearchTerm) ? (
            <View className='clear-search' onClick={handleClearSearch}><Text>×</Text></View>
          ) : null}
        </View>
        {!isSelectionMode ? (
          <View className='top-add' onClick={handleCreate}>
            <Text>+</Text>
          </View>
        ) : null}
      </View>

      <View className='mode-row library-mode-row'>
        <View
          className={`mode-chip ${libraryMode === 'STRENGTH' ? 'active' : ''}`}
          onClick={() => handleSelectSystemLibrary('STRENGTH')}
        >
          <Text>力量</Text>
        </View>
        <View
          className={`mode-chip ${libraryMode === 'STREET' ? 'active' : ''}`}
          onClick={() => handleSelectSystemLibrary('STREET')}
        >
          <Text>街健</Text>
        </View>
        <View
          className={`mode-chip ${libraryMode === 'CARDIO' ? 'active' : ''}`}
          onClick={() => handleSelectSystemLibrary('CARDIO')}
        >
          <Text>有氧</Text>
        </View>
        {isImpromptuSelectionMode ? <Text className='mode-purpose'>多选后快速开练</Text> : null}
      </View>

      {!isPlanSelectionMode ? (
        <View className='mode-row source-row'>
          {isImpromptuSelectionMode ? (
            <View className={`mode-chip ${activeTab === 'frequent' ? 'active' : ''}`} onClick={() => setActiveTab('frequent')}>
              <Text>常用</Text>
            </View>
          ) : null}
          <View className={`mode-chip ${activeTab === 'mine' ? 'active' : ''}`} onClick={() => setActiveTab('mine')}>
            <Text>我的动作</Text>
          </View>
          <View className={`mode-chip ${activeTab === 'public' ? 'active' : ''}`} onClick={() => setActiveTab('public')}>
            <Text>公共动作</Text>
          </View>
          {!isImpromptuSelectionMode ? (
            <View className='coach-link' onClick={handleOpenCoachLibrary}>
              <Text>教练动作</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {activeTab === 'public' && !isSelectionMode && libraryMode === 'STRENGTH' && (
        <ScrollView scrollX className='preset-scroll' showScrollbar={false}>
          <View className='preset-list'>
            {PUBLIC_PRESETS.map(item => (
              <View
                key={item.key}
                className={`preset-chip ${selectedPublicPreset === item.key ? 'active' : ''}`}
                onClick={() => handleSelectPublicPreset(item.key)}
              >
                <Text>{item.label}</Text>
              </View>
            ))}
            <View
              className={`preset-chip ${publicOnlyWithDemo ? 'active' : ''}`}
              onClick={() => setPublicOnlyWithDemo(prev => !prev)}
            >
              <Text>有演示</Text>
            </View>
          </View>
        </ScrollView>
      )}

      {libraryMode === 'STRENGTH' ? renderEquipmentChips() : null}

      <View className='library-layout'>
        {renderFilterRail()}
        <ScrollView scrollY className='action-scroll'>
          <View className='section-heading'>
            <Text className='section-title'>
              {libraryMode === 'STREET'
                ? `街健 · ${activeMuscleFilter.label}`
                : libraryMode === 'CARDIO'
                  ? `有氧 · ${activeMuscleFilter.label}`
                  : activeMuscleFilter.label}
            </Text>
            <Text className='section-count'>
              {activeTab === 'public'
                ? displayedPublicActions.length
                : activeTab === 'frequent' ? displayedFrequentActions.length : displayedMineActions.length} 个{activeTab === 'frequent' ? '常用' : ''}动作
            </Text>
          </View>
          {checkingCurrentImpromptu ? (
            <View className='loading-container'><Text className='empty-desc'>正在检查未完成训练...</Text></View>
          ) : activeTab === 'public' ? renderPublicList() : renderMineList()}
        </ScrollView>
      </View>

      {isImpromptuSelectionMode && selectedActions.length > 0 ? (
        <View className='selection-dock'>
          <ScrollView scrollX className='selection-scroll' showScrollbar={false}>
            <View className='selection-list'>
              {selectedActions.map((action) => (
                <View key={action.id} className='selection-chip' onClick={() => toggleOwnedSelection(action)}>
                  <Text>{action.name}</Text>
                  <Text className='selection-remove'>×</Text>
                </View>
              ))}
            </View>
          </ScrollView>
          <View className={`start-training-btn ${startingImpromptu ? 'disabled' : ''}`} onClick={() => void handleStartImpromptu()}>
            <Text>{startingImpromptu ? '创建中' : `开始训练 · ${selectedActions.length}`}</Text>
          </View>
        </View>
      ) : null}

      {showEditSuggestion && editingPublicAction && (
        <View className='dialog'>
          <View className='dialog-overlay' onClick={closeEditSuggestion} />
          <View className='dialog-content large'>
            <Text className='dialog-title'>提交纠错建议</Text>
            <Text className='dialog-desc'>提交后会直接更新到公共动作库，同时保留一条编辑记录。</Text>
            <ScrollView className='dialog-scroll' scrollY>
              <View className='dialog-section'>
                <Text className='dialog-label'>动作名称</Text>
                <Input className='dialog-input' value={editName} onInput={(e) => setEditName(e.detail.value)} />
              </View>
              <View className='dialog-section'>
                <Text className='dialog-label'>动作说明</Text>
                <Textarea
                  className='dialog-textarea'
                  value={editDetail}
                  onInput={(e) => setEditDetail(e.detail.value)}
                  maxlength={500}
                />
              </View>
              <View className='dialog-section'>
                <Text className='dialog-label'>演示视频链接</Text>
                <Input className='dialog-input' value={editUrl} onInput={(e) => setEditUrl(e.detail.value)} />
              </View>
              <View className='dialog-section'>
                <Text className='dialog-label'>动作类型</Text>
                <View className='option-grid'>
                  {ACTION_TYPES.map(item => (
                    <View
                      key={item.value}
                      className={`option-chip ${editType === item.value ? 'selected' : ''}`}
                      onClick={() => setEditType(item.value)}
                    >
                      <Text>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View className='dialog-section'>
                <Text className='dialog-label'>训练部位</Text>
                <View className='option-grid'>
                  {ACTION_POSITIONS.map(position => (
                    <View
                      key={position}
                      className={`option-chip ${editPositions.includes(position) ? 'selected' : ''}`}
                      onClick={() => toggleEditPosition(position)}
                    >
                      <Text>{position}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View className='dialog-section'>
                <Text className='dialog-label'>动作属性</Text>
                <View className='option-grid'>
                  {ACTION_ATTRS.map(attr => (
                    <View
                      key={attr}
                      className={`option-chip ${editAttrs.includes(attr) ? 'selected' : ''}`}
                      onClick={() => toggleEditAttr(attr)}
                    >
                      <Text>{attr}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
            <View className='dialog-buttons'>
              <View className='btn-secondary' onClick={closeEditSuggestion}><Text>取消</Text></View>
              <View
                className={`btn-primary ${submittingEdit ? 'disabled' : ''}`}
                onClick={submittingEdit ? undefined : handleSubmitEditSuggestion}
              >
                <Text>{submittingEdit ? '提交中' : '提交建议'}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {!isSelectionMode ? <BottomNav /> : null}
    </View>
  )
}
