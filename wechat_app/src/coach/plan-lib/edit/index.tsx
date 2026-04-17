import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import PlanEditorWorkbench from '@/components/PlanEditorWorkbench'
import { actionLibService } from '@/services/coach/actionLibService'
import { coachService } from '@/services/coach/coachService'
import { planLibService } from '@/services/coach/planLibService'
import type { PlanActionOption, PlanEditorValue, PlanQuestionItem } from '@/types/plan'

export default function CoachPlanLibEdit() {
  const templateId = Taro.getCurrentInstance().router?.params?.id || ''
  const [actions, setActions] = useState<PlanActionOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [initialValue, setInitialValue] = useState<Partial<PlanEditorValue> | null>(null)

  useEffect(() => {
    if (!templateId) {
      Taro.showToast({ title: '缺少模板参数', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 500)
      return
    }
    void loadData()
  }, [templateId])

  const loadData = async () => {
    try {
      setLoading(true)
      const [actionsRes, templateRes] = await Promise.all([
        actionLibService.listActions({ page: 1, limit: 500 }),
        planLibService.getTemplate(templateId)
      ])

      setActions((actionsRes?.actions || []).map((action: any) => ({
        ...action,
        enableAutoWeightCompute: action.enableAutoWeightCompute ?? action.enable_auto_weight_compute ?? null
      })))

      if (!templateRes?.template) {
        throw new Error('template not found')
      }

      setInitialValue({
        name: templateRes.template.name || '',
        description: templateRes.template.description || '',
        tags: templateRes.template.tags || [],
        suitableFor: templateRes.template.suitable_for || 'beginner',
        type: templateRes.template.type || '',
        weekDays: templateRes.template.week_days || templateRes.template.weekDays || [],
        globalAnswers: templateRes.template.global_answers || templateRes.template.globalAnswers || {},
        days: templateRes.days || []
      })
    } catch (error) {
      console.error('[coach/plan-lib/edit] load failed:', error)
      Taro.showToast({ title: '模板加载失败', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 500)
    } finally {
      setLoading(false)
    }
  }

  const loadQuestionnaires = async (): Promise<PlanQuestionItem[]> => {
    const res = await coachService.getQuestionnaires()
    return Array.isArray((res as any)?.questionnaires) ? (res as any).questionnaires : []
  }

  const handleSave = async (value: PlanEditorValue) => {
    try {
      setSaving(true)
      const res = await planLibService.updateTemplate({
        id: templateId,
        name: value.name,
        description: value.description || null,
        tags: value.tags,
        suitableFor: value.suitableFor,
        type: value.type || null,
        weekDays: value.weekDays,
        globalAnswers: value.globalAnswers,
        trainingDays: value.days
      })
      if (!res) throw new Error('update template failed')
      Taro.showToast({ title: '模板已更新', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 600)
    } catch (error) {
      console.error('[coach/plan-lib/edit] save failed:', error)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <PlanEditorWorkbench
      mode='coach-template'
      title='编辑计划模板'
      subtitle='继续完善模板结构、问卷联动与多类型条目'
      initialValue={initialValue}
      actions={actions}
      loading={loading}
      saving={saving}
      saveLabel='保存模板'
      onCancel={() => Taro.navigateBack()}
      onSave={handleSave}
      loadQuestionnaires={loadQuestionnaires}
    />
  )
}
