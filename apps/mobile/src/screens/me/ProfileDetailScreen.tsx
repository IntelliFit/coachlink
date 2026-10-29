import { useCallback, useState } from 'react'
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { VideoPlayerModal, type VideoPlayerTarget } from '../../components/VideoPlayerModal'
import { useAuth } from '../../providers/AuthProvider'
import { colors, controlHeight, radius, spacing, typography } from '../../theme'
import { Card, EmptyState, InlineAvatar, LoadingState, ScreenShell, SolidButton, errorMessage, safeRequest, type RootNav } from './MeShared'
import { getTotalWeight, showTotalWeight, typicalActionMaps } from './sportsCollections'

const SPORT_LABELS: Record<string, string> = {
  powerlifting: '力量举',
  streetlifting: '街头力量',
  calisthenics: '街头健身',
  weightlifting: '举重',
  bodybuilding: '健美/形体',
  running: '跑步',
  cycling: '骑行',
}
const GENDER_LABELS: Record<string, string> = { male: '男', female: '女' }
const LEVEL_LABELS: Record<string, string> = { beginner: '零基础', novice: '入门', intermediate: '进阶', advanced: '高阶', elite: '精英 / 职业' }

type Tab = 'timeline' | 'questionnaire' | 'video'

function dateText(value?: string | null) {
  return value ? String(value).slice(0, 10) : ''
}

function answerText(value: unknown): string {
  if (Array.isArray(value)) return value.map(answerText).filter(Boolean).join('、')
  if (value && typeof value === 'object') return String((value as any).label ?? (value as any).text ?? (value as any).value ?? '')
  return value === null || value === undefined ? '' : String(value)
}

