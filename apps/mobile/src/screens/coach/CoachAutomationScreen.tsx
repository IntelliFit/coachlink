import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { apiClient } from '../../api'
import { IconFont } from '../../components/IconFont'
import type { RootStackParamList } from '../../navigation/types'
import { colors, radius, spacing } from '../../theme'
import { Card, EmptyState, LoadingState, ScreenShell, SolidButton } from '../me/MeShared'

type Navigation = NativeStackNavigationProp<RootStackParamList>

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
  riskGuardMode: 'strict',
}

const INITIAL_PLAN_OPTIONS = [
  { value: 'auto_publish', label: '自动发放' },
  { value: 'draft', label: '生成草稿' },
  { value: 'off', label: '关闭' },
]

const FEEDBACK_OPTIONS = [
  { value: 'draft_notify', label: '草稿并通知' },
  { value: 'auto_apply_low_risk', label: '低风险自动应用' },
  { value: 'auto_apply_safe', label: '安全反馈自动应用' },
  { value: 'off', label: '关闭' },
]

const NEXT_PHASE_OPTIONS = [
  { value: 'draft_notify', label: '草稿并通知' },
  { value: 'auto_publish_if_credits', label: '额度足够自动发布' },
  { value: 'off', label: '关闭' },
]

const RISK_OPTIONS = [
  { value: 'strict', label: '严格' },
  { value: 'normal', label: '普通' },
]

const SETTING_GUIDE = [
  { title: '首个计划', value: '建议自动发放', body: '新学员支付或确认后，系统直接生成并发放首个计划。想逐份检查时再改成草稿。' },
  { title: '反馈调整', value: '建议草稿通知', body: '学员反馈偏重、偏轻、时间不够时，系统先生成调整草稿，由教练确认后应用。' },
  { title: '下一阶段', value: '建议草稿通知', body: '当前阶段完成后，有额度则生成下一阶段草稿；额度不足时提醒续费。' },
  { title: '风险保护', value: '建议严格', body: '疼痛、伤病、麻木、头晕等反馈不会自动改计划，必须教练人工判断。' },
]

const SCENARIO_GUIDE = [
  { title: '普通线上教练', settings: '首个计划自动发放；反馈和下一阶段都先生成草稿；风险保护严格。' },
  { title: '新教练或高客单学员', settings: '首个计划也生成草稿，所有关键动作都由教练确认。' },
  { title: '稳定老学员', settings: '可把反馈调整改成低风险自动应用，但风险保护仍保持严格。' },
  { title: '康复/疼痛/伤病倾向', settings: '不要开自动应用，反馈调整和下一阶段都保持草稿确认。' },
  { title: '尽量全自动', settings: '首个计划自动发放，低风险自动应用，下一阶段额度足够自动发布。只建议给稳定学员使用。' },
]

function labelOf(options: Array<{ value: string; label: string }>, value: string) {
  return options.find((item) => item.value === value)?.label || options[0]?.label || ''
}

function formatTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    pending: '待执行',
    running: '执行中',
    succeeded: '已完成',
    failed: '失败',
    needs_coach_review: '待确认',
    skipped: '已跳过',
  }
  return map[String(status || '')] || '待执行'
}

function canApplyDraft(draft: any) {
  return Array.isArray(draft?.proposed_patch?.updatedTrainingDays)
}

