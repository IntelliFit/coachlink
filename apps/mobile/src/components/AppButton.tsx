import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radius, spacing } from '../theme'

type AppButtonProps = {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  loading?: boolean
  icon?: ReactNode
}

export function AppButton({ label, onPress, variant = 'primary', disabled = false, loading = false, icon }: AppButtonProps) {
  const isPrimary = variant === 'primary'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.primary : styles.secondary,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.surface : colors.brand} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, isPrimary ? styles.primaryLabel : styles.secondaryLabel]}>{label}</Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
  },
  primary: {
    backgroundColor: colors.brandStrong,
    borderColor: colors.brandStrong,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.controlBorder,
  },
  disabled: {
    opacity: 0.56,
  },
  pressed: {
    opacity: 0.82,
  },
  content: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  primaryLabel: {
    color: colors.surface,
  },
  secondaryLabel: {
    // 与小程序 ClButton secondary 一致：白底、描边、正文色文字
    color: colors.text,
  },
})
