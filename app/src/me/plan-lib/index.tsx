import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { authService } from '@/services/authService'
import { studentActionLibService } from '@/services/studentActionLibService'
import { studentPlanLibService } from '@/services/studentPlanLibService'
import './index.scss'

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
  enableAutoWeightCompute?: boolean
  attrs?: string[]
}

export default function PlanLibPage() {
  const [favorites, setFavorites] = useState<PlanFavorite[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [applyingId, setApplyingId] = useState<string | null>(null)

  // 1RM配置相关状态
  const [showOneRMDialog, setShowOneRMDialog] = useState(false)
  const [currentFavorite, setCurrentFavorite] = useState<PlanFavorite | null>(null)
  const [oneRMConfig, setOneRMConfig] = useState<Record<string, number>>({})

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
          enableAutoWeightCompute: a.enable_auto_weight_compute || 
            (Array.isArray(a.attrs) && a.attrs.includes('强度'))
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

  // 获取计划中需要配置1RM的动作
  const getRelevantActions = (favorite: PlanFavorite) => {
    const trainingDays = favorite.training_days || []
    const usedActionIds = new Set<string>()
    
    trainingDays.forEach((day: any) => {
      (day.actionSets || []).forEach((set: any) => {
        const actionId = set.actionId || set.action_id
        if (actionId) usedActionIds.add(actionId)
      })
    })

    return actions.filter(action => {
      const isUsed = usedActionIds.has(action.id)
      const canConfigureOneRM = action.enableAutoWeightCompute || 
        (Array.isArray(action.attrs) && action.attrs.includes('强度'))
      return isUsed && canConfigureOneRM
    })
  }

  // 处理应用计划
  const handleApply = async (favorite: PlanFavorite) => {
    const relevantActions = getRelevantActions(favorite)
    
    // 如果没有需要配置1RM的动作，直接应用
    if (relevantActions.length === 0) {
      doApply(favorite.id)
      return
    }

    // 有需要配置1RM的动作，显示配置弹窗
    setCurrentFavorite(favorite)
    setOneRMConfig({})
    setShowOneRMDialog(true)
  }

  // 执行应用计划
  const doApply = async (favoriteId: string, oneRMConfig?: Record<string, number>) => {
    setApplyingId(favoriteId)
    try {
      const res = await studentPlanLibService.applyFavorite(favoriteId, oneRMConfig)
      if (res) {
        Taro.showToast({ title: '计划已激活', icon: 'success' })
        setTimeout(() => {
          Taro.switchTab({ url: '/training/today-training' })
        }, 800)
      }
    } catch (error) {
      Taro.showToast({ title: '应用失败', icon: 'none' })
    } finally {
      setApplyingId(null)
    }
  }

  // 确认1RM配置并应用
  const handleConfirmOneRM = () => {
    if (!currentFavorite) return
    setShowOneRMDialog(false)
    doApply(currentFavorite.id, oneRMConfig)
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
        <View className='dialog-overlay' onClick={() => setShowOneRMDialog(false)} />
        <View className='dialog-content'>
          <View className='dialog-header'>
            <Text className='dialog-title'>应用计划 - 1RM配置</Text>
            <Text className='dialog-close' onClick={() => setShowOneRMDialog(false)}>✕</Text>
          </View>
          <ScrollView className='dialog-body' scrollY>
            <Text className='dialog-desc'>
              在应用「{currentFavorite.name}」前，请先设置以下动作的1RM值，这将用于自动计算训练负荷
            </Text>
            <View className='onerm-list'>
              {relevantActions.map(action => (
                <View key={action.id} className='onerm-item'>
                  <Text className='onerm-name'>{action.name}</Text>
                  <View className='onerm-input-wrapper'>
                    <Input
                      className='onerm-input'
                      type='digit'
                      placeholder='输入1RM'
                      value={oneRMConfig[action.id] ? String(oneRMConfig[action.id]) : ''}
                      onInput={e => {
                        const val = e.detail.value === '' ? 0 : parseFloat(e.detail.value)
                        setOneRMConfig(prev => ({ ...prev, [action.id]: val }))
                      }}
                    />
                    <Text className='onerm-unit'>kg</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
          <View className='dialog-footer'>
            <View className='btn-secondary' onClick={() => setShowOneRMDialog(false)}>
              <Text>跳过</Text>
            </View>
            <View className='btn-primary' onClick={handleConfirmOneRM}>
              <Text>确认应用</Text>
            </View>
          </View>
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View className='plan-lib-page'>
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
    <View className='plan-lib-page'>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          <View className='page-header'>
            <View className='header-left'>
              <Text className='page-title'>常用计划库</Text>
              <Text className='page-subtitle'>Plan Library</Text>
            </View>
            <View className='create-btn' onClick={handleCreate}>
              <Text className='create-icon'>+</Text>
              <Text className='create-text'>新建</Text>
            </View>
          </View>

          {favorites.length === 0 ? (
            <View className='empty-state'>
              <View className='empty-icon'>📚</View>
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
                          <Text className='meta-icon'>📅</Text>
                          <Text className='meta-text'>{dayCount} 训练日</Text>
                        </View>
                        <View className='meta-item'>
                          <Text className='meta-icon'>🕐</Text>
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
