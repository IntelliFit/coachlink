import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import PlanEditorWorkbench from '@/components/PlanEditorWorkbench'
import { actionLibService } from '@/services/coach/actionLibService'
import { planLibService } from '@/services/coach/planLibService'
import type { PlanActionOption, PlanEditorValue } from '@/types/plan'

export default function CoachPlanLibCreate() {
  const [actions, setActions] = useState<PlanActionOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({ url: '/auth/login?returnTo=' + encodeURIComponent('/coach/plan-lib/create') })
      return
    }
    void loadActions()
  }, [])

  const loadActions = async () => {
    try {
      setLoading(true)
      const res = await actionLibService.listActions({ page: 1, limit: 500 })
      setActions((res?.actions || []).map((action: any) => ({
        ...action,
        enableAutoWeightCompute: action.enableAutoWeightCompute ?? action.enable_auto_weight_compute ?? null
      })))
    } catch (error) {
      console.error('[coach/plan-lib/create] load actions failed:', error)
      Taro.showToast({ title: '动作库加载失败', icon: 'none' })
      setActions([])
    } finally {
      setLoading(false)
    }
  }

  const handleImportText = async (text: string, importActions: PlanActionOption[]) => {
    return planLibService.parseTemplate(text, importActions)
  }

  const handleSave = async (value: PlanEditorValue) => {
    try {
      setSaving(true)
      const res = await planLibService.createTemplate({
        name: value.name,
        description: value.description || null,
        executionNotice: value.executionNotice || null,
        tags: value.tags,
        suitableFor: value.suitableFor,
        type: value.type || null,
        weekDays: value.weekDays,
        globalAnswers: value.globalAnswers,
        trainingDays: value.days
      })
      if (!res) throw new Error('create template failed')
      Taro.showToast({ title: '模板已创建', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 600)
    } catch (error) {
      console.error('[coach/plan-lib/create] save failed:', error)
      Taro.showToast({ title: '创建失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <PlanEditorWorkbench
      mode='coach-template'
      title='新建计划模板'
      subtitle='统一编辑力量 / 有氧 / 饮食 / 习惯四类条目'
      actions={actions}
      loading={loading}
      saving={saving}
      saveLabel='创建模板'
      onCancel={() => Taro.navigateBack()}
      onSave={handleSave}
      onImportText={handleImportText}
    />
  )
}
