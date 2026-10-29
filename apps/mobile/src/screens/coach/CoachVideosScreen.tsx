import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack'
import { IconFont } from '../../components/IconFont'
import { Card, EmptyState, LoadingState, ScreenShell } from '../me/MeShared'
import { colors, radius, spacing } from '../../theme'
import { openExternalUrl } from '../../externalLinks'
import type { RootStackParamList } from '../../navigation/types'
import { safeRequest } from '../me/MeShared'
import { formatRestMinutes } from '@coachlink/core/src/restDisplay'

type Navigation = NativeStackNavigationProp<RootStackParamList>

type Filter = 'pending' | 'reviewed'

type VideoItem = {
  id: string
  student_id?: string | null
  student_name?: string | null
  exercise_name?: string | null
  action_name?: string | null
  review_status?: 'pending' | 'reviewed' | 'not_required'
  user_notes?: string | null
  coach_feedback?: string | null
  coach_rating?: number | null
  video_url?: string | null
  set_number?: number | null
  created_at?: string | null
  execution_details?: {
    planned_reps?: number | null
    planned_weight?: number | null
    actual_reps?: number | null
    actual_weight?: number | null
    rpe?: number | null
    rest_seconds?: number | null
  } | null
  metadata?: {
    day_index?: number | null
    student_name?: string | null
    instance_id?: string | null
  } | null
  reviewed_at?: string | null
}

type VideoListResponse = {
  videos: VideoItem[]
  total: number
}

const FILTER_OPTIONS: Array<{ label: string; value: Filter }> = [
  { label: '待点评', value: 'pending' },
  { label: '已点评', value: 'reviewed' },
]

const PAGE_SIZE = 20

