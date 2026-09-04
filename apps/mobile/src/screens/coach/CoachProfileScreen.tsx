import { useEffect, useMemo, useRef, useState } from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import * as Clipboard from 'expo-clipboard'
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
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

type PublicCoachReview = {
  id: string
  studentId: string
  studentName: string
  studentAvatarUrl: string | null
  comment: string
  rating: number | null
  createdAt: string | null
}

const SOCIAL_LABELS: Record<string, string> = {
  douyin: '抖音',
  xiaohongshu: '小红书',
  zhihu: '知乎',
  bilibili: 'B站',
  kuaishou: '快手',
  other: '其他',
}

const MATERIAL_CATEGORY_LABELS: Record<string, string> = {
  achievement: '成就奖项',
  case: '代表案例',
  credential: '资质证书',
  media: '图片 / 视频',
}

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'about', label: '关于教练' },
  { key: 'pricing', label: '订阅价格' },
  { key: 'content', label: '教练专栏' },
  { key: 'reviews', label: '学员评价' },
]


function isInternalTestProduct(product: any) {
  const name = String(product?.name || '').trim()
  return name.startsWith('测试通道') || name.includes('不要支付')
}
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

function formatReviewDate(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

async function copyValue(value: string, successMessage: string) {
  const text = value.trim()
  if (!text) return
  try {
    await Clipboard.setStringAsync(text)
    Alert.alert(successMessage)
  } catch {
    Alert.alert('复制失败', '请稍后重试。')
  }
}

async function openUrlOrCopy(url: string, fallbackMessage = '链接已复制') {
  const target = url.trim()
  if (!target) return
  try {
    if (await Linking.canOpenURL(target)) {
      await Linking.openURL(target)
      return
    }
  } catch {
    // Fall through to clipboard so unsupported schemes remain usable.
  }
  await copyValue(target, fallbackMessage)
}

export function CoachProfileScreen({ navigation, route }: Props) {
  const safeNavigation = {
    navigate: navigation?.navigate ? navigation.navigate.bind(navigation) : () => {},
    goBack: navigation?.goBack ? navigation.goBack.bind(navigation) : () => {},
  }
  const coachId = route?.params?.id || ''
  const { isAuthenticated, user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabKey>('about')
  const scrollRef = useRef<ScrollView>(null)
  const [tabBarY, setTabBarY] = useState(0)
  const [coach, setCoach] = useState<any>(null)
  const [aggregatedInfo, setAggregatedInfo] = useState<any>(null)
  const [subscription, setSubscription] = useState<any>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [contents, setContents] = useState<any[]>([])
  const [contentsTotal, setContentsTotal] = useState(0)
  const [reviews, setReviews] = useState<PublicCoachReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsLoaded, setReviewsLoaded] = useState(false)
  const [reviewsError, setReviewsError] = useState('')
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
      if (pricingRes.status === 'fulfilled') setProducts(pickArray(pricingRes.value, ['products']).filter((product) => !isInternalTestProduct(product)))
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
    if (!receivingAccountReady) {
      Alert.alert('暂时不能购买', '教练收款账户尚未开通，暂时不能通过平台购买或续费。')
      return
    }

    setSubmitting(true)
    try {
      if (showRenew) {
        if (!subscription?.id) throw new Error('缺少当前订阅信息，请刷新后重试')
        if (subscription?.product_id && subscription.product_id !== product.id) {
          throw new Error('续费只能延长当前套餐；如需切换套餐，请联系教练。')
        }
        const waitingParams = await createCoachPaymentWaitingParams({
          coachId,
          coachName: displayCoach?.name || '',
          subscriptionId: subscription.id,
          amount: duration.price,
          renew: true,
          renewAdditionalWeeks: duration.months * 4,
        })
        safeNavigation.navigate('PaymentWaiting', waitingParams)
        return
      }

      const questionnaires = await apiClient.request<any>('/api/coach/get-questionnaires', { method: 'POST', body: { coachId }, timeoutMs: 10000 })
        .then((payload) => pickArray(payload, ['questionnaires']))

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

  async function loadReviews() {
    if (!coachId || reviewsLoading) return
    setReviewsLoading(true)
    setReviewsError('')
    try {
      const payload = await apiClient.request<any>('/api/coach/get-public-reviews', {
        method: 'POST',
        body: { coachId },
        timeoutMs: 10000,
      })
      setReviews(pickArray(payload, ['reviews']) as PublicCoachReview[])
      setReviewsLoaded(true)
    } catch (err) {
      setReviewsError(err instanceof Error ? err.message : '评价加载失败，请稍后重试')
    } finally {
      setReviewsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [coachId, isAuthenticated, user?.id])

  useEffect(() => {
    setReviews([])
    setReviewsLoaded(false)
    setReviewsError('')
  }, [coachId])

  useEffect(() => {
    if (activeTab === 'reviews' && !reviewsLoaded && !reviewsLoading) void loadReviews()
  }, [activeTab, coachId, reviewsLoaded, reviewsLoading])

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
  const showPricing = () => {
    setActiveTab('pricing')
    requestAnimationFrame(() => {
      if (tabBarY > 0) {
        scrollRef.current?.scrollTo({ y: Math.max(0, tabBarY - spacing.sm), animated: true })
      }
    })
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {hasPendingPayment ? (
          <Pressable
            onPress={() => safeNavigation.navigate('PaymentWaiting', {
              orderId: subscription?.order_id || undefined,
              amount: subscriptionAmountYuan(subscription),
              coachId,
              provider: String(subscription?.payment_method || '').toLowerCase().includes('alipay') ? 'alipay' : 'wechat',
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

        <View style={styles.tabBar} onLayout={(event) => setTabBarY(event.nativeEvent.layout.y)}>
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
        {activeTab === 'reviews' ? (
          <ReviewsTab
            count={reviewCount}
            reviews={reviews}
            loading={reviewsLoading}
            error={reviewsError}
            onRetry={loadReviews}
          />
        ) : null}
      </ScrollView>

      <View style={styles.fixedCta}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="根据我的档案生成 AI 计划草稿"
          accessibilityHint="进入计划编辑器，生成后可以检查并保存到我的计划库"
          onPress={() => {
            if (!isAuthenticated) {
              Alert.alert('请先登录', '登录后可以根据个人档案生成并保存计划草稿。', [
                { text: '取消', style: 'cancel' },
                { text: '去登录', onPress: () => safeNavigation.navigate('Login') },
              ])
              return
            }
            safeNavigation.navigate('PlanEdit', { autoGenerate: true })
          }}
          style={styles.aiPlanButton}
        >
          <IconFont name="icon-a-Trainingplan" color={colors.brand} size={18} />
          <Text style={styles.aiPlanButtonText}>AI 计划草稿</Text>
        </Pressable>
        <Pressable onPress={showPricing} style={styles.fixedButton}>
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
  const socialLinks = profile?.socialLinks && typeof profile.socialLinks === 'object' ? profile.socialLinks as Record<string, string> : {}
  const hasContact = Boolean(profile?.contactEmail || profile?.contactPhone)
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
              <Text style={styles.materialCategory}>{MATERIAL_CATEGORY_LABELS[item.category] || '公开材料'}</Text>
              {item.summary ? <Text style={styles.materialText}>{item.summary}</Text> : null}
              {item.detail ? <Text style={styles.materialText}>{item.detail}</Text> : null}
              {Array.isArray(item.media) && item.media.length > 0 ? (
                <View style={styles.materialMediaGrid}>
                  {item.media.map((media: any, mediaIndex: number) => {
                    const mediaUrl = String(media?.url || '')
                    const previewUrl = String(media?.thumbnailUrl || media?.thumbnail_url || (media?.type === 'image' ? mediaUrl : ''))
                    return (
                      <Pressable
                        key={String(media?.id || `${item.id || index}-media-${mediaIndex}`)}
                        accessibilityRole="link"
                        accessibilityLabel={`查看${media?.type === 'video' ? '视频' : '图片'} ${media?.fileName || media?.file_name || mediaIndex + 1}`}
                        onPress={() => void openUrlOrCopy(mediaUrl, '媒体链接已复制')}
                        style={styles.materialMedia}
                      >
                        {previewUrl ? (
                          <Image source={{ uri: previewUrl }} style={styles.materialMediaImage} />
                        ) : (
                          <View style={styles.materialMediaFallback}><IconFont name="icon-video" color={colors.brand} size={24} /></View>
                        )}
                        <View style={styles.materialMediaMeta}>
                          <IconFont name={media?.type === 'video' ? 'icon-video' : 'icon-picture'} color={colors.brand} size={15} />
                          <Text numberOfLines={1} style={styles.materialMediaText}>{media?.fileName || media?.file_name || (media?.type === 'video' ? '查看视频' : '查看图片')}</Text>
                        </View>
                      </Pressable>
                    )
                  })}
                </View>
              ) : null}
              {Array.isArray(item.links) && item.links.length > 0 ? (
                <View style={styles.materialLinkList}>
                  {item.links.map((link: any, linkIndex: number) => (
                    <Pressable
                      key={String(link?.id || `${item.id || index}-link-${linkIndex}`)}
                      accessibilityRole="link"
                      onPress={() => void openUrlOrCopy(String(link?.url || ''))}
                      onLongPress={() => void copyValue(String(link?.url || ''), '链接已复制')}
                      style={styles.materialLink}
                    >
                      <Text style={styles.materialLinkText}>{link?.label || '打开相关链接'}</Text>
                      <IconFont name="icon-right-arrow" color={colors.brand} size={14} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </SectionCard>
      ) : null}
      <SectionCard title="联系方式" description={hasContact ? '点击邮箱可写邮件，点击电话可直接拨号；长按可复制。' : undefined}>
        {!hasContact ? <Text style={styles.emptyText}>暂无公开联系方式</Text> : null}
        {profile?.contactEmail ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => void openUrlOrCopy(`mailto:${profile.contactEmail}`, '邮箱已复制')}
            onLongPress={() => void copyValue(String(profile.contactEmail), '邮箱已复制')}
            style={styles.contactItem}
          >
            <View style={styles.contactIcon}><IconFont name="icon-messages" color={colors.brand} size={18} /></View>
            <View style={styles.contactMain}><Text style={styles.contactLabel}>邮箱</Text><Text selectable style={styles.contactValue}>{profile.contactEmail}</Text></View>
            <IconFont name="icon-right-arrow" color={colors.textMuted} size={16} />
          </Pressable>
        ) : null}
        {profile?.contactPhone ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void openUrlOrCopy(`tel:${profile.contactPhone}`, '电话号码已复制')}
            onLongPress={() => void copyValue(String(profile.contactPhone), '电话号码已复制')}
            style={styles.contactItem}
          >
            <View style={styles.contactIcon}><IconFont name="icon-user" color={colors.brand} size={18} /></View>
            <View style={styles.contactMain}><Text style={styles.contactLabel}>电话</Text><Text selectable style={styles.contactValue}>{profile.contactPhone}</Text></View>
            <IconFont name="icon-right-arrow" color={colors.textMuted} size={16} />
          </Pressable>
        ) : null}
      </SectionCard>
      <SectionCard title="社交平台" description={Object.keys(socialLinks).length > 0 ? '点击打开；长按复制账号或链接。' : undefined}>
        {Object.keys(socialLinks).length === 0 ? <Text style={styles.emptyText}>暂无公开社交平台</Text> : null}
        {Object.entries(socialLinks).map(([platform, url]) => (
          <Pressable
            key={platform}
            accessibilityRole="link"
            onPress={() => void openUrlOrCopy(String(url), `${SOCIAL_LABELS[platform] || platform}链接已复制`)}
            onLongPress={() => void copyValue(String(url), `${SOCIAL_LABELS[platform] || platform}链接已复制`)}
            style={styles.socialItem}
          >
            <Text style={styles.socialLabel}>{SOCIAL_LABELS[platform] || platform}</Text>
            <Text numberOfLines={1} style={styles.socialValue}>{url}</Text>
            <IconFont name="icon-right-arrow" color={colors.textMuted} size={16} />
          </Pressable>
        ))}
      </SectionCard>
    </>
  )
}

function PricingTab({ products, subscription, receivingAccountReady, submitting, onSelect }: { products: Product[]; subscription: any; receivingAccountReady: boolean; submitting: boolean; onSelect: (product: Product, duration: DurationOption) => void }) {
  const isRenewal = ['active', 'expired', 'near_expiry'].includes(subscription?.status || '')
  return (
    <SectionCard title={isRenewal ? '选择续费时长' : '订阅价格'} description="点击时长后创建安全支付订单，并通过系统支付宝完成付款；返回 APP 后会自动同步结果。">
      {isRenewal ? <Text style={styles.noticeText}>当前为续费模式：只能延长原套餐，训练计划和历史记录不会丢失。</Text> : null}
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

function ReviewsTab({ count, reviews, loading, error, onRetry }: { count: number; reviews: PublicCoachReview[]; loading: boolean; error: string; onRetry: () => void }) {
  return (
    <SectionCard title="学员评价" description={count > 0 ? `共 ${count} 条真实学员评价` : undefined}>
      {loading ? (
        <View style={styles.reviewsEmpty}><ActivityIndicator color={colors.brand} /><Text style={styles.emptyText}>评价加载中…</Text></View>
      ) : error ? (
        <View style={styles.reviewsEmpty}>
          <IconFont name="icon-messages" color={colors.textMuted} size={36} />
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable onPress={onRetry} style={styles.inlineRetry}><Text style={styles.inlineRetryText}>重新加载</Text></Pressable>
        </View>
      ) : reviews.length === 0 ? (
        <View style={styles.reviewsEmpty}><IconFont name="icon-messages" color={colors.textMuted} size={36} /><Text style={styles.emptyText}>暂无学员评价</Text></View>
      ) : (
        <View style={styles.reviewList}>
          {reviews.map((review) => (
            <View key={review.id} style={styles.reviewItem}>
              <View style={styles.reviewHeader}>
                {review.studentAvatarUrl ? (
                  <Image source={{ uri: review.studentAvatarUrl }} style={styles.reviewAvatar} />
                ) : (
                  <View style={[styles.reviewAvatar, styles.reviewAvatarFallback]}><Text style={styles.reviewAvatarText}>{review.studentName.charAt(0) || '学'}</Text></View>
                )}
                <View style={styles.reviewMeta}>
                  <Text style={styles.reviewName}>{review.studentName || '学员'}</Text>
                  {formatReviewDate(review.createdAt) ? <Text style={styles.reviewDate}>{formatReviewDate(review.createdAt)}</Text> : null}
                </View>
                {review.rating !== null && Number.isFinite(Number(review.rating)) ? (
                  <View style={styles.reviewRating}><IconFont name="icon-star" color={colors.brand} size={14} /><Text style={styles.reviewRatingText}>{Number(review.rating).toFixed(1)}</Text></View>
                ) : null}
              </View>
              {review.comment ? <Text style={styles.reviewContent}>{review.comment}</Text> : <Text style={styles.reviewNoComment}>该学员只留下了评分</Text>}
            </View>
          ))}
        </View>
      )}
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
  questionnaireButton: { minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: spacing.sm, backgroundColor: colors.brandSoft },
  questionnaireButtonText: { color: colors.brand, fontSize: 13, fontWeight: '900' },
  expRow: { gap: spacing.xs },
  expItem: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, borderRadius: radius.md, padding: spacing.xs, backgroundColor: colors.surfaceMuted },
  expLabel: { color: colors.textSecondary, fontSize: 13 },
  expValue: { flex: 1, textAlign: 'right', color: colors.text, fontSize: 13, fontWeight: '800' },
  tabBar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tabItem: { minHeight: 48, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
  tabTextActive: { color: '#FFFFFF' },
  noticeText: { color: colors.success, fontSize: 13, lineHeight: 20, marginBottom: spacing.xs },
  warningText: { color: colors.warning, fontSize: 13, lineHeight: 20, marginBottom: spacing.xs },
  productCard: { borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.xs, backgroundColor: colors.surfaceMuted },
  productName: { color: colors.text, fontSize: 16, fontWeight: '900' },
  productDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 4 },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  durationOption: { minHeight: 48, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  durationRecommended: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  durationText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.48 },
  emptyText: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  simpleList: { gap: spacing.xs },
  simpleRow: { color: colors.text, fontSize: 14, lineHeight: 22 },
  materialCard: { borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.xs, backgroundColor: colors.surfaceMuted },
  materialTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  materialCategory: { alignSelf: 'flex-start', overflow: 'hidden', marginTop: spacing.xs, borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4, color: colors.brand, backgroundColor: colors.brandSoft, fontSize: 11, fontWeight: '900' },
  materialText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 4 },
  materialMediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  materialMedia: { width: 144, overflow: 'hidden', borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  materialMediaImage: { width: 144, height: 96, backgroundColor: colors.surfaceMuted },
  materialMediaFallback: { width: 144, height: 96, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  materialMediaMeta: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs },
  materialMediaText: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '800' },
  materialLinkList: { gap: spacing.xs, marginTop: spacing.xs },
  materialLink: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  materialLinkText: { flex: 1, color: colors.brand, fontSize: 13, fontWeight: '900' },
  contactItem: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted },
  contactIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  contactMain: { flex: 1, gap: 4 },
  contactLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  contactValue: { color: colors.text, fontSize: 14, fontWeight: '800' },
  socialItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted },
  socialLabel: { minWidth: 64, color: colors.text, fontSize: 14, fontWeight: '900' },
  socialValue: { flex: 1, color: colors.textSecondary, fontSize: 13 },
  contentItem: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted, paddingVertical: spacing.xs },
  contentThumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  contentThumbFallback: { width: 64, height: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  contentThumbText: { color: colors.brand, fontSize: 12, fontWeight: '900' },
  contentMain: { flex: 1, gap: 4 },
  contentTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  contentMeta: { color: colors.textSecondary, fontSize: 12 },
  reviewsEmpty: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  inlineRetry: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.md, backgroundColor: colors.brand },
  inlineRetryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  reviewList: { gap: spacing.sm },
  reviewItem: { borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surfaceMuted },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  reviewAvatar: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surface },
  reviewAvatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  reviewAvatarText: { color: colors.brand, fontSize: 15, fontWeight: '900' },
  reviewMeta: { flex: 1, gap: 4 },
  reviewName: { color: colors.text, fontSize: 14, fontWeight: '900' },
  reviewDate: { color: colors.textMuted, fontSize: 12 },
  reviewRating: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4, backgroundColor: colors.brandSoft },
  reviewRatingText: { color: colors.brand, fontSize: 12, fontWeight: '900' },
  reviewContent: { marginTop: spacing.xs, color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  reviewNoComment: { marginTop: spacing.xs, color: colors.textMuted, fontSize: 12 },
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
