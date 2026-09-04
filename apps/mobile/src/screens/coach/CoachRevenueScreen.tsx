import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { IconFont } from '../../components/IconFont'
import type { RootStackParamList } from '../../navigation/types'
import { colors, radius, shadow, spacing } from '../../theme'
import { Card, EmptyState, LoadingState, ScreenShell, safeRequest } from '../me/MeShared'

type Navigation = NativeStackNavigationProp<RootStackParamList>

type RevenueItem = {
  id?: string
  type?: 'subscription' | 'content_purchase' | string
  amount?: number
  description?: string
  subject?: string
  createdAt?: string
  created_at?: string
  studentName?: string
  contentTitle?: string
}

type RevenueDetails = {
  subscriptionRevenue: number
  contentPurchaseRevenue: number
  totalRevenue: number
  items: RevenueItem[]
}

const EMPTY_REVENUE: RevenueDetails = {
  subscriptionRevenue: 0,
  contentPurchaseRevenue: 0,
  totalRevenue: 0,
  items: [],
}

function padMonth(value: number) {
  return String(value).padStart(2, '0')
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${padMonth(date.getMonth() + 1)}`
}

function shiftMonth(key: string, offset: number) {
  const [yearText, monthText] = key.split('-')
  const date = new Date(Number(yearText), Number(monthText) - 1 + offset, 1)
  return monthKey(date)
}

function formatMonth(key: string) {
  const [yearText, monthText] = key.split('-')
  return `${yearText}年${Number(monthText)}月`
}

function asNumber(value: unknown, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function formatMoney(value?: number | null) {
  return `¥${asNumber(value).toFixed(2)}`
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function normalizeRevenue(payload: any): RevenueDetails {
  const raw = payload?.data || payload || {}
  const subscriptionRevenue = asNumber(raw.subscriptionRevenue ?? raw.subscription_revenue)
  const contentPurchaseRevenue = asNumber(raw.contentPurchaseRevenue ?? raw.content_purchase_revenue)
  const totalRevenue = asNumber(raw.totalRevenue ?? raw.total_revenue, subscriptionRevenue + contentPurchaseRevenue)
  const items = Array.isArray(raw.items) ? raw.items : []
  return { subscriptionRevenue, contentPurchaseRevenue, totalRevenue, items }
}

function itemTitle(item: RevenueItem) {
  return item.description || item.subject || item.contentTitle || item.studentName || '收入'
}

function itemSubtitle(item: RevenueItem) {
  const parts = [
    item.type === 'content_purchase' ? '内容购买' : item.type === 'subscription' ? '订阅收入' : '收入流水',
    item.studentName,
    formatDate(item.createdAt || item.created_at),
  ].filter(Boolean)
  return parts.join(' · ')
}

export function CoachRevenueScreen() {
  const navigation = useNavigation<Navigation>()
  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [data, setData] = useState<RevenueDetails>(EMPTY_REVENUE)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (targetMonth = month, refresh = false) => {
    try {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError(null)
      const res = await safeRequest<any>('/api/coach/get-revenue-details', {
        method: 'POST',
        body: { month: targetMonth },
      })
      setData(normalizeRevenue(res))
    } catch (e) {
      setData(EMPTY_REVENUE)
      setError(e instanceof Error ? e.message : '收入明细加载失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [month])

  useEffect(() => {
    void load(month)
  }, [load, month])

  const currentMonth = useMemo(() => monthKey(new Date()), [])
  const canNext = month < currentMonth

  function changeMonth(offset: number) {
    const next = shiftMonth(month, offset)
    if (next > currentMonth) return
    setMonth(next)
  }

  if (loading) {
    return (
      <ScreenShell title="收入明细" subtitle="本月收入、订阅收入和内容收入。" onBack={() => navigation.goBack()}>
        <LoadingState title="正在加载收入明细" />
      </ScreenShell>
    )
  }

  return (
    <ScreenShell title="收入明细" subtitle="本月收入、订阅收入和内容收入。" onBack={() => navigation.goBack()}>
      <ScrollView
        horizontal={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(month, true)} tintColor={colors.brand} />}
        contentContainerStyle={styles.inner}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.monthBar}>
          <Pressable accessibilityRole="button" onPress={() => changeMonth(-1)} style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
            <IconFont name="icon-back" size={16} color={colors.brand} />
          </Pressable>
          <View style={styles.monthCenter}>
            <Text style={styles.monthTitle}>{formatMonth(month)}</Text>
            <Text style={styles.monthDesc}>{month === currentMonth ? '当前月份' : '历史月份'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={!canNext}
            onPress={() => changeMonth(1)}
            style={({ pressed }) => [styles.monthButton, !canNext && styles.disabled, pressed && styles.pressed]}
          >
            <IconFont name="icon-right-arrow" size={16} color={canNext ? colors.brand : colors.textMuted} />
          </Pressable>
        </View>

        {error ? <EmptyState title="加载失败" desc={error} icon="icon-goumaijilu" /> : null}

        {!error ? (
          <>
            <View style={styles.summary}>
              <View style={styles.summaryHeader}>
                <View style={styles.summaryIcon}>
                  <IconFont name="icon-goumaijilu" size={28} color={colors.surface} />
                </View>
                <View style={styles.summaryText}>
                  <Text style={styles.summaryLabel}>本月总收入</Text>
                  <Text style={styles.summaryValue}>{formatMoney(data.totalRevenue)}</Text>
                </View>
              </View>
              <View style={styles.splitGrid}>
                <RevenueMetric label="订阅收入" value={data.subscriptionRevenue} tone="#29C3A3" />
                <RevenueMetric label="内容收入" value={data.contentPurchaseRevenue} tone="#5C8DFF" />
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>收入流水</Text>
              <Text style={styles.sectionMeta}>{data.items.length} 条</Text>
            </View>

            {data.items.length === 0 ? (
              <EmptyState title="暂无收入流水" desc="该月份还没有订阅或内容购买收入。" icon="icon-goumaijilu" />
            ) : (
              <View style={styles.list}>
                {data.items.map((item, index) => (
                  <Card key={item.id || `${item.createdAt || item.created_at || 'row'}-${index}`} style={styles.itemCard}>
                    <View style={styles.itemIcon}>
                      <IconFont name={item.type === 'content_purchase' ? 'icon-knowledge' : 'icon-vips'} size={18} color={colors.surface} />
                    </View>
                    <View style={styles.itemBody}>
                      <Text style={styles.itemTitle}>{itemTitle(item)}</Text>
                      <Text style={styles.itemDesc}>{itemSubtitle(item)}</Text>
                    </View>
                    <Text style={styles.itemAmount}>+{formatMoney(item.amount)}</Text>
                  </Card>
                ))}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </ScreenShell>
  )
}

function RevenueMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <View style={styles.metric}>
      <View style={[styles.metricDot, { backgroundColor: tone }]} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{formatMoney(value)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  inner: {
    gap: spacing.sm,
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
  },
  monthCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  monthTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  monthDesc: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  summary: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  splitGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metric: {
    flex: 1,
    gap: 4,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  metricDot: {
    width: 20,
    height: 4,
    borderRadius: radius.pill,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  metricValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  sectionMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  list: {
    gap: spacing.sm,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  itemBody: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  itemDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  itemAmount: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.74,
  },
})