export function CoachAutomationScreen() {
  const navigation = useNavigation<Navigation>()
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY)
  const [source, setSource] = useState('default')
  const [jobs, setJobs] = useState<any[]>([])
  const [drafts, setDrafts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pendingDrafts = useMemo(() => drafts.filter((draft) => draft?.status === 'draft'), [drafts])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [policyRes, jobsRes] = await Promise.all([
        apiClient.request<any>('/api/coach/automation-policy', { method: 'GET' }),
        apiClient.request<any>('/api/coach/automation-jobs?limit=30', { method: 'GET' }),
      ])
      setPolicy({ ...DEFAULT_POLICY, ...(policyRes?.policy || {}) })
      setSource(policyRes?.source || 'default')
      setJobs(Array.isArray(jobsRes?.jobs) ? jobsRes.jobs : [])
      setDrafts(Array.isArray(jobsRes?.drafts) ? jobsRes.drafts : [])
    } catch (e) {
      setJobs([])
      setDrafts([])
      setError(e instanceof Error ? e.message : '自动化设置加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function savePolicy() {
    try {
      setSaving(true)
      const res = await apiClient.request<any>('/api/coach/automation-policy', { method: 'PUT', body: policy })
      setPolicy({ ...DEFAULT_POLICY, ...(res?.policy || {}) })
      setSource('coach')
      Alert.alert('已保存', '自动化设置已保存。')
    } catch (e) {
      Alert.alert('保存失败', e instanceof Error ? e.message : '请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  async function applyDraft(draftId: string) {
    try {
      setApplyingId(draftId)
      await apiClient.request(`/api/coach/plan-adjustment-drafts/${draftId}/apply`, { method: 'POST' })
      await load()
      Alert.alert('已应用', '训练调整草稿已应用。')
    } catch (e) {
      Alert.alert('应用失败', e instanceof Error ? e.message : '请稍后重试')
    } finally {
      setApplyingId(null)
    }
  }

  if (loading) {
    return (
      <ScreenShell title="自动化设置" subtitle="计划发放、反馈调整、下一阶段。" onBack={() => navigation.goBack()}>
        <LoadingState title="正在加载自动化设置" />
      </ScreenShell>
    )
  }

  return (
    <ScreenShell title="自动化设置" subtitle={`当前来源：${source === 'coach' ? '教练自定义' : '系统默认'}`} onBack={() => navigation.goBack()}>
      {error ? <EmptyState title="加载失败" desc={error} icon="icon-kaiji" /> : null}

      <Card style={styles.guidePanel}>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <IconFont name="icon-kaiji" size={24} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.guideKicker}>推荐默认</Text>
            <Text style={styles.panelTitle}>不知道怎么选，就保持默认</Text>
            <Text style={styles.guideCopy}>默认会自动发首个计划，反馈和下一阶段先生成草稿提醒教练确认，疼痛和伤病风险永远不会自动应用。</Text>
          </View>
        </View>
        <View style={styles.guideGrid}>
          {SETTING_GUIDE.map((item) => (
            <View key={item.title} style={styles.guideItem}>
              <Text style={styles.guideItemTitle}>{item.title}</Text>
              <Text style={styles.guideItemValue}>{item.value}</Text>
              <Text style={styles.guideItemBody}>{item.body}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.sectionTitle}>不同情况下怎么设置</Text>
        {SCENARIO_GUIDE.map((item) => (
          <View key={item.title} style={styles.scenarioCard}>
            <Text style={styles.scenarioName}>{item.title}</Text>
            <Text style={styles.scenarioSettings}>{item.settings}</Text>
          </View>
        ))}
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>单个学员需要特殊规则时，去学员详情里设置“单学员自动化覆盖”；不要为了一个学员改全局设置。</Text>
        </View>
      </Card>

      <Card style={styles.panel}>
        <Text style={styles.panelTitle}>教练全局策略</Text>
        <PolicySelector label="首个计划" value={policy.initialPlanMode} options={INITIAL_PLAN_OPTIONS} onChange={(initialPlanMode) => setPolicy((prev) => ({ ...prev, initialPlanMode }))} />
        <PolicySelector label="反馈调整" value={policy.feedbackAdjustmentMode} options={FEEDBACK_OPTIONS} onChange={(feedbackAdjustmentMode) => setPolicy((prev) => ({ ...prev, feedbackAdjustmentMode }))} />
        <PolicySelector label="下一阶段" value={policy.nextPhaseMode} options={NEXT_PHASE_OPTIONS} onChange={(nextPhaseMode) => setPolicy((prev) => ({ ...prev, nextPhaseMode }))} />
        <PolicySelector label="风险保护" value={policy.riskGuardMode} options={RISK_OPTIONS} onChange={(riskGuardMode) => setPolicy((prev) => ({ ...prev, riskGuardMode }))} />
        <SolidButton label={saving ? '保存中' : '保存设置'} loading={saving} onPress={savePolicy} />
      </Card>

      <Card style={styles.panel}>
        <View style={styles.panelHead}>
          <Text style={styles.panelTitle}>待确认草稿</Text>
          <Text style={styles.countPill}>{pendingDrafts.length}</Text>
        </View>
        {pendingDrafts.length === 0 ? <Text style={styles.emptyText}>暂无待确认调整</Text> : null}
        {pendingDrafts.map((draft) => (
          <View key={draft.id} style={styles.draftCard}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.riskTag, draft.risk_level === 'high' ? styles.highRisk : draft.risk_level === 'medium' ? styles.mediumRisk : styles.lowRisk]}>
                {draft.risk_level === 'high' ? '高风险' : draft.risk_level === 'medium' ? '中风险' : '低风险'}
              </Text>
              <Text style={styles.draftSummary}>{draft.summary || 'AI 已生成训练调整草稿'}</Text>
              <Text style={styles.timeText}>{formatTime(draft.created_at)}</Text>
            </View>
            <SolidButton
              label={!canApplyDraft(draft) ? '仅建议' : applyingId === draft.id ? '应用中' : '应用'}
              variant="secondary"
              disabled={applyingId === draft.id || !canApplyDraft(draft)}
              loading={applyingId === draft.id}
              onPress={() => void applyDraft(draft.id)}
            />
          </View>
        ))}
      </Card>

      <Card style={styles.panel}>
        <View style={styles.panelHead}>
          <Text style={styles.panelTitle}>自动化历史</Text>
          <Text style={styles.countPill}>{jobs.length}</Text>
        </View>
        {jobs.length === 0 ? <Text style={styles.emptyText}>暂无任务</Text> : null}
        {jobs.map((job) => (
          <View key={job.id} style={styles.jobRow}>
            <View style={styles.jobTop}>
              <Text style={styles.jobType}>{jobTypeLabel(job.type)}</Text>
              <Text style={styles.statusBadge}>{statusLabel(job.status)}</Text>
            </View>
            <Text style={styles.jobMessage}>{job.error_message || job.output_snapshot?.reason || job.trigger_source || '-'}</Text>
            <Text style={styles.timeText}>{formatTime(job.updated_at || job.created_at)}</Text>
          </View>
        ))}
      </Card>
    </ScreenShell>
  )
}

function jobTypeLabel(type?: string) {
  const map: Record<string, string> = {
    initial_plan: '首个计划',
    feedback_adjustment: '反馈调整',
    next_phase: '下一阶段',
    renewal_check: '续费检查',
  }
  return map[String(type || '')] || String(type || '自动化任务')
}

function PolicySelector({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <View style={styles.policyBlock}>
      <Text style={styles.policyLabel}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map((item) => (
          <Pressable key={item.value} onPress={() => onChange(item.value)} style={[styles.optionPill, value === item.value && styles.optionActive]}>
            <Text style={[styles.optionText, value === item.value && styles.optionTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.currentText}>当前：{labelOf(options, value)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  guidePanel: { gap: spacing.sm },
  headerRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  headerIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  guideKicker: { color: colors.brand, fontSize: 12, fontWeight: '900' },
  panelTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  guideCopy: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 4 },
  guideGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  guideItem: { width: '47%', padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, gap: 4 },
  guideItemTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  guideItemValue: { color: colors.brand, fontSize: 12, fontWeight: '900' },
  guideItemBody: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  scenarioCard: { padding: spacing.sm, borderRadius: radius.md, backgroundColor: '#FAFAFA', gap: 4 },
  scenarioName: { color: colors.text, fontSize: 14, fontWeight: '900' },
  scenarioSettings: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  warningBox: { padding: spacing.sm, borderRadius: radius.md, backgroundColor: '#FFF7F3' },
  warningText: { color: colors.brand, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  panel: { gap: spacing.sm },
  policyBlock: { gap: spacing.xs },
  policyLabel: { color: colors.text, fontSize: 14, fontWeight: '900' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  optionPill: { minHeight: 48, paddingHorizontal: spacing.sm, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  optionActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  optionText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
  optionTextActive: { color: colors.surface },
  currentText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  countPill: { minWidth: 28, textAlign: 'center', paddingHorizontal: spacing.xs, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.brandSoft, color: colors.brand, fontSize: 12, fontWeight: '900' },
  emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  draftCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  riskTag: { alignSelf: 'flex-start', paddingHorizontal: spacing.xs, paddingVertical: 4, borderRadius: radius.pill, fontSize: 11, fontWeight: '900', overflow: 'hidden' },
  lowRisk: { backgroundColor: '#EAFBF6', color: '#098B72' },
  mediumRisk: { backgroundColor: '#FFF3D6', color: '#A66A00' },
  highRisk: { backgroundColor: '#FEF2F2', color: '#DC2626' },
  draftSummary: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: spacing.xs },
  timeText: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  jobRow: { padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, gap: spacing.xs },
  jobTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  jobType: { color: colors.text, fontSize: 14, fontWeight: '900' },
  statusBadge: { color: colors.brand, fontSize: 12, fontWeight: '900' },
  jobMessage: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
})
