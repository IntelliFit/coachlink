import { useCallback, useEffect, useState } from 'react'
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { IconFont } from '../../components/IconFont'
import type { RootStackParamList } from '../../navigation/types'
import { colors, radius, shadow, spacing } from '../../theme'
import { Card, EmptyState, LoadingState, ScreenShell, SolidButton, safeRequest } from '../me/MeShared'

type Navigation = NativeStackNavigationProp<RootStackParamList>

type PendingSettlement = {
  id: string
  amount: number
  platform_fee: number
  total_amount: number
  status: 'pending' | 'processing' | 'split_failed'
  eligible_at?: string | null
  created_at?: string
  alipay_order_id?: string
  subject?: string | null
  student_name?: string | null
  error_message?: string | null
}

type WalletTransaction = {
  id: string
  amount: number
  type: 'income' | 'withdrawal' | 'refund'
  description?: string | null
  created_at?: string
  subject?: string | null
  student_name?: string | null
  alipay_order_id?: string | null
  platform_fee?: number | null
}

type WalletData = {
  balance: number
  gross_balance?: number
  withdrawable_balance?: number
  total_income?: number
  frozen_amount?: number
  refund_protected_amount?: number
  pending_settlement_amount?: number
  refund_protection_days?: number
  huifu_open_status?: string | null
  huifu_open_msg?: string | null
  pending_settlements?: PendingSettlement[]
  transactions?: WalletTransaction[]
}

const EMPTY_WALLET: WalletData = {
  balance: 0,
  pending_settlements: [],
  transactions: [],
}

