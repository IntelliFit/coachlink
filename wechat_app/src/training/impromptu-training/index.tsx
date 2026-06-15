import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { impromptuService, ImpromptuActionInput } from '@/services/impromptuService'
import { studentActionLibService } from '@/services/studentActionLibService'
import { listPublicActions } from '@/services/actionLibPageService'
import { authService } from '@/services/authService'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

interface StudentAction {
  id: string
  name?: string
  type?: string
  positions?: string[]
  attrs?: string[]
  detail?: string | null
  url?: string | null
  equipment?: string
  category?: string
  primary_muscle?: string
  target_muscles?: string[]
  source?: 'mine' | 'public'
  isAdded?: boolean
  like_count?: number
  [key: string]: any
}

const DEFAULT_REST = 90

const asTextList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(item => String(item || '').trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[,\s，、]+/).map(item => item.trim()).filter(Boolean)
  }
  return []
}

const getActionName = (action: StudentAction) => action.name || '未命名动作'

const getActionMeta = (action: StudentAction) => {
  const tags = [
    ...asTextList(action.positions),
    ...asTextList(action.target_muscles),
    action.primary_muscle,
    action.equipment,
    action.category
  ].map(item => String(item || '').trim()).filter(Boolean)

  return tags.slice(0, 3).join(' · ') || '力量动作'
}

const isStrengthAction = (action: StudentAction) => {
  const type = String(action.type || 'STRENGTH').toUpperCase()
  return type === 'STRENGTH'
}

