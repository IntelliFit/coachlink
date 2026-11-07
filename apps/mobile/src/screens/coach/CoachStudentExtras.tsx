import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, controlHeight, radius, spacing, typography } from '../../theme'
import { Card, SolidButton, errorMessage, safeRequest } from '../me/MeShared'
import {
  COACH_REFUND_EMPTY_TEXT,
  coachRefundAmountText,
  coachRefundConfirmText,
  coachRefundConsequence,
  coachRefundProviderLabel,
  coachRefundResult,
  coachRefundRoleLabel,
  type CoachRefundOrder,
  type CoachRefundSubscriptionOutcome,
} from '@coachlink/core/src/coachRefund'
import {
  AUTOMATION_FIELDS,
  EMPTY_AUTOMATION_OVERRIDE,
  PLAN_HISTORY_PAGE_SIZE,
  PLAN_HISTORY_SOURCES,
  automationOverridePayload,
  normalizeAutomationOverride,
  normalizeWeeks,
  planSourceLabel,
  planStatusLabel,
  type AutomationOverride,
  type PlanHistorySource,
} from './coachStudentExtrasModel'

/** 自动化单独设置：只对这位学员生效，「继承全局」跟随教练的自动化策略。 */
export function StudentAutomationCard({ subscriptionId }: { subscriptionId: string }) {
  const [value, setValue] = useState<AutomationOverride>(EMPTY_AUTOMATION_OVERRIDE)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!subscriptionId) return
    let alive = true
    setLoaded(false)
    setLoadError('')
    safeRequest<{ override?: any }>(`/api/coach/student-automation-override?subscriptionId=${encodeURIComponent(subscriptionId)}`, { method: 'GET' })
      .then((data) => {
        if (!alive) return
        setValue(normalizeAutomationOverride(data?.override))
        setLoaded(true)
      })
      // 读取失败不能显示成「继承全局」：保存是整条覆盖，会把真实设置清空
      .catch((error) => { if (alive) setLoadError(errorMessage(error, '自动化设置加载失败')) })
    return () => {
      alive = false
    }
  }, [reloadKey, subscriptionId])

  async function save() {
    if (saving) return
    setSaving(true)
    try {
      const data = await safeRequest<{ override?: any }>('/api/coach/student-automation-override', { method: 'PUT', body: automationOverridePayload(subscriptionId, value) })
      setValue(normalizeAutomationOverride(data?.override))
      Alert.alert('自动化设置已保存')
    } catch (error) {
      Alert.alert('保存失败', errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <Text style={styles.title}>自动化单独设置</Text>
      <Text style={styles.desc}>只对这位学员生效；选「继承全局」时跟随你的自动化策略。</Text>
      {!loaded && !loadError ? <ActivityIndicator color={colors.brand} /> : null}
      {loadError ? (
        <>
          <Text style={styles.desc}>{loadError}</Text>
          <SolidButton label="重新加载" variant="secondary" onPress={() => setReloadKey((key) => key + 1)} />
        </>
      ) : null}
      {loaded ? AUTOMATION_FIELDS.map((field) => (
        <View key={field.key} style={styles.group}>
          <Text style={styles.groupLabel}>{field.label}</Text>
          <View style={styles.chips}>
            {field.options.map((option) => {
              const active = (value[field.key] || '') === option.value
              return (
                <Pressable key={option.value || 'inherit'} accessibilityRole="radio" accessibilityLabel={`${field.label}：${option.label}`} accessibilityState={{ checked: active }} onPress={() => setValue((current) => ({ ...current, [field.key]: option.value || null }))} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      )) : null}
      {loaded ? <SolidButton label="保存自动化设置" loading={saving} onPress={() => void save()} /> : null}
    </Card>
  )
}

/** 计划历史：按来源筛选、每次加载 5 条。 */
export function StudentPlanHistoryCard({ studentId, currentInstanceId, onOpenCurrent, onOpenHistory }: {
  studentId: string
  currentInstanceId?: string | null
  onOpenCurrent: () => void
  onOpenHistory: (instanceId: string) => void
}) {
  const [source, setSource] = useState<PlanHistorySource>('all')
  const [plans, setPlans] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (nextSource: PlanHistorySource, nextPage: number, append: boolean) => {
    if (!studentId) return
    setLoading(true)
    try {
      const data = await safeRequest<{ plans?: any[]; totalCount?: number }>('/api/coach/student-plan-history', { body: { studentId, page: nextPage, limit: PLAN_HISTORY_PAGE_SIZE, source: nextSource } })
      const rows = Array.isArray(data?.plans) ? data.plans : []
      setPlans((current) => (append ? [...current, ...rows] : rows))
      setTotal(Number(data?.totalCount || 0))
      setPage(nextPage)
      setSource(nextSource)
    } catch (error) {
      if (!append) setPlans([])
      setTotal(0)
      console.warn('[coach/student-detail] load plan history failed', error)
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    void load('all', 1, false)
  }, [load])

  return (
    <Card>
      <Text style={styles.title}>计划历史</Text>
      <View style={styles.chips}>
        {PLAN_HISTORY_SOURCES.map((item) => {
          const active = source === item.value
          return (
            <Pressable key={item.value} accessibilityRole="tab" accessibilityState={{ selected: active }} disabled={loading || active} onPress={() => void load(item.value, 1, false)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          )
        })}
      </View>
      {plans.length === 0 && !loading ? <Text style={styles.desc}>暂无计划记录</Text> : null}
      {plans.map((plan) => {
        const isCurrent = Boolean(currentInstanceId) && String(plan.id) === String(currentInstanceId)
        return (
          <Pressable key={String(plan.id)} accessibilityRole="button" accessibilityLabel={`${plan.name || '未命名计划'}，${planStatusLabel(plan.status)}`} onPress={() => (isCurrent ? onOpenCurrent() : onOpenHistory(String(plan.id)))} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle} numberOfLines={1}>{plan.name || '未命名计划'}{isCurrent ? ' · 当前' : ''}</Text>
              <Text style={styles.rowMeta}>
                {planSourceLabel(plan.source)} · {planStatusLabel(plan.status)}
                {plan.total_training_days ? ` · ${plan.total_training_days} 个训练日` : ''}
                {plan.start_date ? ` · ${String(plan.start_date).slice(0, 10)} 起` : ''}
              </Text>
            </View>
            <Text style={styles.rowAction}>{isCurrent ? '编辑' : '查看'}</Text>
          </Pressable>
        )
      })}
      {loading ? <ActivityIndicator color={colors.brand} /> : null}
      {!loading && plans.length < total ? <SolidButton label={`加载更多（${plans.length}/${total}）`} variant="secondary" onPress={() => void load(source, page + 1, true)} /> : null}
    </Card>
  )
}

/** 订阅周期：历史训练周数（线下已练）和订阅周数。 */
export function SubscriptionWeeksCard({ subscriptionId, priorWeeks, subscribedWeeks, onSaved, canRefund, onRefunded }: {
  subscriptionId: string
  priorWeeks: number
  subscribedWeeks: number
  onSaved: (next: { priorWeeks: number; subscribedWeeks: number }) => void
  /** 平台代收（微信、支付宝）的订阅才显示退款 */
  canRefund?: boolean
  onRefunded?: (result: { subscriptionCancelled: boolean }) => void
}) {
  const [priorText, setPriorText] = useState(String(priorWeeks || 0))
  const [subscribedText, setSubscribedText] = useState(String(subscribedWeeks || 0))
  const [saving, setSaving] = useState(false)
  const [refundOrders, setRefundOrders] = useState<CoachRefundOrder[] | null>(null)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [refundingId, setRefundingId] = useState<string | null>(null)

  useEffect(() => {
    setPriorText(String(priorWeeks || 0))
    setSubscribedText(String(subscribedWeeks || 0))
  }, [priorWeeks, subscribedWeeks])

  async function save() {
    if (saving || !subscriptionId) return
    const nextPrior = normalizeWeeks(priorText)
    const nextSubscribed = normalizeWeeks(subscribedText)
    setSaving(true)
    try {
      await safeRequest('/api/subscription/update-subscription', { body: { id: subscriptionId, prior_training_weeks: nextPrior, subscribed_weeks: nextSubscribed } })
      onSaved({ priorWeeks: nextPrior, subscribedWeeks: nextSubscribed })
      Alert.alert('订阅周期已更新')
    } catch (error) {
      Alert.alert('保存失败', errorMessage(error, '请稍后重试'))
    } finally {
      setSaving(false)
    }
  }

  // 列出这个订阅的每笔已付订单，由教练选择退哪一笔（重复扣款只退重复的那笔）
  async function loadRefundOrders() {
    if (loadingOrders || !subscriptionId) return
    setLoadingOrders(true)
    try {
      const data = await safeRequest<{ orders: CoachRefundOrder[] }>('/api/coach/subscription-refund-orders', { body: { subscriptionId } })
      setRefundOrders(data?.orders || [])
    } catch (error) {
      Alert.alert('读取订单失败', errorMessage(error, '请稍后重试'))
    } finally {
      setLoadingOrders(false)
    }
  }

  function confirmRefund(order: CoachRefundOrder) {
    if (refundingId) return
    Alert.alert('确认退款', coachRefundConfirmText(order), [
      { text: '取消', style: 'cancel' },
      {
        text: '退款',
        style: 'destructive',
        onPress: async () => {
          setRefundingId(order.id)
          try {
            const data = await safeRequest<{ subscriptionOutcome?: CoachRefundSubscriptionOutcome }>('/api/payment/alipay/refund', { body: { orderId: order.id, refundReason: '教练/学员申请退款' } })
            const result = coachRefundResult(data?.subscriptionOutcome)
            onRefunded?.({ subscriptionCancelled: result.subscriptionCancelled })
            Alert.alert(result.title)
            setRefundOrders(null)
            if (!result.subscriptionCancelled) void loadRefundOrders()
          } catch (error) {
            Alert.alert('退款失败', errorMessage(error, '请稍后重试'))
          } finally {
            setRefundingId(null)
          }
        },
      },
    ])
  }

  return (
    <Card>
      <Text style={styles.title}>订阅周期</Text>
      <View style={styles.weeksRow}>
        <View style={styles.weeksField}>
          <Text style={styles.groupLabel}>迁入前训练周数</Text>
          <TextInput accessibilityLabel="历史训练周数" value={priorText} onChangeText={(text) => setPriorText(text.replace(/[^\d]/g, ''))} keyboardType="number-pad" style={styles.input} />
        </View>
        <View style={styles.weeksField}>
          <Text style={styles.groupLabel}>购买周数</Text>
          <TextInput accessibilityLabel="订阅周数" value={subscribedText} onChangeText={(text) => setSubscribedText(text.replace(/[^\d]/g, ''))} keyboardType="number-pad" style={styles.input} />
        </View>
      </View>
      <SolidButton label="保存订阅周期" variant="secondary" loading={saving} onPress={() => void save()} />
      {canRefund && !refundOrders ? <SolidButton label="退款" variant="danger" loading={loadingOrders} onPress={() => void loadRefundOrders()} /> : null}
      {canRefund && refundOrders ? (
        <View style={styles.group}>
          <Text style={styles.groupLabel}>选择要退款的订单</Text>
          {refundOrders.length === 0 ? <Text style={styles.desc}>{COACH_REFUND_EMPTY_TEXT}</Text> : null}
          {refundOrders.map((order) => (
            <View key={order.id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{coachRefundAmountText(order)} · {coachRefundRoleLabel(order.role)}</Text>
                <Text style={styles.rowMeta}>{coachRefundProviderLabel(order.paymentProvider)} · {coachRefundConsequence(order)}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`退款 ${coachRefundAmountText(order)}`} disabled={Boolean(refundingId)} onPress={() => confirmRefund(order)}>
                {refundingId === order.id ? <ActivityIndicator color={colors.brand} /> : <Text style={styles.rowAction}>退这笔</Text>}
              </Pressable>
            </View>
          ))}
          <Pressable accessibilityRole="button" onPress={() => setRefundOrders(null)}>
            <Text style={styles.rowAction}>收起</Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  desc: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  group: { gap: spacing.xs },
  groupLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  // 与小程序 ClChip 一致
  chip: { minHeight: controlHeight.chip, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  chipActive: { backgroundColor: colors.selected },
  chipText: { color: colors.textSecondary, ...typography.meta },
  chipTextActive: { color: colors.selectedText, fontWeight: '500' },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  rowMeta: { color: colors.textTertiary, fontSize: 12 },
  rowAction: { color: colors.brand, fontSize: 13, fontWeight: '600' },
  weeksRow: { flexDirection: 'row', gap: spacing.sm },
  weeksField: { flex: 1, gap: spacing.xs },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.lg, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, fontSize: 15 },
})
