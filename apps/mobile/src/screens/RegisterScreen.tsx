import { useEffect, useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { apiClient } from '../api'
import { IconFont } from '../components/IconFont'
import { AgreementRow, AuthInput, authStyles, PillButton } from '../components/auth/AuthControls'
import { AuthShell } from '../components/auth/AuthShell'
import { SliderCaptchaModal } from '../components/auth/SliderCaptchaModal'
import { useAuth } from '../providers/AuthProvider'
import { colors } from '../theme'
import type { RootStackParamList } from '../navigation/types'

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>
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

export function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth()
  const [phoneOrEmail, setPhoneOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [invitationCode, setInvitationCode] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [captchaVisible, setCaptchaVisible] = useState(false)
  const passwordRef = useRef<TextInput>(null)
  const confirmRef = useRef<TextInput>(null)
  const inviteRef = useRef<TextInput>(null)
  const codeRef = useRef<TextInput>(null)

  useEffect(() => {
    const timer = setInterval(() => setCountdown((current) => Math.max(0, current - 1)), 1000)
    return () => clearInterval(timer)
  }, [])

  function validateAgreement() {
    if (!agreed) {
      Alert.alert('请先同意协议', '请阅读并同意用户协议、隐私政策与免责声明')
      return false
    }
    return true
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
    if (!validateAgreement()) return
    if (!isValidPhoneOrEmail(phoneOrEmail)) {
      Alert.alert('格式不正确', '请输入正确的手机号或邮箱')
      return
    }
    setCaptchaVisible(true)
  }

  async function submit() {
    if (loading) return
    const account = phoneOrEmail.trim()
    if (!account || !password.trim() || !confirmPassword.trim() || !verificationCode.trim()) {
      Alert.alert('信息不完整', '请填写手机号/邮箱、密码、确认密码和验证码')
      return
    }
    if (!isValidPhoneOrEmail(account)) {
      Alert.alert('格式不正确', '请输入正确的手机号或邮箱')
      return
    }
    if (password.trim() !== confirmPassword.trim()) {
      Alert.alert('密码不一致', '两次输入的密码不一致')
      return
    }
    if (!/^\d{6}$/.test(verificationCode.trim())) {
      Alert.alert('验证码不正确', '请输入 6 位数字验证码')
      return
    }
    if (!validateAgreement()) return

    setLoading(true)
    try {
      await register(account, password.trim(), verificationCode.trim(), invitationCode.trim() || undefined)
    } catch (error) {
      Alert.alert('注册失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="教链 CoachLink" slogan="开启你的专业训练之旅" cardTitle="注册" compactHero>
      <View style={authStyles.form}>
        <AuthInput
          label="手机号或邮箱"
          value={phoneOrEmail}
          onChangeText={setPhoneOrEmail}
          placeholder="请输入手机号或邮箱"
          icon={<IconFont name="icon-user" color="#9CA3AF" size={19} />}
          inputMode="email"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <AuthInput
          label="密码"
          inputRef={passwordRef}
          value={password}
          onChangeText={setPassword}
          placeholder="请输入密码"
          icon={<IconFont name="icon-account-settings-variant" color="#9CA3AF" size={19} />}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
        />
        <AuthInput
          label="确认密码"
          inputRef={confirmRef}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="请再次输入密码"
          icon={<IconFont name="icon-account-settings-variant" color="#9CA3AF" size={19} />}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => inviteRef.current?.focus()}
        />
        <AuthInput
          label="邀请码（可选）"
          inputRef={inviteRef}
          value={invitationCode}
          onChangeText={setInvitationCode}
          placeholder="邀请码（可选）"
          icon={<IconFont name="icon-shenqingquanxian" color="#9CA3AF" size={19} />}
          returnKeyType="next"
          onSubmitEditing={() => codeRef.current?.focus()}
        />
        <AuthInput
          label="验证码"
          inputRef={codeRef}
          value={verificationCode}
          onChangeText={setVerificationCode}
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
        <Text style={styles.profileHint}>
          注册后可直接开始使用；昵称、性别等训练档案可先填两项，其余内容在“健身资料卡”里随时补充。
        </Text>
        <AgreementRow
          checked={agreed}
          onToggle={() => setAgreed((value) => !value)}
          onOpenTerms={() => navigation.navigate('Terms')}
          onOpenPrivacy={() => navigation.navigate('Privacy')}
          onOpenDisclaimer={() => navigation.navigate('Disclaimer')}
        />
        <PillButton label={loading ? '注册中...' : '立即注册'} loading={loading} disabled={loading || !agreed} onPress={submit} />
        <View style={authStyles.tipRow}>
          <Text style={authStyles.tipText}>已有账户？</Text>
          <Pressable style={authStyles.textAction} accessibilityRole="button" accessibilityLabel="返回登录" onPress={() => navigation.navigate('Login')}>
            <Text style={authStyles.tipLink}>返回登录</Text>
          </Pressable>
        </View>
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
  profileHint: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
})