export default function ImpromptuTraining() {
  const { effectiveTheme } = useTheme()
  const [actions, setActions] = useState<StudentAction[]>([])
  const [loadingActions, setLoadingActions] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [selectedActions, setSelectedActions] = useState<StudentAction[]>([])
  const [startingKey, setStartingKey] = useState<string | null>(null)

  const loadActions = useCallback(async () => {
    try {
      setLoadingActions(true)
      const [myRes, publicRes] = await Promise.allSettled([
        studentActionLibService.listActions({ page: 1, limit: 1000 }),
        listPublicActions({ page: 1, limit: 120, viewerActionType: 'student' })
      ])

      const myActions = myRes.status === 'fulfilled'
        ? (myRes.value?.actions || []).filter((action: StudentAction) => isStrengthAction(action)).map((action: StudentAction) => ({
          ...action,
          source: 'mine' as const
        }))
        : []
      const myNames = new Set(myActions.map((action: StudentAction) => getActionName(action).trim()).filter(Boolean))
      const publicActions = publicRes.status === 'fulfilled'
        ? (publicRes.value?.actions || [])
          .filter((action: StudentAction) => isStrengthAction(action))
          .filter((action: StudentAction) => !myNames.has(getActionName(action).trim()))
          .map((action: StudentAction) => ({
            ...action,
            source: 'public' as const
          }))
        : []

      if (myRes.status === 'rejected') {
        console.error('加载我的动作失败:', myRes.reason)
      }
      if (publicRes.status === 'rejected') {
        console.error('加载公共动作失败:', publicRes.reason)
      }

      setActions([...myActions, ...publicActions])
    } catch (e) {
      console.error('加载动作失败:', e)
      Taro.showToast({ title: '无法加载动作库', icon: 'none' })
    } finally {
      setLoadingActions(false)
    }
  }, [])

  useEffect(() => {
    const user = authService.getCurrentUser()
    if (!user?.id) {
      Taro.redirectTo({
        url: `/auth/login?returnTo=${encodeURIComponent('/training/impromptu-training')}`
      })
      return
    }
    loadActions()
  }, [loadActions])

  const filteredActions = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    const strengthActions = actions.filter(action => isStrengthAction(action))

    if (!normalizedKeyword) return strengthActions

    return strengthActions.filter(action => {
      const searchable = [
        getActionName(action),
        getActionMeta(action),
        ...asTextList(action.attrs)
      ].join(' ').toLowerCase()
      return searchable.includes(normalizedKeyword)
    })
  }, [actions, keyword])

  const selectedIdSet = useMemo(() => new Set(selectedActions.map(action => action.id)), [selectedActions])
  const actionSourceStats = useMemo(() => {
    return actions.reduce((acc, action) => {
      if (action.source === 'public') acc.public += 1
      else acc.mine += 1
      return acc
    }, { mine: 0, public: 0 })
  }, [actions])

  const buildQuickAction = (action: StudentAction): ImpromptuActionInput => ({
    actionId: action.id,
    actionName: getActionName(action),
    sets: 1,
    reps: null,
    weight: null,
    restSeconds: DEFAULT_REST
  })

  const startWithActions = async (actionList: StudentAction[], key: string) => {
    if (startingKey) return

    const validActions = actionList.filter(action => action?.id)
    if (validActions.length === 0) {
      Taro.showToast({ title: '先选择一个动作', icon: 'none' })
      return
    }

    setStartingKey(key)
    try {
      const payload = validActions.map(buildQuickAction)
      const data = await impromptuService.start(payload)

      if (!data?.id) {
        throw new Error('创建即兴训练失败')
      }

      Taro.navigateTo({
        url: `/training/training-execution?impromptuId=${data.id}&dayIndex=1`
      })
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '开始失败，请稍后再试', icon: 'none' })
    } finally {
      setStartingKey(null)
    }
  }

  const toggleSelectedAction = (action: StudentAction) => {
    setSelectedActions(prev => {
      const exists = prev.some(item => item.id === action.id)
      if (exists) return prev.filter(item => item.id !== action.id)
      return [...prev, action]
    })
  }

  const removeSelectedAction = (actionId: string) => {
    setSelectedActions(prev => prev.filter(action => action.id !== actionId))
  }

  const handleBack = () => {
    Taro.navigateTo({ url: '/pages/index/index' })
  }

  return (
    <View className={`impromptu-training-page theme-${effectiveTheme}`}>
      <View className='page-header'>
        <View className='header-left' onClick={handleBack}>
          <Text className='back-icon'>‹</Text>
          <Text className='back-text'>训练</Text>
        </View>
        <Text className='page-title'>即兴训练</Text>
        <View className='header-placeholder' />
      </View>

      <ScrollView scrollY className={`page-scroll ${selectedActions.length > 0 ? 'with-selection' : ''}`}>
        <View className='quick-panel'>
          <View className='quick-title-row'>
            <View>
              <Text className='quick-kicker'>自由记录</Text>
              <Text className='quick-title'>选动作，马上开练</Text>
              <Text className='quick-subtitle'>
                {actionSourceStats.mine > 0
                  ? `我的 ${actionSourceStats.mine} 个 · 公共 ${actionSourceStats.public} 个`
                  : '没有自己的动作也可以直接用公共动作'}
              </Text>
            </View>
            <View className='library-link' onClick={() => Taro.navigateTo({ url: '/me/action-lib?tab=public' })}>
              <Text>动作库</Text>
            </View>
          </View>

          <View className='search-box'>
            <Text className='search-icon'>⌕</Text>
            <Input
              className='search-input'
              value={keyword}
              placeholder='搜索动作'
              placeholderClass='search-placeholder'
              confirmType='search'
              onInput={e => setKeyword(e.detail.value)}
            />
            {!!keyword && (
              <View className='clear-search' onClick={() => setKeyword('')}>
                <Text>×</Text>
              </View>
            )}
          </View>

          {selectedActions.length > 0 && (
            <View className='selected-strip'>
              {selectedActions.map(action => (
                <View key={action.id} className='selected-chip' onClick={() => removeSelectedAction(action.id)}>
                  <Text className='chip-name'>{getActionName(action)}</Text>
                  <Text className='chip-remove'>×</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View className='action-list'>
          {loadingActions && (
            <View className='state-block'>
              <Text>正在加载动作...</Text>
            </View>
          )}

          {!loadingActions && filteredActions.length === 0 && (
            <View className='state-block'>
              <Text>{keyword ? '没有匹配动作' : '暂时没有可用力量动作'}</Text>
              <View className='state-action' onClick={() => Taro.navigateTo({ url: '/me/action-lib?tab=public' })}>
                <Text>去公共动作库看看</Text>
              </View>
            </View>
          )}

          {!loadingActions && filteredActions.map(action => {
            const selected = selectedIdSet.has(action.id)
            const startingThisAction = startingKey === action.id
            return (
              <View key={action.id} className='action-row'>
                <View className='action-main' onClick={() => toggleSelectedAction(action)}>
                  <View className='action-name-line'>
                    <Text className='action-name'>{getActionName(action)}</Text>
                    <Text className={`source-pill ${action.source === 'public' ? 'public' : 'mine'}`}>
                      {action.source === 'public' ? '公共' : '我的'}
                    </Text>
                  </View>
                  <Text className='action-meta'>{getActionMeta(action)}</Text>
                  {action.source === 'public' && (
                    <Text className='action-extra'>
                      {action.url ? '有演示' : '公共动作'}{typeof action.like_count === 'number' ? ` · ${action.like_count}赞` : ''}
                    </Text>
                  )}
                </View>
                <View className='row-actions'>
                  <View
                    className={`select-btn ${selected ? 'selected' : ''}`}
                    onClick={() => toggleSelectedAction(action)}
                  >
                    <Text>{selected ? '已选' : '加入'}</Text>
                  </View>
                  <View
                    className={`start-btn ${startingKey ? 'disabled' : ''}`}
                    onClick={() => startWithActions([action], action.id)}
                  >
                    <Text>{startingThisAction ? '开始中' : '开始'}</Text>
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      </ScrollView>

      {selectedActions.length > 0 && (
        <View className='selection-footer'>
          <View className='selection-summary'>
            <Text className='selection-count'>{selectedActions.length}</Text>
            <Text className='selection-label'>个动作</Text>
          </View>
          <View
            className={`selection-start ${startingKey ? 'disabled' : ''}`}
            onClick={() => startWithActions(selectedActions, 'selected')}
          >
            <Text>{startingKey === 'selected' ? '开始中' : '开始本次训练'}</Text>
          </View>
        </View>
      )}
    </View>
  )
}
