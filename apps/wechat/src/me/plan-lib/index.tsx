import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { authService } from '@/services/authService'
import { studentActionLibService } from '@/services/studentActionLibService'
import { studentPlanLibService } from '@/services/studentPlanLibService'
import './index.scss'
import { Book, Calendar, Clock, Close } from '@nutui/icons-react-taro'
import { useTheme } from '@/hooks/useTheme'
import { StableInput as Input } from '@/components/StableInput'
import { collectPlanOneRMActionIds, isOneRMEligibleAction } from '@coachlink/core/src/actionLoadMode'

interface PlanFavorite {
  id: string
  name: string
  description?: string
  training_days?: any[]
  updated_at: string
}

interface Action {
  id: string
  name: string
  type?: string | null
  enableAutoWeightCompute?: boolean | null
  attrs?: string[] | null
  reference_1rm?: number | null
}

const positiveOneRM = (value: unknown) => {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : null
}

export default function PlanLibPage() {
  const { effectiveTheme } = useTheme()
  const [favorites, setFavorites] = useState<PlanFavorite[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [applyingId, setApplyingId] = useState<string | null>(null)

  // 1RM配置相关状态
  const [showOneRMDialog, setShowOneRMDialog] = useState(false)
  const [currentFavorite, setCurrentFavorite] = useState<PlanFavorite | null>(null)
  const [oneRMInputs, setOneRMInputs] = useState<Record<string, string>>({})

  const loadFavorites = useCallback(async () => {
    try {
      setLoading(true)
      const userId = authService.getCurrentUser()?.id
      if (!userId) {
        Taro.showToast({ title: '请先登录', icon: 'none' })
        return
      }

      const [favoritesRes, actionsRes] = await Promise.all([
        studentPlanLibService.listFavorites({ page: 1, limit: 50 }),
        studentActionLibService.listActions({ page: 1, limit: 500 })
      ])

      if (favoritesRes?.favorites) {
        setFavorites(favoritesRes.favorites)
      }

      if (actionsRes?.actions) {
        setActions(actionsRes.actions.map((a: any) => ({
          ...a,
          enableAutoWeightCompute: a.enableAutoWeightCompute ?? a.enable_auto_weight_compute ?? null
        })))
      }
    } catch (error) {
      console.error('加载数据失败:', error)
      Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadFavorites()
  })

  usePullDownRefresh(() => {
    loadFavorites().finally(() => Taro.stopPullDownRefresh())
  })

  const handleCreate = () => {
    Taro.navigateTo({ url: '/me/plan-lib/create/index' })
  }

  const handleEdit = (id: string) => {
    Taro.navigateTo({ url: `/me/plan-lib/edit/index?id=${id}` })
  }

  // 只有按 RM / %1RM 安排重量、且服务端允许保存 1RM 的动作才需要 1RM；
  // 死虫、俯卧撑这类自重/核心动作，或只写 RPE 的计划，不会弹窗。
  const getRelevantActions = (favorite: PlanFavorite) => {
    const usedActionIds = collectPlanOneRMActionIds(favorite.training_days)
    return actions.filter(action => usedActionIds.has(action.id) && isOneRMEligibleAction(action))
  }

  const handleApply = (favorite: PlanFavorite) => {
    const relevantActions = getRelevantActions(favorite)
    const missingOneRM = relevantActions.some(action => positiveOneRM(action.reference_1rm) === null)
    if (!missingOneRM) {
      doApply(favorite.id)
      return
    }

    setCurrentFavorite(favorite)
    setOneRMInputs(relevantActions.reduce<Record<string, string>>((inputs, action) => {
      const known = positiveOneRM(action.reference_1rm)
      return { ...inputs, [action.id]: known === null ? '' : String(known) }
    }, {}))
    setShowOneRMDialog(true)
  }

  // 1RM 由服务端在开始训练时从动作库读取，应用接口本身不接收 1RM
  const doApply = async (favoriteId: string) => {
    setApplyingId(favoriteId)
    try {
      const res = await studentPlanLibService.applyFavorite(favoriteId)
      if (res) {
        Taro.showToast({ title: '计划已激活', icon: 'success' })
        setTimeout(() => {
          Taro.reLaunch({ url: '/pages/index/index' })
        }, 800)
      } else {
        Taro.showToast({ title: '应用失败', icon: 'none' })
      }
    } catch (error) {
      console.error('应用计划失败:', error)
      Taro.showToast({ title: '应用失败', icon: 'none' })
    } finally {
      setApplyingId(null)
    }
  }

  const saveOneRMInputs = async (favorite: PlanFavorite) => {
    const updates = getRelevantActions(favorite)
      .map(action => ({ action, value: positiveOneRM(oneRMInputs[action.id]) }))
      .filter(({ action, value }) => value !== null && value !== positiveOneRM(action.reference_1rm))
      .map(({ action, value }) => ({ actionId: action.id, reference1RM: value }))
    if (updates.length === 0) return
    try {
      await studentActionLibService.batchUpdate1RM(updates)
    } catch (error) {
      console.error('保存1RM失败:', error)
      Taro.showToast({ title: '1RM 未保存，可稍后在动作库补填', icon: 'none' })
    }
  }

  const closeOneRMDialog = () => setShowOneRMDialog(false)

  const handleConfirmOneRM = async () => {
    if (!currentFavorite) return
    setShowOneRMDialog(false)
    setApplyingId(currentFavorite.id)
    await saveOneRMInputs(currentFavorite)
    doApply(currentFavorite.id)
  }

  const handleSkipOneRM = () => {
    if (!currentFavorite) return
    setShowOneRMDialog(false)
    doApply(currentFavorite.id)
  }

  const handleDelete = async (id: string) => {
    const res = await Taro.showModal({
      title: '删除确认',
      content: '确定要删除此训练模板吗？'
    })
    if (res.confirm) {
      try {
        await studentPlanLibService.deleteFavorite(id)
        Taro.showToast({ title: '删除成功', icon: 'success' })
        loadFavorites()
      } catch (error) {
        Taro.showToast({ title: '删除失败', icon: 'none' })
      }
    }
  }

  // 1RM配置弹窗
  const renderOneRMDialog = () => {
    if (!showOneRMDialog || !currentFavorite) return null

    const relevantActions = getRelevantActions(currentFavorite)

    return (
      <View className='onerm-dialog'>
        <View className='dialog-overlay' onClick={closeOneRMDialog} />
        <View className='dialog-content'>
          <View className='dialog-header'>
            <View className='dialog-heading'>
              <Text className='dialog-title'>填写 1RM（选填）</Text>
              <Text className='dialog-subtitle'>{currentFavorite.name}</Text>
            </View>
            <View className='dialog-close' onClick={closeOneRMDialog}><Close /></View>
          </View>
          <ScrollView className='dialog-body' scrollY>
            <Text className='dialog-desc'>
              这些动作按 RM / %1RM 安排重量。填了 1RM，训练时会自动算出每组重量；不填也能开始，训练时自己填重量即可。
            </Text>
            <View className='onerm-list'>
              {relevantActions.map(action => (
                <View key={action.id} className='onerm-item'>
                  <Text className='onerm-name'>{action.name}</Text>
                  <View className='onerm-input-wrapper'>
                    <Input
                      className='onerm-input'
                      type='digit'
                      placeholder='未填写'
                      value={oneRMInputs[action.id] || ''}
                      onInput={e => {
                        const value = e.detail.value
                        setOneRMInputs(prev => ({ ...prev, [action.id]: value }))
                      }}
                    />
                    <Text className='onerm-unit'>kg</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
          <View className='dialog-footer'>
            <View className='btn-secondary' onClick={handleSkipOneRM}>
              <Text>跳过，直接应用</Text>
            </View>
            <View className='btn-primary' onClick={handleConfirmOneRM}>
              <Text>保存并应用</Text>
            </View>
          </View>
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View className={`plan-lib-page theme-${effectiveTheme}`}>
        <ScrollView className='page-scroll' scrollY>
          <View className='loading-container'>
            {[1, 2, 3].map(i => (
              <View key={i} className='skeleton-card'>
                <View className='skeleton-line' />
                <View className='skeleton-line' />
              </View>
            ))}
          </View>
        </ScrollView>
        <BottomNav />
      </View>
    )
  }

  return (
    <View className={`plan-lib-page theme-${effectiveTheme}`}>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          <View className='page-header'>
            <View className='header-left'>
              <Text className='page-title'>训练计划</Text>
              <Text className='page-subtitle'>管理常用计划，随时编辑或应用到今日训练</Text>
            </View>
            <View className='create-btn' onClick={handleCreate}>
              <Text className='create-icon'>+</Text>
              <Text className='create-text'>新建</Text>
            </View>
          </View>

          {favorites.length === 0 ? (
            <View className='empty-state'>
              <View className='empty-icon'><Book /></View>
              <Text className='empty-title'>空空如也</Text>
              <Text className='empty-desc'>还没有收藏任何训练计划模板</Text>
              <View className='empty-btn' onClick={handleCreate}>
                <Text>创建第一个计划</Text>
              </View>
            </View>
          ) : (
            <View className='plans-list'>
              {favorites.map((fav) => {
                const dayCount = Array.isArray(fav.training_days) ? fav.training_days.length : 0
                const isApplying = applyingId === fav.id
                
                return (
                  <View key={fav.id} className='plan-card'>
                    <View className='plan-content' onClick={() => handleEdit(fav.id)}>
                      <Text className='plan-name'>{fav.name}</Text>
                      <Text className='plan-desc'>{fav.description || '无描述文本'}</Text>
                      <View className='plan-meta'>
                        <View className='meta-item'>
                          <View className='meta-icon'><Calendar /></View>
                          <Text className='meta-text'>{dayCount} 训练日</Text>
                        </View>
                        <View className='meta-item'>
                          <View className='meta-icon'><Clock /></View>
                          <Text className='meta-text'>
                            {new Date(fav.updated_at).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View className='plan-actions'>
                      <View 
                        className={`action-btn apply ${isApplying ? 'loading' : ''}`}
                        onClick={() => !isApplying && handleApply(fav)}
                      >
                        <Text>{isApplying ? '应用中...' : '应用'}</Text>
                      </View>
                      <View className='action-btn delete' onClick={() => handleDelete(fav.id)}>
                        <Text>删除</Text>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* 1RM配置弹窗 */}
      {renderOneRMDialog()}
      
      <BottomNav />
    </View>
  )
}
