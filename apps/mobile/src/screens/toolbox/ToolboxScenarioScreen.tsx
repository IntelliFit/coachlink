import { useMemo, useState } from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { IconFont } from '../../components/IconFont'
import { Page } from '../../components/Page'
import { SectionCard } from '../../components/SectionCard'
import { colors, radius, shadow, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'
import { getScenarioQuickFix } from './scenarioQuickFixes'

type Props = NativeStackScreenProps<RootStackParamList, 'ToolboxScenario'>

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest ? `${minutes}分${rest}秒` : `${minutes}分钟`
}

export function ToolboxScenarioScreen({ navigation, route }: Props) {
  const scenario = useMemo(() => getScenarioQuickFix(route.params?.slug), [route.params?.slug])
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])

  const currentStep = scenario && currentStepIndex !== null ? scenario.steps[currentStepIndex] : null
  const finished = Boolean(scenario && scenario.steps.length > 0 && completedSteps.length === scenario.steps.length)

  const startFlow = () => {
    setCurrentStepIndex(0)
    setCompletedSteps([])
  }

  const completeCurrentStep = () => {
    if (!scenario || !currentStep || currentStepIndex === null) return
    setCompletedSteps((prev) => (prev.includes(currentStep.id) ? prev : [...prev, currentStep.id]))
    if (currentStepIndex < scenario.steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1)
    } else {
      setCurrentStepIndex(null)
    }
  }

  if (!scenario) {
    return (
      <Page>
        <Pressable onPress={() => navigation.goBack()} style={styles.backRow}>
          <IconFont name="icon-back" color={colors.text} size={18} />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        <SectionCard title="未找到该场景" description="这个场景可能还没有同步到 APP。">
          <Pressable onPress={() => navigation.goBack()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>返回工具箱</Text>
          </Pressable>
        </SectionCard>
      </Page>
    )
  }

  return (
    <Page>
      <Pressable onPress={() => navigation.goBack()} style={styles.backRow}>
        <IconFont name="icon-back" color={colors.text} size={18} />
        <Text style={styles.backText}>返回</Text>
      </Pressable>

      <View style={styles.heroCard}>
        <Image source={scenario.coverImage} style={styles.heroImage} resizeMode="cover" />
        <View style={styles.heroShade} />
        <View style={styles.heroBody}>
          <View style={styles.heroIcon}>
            <IconFont name={scenario.icon} color={colors.brand} size={26} />
          </View>
          <Text style={styles.heroTitle}>{scenario.title}</Text>
          <Text style={styles.heroDesc}>{scenario.description}</Text>
          <Text style={styles.heroMeta}>约 {scenario.durationMinutes} 分钟 · 共 {scenario.steps.length} 步</Text>
        </View>
      </View>

      {!currentStep && !finished ? (
        <Pressable onPress={startFlow} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>开始跟练</Text>
        </Pressable>
      ) : null}

      {currentStep ? (
        <View style={styles.currentCard}>
          <Image source={currentStep.image} style={styles.currentImage} resizeMode="cover" />
          <View style={styles.currentBody}>
            <Text style={styles.stepMeta}>第 {currentStepIndex! + 1} 步 · {formatDuration(currentStep.durationSeconds)}</Text>
            <Text style={styles.currentTitle}>{currentStep.title}</Text>
            <Text style={styles.currentDesc}>{currentStep.description}</Text>
            <Pressable onPress={completeCurrentStep} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>完成这一步</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <SectionCard title="全部步骤">
        <View style={styles.stepsList}>
          {scenario.steps.map((step, index) => {
            const isCompleted = completedSteps.includes(step.id)
            const isCurrent = currentStepIndex === index
            return (
              <View key={step.id} style={[styles.stepCard, isCurrent && styles.currentStepCard, isCompleted && styles.completedStepCard]}>
                <Image source={step.image} style={styles.stepImage} resizeMode="cover" />
                <View style={styles.stepMain}>
                  <View style={styles.stepTop}>
                    <View style={[styles.stepIndex, isCompleted && styles.stepIndexDone]}>
                      <Text style={[styles.stepIndexText, isCompleted && styles.stepIndexTextDone]}>{isCompleted ? '✓' : index + 1}</Text>
                    </View>
                    <Text style={styles.stepDuration}>{formatDuration(step.durationSeconds)}</Text>
                  </View>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.description}</Text>
                </View>
              </View>
            )
          })}
        </View>
      </SectionCard>

      {finished ? (
        <View style={styles.doneCard}>
          <Text style={styles.doneTitle}>练习完成</Text>
          <Text style={styles.doneDesc}>今天先做到这里，身体慢慢放松下来就很好。</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>返回工具箱</Text>
          </Pressable>
        </View>
      ) : null}
    </Page>
  )
}

const styles = StyleSheet.create({
  backRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  backText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  heroCard: {
    minHeight: 328,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: '#1F1F1F',
  },
  heroImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  heroShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  heroBody: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.md,
    gap: spacing.xs,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },
  heroDesc: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 22,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    fontWeight: '800',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.brand,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  currentCard: {
    overflow: 'hidden',
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  currentImage: {
    width: '100%',
    height: 208,
  },
  currentBody: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  stepMeta: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '900',
  },
  currentTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  currentDesc: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  stepsList: {
    gap: spacing.sm,
  },
  stepCard: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currentStepCard: {
    borderColor: colors.brand,
  },
  completedStepCard: {
    backgroundColor: '#F2F8F2',
  },
  stepImage: {
    width: '100%',
    height: 144,
  },
  stepMain: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  stepTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepIndex: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  stepIndexDone: {
    backgroundColor: colors.success,
  },
  stepIndexText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  stepIndexTextDone: {
    color: '#FFFFFF',
  },
  stepDuration: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  stepTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  stepDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 21,
  },
  doneCard: {
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  doneTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  doneDesc: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
})
