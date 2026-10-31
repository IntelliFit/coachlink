import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radius, spacing } from '../../theme'
import {
  describePowerMeasurement,
  formatComparisonDelta,
  formatPowerMetric,
  isComparisonImproved,
  type PowerAnalysisAssessment,
  type PowerAnalysisCheckStatus,
  type PowerAnalysisJobDto,
  type PowerAnalysisMeasurement,
  type PowerComparisonRow,
} from './powerAnalysisModel'

const STATUS_LABEL: Record<PowerAnalysisCheckStatus, string> = {
  issue: '问题',
  warn: '注意',
  info: '信息',
  good: '良好',
  unavailable: '无法评估',
}

/** 榜单模板 ID，与小程序一致。 */
export const POWER_CHALLENGE_TEMPLATE_IDS = {
  power: 'b7bc1548-08ed-4f52-90cc-f5b22a785103',
  speed: 'b7bc1548-08ed-4f52-90cc-f5b22a785104',
} as const

/** 动作评估，对应小程序 AssessmentSection。APP 结果视频在弹层里播放，时间点只做提示，不能跳转。 */
export function PowerAssessmentCard({ assessment, measurement }: { assessment?: PowerAnalysisAssessment; measurement?: PowerAnalysisMeasurement }) {
  if (!assessment) return null
  const measurementText = describePowerMeasurement(measurement)
  return (
    <View style={styles.card}>
      <Text style={styles.title}>动作评估</Text>
      <Text style={styles.meta}>机位：{assessment.viewLabelZh}（推荐{assessment.recommendedViewZh}）</Text>
      <View style={styles.chips}>
        {(['issue', 'warn', 'info', 'good', 'unavailable'] as PowerAnalysisCheckStatus[])
          .filter((status) => status !== 'info' || (assessment.counts?.info ?? 0) > 0)
          .map((status) => <StatusChip key={status} status={status} label={`${STATUS_LABEL[status]} ${assessment.counts?.[status] ?? 0}`} />)}
      </View>
      {measurementText ? <Text style={styles.meta}>{measurementText}</Text> : null}
      {(measurement?.warningsZh || []).map((warning) => <Text key={warning} style={styles.warning}>{warning}</Text>)}
      {assessment.checks.length === 0 ? <Text style={styles.meta}>没有识别到完整动作，暂时无法评估姿态。</Text> : null}
      {assessment.checks.map((check, checkIndex) => (
        <View key={`${check.code}-${checkIndex}`} style={styles.check}>
          <StatusChip status={check.status} label={STATUS_LABEL[check.status]} />
          <View style={styles.flex}>
            <Text style={styles.checkTitle}>{check.titleZh}</Text>
            <Text style={styles.meta}>{check.detailZh}</Text>
            {check.timesS.length > 0 ? (
              <Text style={styles.meta}>{check.timesS.map((time, index) => `第 ${check.repIndexes[index] ?? index + 1} 次 · ${time.toFixed(1)}s`).join('　')}</Text>
            ) : null}
          </View>
        </View>
      ))}
      <Text style={styles.footnote}>评估基于视频关键点自动估算，阈值为通用训练参考，不是比赛判罚或医学诊断。</Text>
    </View>
  )
}

function StatusChip({ status, label }: { status: PowerAnalysisCheckStatus; label: string }) {
  return <Text style={[styles.chip, status === 'issue' && styles.chipIssue, status === 'warn' && styles.chipWarn, status === 'good' && styles.chipGood]}>{label}</Text>
}

