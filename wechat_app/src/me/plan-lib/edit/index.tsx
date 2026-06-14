import { useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import PlanEditorWorkbench from '@/components/PlanEditorWorkbench'
import { authService } from '@/services/authService'
import { studentActionLibService } from '@/services/studentActionLibService'
import { studentPlanLibService } from '@/services/studentPlanLibService'
import { studentService } from '@/services/studentService'
import type { PlanActionOption, PlanEditorValue } from '@/types/plan'
import { useTheme } from '@/hooks/useTheme'

export default function StudentPlanLibEdit() {
  const { effectiveTheme } = useTheme()
  const router = useRouter()
  const favoriteId = String(router.params.id || '')
  const [actions, setActions] = useState<PlanActionOption[]>([])
  const [initialValue, setInitialValue] = useState<Partial<PlanEditorValue> | null>(null)
  const [studentProfile, setStudentProfile] = useState<Record<string, any> | null>(null)
  const [oneRMRecords, setOneRMRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const user = authService.getCurrentUser()
    if (!user?.id) {
      Taro.redirectTo({
        url: '/auth/login?returnTo=' + encodeURIComponent('/me/plan-lib/edit/index?id=' + favoriteId)
      })
      return
    }
    if (!favoriteId) {
      Taro.showToast({ title: '缺少计划参数', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 500)
      return
    }
    void loadData()
  }, [favoriteId])

  const loadData = async () => {
    try {
      setLoading(true)
      const user = authService.getCurrentUser()
      const [actionsRes, favoriteRes, profileRes, oneRMRes] = await Promise.all([
        studentActionLibService.listActions({ page: 1, limit: 1000, search: '' }),
        studentPlanLibService.getFavorite(favoriteId),
        user?.id ? studentService.getStudentProfile(user.id).catch(() => null) : Promise.resolve(null),
        studentService.getCurrent1RM().catch(() => null)
      ])

      setActions((actionsRes?.actions || []).map((action: any) => ({
        ...action,
        enableAutoWeightCompute: action.enableAutoWeightCompute ?? action.enable_auto_weight_compute ?? null,
        includesBodyWeight: action.includesBodyWeight ?? action.includes_body_weight ?? null
      })))
      setStudentProfile(profileRes?.profile || null)
      setOneRMRecords(oneRMRes?.records || [])

      if (!favoriteRes?.favorite) {
        throw new Error('favorite not found')
      }

      setInitialValue({
        name: favoriteRes.favorite.name || '',
        description: favoriteRes.favorite.description || '',
        tags: favoriteRes.favorite.tags || [],
        suitableFor: favoriteRes.favorite.suitable_for || 'beginner',
        days: favoriteRes.favorite.training_days || []
      })
    } catch (error) {
      console.error('[me/plan-lib/edit] load failed:', error)
      Taro.showToast({ title: '计划加载失败', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 500)
    } finally {
      setLoading(false)
    }
  }

  const handleImportText = async (text: string, currentActions: PlanActionOption[]) => {
    const res = await studentPlanLibService.parseTemplate(
      text,
      currentActions.map((action) => ({
        id: action.id,
        name: action.name,
        type: action.type || undefined,
        attrs: action.attrs || undefined
      }))
    )
    if (!res) return null
    return {
      trainingDays: res.trainingDays || [],
      globalDescription: res.globalDescription || ''
    }
  }

  const handleSave = async (value: PlanEditorValue) => {
    try {
      setSaving(true)
      await studentPlanLibService.updateFavorite(favoriteId, {
        name: value.name,
        description: value.description || null,
        tags: value.tags,
        suitable_for: value.suitableFor,
        training_days: value.days.map((day) => ({
          ...day,
          actionSetsCount: day.actionSets.length
        }))
      })
      Taro.showToast({ title: '计划已更新', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 600)
    } catch (error) {
      console.error('[me/plan-lib/edit] save failed:', error)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <PlanEditorWorkbench
      mode='student-favorite'
      title='编辑常用计划'
      subtitle='继续调整训练结构、批量替换动作和导入文本计划'
      initialValue={initialValue}
      actions={actions}
      loading={loading}
      saving={saving}
      saveLabel='保存更新'
      studentProfile={studentProfile}
      oneRMRecords={oneRMRecords}
      withBottomNav
      onCancel={() => Taro.navigateBack()}
      onSave={handleSave}
      onImportText={handleImportText}
    />
  )
}
