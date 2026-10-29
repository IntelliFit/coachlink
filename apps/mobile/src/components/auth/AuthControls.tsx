import { useState, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, radius, spacing } from '../../theme'

type PillButtonProps = {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'soft'
  disabled?: boolean
  loading?: boolean
}

export function PillButton({ label, onPress, variant = 'primary', disabled = false, loading = false }: PillButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
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
  label: string
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
  label,
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
  const [passwordVisible, setPasswordVisible] = useState(false)
  const isPassword = Boolean(secureTextEntry)

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputRow}>
        {icon ? <View style={styles.inputIcon}>{icon}</View> : null}
        <TextInput
          accessibilityLabel={label}
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          style={styles.input}
          secureTextEntry={isPassword && !passwordVisible}
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
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? `隐藏${label}` : `显示${label}`}
            accessibilityState={{ selected: passwordVisible }}
            onPress={() => setPasswordVisible((visible) => !visible)}
            style={({ pressed }) => [styles.passwordToggle, pressed && styles.passwordTogglePressed]}
          >
            <Text style={styles.passwordToggleText}>{passwordVisible ? '隐藏' : '显示'}</Text>
          </Pressable>
        ) : null}
      </View>
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
          <Pressable
            key={item.value}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.value)}
            style={[styles.switcherItem, active && styles.switcherActive]}
          >
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
  onOpenTerms: () => void
  onOpenPrivacy: () => void
  onOpenDisclaimer?: () => void
}

export function AgreementRow({ checked, onToggle, onOpenTerms, onOpenPrivacy, onOpenDisclaimer }: AgreementRowProps) {
  return (
    <View style={styles.agreementRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={checked ? '取消同意用户协议和隐私政策' : '同意用户协议和隐私政策'}
        accessibilityState={{ checked }}
        onPress={onToggle}
        style={styles.checkboxTouch}
      >
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
        </View>
      </Pressable>
      <Text style={styles.agreementText}>
        我已阅读并同意
        <Text accessibilityRole="link" onPress={onOpenTerms} style={styles.agreementLink}>《用户服务协议》</Text>
        和
        <Text accessibilityRole="link" onPress={onOpenPrivacy} style={styles.agreementLink}>《隐私政策》</Text>
        {onOpenDisclaimer ? (
          <Text>
            与<Text accessibilityRole="link" onPress={onOpenDisclaimer} style={styles.agreementLink}>《免责声明》</Text>
          </Text>
        ) : null}
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
  textAction: {
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipLink: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
  inputGroup: {
    gap: spacing.xs,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    paddingLeft: spacing.sm,
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
  passwordToggle: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordTogglePressed: {
    opacity: 0.64,
  },
  passwordToggleText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '600',
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
    fontWeight: '700',
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  checkboxTouch: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
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
    fontWeight: '700',
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
    fontWeight: '600',
  },
})
