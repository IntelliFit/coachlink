import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import { LockKeyhole, MessageSquareText } from 'lucide-react-native'
import { AppButton } from '../components/AppButton'
import { useAuth } from '../providers/AuthProvider'
import { colors, radius, spacing } from '../theme'

type LoginMode = 'password' | 'code'

export function LoginScreen() {
  const { loginWithPassword, loginWithCode } = useAuth()
  const [mode, setMode] = useState<LoginMode>('password')
  const [phoneOrEmail, setPhoneOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [loading, setLoading] = useState(false)

  const canSubmit = phoneOrEmail.trim().length > 0 && (mode === 'password' ? password.trim().length > 0 : verifyCode.trim().length > 0)

  async function submit() {
    if (!canSubmit || loading) return
    setLoading(true)
    try {
      if (mode === 'password') {
        await loginWithPassword(phoneOrEmail.trim(), password)
      } else {
        await loginWithCode(phoneOrEmail.trim(), verifyCode.trim())
      }
    } catch (error) {
      Alert.alert('登录失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <View style={styles.content}>
        <View style={styles.brandBlock}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>CL</Text>
          </View>
          <Text style={styles.title}>CoachLink</Text>
          <Text style={styles.subtitle}>训练、教练与知识库</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.segment}>
            <Text
              onPress={() => setMode('password')}
              style={[styles.segmentItem, mode === 'password' && styles.segmentActive]}
            >
              密码
            </Text>
            <Text
              onPress={() => setMode('code')}
              style={[styles.segmentItem, mode === 'code' && styles.segmentActive]}
            >
              验证码
            </Text>
          </View>

          <TextInput
            value={phoneOrEmail}
            onChangeText={setPhoneOrEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="手机号或邮箱"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          {mode === 'password' ? (
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="密码"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          ) : (
            <TextInput
              value={verifyCode}
              onChangeText={setVerifyCode}
              keyboardType="number-pad"
              placeholder="验证码"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          )}

          <AppButton
            label="登录"
            onPress={submit}
            disabled={!canSubmit}
            loading={loading}
            icon={mode === 'password' ? <LockKeyhole color={colors.surface} size={18} /> : <MessageSquareText color={colors.surface} size={18} />}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.sm,
    gap: spacing.lg,
  },
  brandBlock: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  logoText: {
    color: colors.surface,
    fontSize: 30,
    fontWeight: '900',
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  form: {
    gap: spacing.sm,
  },
  segment: {
    flexDirection: 'row',
    minHeight: 48,
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  segmentItem: {
    flex: 1,
    borderRadius: radius.sm,
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingVertical: 10,
  },
  segmentActive: {
    color: colors.brand,
    backgroundColor: colors.surface,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing.sm,
  },
})
