import { useEffect, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { apiClient } from '../../api'
import { API_BASE_URL } from '../../config'
import { resolveImageThumbnailUrl } from '../../mediaUrl'
import { colors, radius, spacing } from '../../theme'
import { QUICK_START_TEMPLATES, type QuickStartTemplate } from './quickStart'

const LEVEL_LABELS: Record<string, string> = { beginner: '入门', intermediate: '进阶', advanced: '高阶' }

type PublicPlan = { id: string; slug?: string; name: string; level?: string; weeks?: number; daysPerWeek?: number; specialtyLabel?: string }

function pickPlans(payload: any): PublicPlan[] {
  const list = payload?.plans ?? payload?.data?.plans ?? payload?.data ?? []
  return Array.isArray(list) ? list.filter((item: any) => item?.id && item?.name) : []
}

/** 没有进行中计划时的首页：新用户、游客和等教练出计划的学员。对应小程序 today-training StarterHome。 */
export function StarterHome(props: {
  dateLabel: string
  guest: boolean
  waitingCoach: boolean
  onQuickStart: (template?: QuickStartTemplate) => void
  onFindCoach: () => void
  onContactCoach: () => void
  onOpenPlan: (plan: PublicPlan) => void
  onAllPlans: () => void
}) {
  const [plans, setPlans] = useState<PublicPlan[]>([])

  useEffect(() => {
    // 计划列表需要登录，游客只会拿到 401
    if (props.guest) return undefined
    let cancelled = false
    async function load() {
      try {
        const beginner = pickPlans(await apiClient.request('/api/knowledge/training-plans?level=beginner&limit=3&offset=0', { method: 'GET', timeoutMs: 10000 }))
        const list = beginner.length > 0
          ? beginner
          : pickPlans(await apiClient.request('/api/knowledge/training-plans?level=all&limit=3&offset=0', { method: 'GET', timeoutMs: 10000 }))
        if (!cancelled) setPlans(list.slice(0, 3))
      } catch (error) {
        console.warn('[starter-home] load plans failed', error)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [props.guest])

  return (
    <View style={styles.root}>
      <View>
        <Text style={styles.date}>{props.dateLabel}</Text>
        <Text style={styles.title}>{props.waitingCoach ? '教练正在制定计划' : '今天练点什么？'}</Text>
      </View>

      {props.waitingCoach ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>计划发布后会自动出现在这里。等待期间可以先自己练。</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="联系教练" onPress={props.onContactCoach} style={styles.noticeLink}>
            <Text style={styles.link}>联系教练 ›</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>快速开练</Text>
          <Text style={styles.sectionMeta}>动作和组数可在训练中改</Text>
        </View>
        <View style={styles.grid}>
          {QUICK_START_TEMPLATES.map((template) => (
            <Pressable key={template.key} accessibilityRole="button" accessibilityLabel={`快速开练：${template.name}`} onPress={() => props.onQuickStart(template)} style={styles.template}>
              <Image source={{ uri: resolveImageThumbnailUrl(template.image, API_BASE_URL, 360) }} resizeMode="contain" style={styles.templateImage} accessibilityIgnoresInvertColors />
              <Text style={styles.templateName} numberOfLines={1}>{template.name}</Text>
              <Text style={styles.templateMeta} numberOfLines={1}>{template.meta}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="自己选动作开练" onPress={() => props.onQuickStart()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>自己选动作开练</Text>
        </Pressable>
      </View>

      {plans.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>跟着免费计划练</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="全部计划" onPress={props.onAllPlans} style={styles.headerAction}>
              <Text style={styles.link}>全部计划</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.plansRow}>
            {plans.map((plan) => (
              <Pressable key={plan.id} accessibilityRole="button" accessibilityLabel={`查看计划：${plan.name}`} onPress={() => props.onOpenPlan(plan)} style={styles.plan}>
                <View style={styles.tags}>
                  {plan.specialtyLabel ? <Text style={[styles.tag, styles.tagClay]}>{plan.specialtyLabel}</Text> : null}
                  {plan.level ? <Text style={styles.tag}>{LEVEL_LABELS[plan.level] || plan.level}</Text> : null}
                </View>
                <Text style={styles.planName} numberOfLines={2}>{plan.name}</Text>
                <Text style={styles.planMeta}>{plan.weeks ?? '-'} 周 · {plan.daysPerWeek ?? '-'} 天/周</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <Pressable accessibilityRole="button" accessibilityLabel="看看教练" onPress={props.onFindCoach} style={styles.coach}>
        <View style={styles.coachCopy}>
          <Text style={styles.coachTitle}>想有人带你练？</Text>
          <Text style={styles.coachDesc}>教练按你的情况排计划、看训练视频纠动作</Text>
        </View>
        <Text style={styles.link}>看看教练 ›</Text>
      </Pressable>

      {props.guest ? <Text style={styles.hint}>可以先浏览动作，开始记录训练时再登录，训练记录会同步保存。</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  date: { color: colors.textTertiary, fontSize: 13 },
  title: { marginTop: 4, color: colors.text, fontSize: 22, fontWeight: '700' },
  notice: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.brandSoft },
  noticeText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  noticeLink: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { color: colors.brand, fontSize: 13, fontWeight: '600' },
  section: { gap: spacing.sm },
  sectionHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sectionMeta: { color: colors.textTertiary, fontSize: 12 },
  headerAction: { minHeight: 48, justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  template: { width: '48%', flexGrow: 1, gap: 4, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  templateImage: { width: '100%', height: 96, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  templateName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  templateMeta: { color: colors.textSecondary, fontSize: 12 },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  plansRow: { gap: spacing.xs },
  plan: { width: 200, gap: spacing.xs, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: { overflow: 'hidden', paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.pill, color: colors.textSecondary, backgroundColor: colors.surfaceMuted, fontSize: 11 },
  tagClay: { color: colors.brand, backgroundColor: colors.brandSoft },
  planName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  planMeta: { color: colors.textTertiary, fontSize: 12 },
  coach: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  coachCopy: { flex: 1, gap: 2 },
  coachTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  coachDesc: { color: colors.textSecondary, fontSize: 12 },
  hint: { color: colors.textTertiary, fontSize: 12, textAlign: 'center' },
})
