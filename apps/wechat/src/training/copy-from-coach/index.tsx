import React, { useState, useCallback } from 'react'
import { WECHAT_FREE_RELEASE } from '@coachlink/core'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { listCoachActions, copyCoachAction, handleApiError } from '@/services/actionLibPageService'
import type { CoachActionWithAdded } from '@/types/action'
import { TYPE_META } from '@/constants/action'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

export default function CopyFromCoachPage() {
  const { effectiveTheme } = useTheme()
  const [actions, setActions] = useState<CoachActionWithAdded[]>([])
  const [coachName, setCoachName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copyingId, setCopyingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await listCoachActions()
      if (res) {
        setActions(res.actions || [])
        setCoachName(res.coachName || null)
      } else {
        setActions([])
      }
    } catch (e) {
      console.error('加载教练动作库失败:', e)
      setError((e as Error).message || '加载失败，请重试')
      setActions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    load()
  })

  usePullDownRefresh(() => {
    load().finally(() => Taro.stopPullDownRefresh())
  })

  const onCopy = useCallback(
    async (action: CoachActionWithAdded) => {
      if (action.isAdded) return
      setCopyingId(action.id)
      try {
        await copyCoachAction(action.id)
        Taro.showToast({ title: '已添加到我的动作库', icon: 'success' })
        setActions(prev =>
          prev.map(a => (a.id === action.id ? { ...a, isAdded: true } : a))
        )
      } catch (e) {
        handleApiError(e, '添加失败')
      } finally {
        setCopyingId(null)
      }
    },
    []
  )

  const typeKey = (type?: string) => (type && TYPE_META[type] ? type : 'STRENGTH') as keyof typeof TYPE_META

  if (loading && actions.length === 0) {
    return (
      <View className={`copy-from-coach-page theme-${effectiveTheme}`}>
        <View className="skeleton-card">
          <View className="skeleton-line skeleton-title" />
          <View className="skeleton-line skeleton-subtitle" />
        </View>
        <View className="skeleton-card">
          <View className="skeleton-line skeleton-title" />
          <View className="skeleton-line skeleton-subtitle" />
        </View>
      </View>
    )
  }

  if (error && actions.length === 0) {
    return (
      <View className={`copy-from-coach-page theme-${effectiveTheme}`}>
        <View className="error-wrap">
          <Text className="empty-desc">{error}</Text>
          <Text className="retry-btn" onClick={() => load()}>
            重试
          </Text>
        </View>
      </View>
    )
  }

  if (actions.length === 0) {
    return (
      <View className={`copy-from-coach-page theme-${effectiveTheme}`}>
        <Text className="header-hint">选择现有教练分享的动作，一键复制到我的动作库</Text>
        <View className="empty-wrap">
          <Text className="empty-title">暂无教练动作</Text>
          <Text className="empty-desc">{WECHAT_FREE_RELEASE ? '此处仅提供现有教练服务内的共享动作，新购服务暂未开放' : '订阅教练后，可在此处添加教练分享的动作'}</Text>
        </View>
      </View>
    )
  }

  return (
    <View className={`copy-from-coach-page theme-${effectiveTheme}`}>
      <Text className="header-hint">选择现有教练分享的动作，一键复制到我的动作库</Text>
      {coachName && <Text className="coach-name">教练：{coachName}</Text>}
      {actions.map(a => {
        const meta = TYPE_META[typeKey(a.type)] || TYPE_META.STRENGTH
        const positions = a.positions || []
        return (
          <View key={a.id} className="action-card">
            <Text className="action-name">{a.name}</Text>
            <Text className="action-detail">{a.detail || '暂无描述'}</Text>
            <View className="action-tags">
              <Text className={`tag ${meta.className}`}>{meta.label}</Text>
              {positions.slice(0, 4).map((pos, i) => (
                <Text key={i} className="tag">
                  {pos}
                </Text>
              ))}
            </View>
            <View
              className={`btn-copy ${a.isAdded || copyingId === a.id ? 'disabled' : ''}`}
              onClick={() => !a.isAdded && copyingId !== a.id && onCopy(a)}
            >
              {a.isAdded ? '已添加' : copyingId === a.id ? '添加中...' : '复制到我的动作库'}
            </View>
          </View>
        )
      })}
    </View>
  )
}
