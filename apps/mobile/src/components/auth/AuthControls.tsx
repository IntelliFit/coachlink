import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, radius, spacing } from '../../theme'

type PillButtonProps = {
  label: string
  onPress?: () => void
  variant?: 'primary' | 'secondary' | 'soft'
  disabled?: boolean
  loading?: boolean
}

export function PillButton({ label, onPress, variant = 'primary', disabled = false, loading = false }: PillButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pillButton,
        variant === 'primary' && styles.pillPrimary,
        variant === 'secondary' && styles.pillSecondary,
        variant === 'soft' && styles.pillSoft,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.surface : colors.brand} />
      ) : (
        <Text style={[styles.pillLabel, variant === 'primary' ? styles.pillPrimaryLabel : styles.pillSecondaryLabel]}>{label}</Text>
      )}
    </Pressable>
  )
}

type AuthInputProps = {
  value: string
  onChangeText: (value: string) => void
  placeholder: string
  icon?: ReactNode
  secureTextEntry?: boolean
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'phone-pad'
  inputMode?: 'text' | 'email' | 'numeric' | 'tel'
  autoComplete?: 'email' | 'tel' | 'password' | 'current-password' | 'new-password' | 'one-time-code'
  textContentType?: 'none' | 'emailAddress' | 'telephoneNumber' | 'password' | 'newPassword' | 'oneTimeCode'
  maxLength?: number
  returnKeyType?: 'next' | 'done'
  onSubmitEditing?: () => void
  inputRef?: React.Ref<TextInput>
  right?: ReactNode
}

export function AuthInput({
  value,
  onChangeText,
  placeholder,
  icon,
  secureTextEntry,
  keyboardType = 'default',
  inputMode = 'text',
  autoComplete,
  textContentType,
  maxLength,
  returnKeyType = 'next',
  onSubmitEditing,
  inputRef,
  right,
}: AuthInputProps) {
  return (
    <View style={styles.inputRow}>
      {icon ? <View style={styles.inputIcon}>{icon}</View> : null}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        style={styles.input}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        inputMode={inputMode}
        autoComplete={autoComplete}
        textContentType={textContentType}
        maxLength={maxLength}
        returnKeyType={returnKeyType}
        submitBehavior="submit"
        onSubmitEditing={onSubmitEditing}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {right}
    </View>
  )
}

type ModeSwitcherProps<T extends string> = {
  value: T
  items: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}

export function ModeSwitcher<T extends string>({ value, items, onChange }: ModeSwitcherProps<T>) {
  return (
    <View style={styles.switcher}>
      {items.map((item) => {
        const active = item.value === value
        return (
          <Pressable key={item.value} onPress={() => onChange(item.value)} style={[styles.switcherItem, active && styles.switcherActive]}>
            <Text style={[styles.switcherText, active && styles.switcherTextActive]}>{item.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

type AgreementRowProps = {
  checked: boolean
  onToggle: () => void
  suffix?: string
}

export function AgreementRow({ checked, onToggle, suffix = '' }: AgreementRowProps) {
  return (
    <View style={styles.agreementRow}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onToggle} style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
      </Pressable>
      <Text style={styles.agreementText}>
        同意<Text style={styles.agreementLink}>《用户服务协议》</Text>和<Text style={styles.agreementLink}>《隐私政策》</Text>{suffix}
      </Text>
    </View>
  )
}

export const authStyles = StyleSheet.create({
  form: {
    gap: spacing.sm,
  },
  formItem: {
    gap: spacing.xs,
  },
  formExtra: {
    alignItems: 'flex-end',
    paddingRight: spacing.sm,
  },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  tipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  tipText: {
    color: '#6B7280',
    fontSize: 15,
  },
  tipLink: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: '800',
  },
  hint: {
    marginTop: spacing.sm,
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  link: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '800',
  },
})

const styles = StyleSheet.create({
  pillButton: {
    minHeight: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
  },
  pillPrimary: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
    shadowColor: colors.brand,
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  pillSecondary: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(15, 23, 42, 0.1)',
  },
  pillSoft: {
    backgroundColor: '#FFF7F3',
    borderColor: 'rgba(207, 109, 78, 0.32)',
  },
  pillLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  pillPrimaryLabel: {
    color: colors.surface,
  },
  pillSecondaryLabel: {
    color: colors.brand,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.86,
  },
  inputRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: '#F8F8F8',
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
  },
  inputIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 48,
    color: '#0F172A',
    fontSize: 16,
    paddingVertical: 0,
  },
  switcher: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.04)',
    padding: 4,
  },
  switcherItem: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  switcherActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  switcherText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  switcherTextActive: {
    color: '#0F172A',
    fontWeight: '900',
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  checkboxMark: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 16,
  },
  agreementText: {
    flex: 1,
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 20,
  },
  agreementLink: {
    color: colors.brand,
    fontWeight: '800',
  },
})
