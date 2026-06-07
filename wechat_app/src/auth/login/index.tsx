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

import loginBg from '@/assets/images/login-bg.jpg'
import './index.scss'

const IS_DEV = process.env.NODE_ENV === 'development'

const TEXT = {
  agreeFirst: '\u8bf7\u5148\u52fe\u9009\u7528\u6237\u534f\u8bae',
  readAndAgree: '\u8bf7\u9605\u8bfb\u5e76\u52fe\u9009\u7528\u6237\u670d\u52a1\u534f\u8bae\u548c\u9690\u79c1\u653f\u7b56',
  invalidPhoneOrEmail: '\u8bf7\u8f93\u5165\u6b63\u786e\u7684\u624b\u673a\u53f7\u6216\u90ae\u7bb1',
  codeSent: '\u9a8c\u8bc1\u7801\u5df2\u53d1\u9001',
  sendFailed: '\u53d1\u9001\u5931\u8d25',
  enterPhoneOrEmail: '\u8bf7\u8f93\u5165\u624b\u673a\u53f7\u6216\u90ae\u7bb1',
  enterPassword: '\u8bf7\u8f93\u5165\u5bc6\u7801',
  enterCode: '\u8bf7\u8f93\u5165\u9a8c\u8bc1\u7801',
  loginSuccess: '\u767b\u5f55\u6210\u529f',
  loginFailed: '\u767b\u5f55\u5931\u8d25',
  quickLoginSuccess: '\u5feb\u6377\u767b\u5f55\u6210\u529f',
  quickLoginFailed: '\u5feb\u6377\u767b\u5f55\u5931\u8d25',
  authorizePhoneForFirstLogin: '\u8bf7\u5148\u6388\u6743\u624b\u673a\u53f7\u4ee5\u5b8c\u6210\u9996\u6b21\u767b\u5f55',
  phoneAuthorizationCancelled: '\u5df2\u53d6\u6d88\u624b\u673a\u53f7\u6388\u6743\uff0c\u53ef\u4ee5\u7a0d\u540e\u518d\u767b\u5f55',
  phoneAuthorizeFailed: '\u624b\u673a\u53f7\u6388\u6743\u5931\u8d25',
  loginTitle: '\u767b\u5f55',
  resetPasswordTitle: '\u91cd\u7f6e\u5bc6\u7801',
  brand: '\u6559\u94fe CoachLink',
  slogan: '\u767b\u5f55\u4ee5\u7ee7\u7eed\u4f60\u7684\u8bad\u7ec3\u8ba1\u5212',
  modeQuick: '\u624b\u673a\u53f7\u5feb\u6377\u767b\u5f55',
  modePassword: '\u5bc6\u7801\u767b\u5f55',
  modeVerifyCode: '\u9a8c\u8bc1\u7801\u767b\u5f55',
  phoneOneTapLogin: '\u624b\u673a\u4e00\u952e\u767b\u5f55',
  phoneQuickLogin: '\u624b\u673a\u53f7\u5feb\u6377\u767b\u5f55',
  loggingIn: '\u767b\u5f55\u4e2d...',
  sendCode: '\u83b7\u53d6\u9a8c\u8bc1\u7801',
  sending: '\u53d1\u9001\u4e2d...',
  immediateLogin: '\u7acb\u5373\u767b\u5f55',
  or: '\u6216',
  and: '\u548c',
  noAccount: '\u8fd8\u6ca1\u6709\u8d26\u6237\uff1f',
  registerNow: '\u7acb\u5373\u6ce8\u518c',
  devOnboarding: '\u3010\u5f00\u53d1\u3011\u5feb\u901f\u8fdb\u5165\u521d\u59cb\u5316\u5f15\u5bfc',
  termsPrefix: '\u540c\u610f',
  terms: '\u300a\u7528\u6237\u670d\u52a1\u534f\u8bae\u300b',
  privacy: '\u300a\u9690\u79c1\u653f\u7b56\u300b',
  completeFirstLogin: '\u5b8c\u6210\u9996\u6b21\u767b\u5f55',
  firstLoginDesc: '\u53ea\u6709\u9996\u6b21\u5efa\u53f7\u6216\u5f53\u524d\u8d26\u53f7\u7f3a\u5c11\u624b\u673a\u53f7\u65f6\uff0c\u624d\u9700\u8981\u6388\u6743\u624b\u673a\u53f7\u3002\u4f60\u53ef\u4ee5\u62d2\u7edd\u5e76\u8fd4\u56de\u7ee7\u7eed\u6d4f\u89c8\u516c\u5f00\u5185\u5bb9\u3002',
  authorizePhoneAndContinue: '\u6388\u6743\u624b\u673a\u53f7\u5e76\u7ee7\u7eed',
  authorizing: '\u6388\u6743\u4e2d...',
  notNow: '\u6682\u4e0d\u7ee7\u7eed',
  back: '\u8fd4\u56de',
  backPrevious: '\u8fd4\u56de\u4e0a\u4e00\u9875',
  browseFirst: '\u5148\u901b\u901b',
  browseWithoutLogin: '\u4e0d\u767b\u5f55\uff0c\u5148\u901b\u901b',
  loginOptionalDesc: '\u4e0d\u767b\u5f55\u4e5f\u53ef\u4ee5\u5148\u6d4f\u89c8\u77e5\u8bc6\u3001\u627e\u6559\u7ec3\u548c\u516c\u5f00\u5de5\u5177\uff1b\u9700\u8981\u540c\u6b65\u8bad\u7ec3\u8bb0\u5f55\u65f6\u518d\u767b\u5f55\u3002',
  forgotPassword: '\u5fd8\u8bb0\u5bc6\u7801\uff1f',
  inputPhoneOrEmail: '\u8bf7\u8f93\u5165\u624b\u673a\u53f7\u6216\u90ae\u7bb1',
  inputPassword: '\u8bf7\u8f93\u5165\u767b\u5f55\u5bc6\u7801',
  inputVerifyCode: '6\u4f4d\u9a8c\u8bc1\u7801',
  devUser: '\u5f00\u53d1\u6d4b\u8bd5\u7528\u6237'
} as const

