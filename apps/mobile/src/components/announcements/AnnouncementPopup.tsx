import { useState } from 'react'
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { IconFont } from '../IconFont'
import type { UserAnnouncement } from '../../notifications/announcementFeed'
import { colors, floatShadow, radius, spacing } from '../../theme'

type AnnouncementPopupProps = {
  items: UserAnnouncement[]
  onClose: () => void
  onOpenDetail: (id: string) => void
}

/** 打开首页时自动弹出的公告；多条逐条查看，「知道了」看完后关闭。对应小程序 AnnouncementPopup。 */
export function AnnouncementPopup({ items, onClose, onOpenDetail }: AnnouncementPopupProps) {
  const [current, setCurrent] = useState(0)
  if (items.length === 0) return null
  const index = Math.min(current, items.length - 1)
  const item = items[index]
  const isLast = index >= items.length - 1

  const openDetail = () => {
    onClose()
    onOpenDetail(item.id)
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.mask}>
        <Pressable accessibilityRole="button" accessibilityLabel="关闭通知" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.panel} accessibilityViewIsModal>
          <Pressable accessibilityRole="button" accessibilityLabel={`查看通知：${item.title}`} onPress={openDetail}>
            {item.coverImageUrl ? (
              <Image source={{ uri: item.coverImageUrl }} style={styles.cover} resizeMode="cover" />
            ) : (
              <View style={[styles.cover, styles.coverPlaceholder]}>
                <IconFont name="icon-messages" size={56} color={colors.surface} />
              </View>
            )}
            <View style={styles.body}>
              <View style={styles.headRow}>
                <Text style={styles.tag}>平台通知</Text>
                {items.length > 1 ? <Text style={styles.counter}>{index + 1} / {items.length}</Text> : null}
              </View>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              {item.summary || item.content ? <Text style={styles.summary} numberOfLines={4}>{item.summary || item.content}</Text> : null}
            </View>
          </Pressable>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel="查看详情" onPress={openDetail} style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>查看详情</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isLast ? '知道了' : '下一条'}
              onPress={() => (isLast ? onClose() : setCurrent(index + 1))}
              style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>{isLast ? '知道了' : '下一条'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: 'rgba(36,29,26,0.56)',
  },
  panel: {
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...floatShadow,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceMuted,
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  body: {
    gap: spacing.xs,
    padding: spacing.sm,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tag: {
    color: colors.brandDark,
    backgroundColor: colors.brandSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  counter: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  summary: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  button: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  primary: {
    backgroundColor: colors.brand,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.82,
  },
  primaryText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
})
