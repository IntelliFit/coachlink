import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { actionLibService } from '@/services/coach/actionLibService'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useTheme } from '@/hooks/useTheme'

function CoachActionLib() {
  const { effectiveTheme } = useTheme()
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({ url: '/auth/login?returnTo=' + encodeURIComponent('/coach/action-lib') })
      return
    }
    loadList()
  }, [])

  async function loadList() {
    try {
      setLoading(true)
      const res = await actionLibService.listActions({ page: 1, limit: 50 })
      const data = res as any
      if (data?.actions) setList(data.actions)
      else setList([])
    } catch (e) {
      console.error('[coach/action-lib] load:', e)
      setList([])
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  function handleCreate() {
    Taro.navigateTo({ url: '/coach/action-lib/edit' })
  }

  function handleEdit(action: any) {
    Taro.navigateTo({ url: `/coach/action-lib/edit?id=${action.id}` })
  }

  async function handleDelete(action: any) {
    const res = await Taro.showModal({
      title: '确认删除',
      content: `确定要删除动作"${action.name || '未命名'}"吗？此操作无法撤销。`,
      confirmText: '删除',
      confirmColor: '#ff4444'
    })
    if (res.confirm) {
      try {
        const deleteRes = await actionLibService.deleteAction({ id: action.id })
        if (deleteRes?.success) {
          Taro.showToast({ title: '删除成功', icon: 'success' })
          loadList()
        } else {
          Taro.showToast({ title: deleteRes?.message || '删除失败', icon: 'none' })
        }
      } catch (e) {
        console.error('[coach/action-lib] delete:', e)
        Taro.showToast({ title: '删除失败', icon: 'none' })
      }
    }
  }

  return (
    <View className={`coach-action-lib-page theme-${effectiveTheme}`}>
      <View className="header">
        <Text className="title">动作库</Text>
        <Button className="add-btn" onClick={handleCreate}>+ 新建</Button>
      </View>
      {loading ? (
        <View className="loading-wrap"><LoadingSpinner size={48} /></View>
      ) : list.length === 0 ? (
        <View className="empty-wrap">暂无动作</View>
      ) : (
        <ScrollView scrollY className="action-list">
          {list.map((a) => (
            <View key={a.id} className="action-card">
              <View className="card-content" onClick={() => handleEdit(a)}>
                <Text className="name">{a.name || '未命名'}</Text>
                <Text className="meta">{a.type || '动作'} · {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}</Text>
              </View>
              <View className="card-actions">
                <Button className="edit-btn" onClick={() => handleEdit(a)}>编辑</Button>
                <Button className="delete-btn" onClick={() => handleDelete(a)}>删除</Button>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
      <BottomNav />
    </View>
  )
}

export default CoachActionLib
