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
import { Book, Check, Close, Heart, Target } from '@nutui/icons-react-taro'

interface Action {
  id: string
  name: string
  detail?: string
  type?: string
  attrs?: string[]
  positions?: string[]
  reference_1rm?: number | null
  url?: string
  canonical_action_id?: string
}

type TabKey = 'mine' | 'public'
type PublicPresetKey = 'all' | 'recommended' | 'fat-loss' | 'upper-body' | 'core-back'

const PUBLIC_PRESET_SEARCH_MAP: Record<Exclude<PublicPresetKey, 'all' | 'recommended'>, string> = {
  'fat-loss': '有氧',
  'upper-body': '上肢',
  'core-back': '核心'
}

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
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  const cacheKey = `action_detail_${action.id}`
  Taro.setStorageSync(cacheKey, {
    id: action.id,
    name: action.name,
    detail: action.detail,
    positions: action.positions,
    attrs: action.attrs,
    type: action.type,
    url: action.url
  })
  Taro.navigateTo({
    url: `/training/action-detail/index?id=${encodeURIComponent(action.id)}`
  })
}

export default function ActionLibPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('mine')
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [mySearchTerm, setMySearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [showBatchOneRM, setShowBatchOneRM] = useState(false)
  const [batchOneRMValue, setBatchOneRMValue] = useState('')
  const [publishingActionId, setPublishingActionId] = useState<string | null>(null)

  const [publicSearchTerm, setPublicSearchTerm] = useState('')
  const [publicActions, setPublicActions] = useState<PublicActionItemDto[]>([])
  const [publicLoading, setPublicLoading] = useState(false)
  const [addingPublicId, setAddingPublicId] = useState<string | null>(null)
  const [likingPublicId, setLikingPublicId] = useState<string | null>(null)
  const [selectedPublicPreset, setSelectedPublicPreset] = useState<PublicPresetKey>('all')
  const [publicOnlyWithDemo, setPublicOnlyWithDemo] = useState(false)

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

  const displayedPublicActions = useMemo(() => {
    if (!publicOnlyWithDemo) {
      return publicActions
    }
    return publicActions.filter((item) => !!item.url?.trim())
  }, [publicActions, publicOnlyWithDemo])

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
        limit: 100,
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
      content: '确定要删除此动作吗？'
    })
    if (res.confirm) {
      try {
        await studentActionLibService.deleteAction({ id })
        Taro.showToast({ title: '删除成功', icon: 'success' })
        loadActions()
      } catch (error) {
        Taro.showToast({ title: '删除失败', icon: 'none' })
      }
    }
  }

  const handleViewReferences = async (action: Action) => {
    try {
      const res = await studentActionLibService.getActionReferences(action.id)
      if (res?.references && res.references.length > 0) {
        const list = res.references.map(r => `• ${r.planName} - 第${r.dayIndex}天`).join('\n')
        Taro.showModal({
          title: `${action.name} 被引用`,
          content: list,
          showCancel: false
        })
      } else {
        Taro.showToast({ title: '暂无计划引用此动作', icon: 'none' })
      }
    } catch (error) {
      Taro.showToast({ title: '查询失败', icon: 'none' })
    }
  }

  const handleMerge = async (sourceAction: Action) => {
    const otherActions = actions.filter(a => a.id !== sourceAction.id)
    if (otherActions.length === 0) {
      Taro.showToast({ title: '没有其他动作可合并', icon: 'none' })
      return
    }

    Taro.showActionSheet({
      itemList: otherActions.map(a => `合并到: ${a.name}`).slice(0, 10),
      success: async (res) => {
        const targetAction = otherActions[res.tapIndex]
        const confirm = await Taro.showModal({
          title: '合并确认',
          content: `将「${sourceAction.name}」合并到「${targetAction.name}」？\n这会将所有计划中的引用一并更新。`
        })
        if (confirm.confirm) {
          try {
            await studentActionLibService.mergeActions(sourceAction.id, targetAction.id)
            Taro.showToast({ title: '合并成功', icon: 'success' })
            loadActions()
          } catch (error) {
            Taro.showToast({ title: '合并失败', icon: 'none' })
          }
        }
      }
    })
  }

  const handlePublishAction = async (action: Action) => {
    const hasDemo = !!action.url?.trim()
    if (!hasDemo) {
      const modal = await Taro.showModal({
        title: '贡献前需完善',
        content: '公共动作库要求至少补充演示视频。现在去编辑并完善这个动作吗？',
        confirmText: '去完善',
        cancelText: '稍后'
      })
      if (modal.confirm) {
        handleEdit(action.id)
      }
      return
    }

    const modal = await Taro.showModal({
      title: '贡献到公共动作库',
      content: '贡献后，其他用户可以浏览、点赞、加入，并对这个动作提交纠错建议。确认继续吗？',
      confirmText: '确认贡献',
      cancelText: '再检查下'
    })

    if (!modal.confirm) {
      return
    }

    try {
      setPublishingActionId(action.id)
      await publishMyAction(action.id, 'student')
      Taro.showToast({ title: '已贡献到公共库', icon: 'success' })
      loadPublicLibrary(publicSearchTerm.trim())
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '贡献失败', icon: 'none' })
    } finally {
      setPublishingActionId(null)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const handleBatchUpdateOneRM = async () => {
    if (selectedIds.length === 0) {
      Taro.showToast({ title: '请先选择动作', icon: 'none' })
      return
    }

    const value = parseFloat(batchOneRMValue)
    if (Number.isNaN(value) || value <= 0) {
      Taro.showToast({ title: '请输入有效的1RM值', icon: 'none' })
      return
    }

    try {
      const updates = selectedIds.map(id => ({ actionId: id, reference1RM: value }))
      await studentActionLibService.batchUpdate1RM(updates)
      Taro.showToast({ title: '批量更新成功', icon: 'success' })
      setShowBatchOneRM(false)
      setBatchOneRMValue('')
      setSelectedIds([])
      setIsBatchMode(false)
      loadActions()
    } catch (error) {
      Taro.showToast({ title: '更新失败', icon: 'none' })
    }
  }

  const handleLongPress = (id: string) => {
    if (!isBatchMode) {
      setIsBatchMode(true)
      setSelectedIds([id])
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
    if (preset === 'all' || preset === 'recommended') {
      setPublicSearchTerm('')
      await loadPublicLibrary('')
      return
    }

    const keyword = PUBLIC_PRESET_SEARCH_MAP[preset]
    setPublicSearchTerm(keyword)
    await loadPublicLibrary(keyword)
  }

  const handlePublicAdd = async (actionId: string) => {
    try {
      setAddingPublicId(actionId)
      await addPublicToMyLib(actionId)
      setPublicActions((prev) =>
        prev.map((item) => (item.id === actionId ? { ...item, isAdded: true } : item))
      )
      Taro.showToast({ title: '已加入我的动作库', icon: 'success' })
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
      setPublicActions((prev) =>
        prev.map((item) =>
          item.id === actionId
            ? {
                ...item,
                isLiked: res.liked,
                like_count: res.likeCount
              }
            : item
        )
      )
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '点赞失败', icon: 'none' })
    } finally {
      setLikingPublicId(null)
    }
  }

  const handleOpenPublicDetail = (action: PublicActionItemDto) => {
    cacheAndOpenActionDetail(action)
  }

  const openEditSuggestion = (action: PublicActionItemDto) => {
    setEditingPublicAction(action)
    setEditName(action.name || '')
    setEditDetail(action.detail || '')
    setEditUrl(action.url || '')
    setEditType(action.type || 'STRENGTH')
    setEditPositions(Array.isArray(action.positions) ? action.positions : [])
    setEditAttrs(Array.isArray(action.attrs) ? action.attrs : [])
    setShowEditSuggestion(true)
  }

  const closeEditSuggestion = () => {
    setShowEditSuggestion(false)
    setEditingPublicAction(null)
    setSubmittingEdit(false)
  }

  const toggleEditPosition = (position: string) => {
    setEditPositions((prev) => (
      prev.includes(position) ? prev.filter((item) => item !== position) : [...prev, position]
    ))
  }

  const toggleEditAttr = (attr: string) => {
    setEditAttrs((prev) => (
      prev.includes(attr) ? prev.filter((item) => item !== attr) : [...prev, attr]
    ))
  }

  const handleSubmitEditSuggestion = async () => {
    if (!editingPublicAction) {
      return
    }

    if (!editName.trim()) {
      Taro.showToast({ title: '请输入动作名称', icon: 'none' })
      return
    }

    const nextPayload = {
      name: editName.trim(),
      detail: normalizeText(editDetail),
      url: normalizeText(editUrl),
      positions: normalizeList(editPositions),
      attrs: normalizeList(editAttrs),
      type: editType || null
    }

    const hasChanged =
      nextPayload.name !== editingPublicAction.name ||
      nextPayload.detail !== (editingPublicAction.detail || null) ||
      nextPayload.url !== (editingPublicAction.url || null) ||
      JSON.stringify(nextPayload.positions) !== JSON.stringify(editingPublicAction.positions || null) ||
      JSON.stringify(nextPayload.attrs) !== JSON.stringify(editingPublicAction.attrs || null) ||
      nextPayload.type !== (editingPublicAction.type || null)

    if (!hasChanged) {
      Taro.showToast({ title: '请先修改至少一项内容', icon: 'none' })
      return
    }

    try {
      setSubmittingEdit(true)
      await submitPublicActionEdit({
        actionId: editingPublicAction.id,
        name: nextPayload.name,
        detail: nextPayload.detail,
        url: nextPayload.url,
        positions: nextPayload.positions,
        attrs: nextPayload.attrs,
        type: nextPayload.type,
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

  const renderMineList = () => {
    if (loading) {
      return (
        <View className='loading-container'>
          {[1, 2, 3, 4].map(i => (
            <View key={i} className='skeleton-card'>
              <View className='skeleton-line' />
              <View className='skeleton-line short' />
            </View>
          ))}
        </View>
      )
    }

    if (actions.length === 0) {
      return (
        <View className='empty-state'>
          <View className='empty-icon'><Target /></View>
          <Text className='empty-title'>暂无动作</Text>
          <Text className='empty-desc'>点击右上角新建、从教练添加，或去公共动作库加入现成动作</Text>
        </View>
      )
    }

    return (
      <View className='action-list'>
        {actions.map(action => {
          const isSelected = selectedIds.includes(action.id)
          const isPublishing = publishingActionId === action.id
          return (
            <View
              key={action.id}
              className={`action-card ${isSelected ? 'selected' : ''}`}
              onClick={() => isBatchMode ? toggleSelect(action.id) : handleEdit(action.id)}
              onLongPress={() => handleLongPress(action.id)}
            >
              {isBatchMode && (
                <View className={`select-box ${isSelected ? 'checked' : ''}`}>
                  {isSelected && <View className='check-icon'><Check /></View>}
                </View>
              )}
              <View className='action-content'>
                <View className='action-header'>
                  <Text className='action-name'>{action.name}</Text>
                  {action.reference_1rm && (
                    <View className='onerm-badge'>
                      <Text>1RM: {action.reference_1rm}kg</Text>
                    </View>
                  )}
                </View>
                {action.detail && (
                  <Text className='action-detail'>{action.detail}</Text>
                )}
                <View className='action-tags'>
                  {action.type && (
                    <Text className='tag type'>{action.type}</Text>
                  )}
                  {action.attrs?.map((attr, idx) => (
                    <Text key={idx} className='tag'>{attr}</Text>
                  ))}
                </View>
              </View>
              {!isBatchMode && (
                <View className='action-menu' onClick={e => e.stopPropagation()}>
                  <View className='menu-item' onClick={() => handleViewReferences(action)}>
                    <Text>引用</Text>
                  </View>
                  <View className='menu-item' onClick={() => handleMerge(action)}>
                    <Text>合并</Text>
                  </View>
                  <View
                    className={`menu-item publish ${isPublishing ? 'disabled' : ''}`}
                    onClick={() => {
                      if (!isPublishing) {
                        void handlePublishAction(action)
                      }
                    }}
                  >
                    <Text>{isPublishing ? '贡献中' : '贡献'}</Text>
                  </View>
                  <View className='menu-item delete' onClick={() => handleDelete(action.id)}>
                    <Text>删除</Text>
                  </View>
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
        <View className='loading-container'>
          {[1, 2, 3].map(i => (
            <View key={i} className='public-card skeleton-public-card'>
              <View className='skeleton-line' />
              <View className='skeleton-line short' />
            </View>
          ))}
        </View>
      )
    }

    if (displayedPublicActions.length === 0) {
      return (
        <View className='empty-state'>
          <View className='empty-icon'><Book /></View>
          <Text className='empty-title'>公共动作库暂无结果</Text>
          <Text className='empty-desc'>
            {publicOnlyWithDemo ? '当前筛选下没有带演示视频的动作，先关闭“仅看有演示”试试' : '换个关键词试试，或者稍后再来看看'}
          </Text>
        </View>
      )
    }

    return (
      <View className='public-list'>
        {displayedPublicActions.map((action) => {
          const isAdding = addingPublicId === action.id
          const isLiking = likingPublicId === action.id
          return (
            <View key={action.id} className='public-card'>
              <View className='public-card-main' onClick={() => handleOpenPublicDetail(action)}>
                <View className='public-card-top'>
                  <Text className='public-name'>{action.name || '未命名动作'}</Text>
                  <View className='public-badges'>
                    {action.type ? (
                      <Text className='public-badge type'>{action.type}</Text>
                    ) : null}
                    {action.url ? (
                      <Text className='public-badge video'>演示</Text>
                    ) : null}
                  </View>
                </View>
                <Text className='public-detail' numberOfLines={2}>
                  {action.detail || '点击查看动作细节、训练部位和演示视频'}
                </Text>
                {!!action.positions?.length && (
                  <View className='public-tags'>
                    {action.positions.slice(0, 4).map((position, idx) => (
                      <Text key={`${position}-${idx}`} className='public-tag'>{position}</Text>
                    ))}
                  </View>
                )}
                <View className='public-meta'>
                  <View className='public-meta-text'><Heart /> {action.like_count || 0}</View>
                  <Text className='public-meta-text'>
                    {action.contributor?.nickname || '社区贡献'}
                  </Text>
                  {action.created_at ? (
                    <Text className='public-meta-text'>{formatShortDate(action.created_at)}</Text>
                  ) : null}
                </View>
              </View>

              <View className='public-actions'>
                <View
                  className={`public-action-btn subtle ${isLiking ? 'disabled' : ''}`}
                  onClick={() => {
                    if (!isLiking) {
                      void handlePublicLike(action.id)
                    }
                  }}
                >
                  <Text>{action.isLiked ? '已点赞' : '点赞'}</Text>
                </View>
                <View
                  className='public-action-btn subtle'
                  onClick={() => openEditSuggestion(action)}
                >
                  <Text>纠错</Text>
                </View>
                <View
                  className={`public-action-btn primary ${(action.isAdded || isAdding) ? 'disabled' : ''}`}
                  onClick={() => {
                    if (!action.isAdded && !isAdding) {
                      void handlePublicAdd(action.id)
                    }
                  }}
                >
                  <Text>{action.isAdded ? '已加入' : isAdding ? '加入中' : '加入我的库'}</Text>
                </View>
              </View>
            </View>
          )
        })}
      </View>
    )
  }

  return (
    <View className='action-lib-page'>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          <View className='page-header'>
            <View className='header-left'>
              <Text className='page-title'>动作库</Text>
              <Text className='page-subtitle'>我的动作 + 公共动作库</Text>
            </View>
            {activeTab === 'mine' && (
              <View className='header-actions'>
                <View className='header-btn secondary' onClick={handleOpenCoachLibrary}>
                  <Text className='header-btn-text'>从教练添加</Text>
                </View>
                <View className='create-btn' onClick={handleCreate}>
                  <Text className='create-icon'>+</Text>
                  <Text className='create-text'>新建</Text>
                </View>
              </View>
            )}
          </View>

          <View className='tab-bar'>
            <View
              className={`tab-chip ${activeTab === 'mine' ? 'active' : ''}`}
              onClick={() => setActiveTab('mine')}
            >
              <Text>我的动作库</Text>
            </View>
            <View
              className={`tab-chip ${activeTab === 'public' ? 'active' : ''}`}
              onClick={() => setActiveTab('public')}
            >
              <Text>公共动作库</Text>
            </View>
          </View>

          <View className='library-tip'>
            {activeTab === 'public' ? (
              <>
                <Text className='library-tip-title'>公共动作库已接入共建链路</Text>
                <Text className='library-tip-desc'>现在可以直接浏览社区动作、查看详情、点赞、纠错，并一键加入到你的动作库。</Text>
              </>
            ) : (
              <>
                <Text className='library-tip-title'>我的动作现在支持继续向外贡献</Text>
                <Text className='library-tip-desc'>除了编辑、合并、查引用和批量更新 1RM，你还可以从教练动作库导入，或者把自己的优质动作贡献到公共动作库。</Text>
              </>
            )}
          </View>

          {activeTab === 'public' && (
            <View className='preset-panel'>
              <Text className='preset-label'>小白快捷入口</Text>
              <View className='preset-chips'>
                <View
                  className={`preset-chip ${selectedPublicPreset === 'all' ? 'active' : ''}`}
                  onClick={() => handleSelectPublicPreset('all')}
                >
                  <Text>全部</Text>
                </View>
                <View
                  className={`preset-chip ${selectedPublicPreset === 'recommended' ? 'active' : ''}`}
                  onClick={() => handleSelectPublicPreset('recommended')}
                >
                  <Text>新手推荐</Text>
                </View>
                <View
                  className={`preset-chip ${selectedPublicPreset === 'fat-loss' ? 'active' : ''}`}
                  onClick={() => handleSelectPublicPreset('fat-loss')}
                >
                  <Text>减脂有氧</Text>
                </View>
                <View
                  className={`preset-chip ${selectedPublicPreset === 'upper-body' ? 'active' : ''}`}
                  onClick={() => handleSelectPublicPreset('upper-body')}
                >
                  <Text>胸肩手臂</Text>
                </View>
                <View
                  className={`preset-chip ${selectedPublicPreset === 'core-back' ? 'active' : ''}`}
                  onClick={() => handleSelectPublicPreset('core-back')}
                >
                  <Text>腰背核心</Text>
                </View>
                <View
                  className={`preset-chip ${publicOnlyWithDemo ? 'active' : ''}`}
                  onClick={() => setPublicOnlyWithDemo((prev) => !prev)}
                >
                  <Text>{publicOnlyWithDemo ? '仅看有演示: 开' : '仅看有演示: 关'}</Text>
                </View>
              </View>
            </View>
          )}

          <View className='search-bar'>
            <Input
              className='search-input'
              placeholder={activeTab === 'public' ? '搜索公共动作名称...' : '搜索我的动作名称...'}
              value={activeTab === 'public' ? publicSearchTerm : mySearchTerm}
              onInput={(e) => {
                const nextValue = e.detail.value
                if (activeTab === 'public') {
                  setPublicSearchTerm(nextValue)
                } else {
                  setMySearchTerm(nextValue)
                }
              }}
              confirmType='search'
              onConfirm={handleSubmitSearch}
            />
            <View className='search-submit' onClick={handleSubmitSearch}>
              <Text>搜索</Text>
            </View>
            {(activeTab === 'public' ? publicSearchTerm : mySearchTerm) ? (
              <View className='clear-btn' onClick={handleClearSearch}><Close /></View>
            ) : null}
          </View>

          {activeTab === 'mine' && isBatchMode && (
            <View className='batch-bar'>
              <Text className='batch-text'>已选择 {selectedIds.length} 项</Text>
              <View className='batch-actions'>
                <Text className='batch-btn' onClick={() => setShowBatchOneRM(true)}>批量更新1RM</Text>
                <Text
                  className='batch-btn cancel'
                  onClick={() => {
                    setIsBatchMode(false)
                    setSelectedIds([])
                  }}
                >
                  取消
                </Text>
              </View>
            </View>
          )}

          {activeTab === 'public' ? renderPublicList() : renderMineList()}
        </View>
      </ScrollView>

      {showBatchOneRM && (
        <View className='dialog'>
          <View className='dialog-overlay' onClick={() => setShowBatchOneRM(false)} />
          <View className='dialog-content'>
            <Text className='dialog-title'>批量更新1RM</Text>
            <Text className='dialog-desc'>将为选中的 {selectedIds.length} 个动作设置相同的1RM值</Text>
            <Input
              className='dialog-input'
              type='digit'
              placeholder='输入1RM值 (kg)'
              value={batchOneRMValue}
              onInput={e => setBatchOneRMValue(e.detail.value)}
            />
            <View className='dialog-buttons'>
              <View className='btn-secondary' onClick={() => setShowBatchOneRM(false)}>
                <Text>取消</Text>
              </View>
              <View className='btn-primary' onClick={handleBatchUpdateOneRM}>
                <Text>确认</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {showEditSuggestion && editingPublicAction && (
        <View className='dialog'>
          <View className='dialog-overlay' onClick={closeEditSuggestion} />
          <View className='dialog-content large'>
            <Text className='dialog-title'>提交纠错建议</Text>
            <Text className='dialog-desc'>你的修改会进入贡献者审核队列，通过后再更新到公共动作库。</Text>
            <ScrollView className='dialog-scroll' scrollY>
              <View className='dialog-section'>
                <Text className='dialog-label'>动作名称</Text>
                <Input
                  className='dialog-input'
                  value={editName}
                  onInput={(e) => setEditName(e.detail.value)}
                  placeholder='请输入动作名称'
                />
              </View>

              <View className='dialog-section'>
                <Text className='dialog-label'>动作说明</Text>
                <Textarea
                  className='dialog-textarea'
                  value={editDetail}
                  onInput={(e) => setEditDetail(e.detail.value)}
                  placeholder='补充动作要领、注意事项、纠错说明'
                  maxlength={500}
                />
              </View>

              <View className='dialog-section'>
                <Text className='dialog-label'>演示视频链接</Text>
                <Input
                  className='dialog-input'
                  value={editUrl}
                  onInput={(e) => setEditUrl(e.detail.value)}
                  placeholder='https://...'
                />
              </View>

              <View className='dialog-section'>
                <Text className='dialog-label'>动作类型</Text>
                <View className='option-grid'>
                  {ACTION_TYPES.map((item) => (
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
                  {ACTION_POSITIONS.map((position) => (
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
                  {ACTION_ATTRS.map((attr) => (
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
              <View className='btn-secondary' onClick={closeEditSuggestion}>
                <Text>取消</Text>
              </View>
              <View
                className={`btn-primary ${submittingEdit ? 'disabled' : ''}`}
                onClick={submittingEdit ? undefined : handleSubmitEditSuggestion}
              >
                <Text>{submittingEdit ? '提交中...' : '提交建议'}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      <BottomNav />
    </View>
  )
}
