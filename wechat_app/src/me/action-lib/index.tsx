import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Input, Textarea } from '@tarojs/components'
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
}

type TabKey = 'mine' | 'public'
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
}) {
  return [
    action.name,
    action.detail,
    action.type,
    ...asList(action.positions),
    ...asList(action.attrs)
  ].filter(Boolean).join(' ').toLowerCase()
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
    url: action.url
  })
  Taro.navigateTo({
    url: `/training/action-detail?id=${encodeURIComponent(action.id)}`
  })
}

export default function ActionLibPage() {
  const { effectiveTheme } = useTheme()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('mine')
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [mySearchTerm, setMySearchTerm] = useState('')
  const [publishingActionId, setPublishingActionId] = useState<string | null>(null)

  const [publicSearchTerm, setPublicSearchTerm] = useState('')
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
    if (router.params?.tab === 'public') {
      setActiveTab('public')
    }
  }, [router.params?.tab])

  const loadActions = useCallback(async (search = mySearchTerm) => {
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
  }, [mySearchTerm])

  const loadPublicLibrary = useCallback(async (search = publicSearchTerm) => {
    try {
      setPublicLoading(true)
      const res = await listPublicActions({
        page: 1,
        limit: 120,
        search: search || undefined,
        viewerActionType: 'student'
      })
      setPublicActions(res?.actions || [])
    } catch (error) {
      console.error('加载公共动作库失败:', error)
      Taro.showToast({ title: '公共动作库加载失败', icon: 'none' })
    } finally {
      setPublicLoading(false)
    }
  }, [publicSearchTerm])

  useDidShow(() => {
    if (activeTab === 'public') {
      loadPublicLibrary()
    } else {
      loadActions()
    }
  })

  useEffect(() => {
    if (activeTab === 'public') {
      loadPublicLibrary()
    } else {
      loadActions()
    }
  }, [activeTab, loadActions, loadPublicLibrary])

  usePullDownRefresh(() => {
    const loader = activeTab === 'public' ? loadPublicLibrary() : loadActions()
    loader.finally(() => Taro.stopPullDownRefresh())
  })

  const activeMuscleFilter = useMemo(
    () => MUSCLE_FILTERS.find(item => item.key === selectedMuscle) || MUSCLE_FILTERS[0],
    [selectedMuscle]
  )

  const activeEquipmentFilter = useMemo(
    () => EQUIPMENT_FILTERS.find(item => item.key === selectedEquipment) || EQUIPMENT_FILTERS[0],
    [selectedEquipment]
  )

  const displayedMineActions = useMemo(() => {
    return actions.filter(action =>
      matchesFilter(action, activeMuscleFilter) &&
      matchesFilter(action, activeEquipmentFilter)
    )
  }, [actions, activeEquipmentFilter, activeMuscleFilter])

  const displayedPublicActions = useMemo(() => {
    return publicActions.filter(action =>
      (!publicOnlyWithDemo || !!action.url?.trim()) &&
      matchesFilter(action, activeMuscleFilter) &&
      matchesFilter(action, activeEquipmentFilter)
    )
  }, [activeEquipmentFilter, activeMuscleFilter, publicActions, publicOnlyWithDemo])

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
    } else {
      loadActions(mySearchTerm.trim())
    }
  }

  const handleClearSearch = () => {
    if (activeTab === 'public') {
      setPublicSearchTerm('')
      setSelectedPublicPreset('all')
      loadPublicLibrary('')
    } else {
      setMySearchTerm('')
      loadActions('')
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
      Taro.showToast({ title: '纠错建议已提交', icon: 'success' })
      closeEditSuggestion()
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '提交失败', icon: 'none' })
      setSubmittingEdit(false)
    }
  }

  const renderFilterRail = () => (
    <View className='filter-rail'>
      {MUSCLE_FILTERS.map(item => (
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
    if (loading) {
      return (
        <View className='loading-container'>
          {[1, 2, 3, 4].map(i => <View key={i} className='skeleton-card' />)}
        </View>
      )
    }

    if (displayedMineActions.length === 0) {
      return (
        <View className='empty-state'>
          <Text className='empty-title'>没有匹配动作</Text>
          <Text className='empty-desc'>换个肌群、器械或关键词试试</Text>
        </View>
      )
    }

    return (
      <View className='mine-list'>
        {displayedMineActions.map(action => {
          const isPublishing = publishingActionId === action.id
          const meta = getActionMeta(action)
          return (
            <View key={action.id} className='mine-card'>
              <View className='action-avatar' onClick={() => handleEdit(action.id)}>
                <Text>{getActionInitial(action.name)}</Text>
              </View>
              <View className='mine-main' onClick={() => handleEdit(action.id)}>
                <Text className='action-title'>{action.name}</Text>
                <Text className='action-subtitle'>{getPrimaryPosition(action)} · {action.type || 'STRENGTH'}</Text>
                <View className='tag-row'>
                  {meta.map((item, index) => <Text key={`${item}-${index}`} className='tag'>{item}</Text>)}
                  {action.reference_1rm ? <Text className='tag strong'>1RM {action.reference_1rm}kg</Text> : null}
                </View>
              </View>
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
      return (
        <View className='empty-state'>
          <Text className='empty-title'>没有匹配动作</Text>
          <Text className='empty-desc'>换个肌群、器械或关键词试试</Text>
        </View>
      )
    }

    return (
      <View className='card-grid'>
        {displayedPublicActions.map(action => {
          const isAdding = addingPublicId === action.id
          const isLiking = likingPublicId === action.id
          const meta = getActionMeta(action)
          return (
            <View key={action.id} className='public-card'>
              <View className='card-marker'><Text>{action.url ? '演示' : '要点'}</Text></View>
              <View className='card-count'><Text>{action.like_count || 0}赞</Text></View>
              <View className='action-avatar large' onClick={() => cacheAndOpenActionDetail(action)}>
                <Text>{getActionInitial(action.name)}</Text>
              </View>
              <Text className='card-title' onClick={() => cacheAndOpenActionDetail(action)}>{action.name || '未命名动作'}</Text>
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
            </View>
          )
        })}
      </View>
    )
  }

  return (
    <View className={`action-lib-page theme-${effectiveTheme}`}>
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
        <View className='top-add' onClick={handleCreate}>
          <Text>+</Text>
        </View>
      </View>

      <View className='mode-row'>
        <View className={`mode-chip ${activeTab === 'mine' ? 'active' : ''}`} onClick={() => setActiveTab('mine')}>
          <Text>我的动作</Text>
        </View>
        <View className={`mode-chip ${activeTab === 'public' ? 'active' : ''}`} onClick={() => setActiveTab('public')}>
          <Text>公共动作</Text>
        </View>
        <View className='coach-link' onClick={handleOpenCoachLibrary}>
          <Text>教练动作</Text>
        </View>
      </View>

      {activeTab === 'public' && (
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

      {renderEquipmentChips()}

      <View className='library-layout'>
        {renderFilterRail()}
        <ScrollView scrollY className='action-scroll'>
          <View className='section-heading'>
            <Text className='section-title'>{activeMuscleFilter.label}</Text>
            <Text className='section-count'>
              {activeTab === 'public' ? displayedPublicActions.length : displayedMineActions.length} 个动作
            </Text>
          </View>
          {activeTab === 'public' ? renderPublicList() : renderMineList()}
        </ScrollView>
      </View>

      {showEditSuggestion && editingPublicAction && (
        <View className='dialog'>
          <View className='dialog-overlay' onClick={closeEditSuggestion} />
          <View className='dialog-content large'>
            <Text className='dialog-title'>提交纠错建议</Text>
            <Text className='dialog-desc'>你的修改会进入审核队列，通过后再更新到公共动作库。</Text>
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

      <BottomNav />
    </View>
  )
}
