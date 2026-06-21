import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { IconFont, type IconFontName } from '../../components/IconFont'
import type { RootStackParamList } from '../../navigation/types'
import { colors, radius, shadow, spacing } from '../../theme'
import { Card, EmptyState, LoadingState, ScreenShell, safeRequest } from '../me/MeShared'

type Navigation = NativeStackNavigationProp<RootStackParamList>

type OverviewData = {
  totalStudentCount: number
  pendingReviewCount: number
  averageRating: number
  monthlyRevenue: number
  contentCount: number
  actionCount: number
  planTemplateCount: number
  questionReady: boolean
  pricingReady: boolean
  receivingAccountReady: boolean
  huifuOpenStatus: string | null
  huifuOpenMsg: string | null
}

type StatItem = {
  label: string
  value: string
  desc: string
  icon: IconFontName
  tone: string
  route?: keyof RootStackParamList
}

type ConfigItem = {
  title: string
  desc: string
  value?: string
  ready?: boolean
  icon: IconFontName
  tone: string
  route?: keyof RootStackParamList
}

const EMPTY_OVERVIEW: OverviewData = {
  totalStudentCount: 0,
  pendingReviewCount: 0,
  averageRating: 0,
  monthlyRevenue: 0,
  contentCount: 0,
  actionCount: 0,
  planTemplateCount: 0,
  questionReady: false,
  pricingReady: false,
  receivingAccountReady: false,
  huifuOpenStatus: null,
  huifuOpenMsg: null,
}

