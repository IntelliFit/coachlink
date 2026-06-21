import { useEffect, useMemo, useState } from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiClient } from '../../api'
import { IconFont } from '../../components/IconFont'
import { SectionCard } from '../../components/SectionCard'
import { useAuth } from '../../providers/AuthProvider'
import { colors, radius, shadow, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'
import { createCoachPaymentWaitingParams, subscriptionAmountYuan } from './coachPayment'

type Props = {
  navigation?: any
  route?: {
    params?: NativeStackScreenProps<RootStackParamList, 'CoachProfile'>['route']['params']
  }
}

type TabKey = 'about' | 'pricing' | 'content' | 'reviews'

type DurationOption = {
  months: number
  price: number
  is_recommend?: boolean
}

type Product = {
  id: string
  tier: string
  type?: string
  name: string
  description?: string
  duration_options?: DurationOption[]
}

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'about', label: '关于教练' },
  { key: 'pricing', label: '订阅价格' },
  { key: 'content', label: '教练专栏' },
  { key: 'reviews', label: '学员评价' },
]

function pickArray(data: any, keys: string[]) {
  for (const key of keys) {
    const value = data?.[key] ?? data?.data?.[key]
    if (Array.isArray(value)) return value
  }
  return []
}

function tierToNumber(tier: string) {
  if (tier === 'basic') return 1
  if (tier === 'standard') return 2
  return 3
}

function statusLabel(status?: string | null) {
  if (status === 'active') return '服务进行中'
  if (status === 'waiting') return '等待确认'
  if (status === 'inactive' || status === 'pending_payment') return '待支付'
  if (status === 'expired') return '已过期'
  if (status === 'near_expiry') return '即将到期'
  return ''
}

function profileArray(profile: any, key: string, fallback: any[] = []) {
  const value = profile?.[key]
  return Array.isArray(value) ? value : fallback
}

