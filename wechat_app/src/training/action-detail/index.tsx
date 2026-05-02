import { View, Text, Input, Textarea, ScrollView } from '@tarojs/components'
import { useEffect, useMemo, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { authService } from '@/services/authService'
import { submitPublicActionEdit, syncPublicToMyLib } from '@/services/actionLibPageService'
import './index.scss'

interface ActionDetailData {
  id: string
  name: string
  detail?: string | null
  positions?: string[] | null
  attrs?: string[] | null
  type?: string | null
  url?: string | null
  item_schema?: Record<string, unknown> | null
  suggested_time?: string | null
  enableAutoWeightCompute?: boolean | null
  includesBodyWeight?: boolean | null
  canonical_action_id?: string | null
  source?: 'mine' | 'public'
  contributor_user_id?: string
  contributor?: { nickname?: string | null; avatarUrl?: string | null } | null
  owner_user_id?: string | null
  isAdded?: boolean
  created_at?: string | null
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

export default function ActionDetailPage() {
  const router = useRouter()
  const id = router.params?.id || ''
  const [action, setAction] = useState<ActionDetailData | null>(null)
  const [showSuggestionDialog, setShowSuggestionDialog] = useState(false)
  const [submittingEdit, setSubmittingEdit] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const [editName, setEditName] = useState('')
  const [editDetail, setEditDetail] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editType, setEditType] = useState('STRENGTH')
  const [editPositions, setEditPositions] = useState<string[]>([])
  const [editAttrs, setEditAttrs] = useState<string[]>([])

  const cacheKey = useMemo(() => (id ? `action_detail_${id}` : ''), [id])
  const currentUserId = authService.getCurrentUser()?.id || ''
  const positions = action?.positions ?? []
  const attrs = action?.attrs ?? []
  const isPublicAction = action?.source === 'public' || !!action?.contributor_user_id
  const canSyncToMyLib = !!(isPublicAction && action?.owner_user_id && currentUserId && action.owner_user_id === currentUserId)

  useEffect(() => {
    if (!cacheKey) return
    const cache = Taro.getStorageSync(cacheKey)
    if (cache && typeof cache === 'object') {
      setAction(cache as ActionDetailData)
      return
    }
    setAction(null)
  }, [cacheKey])

  const handleCopyVideoUrl = () => {
    if (!action?.url) return
    Taro.setClipboardData({
      data: action.url,
      success: () => {
        Taro.showToast({ title: '链接已复制', icon: 'success' })
      }
    })
  }

  const openSuggestionDialog = () => {
    if (!action) return
    setEditName(action.name || '')
    setEditDetail(action.detail || '')
    setEditUrl(action.url || '')
    setEditType(action.type || 'STRENGTH')
    setEditPositions(Array.isArray(action.positions) ? action.positions : [])
    setEditAttrs(Array.isArray(action.attrs) ? action.attrs : [])
    setShowSuggestionDialog(true)
  }

  const closeSuggestionDialog = () => {
    setShowSuggestionDialog(false)
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

  const handleSubmitSuggestion = async () => {
    if (!action) return

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
      nextPayload.name !== action.name ||
      nextPayload.detail !== (action.detail || null) ||
      nextPayload.url !== (action.url || null) ||
      JSON.stringify(nextPayload.positions) !== JSON.stringify(action.positions || null) ||
      JSON.stringify(nextPayload.attrs) !== JSON.stringify(action.attrs || null) ||
      nextPayload.type !== (action.type || null)

    if (!hasChanged) {
      Taro.showToast({ title: '请先修改至少一项内容', icon: 'none' })
      return
    }

    try {
      setSubmittingEdit(true)
      await submitPublicActionEdit({
        actionId: action.id,
        name: nextPayload.name,
        detail: nextPayload.detail,
        url: nextPayload.url,
        positions: nextPayload.positions,
        attrs: nextPayload.attrs,
        type: nextPayload.type,
        item_schema: action.item_schema ?? null,
        suggested_time: action.suggested_time ?? null,
        enableAutoWeightCompute: action.enableAutoWeightCompute ?? false,
        includesBodyWeight: action.includesBodyWeight ?? false,
        canonical_action_id: action.canonical_action_id ?? null
      })
      Taro.showToast({ title: '纠错建议已提交', icon: 'success' })
      closeSuggestionDialog()
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '提交失败', icon: 'none' })
      setSubmittingEdit(false)
    }
  }

  const handleSyncToMyLib = async () => {
    if (!action?.id || !canSyncToMyLib) return

    try {
      setSyncing(true)
      await syncPublicToMyLib(action.id, 'student')
      setAction((prev) => (prev ? { ...prev, isAdded: true } : prev))
      Taro.showToast({ title: '已同步到我的动作库', icon: 'success' })
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '同步失败', icon: 'none' })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <View className="action-detail-page">
      <View className="action-card">
        <Text className="title">{action?.name || '动作详情'}</Text>

        <View className="summary-row">
          {action?.type ? <Text className="type-tag">{action.type}</Text> : null}
          {isPublicAction ? <Text className="source-tag">公共动作</Text> : null}
        </View>

        {isPublicAction ? (
          <View className="meta-card">
            <Text className="meta-text">贡献者：{action?.contributor?.nickname || '社区贡献'}</Text>
            {action?.created_at ? <Text className="meta-text">收录时间：{formatShortDate(action.created_at)}</Text> : null}
          </View>
        ) : null}

        {action?.detail ? (
          <View className="section">
            <Text className="section-title">动作说明</Text>
            <Text className="section-content">{action.detail}</Text>
          </View>
        ) : null}

        {positions.length > 0 ? (
          <View className="section">
            <Text className="section-title">训练部位</Text>
            <View className="tag-list">
              {positions.map((item, index) => (
                <Text key={`${item}-${index}`} className="tag">{item}</Text>
              ))}
            </View>
          </View>
        ) : null}

        {attrs.length > 0 ? (
          <View className="section">
            <Text className="section-title">动作属性</Text>
            <View className="tag-list">
              {attrs.map((item, index) => (
                <Text key={`${item}-${index}`} className="tag">{item}</Text>
              ))}
            </View>
          </View>
        ) : null}

        {action?.url ? (
          <View className="section">
            <Text className="section-title">演示视频链接</Text>
            <Text className="video-url" selectable>{action.url}</Text>
            <View className="inline-actions">
              <View className="secondary-btn" onClick={handleCopyVideoUrl}>
                <Text>复制链接</Text>
              </View>
            </View>
          </View>
        ) : null}

        {isPublicAction ? (
          <View className="detail-actions">
            <View className="primary-btn" onClick={openSuggestionDialog}>
              <Text>提交纠错建议</Text>
            </View>
            {canSyncToMyLib ? (
              <View
                className={`secondary-btn ${syncing ? 'disabled' : ''}`}
                onClick={syncing ? undefined : handleSyncToMyLib}
              >
                <Text>{syncing ? '同步中...' : '同步到我的动作库'}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {!action ? (
          <View className="empty-state">
            <Text className="empty-text">未找到动作详情，请返回动作库重新进入。</Text>
            {id ? <Text className="id-hint">动作 ID: {id}</Text> : null}
          </View>
        ) : null}
      </View>

      {showSuggestionDialog && action && (
        <View className='dialog'>
          <View className='dialog-overlay' onClick={closeSuggestionDialog} />
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
              <View className='secondary-btn' onClick={closeSuggestionDialog}>
                <Text>取消</Text>
              </View>
              <View
                className={`primary-btn ${submittingEdit ? 'disabled' : ''}`}
                onClick={submittingEdit ? undefined : handleSubmitSuggestion}
              >
                <Text>{submittingEdit ? '提交中...' : '提交建议'}</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