/** 我的健身档案详情，对应小程序 me/profile/detail：资料、运动成绩、教练评语、力量进步，以及时间线 / 问卷 / 视频。 */
export function ProfileDetailScreen() {
  const navigation = useNavigation<RootNav>()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<Record<string, any> | null>(null)
  const [videos, setVideos] = useState<any[]>([])
  const [stats, setStats] = useState<{ subscriptionCount?: number; activePlanCount?: number; completedWorkouts?: number } | null>(null)
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [oneRms, setOneRms] = useState<Array<{ actionName: string; current1RM: number; lastUpdated?: string }>>([])
  const [prRecords, setPrRecords] = useState<any[]>([])
  const [tab, setTab] = useState<Tab>('timeline')
  const [videoTarget, setVideoTarget] = useState<VideoPlayerTarget | null>(null)

  const load = useCallback(async (quiet = false) => {
    if (!user?.id) return
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const [profileRes, statsRes, subsRes, reviewsRes, oneRmRes, prRes] = await Promise.allSettled([
        safeRequest<any>('/api/user/get-student-profile', { body: { userId: user.id } }),
        safeRequest<any>('/api/user/get-student-stats', { body: {} }),
        safeRequest<any>('/api/subscription/coach-subscriptions', { body: { studentId: user.id } }),
        safeRequest<any>('/api/subscription/get-coach-reviews', { body: { studentId: user.id } }),
        safeRequest<any>('/api/student/get-current-1rm', { body: { preferPR: true } }),
        safeRequest<any>('/api/execution/get-pr-records', { body: { limit: 20, offset: 0 } }),
      ])
      if (profileRes.status === 'rejected') throw profileRes.reason
      setProfile(profileRes.value?.profile || {})
      setVideos(Array.isArray(profileRes.value?.videos) ? profileRes.value.videos.filter((item: any) => item?.video_url) : [])
      setStats(statsRes.status === 'fulfilled' ? statsRes.value : null)
      setSubscriptions(subsRes.status === 'fulfilled' && Array.isArray(subsRes.value?.subscriptions) ? subsRes.value.subscriptions : [])
      setReviews(reviewsRes.status === 'fulfilled' && Array.isArray(reviewsRes.value?.reviews) ? reviewsRes.value.reviews : [])
      setOneRms(oneRmRes.status === 'fulfilled' && Array.isArray(oneRmRes.value?.records) ? oneRmRes.value.records.filter((item: any) => Number(item?.current1RM) > 0) : [])
      const prData = prRes.status === 'fulfilled' ? prRes.value : null
      setPrRecords(Array.isArray(prData) ? prData : Array.isArray(prData?.records) ? prData.records : [])
    } catch (loadError) {
      setError(errorMessage(loadError, '档案加载失败'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id])

  useFocusEffect(useCallback(() => {
    void load()
  }, [load]))

  const deletePr = (record: any) => {
    Alert.alert('删除 PR 记录', `确定删除「${record.exercise_name || '动作'}」这条记录吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          void safeRequest('/api/execution/delete-pr-record', { body: { recordId: record.id } })
            .then(() => setPrRecords((current) => current.filter((item) => item.id !== record.id)))
            .catch((deleteError) => Alert.alert('删除失败', errorMessage(deleteError)))
        },
      },
    ])
  }

  const coachName = (coachId?: string | null) => {
    const match = subscriptions.find((sub) => String(sub?.coach_id || sub?.coach?.id || '') === String(coachId || ''))
    return match?.coach?.name || '教练'
  }

  const activeSubscription = subscriptions.find((sub) => String(sub?.status || '') === 'active') || subscriptions[0]
  const answers: any[] = Array.isArray(activeSubscription?.subscribe_data)
    ? activeSubscription.subscribe_data
    : Array.isArray(activeSubscription?.subscribe_data?.answers)
      ? activeSubscription.subscribe_data.answers
      : []
  const sportCards = profile?.sport_cards || {}
  const activeCards: string[] = Array.isArray(sportCards.activeCards) ? sportCards.activeCards : []
  const displayName = profile?.nickname || user?.nickname || (user?.phone ? `用户 ${String(user.phone).slice(-4)}` : '我')
  const tags = [
    GENDER_LABELS[profile?.gender] || '',
    profile?.age ? `${profile.age} 岁` : '',
    profile?.height ? `${profile.height} cm` : '',
    profile?.weight ? `${profile.weight} kg` : '',
    profile?.fitness_goal || '',
    LEVEL_LABELS[profile?.fitness_level] || '',
  ].filter(Boolean)

  if (loading) {
    return (
      <ScreenShell title="健身档案" onBack={navigation.goBack}>
        <LoadingState title="正在加载档案" />
      </ScreenShell>
    )
  }

  if (error) {
    return (
      <ScreenShell title="健身档案" onBack={navigation.goBack}>
        <EmptyState title="加载失败" desc={error} />
        <SolidButton label="重新加载" variant="secondary" onPress={() => void load()} />
      </ScreenShell>
    )
  }

  return (
    <ScreenShell
      title="健身档案"
      onBack={navigation.goBack}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.brand} colors={[colors.brand]} onRefresh={() => void load(true)} />}
    >
      <Card>
        <View style={styles.headerRow}>
          <InlineAvatar uri={profile?.avatar_url || user?.avatar_url} label={displayName} size={72} />
          <View style={styles.headerMain}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.meta}>ID: {String(user?.id || '').slice(-8) || '-'}</Text>
            {tags.length > 0 ? (
              <View style={styles.tagRow}>
                {tags.map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}
              </View>
            ) : null}
          </View>
        </View>
        {profile?.lifestyle ? <Text style={styles.body}>{profile.lifestyle}</Text> : null}
        <View style={styles.statsRow}>
          <Stat value={stats?.subscriptionCount ?? 0} label="订阅教练" />
          <Stat value={stats?.activePlanCount ?? 0} label="进行中计划" />
          <Stat value={stats?.completedWorkouts ?? 0} label="完成训练" />
        </View>
        <SolidButton label="编辑资料" variant="secondary" onPress={() => navigation.navigate('ProfileEdit')} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>运动成绩</Text>
        {activeCards.length === 0 ? <Text style={styles.meta}>还没有填写运动成绩，可以在编辑资料里补充。</Text> : null}
        {activeCards.map((cardKey) => {
          const card = sportCards[cardKey] || {}
          const filled = Object.keys(card).filter((field) => typicalActionMaps[field] && card[field] !== null && card[field] !== undefined && card[field] !== '')
          return (
            <View key={cardKey} style={styles.sportCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{SPORT_LABELS[cardKey] || cardKey}</Text>
                {showTotalWeight(cardKey) ? <Text style={styles.accent}>总计 {getTotalWeight(cardKey, card)} KG</Text> : null}
              </View>
              {filled.length === 0 ? <Text style={styles.meta}>未填写</Text> : null}
              {filled.map((field) => (
                <View key={field} style={styles.rowBetween}>
                  <Text style={styles.body}>{typicalActionMaps[field].nameCn}</Text>
                  <Text style={styles.value}>{card[field]} {typicalActionMaps[field].unit}</Text>
                </View>
              ))}
            </View>
          )
        })}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>教练评语</Text>
        {reviews.length === 0 ? <Text style={styles.meta}>暂时还没有教练评语。</Text> : null}
        {reviews.slice(0, 5).map((review) => (
          <View key={review.id} style={styles.reviewRow}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{coachName(review.coach_id)}</Text>
              <Text style={styles.meta}>{dateText(review.updated_at || review.created_at)}</Text>
            </View>
            <Text style={styles.body}>{review.review_text || '（空）'}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>力量进步</Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('E1RMChart')} style={styles.link}>
            <Text style={styles.linkText}>查看曲线</Text>
          </Pressable>
        </View>
        {oneRms.length === 0 ? <Text style={styles.meta}>完成带重量的训练后，这里会显示各动作当前的 1RM。</Text> : null}
        {oneRms.slice(0, 8).map((record) => (
          <View key={record.actionName} style={styles.rowBetween}>
            <Text style={styles.body}>{record.actionName}</Text>
            <Text style={styles.value}>{Math.round(Number(record.current1RM))} kg</Text>
          </View>
        ))}
      </Card>

      <View style={styles.tabs}>
        {([['timeline', '进步时间线'], ['questionnaire', '训练问卷'], ['video', '训练视频']] as const).map(([key, label]) => (
          <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabActive]}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'timeline' ? (
        <Card>
          {prRecords.length === 0 ? <Text style={styles.meta}>还没有 PR 记录。</Text> : null}
          {prRecords.map((record) => (
            <View key={record.id} style={styles.prRow}>
              <View style={styles.headerMain}>
                <Text style={styles.cardTitle}>{record.exercise_name || '动作'}</Text>
                <Text style={styles.meta}>{dateText(record.date_achieved)} · {record.weight} kg × {record.reps} · e1RM {record.e1rm ? Number(record.e1rm).toFixed(1) : '-'}</Text>
              </View>
              {record.video_url ? (
                <Pressable accessibilityRole="button" onPress={() => setVideoTarget({ url: record.video_url, title: record.exercise_name || 'PR 视频' })} style={styles.link}>
                  <Text style={styles.linkText}>视频</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel="删除这条 PR" onPress={() => deletePr(record)} style={styles.link}>
                <Text style={styles.dangerText}>删除</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      ) : null}

      {tab === 'questionnaire' ? (
        <Card>
          {answers.length === 0 ? <Text style={styles.meta}>{activeSubscription ? '还没有填写订阅问卷。' : '订阅教练后填写的问卷会显示在这里。'}</Text> : null}
          {answers.map((item, index) => (
            <View key={`${index}-${item?.question || ''}`} style={styles.answerRow}>
              <Text style={styles.meta}>{item?.question || item?.title || `问题 ${index + 1}`}</Text>
              <Text style={styles.body}>{answerText(item?.answer ?? item?.answers ?? item?.value) || '未填写'}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {tab === 'video' ? (
        <Card>
          {videos.length === 0 ? <Text style={styles.meta}>暂无训练视频。</Text> : null}
          {videos.map((video) => (
            <Pressable key={video.id || video.video_url} accessibilityRole="button" onPress={() => setVideoTarget({ url: video.video_url, title: video.exercise_name || '训练视频' })} style={styles.videoRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>{String(video.exercise_name || '训练视频').trim() || '训练视频'}</Text>
              <Text style={styles.meta}>{dateText(video.created_at)} · 点击播放</Text>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <VideoPlayerModal target={videoTarget} onClose={() => setVideoTarget(null)} />
    </ScreenShell>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.meta}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerMain: { flex: 1, minWidth: 0, gap: 4 },
  name: { color: colors.text, ...typography.section },
  meta: { color: colors.textTertiary, ...typography.meta },
  body: { color: colors.textSecondary, ...typography.body },
  value: { color: colors.text, ...typography.body, fontWeight: '600' },
  accent: { color: colors.brandText, ...typography.meta, fontWeight: '600' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { color: colors.textSecondary, backgroundColor: colors.surfaceMuted, borderRadius: radius.tag, paddingHorizontal: spacing.xs, paddingVertical: 2, overflow: 'hidden', ...typography.tag },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: spacing.sm },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { color: colors.text, ...typography.section },
  sectionTitle: { color: colors.text, ...typography.card },
  cardTitle: { color: colors.text, ...typography.body, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  sportCard: { gap: 6, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  reviewRow: { gap: 4, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  link: { minHeight: 40, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { color: colors.link, ...typography.meta, fontWeight: '600' },
  dangerText: { color: colors.danger, ...typography.meta, fontWeight: '600' },
  // 与小程序 ClTabs 一致：下划线标签
  tabs: { flexDirection: 'row', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { minHeight: controlHeight.md, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabActive: { borderBottomColor: colors.text },
  tabText: { color: colors.textSecondary, ...typography.body },
  tabTextActive: { color: colors.text, fontWeight: '700' },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  answerRow: { gap: 2, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  videoRow: { minHeight: 52, justifyContent: 'center', gap: 2, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
})
