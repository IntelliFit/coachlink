import { useEffect, useRef, useState } from 'react'
import * as Clipboard from 'expo-clipboard'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ActivityIndicator, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiClient } from '../../api'
import { IconFont } from '../../components/IconFont'
import { colors, radius, shadow, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentWaiting'>
type PaymentStatus = 'pending' | 'success' | 'failed' | 'cancelled'

const POLL_INTERVAL = 5000

function normalizeStatus(payload: any, provider: string): { status: PaymentStatus; amount?: number } {
  if (provider === 'wechat') {
    return {
      status: payload?.status || 'pending',
      amount: payload?.amount != null ? Number(payload.amount) : undefined,
    }
  }

  const order = payload?.order || {}
  const tradeStatus = payload?.tradeStatus
  let status: PaymentStatus = 'pending'
  if (order.status === 'paid' || tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') status = 'success'
  else if (order.status === 'closed' || order.status === 'cancelled' || tradeStatus === 'TRADE_CLOSED') status = 'cancelled'
  else if (order.status === 'failed' || order.status === 'refunded') status = 'failed'
  return {
    status,
    amount: order.total_amount != null ? Number(order.total_amount) : undefined,
  }
}

export function PaymentWaitingScreen({ navigation, route }: Props) {
  const params = route.params || {}
  const provider = params.provider || 'wechat'
  const [status, setStatus] = useState<PaymentStatus>(params.initialStatus || 'pending')
  const [amount, setAmount] = useState(Number(params.amount || 0))
  const [loading, setLoading] = useState(Boolean(params.orderId && !params.initialStatus))
  const [message, setMessage] = useState(params.message || '')
  const [openingPayment, setOpeningPayment] = useState(false)
  const [paymentOpened, setPaymentOpened] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const statusRequestInFlightRef = useRef(false)

  async function fetchStatus(isSilent = false) {
    if (!params.orderId) return
    if (statusRequestInFlightRef.current) {
      if (!isSilent) setMessage('正在查询支付结果，请稍候。')
      return
    }
    statusRequestInFlightRef.current = true
    if (!isSilent) setLoading(true)
    try {
      const payload = provider === 'wechat'
        ? await apiClient.request<any>('/api/payment/wechat/query', { method: 'POST', body: { orderId: params.orderId }, timeoutMs: 10000 })
        : await apiClient.request<any>('/api/payment/alipay/query', { method: 'POST', body: { orderId: params.orderId }, timeoutMs: 10000 })
      const next = normalizeStatus(payload, provider)
      setStatus(next.status)
      if (next.amount != null) setAmount(next.amount)
      setMessage('')
      if (next.status !== 'pending' && pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    } catch (err) {
      if (!isSilent) setMessage(err instanceof Error ? err.message : '查询失败，请稍后重试')
    } finally {
      if (!isSilent) setLoading(false)
      statusRequestInFlightRef.current = false
    }
  }

  useEffect(() => {
    if (params.orderId && !params.initialStatus) void fetchStatus()
  }, [params.orderId, params.initialStatus])

  useEffect(() => {
    if (!params.orderId || status !== 'pending') return
    pollRef.current = setInterval(() => void fetchStatus(true), POLL_INTERVAL)
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [params.orderId, status])

  useEffect(() => {
    if (!params.orderId || !paymentOpened || status !== 'pending') return
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void fetchStatus(true)
    })
    return () => subscription.remove()
  }, [params.orderId, paymentOpened, status])

  async function openPayment() {
    if (!params.paymentUrl || openingPayment) return
    setOpeningPayment(true)
    setMessage('')
    try {
      if (!(await Linking.canOpenURL(params.paymentUrl))) throw new Error('系统无法打开支付地址')
      await Linking.openURL(params.paymentUrl)
      setPaymentOpened(true)
    } catch (err) {
      const reason = err instanceof Error ? err.message : '打开支付宝失败'
      try {
        await Clipboard.setStringAsync(params.paymentUrl)
        setMessage(`${reason}；支付链接已复制，可粘贴到浏览器继续。`)
      } catch {
        setMessage(`${reason}；支付链接也未能复制，请返回套餐页重试。`)
      }
    } finally {
      setOpeningPayment(false)
    }
  }

  function continueNext() {
    if (params.target === 'membership') {
      navigation.navigate('Membership')
      return
    }
    if (params.coachId) {
      navigation.navigate('CoachProfile', { id: params.coachId })
      return
    }
    navigation.navigate('MyCoaches')
  }

  function retry() {
    if (params.target === 'membership') {
      navigation.navigate('MembershipSubscribe')
      return
    }
    if (params.coachId) {
      navigation.navigate('CoachProfile', { id: params.coachId })
      return
    }
    navigation.navigate('MyCoaches')
  }

  const hasOrder = Boolean(params.orderId)
  const resultTitle = status === 'success' ? '支付已成功' : status === 'cancelled' ? '您已取消支付' : status === 'failed' ? '支付未成功' : '正在等待支付结果...'
  const resultHint = !hasOrder
    ? (message || '订阅资料已保存，但 APP 原生支付桥接还未完成。请稍后在订单或教练页继续处理。')
    : status === 'pending'
      ? message || (provider === 'wechat'
        ? '微信支付订单已创建。完成支付后保持在本页，系统会自动同步结果。'
        : params.paymentUrl
          ? '点击下方按钮前往支付宝。付款后返回 APP，系统会自动同步结果。'
          : '支付宝订单已创建，但支付地址不可用，请返回套餐页重试。')
      : status === 'success'
        ? '系统已收到支付结果，服务状态会继续同步。'
        : '可以返回套餐页重新尝试。'

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.label}>支付确认中</Text>
          <View style={styles.amountWrap}>
            <Text style={styles.amountSymbol}>¥</Text>
            <Text style={styles.amountValue}>{amount.toFixed(2)}</Text>
          </View>
          <Text style={styles.orderId}>订单号: {params.orderId || '待创建'}</Text>
        </View>

        <View style={styles.card}>
          {loading ? <ActivityIndicator color={colors.brand} /> : (
            <View style={[styles.iconWrap, status === 'success' && styles.successIcon, status === 'cancelled' && styles.cancelIcon, status === 'failed' && styles.failedIcon]}>
              <IconFont name={status === 'pending' ? 'icon-time' : status === 'success' ? 'icon-goumaijilu' : 'icon-wenhao'} color={status === 'success' ? colors.success : status === 'failed' ? colors.danger : status === 'cancelled' ? colors.warning : colors.brand} size={36} />
            </View>
          )}
          <Text style={styles.title}>{resultTitle}</Text>
          <Text style={styles.hint}>{resultHint}</Text>
        </View>

        {status === 'pending' ? (
          <View style={styles.tip}>
            <Text style={styles.tipMark}>!</Text>
            <View style={styles.tipTextWrap}>
              <Text style={styles.tipLabel}>安全提醒</Text>
              <Text style={styles.tipText}>支付过程中请勿关闭本页。系统会每 5 秒自动同步支付结果，也可以手动查询。</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          {hasOrder && status === 'pending' && params.paymentUrl ? <Pressable accessibilityRole="button" accessibilityLabel={paymentOpened ? '再次打开支付宝' : '打开支付宝付款'} accessibilityState={{ disabled: openingPayment }} disabled={openingPayment} onPress={() => void openPayment()} style={[styles.primaryButton, openingPayment && styles.disabledButton]}>{openingPayment ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{paymentOpened ? '再次打开支付宝' : '打开支付宝付款'}</Text>}</Pressable> : null}
          {hasOrder && status === 'pending' ? <Pressable accessibilityRole="button" accessibilityLabel={loading ? '正在查询支付结果' : '查询支付结果'} accessibilityState={{ disabled: loading, busy: loading }} disabled={loading} onPress={() => fetchStatus()} style={[styles.secondaryButton, loading && styles.disabledButton]}>{loading ? <ActivityIndicator color={colors.brand} /> : <Text style={styles.secondaryText}>我已完成支付</Text>}</Pressable> : null}
          {status === 'success' ? <Pressable accessibilityRole="button" accessibilityLabel="支付成功后继续" onPress={continueNext} style={styles.primaryButton}><Text style={styles.primaryText}>继续</Text></Pressable> : null}
          {(status === 'failed' || status === 'cancelled' || !hasOrder) ? <Pressable accessibilityRole="button" accessibilityLabel={status === 'cancelled' ? '重新订阅' : '重新尝试支付'} onPress={retry} style={styles.warnButton}><Text style={styles.primaryText}>{status === 'cancelled' ? '重新订阅' : '重新尝试'}</Text></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="返回上一页" onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backText}>返回</Text></Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F8F8' },
  content: { flexGrow: 1, paddingHorizontal: spacing.sm, paddingTop: spacing.lg, paddingBottom: spacing.md },
  header: { alignItems: 'center', marginBottom: spacing.md },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  amountWrap: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginTop: spacing.xs },
  amountSymbol: { color: colors.text, fontSize: 18, fontWeight: '900' },
  amountValue: { color: colors.text, fontSize: 44, fontWeight: '900' },
  orderId: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs },
  card: { alignItems: 'center', borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow },
  iconWrap: { width: 80, height: 80, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  successIcon: { backgroundColor: '#EAF6EE' },
  cancelIcon: { backgroundColor: '#FFF3D8' },
  failedIcon: { backgroundColor: '#FDECEC' },
  title: { color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  hint: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.sm, marginTop: spacing.md, backgroundColor: '#FFF8E7', borderWidth: 1, borderColor: '#F7DFA8' },
  tipMark: { color: colors.warning, fontSize: 22, fontWeight: '900' },
  tipTextWrap: { flex: 1, gap: 4 },
  tipLabel: { color: colors.warning, fontSize: 12, fontWeight: '900' },
  tipText: { color: '#8A5B10', fontSize: 13, lineHeight: 20 },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  primaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.brand },
  warnButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.warning },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  backButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.textMuted, fontSize: 14, fontWeight: '800' },
  secondaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  disabledButton: { opacity: 0.52 },
})
