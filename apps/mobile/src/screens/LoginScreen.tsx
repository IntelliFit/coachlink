import { useEffect, useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { apiClient } from '../api'
import { IconFont } from '../components/IconFont'
import { AuthInput, AgreementRow, authStyles, ModeSwitcher, PillButton } from '../components/auth/AuthControls'
import { AuthShell } from '../components/auth/AuthShell'
import { SliderCaptchaModal } from '../components/auth/SliderCaptchaModal'
import { useAuth } from '../providers/AuthProvider'
import { DEV_USERS, type DevUser } from '../../../../src/config/devUsers'
import { colors } from '../theme'
import type { RootStackParamList } from '../navigation/types'

type LoginMode = 'password' | 'verifyCode'
type Props = NativeStackScreenProps<RootStackParamList, 'Login'>

const IS_DEV = process.env.NODE_ENV === 'development'

function isPhone(value: string) {
  return /^1[3-9]\d{9}$/.test(value.trim())
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isValidPhoneOrEmail(value: string) {
  return isPhone(value) || isEmail(value)
}

function isPasswordUnavailableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  return message.includes('尚未设置密码') || message.includes('Input buffers must have the same byte length')
}

export function LoginScreen({ navigation }: Props) {
  const { loginWithPassword, loginWithCode, continueAsGuest, loginAsDevUser } = useAuth()
  const [mode, setMode] = useState<LoginMode>('password')
  const [phoneOrEmail, setPhoneOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [agreed, setAgreed] = useState(false)
  const [captchaVisible, setCaptchaVisible] = useState(false)
  const passwordInputRef = useRef<TextInput>(null)
  const codeInputRef = useRef<TextInput>(null)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((current) => Math.max(0, current - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const canSubmit = phoneOrEmail.trim().length > 0 && (mode === 'password' ? password.trim().length > 0 : verifyCode.trim().length > 0)
  const hasDevUsers = DEV_USERS.length > 0

  function requireAgreement() {
    if (!agreed) {
      Alert.alert('请先同意协议', '请阅读并勾选用户服务协议和隐私政策')
      return false
    }
    return true
  }

  async function submit() {
    if (!requireAgreement() || !canSubmit || loading) return
    const account = phoneOrEmail.trim()
    if (!isValidPhoneOrEmail(account)) {
      Alert.alert('格式不正确', '请输入正确的手机号或邮箱')
      return
    }
    if (mode === 'verifyCode' && !/^\d{6}$/.test(verifyCode.trim())) {
      Alert.alert('验证码不正确', '请输入 6 位数字验证码')
      return
    }
    setLoading(true)
    try {
      if (mode === 'password') {
        await loginWithPassword(account, password)
      } else {
        await loginWithCode(account, verifyCode.trim())
      }
    } catch (error) {
      if (mode === 'password' && isPasswordUnavailableError(error)) {
        Alert.alert(
          '该账号尚未设置密码',
          '这是微信登录创建的账号。你可以使用验证码登录，或先通过“忘记密码”设置密码。',
          [
            {
              text: '验证码登录',
              onPress: () => {
                setMode('verifyCode')
                setPassword('')
              },
            },
            { text: '忘记密码', onPress: () => navigation.navigate('ResetPassword') },
            { text: '取消', style: 'cancel' },
          ],
        )
      } else {
        Alert.alert('登录失败', error instanceof Error ? error.message : '请稍后重试')
      }
    } finally {
      setLoading(false)
    }
  }

  async function sendVerificationCode(captchaToken: string) {
    const account = phoneOrEmail.trim()
    setSendingCode(true)
    try {
      if (isEmail(account)) {
        await apiClient.sendEmailCode({ email: account, captchaToken })
      } else {
        await apiClient.sendSmsCode({ phoneNumber: account, captchaToken })
      }
      setCountdown(60)
      Alert.alert('验证码已发送', IS_DEV ? '开发环境验证码通常为 123456' : '请查收验证码')
    } catch (error) {
      Alert.alert('发送失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setSendingCode(false)
    }
  }

  function startSendCode() {
    if (!requireAgreement()) return
    if (!isValidPhoneOrEmail(phoneOrEmail)) {
      Alert.alert('格式不正确', '请输入正确的手机号或邮箱')
      return
    }
    setCaptchaVisible(true)
  }

  async function handleDevLogin() {
    try {
      await loginAsDevUser()
    } catch (error) {
      Alert.alert('开发登录失败', error instanceof Error ? error.message : '请稍后重试')
    }
  }

  async function handleDevLoginWithUser(user: DevUser) {
    try {
      await loginAsDevUser(user)
    } catch (error) {
      Alert.alert('开发登录失败', error instanceof Error ? error.message : '请稍后重试')
    }
  }

  const visibleDevUsers = DEV_USERS

  return (
    <AuthShell title="教链 CoachLink" slogan="登录以继续你的训练计划" cardTitle="登录">
      <View style={authStyles.rowActions}>
        <PillButton label="先逛逛" variant="soft" onPress={continueAsGuest} />
      </View>

      <View style={authStyles.form}>
        <ModeSwitcher
          value={mode}
          onChange={(next) => {
            setMode(next)
            setPassword('')
            setVerifyCode('')
          }}
          items={[
            { value: 'password', label: '密码登录' },
            { value: 'verifyCode', label: '验证码登录' },
          ]}
        />

        <AgreementRow
          checked={agreed}
          onToggle={() => setAgreed((value) => !value)}
          onOpenTerms={() => navigation.navigate('Terms')}
          onOpenPrivacy={() => navigation.navigate('Privacy')}
        />

            <AuthInput
              label="手机号或邮箱"
              value={phoneOrEmail}
              onChangeText={setPhoneOrEmail}
              placeholder="请输入手机号或邮箱"
              icon={<IconFont name="icon-user" color="#9CA3AF" size={19} />}
              inputMode="email"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => (mode === 'password' ? passwordInputRef.current?.focus() : codeInputRef.current?.focus())}
            />

            {mode === 'password' ? (
              <View style={authStyles.formItem}>
                <AuthInput
                  label="密码"
                  inputRef={passwordInputRef}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="请输入登录密码"
                  icon={<IconFont name="icon-account-settings-variant" color="#9CA3AF" size={19} />}
                  secureTextEntry
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="done"
                  onSubmitEditing={submit}
                />
                <View style={authStyles.formExtra}>
                  <Pressable style={authStyles.textAction} accessibilityRole="button" accessibilityLabel="忘记密码" onPress={() => navigation.navigate('ResetPassword')}>
                    <Text style={authStyles.link}>忘记密码？</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <AuthInput
                label="验证码"
                inputRef={codeInputRef}
                value={verifyCode}
                onChangeText={setVerifyCode}
                placeholder="6位验证码"
                icon={<IconFont name="icon-messages" color="#9CA3AF" size={19} />}
                inputMode="numeric"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={submit}
                right={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={sendingCode ? '正在发送验证码' : countdown > 0 ? `${countdown} 秒后可重新获取验证码` : '获取验证码'}
                    disabled={countdown > 0 || sendingCode || !isValidPhoneOrEmail(phoneOrEmail)}
                    onPress={startSendCode}
                    style={[styles.sendCode, (countdown > 0 || sendingCode || !isValidPhoneOrEmail(phoneOrEmail)) && styles.sendCodeDisabled]}
                  >
                    <Text style={styles.sendCodeText}>{sendingCode ? '发送中...' : countdown > 0 ? `${countdown}s` : '获取验证码'}</Text>
                  </Pressable>
                }
              />
            )}

            <PillButton label={loading ? '登录中...' : '立即登录'} disabled={!agreed || !canSubmit} loading={loading} onPress={submit} />

            <View style={authStyles.tipRow}>
              <Text style={authStyles.tipText}>还没有账户？</Text>
              <Pressable style={authStyles.textAction} accessibilityRole="button" accessibilityLabel="立即注册" onPress={() => navigation.navigate('Register')}>
                <Text style={authStyles.tipLink}>立即注册</Text>
              </Pressable>
            </View>

        {IS_DEV ? (
          <View style={styles.devSection}>
            <Text style={styles.devTitle}>开发测试账号（立即登录）</Text>
            {visibleDevUsers.map((user) => (
              <PillButton
                key={user.phone}
                label={`${user.name} · ${user.phone}`}
                variant="secondary"
                onPress={() => {
                  void handleDevLoginWithUser(user)
                }}
              />
            ))}
            {hasDevUsers ? null : <PillButton label="使用默认账号登录" variant="soft" onPress={handleDevLogin} />}
          </View>
        ) : null}
      </View>

      <SliderCaptchaModal
        visible={captchaVisible}
        onCancel={() => setCaptchaVisible(false)}
        onSuccess={(token) => {
          setCaptchaVisible(false)
          void sendVerificationCode(token)
        }}
      />
    </AuthShell>
  )
}

const styles = StyleSheet.create({
  sendCode: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.brand,
  },
  sendCodeDisabled: {
    opacity: 0.5,
  },
  sendCodeText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '600',
  },
  devSection: {
    marginTop: 16,
    gap: 12,
  },
  devTitle: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
})