type LoginMode = 'wechat' | 'password' | 'verifyCode'

function Login() {
  const [loginMode, setLoginMode] = useState<LoginMode>('wechat')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [showWechatPhoneAuthPrompt, setShowWechatPhoneAuthPrompt] = useState(false)
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

  const isWechatPhoneAuthorizationRequired = (error: any) => {
    const message = String(error?.message || '')
    return message.includes('\u9996\u6b21\u5feb\u6377\u767b\u5f55\u8bf7\u5148\u6388\u6743\u624b\u673a\u53f7')
      || message.includes('\u9996\u6b21\u767b\u5f55\u8bf7\u5148\u6388\u6743\u624b\u673a\u53f7')
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
      if (isWechatPhoneAuthorizationRequired(error)) {
        setShowWechatPhoneAuthPrompt(true)
        return
      }
      console.error('quick login failed:', error)
      Toast.show(error.message || TEXT.quickLoginFailed, {})
    } finally {
      setLoading(false)
    }
  }

  const handleWechatPhoneAuthorization = async (e: any) => {
    if (!agreed) {
      Toast.show(TEXT.readAndAgree, {})
      return
    }

    setLoading(true)
    try {
      const { code: phoneCode, errMsg } = e.detail || {}
      if (!phoneCode) {
        setShowWechatPhoneAuthPrompt(false)
        Toast.show(errMsg || TEXT.phoneAuthorizationCancelled, {})
        return
      }
      setShowWechatPhoneAuthPrompt(false)
      await finishWechatLogin(phoneCode)
    } catch (error: any) {
      console.error('phone authorization login failed:', error)
      Toast.show(error.message || TEXT.phoneAuthorizeFailed, {})
    } finally {
      setLoading(false)
    }
  }

  return (
    <ConfigProvider locale={zhCN}>
      <View className='login-page'>
        <View className='login-hero'>
          <Image className='login-bg' src={loginBg} mode='aspectFill' />
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

              {loginMode === 'wechat' && (
                <View className='wechat-login-panel'>
                  <TaroButton
                    className={`wechat-primary-button ${loading ? 'wechat-primary-button-disabled' : ''}`}
                    onClick={handleWechatLogin}
                    disabled={loading}
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

              <View className='agreement-row'>
                <Checkbox checked={agreed} onChange={(val) => setAgreed(val)} />
                <Text className='agreement-text'>
                  {TEXT.termsPrefix}
                  <Text className='agreement-link' onClick={goToTerms}>{TEXT.terms}</Text>
                  {TEXT.and}
                  <Text className='agreement-link' onClick={goToPrivacy}>{TEXT.privacy}</Text>
                </Text>
              </View>
            </>
          )}
        </View>

        <SliderCaptcha
          visible={sliderCaptchaVisible}
          onHide={() => setSliderCaptchaVisible(false)}
          onSuccess={handleCaptchaSuccess}
        />

        {showWechatPhoneAuthPrompt && (
          <View className='wechat-phone-auth-overlay'>
            <View className='wechat-phone-auth-card'>
              <Text className='wechat-phone-auth-title'>{TEXT.completeFirstLogin}</Text>
              <Text className='wechat-phone-auth-desc'>{TEXT.firstLoginDesc}</Text>
              <TaroButton
                className='wechat-phone-auth-button'
                openType='getPhoneNumber'
                onGetPhoneNumber={handleWechatPhoneAuthorization}
                disabled={loading}
              >
                <Text className='wechat-phone-auth-button-text'>
                  {loading ? TEXT.authorizing : TEXT.authorizePhoneAndContinue}
                </Text>
              </TaroButton>
              <View
                className='wechat-phone-auth-cancel'
                onClick={() => {
                  if (loading) return
                  setShowWechatPhoneAuthPrompt(false)
                }}
              >
                <Text className='wechat-phone-auth-cancel-text'>{TEXT.notNow}</Text>
              </View>
              <View
                className='wechat-phone-auth-back'
                onClick={() => {
                  if (loading) return
                  setShowWechatPhoneAuthPrompt(false)
                  goBackOrPublicHome()
                }}
              >
                <Text className='wechat-phone-auth-back-text'>{TEXT.back}</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </ConfigProvider>
  )
}

export default Login
