import { useEffect, useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { apiClient } from '../api'
import { IconFont } from '../components/IconFont'
import { AuthInput, authStyles, PillButton } from '../components/auth/AuthControls'
import { AuthShell } from '../components/auth/AuthShell'
import { SliderCaptchaModal } from '../components/auth/SliderCaptchaModal'
import { colors } from '../theme'
import type { RootStackParamList } from '../navigation/types'

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>
const IS_DEV = process.env.NODE_ENV === 'development'

function isPhone(value: string) {
  return /^1[3-9]\d{9}$/.test(value.trim())
}

export function ResetPasswordScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [captchaVisible, setCaptchaVisible] = useState(false)
  const codeRef = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)
  const confirmRef = useRef<TextInput>(null)

  useEffect(() => {
    const timer = setInterval(() => setCountdown((current) => Math.max(0, current - 1)), 1000)
    return () => clearInterval(timer)
  }, [])

  async function sendVerificationCode(captchaToken: string) {
    setSendingCode(true)
    try {
      await apiClient.sendSmsCode({ phoneNumber: phone.trim(), captchaToken })
      setCountdown(60)
      Alert.alert('验证码已发送', IS_DEV ? '开发环境验证码通常为 123456' : '请查收验证码')
    } catch (error) {
      Alert.alert('发送失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setSendingCode(false)
    }
  }

  function startSendCode() {
    if (!isPhone(phone)) {
      Alert.alert('手机号不正确', '请输入正确的手机号')
      return
    }
    setCaptchaVisible(true)
  }

  async function submit() {
    if (!isPhone(phone) || !verificationCode.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('信息不完整', '请填写手机号、验证码和新密码')
      return
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      Alert.alert('密码不一致', '两次输入的密码不一致')
      return
    }
    setLoading(true)
    try {
      await apiClient.resetPassword({
        phone: phone.trim(),
        verifyCode: verificationCode.trim(),
        newPassword: newPassword.trim(),
      })
      Alert.alert('重置成功', '请使用新密码登录', [
        { text: '返回登录', onPress: () => navigation.navigate('Login') },
      ])
    } catch (error) {
      Alert.alert('重置失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="教链 CoachLink" slogan="通过手机验证码找回你的密码" cardTitle="重置密码" compactHero>
      <View style={authStyles.form}>
        <AuthInput
          value={phone}
          onChangeText={setPhone}
          placeholder="请输入手机号码"
          icon={<IconFont name="icon-user" color="#9CA3AF" size={19} />}
          inputMode="tel"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="next"
          onSubmitEditing={() => codeRef.current?.focus()}
        />
        <AuthInput
          inputRef={codeRef}
          value={verificationCode}
          onChangeText={setVerificationCode}
          placeholder="6位验证码"
          icon={<IconFont name="icon-messages" color="#9CA3AF" size={19} />}
          inputMode="numeric"
          keyboardType="number-pad"
          maxLength={6}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          right={
            <Pressable
              disabled={countdown > 0 || sendingCode || !isPhone(phone)}
              onPress={startSendCode}
              style={[styles.sendCode, (countdown > 0 || sendingCode || !isPhone(phone)) && styles.sendCodeDisabled]}
            >
              <Text style={styles.sendCodeText}>{sendingCode ? '发送中...' : countdown > 0 ? `${countdown}s` : '获取验证码'}</Text>
            </Pressable>
          }
        />
        <AuthInput
          inputRef={passwordRef}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="请输入新密码"
          icon={<IconFont name="icon-account-settings-variant" color="#9CA3AF" size={19} />}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
        />
        <AuthInput
          inputRef={confirmRef}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="请再次输入新密码"
          icon={<IconFont name="icon-account-settings-variant" color="#9CA3AF" size={19} />}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <PillButton label={loading ? '重置中...' : '重置密码'} loading={loading} disabled={loading} onPress={submit} />
        <View style={authStyles.tipRow}>
          <Pressable onPress={() => navigation.navigate('Login')}>
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
    minHeight: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: colors.brand,
  },
  sendCodeDisabled: {
    opacity: 0.5,
  },
  sendCodeText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '800',
  },
})
