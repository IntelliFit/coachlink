import { useEffect, useMemo, useState } from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { apiClient } from '../../api'
import { useAuth } from '../../providers/AuthProvider'
import { colors, controlHeight, radius, spacing, typography } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'
import { EmptyState, LoadingState, ScreenShell, SolidButton, errorMessage } from '../me/MeShared'
import {
  CALC_EXERCISE_CHIPS,
  calcRankingText,
  calcRecordMeta,
  calcScoreDecimals,
  formatCalcDate,
  formatCalcRecordScore,
  isCalcExerciseType,
  type CalcRecord,
  type CalcSummary,
} from './calculatorSummary'
import type { ExerciseType } from './streetliftingCalculator'

type Props = NativeStackScreenProps<RootStackParamList, 'StreetliftingCalculatorHistory'>
type HistoryRes = { summary: CalcSummary | null; records: CalcRecord[] }

/** 力量计算历史：历史最佳、最近一次、趣味排名和最近 20 次。对应小程序 calculator/history。 */
export function StreetliftingCalculatorHistoryScreen({ navigation, route }: Props) {
  const { isAuthenticated } = useAuth()
  const initial = route.params?.exerciseType
  const [exerciseType, setExerciseType] = useState<ExerciseType>(isCalcExerciseType(initial) ? initial : 'weighted_pullup')
  const [payload, setPayload] = useState<HistoryRes | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    // 切换动作时不留上一个动作的记录，失败时也不会张冠李戴
    setPayload(null)
    apiClient.request<HistoryRes>('/api/streetlifting-index/calculator/history', { method: 'POST', body: { exerciseType, page: 1, limit: 20 }, timeoutMs: 12000 })
      .then((data) => { if (!cancelled) setPayload(data) })
      .catch((loadError) => { if (!cancelled) setError(errorMessage(loadError, '加载力量计算历史失败')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => {
      cancelled = true
    }
  }, [exerciseType, isAuthenticated])

  const title = useMemo(() => CALC_EXERCISE_CHIPS.find((item) => item.value === exerciseType)?.title || '力量计算器', [exerciseType])
  const summary = payload?.summary || null
  const records = payload?.records || []
  const decimals = calcScoreDecimals(exerciseType)

  if (!isAuthenticated) {
    return (
      <ScreenShell title="历史记录" onBack={() => navigation.goBack()}>
        <EmptyState title="登录后查看历史记录" desc="力量计算历史、历史最佳和趣味排名都属于个人数据，需要登录后才能查看。" />
        <SolidButton label="前往登录" onPress={() => navigation.navigate('Login')} />
      </ScreenShell>
    )
  }

  return (
    <ScreenShell title="历史记录" subtitle={title} onBack={() => navigation.goBack()}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {CALC_EXERCISE_CHIPS.map((item) => {
          const active = item.value === exerciseType
          return (
            <Pressable key={item.value} accessibilityRole="tab" accessibilityLabel={item.title} accessibilityState={{ selected: active }} onPress={() => setExerciseType(item.value)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {loading && !payload ? <LoadingState title="正在加载历史" /> : null}
      {!loading && error ? <EmptyState title="加载失败" desc={error} /> : null}

      {payload ? (
        <>
          <View style={styles.grid}>
            <View style={styles.card}>
              <Text style={styles.label}>历史最佳</Text>
              <Text style={styles.value}>{formatCalcRecordScore(summary?.personalBestRecord, exerciseType)}</Text>
              <Text style={styles.desc}>{summary?.personalBestRecord ? `${summary.personalBestRecord.estimated1RMKg.toFixed(1)} kg 估算 1RM` : '还没有历史最佳'}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>最近一次</Text>
              <Text style={styles.value}>{formatCalcRecordScore(summary?.latestRecord, exerciseType)}</Text>
              <Text style={styles.desc}>{summary?.latestRecord ? formatCalcDate(summary.latestRecord.createdAt) : '暂无记录'}</Text>
            </View>
          </View>

          <View style={styles.ranking}>
            <Text style={styles.label}>趣味排名</Text>
            <Text style={styles.bucket}>{summary?.ranking?.bucketTitle || `${title}趣味榜`}</Text>
            <Text style={styles.rankingValue}>{calcRankingText(summary)}</Text>
            <Text style={styles.desc}>{summary?.ranking?.eligible ? `同动作趣味榜共 ${summary.ranking.totalParticipants} 人` : '仅正向计算会进入趣味排名'}</Text>
          </View>

          <Text style={styles.sectionTitle}>最近 20 次</Text>
          {records.length === 0 ? <Text style={styles.desc}>这个动作还没有历史记录，去计算器算一次吧。</Text> : null}
          {records.map((record) => (
            <View key={record.id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowScore}>{record.finalScore.toFixed(decimals)}</Text>
                <Text style={styles.desc}>{calcRecordMeta(record)}</Text>
              </View>
              <View style={styles.rowSide}>
                <Text style={styles.level}>{record.resultLevel || '已计算'}</Text>
                <Text style={styles.desc}>{formatCalcDate(record.createdAt)}</Text>
              </View>
            </View>
          ))}
        </>
      ) : null}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  chips: { gap: spacing.xs },
  // 与小程序 ClChip 一致
  chip: { minHeight: controlHeight.chip, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  chipActive: { backgroundColor: colors.selected },
  chipText: { color: colors.textSecondary, ...typography.meta },
  chipTextActive: { color: colors.selectedText, fontWeight: '500' },
  grid: { flexDirection: 'row', gap: spacing.xs },
  card: { flex: 1, gap: 2, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.textTertiary, fontSize: 12, fontWeight: '600' },
  value: { color: colors.text, fontSize: 24, fontWeight: '700' },
  desc: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  ranking: { gap: 2, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.brandSoft },
  bucket: { color: colors.text, fontSize: 13, fontWeight: '600' },
  rankingValue: { color: colors.brand, fontSize: 16, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  rowMain: { flex: 1, gap: 2 },
  rowScore: { color: colors.text, fontSize: 18, fontWeight: '700' },
  rowSide: { alignItems: 'flex-end', gap: 2 },
  level: { color: colors.brand, fontSize: 12, fontWeight: '600' },
})