/** 全国功率挑战排名。 */
export function PowerRankingCard({ ranking, onOpenBoard }: { ranking: NonNullable<PowerAnalysisJobDto['ranking']>; onOpenBoard: (id: string) => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>全国功率挑战</Text>
      <Text style={styles.title}>你的真实视频成绩排名</Text>
      <Text style={styles.meta}>{ranking.scopeLabel}</Text>
      <View style={styles.row}>
        {ranking.power.rank > 0 ? (
          <View style={styles.rankCell}>
            <Text style={styles.meta}>最大功率榜</Text>
            <Text style={styles.rank}>第 {ranking.power.rank} 名</Text>
            <Text style={styles.meta}>个人最好 {formatPowerMetric(ranking.power.bestValue, 0)} W</Text>
            <Text style={styles.meta}>共 {ranking.power.participantTotal} 人 · 领先 {ranking.power.percentile}% 参赛者</Text>
          </View>
        ) : null}
        {ranking.speed.rank > 0 ? (
          <View style={styles.rankCell}>
            <Text style={styles.meta}>最快速度榜</Text>
            <Text style={styles.rank}>第 {ranking.speed.rank} 名</Text>
            <Text style={styles.meta}>个人最好 {formatPowerMetric(ranking.speed.bestValue, 2)} m/s</Text>
            <Text style={styles.meta}>共 {ranking.speed.participantTotal} 人 · 领先 {ranking.speed.percentile}% 参赛者</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.footnote}>全国榜仅指 CoachLink 全国参赛用户；绝对功率会受体重、负重和动作类型影响。</Text>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="查看功率榜" onPress={() => onOpenBoard(POWER_CHALLENGE_TEMPLATE_IDS.power)} style={[styles.button, styles.buttonPrimary]}>
          <Text style={styles.buttonPrimaryText}>查看功率榜</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="查看速度榜" onPress={() => onOpenBoard(POWER_CHALLENGE_TEMPLATE_IDS.speed)} style={styles.button}>
          <Text style={styles.buttonText}>查看速度榜</Text>
        </Pressable>
      </View>
    </View>
  )
}

/** 前测 vs 后测。 */
export function PowerComparisonCard({ rows, verdict, onClear }: { rows: PowerComparisonRow[]; verdict: string; onClear: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.kicker}>前测 vs 后测</Text>
          <Text style={styles.title}>训练表现对比</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="结束对比" onPress={onClear} style={styles.linkButton}>
          <Text style={styles.link}>结束对比</Text>
        </Pressable>
      </View>
      <Text style={[styles.verdict, verdict.includes('后测') && styles.verdictImproved]}>{verdict}</Text>
      <View style={styles.tableRow}>
        <Text style={[styles.cellHead, styles.cellLabel]}>指标</Text>
        <Text style={styles.cellHead}>前测</Text>
        <Text style={styles.cellHead}>后测</Text>
        <Text style={styles.cellHead}>变化</Text>
      </View>
      {rows.map((row) => (
        <View key={row.key} style={styles.tableRow}>
          <Text style={[styles.cell, styles.cellLabel]}>{row.label}</Text>
          <Text style={styles.cell}>{row.before.toFixed(row.digits)} {row.unit}</Text>
          <Text style={styles.cell}>{row.after.toFixed(row.digits)} {row.unit}</Text>
          <Text style={[styles.cell, isComparisonImproved(row) && styles.cellImproved]}>{formatComparisonDelta(row)}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  kicker: { color: colors.brand, fontSize: 12, fontWeight: '600' },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  warning: { color: colors.warning, fontSize: 12, lineHeight: 18 },
  footnote: { color: colors.textTertiary, fontSize: 11, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: { overflow: 'hidden', alignSelf: 'flex-start', paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.pill, color: colors.textSecondary, backgroundColor: colors.surfaceMuted, fontSize: 11, fontWeight: '600' },
  chipIssue: { color: colors.danger, backgroundColor: colors.brandSoft },
  chipWarn: { color: colors.warning, backgroundColor: colors.surfaceMuted },
  chipGood: { color: colors.success, backgroundColor: colors.successSoft },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, paddingVertical: 4 },
  checkTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', gap: spacing.xs },
  rankCell: { flex: 1, gap: 2, padding: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  rank: { color: colors.text, fontSize: 18, fontWeight: '700' },
  button: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  buttonText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  buttonPrimary: { backgroundColor: colors.brand, borderColor: colors.brand },
  buttonPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  linkButton: { minHeight: 48, justifyContent: 'center' },
  link: { color: colors.brand, fontSize: 13, fontWeight: '600' },
  verdict: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  verdictImproved: { color: colors.success },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  cellHead: { flex: 1, color: colors.textTertiary, fontSize: 11, fontWeight: '600' },
  cellLabel: { flex: 1.2 },
  cell: { flex: 1, color: colors.text, fontSize: 12 },
  cellImproved: { color: colors.success, fontWeight: '600' },
})
