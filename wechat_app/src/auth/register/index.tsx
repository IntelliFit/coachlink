import { useState, useEffect } from 'react'
import { View, Image, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  Input,
  ConfigProvider,
  Toast,
  Checkbox
} from '@nutui/nutui-react-taro'
import zhCN from '@nutui/nutui-react-taro/dist/locales/zh-CN'
import { authService } from '@/services/authService'
import { smsService } from '@/services/smsService'
import { sesService } from '@/services/sesService'
import SliderCaptcha from '@/components/SliderCaptcha'
import { studentOnboardingService } from '@/services/studentOnboardingService'
import { User, Lock, Ticket, Message } from '@nutui/icons-react-taro'
import loginBg from '@/assets/images/login-bg.jpg'
import './index.scss'

const IS_DEV = process.env.NODE_ENV === 'development'

function Register() {
  const [phoneOrEmail, setPhoneOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [invitationCode, setInvitationCode] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [sendingCode, setSendingCode] = useState(false)
  const [sliderCaptchaVisible, setSliderCaptchaVisible] = useState(false)

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    }
    return () => clearTimeout(timer)
  }, [countdown])

  const getInviteFromParams = () => {
    try {
      const instance = Taro.getCurrentInstance()
      const invite = (instance?.router?.params as any)?.invite
      return typeof invite === 'string' ? invite.trim() : undefined
    } catch {
      return undefined
    }
  }

  const isValidPhoneOrEmail = () => {
    const isPhone = /^1[3-9]\d{9}$/.test(phoneOrEmail)
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(phoneOrEmail)
    return isPhone || isEmail
  }

  const sendVerificationCode = () => {
    if (!agreed) {
      Taro.showToast({ title: '请先同意用户协议', icon: 'none' })
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
      Toast.show(IS_DEV ? '验证码已发送（开发环境：123456）' : '验证码已发送', {})
    } catch (error: any) {
      console.error('发送验证码失败:', error)
      Toast.show(error.message || '发送失败', {})
    } finally {
      setSendingCode(false)
    }
  }

  const getRequestedPostLoginUrl = (loggedInUser: any) => {
    try {
      const instance = Taro.getCurrentInstance()
      const returnTo = (instance?.router?.params as any)?.returnTo
      if (returnTo && typeof returnTo === 'string') {
        return decodeURIComponent(returnTo)
      }
    } catch (_) {}
    if (loggedInUser?.is_admin) return '/training/today-training'
    if (loggedInUser?.is_coach && loggedInUser?.primary_role === 'coach') return '/coach/overview'
    return '/training/today-training'
  }

  const handlePostLoginSuccess = async (loggedInUser: any) => {
    const targetUrl = await studentOnboardingService.resolvePostLoginUrl({
      loggedInUser,
      fallbackUrl: getRequestedPostLoginUrl(loggedInUser)
    })
    Taro.reLaunch({ url: targetUrl })
  }

  const handleRegister = async () => {
    const trimmedPhoneOrEmail = phoneOrEmail.trim()
    const trimmedPassword = password.trim()
    const trimmedConfirm = confirmPassword.trim()
    const trimmedCode = verificationCode.trim()
    const trimmedInvite = invitationCode.trim() || getInviteFromParams()

    if (!trimmedPhoneOrEmail) {
      Toast.show('请输入手机号或邮箱', {})
      return
    }
    if (!trimmedPassword) {
      Toast.show('请输入密码', {})
      return
    }
    if (trimmedPassword !== trimmedConfirm) {
      Toast.show('两次输入的密码不一致', {})
      return
    }
    if (!trimmedCode) {
      Toast.show('请输入验证码', {})
      return
    }
    if (!agreed) {
      Toast.show('请阅读并同意用户协议与免责声明', {})
      return
    }

    setLoading(true)
    try {
      await authService.register({
        phoneOrEmail: trimmedPhoneOrEmail,
        password: trimmedPassword,
        verifyCode: trimmedCode,
        invitationCode: trimmedInvite || undefined
      })
      Toast.show('注册成功，正在登录…', {})

      const data = await authService.loginWithPassword({
        phoneOrEmail: trimmedPhoneOrEmail,
        password: trimmedPassword
      })
      Toast.show('登录成功', {})
      setTimeout(() => {
        void handlePostLoginSuccess(data?.user)
      }, 500)
    } catch (error: any) {
      console.error('注册失败:', error)
      Toast.show(error.message || '注册失败', {})
    } finally {
      setLoading(false)
    }
  }

  const goToLogin = () => {
    Taro.navigateBack().catch(() => {
      Taro.redirectTo({ url: '/auth/login' })
    })
  }

  const goToTerms = () => {
    Taro.navigateTo({ url: '/me/terms/index' })
  }

  const goToDisclaimer = () => {
    Taro.navigateTo({ url: '/me/disclaimer/index' })
  }

  return (
    <ConfigProvider locale={zhCN}>
      <View className='register-page'>
        <View className='register-hero'>
          <Image className='register-bg' src={loginBg} mode='aspectFill' />
          <View className='register-hero-overlay'>
            <Text className='register-hero-brand'>教链 CoachLink</Text>
            <Text className='register-hero-slogan'>开启你的专业训练之旅</Text>
          </View>
        </View>

        <View className='register-card'>
          <Text className='register-card-title'>注册</Text>

          <View className='form-item'>
            <View className='input-row'>
              <View className='input-icon'>
                <User size={18} color='#9CA3AF' />
              </View>
              <Input
                className='form-input'
                placeholder='请输入手机号或邮箱'
                value={phoneOrEmail}
                onChange={(val) => setPhoneOrEmail(val)}
              />
            </View>
          </View>

          <View className='form-item'>
            <View className='input-row'>
              <View className='input-icon'>
                <Lock size={18} color='#9CA3AF' />
              </View>
              <Input
                className='form-input'
                placeholder='请输入密码'
                type='password'
                value={password}
                onChange={(val) => setPassword(val)}
              />
            </View>
          </View>

          <View className='form-item'>
            <View className='input-row'>
              <View className='input-icon'>
                <Lock size={18} color='#9CA3AF' />
              </View>
              <Input
                className='form-input'
                placeholder='请再次输入密码'
                type='password'
                value={confirmPassword}
                onChange={(val) => setConfirmPassword(val)}
              />
            </View>
          </View>

          <View className='form-item'>
            <View className='input-row'>
              <View className='input-icon'>
                <Ticket size={18} color='#9CA3AF' />
              </View>
              <Input
                className='form-input'
                placeholder='邀请码（可选）'
                value={invitationCode}
                onChange={(val) => setInvitationCode(val)}
              />
            </View>
          </View>

          <View className='form-item'>
            <View className='input-row'>
              <View className='input-icon'>
                <Message size={18} color='#9CA3AF' />
              </View>
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

          <View className='agreement-row'>
            <Checkbox checked={agreed} onChange={(val) => setAgreed(val)} />
            <Text className='agreement-text'>
              同意
              <Text className='agreement-link' onClick={goToTerms}>《用户协议》</Text>
              与
              <Text className='agreement-link' onClick={goToDisclaimer}>《免责声明》</Text>
            </Text>
          </View>

          <View
            className={`register-button ${loading ? 'register-button-loading' : ''}`}
            onClick={!loading ? handleRegister : undefined}
          >
            {loading ? (
              <View className='register-button-loading-content'>
                <View className='register-button-spinner'></View>
                <Text className='register-button-text'>注册中...</Text>
              </View>
            ) : (
              <Text className='register-button-text'>立即注册</Text>
            )}
          </View>

          <View className='login-tip'>
            <Text className='tip-text'>已有账号？</Text>
            <Text className='tip-link' onClick={goToLogin}>立即登录</Text>
          </View>
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

export default Register