function asNumber(value: unknown, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function asBoolean(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return ['1', 'true', 'yes'].includes(value.trim().toLowerCase())
  return false
}

function normalizeOverview(payload: any): OverviewData {
  const raw = payload?.overview || payload?.data || payload || {}
  return {
    totalStudentCount: asNumber(raw.totalStudentCount ?? raw.total_student_count),
    pendingReviewCount: asNumber(raw.pendingReviewCount ?? raw.pending_review_count),
    averageRating: asNumber(raw.averageRating ?? raw.average_rating),
    monthlyRevenue: asNumber(raw.monthlyRevenue ?? raw.monthly_revenue),
    contentCount: asNumber(raw.contentCount ?? raw.content_count),
    actionCount: asNumber(raw.actionCount ?? raw.action_count),
    planTemplateCount: asNumber(raw.planTemplateCount ?? raw.plan_template_count),
    questionReady: asBoolean(raw.questionReady ?? raw.question_ready),
    pricingReady: asBoolean(raw.pricingReady ?? raw.pricing_ready),
    receivingAccountReady: asBoolean(raw.receivingAccountReady ?? raw.receiving_account_ready),
    huifuOpenStatus: raw.huifuOpenStatus ?? raw.huifu_open_status ?? null,
    huifuOpenMsg: raw.huifuOpenMsg ?? raw.huifu_open_msg ?? null,
  }
}

function formatMoney(value: number) {
  return `¥${value.toFixed(2)}`
}

export function CoachDashboardScreen() {
  const navigation = useNavigation<Navigation>()
  const [overview, setOverview] = useState<OverviewData>(EMPTY_OVERVIEW)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError(null)
      const res = await safeRequest<any>('/api/coach/get-overview-data')
      setOverview(normalizeOverview(res))
    } catch (e) {
      const message = e instanceof Error ? e.message : '教练工作台加载失败'
      setError(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function go(route?: keyof RootStackParamList) {
    if (!route) {
      Alert.alert('迁移中', '该教练模块正在迁移到 APP，当前入口已按小程序结构预留。')
      return
    }
    navigation.navigate(route as any)
  }

  const stats: StatItem[] = [
    {
      label: '总学员数',
      value: String(overview.totalStudentCount),
      desc: '当前 active 学员',
      icon: 'icon-friends-o',
      tone: '#CF6D4E',
    },
    {
      label: '待点评视频',
      value: String(overview.pendingReviewCount),
      desc: '训练视频待反馈',
      icon: 'icon-video',
      tone: '#FFA940',
      route: 'CoachVideos',
    },
    {
      label: '平均评分',
      value: overview.averageRating.toFixed(1),
      desc: '学员评价均值',
      icon: 'icon-star',
      tone: '#D6A100',
    },
    {
      label: '本月收入',
      value: formatMoney(overview.monthlyRevenue),
      desc: '钱包收入口径',
      icon: 'icon-goumaijilu',
      tone: '#29C3A3',
      route: 'CoachRevenue',
    },
  ]

  const assets: ConfigItem[] = [
    {
      title: '收款账户',
      desc: overview.huifuOpenMsg || '用于平台分账和银行卡提现',
      value: overview.receivingAccountReady ? '已开通' : '待绑定',
      ready: overview.receivingAccountReady,
      icon: 'icon-goumaijilu',
      tone: '#29C3A3',
      route: 'CoachWallet',
    },
    {
      title: '订阅定价',
      desc: '设置您的会员方案',
      value: overview.pricingReady ? '已激活' : '待配置',
      ready: overview.pricingReady,
      icon: 'icon-vips',
      tone: '#CF6D4E',
      route: 'CoachPricing',
    },
    {
      title: '学员问卷',
      desc: '收集学员基础信息',
      value: overview.questionReady ? '已开启' : '待设置',
      ready: overview.questionReady,
      icon: 'icon-pencil',
      tone: '#FFA940',
      route: 'CoachQuestionnaires',
    },
    {
      title: '内容库',
      desc: '已发布的文章与视频',
      value: String(overview.contentCount),
      icon: 'icon-knowledge',
      tone: '#5C8DFF',
      route: 'CoachContents',
    },
    {
      title: '计划库',
      desc: '标准化训练方案',
      value: String(overview.planTemplateCount),
      icon: 'icon-a-Trainingplan',
      tone: '#CF6D4E',
      route: 'CoachPlanTemplates',
    },
    {
      title: '动作库',
      desc: '演示资源总数',
      value: String(overview.actionCount),
      icon: 'icon-dumbbell',
      tone: '#666666',
      route: 'CoachActions',
    },
  ]

  const tools: ConfigItem[] = [
    { title: '学员管理', desc: '查看学员、订阅和计划状态', icon: 'icon-friends-o', tone: '#CF6D4E', route: 'CoachStudents' },
    { title: '自动化设置', desc: '计划发放、反馈调整、下一阶段', icon: 'icon-kaiji', tone: '#5C8DFF', route: 'CoachAutomation' },
    { title: '邀请学员', desc: '分享邀请码和链接', icon: 'icon-share', tone: '#29C3A3' },
    { title: '安全设置', desc: '账号安全与隐私设置', icon: 'icon-setting', tone: '#666666', route: 'Settings' },
  ]

  if (loading) {
    return (
      <ScreenShell title="教练工作台" subtitle="业务概览、教学资产和常用设置。" onBack={() => navigation.goBack()}>
        <LoadingState title="正在加载教练数据" />
      </ScreenShell>
    )
  }

  return (
    <ScreenShell title="教练工作台" subtitle="业务概览、教学资产和常用设置。" onBack={() => navigation.goBack()}>
      <ScrollView
        horizontal={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.brand} />}
        contentContainerStyle={styles.inner}
        showsVerticalScrollIndicator={false}
      >
        {error ? <EmptyState title="加载失败" desc={error} icon="icon-wenhao" /> : null}

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <IconFont name="icon-dashboard" size={30} color={colors.surface} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>COACH CENTER</Text>
            <Text style={styles.heroDesc}>与小程序教练概览保持一致，APP 端后续教练模块从这里进入。</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>业务概览</Text>
          <Text style={styles.sectionMeta}>实时聚合</Text>
        </View>
        <View style={styles.statGrid}>
          {stats.map((item) => (
            <Pressable key={item.label} style={({ pressed }) => [styles.statTile, pressed && styles.pressed]} onPress={() => go(item.route)}>
              <View style={[styles.tileIcon, { backgroundColor: item.tone }]}>
                <IconFont name={item.icon} size={20} color={colors.surface} />
              </View>
              <Text style={styles.statLabel}>{item.label}</Text>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statDesc}>{item.desc}</Text>
            </Pressable>
          ))}
        </View>

        <SectionCard title="教学资产配置">
          {assets.map((item) => (
            <ConfigRow key={item.title} item={item} onPress={() => go(item.route)} />
          ))}
        </SectionCard>

        <SectionCard title="设置">
          {tools.map((item) => (
            <ConfigRow key={item.title} item={item} onPress={() => go(item.route)} />
          ))}
        </SectionCard>
      </ScrollView>
    </ScreenShell>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={styles.sectionCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.rows}>{children}</View>
    </Card>
  )
}

function ConfigRow({ item, onPress }: { item: ConfigItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.configRow, pressed && styles.pressed]}>
      <View style={[styles.rowIcon, { backgroundColor: item.tone }]}>
        <IconFont name={item.icon} size={20} color={colors.surface} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowDesc}>{item.desc}</Text>
      </View>
      {item.value ? (
        <View style={[styles.valuePill, item.ready && styles.readyPill]}>
          <Text style={[styles.valueText, item.ready && styles.readyText]}>{item.value}</Text>
        </View>
      ) : null}
      <IconFont name="icon-right-arrow" size={18} color={colors.textMuted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  inner: {
    gap: spacing.sm,
  },
  hero: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
  },
  heroDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
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
    fontWeight: '800',
  },
  sectionMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statTile: {
    width: '47.8%',
    minHeight: 148,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  statValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  statDesc: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  sectionCard: {
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  rows: {
    gap: spacing.xs,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  rowDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  valuePill: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  readyPill: {
    backgroundColor: '#E8F6EF',
  },
  valueText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  readyText: {
    color: colors.success,
  },
  pressed: {
    opacity: 0.74,
  },
})
