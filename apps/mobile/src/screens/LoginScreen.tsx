import { useEffect, useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { apiClient } from '../api'
import { IconFont } from '../components/IconFont'
import { AuthInput, AgreementRow, authStyles, ModeSwitcher, PillButton } from '../components/auth/AuthControls'
import { AuthShell } from '../components/auth/AuthShell'
import { SliderCaptchaModal } from '../components/auth/SliderCaptchaModal'
import { useAuth } from '../providers/AuthProvider'
import { colors } from '../theme'
import type { RootStackParamList } from '../navigation/types'

type LoginMode = 'wechat' | 'password' | 'verifyCode'
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

export function LoginScreen({ navigation }: Props) {
  const { loginWithPassword, loginWithCode, continueAsGuest, loginAsDevUser } = useAuth()
  const [mode, setMode] = useState<LoginMode>('wechat')
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

  function requireAgreement() {
    if (!agreed) {
      Alert.alert('请先同意协议', '请阅读并勾选用户服务协议和隐私政策')
      return false
    }
    return true
  }

  async function submit() {
    if (!requireAgreement() || !canSubmit || loading) return
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

  function handleWechatPlaceholder() {
    if (!requireAgreement()) return
    Alert.alert('手机号快捷登录', 'APP 端微信快捷登录入口已保留，等待微信开放平台能力接入。当前请使用密码登录或验证码登录。')
  }

  async function handleDevLogin() {
    try {
      await loginAsDevUser()
    } catch (error) {
      Alert.alert('开发登录失败', error instanceof Error ? error.message : '请稍后重试')
    }
  }

  return (
    <AuthShell title="教链 CoachLink" slogan="登录以继续你的训练计划" cardTitle="登录">
      <View style={authStyles.rowActions}>
        <PillButton label="不登录，先逛逛" variant="soft" onPress={continueAsGuest} />
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
            { value: 'wechat', label: '手机号快捷登录' },
            { value: 'password', label: '密码登录' },
            { value: 'verifyCode', label: '验证码登录' },
          ]}
        />

        <AgreementRow checked={agreed} onToggle={() => setAgreed((value) => !value)} />

        {mode === 'wechat' ? (
          <View style={styles.wechatPanel}>
            <PillButton label={loading ? '登录中...' : '手机号一键登录'} disabled={!agreed || loading} loading={loading} onPress={handleWechatPlaceholder} />
            <Text style={authStyles.hint}>不登录也可以先浏览知识、找教练和公开工具；需要同步训练记录时再登录。</Text>
          </View>
        ) : (
          <>
            <AuthInput
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
                  <Pressable onPress={() => navigation.navigate('ResetPassword')}>
                    <Text style={authStyles.link}>忘记密码？</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <AuthInput
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
              <Pressable onPress={() => navigation.navigate('Register')}>
                <Text style={authStyles.tipLink}>立即注册</Text>
              </Pressable>
            </View>
          </>
        )}

        {IS_DEV ? (
          <PillButton label="【开发】快速进入初始化引导" onPress={handleDevLogin} />
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
  wechatPanel: {
    marginTop: 8,
    marginBottom: 16,
  },
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