function asNumber(value: unknown, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function formatMoney(value?: number | null) {
  return asNumber(value).toFixed(2)
}

function formatDateTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function isSettlementOverdue(settlement: PendingSettlement) {
  if (settlement.status !== 'pending' || !settlement.eligible_at) return false
  const eligibleAt = new Date(settlement.eligible_at).getTime()
  return Number.isFinite(eligibleAt) && eligibleAt <= Date.now()
}

function settlementLabel(settlement: PendingSettlement) {
  if (isSettlementOverdue(settlement)) return '结算待处理'
  if (settlement.status === 'split_failed') return '待重试结算'
  if (settlement.status === 'processing') return '结算处理中'
  return '待结算'
}

function transactionLabel(type: WalletTransaction['type']) {
  if (type === 'income') return '收入'
  if (type === 'withdrawal') return '提现'
  return '退款'
}

function normalizeWallet(payload: any): WalletData {
  const raw = payload?.data || payload || {}
  return {
    ...raw,
    balance: asNumber(raw.balance),
    gross_balance: asNumber(raw.gross_balance, asNumber(raw.balance)),
    withdrawable_balance: asNumber(raw.withdrawable_balance, asNumber(raw.balance)),
    total_income: asNumber(raw.total_income),
    frozen_amount: asNumber(raw.frozen_amount),
    refund_protected_amount: asNumber(raw.refund_protected_amount),
    pending_settlement_amount: asNumber(raw.pending_settlement_amount),
    refund_protection_days: asNumber(raw.refund_protection_days, 7),
    pending_settlements: Array.isArray(raw.pending_settlements) ? raw.pending_settlements : [],
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
  }
}

export function CoachWalletScreen() {
  const navigation = useNavigation<Navigation>()
  const [wallet, setWallet] = useState<WalletData>(EMPTY_WALLET)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [withdrawVisible, setWithdrawVisible] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError(null)
      const res = await safeRequest<any>('/api/coach/wallet')
      setWallet(normalizeWallet(res))
    } catch (e) {
      setWallet(EMPTY_WALLET)
      setError(e instanceof Error ? e.message : '钱包加载失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const isHuifuOpened = wallet.huifu_open_status === 'opened'
  const pendingSettlements = wallet.pending_settlements || []
  const transactions = wallet.transactions || []

  async function submitWithdraw() {
    const amount = Number(withdrawAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('金额不正确', '请输入合法的提现金额。')
      return
    }
    try {
      setSubmitting(true)
      await safeRequest('/api/coach/wallet/huifu/withdraw', {
        method: 'POST',
        body: { amount },
      })
      setWithdrawVisible(false)
      setWithdrawAmount('')
      Alert.alert('已提交', '提现申请已提交，预计 T+1 到账。')
      await load(true)
    } catch (e) {
      Alert.alert('提现失败', e instanceof Error ? e.message : '请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <ScreenShell title="教练钱包" subtitle="余额、结算、提现和收支明细。" onBack={() => navigation.goBack()}>
        <LoadingState title="正在加载钱包" />
      </ScreenShell>
    )
  }

  return (
    <ScreenShell title="教练钱包" subtitle="余额、结算、提现和收支明细。" onBack={() => navigation.goBack()}>
      <ScrollView
        horizontal={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.brand} />}
        contentContainerStyle={styles.inner}
        showsVerticalScrollIndicator={false}
      >
        {error ? <EmptyState title="加载失败" desc={error} icon="icon-goumaijilu" /> : null}

        {!error ? (
          <>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>可提现余额（元）</Text>
              <Text style={styles.balanceAmount}>¥{formatMoney(wallet.balance)}</Text>
              <View style={styles.metricGrid}>
                <WalletMetric label="冻结金额" value={wallet.frozen_amount} />
                <WalletMetric label="待结算收入" value={wallet.pending_settlement_amount} />
                <WalletMetric label="账户总余额" value={wallet.gross_balance ?? wallet.balance} />
                <WalletMetric label="累计总收入" value={wallet.total_income} strong />
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => (isHuifuOpened ? setWithdrawVisible(true) : navigation.navigate('CoachWalletMerchant'))}
                style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
              >
                <Text style={styles.primaryActionText}>
                  {isHuifuOpened ? '申请提现' : wallet.huifu_open_status === 'failed' ? '重新开通收款账户' : '开通收款账户'}
                </Text>
              </Pressable>
            </View>

            <Card style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <IconFont name="icon-goumaijilu" size={22} color={isHuifuOpened ? colors.success : colors.warning} />
                <Text style={styles.statusTitle}>汇付收款账户</Text>
              </View>
              <Text style={[styles.statusText, isHuifuOpened ? styles.opened : wallet.huifu_open_status === 'failed' ? styles.failed : styles.pending]}>
                {isHuifuOpened ? '已开通' : wallet.huifu_open_status === 'failed' ? '开通失败' : wallet.huifu_open_status === 'business_pending' ? '审核中' : '未开通'}
              </Text>
              <Text style={styles.statusDesc}>
                {wallet.huifu_open_msg || (isHuifuOpened ? '学员订阅付款会按规则自动分账到您的账户。' : '请先开通后再接收分账与提现。')}
              </Text>
              {!isHuifuOpened ? <SolidButton label={wallet.huifu_open_status === 'failed' ? '重新提交开户资料' : '立即开通'} onPress={() => navigation.navigate('CoachWalletMerchant')} /> : null}
            </Card>

            <Card style={styles.hintCard}>
              <Text style={styles.hintText}>
                开户后，教练订阅和内容收入会按规则进入汇付收款账户；{wallet.refund_protection_days ?? 7} 天退款保护期内的收入会暂时冻结，待结算收入不会计入可提现余额。
              </Text>
            </Card>

            {pendingSettlements.length || transactions.length ? (
              <Card style={styles.transactionSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>收支明细</Text>
                  <Text style={styles.sectionMeta}>{pendingSettlements.length + transactions.length} 条</Text>
                </View>
                {pendingSettlements.map((settlement) => (
                  <PendingSettlementRow key={settlement.id} item={settlement} />
                ))}
                {transactions.map((transaction) => (
                  <TransactionRow key={transaction.id} item={transaction} />
                ))}
              </Card>
            ) : (
              <EmptyState title="暂无交易记录" desc="收入、提现和退款流水会显示在这里。" icon="icon-goumaijilu" />
            )}
          </>
        ) : null}
      </ScrollView>

      <Modal animationType="slide" transparent visible={withdrawVisible} onRequestClose={() => setWithdrawVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>申请提现</Text>
            <Text style={styles.modalDesc}>当前可提现余额 ¥{formatMoney(wallet.balance)}，单笔提现金额不能低于 0.10 元。</Text>
            <TextInput
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              keyboardType="numeric"
              placeholder="输入提现金额"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <SolidButton label="取消" variant="secondary" onPress={() => setWithdrawVisible(false)} disabled={submitting} />
              <SolidButton label="提交提现" onPress={submitWithdraw} loading={submitting} />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  )
}

function WalletMetric({ label, value, strong }: { label: string; value?: number | null; strong?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, strong && styles.metricStrong]}>¥{formatMoney(value)}</Text>
    </View>
  )
}

function PendingSettlementRow({ item }: { item: PendingSettlement }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <Text style={[styles.tag, styles.pendingTag]}>{settlementLabel(item)}</Text>
        <Text style={styles.rowTitle}>来自{item.student_name || '学员'}的订阅</Text>
        {item.subject ? <Text style={styles.rowDesc}>{item.subject}</Text> : null}
        {item.created_at ? <Text style={styles.rowTime}>{formatDateTime(item.created_at)}</Text> : null}
        {item.eligible_at ? (
          <Text style={styles.rowWarn}>{isSettlementOverdue(item) ? '已到期，等待系统结算' : `预计可结算：${formatDateTime(item.eligible_at)}`}</Text>
        ) : null}
        {item.error_message ? <Text style={styles.rowError}>{item.error_message}</Text> : null}
      </View>
      <View style={styles.amountBlock}>
        <Text style={[styles.rowAmount, styles.pendingAmount]}>+¥{formatMoney(item.amount)}</Text>
        {asNumber(item.platform_fee) > 0 ? <Text style={styles.feeText}>平台服务费 -{formatMoney(item.platform_fee)}</Text> : null}
      </View>
    </View>
  )
}