function toLabel(value: VideoItem) {
  return (
    value.student_name
    || value.metadata?.student_name
    || value.student_id
    || '学员'
  )
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function CoachVideosScreen() {
  const navigation = useNavigation<Navigation>()
  const isTopLevelTab = useRoute().name === 'CoachVideosTab'
  const backAction = isTopLevelTab ? undefined : () => navigation.goBack()
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [filter, setFilter] = useState<Filter>('pending')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const load = useCallback(async (nextPage = 0, quiet = false) => {
    try {
      if (quiet) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const data = await safeRequest<VideoListResponse>('/api/coach/video/execution-videos-pending', {
        body: {
          pagination: { page: nextPage + 1, limit: PAGE_SIZE },
          reviewStatus: filter,
        },
      })

      setVideos(Array.isArray(data?.videos) ? data.videos : [])
      setTotal(Number(data?.total || 0))
      setPage(nextPage)
    } catch (e) {
      setVideos([])
      setTotal(0)
      setError(e instanceof Error ? e.message : '视频列表加载失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter])

  useEffect(() => {
    void load(0)
  }, [filter])

  const title = useMemo(() => filter === 'pending' ? '待点评视频' : '已点评视频', [filter])

  return (
    <ScreenShell title="视频点评" subtitle={title} onBack={backAction} tabBarInset={isTopLevelTab}>
      <Card style={styles.toolbar}>
        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((item) => (
            <Pressable
              key={item.value}
              accessibilityRole="button"
              accessibilityLabel={`筛选${item.label}视频`}
              accessibilityState={{ selected: filter === item.value }}
              onPress={() => {
                setFilter(item.value)
                setPage(0)
              }}
              style={({ pressed }) => [
                styles.filterPill,
                filter === item.value && styles.filterPillActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.filterText, filter === item.value && styles.filterTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {loading ? (
        <LoadingState title="正在加载视频" />
      ) : null}

      {!loading && error ? (
        <EmptyState title="加载失败" desc={error} icon="icon-wenhao" />
      ) : null}

      {!loading && !error && videos.length === 0 ? (
        <EmptyState
          title={filter === 'pending' ? '暂无待点评视频' : '暂无已点评视频'}
          desc={filter === 'pending' ? '学员的视频上传后会出现在这里。' : '点评历史会显示在这里。'}
          icon="icon-video"
        />
      ) : null}

      {!loading && !error && videos.length > 0 ? (
        <>
          <View style={styles.list}>
            {videos.map((video) => (
              <Pressable
                key={video.id}
                onPress={() => navigation.navigate('CoachVideoReview', { videoId: video.id })}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{toLabel(video)}</Text>
                  <StatusTag status={video.review_status} />
                </View>
                <Text style={styles.cardMeta}>
                  {video.exercise_name || video.action_name || '动作视频'} · 第 {video.set_number || 1} 组
                </Text>
                {video.execution_details ? (
                  <Text style={styles.cardMeta}>
                    {video.execution_details.actual_reps != null ? `${video.execution_details.actual_reps} / ${video.execution_details.planned_reps || '-'} 次` : ''}
                  </Text>
                ) : null}
                <Text style={styles.cardDate}>{formatDate(video.created_at) || '暂无时间'}</Text>

                <View style={styles.cardActionRow}>
                  <IconFont
                    name="icon-pinglun"
                    size={16}
                    color={colors.brand}
                  />
                  <Text style={styles.cardActionText}>
                    {video.review_status === 'reviewed' ? '查看点评' : '去点评'}
                  </Text>
                  <IconFont name="icon-right-arrow" size={18} color={colors.textMuted} />
                </View>
              </Pressable>
            ))}
          </View>

          <View style={styles.pager}>
            <Pressable
              disabled={page <= 0 || refreshing}
              onPress={() => void load(Math.max(0, page - 1), true)}
              style={({ pressed }) => [styles.pagerButton, (page <= 0 || refreshing) && styles.pagerButtonDisabled, pressed && styles.pressed]}
            >
              <Text style={[styles.pagerText, (page <= 0 || refreshing) && styles.pagerTextDisabled]}>上一页</Text>
            </Pressable>
            <Text style={styles.pageText}>第 {page + 1} / {totalPages} 页</Text>
            <Pressable
              disabled={page >= totalPages - 1 || refreshing}
              onPress={() => void load(Math.min(totalPages - 1, page + 1), true)}
              style={({ pressed }) => [styles.pagerButton, (page >= totalPages - 1 || refreshing) && styles.pagerButtonDisabled, pressed && styles.pressed]}
            >
              <Text style={[styles.pagerText, (page >= totalPages - 1 || refreshing) && styles.pagerTextDisabled]}>下一页</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </ScreenShell>
  )
}

export function CoachVideoReviewScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'CoachVideoReview'>) {
  const videoId = route.params?.videoId || ''
  const [video, setVideo] = useState<VideoItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const isReviewed = video?.review_status === 'reviewed'

  const load = useCallback(async () => {
    if (!videoId) {
      setMessage('参数错误')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setMessage(null)
      const data = await safeRequest<VideoListResponse>('/api/coach/video/execution-videos-pending', {
        body: { pagination: { page: 1, limit: 200 } },
      })
      const item = Array.isArray(data?.videos)
        ? data.videos.find((row) => row.id === videoId)
        : null

      if (!item) {
        setMessage('视频不存在，可能已删除')
        setVideo(null)
        return
      }

      setVideo(item)
      setRating(Number(item.coach_rating || 0))
      setComment(item.coach_feedback || '')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '视频加载失败')
      setVideo(null)
    } finally {
      setLoading(false)
    }
  }, [videoId])

  useEffect(() => {
    void load()
  }, [load])

  async function submitReview() {
    if (!videoId || !video) return
    if (!comment.trim()) {
      Alert.alert('提示', '请输入点评内容')
      return
    }

    try {
      setSubmitting(true)
      await safeRequest('/api/coach/video/execution-review', {
        body: {
          videoId,
          feedback: {
            rating: rating || 0,
            comment: comment.trim(),
          },
        },
      })

      setVideo((prev) => prev ? { ...prev, review_status: 'reviewed', coach_rating: rating, coach_feedback: comment.trim(), reviewed_at: new Date().toISOString() } : prev)
      Alert.alert('点评成功', '点评已提交')
      setTimeout(() => {
        if (navigation?.goBack) navigation.goBack()
      }, 700)
    } catch (e) {
      Alert.alert('提交失败', e instanceof Error ? e.message : '点评提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const exec = video?.execution_details

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.loadingText}>正在加载点评内容</Text>
      </View>
    )
  }

  if (message || !video) {
    return (
      <ScreenShell title="视频点评" onBack={() => navigation.goBack()}>
        <EmptyState title={message || '视频不存在'} desc={message ? undefined : '请返回列表重试。'} icon="icon-wenhao" />
      </ScreenShell>
    )
  }

  return (
    <ScreenShell title="视频点评" subtitle={`${toLabel(video)} · ${video.exercise_name || '动作视频'}`} onBack={() => navigation.goBack()}>
      <ScrollView style={styles.reviewScroll} contentContainerStyle={styles.reviewContent} showsVerticalScrollIndicator={false}>
        <Card style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <View style={styles.titleRow}>
              <Text style={styles.reviewTitle}>训练执行数据</Text>
              <StatusTag status={video.review_status} />
            </View>
            <Text style={styles.reviewMeta}>
              第 {video.set_number || 1} 组 · Day {video.metadata?.day_index ?? '-'}
            </Text>
          </View>

          <View style={styles.videoActionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`打开${video.student_name || '学员'}的训练视频`}
              onPress={() => void openExternalUrl(video.video_url, { errorTitle: '视频打开失败' })}
              disabled={!video.video_url}
              style={({ pressed }) => [styles.secondaryBtn, !video.video_url && styles.secondaryDisabled, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryBtnText}>打开视频</Text>
            </Pressable>
            <Text style={styles.metaText}>{video.video_url ? '已上传' : '暂无视频链接'}</Text>
          </View>

          <View style={styles.divider} />

          {exec ? (
            <View style={styles.detailGrid}>
              {exec.actual_reps != null ? (
                <MetricRow label="完成次数" value={`${exec.actual_reps}${exec.planned_reps != null ? ` / ${exec.planned_reps}` : ''}`} />
              ) : null}
              {exec.actual_weight != null ? (
                <MetricRow label="重量" value={`${exec.actual_weight}kg${exec.planned_weight != null ? ` / ${exec.planned_weight}kg` : ''}`} />
              ) : null}
              {exec.rpe != null ? <MetricRow label="RPE" value={`${exec.rpe}/10`} /> : null}
              {exec.rest_seconds != null ? <MetricRow label="休息" value={formatRestMinutes(exec.rest_seconds) || '无间歇'} /> : null}
            </View>
          ) : null}

          {video.user_notes ? <Text style={styles.notes}>学员备注：{video.user_notes}</Text> : null}
        </Card>

        <Card style={styles.reviewCard}>
          <Text style={styles.reviewTitle}>教练评分</Text>
          <View style={styles.starRow}>
            {Array.from({ length: 5 }, (_, index) => index + 1).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={`训练视频评分 ${value} 星`}
                accessibilityState={{ selected: rating === value, disabled: isReviewed }}
                disabled={isReviewed}
                onPress={() => !isReviewed && setRating(value)}
                style={({ pressed }) => [styles.star, pressed && styles.pressed]}
              >
                <Text style={[styles.starText, (rating >= value) && styles.starTextActive]}>{rating >= value ? '★' : '☆'}</Text>
              </Pressable>
            ))}
          </View>
          {isReviewed ? <Text style={styles.readonlyHint}>该视频已点评，不可编辑</Text> : null}

          <Text style={styles.reviewTitle}>点评反馈</Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            editable={!isReviewed}
            placeholder="输入对该动作的指导意见..."
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.textarea}
          />

          {!isReviewed ? (
            <Pressable onPress={submitReview} disabled={submitting || !comment.trim()} style={({ pressed }) => [styles.primaryBtn, (submitting || !comment.trim()) && styles.primaryBtnDisabled, pressed && styles.pressed]}>
              {submitting ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryBtnText}>{submitting ? '提交中...' : '提交指导意见'}</Text>}
            </Pressable>
          ) : null}
        </Card>
      </ScrollView>
    </ScreenShell>
  )
}

function StatusTag({ status }: { status?: 'pending' | 'reviewed' | 'not_required' }) {
  const isReviewed = status === 'reviewed'
  const isNotRequired = status === 'not_required'
  return (
    <View style={[styles.statusPill, isReviewed ? styles.reviewedStatus : styles.pendingStatus, isNotRequired && styles.notRequiredStatus]}>
      <Text style={[styles.statusText, isReviewed ? styles.reviewedText : styles.pendingText, isNotRequired && styles.notRequiredText]}>
        {isReviewed ? '已点评' : isNotRequired ? '无需点评' : '待点评'}
      </Text>
    </View>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  toolbar: {
    gap: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  filterPill: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.selected,
    borderColor: colors.selected,
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  filterTextActive: {
    color: colors.surface,
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  cardMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  cardDate: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  cardActionRow: {
    marginTop: spacing.xs,
    minHeight: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  cardActionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  statusPill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingStatus: {
    backgroundColor: '#FFF4DE',
  },
  reviewedStatus: {
    backgroundColor: '#E8F6EF',
  },
  notRequiredStatus: {
    backgroundColor: colors.surfaceMuted,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pendingText: {
    color: colors.warning,
  },
  reviewedText: {
    color: colors.success,
  },
  notRequiredText: {
    color: colors.textTertiary,
  },
  pager: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pagerButton: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  pagerButtonDisabled: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.75,
  },
  pagerText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  pagerTextDisabled: {
    color: colors.textTertiary,
  },
  pageText: {
    color: colors.textSecondary,
    width: 90,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  reviewScroll: {
    flex: 1,
  },
  reviewContent: {
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  reviewCard: {
    gap: spacing.sm,
  },
  reviewHeader: {
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  reviewTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  reviewMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  videoActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  secondaryBtn: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  secondaryDisabled: {
    opacity: 0.5,
  },
  secondaryBtnText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '700',
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  detailGrid: {
    gap: spacing.xs,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  metricValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  notes: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  star: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starText: {
    color: colors.textTertiary,
    fontSize: 24,
    lineHeight: 26,
  },
  starTextActive: {
    color: '#F8B84A',
  },
  readonlyHint: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  textarea: {
    minHeight: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    color: colors.text,
    textAlignVertical: 'top',
    fontSize: 14,
    lineHeight: 22,
  },
  primaryBtn: {
    marginTop: spacing.xs,
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.8,
  },
})
