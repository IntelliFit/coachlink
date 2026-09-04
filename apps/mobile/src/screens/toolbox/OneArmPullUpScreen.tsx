import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../../navigation/types'
import { Page } from '../../components/Page'
import { IconFont } from '../../components/IconFont'
import { colors, radius, spacing } from '../../theme'
import {
  calculateOneArmPullUpReadiness,
  formatAssessmentKg,
} from './oneArmPullUpModel'

type Props = NativeStackScreenProps<RootStackParamList, 'OneArmPullUp'>
const STORAGE_KEY = 'one_arm_pull_up_assessment_v1'

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  )
}

function TrainingItem({ index, name, dose }: { index: number; name: string; dose: string }) {
  return (
    <View style={styles.trainingItem}>
      <View style={styles.trainingIndex}><Text style={styles.trainingIndexText}>{index}</Text></View>
      <View style={styles.trainingMain}>
        <Text style={styles.trainingName}>{name}</Text>
        <Text style={styles.trainingDose}>{dose}</Text>
      </View>
    </View>
  )
}

export function OneArmPullUpScreen({ navigation }: Props) {
  const [bodyWeightInput, setBodyWeightInput] = useState('70')
  const [additionalWeightInput, setAdditionalWeightInput] = useState('40')

  useEffect(() => {
    let active = true
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!active || !raw) return
      try {
        const parsed = JSON.parse(raw)
        if (parsed?.bodyWeight) setBodyWeightInput(String(parsed.bodyWeight))
        if (parsed?.additionalWeight !== undefined) setAdditionalWeightInput(String(parsed.additionalWeight))
      } catch {}
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        bodyWeight: bodyWeightInput,
        additionalWeight: additionalWeightInput,
      }))
    }, 250)
    return () => clearTimeout(timer)
  }, [additionalWeightInput, bodyWeightInput])

  const result = useMemo(
    () => calculateOneArmPullUpReadiness(Number(bodyWeightInput), Number(additionalWeightInput)),
    [additionalWeightInput, bodyWeightInput],
  )

  async function shareResult() {
    if (!result) return
    const progress = Math.round(result.progress)
    try {
      await Share.share({
        title: 'CoachLink 单手引体评估',
        message: `我的单手引体准备度：${result.level.name}，达到经验门槛的 ${progress}%。目标外加重量 ${formatAssessmentKg(result.targetAdditionalWeight)}。`,
      })
    } catch {
      Alert.alert('分享失败', '暂时无法调起系统分享，请稍后重试。')
    }
  }

  return (
    <Page title="单手引体评估" subtitle="用严格负重引体 1RM 估算当前阶段，并生成 8 周训练建议。">
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <IconFont name="icon-back" color={colors.brand} size={18} />
        <Text style={styles.backText}>返回工具箱</Text>
      </Pressable>

      <View style={styles.hero}>
        <Text style={styles.heroKicker}>负重引体 → 单手引体</Text>
        <Text style={styles.heroTitle}>你离单手引体还有多远？</Text>
        <Text style={styles.heroDescription}>输入严格负重引体 1RM，查看距离“外加 0.8 倍体重”经验门槛还有多少。</Text>
        <View style={styles.heroStats}>
          <Metric label="必填数据" value="2 个" />
          <Metric label="完成测算" value="1 分钟" />
          <Metric label="每周训练" value="2 天" />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.kicker}>输入你的成绩</Text>
        <Text style={styles.title}>使用同一动作标准，结果才有可比性</Text>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>当前体重</Text>
          <View style={styles.inputShell}>
            <TextInput value={bodyWeightInput} onChangeText={setBodyWeightInput} keyboardType="decimal-pad" placeholder="例如 70" placeholderTextColor={colors.textMuted} style={styles.input} />
            <Text style={styles.inputUnit}>kg</Text>
          </View>
          <Text style={styles.hint}>使用最近一次稳定体重。</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>负重引体 1RM 外加重量</Text>
          <View style={styles.inputShell}>
            <TextInput value={additionalWeightInput} onChangeText={setAdditionalWeightInput} keyboardType="decimal-pad" placeholder="例如 40" placeholderTextColor={colors.textMuted} style={styles.input} />
            <Text style={styles.inputUnit}>kg</Text>
          </View>
          <Text style={styles.hint}>不含体重；直臂起始，下巴明确过杠。</Text>
        </View>
        {!result ? <Text style={styles.error}>请输入大于 0 的体重，以及不小于 0 的外加重量。</Text> : null}
      </View>

      {result ? (
        <>
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={styles.resultMain}>
                <Text style={styles.kicker}>当前阶段</Text>
                <Text style={styles.resultTitle}>{result.level.name}</Text>
                <Text style={styles.resultSummary}>{result.level.summary}</Text>
              </View>
              <View style={styles.badge}><Text style={styles.badgeText}>{result.progress >= 100 ? '已过门槛' : `${Math.round(result.progress)}%`}</Text></View>
            </View>

            <View style={styles.progressTop}>
              <Text style={styles.progressValue}>{Math.round(result.progress)}%</Text>
              <View><Text style={styles.targetLabel}>目标外加重量</Text><Text style={styles.targetValue}>{formatAssessmentKg(result.targetAdditionalWeight)}</Text></View>
            </View>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${result.progressWidth}%` }]} /></View>
            <View style={styles.progressEnds}><Text style={styles.progressEndText}>自重基础</Text><Text style={styles.progressEndText}>0.8 × 体重门槛</Text></View>

            <View style={styles.metricGrid}>
              <Metric label="还差外加重量" value={result.gap > 0 ? formatAssessmentKg(result.gap) : '0 kg'} />
              <Metric label="外加 / 体重" value={`${result.additionalRatio.toFixed(2)}×`} />
              <Metric label="系统重量指数" value={`${result.systemRatio.toFixed(2)}×`} />
              <Metric label="单引等效体重" value={formatAssessmentKg(result.equivalentBodyWeight)} />
            </View>

            <View style={styles.focusCard}><Text style={styles.focusLabel}>本阶段最重要的事</Text><Text style={styles.focusValue}>{result.level.focus}</Text></View>
            <Text style={styles.note}>
              {result.progress >= 100
                ? '力量门槛不等于动作必然成功。接下来重点练握杠、肩胛起拉、抗旋转和单侧顶端控制。'
                : `按经验模型，你还需要把严格负重 1RM 提高约 ${formatAssessmentKg(result.gap)}。完成下方 8 周训练后再复测。`}
            </Text>
            <Pressable onPress={shareResult} style={styles.shareButton}><IconFont name="icon-share" color="#FFFFFF" size={18} /><Text style={styles.shareText}>分享测算结果</Text></Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.kicker}>8 周简易计划</Text>
            <Text style={styles.title}>每周练 2 次，至少间隔 48 小时</Text>
            <Text style={styles.description}>每组保留 1–2 次余力。第 4 周总组数减 30%，第 8 周末复测。</Text>
            <View style={styles.session}>
              <Text style={styles.sessionLabel}>训练 A · 最大力量日</Text>
              <TrainingItem index={1} name="严格负重引体" dose="5 × 3，最后一组仍保留 1 次余力" />
              <TrainingItem index={2} name="顶端停顿引体" dose="4 × 3，顶端停 2 秒" />
              <TrainingItem index={3} name="单臂悬垂" dose="3 × 15–30 秒/侧，可用另一手轻扶" />
            </View>
            <View style={styles.session}>
              <Text style={styles.sessionLabel}>训练 B · 单侧转化日</Text>
              <TrainingItem index={1} name={result.level.unilateralExercise} dose="左右都从较弱侧开始，质量优先" />
              <TrainingItem index={2} name="爆发胸触杠引体" dose="5 × 2，充分休息，不做到力竭" />
              <TrainingItem index={3} name="单臂肩胛下沉" dose="3 × 6/侧，保持肘伸直，可用另一手或弹力带辅助" />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.kicker}>怎么算的？</Text>
            <View style={styles.formula}><Text style={styles.formulaLabel}>经验门槛</Text><Text style={styles.formulaValue}>目标 AW = 0.8 × BW</Text></View>
            <View style={styles.formula}><Text style={styles.formulaLabel}>单引等效体重</Text><Text style={styles.formulaValue}>(BW + AW) ÷ 1.8</Text></View>
            <View style={styles.formula}><Text style={styles.formulaLabel}>等效差值 x</Text><Text style={styles.formulaValue}>(AW − 0.8BW) ÷ 1.8</Text></View>
            <Text style={styles.equivalent}>你的等效差值为 {result.equivalentDelta >= 0 ? '+' : ''}{formatAssessmentKg(result.equivalentDelta)}</Text>
            <Text style={styles.disclaimer}>BW 是体重，AW 是严格负重引体 1RM 的外加重量。0.8 是经验假设，不是医学或生物力学定律；臂长、握力、肩胛稳定、抗旋转和动作标准都会影响真实表现。</Text>
          </View>
        </>
      ) : null}
    </Page>
  )
}

const styles = StyleSheet.create({
  backButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start' },
  backText: { color: colors.brand, fontSize: 13, fontWeight: '800' },
  hero: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.xl, backgroundColor: '#1F1F1F' },
  heroKicker: { color: 'rgba(255,255,255,0.68)', fontSize: 12, fontWeight: '800' },
  heroTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', lineHeight: 34 },
  heroDescription: { color: 'rgba(255,255,255,0.76)', fontSize: 13, lineHeight: 20 },
  heroStats: { flexDirection: 'row', gap: spacing.xs },
  card: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  kicker: { color: colors.brand, fontSize: 12, fontWeight: '900' },
  title: { color: colors.text, fontSize: 19, fontWeight: '900', lineHeight: 26 },
  description: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  field: { gap: spacing.xs },
  fieldLabel: { color: colors.text, fontSize: 14, fontWeight: '800' },
  inputShell: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, paddingHorizontal: spacing.sm, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '800' },
  inputUnit: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
  hint: { color: colors.textMuted, fontSize: 11, lineHeight: 17 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  resultCard: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.xl, backgroundColor: '#FFF7F4', borderWidth: 1, borderColor: '#EBC0B3' },
  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  resultMain: { flex: 1, gap: 4 },
  resultTitle: { color: colors.text, fontSize: 24, fontWeight: '900' },
  resultSummary: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.brand },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  progressTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.sm },
  progressValue: { color: colors.brand, fontSize: 36, fontWeight: '900' },
  targetLabel: { color: colors.textMuted, fontSize: 11, textAlign: 'right' },
  targetValue: { color: colors.text, fontSize: 15, fontWeight: '900', textAlign: 'right' },
  progressTrack: { height: 12, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: '#E7D8D2' },
  progressFill: { height: 12, borderRadius: radius.pill, backgroundColor: colors.brand },
  progressEnds: { flexDirection: 'row', justifyContent: 'space-between' },
  progressEndText: { color: colors.textMuted, fontSize: 10 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  metric: { flexGrow: 1, flexBasis: '30%', minHeight: 72, justifyContent: 'center', gap: 4, padding: spacing.xs, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.86)', borderWidth: 1, borderColor: 'rgba(207,109,78,0.16)' },
  metricLabel: { color: colors.textMuted, fontSize: 10 },
  metricValue: { color: colors.text, fontSize: 14, fontWeight: '900' },
  focusCard: { gap: 4, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: '#FFFFFF' },
  focusLabel: { color: colors.textMuted, fontSize: 11 },
  focusValue: { color: colors.brand, fontSize: 15, fontWeight: '900', lineHeight: 22 },
  note: { color: colors.textSecondary, fontSize: 12, lineHeight: 19 },
  shareButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.lg, backgroundColor: colors.brand },
  shareText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  session: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.background },
  sessionLabel: { color: colors.brand, fontSize: 14, fontWeight: '900' },
  trainingItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  trainingIndex: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brandSoft },
  trainingIndexText: { color: colors.brand, fontSize: 12, fontWeight: '900' },
  trainingMain: { flex: 1, gap: 4 },
  trainingName: { color: colors.text, fontSize: 13, fontWeight: '800' },
  trainingDose: { color: colors.textSecondary, fontSize: 11, lineHeight: 17 },
  formula: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted },
  formulaLabel: { color: colors.textSecondary, fontSize: 12 },
  formulaValue: { color: colors.text, fontSize: 12, fontWeight: '800' },
  equivalent: { color: colors.brand, fontSize: 13, fontWeight: '900' },
  disclaimer: { color: colors.textMuted, fontSize: 11, lineHeight: 18 },
})
