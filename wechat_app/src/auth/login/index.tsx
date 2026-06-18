import { useEffect, useState } from 'react'
import { View, Image, Text, Button as TaroButton } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  Input,
  ConfigProvider,
  Toast,
  Checkbox
} from '@nutui/nutui-react-taro'
import zhCN from '@nutui/nutui-react-taro/dist/locales/zh-CN'
import { smsService } from '@/services/smsService'
import { sesService } from '@/services/sesService'
import { authService } from '@/services/authService'
import { studentOnboardingService } from '@/services/studentOnboardingService'
import SliderCaptcha from '@/components/SliderCaptcha'
import ResetPasswordForm from '@/components/ResetPasswordForm'

import './index.scss'
import { useTheme } from '@/hooks/useTheme'

const IS_DEV = process.env.NODE_ENV === 'development'
const LOGIN_BG = '/auth/assets/images/login-bg.jpg'

const TEXT = {
  agreeFirst: '请先勾选用户协议',
  readAndAgree: '请阅读并勾选用户服务协议和隐私政策',
  invalidPhoneOrEmail: '请输入正确的手机号或邮箱',
  codeSent: '验证码已发送',
  sendFailed: '发送失败',
  enterPhoneOrEmail: '请输入手机号或邮箱',
  enterPassword: '请输入密码',
  enterCode: '请输入验证码',
  loginSuccess: '登录成功',
  loginFailed: '登录失败',
  quickLoginSuccess: '快捷登录成功',
  quickLoginFailed: '快捷登录失败',
  loginTitle: '登录',
  resetPasswordTitle: '重置密码',
  brand: '教链 CoachLink',
  slogan: '登录以继续你的训练计划',
  modeQuick: '手机号快捷登录',
  modePassword: '密码登录',
  modeVerifyCode: '验证码登录',
  phoneOneTapLogin: '手机号一键登录',
  phoneQuickLogin: '手机号快捷登录',
  loggingIn: '登录中...',
  sendCode: '获取验证码',
  sending: '发送中...',
  immediateLogin: '立即登录',
  or: '或',
  and: '和',
  noAccount: '还没有账户？',
  registerNow: '立即注册',
  devOnboarding: '【开发】快速进入初始化引导',
  termsPrefix: '同意',
  terms: '《用户服务协议》',
  privacy: '《隐私政策》',
  back: '返回',
  backPrevious: '返回上一页',
  browseFirst: '先逛逛',
  browseWithoutLogin: '不登录，先逛逛',
  loginOptionalDesc: '不登录也可以先浏览知识、找教练和公开工具；需要同步训练记录时再登录。',
  forgotPassword: '忘记密码？',
  inputPhoneOrEmail: '请输入手机号或邮箱',
  inputPassword: '请输入登录密码',
  inputVerifyCode: '6位验证码',
  devUser: '开发测试用户'
} as const

type LoginMode = 'wechat' | 'password' | 'verifyCode'

