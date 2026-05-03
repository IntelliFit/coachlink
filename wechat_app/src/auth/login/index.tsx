import { useState, useEffect } from 'react'
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
import SliderCaptcha from '@/components/SliderCaptcha'
import ResetPasswordForm from '@/components/ResetPasswordForm'

import loginBg from '@/assets/images/login-bg.jpg'
import './index.scss'

const IS_DEV = process.env.NODE_ENV === 'development'

type LoginMode = 'wechat' | 'password' | 'verifyCode'

function Login() {
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

  const sendVerificationCode = () => {
    if (!agreed) {
      Taro.showToast({ title: '请先勾选用户协议', icon: 'none' })
      return
    }
    if (!isValidPhoneOrEmail()) {
      Taro.showToast({ title: '请输入正确的手机号或邮箱', icon: 'none' })
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
      Toast.show('验证码已发送', {})
    } catch (error: any) {
      console.error('发送验证码失败:', error)
      Toast.show(error.message || '发送失败', {})
    } finally {
      setSendingCode(false)
    }
  }

  const handlePostLoginSuccess = async () => {
    await Taro.reLaunch({ url: authService.buildPostAuthHomeUrl() })
  }

  const goToTerms = () => Taro.navigateTo({ url: '/me/terms/index' })
  const goToPrivacy = () => Taro.navigateTo({ url: '/me/privacy/index' })

  const handleLogin = async () => {
    if (!agreed) {
      Toast.show('请阅读并勾选用户服务协议和隐私政策', {})
      return
    }
    const trimmedPhoneOrEmail = phoneOrEmail.trim()
    const trimmedPassword = password.trim()
    const trimmedCode = verificationCode.trim()

    if (!trimmedPhoneOrEmail) {
      Toast.show('请输入手机号或邮箱', {})
      return
    }

    if (loginMode === 'password') {
      if (!trimmedPassword) {
        Toast.show('请输入密码', {})
        return
      }
    } else {
      if (!trimmedCode) {
        Toast.show('请输入验证码', {})
        return
      }
    }

    setLoading(true)
    try {
      let data: any
      if (loginMode === 'password') {
        data = await authService.loginWithPassword({
          phoneOrEmail: trimmedPhoneOrEmail,
          password: trimmedPassword
        })
      } else {
        data = await authService.loginWithCode({
          phoneOrEmail: trimmedPhoneOrEmail,
          verifyCode: trimmedCode
        })
      }
      Toast.show('登录成功', {})
      setTimeout(() => {
        void handlePostLoginSuccess()
      }, 500)
    } catch (error: any) {
      console.error('登录失败:', error)
      Toast.show(error.message || '登录失败', {})
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

  const handleWechatLogin = async (e: any) => {
    if (!agreed) {
      Toast.show('请阅读并勾选用户服务协议和隐私政策', {})
      return
    }
    setLoading(true)
    try {
      const { code: phoneCode, errMsg, errno } = e.detail || {}
      if (!phoneCode) {
        Toast.show(errMsg || '请先授权手机号以完成快捷登录', {})
        setLoading(false)
        return
      }
      const wechatData = await authService.loginWithWechat(phoneCode)
      Toast.show('快捷登录成功', {})
      setTimeout(() => {
        void handlePostLoginSuccess()
      }, 500)
    } catch (error: any) {
      console.error('快捷登录失败:', error)
      Toast.show(error.message || '快捷登录失败', {})
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
            <Text className='login-hero-brand'>教链 CoachLink</Text>
            <Text className='login-hero-slogan'>登录以继续你的训练计划</Text>
          </View>
        </View>

        <View className='login-card'>
          {showResetPassword ? (
            <>
              <Text className='login-card-title'>重置密码</Text>
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
              <Text className='login-card-title'>登录</Text>

              <View className='mode-switcher'>
                <View
                  className={`switcher-pill ${loginMode === 'wechat' ? 'switcher-active' : ''}`}
                  onClick={() => {
                    setLoginMode('wechat')
                    setPassword('')
                    setVerificationCode('')
                  }}
                >
                  <Text className='switcher-text'>微信登录</Text>
                </View>
                <View
                  className={`switcher-pill ${loginMode === 'password' ? 'switcher-active' : ''}`}
                  onClick={() => {
                    setLoginMode('password')
                    setVerificationCode('')
                  }}
                >
                  <Text className='switcher-text'>密码登录</Text>
                </View>
                <View
                  className={`switcher-pill ${loginMode === 'verifyCode' ? 'switcher-active' : ''}`}
                  onClick={() => {
                    setLoginMode('verifyCode')
                    setPassword('')
                  }}
                >
                  <Text className='switcher-text'>验证码登录</Text>
                </View>
              </View>

              {loginMode === 'wechat' && (
                <View className='wechat-login-panel'>
                  <TaroButton
                    className={`wechat-primary-button ${!agreed ? 'wechat-primary-button-disabled' : ''}`}
                    openType='getPhoneNumber'
                    onGetPhoneNumber={handleWechatLogin}
                    disabled={loading || !agreed}
                  >
                    {loading ? (
                      <Text className='wechat-primary-text'>登录中...</Text>
                    ) : (
                      <Text className='wechat-primary-text'>手机一键登录</Text>
                    )}
                  </TaroButton>
                </View>
              )}

              {loginMode !== 'wechat' && (
                <>
                  <View className='form-item'>
                    <View className='input-row'>
                      <Text className='input-icon iconfont icon-login' />
                      <Input
                        className='form-input'
                        placeholder='请输入手机号或邮箱'
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
                          placeholder='请输入登录密码'
                          type='password'
                          value={password}
                          onChange={(val) => setPassword(val)}
                        />
                      </View>
                      <View className='form-extra'>
                        <Text className='forgot-password' onClick={goToResetPassword}>
                          忘记密码？
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
                          placeholder='6位验证码'
                          type='number'
                          maxLength={6}
                          value={verificationCode}
                          onChange={(val) => setVerificationCode(val)}
                        />
                        <View
                          className={`send-code-btn ${(countdown > 0 || sendingCode || sliderCaptchaVisible || !isValidPhoneOrEmail()) ? 'send-code-btn-disabled' : ''}`}
                          onClick={(countdown > 0 || sendingCode || sliderCaptchaVisible || !isValidPhoneOrEmail()) ? undefined : sendVerificationCode}
                        >
                          {sendingCode ? (
                            <Text className='send-code-btn-text'>发送中...</Text>
                          ) : (
                            <Text className='send-code-btn-text'>{countdown > 0 ? `${countdown}s` : '获取验证码'}</Text>
                          )}
                        </View>
                      </View>
                    </View>
                  )}

                  <View
                    className={`login-button ${loading || !agreed ? 'login-button-disabled' : ''} ${loading ? 'login-button-loading' : ''}`}
                    onClick={!loading && agreed ? handleLogin : () => {
                      if (!agreed) Toast.show('请阅读并勾选用户服务协议和隐私政策', {})
                    }}
                  >
                    {loading ? (
                      <View className='login-button-loading-content'>
                        <View className='login-button-spinner'></View>
                        <Text className='login-button-text'>登录中...</Text>
                      </View>
                    ) : (
                      <Text className='login-button-text'>立即登录</Text>
                    )}
                  </View>

                  <View className='wechat-login-divider'>
                    <View className='divider-line' />
                    <Text className='divider-text'>或</Text>
                    <View className='divider-line' />
                  </View>

                  <TaroButton
                    className={`wechat-login-button ${!agreed ? 'wechat-login-button-disabled' : ''}`}
                    openType='getPhoneNumber'
                    onGetPhoneNumber={handleWechatLogin}
                    disabled={loading || !agreed}
                  >
                    {loading ? (
                      <Text className='wechat-login-text'>登录中...</Text>
                    ) : (
                      <Text className='wechat-login-text'>手机号快捷登录</Text>
                    )}
                  </TaroButton>

                  <View className='register-tip'>
                    <Text className='tip-text'>还没有账户？</Text>
                    <Text className='tip-link' onClick={goToRegister}>立即注册</Text>
                  </View>

                </>
              )}

              {IS_DEV && (
                <View className='dev-onboarding-btn' onClick={() => {
                  const mockUser = {
                    id: 'dev-user-' + Date.now(),
                    nickname: '开发测试用户',
                    name: '开发测试用户',
                    role: 'student',
                    primary_role: 'student',
                    avatar_url: '',
                    phone: '',
                    email: '',
                  }
                  const mockToken = 'dev-token-' + Date.now()
                  Taro.setStorageSync('token', mockToken)
                  Taro.setStorageSync('user', mockUser)
                  Taro.reLaunch({ url: '/auth/student-onboarding' })
                }}>
                  <Text className='dev-onboarding-btn-text'>【开发】快速进入初始化引导</Text>
                </View>
              )}

              <View className='agreement-row'>
                <Checkbox checked={agreed} onChange={(val) => setAgreed(val)} />
                <Text className='agreement-text'>
                  同意
                  <Text className='agreement-link' onClick={goToTerms}>《用户服务协议》</Text>
                  和
                  <Text className='agreement-link' onClick={goToPrivacy}>《隐私政策》</Text>
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
      </View>
    </ConfigProvider>
  )
}

export default Login
