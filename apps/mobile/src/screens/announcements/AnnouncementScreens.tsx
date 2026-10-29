import { useCallback, useEffect, useMemo, useState } from 'react'
import { Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { resolveCoachLinkAppRole } from '@coachlink/core'
import { IconFont } from '../../components/IconFont'
import { ImagePreviewModal } from '../../components/ImagePreviewModal'
import { announcementFeed, formatAnnouncementDate, useAnnouncementFeed } from '../../notifications/announcementFeed'
import { useAuth } from '../../providers/AuthProvider'
import { colors, radius, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'
import { Card, EmptyState, LoadingState, ScreenShell, SolidButton, type RootNav } from '../me/MeShared'
import { planAnnouncementAction, runAnnouncementAction } from './announcementNavigation'

export function AnnouncementsScreen() {
  const navigation = useNavigation<RootNav>()
  const { items, unreadCount } = useAnnouncementFeed()
  const [loading, setLoading] = useState(items.length === 0)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      await announcementFeed.load()
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(useCallback(() => {
    void load()
  }, [load]))

  return (
    <ScreenShell
      title="平台通知"
      subtitle="版本更新、活动和服务公告。"
      onBack={navigation.goBack}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.brand} colors={[colors.brand]} onRefresh={() => {
        setRefreshing(true)
        void load()
      }} />}
    >
      {unreadCount > 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel="全部标为已读" onPress={() => announcementFeed.markAllRead()} style={styles.markAll}>
          <Text style={styles.markAllText}>{unreadCount} 条未读 · 全部标为已读</Text>
        </Pressable>
      ) : null}
      {loading && items.length === 0 ? <LoadingState /> : null}
      {!loading && items.length === 0 ? <EmptyState title="暂时没有通知" desc="平台发布的新通知会出现在这里。" icon="icon-messages" /> : null}
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={`${item.isRead ? '' : '未读，'}${item.title}`}
          onPress={() => navigation.navigate('AnnouncementDetail', { id: item.id })}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          {item.coverImageUrl ? (
            <Image source={{ uri: item.coverImageUrl }} style={styles.thumb} resizeMode="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <IconFont name="icon-messages" size={26} color={colors.brand} />
            </View>
          )}
          <View style={styles.rowCopy}>
            <View style={styles.rowHead}>
              {!item.isRead ? <View style={styles.dot} /> : null}
              {item.pinned ? <Text style={styles.pin}>置顶</Text> : null}
              <Text style={[styles.rowTitle, !item.isRead && styles.rowTitleUnread]} numberOfLines={1}>{item.title}</Text>
            </View>
            {item.summary || item.content ? <Text style={styles.rowSummary} numberOfLines={2}>{item.summary || item.content}</Text> : null}
            {item.publishedAt ? <Text style={styles.rowDate}>{formatAnnouncementDate(item.publishedAt)}</Text> : null}
          </View>
        </Pressable>
      ))}
    </ScreenShell>
  )
}

export function AnnouncementDetailScreen() {
  const navigation = useNavigation<RootNav>()
  const route = useRoute<RouteProp<RootStackParamList, 'AnnouncementDetail'>>()
  const id = String(route.params?.id || '')
  const { user, isAuthenticated } = useAuth()
  const isCoachMode = isAuthenticated && resolveCoachLinkAppRole(user) === 'coach'
  const { items } = useAnnouncementFeed()
  const item = items.find((entry) => entry.id === id)
  const [loading, setLoading] = useState(!item)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (item) return
    // 从推送或外部入口进来时缓存里可能还没有这条，拉一次最新数据。
    announcementFeed.load().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (item && !item.isRead) announcementFeed.markRead(item.id)
  }, [item])

  const action = useMemo(() => (item ? planAnnouncementAction(item, isCoachMode) : null), [isCoachMode, item])

  if (!item) {
    return (
      <ScreenShell title="通知详情" onBack={navigation.goBack}>
        {loading ? <LoadingState /> : <EmptyState title="这条通知不存在或已下线" icon="icon-messages" />}
      </ScreenShell>
    )
  }

  const previewImages = [item.coverImageUrl, ...item.imageUrls].filter((url): url is string => Boolean(url))

  return (
    <ScreenShell title="通知详情" onBack={navigation.goBack}>
      {item.coverImageUrl ? (
        <Pressable accessibilityRole="imagebutton" accessibilityLabel="查看大图" onPress={() => setPreviewUrl(item.coverImageUrl)}>
          <Image source={{ uri: item.coverImageUrl }} style={styles.cover} resizeMode="cover" />
        </Pressable>
      ) : null}
      <Card style={styles.detailCard}>
        <Text style={styles.tag}>平台通知</Text>
        <Text style={styles.detailTitle} selectable>{item.title}</Text>
        {item.publishedAt ? <Text style={styles.rowDate}>{formatAnnouncementDate(item.publishedAt, true)}</Text> : null}
        {item.summary ? <Text style={styles.detailSummary} selectable>{item.summary}</Text> : null}
        {item.content ? <Text style={styles.detailContent} selectable>{item.content}</Text> : null}
        {item.imageUrls.map((url) => (
          <Pressable key={url} accessibilityRole="imagebutton" accessibilityLabel="查看大图" onPress={() => setPreviewUrl(url)}>
            <Image source={{ uri: url }} style={styles.detailImage} resizeMode="cover" />
          </Pressable>
        ))}
        {action ? <SolidButton label={item.actionLabel} onPress={() => runAnnouncementAction(action, navigation)} /> : null}
      </Card>
      <ImagePreviewModal urls={previewImages} initialUrl={previewUrl} onClose={() => setPreviewUrl(null)} />
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  markAll: {
    alignSelf: 'flex-end',
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
  },
  markAllText: {
    color: colors.brandDark,
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.86,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  pin: {
    color: colors.brandDark,
    backgroundColor: colors.brandSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    fontSize: 11,
    fontWeight: '600',
    overflow: 'hidden',
  },
  rowTitle: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  rowTitleUnread: {
    color: colors.text,
    fontWeight: '700',
  },
  rowSummary: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  rowDate: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  detailCard: {
    gap: spacing.xs,
  },
  tag: {
    alignSelf: 'flex-start',
    color: colors.brandDark,
    backgroundColor: colors.brandSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  detailTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  },
  detailSummary: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '700',
  },
  detailContent: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  detailImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
})
