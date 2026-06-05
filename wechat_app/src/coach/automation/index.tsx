import React, { useEffect, useMemo, useState } from 'react'
import { Picker, ScrollView, Text, View } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { Bot, CheckCircle2, Clock3, FileEdit, RefreshCw, Save, XCircle } from 'lucide-react'
import { Icon } from '@/components/Icon'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { coachService } from '@/services/coach/coachService'
import './index.scss'

type Policy = {
  initialPlanMode: string
  feedbackAdjustmentMode: string
  nextPhaseMode: string
  riskGuardMode: string
}

const DEFAULT_POLICY: Policy = {
  initialPlanMode: 'auto_publish',
  feedbackAdjustmentMode: 'draft_notify',
  nextPhaseMode: 'draft_notify',
  riskGuardMode: 'strict'
}

const initialPlanOptions = [
  { value: 'auto_publish', label: '自动发放' },
  { value: 'draft', label: '生成草稿' },
  { value: 'off', label: '关闭' }
]

const feedbackOptions = [
  { value: 'draft_notify', label: '草稿并通知' },
  { value: 'auto_apply_low_risk', label: '低风险自动应用' },
  { value: 'auto_apply_safe', label: '安全反馈自动应用' },
  { value: 'off', label: '关闭' }
]

const nextPhaseOptions = [
  { value: 'draft_notify', label: '草稿并通知' },
  { value: 'auto_publish_if_credits', label: '额度足够自动发布' },
  { value: 'off', label: '关闭' }
]

const riskOptions = [
  { value: 'strict', label: '严格' },
  { value: 'normal', label: '普通' }
]

const statusMap: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: '待执行', className: 'muted', icon: Clock3 },
  running: { label: '执行中', className: 'info', icon: RefreshCw },
  succeeded: { label: '已完成', className: 'success', icon: CheckCircle2 },
  failed: { label: '失败', className: 'danger', icon: XCircle },
  needs_coach_review: { label: '待确认', className: 'warning', icon: FileEdit },
  skipped: { label: '已跳过', className: 'muted', icon: Clock3 }
}

function getLabel(options: Array<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label || options[0]?.label || ''
}

function getIndex(options: Array<{ value: string; label: string }>, value: string) {
  const index = options.findIndex((option) => option.value === value)
  return index >= 0 ? index : 0
}

function formatTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function PolicyPicker({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <View className='policy-row'>
      <Text className='policy-label'>{label}</Text>
      <Picker
        mode='selector'
        range={options.map((option) => option.label)}
        value={getIndex(options, value)}
        onChange={(event) => {
          const index = Number(event.detail.value || 0)
          onChange(options[index]?.value || options[0]?.value)
        }}
      >
        <View className='policy-value'>
          <Text>{getLabel(options, value)}</Text>
          <Text className='chevron'>›</Text>
        </View>
      </Picker>
    </View>
  )
}

function StatusBadge({ status }: { status: string }) {
  const meta = statusMap[status] || statusMap.pending
  return (
    <View className={`status-badge ${meta.className}`}>
      <Icon component={meta.icon} size={14} color='currentColor' />
      <Text>{meta.label}</Text>
    </View>
  )
}

function canApplyDraft(draft: any) {
  return Array.isArray(draft?.proposed_patch?.updatedTrainingDays)
}

