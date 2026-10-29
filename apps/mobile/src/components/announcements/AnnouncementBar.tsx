import { Pressable, StyleSheet, Text, View } from 'react-native'
import { IconFont } from '../IconFont'
import { useAnnouncementFeed } from '../../notifications/announcementFeed'
import { colors, radius, spacing } from '../../theme'

/** 首页顶部的通知入口：有未读时高亮并显示条数和最新一条标题，点进通知列表。 */
export function AnnouncementBar({ onPress }: { onPress: () => void }) {
  const { items, unreadCount } = useAnnouncementFeed()
  if (items.length === 0) return null

  const latest = items.find((item) => !item.isRead) || items[0]
  const hasUnread = unreadCount > 0

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hasUnread ? `${unreadCount} 条新通知：${latest.title}` : `平台通知：${latest.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.bar, hasUnread && styles.barUnread, pressed && styles.pressed]}
    >
      <View style={[styles.icon, hasUnread && styles.iconUnread]}>
        <IconFont name="icon-messages" size={18} color={hasUnread ? colors.surface : colors.brand} />
        {hasUnread ? <View style={styles.dot} /> : null}
      </View>
      <Text style={[styles.title, hasUnread && styles.titleUnread]} numberOfLines={1}>{latest.title}</Text>
      {hasUnread ? <Text style={styles.count}>{unreadCount > 99 ? '99+' : unreadCount} 条新通知</Text> : null}
      <IconFont name="icon-right-arrow" size={16} color={hasUnread ? colors.brandDark : colors.textMuted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  barUnread: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  pressed: {
    opacity: 0.86,
  },
  icon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.brandSoft,
  },
  iconUnread: {
    backgroundColor: colors.brand,
  },
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  title: {
    flex: 1,
    minWidth: 0,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  titleUnread: {
    color: colors.text,
    fontWeight: '700',
  },
  count: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '600',
  },
})
