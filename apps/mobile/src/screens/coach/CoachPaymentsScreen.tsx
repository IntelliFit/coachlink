import { useCallback, useRef, useState } from 'react'
import { Alert, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { ImagePreviewModal } from '../../components/ImagePreviewModal'
import { colors, radius, spacing } from '../../theme'
import { Card, EmptyState, LoadingState, ScreenShell, SolidButton, errorMessage, safeRequest, type RootNav } from '../me/MeShared'
import {
  buildConfirmRequest,
  buildDismissRequest,
  extractReceiptInfo,
  moneyYuanText,
  paymentTypeLabel,
  tierLabel,
  type CoachPaymentRecord,
  type PaymentRecordKind,
} from './coachPaymentModel'

type StudentInfo = { name: string; avatar: string }
type WaitingResponse = { manualSubscriptions?: CoachPaymentRecord[]; systemSubscriptions?: CoachPaymentRecord[] }

function formatDateTime(value?: string | null) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function studentLabel(record: CoachPaymentRecord, students: Record<string, StudentInfo>) {
  const id = String(record.student_id || '')
  if (id && students[id]?.name) return students[id].name
  return id ? `学员 ${id.slice(0, 6).toUpperCase()}` : '学员'
}

/** 待支付确认：需要教练确认的付款、系统已确认的付款通知、确认历史。对应小程序学员页的支付确认弹窗。 */
export function CoachPaymentsScreen() {
  const navigation = useNavigation<RootNav>()
  const [tab, setTab] = useState<'pending' | 'history'>('pending')
  const [manual, setManual] = useState<CoachPaymentRecord[]>([])
  const [system, setSystem] = useState<CoachPaymentRecord[]>([])
  const [history, setHistory] = useState<CoachPaymentRecord[]>([])
  const [students, setStudents] = useState<Record<string, StudentInfo>>({})
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const systemRef = useRef<CoachPaymentRecord[]>([])
  systemRef.current = system

  const loadStudents = useCallback(async () => {
    const res = await safeRequest<any>('/api/coach/list-students', { body: { pagination: { page: 0, limit: 100 } } }).catch(() => null)
    const rows: any[] = Array.isArray(res?.students) ? res.students : []
    setStudents(Object.fromEntries(rows.filter((row) => row?.student_id).map((row) => [String(row.student_id), {
      name: String(row.profile?.nickname || row.profile?.full_name || ''),
      avatar: String(row.profile?.avatar_url || ''),
    }])))
  }, [])

  const loadPending = useCallback(async () => {
    const data = await safeRequest<WaitingResponse>('/api/coach/get-payment-waiting-students', { body: {} })
    const nextManual = Array.isArray(data?.manualSubscriptions) ? data.manualSubscriptions : []
    setManual(nextManual)
    setSystem(Array.isArray(data?.systemSubscriptions) ? data.systemSubscriptions : [])
    const valid = new Set(nextManual.map((item) => item.id))
    setSelectedIds((current) => current.filter((id) => valid.has(id)))
  }, [])

  const loadHistory = useCallback(async () => {
    const data = await safeRequest<{ subscriptions?: CoachPaymentRecord[] }>('/api/coach/get-payment-confirmation-history', { body: { limit: 50 } })
    setHistory(Array.isArray(data?.subscriptions) ? data.subscriptions : [])
  }, [])

  const tabRef = useRef(tab)
  tabRef.current = tab

  // 不依赖 tab：切换标签不能触发下面 useFocusEffect 的清理（否则会提前把系统通知标为已读）。
  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    try {
      await Promise.all([loadPending(), tabRef.current === 'history' ? loadHistory() : Promise.resolve(), loadStudents()])
      setError('')
    } catch (loadError) {
      setError(errorMessage(loadError, '加载失败'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [loadHistory, loadPending, loadStudents])

  useFocusEffect(useCallback(() => {
    void load()
    return () => {
      // 与小程序关闭弹窗一致：离开页面时把只读的系统通知标记为已查看，清掉红点。
      const seen = systemRef.current
      if (seen.length === 0) return
      const now = new Date()
      void Promise.all(seen.map((record) => {
        const request = buildDismissRequest(record, now)
        return safeRequest(request.path, { body: request.body }).catch(() => undefined)
      }))
    }
  }, [load]))

  const switchTab = (next: 'pending' | 'history') => {
    setTab(next)
    if (next === 'history') void loadHistory().catch((historyError) => Alert.alert('加载历史失败', errorMessage(historyError)))
  }

  async function confirmRecords(ids: string[]) {
    const targets = manual.filter((record) => ids.includes(record.id))
    if (targets.length === 0) {
      Alert.alert('请选择学员', '先勾选需要确认付款的学员。')
      return
    }
    setSubmitting(true)
    try {
      const now = new Date()
      await Promise.all(targets.map((record) => {
        const request = buildConfirmRequest(record, now)
        return safeRequest(request.path, { body: request.body })
      }))
      setSelectedIds([])
      await loadPending()
      Alert.alert('已确认', `已确认 ${targets.length} 位学员的付款。`)
    } catch (confirmError) {
      Alert.alert('确认失败', errorMessage(confirmError, '请稍后重试'))
      await loadPending().catch(() => undefined)
    } finally {
      setSubmitting(false)
    }
  }

  async function dismiss(record: CoachPaymentRecord) {
    setSubmitting(true)
    try {
      const request = buildDismissRequest(record)
      await safeRequest(request.path, { body: request.body })
      setSystem((current) => current.filter((item) => item.id !== record.id))
    } catch (dismissError) {
      Alert.alert('忽略失败', errorMessage(dismissError, '请稍后重试'))
    } finally {
      setSubmitting(false)
    }
  }

  const toggle = (id: string) => setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  const allSelected = manual.length > 0 && selectedIds.length >= manual.length

  const renderCard = (record: CoachPaymentRecord, kind: PaymentRecordKind) => {
    const offline = record.payment_data?.offline_payment
    const renewWeeks = Number(record.payment_data?.pending_renew?.additional_weeks || 0)
    const amount = moneyYuanText(offline?.amount, offline?.amount_unit)
    const monthly = moneyYuanText(record.monthly_price)
    const { cleanNote, receiptUrl: noteReceipt } = extractReceiptInfo(record.remind_coach_note)
    const receipt = String(offline?.receipt_url || noteReceipt || '').trim()
    const selected = selectedIds.includes(record.id)
    const name = studentLabel(record, students)
    const avatar = students[String(record.student_id || '')]?.avatar
    const tag = kind === 'manual' ? '需确认' : kind === 'system' ? '系统通知' : record.payment_confirmed_by === 'system' ? '系统确认' : '教练确认'

    return (
      <Card key={record.id} style={styles.card}>
        <View style={styles.cardHead}>
          {kind === 'manual' ? (
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={`选择${name}`} onPress={() => toggle(record.id)} style={[styles.check, selected && styles.checkActive]}>
              {selected ? <Text style={styles.checkMark}>✓</Text> : null}
            </Pressable>
          ) : null}
          {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : (
            <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarText}>{name.slice(0, 1)}</Text></View>
          )}
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={[styles.tag, kind === 'manual' ? styles.tagWarning : styles.tagSuccess]}>{tag}</Text>
        </View>
        <InfoRow label="支付方式" value={paymentTypeLabel(record, kind)} />
        <InfoRow label="套餐" value={record.product_name || tierLabel(record.tier)} />
        <InfoRow label="申请时间" value={formatDateTime(record.created_at)} />
        {kind === 'history' ? <InfoRow label="确认时间" value={formatDateTime(record.payment_confirmed_at)} /> : null}
        {monthly ? <InfoRow label="金额" value={monthly} /> : null}
        {offline?.expires_at ? <InfoRow label="到期时间" value={formatDateTime(offline.expires_at)} /> : null}
        {amount ? <InfoRow label="线下金额" value={amount} /> : null}
        {renewWeeks > 0 ? <InfoRow label="续费周数" value={`${renewWeeks} 周`} /> : null}
        {cleanNote ? <Text style={styles.note}>{cleanNote}</Text> : null}
        {receipt ? (
          <Pressable accessibilityRole="imagebutton" accessibilityLabel="查看支付凭证" onPress={() => setReceiptUrl(receipt)} style={styles.receipt}>
            <Text style={styles.receiptLabel}>支付凭证</Text>
            <Image source={{ uri: receipt }} style={styles.receiptImage} />
          </Pressable>
        ) : null}
        {kind === 'manual' ? <SolidButton label="确认付款" loading={submitting} onPress={() => void confirmRecords([record.id])} /> : null}
        {kind === 'system' ? <SolidButton label="忽略通知" variant="secondary" disabled={submitting} onPress={() => void dismiss(record)} /> : null}
      </Card>
    )
  }

  return (
    <ScreenShell
      title="待支付确认"
      subtitle="学员付款、续费和平台支付通知。"
      onBack={navigation.goBack}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.brand} colors={[colors.brand]} onRefresh={() => void load(true)} />}
    >
      <View style={styles.tabs}>
        {(['pending', 'history'] as const).map((key) => (
          <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => switchTab(key)} style={[styles.tab, tab === key && styles.tabActive]}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{key === 'pending' ? `待确认${manual.length + system.length > 0 ? ` ${manual.length + system.length}` : ''}` : '历史'}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? <LoadingState /> : null}
      {!loading && error ? <EmptyState title="加载失败" desc={error} /> : null}

      {!loading && !error && tab === 'pending' ? (
        <>
          {manual.length > 0 ? (
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>需要确认（{manual.length}）</Text>
              <Pressable accessibilityRole="button" onPress={() => setSelectedIds(allSelected ? [] : manual.map((item) => item.id))} style={styles.selectAll}>
                <Text style={styles.selectAllText}>{allSelected ? '取消全选' : '全选'}</Text>
              </Pressable>
            </View>
          ) : null}
          {manual.map((record) => renderCard(record, 'manual'))}
          {system.length > 0 ? <Text style={styles.sectionTitle}>系统通知（{system.length}）</Text> : null}
          {system.map((record) => renderCard(record, 'system'))}
          {manual.length === 0 && system.length === 0 ? <EmptyState title="暂无待确认支付" desc="后续有新的支付提醒会在这里展示。" icon="icon-goumaijilu" /> : null}
          {manual.length > 0 ? (
            <SolidButton label={`确认所选付款（${selectedIds.length}）`} loading={submitting} disabled={selectedIds.length === 0} onPress={() => void confirmRecords(selectedIds)} />
          ) : null}
        </>
      ) : null}

      {!loading && !error && tab === 'history' ? (
        history.length > 0 ? history.map((record) => renderCard(record, 'history')) : <EmptyState title="暂无历史记录" desc="确认过的支付会展示在这里。" icon="icon-goumaijilu" />
      ) : null}

      <ImagePreviewModal urls={receiptUrl ? [receiptUrl] : []} initialUrl={receiptUrl} onClose={() => setReceiptUrl(null)} />
    </ScreenShell>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  tabActive: {
    backgroundColor: colors.surface,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  tabTextActive: {
    color: colors.brandDark,
    fontWeight: '700',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  selectAll: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  selectAllText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    gap: 6,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  check: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  checkMark: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
  },
  avatarText: {
    color: colors.brandDark,
    fontSize: 16,
    fontWeight: '700',
  },
  name: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  tag: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: '600',
    overflow: 'hidden',
  },
  tagWarning: {
    color: '#9A3412',
    backgroundColor: '#FFF7ED',
  },
  tagSuccess: {
    color: colors.success,
    backgroundColor: '#ECF7EF',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  infoLabel: {
    color: colors.textTertiary,
    fontSize: 13,
  },
  infoValue: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  note: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    padding: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  receipt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  receiptLabel: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '600',
  },
  receiptImage: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
})

/** 学员页 / 工作台顶部的待支付提醒，有待处理记录时才显示。 */
export function CoachPaymentBanner() {
  const navigation = useNavigation<RootNav>()
  const [counts, setCounts] = useState({ manual: 0, system: 0 })

  useFocusEffect(useCallback(() => {
    let active = true
    safeRequest<WaitingResponse>('/api/coach/get-payment-waiting-students', { body: {} })
      .then((data) => {
        if (!active) return
        setCounts({
          manual: Array.isArray(data?.manualSubscriptions) ? data.manualSubscriptions.length : 0,
          system: Array.isArray(data?.systemSubscriptions) ? data.systemSubscriptions.length : 0,
        })
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, []))

  const total = counts.manual + counts.system
  if (total === 0) return null
  const desc = counts.manual > 0
    ? `${counts.manual} 笔付款待你确认${counts.system > 0 ? `，${counts.system} 条支付通知` : ''}`
    : `${counts.system} 条新的支付通知`

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`待支付确认，${desc}`} onPress={() => navigation.navigate('CoachPayments')} style={({ pressed }) => [bannerStyles.banner, pressed && bannerStyles.pressed]}>
      <View style={bannerStyles.badge}><Text style={bannerStyles.badgeText}>{total > 99 ? '99+' : total}</Text></View>
      <View style={bannerStyles.body}>
        <Text style={bannerStyles.title}>待支付确认</Text>
        <Text style={bannerStyles.desc} numberOfLines={1}>{desc}</Text>
      </View>
      <Text style={bannerStyles.arrow}>›</Text>
    </Pressable>
  )
}

const bannerStyles = StyleSheet.create({
  banner: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  pressed: {
    opacity: 0.86,
  },
  badge: {
    minWidth: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: colors.danger,
  },
  badgeText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  desc: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  arrow: {
    color: colors.brandDark,
    fontSize: 22,
    fontWeight: '700',
  },
})