export default function CoachAutomationPage() {
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY)
  const [source, setSource] = useState('default')
  const [jobs, setJobs] = useState<any[]>([])
  const [drafts, setDrafts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [applyingId, setApplyingId] = useState<string | null>(null)

  const pendingDrafts = useMemo(
    () => drafts.filter((draft) => draft?.status === 'draft'),
    [drafts]
  )

  async function loadData() {
    try {
      setLoading(true)
      const [policyRes, jobsRes] = await Promise.all([
        coachService.getAutomationPolicy(),
        coachService.getAutomationJobs({ limit: 30 })
      ])
      if (policyRes?.policy) {
        setPolicy({ ...DEFAULT_POLICY, ...policyRes.policy })
        setSource(policyRes.source || 'default')
      }
      if (jobsRes) {
        setJobs(jobsRes.jobs || [])
        setDrafts(jobsRes.drafts || [])
      }
    } catch (error) {
      console.error('[coach/automation] load failed:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  usePullDownRefresh(loadData)

  async function savePolicy() {
    try {
      setSaving(true)
      const res = await coachService.updateAutomationPolicy(policy)
      if (!res?.policy) throw new Error('save_failed')
      setPolicy({ ...DEFAULT_POLICY, ...res.policy })
      setSource('coach')
      Taro.showToast({ title: '已保存', icon: 'success' })
    } catch (error) {
      console.error('[coach/automation] save failed:', error)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  async function applyDraft(draftId: string) {
    try {
      setApplyingId(draftId)
      const res = await coachService.applyPlanAdjustmentDraft(draftId)
      if (!res) throw new Error('apply_failed')
      Taro.showToast({ title: '已应用', icon: 'success' })
      await loadData()
    } catch (error) {
      console.error('[coach/automation] apply draft failed:', error)
      Taro.showToast({ title: '应用失败', icon: 'none' })
    } finally {
      setApplyingId(null)
    }
  }

  if (loading) {
    return (
      <View className='automation-page'>
        <View className='loading-wrap'>
          <LoadingSpinner size={48} />
        </View>
      </View>
    )
  }

  return (
    <View className='automation-page'>
      <ScrollView scrollY className='automation-scroll'>
        <View className='header'>
          <View className='header-icon'>
            <Icon component={Bot} size={22} color='#CF6D4E' />
          </View>
          <View className='header-copy'>
            <Text className='title'>自动化设置</Text>
            <Text className='subtitle'>当前来源：{source === 'coach' ? '教练自定义' : '系统默认'}</Text>
          </View>
        </View>

        <View className='panel'>
          <Text className='panel-title'>教练全局策略</Text>
          <PolicyPicker
            label='首个计划'
            value={policy.initialPlanMode}
            options={initialPlanOptions}
            onChange={(value) => setPolicy((prev) => ({ ...prev, initialPlanMode: value }))}
          />
          <PolicyPicker
            label='反馈调整'
            value={policy.feedbackAdjustmentMode}
            options={feedbackOptions}
            onChange={(value) => setPolicy((prev) => ({ ...prev, feedbackAdjustmentMode: value }))}
          />
          <PolicyPicker
            label='下一阶段'
            value={policy.nextPhaseMode}
            options={nextPhaseOptions}
            onChange={(value) => setPolicy((prev) => ({ ...prev, nextPhaseMode: value }))}
          />
          <PolicyPicker
            label='风险保护'
            value={policy.riskGuardMode}
            options={riskOptions}
            onChange={(value) => setPolicy((prev) => ({ ...prev, riskGuardMode: value }))}
          />
          <View className={`save-btn ${saving ? 'disabled' : ''}`} onClick={saving ? undefined : savePolicy}>
            <Icon component={saving ? RefreshCw : Save} size={16} color='#FFFFFF' />
            <Text>{saving ? '保存中' : '保存设置'}</Text>
          </View>
        </View>

        <View className='panel'>
          <View className='panel-head'>
            <Text className='panel-title'>待确认草稿</Text>
            <Text className='panel-count'>{pendingDrafts.length}</Text>
          </View>
          {pendingDrafts.length === 0 ? (
            <View className='empty'>暂无待确认调整</View>
          ) : pendingDrafts.map((draft) => (
            <View key={draft.id} className='draft-card'>
              <View className='draft-main'>
                <Text className={`risk-tag ${draft.risk_level || 'low'}`}>
                  {draft.risk_level === 'high' ? '高风险' : draft.risk_level === 'medium' ? '中风险' : '低风险'}
                </Text>
                <Text className='draft-summary'>{draft.summary || 'AI 已生成训练调整草稿'}</Text>
                <Text className='draft-time'>{formatTime(draft.created_at)}</Text>
              </View>
              <View
                className={`apply-btn ${applyingId === draft.id || !canApplyDraft(draft) ? 'disabled' : ''}`}
                onClick={() => (applyingId === draft.id || !canApplyDraft(draft)) ? undefined : applyDraft(draft.id)}
              >
                <Text>{!canApplyDraft(draft) ? '仅建议' : applyingId === draft.id ? '应用中' : '应用'}</Text>
              </View>
            </View>
          ))}
        </View>

        <View className='panel'>
          <View className='panel-head'>
            <Text className='panel-title'>自动化历史</Text>
            <Text className='panel-count'>{jobs.length}</Text>
          </View>
          {jobs.length === 0 ? (
            <View className='empty'>暂无任务</View>
          ) : jobs.map((job) => (
            <View key={job.id} className='job-row'>
              <View className='job-top'>
                <Text className='job-type'>
                  {job.type === 'initial_plan'
                    ? '首个计划'
                    : job.type === 'feedback_adjustment'
                      ? '反馈调整'
                      : job.type === 'next_phase'
                        ? '下一阶段'
                        : job.type === 'renewal_check'
                          ? '续费检查'
                          : job.type}
                </Text>
                <StatusBadge status={job.status} />
              </View>
              <Text className='job-message'>{job.error_message || job.output_snapshot?.reason || job.trigger_source || '-'}</Text>
              <Text className='job-time'>{formatTime(job.updated_at || job.created_at)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
