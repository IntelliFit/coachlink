import type { ReactElement, ReactNode } from 'react'
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type RefreshControlProps, type StyleProp, type ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { apiClient } from '../../api'
import { IconFont, type IconFontName } from '../../components/IconFont'
import { colors, radius, shadow, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'

export type RootNav = NativeStackNavigationProp<RootStackParamList>

export type AnyRecord = Record<string, any>

export function ScreenShell({
  title,
  subtitle,
  children,
  onBack,
  refreshControl,
  tabBarInset = false,
  contentContainerStyle,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onBack?: () => void
  refreshControl?: ReactElement<RefreshControlProps>
  tabBarInset?: boolean
  contentContainerStyle?: StyleProp<ViewStyle>
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView refreshControl={refreshControl} contentContainerStyle={[styles.scroll, tabBarInset && styles.scrollWithTabBar, contentContainerStyle]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {onBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel="返回" onPress={onBack} style={styles.backButton}>
              <IconFont name="icon-back" size={20} color={colors.brand} />
            </Pressable>
          ) : null}
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}

export function Card({ children, style }: { children: ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function EmptyState({ title, desc, icon = 'icon-wenhao' }: { title: string; desc?: string; icon?: IconFontName }) {
  return (
    <Card style={styles.empty}>
      <IconFont name={icon} size={34} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {desc ? <Text style={styles.emptyDesc}>{desc}</Text> : null}
    </Card>
  )
}

export function LoadingState({ title = '正在加载' }: { title?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.brand} />
      <Text style={styles.loadingText}>{title}</Text>
    </View>
  )
}

export function MenuRow({
  label,
  desc,
  icon,
  iconBg = colors.brandSoft,
  onPress,
  badge,
  disabled = false,
}: {
  label: string
  desc?: string
  icon: IconFontName
  iconBg?: string
  onPress: () => void
  badge?: string
  disabled?: boolean
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={desc} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.menuRow, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
      <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
        <IconFont name={icon} size={22} color={colors.surface} />
      </View>
      <View style={styles.menuBody}>
        <Text style={styles.menuLabel}>{label}</Text>
        {desc ? <Text style={styles.menuDesc}>{desc}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <IconFont name="icon-right-arrow" size={18} color={colors.textMuted} />
    </Pressable>
  )
}

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType = 'default',
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  multiline?: boolean
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad'
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[styles.input, multiline && styles.textarea]}
      />
    </View>
  )
}

export function SolidButton({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
  disabled?: boolean
}) {
  const primary = variant === 'primary'
  const danger = variant === 'danger'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.primaryButton,
        variant === 'secondary' && styles.secondaryButton,
        danger && styles.dangerButton,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? <ActivityIndicator color={primary || danger ? colors.surface : colors.brand} /> : <Text style={[styles.buttonText, !primary && !danger && styles.secondaryButtonText]}>{label}</Text>}
    </Pressable>
  )
}

export function InlineAvatar({ uri, label, size = 64 }: { uri?: string | null; label?: string | null; size?: number }) {
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: Math.max(18, size * 0.34) }]}>{String(label || 'C').slice(0, 1)}</Text>
    </View>
  )
}

export async function safeRequest<T>(path: string, options?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; body?: unknown }) {
  return apiClient.request<T>(path, {
    method: options?.method || 'POST',
    body: options?.body,
  })
}

export function errorMessage(error: unknown, fallback = '操作失败') {
  return error instanceof Error ? error.message : fallback
}

export function confirm(title: string, message: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: '取消', style: 'cancel' },
    { text: '确定', style: 'destructive', onPress: onConfirm },
  ])
}

export function pickList(data: unknown, keys: string[]) {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return []
  const record = data as AnyRecord
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key]
  }
  return []
}

export function asText(value: unknown, fallback = '未填写') {
  const text = value == null ? '' : String(value).trim()
  return text || fallback
}

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.sm,
    paddingBottom: 96,
    gap: spacing.sm,
  },
  scrollWithTabBar: {
    paddingBottom: 144,
  },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
    ...shadow,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  emptyDesc: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  loading: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  menuRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBody: {
    flex: 1,
    gap: 2,
  },
  menuLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  menuDesc: {
    color: colors.textTertiary,
    fontSize: 13,
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    backgroundColor: colors.brand,
  },
  badgeText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: '600',
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    minHeight: 48,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontSize: 16,
  },
  textarea: {
    minHeight: 112,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  button: {
    minHeight: 48,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: colors.brandStrong,
    borderColor: colors.brandStrong,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderColor: colors.controlBorder,
  },
  dangerButton: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  buttonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: colors.text,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.5,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  avatarText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
})

