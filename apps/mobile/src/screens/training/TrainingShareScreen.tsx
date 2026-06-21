import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { apiClient } from '../../api'
import { IconFont } from '../../components/IconFont'
import { Page } from '../../components/Page'
import { colors, radius, shadow, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<RootStackParamList, 'TrainingShare'>

type ShareData = {
  workoutName: string
  completedAt: string
  totalSets: number
  totalReps: number
  totalVolume: number
  prCount: number
  duration: number
}

function pickData(payload: any) {
  return payload?.data?.data || payload?.data || payload || {}
}

function formatDate(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

export function TrainingShareScreen({ navigation, route }: Props) {
  const executionId = route.params?.executionId || ''
  const [data, setData] = useState<ShareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    let alive = true
    async function loadData() {
      if (!executionId) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const res = await apiClient.request('/api/execution/share-info', {
          method: 'POST',
          body: { id: executionId },
          timeoutMs: 12000,
        })
        const row = pickData(res)
        if (!alive) return
        setData({
          workoutName: row.planName || '今日训练',
          completedAt: row.completedAt || row.completed_at || '',
          totalSets: Number(row.totalSets || row.total_sets || 0),
          totalReps: Number(row.totalReps || row.total_reps || 0),
          totalVolume: Number(row.totalVolume || row.total_volume || 0),
          prCount: Array.isArray(row.prRecords) ? row.prRecords.length : Number(row.prCount || 0),
          duration: Number(row.durationMinutes || row.duration_minutes || 0),
        })
      } catch (error: any) {
        Alert.alert('加载分享数据失败', error?.message || '请稍后重试')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void loadData()
    return () => { alive = false }
  }, [executionId])

  const shareText = useMemo(() => {
    if (!data) return ''
    return [
      '训练完成！',
      data.workoutName,
      `${formatDate(data.completedAt)} · ${data.duration || 0} 分钟`,
      `总容量 ${data.totalVolume || 0}kg · ${data.totalSets || 0} 组 · PR ${data.prCount || 0}`,
      '来自 CoachLink 健身',
    ].filter(Boolean).join('\n')
  }, [data])

  async function copyCardText() {
    if (!shareText) return
    await Clipboard.setStringAsync(shareText)
    Alert.alert('已复制', '分享文案已复制，可直接粘贴分享。')
  }

  async function shareCard() {
    if (!shareText || sharing) return
    setSharing(true)
    try {
      await Share.share({ message: shareText })
    } catch (error: any) {
      Alert.alert('分享失败', error?.message || '请稍后重试')
    } finally {
      setSharing(false)
    }
  }

  if (loading) {
    return (
      <Page>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.loadingText}>加载分享数据...</Text>
        </View>
      </Page>
    )
  }

  return (
    <Page contentContainerStyle={styles.page}>
      <View style={styles.previewCard}>
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            <IconFont name="icon-star" color={colors.brand} size={22} />
            <Text style={styles.title}>训练完成！</Text>
          </View>
          <Text style={styles.subtitle}>{data?.workoutName || '今日训练'}</Text>
          <Text style={styles.date}>{formatDate(data?.completedAt)}</Text>
        </View>

        <View style={styles.statsSection}>
          <View style={styles.mainStat}>
            <Text style={styles.mainValue}>{data?.totalVolume || 0}</Text>
            <Text style={styles.mainLabel}>总容量 (kg)</Text>
          </View>

          <View style={styles.subStats}>
            <View style={styles.subStat}>
              <Text style={styles.subValue}>{data?.totalSets || 0}</Text>
              <Text style={styles.subLabel}>组数</Text>
            </View>
            <View style={styles.subStat}>
              <Text style={styles.subValue}>{data?.totalReps || 0}</Text>
              <Text style={styles.subLabel}>次数</Text>
            </View>
            <View style={styles.subStat}>
              <Text style={[styles.subValue, styles.highlight]}>{data?.prCount || 0}</Text>
              <Text style={styles.subLabel}>PR</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>来自 CoachLink 健身</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable disabled={sharing || !data} onPress={shareCard} style={[styles.primaryButton, (sharing || !data) && styles.disabled]}>
          <Text style={styles.primaryButtonText}>{sharing ? '分享中...' : '分享训练卡片'}</Text>
        </Pressable>
        <Pressable disabled={!data} onPress={copyCardText} style={[styles.secondaryButton, !data && styles.disabled]}>
          <Text style={styles.secondaryButtonText}>复制分享文案</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} style={styles.ghostButton}>
          <Text style={styles.ghostButtonText}>返回</Text>
        </Pressable>
      </View>
    </Page>
  )
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#667EEA',
  },
  loading: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 240 },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  previewCard: {
    borderRadius: 24,
    padding: spacing.lg,
    backgroundColor: '#FFFFFF',
    gap: spacing.lg,
    ...shadow,
  },
  cardHeader: { alignItems: 'center', gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { color: '#333333', fontSize: 24, fontWeight: '900' },
  subtitle: { color: '#666666', fontSize: 16, fontWeight: '700' },
  date: { color: '#999999', fontSize: 12 },
  statsSection: { gap: spacing.md },
  mainStat: { alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingBottom: spacing.md },
  mainValue: { color: '#667EEA', fontSize: 44, fontWeight: '900' },
  mainLabel: { color: '#999999', fontSize: 14 },
  subStats: { flexDirection: 'row', justifyContent: 'space-around' },
  subStat: { alignItems: 'center', gap: 4 },
  subValue: { color: '#333333', fontSize: 26, fontWeight: '900' },
  highlight: { color: '#FA8C16' },
  subLabel: { color: '#999999', fontSize: 12 },
  footer: { alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: spacing.md },
  footerText: { color: '#999999', fontSize: 12 },
  actions: { gap: spacing.sm },
  primaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  primaryButtonText: { color: '#667EEA', fontSize: 16, fontWeight: '900' },
  secondaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.20)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.36)' },
  secondaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  ghostButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  ghostButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.55 },
})