function TransactionRow({ item }: { item: WalletTransaction }) {
  const isIncome = item.type === 'income'
  return (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <Text style={[styles.tag, isIncome ? styles.incomeTag : item.type === 'withdrawal' ? styles.withdrawalTag : styles.refundTag]}>{transactionLabel(item.type)}</Text>
        <Text style={styles.rowTitle}>{item.description || item.subject || '交易'}</Text>
        {item.subject && item.subject !== item.description ? <Text style={styles.rowDesc}>{item.subject}</Text> : null}
        {item.created_at ? <Text style={styles.rowTime}>{formatDateTime(item.created_at)}</Text> : null}
      </View>
      <View style={styles.amountBlock}>
        <Text style={[styles.rowAmount, isIncome ? styles.incomeAmount : styles.outcomeAmount]}>
          {isIncome ? '+' : '-'}¥{formatMoney(Math.abs(asNumber(item.amount)))}
        </Text>
        {asNumber(item.platform_fee) > 0 ? <Text style={styles.feeText}>平台服务费 -{formatMoney(item.platform_fee)}</Text> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  inner: {
    gap: spacing.sm,
  },
  balanceCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: '#059669',
    ...shadow,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '700',
  },
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '700',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metric: {
    width: '48.5%',
    minHeight: 56,
    gap: 4,
    padding: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '700',
  },
  metricValue: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontWeight: '600',
  },
  metricStrong: {
    color: '#FFFFFF',
  },
  primaryAction: {
    alignSelf: 'flex-start',
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: '#FFFFFF',
  },
  primaryActionText: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '700',
  },
  statusCard: {
    gap: spacing.xs,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  statusText: {
    fontSize: 15,
    fontWeight: '700',
  },
  opened: {
    color: colors.success,
  },
  pending: {
    color: colors.warning,
  },
  failed: {
    color: colors.danger,
  },
  statusDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  hintCard: {
    backgroundColor: colors.surface,
  },
  hintText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'center',
  },
  transactionSection: {
    gap: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionMeta: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.sm,
    fontSize: 11,
    fontWeight: '600',
  },
  pendingTag: {
    color: '#D97706',
    backgroundColor: '#FEF3C7',
  },
  incomeTag: {
    color: '#059669',
    backgroundColor: '#ECFDF5',
  },
  withdrawalTag: {
    color: '#D97706',
    backgroundColor: '#FEF3C7',
  },
  refundTag: {
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  rowDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  rowTime: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  rowWarn: {
    color: colors.warning,
    fontSize: 12,
  },
  rowError: {
    color: colors.danger,
    fontSize: 12,
  },
  amountBlock: {
    alignItems: 'flex-end',
    gap: 3,
    maxWidth: 112,
  },
  rowAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  pendingAmount: {
    color: '#D97706',
  },
  incomeAmount: {
    color: colors.success,
  },
  outcomeAmount: {
    color: colors.text,
  },
  feeText: {
    color: colors.textTertiary,
    fontSize: 11,
    textAlign: 'right',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17,24,39,0.35)',
  },
  modalPanel: {
    gap: spacing.sm,
    padding: spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  modalDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 18,
    backgroundColor: colors.surfaceMuted,
  },
  modalActions: {
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.74,
  },
})
