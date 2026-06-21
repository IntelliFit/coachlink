import type { ReactNode } from 'react'
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native'
import { IconFont, type IconFontName } from '../components/IconFont'
import { colors, radius, shadow, spacing } from '../theme'

export function HeroPanel({ title, subtitle, kicker, icon }: { title: string; subtitle: string; kicker?: string; icon?: IconFontName }) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroText}>
        {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>{subtitle}</Text>
      </View>
      {icon ? (
        <View style={styles.heroIcon}>
          <IconFont name={icon} color={colors.brand} size={28} />
        </View>
      ) : null}
    </View>
  )
}

export function ActionGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>
}

export function ActionTile({ title, subtitle, icon, onPress }: { title: string; subtitle?: string; icon: IconFontName; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={styles.tileIcon}>
        <IconFont name={icon} color={colors.brand} size={22} />
      </View>
      <Text style={styles.tileTitle}>{title}</Text>
      {subtitle ? <Text style={styles.tileSubtitle}>{subtitle}</Text> : null}
    </Pressable>
  )
}

export function RowCard({ title, subtitle, icon, onPress, right }: { title: string; subtitle?: string; icon: IconFontName; onPress?: () => void; right?: ReactNode }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowIcon}>
        <IconFont name={icon} color={colors.brand} size={22} />
      </View>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right || <IconFont name="icon-right-arrow" color={colors.textMuted} size={16} />}
    </Pressable>
  )
}

export function ImageToolCard({ title, subtitle, image, onPress }: { title: string; subtitle: string; image: ImageSourcePropType; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.imageCard, pressed && styles.pressed]}>
      <Image source={image} style={styles.imageCardBg} resizeMode="cover" />
      <View style={styles.imageCardShade} />
      <View style={styles.imageCardContent}>
        <View style={styles.imageCardTop}>
          <Text style={styles.imageCardTitle}>{title}</Text>
          <IconFont name="icon-right-arrow" color="#FFFFFF" size={18} />
        </View>
        <Text style={styles.imageCardSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 136,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderRadius: radius.xl,
    padding: spacing.md,
    backgroundColor: '#1F1F1F',
    overflow: 'hidden',
  },
  heroText: {
    flex: 1,
    gap: spacing.xs,
  },
  kicker: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    lineHeight: 22,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    width: '47.5%',
    minHeight: 128,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
  },
  tileTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  tileSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
  },
  rowMain: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  rowSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  imageCard: {
    minHeight: 168,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  imageCardBg: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  imageCardShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  imageCardContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  imageCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imageCardTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  imageCardSubtitle: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 13,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.72,
  },
})
