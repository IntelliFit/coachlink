import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import PlanEditorWorkbench from '@/components/PlanEditorWorkbench'
import { authService } from '@/services/authService'
import { studentActionLibService } from '@/services/studentActionLibService'
import { studentPlanLibService } from '@/services/studentPlanLibService'
import { studentService } from '@/services/studentService'
import type { PlanActionOption, PlanEditorValue } from '@/types/plan'
import { useTheme } from '@/hooks/useTheme'

export default function StudentPlanLibCreate() {
  const { effectiveTheme } = useTheme()
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
        url: '/auth/login?returnTo=' + encodeURIComponent('/me/plan-lib/create/index')
      })
      return
    }
    void loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const user = authService.getCurrentUser()
      const [actionsRes, draftRes, profileRes, oneRMRes] = await Promise.all([
        studentActionLibService.listActions({ page: 1, limit: 1000, search: '' }),
        studentPlanLibService.generateAiDraftFromProfile({ days: 7 }).catch(() => null),
        user?.id ? studentService.getStudentProfile(user.id).catch(() => null) : Promise.resolve(null),
        studentService.getCurrent1RM().catch(() => null)
      ])

      const nextActions = (actionsRes?.actions || []).map((action: any) => ({
        ...action,
        enableAutoWeightCompute: action.enableAutoWeightCompute ?? action.enable_auto_weight_compute ?? null,
        includesBodyWeight: action.includesBodyWeight ?? action.includes_body_weight ?? null
      }))
      setActions(nextActions)
      setStudentProfile(profileRes?.profile || null)
      setOneRMRecords(oneRMRes?.records || [])

      if (draftRes?.trainingDays?.length) {
        setInitialValue({
          name: draftRes.name || 'AI 生成入门计划',
          description: draftRes.description || '',
          days: draftRes.trainingDays || []
        })
      } else {
        setInitialValue(null)
      }
    } catch (error) {
      console.error('[me/plan-lib/create] load failed:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
      setActions([])
      setStudentProfile(null)
      setOneRMRecords([])
      setInitialValue(null)
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
      await studentPlanLibService.saveFavorite({
        name: value.name,
        description: value.description || null,
        tags: value.tags,
        suitable_for: value.suitableFor,
        training_days: value.days.map((day) => ({
          ...day,
          actionSetsCount: day.actionSets.length
        }))
      })
      Taro.showToast({ title: '计划已创建', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 600)
    } catch (error) {
      console.error('[me/plan-lib/create] save failed:', error)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <PlanEditorWorkbench
      mode='student-favorite'
      title='创建常用计划'
      subtitle='支持 AI 草稿、智能导入、批量动作处理和多类型条目'
      initialValue={initialValue}
      actions={actions}
      loading={loading}
      saving={saving}
      saveLabel='保存计划'
      studentProfile={studentProfile}
      oneRMRecords={oneRMRecords}
      withBottomNav
      onCancel={() => Taro.navigateBack()}
      onSave={handleSave}
      onImportText={handleImportText}
    />
  )
}
