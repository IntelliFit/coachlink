import { useEffect, useState } from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { apiClient } from '../../api'
import { IconFont } from '../../components/IconFont'
import { Page } from '../../components/Page'
import { SectionCard } from '../../components/SectionCard'
import { colors, radius, spacing } from '../../theme'
import { HeroPanel } from '../AppHomeShared'
import type { RootStackParamList } from '../../navigation/types'
import { getActionDetail, getTrainingDayCount, PLAN_LEVEL_LABELS, type PublicTrainingPlanLevel } from './knowledgeHelpers'

type Props = NativeStackScreenProps<RootStackParamList, 'KnowledgePlanDetail'>

export function KnowledgePlanDetailScreen({ navigation, route }: Props) {
  const planId = route.params?.id || ''
  const fallbackPlan = route.params?.fallback || null
  const [plan, setPlan] = useState<any>(fallbackPlan)
  const [loading, setLoading] = useState(!fallbackPlan)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadPlan() {
    if (!planId) {
      setError('缺少计划 ID')
      setLoading(false)
      return
    }
    setLoading(!fallbackPlan)
    setError('')
    try {
      const payload = await apiClient.request<any>(`/api/knowledge/training-plans/${encodeURIComponent(planId)}`, { method: 'GET', timeoutMs: 10000 })
      setPlan(payload?.plan || null)
    } catch (err) {
      if (!fallbackPlan) {
        setError(err instanceof Error ? err.message : '计划加载失败')
      }
    } finally {
      setLoading(false)
    }
  }

  async function addToMyPlan() {
    if (!plan || saving) return
    setSaving(true)
    try {
      const payload = await apiClient.request<any>(`/api/knowledge/training-plans/${encodeURIComponent(plan.slug || plan.id)}/copy-to-favorite`, { method: 'POST', timeoutMs: 15000 })
      if (!payload?.favorite) throw new Error('保存结果异常')
      Alert.alert('已加入我的计划', '系统会优先复用你已有的动作库动作；没有的动作会自动补进你的动作库。', [
        { text: '继续浏览', style: 'cancel' },
        { text: '去查看', onPress: () => navigation.navigate('PlanLibrary') },
      ])
    } catch (err) {
      const message = err instanceof Error ? err.message : '加入失败，请稍后重试'
      if (/未登录|Unauthorized|401/i.test(message)) {
        Alert.alert('需要登录', '登录后可以把公开计划加入我的计划。', [
          { text: '取消', style: 'cancel' },
          { text: '去登录', onPress: () => navigation.navigate('Login') },
        ])
      } else {
        Alert.alert('加入失败', message)
      }
    } finally {
      setSaving(false)
    }
  }

  async function openSource() {
    const url = typeof plan?.sourceUrl === 'string' ? plan.sourceUrl : ''
    if (!url) {
      Alert.alert('暂无来源链接', '该条目没有可打开的公开来源。')
      return
    }
    try {
      await Linking.openURL(url)
    } catch {
      Alert.alert('无法打开来源', '请稍后重试或复制链接到浏览器。')
    }
  }

  useEffect(() => {
    void loadPlan()
  }, [planId])

  if (loading) {
    return (
      <Page>
        <HeroPanel title="训练计划详情" subtitle="正在加载公开训练计划。" icon="icon-a-Trainingplan" />
        <ActivityIndicator color={colors.brand} />
      </Page>
    )
  }

  if (error || !plan) {
    return (
      <Page>
        <HeroPanel title="计划不存在" subtitle={error || '这个训练计划可能已经下线。'} icon="icon-a-Trainingplan" />
        <Pressable onPress={() => navigation.goBack()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>返回</Text></Pressable>
      </Page>
    )
  }

  const trainingDays = Array.isArray(plan.trainingDays) ? plan.trainingDays : []
  const trainingDayCount = getTrainingDayCount(plan)
  const level = (plan.level || 'beginner') as PublicTrainingPlanLevel

  return (
    <Page>
      <HeroPanel title={plan.name || '训练计划'} subtitle={plan.description || '公开训练计划详情'} kicker={plan.specialtyLabel || plan.goal || plan.sport} icon="icon-a-Trainingplan" />

      <SectionCard title="计划概览" description={plan.audience || plan.suitableFor || '适合按计划推进训练的人群。'}>
        <View style={styles.metaGrid}>
          <Meta icon="icon-knowledge" value={`${plan.weeks || '-'} 周`} label="计划周期" />
          <Meta icon="icon-time" value={`${plan.daysPerWeek || '-'} 天/周`} label="训练频率" />
          <Meta icon="icon-traing" value={`${trainingDayCount} 天`} label="训练日数" />
          <Meta icon="icon-knowledge" value={PLAN_LEVEL_LABELS[level] || '入门'} label="训练级别" />
        </View>
        {plan.templateKind === 'parameterized' ? <Text style={styles.notice}>可参数化：后续可按动作槽位和 1RM 调整。</Text> : null}
      </SectionCard>

      <SectionCard title="器械与标签">
        <View style={styles.tags}>
          {[...(Array.isArray(plan.equipment) ? plan.equipment : []), ...(Array.isArray(plan.tags) ? plan.tags : [])].map((tag) => <Text key={String(tag)} style={styles.tag}>{String(tag)}</Text>)}
        </View>
      </SectionCard>

      {plan.canCopy === false ? (
        <SectionCard title="公开来源" description={`作者：${plan.author || '未知'} · 来源：${plan.sourceName || '公开资料'}。本条目只提供来源索引，不复制第三方完整处方。`} />
      ) : (
        <SectionCard title="动作库说明" description="加入我的计划时，会优先复用你已有的动作库动作；如果模板里有你还没有的动作，系统会自动补进你的动作库，再保存到我的计划里。" />
      )}

      {Array.isArray(plan.actionSlots) && plan.actionSlots.length > 0 ? (
        <SectionCard title="可替换项目">
          {plan.actionSlots.map((slot: any) => (
            <View key={String(slot.key || slot.label)} style={styles.slotRow}>
              <Text style={styles.slotLabel}>{slot.label || slot.key}</Text>
              <Text style={styles.slotValue}>{slot.defaultActionName || '加入后选择动作'}</Text>
            </View>
          ))}
        </SectionCard>
      ) : null}

      <SectionCard title="训练安排" description={trainingDays.length === 0 ? '该来源索引不在 App 内复制完整处方，请到原始来源查看训练日安排。' : trainingDays.length > 14 ? `已展示前 2 周，加入我的计划后可查看完整 ${plan.weeks} 周安排。` : undefined}>
        {trainingDays.length === 0 ? <Text style={styles.moreText}>下方按钮会打开公开来源页面。</Text> : null}
        {trainingDays.slice(0, 14).map((day: any) => (
          <View key={String(day.dayIndex)} style={[styles.dayCard, day.type === 'rest' && styles.restDay]}>
            <View style={styles.dayHead}>
              <Text style={styles.dayTitle}>第 {day.dayIndex} 天</Text>
              <Text style={styles.dayType}>{day.type === 'rest' ? '休息' : `${Array.isArray(day.actionSets) ? day.actionSets.length : 0} 项训练`}</Text>
            </View>
            {day.note ? <Text style={styles.dayNote}>{day.note}</Text> : null}
            {day.type === 'training' && Array.isArray(day.actionSets) ? (
              <View style={styles.actionList}>
                {day.actionSets.slice(0, 4).map((action: any, index: number) => {
                  const detail = getActionDetail(action)
                  return (
                    <View key={`${day.dayIndex}-${index}`} style={styles.actionCard}>
                      <View style={styles.actionHead}>
                        <Text style={styles.actionTitle}>{index + 1}. {detail.actionName}</Text>
                        <Text style={[styles.actionBadge, detail.actionId ? styles.boundBadge : styles.pendingBadge]}>{detail.actionId ? '已绑定动作库' : '加入后自动补齐'}</Text>
                      </View>
                      <View style={styles.metricRow}>
                        <Metric label="组数" value={detail.sets} />
                        <Metric label="次数" value={detail.reps || '按计划'} />
                        <Metric label="休息" value={detail.rest} />
                        {detail.intensity ? <Metric label="强度" value={detail.intensity} /> : null}
                        {detail.load !== null ? <Metric label="重量" value={`${detail.load} kg`} /> : null}
                      </View>
                    </View>
                  )
                })}
                {day.actionSets.length > 4 ? <Text style={styles.moreText}>还有 {day.actionSets.length - 4} 项...</Text> : null}
              </View>
            ) : null}
          </View>
        ))}
      </SectionCard>

      {Array.isArray(plan.notes) && plan.notes.length > 0 ? (
        <SectionCard title="注意事项">
          {plan.notes.map((note: string) => <Text key={note} style={styles.noteLine}>{`\u2022 ${note}`}</Text>)}
        </SectionCard>
      ) : null}

      <View style={styles.footerActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="返回上一页" onPress={() => navigation.goBack()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>返回</Text></Pressable>
        {plan.canCopy === false ? (
          <Pressable accessibilityRole="link" accessibilityLabel="打开公开计划来源" onPress={openSource} style={styles.primaryButton}><Text style={styles.primaryButtonText}>查看原始来源</Text></Pressable>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="加入我的计划" accessibilityState={{ busy: saving, disabled: saving }} onPress={addToMyPlan} disabled={saving} style={[styles.primaryButton, saving && styles.disabled]}><Text style={styles.primaryButtonText}>{saving ? '加入中...' : '加入我的计划'}</Text></Pressable>
        )}
      </View>
    </Page>
  )
}

function Meta({ icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <View style={styles.metaCard}>
      <IconFont name={icon} color={colors.brand} size={18} />
      <Text style={styles.metaValue}>{value}</Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  metaCard: { width: '47.5%', minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  metaValue: { color: colors.text, fontSize: 17, fontWeight: '900' },
  metaLabel: { color: colors.textSecondary, fontSize: 12 },
  notice: { marginTop: spacing.xs, color: colors.brand, fontSize: 13, lineHeight: 20, fontWeight: '700' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag: { overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4, color: colors.textSecondary, backgroundColor: colors.surfaceMuted, fontSize: 12, fontWeight: '700' },
  slotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.border },
  slotLabel: { color: colors.text, fontSize: 14, fontWeight: '800' },
  slotValue: { color: colors.textSecondary, fontSize: 14 },
  dayCard: { borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.xs, backgroundColor: colors.surfaceMuted },
  restDay: { opacity: 0.78 },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  dayTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  dayType: { color: colors.brand, fontSize: 13, fontWeight: '800' },
  dayNote: { marginTop: 4, color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  actionList: { marginTop: spacing.xs, gap: spacing.xs },
  actionCard: { borderRadius: radius.md, padding: spacing.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, justifyContent: 'space-between' },
  actionTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '900', lineHeight: 20 },
  actionBadge: { overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 3, fontSize: 11, fontWeight: '800' },
  boundBadge: { color: colors.success, backgroundColor: '#EAF6EE' },
  pendingBadge: { color: colors.brand, backgroundColor: colors.brandSoft },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  metricPill: { minHeight: 48, minWidth: 80, borderRadius: radius.md, paddingHorizontal: spacing.xs, paddingVertical: 4, backgroundColor: colors.surfaceMuted },
  metricLabel: { color: colors.textMuted, fontSize: 11 },
  metricValue: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 2 },
  moreText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  noteLine: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  footerActions: { flexDirection: 'row', gap: spacing.sm },
  secondaryButton: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  primaryButton: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.56 },
})