export function CoachProfileScreen({ navigation, route }: Props) {
  const safeNavigation = {
    navigate: navigation?.navigate ? navigation.navigate.bind(navigation) : () => {},
    goBack: navigation?.goBack ? navigation.goBack.bind(navigation) : () => {},
  }
  const coachId = route?.params?.id || ''
  const { isAuthenticated, user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabKey>('about')
  const [coach, setCoach] = useState<any>(null)
  const [aggregatedInfo, setAggregatedInfo] = useState<any>(null)
  const [subscription, setSubscription] = useState<any>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [contents, setContents] = useState<any[]>([])
  const [contentsTotal, setContentsTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const displayCoach = aggregatedInfo?.coach || coach
  const profile = (displayCoach?.profile || {}) as any
  const specialties = useMemo(() => {
    const agg = Array.isArray(aggregatedInfo?.specialties) ? aggregatedInfo.specialties : []
    const own = Array.isArray(displayCoach?.specialties) ? displayCoach.specialties : []
    return agg.length ? agg : own
  }, [aggregatedInfo, displayCoach])
  const receivingAccountReady = displayCoach?.huifu_open_status === 'opened'
  const showRenew = ['active', 'expired', 'near_expiry'].includes(subscription?.status || '')
  const hasPendingPayment = ['inactive', 'pending_payment'].includes(subscription?.status || '')

  async function load() {
    if (!coachId) {
      setError('缺少教练 ID')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const requests = [
        apiClient.request<any>('/api/coach/get-coach', { method: 'POST', body: { id: coachId }, timeoutMs: 10000 }),
        apiClient.request<any>('/api/coach/get-aggregated-info', { method: 'POST', body: { coachId }, timeoutMs: 10000 }),
        apiClient.request<any>('/api/coach/get-pricing', { method: 'POST', body: { coachId }, timeoutMs: 10000 }),
        apiClient.request<any>('/api/coach/get-contents', { method: 'POST', body: { coachId, limit: 10, offset: 0 }, timeoutMs: 10000 }),
      ]
      const [coachRes, aggRes, pricingRes, contentRes] = await Promise.allSettled(requests)
      if (coachRes.status === 'fulfilled') setCoach(coachRes.value?.coach || null)
      if (aggRes.status === 'fulfilled') setAggregatedInfo(aggRes.value || null)
      if (pricingRes.status === 'fulfilled') setProducts(pickArray(pricingRes.value, ['products']))
      if (contentRes.status === 'fulfilled') {
        setContents(pickArray(contentRes.value, ['contents']))
        setContentsTotal(Number(contentRes.value?.total || 0))
      }

      if (isAuthenticated && user?.id) {
        try {
          const subs = await apiClient.request<any>('/api/subscription/coach-subscriptions', { method: 'POST', body: { studentId: user.id, onlyActive: false }, timeoutMs: 10000 })
          const list = pickArray(subs, ['subscriptions'])
          setSubscription(list.find((item: any) => item.coach_id === coachId) || null)
        } catch {
          setSubscription(null)
        }
      } else {
        setSubscription(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  async function selectProduct(product: Product, duration: DurationOption) {
    if (!isAuthenticated || !user?.id) {
      Alert.alert('请先登录', '登录后可以订阅教练服务。', [
        { text: '取消', style: 'cancel' },
        { text: '去登录', onPress: () => safeNavigation.navigate('Login') },
      ])
      return
    }
    if (subscription?.status === 'waiting') {
      Alert.alert('订阅处理中', '当前订阅正在处理中，请先查看订阅进度。')
      return
    }
    if (showRenew) {
      Alert.alert('续费提醒', 'APP 端续费支付桥接还在迁移中。当前可查看当前套餐与订阅状态。')
      return
    }
    if (!receivingAccountReady) {
      Alert.alert('暂时不能购买', '教练收款账户尚未开通，暂时不能通过平台购买或续费。')
      return
    }

    setSubmitting(true)
    try {
      const questionnaires = await apiClient.request<any>('/api/coach/get-questionnaires', { method: 'POST', body: { coachId }, timeoutMs: 10000 })
        .then((payload) => pickArray(payload, ['questionnaires']))
        .catch(() => [])

      if (questionnaires.length > 0) {
        safeNavigation.navigate('CoachQuestionnaire', {
          coachId,
          coachName: displayCoach?.name || '',
          mode: 'prepay',
          subscriptionId: subscription?.id,
          productId: product.id,
          productName: product.name,
          productTier: product.tier,
          months: duration.months,
          price: duration.price,
          existingAnswers: Array.isArray(subscription?.subscribe_data) ? subscription.subscribe_data : undefined,
        })
        return
      }

      const payload = await apiClient.request<any>('/api/subscription/create-subscription', {
        method: 'POST',
        timeoutMs: 15000,
        body: {
          coachId,
          tier: tierToNumber(product.tier),
          monthlyPrice: duration.price,
          status: 'inactive',
          subscribeData: [],
          productId: product.id,
          productName: product.name,
          productTier: product.tier,
          subscribedWeeks: duration.months * 4,
        },
      })
      const nextSubscription = payload?.subscription || null
      setSubscription(nextSubscription)
      const waitingParams = await createCoachPaymentWaitingParams({
        coachId,
        coachName: displayCoach?.name || '',
        subscriptionId: nextSubscription?.id || '',
        amount: duration.price,
      })
      safeNavigation.navigate('PaymentWaiting', waitingParams)
    } catch (err) {
      Alert.alert('订阅失败', err instanceof Error ? err.message : '请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    void load()
  }, [coachId, isAuthenticated, user?.id])

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.loadingText}>正在加载教练主页</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (error || !displayCoach) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>教练主页加载失败</Text>
          <Text style={styles.errorText}>{error || '教练不存在或已下线。'}</Text>
          <Pressable onPress={load} style={styles.primaryButton}><Text style={styles.primaryButtonText}>重试</Text></Pressable>
          <Pressable onPress={() => safeNavigation.goBack()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>返回</Text></Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const reviewCount = Number(aggregatedInfo?.reviewCount || 0)
  const contentCount = Number(aggregatedInfo?.contentCount ?? contentsTotal ?? 0)
  const activeStatus = statusLabel(subscription?.status)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {hasPendingPayment ? (
          <Pressable
            onPress={() => safeNavigation.navigate('PaymentWaiting', {
              orderId: subscription?.order_id || undefined,
              amount: subscriptionAmountYuan(subscription),
              coachId,
              provider: 'wechat',
              target: 'coach',
              message: subscription?.order_id ? undefined : '当前订阅资料已保存，但还没有可查询的支付订单，请重新选择套餐继续支付。',
            })}
            style={styles.pendingBanner}
          >
            <Text style={styles.pendingText}>您有待支付的订阅，点击继续完成购买</Text>
          </Pressable>
        ) : null}

        <View style={styles.introCard}>
          <View style={styles.introHeader}>
            {displayCoach.avatar_url ? <Image source={{ uri: displayCoach.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{String(displayCoach.name || '教').slice(0, 1)}</Text></View>}
            <View style={styles.introMeta}>
              <View style={styles.nameRow}>
                <Text style={styles.coachName}>{displayCoach.name || '未命名教练'}</Text>
                {displayCoach.is_featured ? <View style={styles.featuredBadge}><IconFont name="icon-star" color="#FFFFFF" size={12} /></View> : null}
              </View>
              {displayCoach.title ? <Text style={styles.coachTitle}>{displayCoach.title}</Text> : null}
              {activeStatus ? <Text style={styles.statusPill}>{activeStatus}</Text> : null}
            </View>
          </View>

          <View style={styles.statsRow}>
            <Stat value={String(contentCount)} label="教学内容" />
            <Stat value={String(Number(aggregatedInfo?.studentCount || 0))} label="活跃学员" />
            <Stat value={Number(aggregatedInfo?.averageRating || 0).toFixed(1)} label="综合评分" />
          </View>

          {specialties.length > 0 ? (
            <View style={styles.tags}>
              {specialties.map((item: string) => <Text key={item} style={styles.tag}>{item}</Text>)}
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>教练简介</Text>
          <Text style={styles.bioText}>{displayCoach.bio || '这位教练还没有填写简介。'}</Text>
          {['waiting', 'active'].includes(subscription?.status || '') ? (
            <Pressable
              onPress={() => safeNavigation.navigate('CoachQuestionnaire', {
                coachId,
                coachName: displayCoach?.name || '',
                mode: 'edit',
                subscriptionId: subscription?.id,
                existingAnswers: Array.isArray(subscription?.subscribe_data) ? subscription.subscribe_data : undefined,
              })}
              style={styles.questionnaireButton}
            >
              <IconFont name="icon-goumaijilu" color={colors.brand} size={16} />
              <Text style={styles.questionnaireButtonText}>查看问卷</Text>
            </Pressable>
          ) : null}
          <View style={styles.expRow}>
            <Exp label="从业经验" value={`${displayCoach.years_experience ?? 0} 年专业沉淀`} />
            <Exp label="成功案例" value={`${profileArray(profile, 'caseStudies').length} 个学员蜕变`} />
            <Exp label="公开材料" value={`${profileArray(profile, 'applicationMaterials').length} 个可查证明`} />
          </View>
        </View>

        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.tabItem, activeTab === tab.key && styles.tabActive]}>
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.key === 'content' ? `教练专栏(${contentCount})` : tab.key === 'reviews' ? `学员评价(${reviewCount})` : tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeTab === 'about' ? <AboutTab coach={displayCoach} /> : null}
        {activeTab === 'pricing' ? <PricingTab products={products} subscription={subscription} receivingAccountReady={receivingAccountReady} submitting={submitting} onSelect={selectProduct} /> : null}
        {activeTab === 'content' ? <ContentTab contents={contents} total={contentsTotal} navigation={safeNavigation} /> : null}
        {activeTab === 'reviews' ? <ReviewsTab count={reviewCount} /> : null}
      </ScrollView>

      <View style={styles.fixedCta}>
        <Pressable onPress={() => safeNavigation.navigate('GeneratePlan', { coachId })} style={styles.aiPlanButton}>
          <IconFont name="icon-a-Trainingplan" color={colors.brand} size={18} />
          <Text style={styles.aiPlanButtonText}>AI 生成计划</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab('pricing')} style={styles.fixedButton}>
          <Text style={styles.fixedButtonText}>{subscription?.status === 'active' ? '查看订阅' : subscription?.status === 'waiting' ? '查看订阅进度' : '立即订阅 / 查看价格'}</Text>
        </Pressable>
        <Text style={styles.fixedHint}>不用横向找“订阅价格”，点这里直接跳转</Text>
      </View>
    </SafeAreaView>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function Exp({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.expItem}>
      <Text style={styles.expLabel}>{label}</Text>
      <Text style={styles.expValue}>{value}</Text>
    </View>
  )
}

function AboutTab({ coach }: { coach: any }) {
  const profile = coach.profile || {}
  const achievements = profileArray(profile, 'achievements', Array.isArray(coach.achievements) ? coach.achievements : [])
  const credentials = profileArray(profile, 'credentials')
  const cases = profileArray(profile, 'caseStudies')
  const materials = profileArray(profile, 'applicationMaterials')
  return (
    <>
      <SectionCard title="教学理念 / PHILOSOPHY" description={profile.teachingPhilosophy || '暂无教学理念'} />
      <SectionCard title="成就奖项">
        <SimpleList rows={achievements.map((item: any) => String(item))} empty="无记录" />
      </SectionCard>
      <SectionCard title="资质证书">
        <SimpleList rows={credentials.map((item: any) => String(item?.name || item?.title || item))} empty="未上传" />
      </SectionCard>
      <SectionCard title="代表案例">
        <SimpleList rows={cases.map((item: any) => String(item))} empty="暂无" />
      </SectionCard>
      {materials.length > 0 ? (
        <SectionCard title="公开材料">
          {materials.map((item: any, index: number) => (
            <View key={String(item.id || index)} style={styles.materialCard}>
              <Text style={styles.materialTitle}>{item.title || '材料'}</Text>
              {item.summary ? <Text style={styles.materialText}>{item.summary}</Text> : null}
              {item.detail ? <Text style={styles.materialText}>{item.detail}</Text> : null}
            </View>
          ))}
        </SectionCard>
      ) : null}
    </>
  )
}

function PricingTab({ products, subscription, receivingAccountReady, submitting, onSelect }: { products: Product[]; subscription: any; receivingAccountReady: boolean; submitting: boolean; onSelect: (product: Product, duration: DurationOption) => void }) {
  const isActive = subscription?.status === 'active'
  return (
    <SectionCard title="订阅价格" description="点击套餐后进入 APP 订阅承接流程；真实原生支付 SDK 接入后在支付页完成支付。">
      {isActive ? <Text style={styles.noticeText}>您已订阅该教练。如需延长订阅，续费支付桥接会在后续补齐。</Text> : null}
      {!receivingAccountReady ? <Text style={styles.warningText}>教练收款账户尚未开通，暂时不能通过平台购买或续费。</Text> : null}
      {products.length === 0 ? <Text style={styles.emptyText}>暂无套餐</Text> : null}
      {products.map((product) => (
        <View key={product.id} style={styles.productCard}>
          <Text style={styles.productName}>{product.name}</Text>
          {product.description ? <Text style={styles.productDesc}>{product.description}</Text> : null}
          <View style={styles.durationRow}>
            {(product.duration_options || []).map((duration, index) => (
              <Pressable key={`${product.id}-${index}`} disabled={submitting || !receivingAccountReady} onPress={() => onSelect(product, duration)} style={[styles.durationOption, duration.is_recommend && styles.durationRecommended, (!receivingAccountReady || submitting) && styles.disabled]}>
                <Text style={styles.durationText}>{duration.months}个月 ¥{duration.price}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </SectionCard>
  )
}

function ContentTab({ contents, total, navigation }: { contents: any[]; total: number; navigation: { navigate: (screen: any, params?: any) => void } }) {
  return (
    <SectionCard title="教学内容" description={`共 ${total} 条`}>
      {contents.length === 0 ? <Text style={styles.emptyText}>暂无内容</Text> : null}
      {contents.map((item) => (
        <Pressable key={String(item.id)} onPress={() => item.is_locked ? Alert.alert('订阅后可见', '该内容需要订阅对应套餐后查看。') : navigation.navigate('CoachContentDetail', { id: item.id })} style={styles.contentItem}>
          {item.thumbnail_url ? <Image source={{ uri: item.thumbnail_url }} style={styles.contentThumb} /> : <View style={styles.contentThumbFallback}><Text style={styles.contentThumbText}>{item.content_type === 'video' ? '视频' : '图文'}</Text></View>}
          <View style={styles.contentMain}>
            <Text style={styles.contentTitle}>{item.title || '未命名'}</Text>
            <Text style={styles.contentMeta}>{item.content_type === 'video' ? '视频' : '图文'}{item.is_locked ? ' · 订阅后可见' : ''}</Text>
          </View>
          {item.is_locked ? <IconFont name="icon-vips" color={colors.warning} size={18} /> : <IconFont name="icon-right-arrow" color={colors.textMuted} size={16} />}
        </Pressable>
      ))}
    </SectionCard>
  )
}

function ReviewsTab({ count }: { count: number }) {
  return (
    <SectionCard title="学员评价">
      <View style={styles.reviewsEmpty}>
        <IconFont name="icon-messages" color={colors.textMuted} size={36} />
        <Text style={styles.emptyText}>{count > 0 ? '暂无评价数据' : '暂无学员评价'}</Text>
      </View>
    </SectionCard>
  )
}

function SimpleList({ rows, empty }: { rows: string[]; empty: string }) {
  if (!rows.length) return <Text style={styles.emptyText}>{empty}</Text>
  return (
    <View style={styles.simpleList}>
      {rows.map((item, index) => <Text key={`${item}-${index}`} style={styles.simpleRow}>{`${index + 1}. ${item}`}</Text>)}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.sm, paddingBottom: 128, gap: spacing.sm },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  errorWrap: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  errorTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  errorText: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  pendingBanner: { minHeight: 48, justifyContent: 'center', borderRadius: radius.lg, paddingHorizontal: spacing.sm, backgroundColor: colors.brand },
  pendingText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  introCard: { borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow },
  introHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 80, height: 80, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  avatarFallback: { width: 80, height: 80, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  avatarText: { color: colors.brand, fontSize: 28, fontWeight: '900' },
  introMeta: { flex: 1, gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  coachName: { flex: 1, color: colors.text, fontSize: 24, fontWeight: '900' },
  featuredBadge: { width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  coachTitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  statusPill: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4, color: colors.success, backgroundColor: '#EAF6EE', fontSize: 12, fontWeight: '800' },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { color: colors.text, fontSize: 24, fontWeight: '900' },
  statLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag: { overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4, color: colors.brand, backgroundColor: colors.brandSoft, fontSize: 12, fontWeight: '800' },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  bioText: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  questionnaireButton: { minHeight: 40, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: spacing.sm, backgroundColor: colors.brandSoft },
  questionnaireButtonText: { color: colors.brand, fontSize: 13, fontWeight: '900' },
  expRow: { gap: spacing.xs },
  expItem: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, borderRadius: radius.md, padding: spacing.xs, backgroundColor: colors.surfaceMuted },
  expLabel: { color: colors.textSecondary, fontSize: 13 },
  expValue: { flex: 1, textAlign: 'right', color: colors.text, fontSize: 13, fontWeight: '800' },
  tabBar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tabItem: { minHeight: 40, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
  tabTextActive: { color: '#FFFFFF' },
  noticeText: { color: colors.success, fontSize: 13, lineHeight: 20, marginBottom: spacing.xs },
  warningText: { color: colors.warning, fontSize: 13, lineHeight: 20, marginBottom: spacing.xs },
  productCard: { borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.xs, backgroundColor: colors.surfaceMuted },
  productName: { color: colors.text, fontSize: 16, fontWeight: '900' },
  productDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 4 },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  durationOption: { minHeight: 40, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  durationRecommended: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  durationText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.48 },
  emptyText: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  simpleList: { gap: spacing.xs },
  simpleRow: { color: colors.text, fontSize: 14, lineHeight: 22 },
  materialCard: { borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.xs, backgroundColor: colors.surfaceMuted },
  materialTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  materialText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 4 },
  contentItem: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted, paddingVertical: spacing.xs },
  contentThumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  contentThumbFallback: { width: 64, height: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  contentThumbText: { color: colors.brand, fontSize: 12, fontWeight: '900' },
  contentMain: { flex: 1, gap: 4 },
  contentTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  contentMeta: { color: colors.textSecondary, fontSize: 12 },
  reviewsEmpty: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  fixedCta: { position: 'absolute', left: spacing.sm, right: spacing.sm, bottom: spacing.sm, borderRadius: radius.xl, padding: spacing.sm, gap: spacing.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow },
  aiPlanButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.pill, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border },
  aiPlanButtonText: { color: colors.brand, fontSize: 15, fontWeight: '900' },
  fixedButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand },
  fixedButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  fixedHint: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '800' },
})