function Login() {
  const { effectiveTheme } = useTheme()
  const [loginMode, setLoginMode] = useState<LoginMode>('wechat')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [phoneOrEmail, setPhoneOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [sendingCode, setSendingCode] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [sliderCaptchaVisible, setSliderCaptchaVisible] = useState(false)

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    }
    return () => clearTimeout(timer)
  }, [countdown])

  const isValidPhoneOrEmail = () => {
    const isPhone = /^1[3-9]\d{9}$/.test(phoneOrEmail)
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(phoneOrEmail)
    return isPhone || isEmail
  }

  const getRequestedReturnTo = () => {
    try {
      const instance = Taro.getCurrentInstance()
      const value = instance?.router?.params?.returnTo
      if (value && typeof value === 'string') {
        return decodeURIComponent(value)
      }
    } catch {
      return null
    }
    return null
  }

  const resolvePostLoginUrl = async () => {
    const currentUser = authService.getCurrentUser()
    const fallbackUrl = getRequestedReturnTo() || authService.buildPostAuthHomeUrl()
    return studentOnboardingService.resolvePostLoginUrl({
      loggedInUser: currentUser,
      fallbackUrl
    })
  }

  const handlePostLoginSuccess = async () => {
    const targetUrl = await resolvePostLoginUrl()
    await Taro.reLaunch({ url: targetUrl })
  }

  const sendVerificationCode = () => {
    if (!agreed) {
      Taro.showToast({ title: TEXT.agreeFirst, icon: 'none' })
      return
    }
    if (!isValidPhoneOrEmail()) {
      Taro.showToast({ title: TEXT.invalidPhoneOrEmail, icon: 'none' })
      return
    }
    setSliderCaptchaVisible(true)
  }

  const handleCaptchaSuccess = async (token: string) => {
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(phoneOrEmail)
    setSendingCode(true)
    try {
      if (isEmail) {
        await sesService.sendVerificationCode({ email: phoneOrEmail, captchaToken: token })
      } else {
        await smsService.sendVerificationCode({ phoneNumber: phoneOrEmail, captchaToken: token })
      }
      setCountdown(60)
      Toast.show(TEXT.codeSent, {})
    } catch (error: any) {
      console.error('send verification code failed:', error)
      Toast.show(error.message || TEXT.sendFailed, {})
    } finally {
      setSendingCode(false)
    }
  }

  const goToTerms = () => Taro.navigateTo({ url: '/me-legal/terms/index' })
  const goToPrivacy = () => Taro.navigateTo({ url: '/me-legal/privacy/index' })
  const goToPublicHome = () => {
    void Taro.reLaunch({ url: authService.buildPostAuthHomeUrl() })
  }
  const goBackOrPublicHome = () => {
    try {
      const pages = (Taro as any).getCurrentPages?.() || []
      if (pages.length > 1) {
        void Taro.navigateBack({ delta: 1 }).catch(goToPublicHome)
        return
      }
    } catch {
      // Fall through to the public home fallback.
    }
    goToPublicHome()
  }

  const handleLogin = async () => {
    if (!agreed) {
      Toast.show(TEXT.readAndAgree, {})
      return
    }

    const trimmedPhoneOrEmail = phoneOrEmail.trim()
    const trimmedPassword = password.trim()
    const trimmedCode = verificationCode.trim()

    if (!trimmedPhoneOrEmail) {
      Toast.show(TEXT.enterPhoneOrEmail, {})
      return
    }

    if (loginMode === 'password') {
      if (!trimmedPassword) {
        Toast.show(TEXT.enterPassword, {})
        return
      }
    } else if (!trimmedCode) {
      Toast.show(TEXT.enterCode, {})
      return
    }

    setLoading(true)
    try {
      if (loginMode === 'password') {
        await authService.loginWithPassword({
          phoneOrEmail: trimmedPhoneOrEmail,
          password: trimmedPassword
        })
      } else {
        await authService.loginWithCode({
          phoneOrEmail: trimmedPhoneOrEmail,
          verifyCode: trimmedCode
        })
      }
      Toast.show(TEXT.loginSuccess, {})
      setTimeout(() => {
        void handlePostLoginSuccess()
      }, 500)
    } catch (error: any) {
      console.error('login failed:', error)
      Toast.show(error.message || TEXT.loginFailed, {})
    } finally {
      setLoading(false)
    }
  }

  const goToRegister = () => {
    const instance = Taro.getCurrentInstance()
    const invite = (instance?.router?.params as any)?.invite
    const url = invite
      ? `/auth/register?invite=${encodeURIComponent(invite)}`
      : '/auth/register'
    Taro.navigateTo({ url })
  }

  const goToResetPassword = () => {
    setShowResetPassword(true)
  }

  const finishWechatLogin = async (phoneCode?: string | null) => {
    await authService.loginWithWechat(phoneCode)
    Toast.show(TEXT.quickLoginSuccess, {})
    setTimeout(() => {
      void handlePostLoginSuccess()
    }, 500)
  }

  const handleWechatLogin = async () => {
    if (!agreed) {
      Toast.show(TEXT.readAndAgree, {})
      return
    }

    setLoading(true)
    try {
      await finishWechatLogin(null)
    } catch (error: any) {
      console.error('quick login failed:', error)
      Toast.show(error.message || TEXT.quickLoginFailed, {})
    } finally {
      setLoading(false)
    }
  }

  return (
    <ConfigProvider locale={zhCN}>
      <View className='login-page'>
        <View className='login-hero'>
          <Image className='login-bg' src={LOGIN_BG} mode='aspectFill' />
          <View className='login-hero-overlay'>
            <Text className='login-hero-brand'>{TEXT.brand}</Text>
            <Text className='login-hero-slogan'>{TEXT.slogan}</Text>
          </View>
        </View>

        <View className='login-card'>
          {showResetPassword ? (
            <>
              <Text className='login-card-title'>{TEXT.resetPasswordTitle}</Text>
              <ResetPasswordForm
                onBackToLogin={() => setShowResetPassword(false)}
                onSuccess={() => {
                  setShowResetPassword(false)
                  setLoginMode('password')
                  setVerificationCode('')
                  setPassword('')
                }}
              />
            </>
          ) : (
            <>
              <View className='login-card-actions'>
                <View className='login-card-action' onClick={goBackOrPublicHome}>
                  <Text className='login-card-action-text'>{TEXT.backPrevious}</Text>
                </View>
                <View className='login-card-action login-card-action-primary' onClick={goToPublicHome}>
                  <Text className='login-card-action-primary-text'>{TEXT.browseWithoutLogin}</Text>
                </View>
              </View>

              <Text className='login-card-title'>{TEXT.loginTitle}</Text>

              <View className='mode-switcher'>
                <View
                  className={`switcher-pill ${loginMode === 'wechat' ? 'switcher-active' : ''}`}
                  onClick={() => {
                    setLoginMode('wechat')
                    setPassword('')
                    setVerificationCode('')
                  }}
                >
                  <Text className='switcher-text'>{TEXT.modeQuick}</Text>
                </View>
                <View
                  className={`switcher-pill ${loginMode === 'password' ? 'switcher-active' : ''}`}
                  onClick={() => {
                    setLoginMode('password')
                    setVerificationCode('')
                  }}
                >
                  <Text className='switcher-text'>{TEXT.modePassword}</Text>
                </View>
                <View
                  className={`switcher-pill ${loginMode === 'verifyCode' ? 'switcher-active' : ''}`}
                  onClick={() => {
                    setLoginMode('verifyCode')
                    setPassword('')
                  }}
                >
                  <Text className='switcher-text'>{TEXT.modeVerifyCode}</Text>
                </View>
              </View>

              <View className='agreement-row'>
                <Checkbox checked={agreed} onChange={(val) => setAgreed(val)} />
                <Text className='agreement-text'>
                  {TEXT.termsPrefix}
                  <Text className='agreement-link' onClick={goToTerms}>{TEXT.terms}</Text>
                  {TEXT.and}
                  <Text className='agreement-link' onClick={goToPrivacy}>{TEXT.privacy}</Text>
                </Text>
              </View>

              {loginMode === 'wechat' && (
                <View className='wechat-login-panel'>
                  <TaroButton
                    className={`wechat-primary-button ${loading || !agreed ? 'wechat-primary-button-disabled' : ''}`}
                    onClick={handleWechatLogin}
                    disabled={loading || !agreed}
                  >
                    <Text className='wechat-primary-text'>{loading ? TEXT.loggingIn : TEXT.phoneOneTapLogin}</Text>
                  </TaroButton>
                  <Text className='wechat-login-hint'>{TEXT.loginOptionalDesc}</Text>
                </View>
              )}

              {loginMode !== 'wechat' && (
                <>
                  <View className='form-item'>
                    <View className='input-row'>
                      <Text className='input-icon iconfont icon-login' />
                      <Input
                        className='form-input'
                        placeholder={TEXT.inputPhoneOrEmail}
                        value={phoneOrEmail}
                        onChange={(val) => setPhoneOrEmail(val)}
                      />
                    </View>
                  </View>

                  {loginMode === 'password' && (
                    <View className='form-item'>
                      <View className='input-row'>
                        <Text className='input-icon iconfont icon-setting' />
                        <Input
                          className='form-input'
                          placeholder={TEXT.inputPassword}
                          type='password'
                          value={password}
                          onChange={(val) => setPassword(val)}
                        />
                      </View>
                      <View className='form-extra'>
                        <Text className='forgot-password' onClick={goToResetPassword}>
                          {TEXT.forgotPassword}
                        </Text>
                      </View>
                    </View>
                  )}

                  {loginMode === 'verifyCode' && (
                    <View className='form-item'>
                      <View className='input-row'>
                        <Text className='input-icon iconfont icon-messages' />
                        <Input
                          className='form-input'
                          placeholder={TEXT.inputVerifyCode}
                          type='number'
                          maxLength={6}
                          value={verificationCode}
                          onChange={(val) => setVerificationCode(val)}
                        />
                        <View
                          className={`send-code-btn ${(countdown > 0 || sendingCode || sliderCaptchaVisible || !isValidPhoneOrEmail()) ? 'send-code-btn-disabled' : ''}`}
                          onClick={(countdown > 0 || sendingCode || sliderCaptchaVisible || !isValidPhoneOrEmail()) ? undefined : sendVerificationCode}
                        >
                          <Text className='send-code-btn-text'>
                            {sendingCode ? TEXT.sending : (countdown > 0 ? `${countdown}s` : TEXT.sendCode)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  <View
                    className={`login-button ${loading || !agreed ? 'login-button-disabled' : ''} ${loading ? 'login-button-loading' : ''}`}
                    onClick={!loading && agreed ? handleLogin : () => {
                      if (!agreed) Toast.show(TEXT.readAndAgree, {})
                    }}
                  >
                    {loading ? (
                      <View className='login-button-loading-content'>
                        <View className='login-button-spinner' />
                        <Text className='login-button-text'>{TEXT.loggingIn}</Text>
                      </View>
                    ) : (
                      <Text className='login-button-text'>{TEXT.immediateLogin}</Text>
                    )}
                  </View>

                  <View className='register-tip'>
                    <Text className='tip-text'>{TEXT.noAccount}</Text>
                    <Text className='tip-link' onClick={goToRegister}>{TEXT.registerNow}</Text>
                  </View>
                </>
              )}

              {IS_DEV && (
                <View
                  className='dev-onboarding-btn'
                  onClick={() => {
                    const mockUser = {
                      id: `dev-user-${Date.now()}`,
                      nickname: TEXT.devUser,
                      name: TEXT.devUser,
                      role: 'student',
                      primary_role: 'student',
                      avatar_url: '',
                      phone: '',
                      email: '',
                    }
                    const mockToken = `dev-token-${Date.now()}`
                    Taro.setStorageSync('token', mockToken)
                    Taro.setStorageSync('user', mockUser)
                    Taro.reLaunch({ url: '/auth/student-onboarding' })
                  }}
                >
                  <Text className='dev-onboarding-btn-text'>{TEXT.devOnboarding}</Text>
                </View>
              )}

            </>
          )}
        </View>

        <SliderCaptcha
          visible={sliderCaptchaVisible}
          onHide={() => setSliderCaptchaVisible(false)}
          onSuccess={handleCaptchaSuccess}
        />
      </View>
    </ConfigProvider>
  )
}

export default Login
