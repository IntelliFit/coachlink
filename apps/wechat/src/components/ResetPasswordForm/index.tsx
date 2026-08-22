import React, { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@nutui/nutui-react-taro'
import { StableNutInput as Input } from '@/components/StableNutInput'
import { smsService } from '@/services/smsService'
import { authService } from '@/services/authService'
import SliderCaptcha from '@/components/SliderCaptcha'
import { Icon } from '@/components/Icon'
import { Phone, Lock, ShieldCheck, Send, RotateCcw } from 'lucide-react'
import './index.scss'

interface ResetPasswordFormProps {
  onBackToLogin: () => void
  onSuccess: () => void
}

export default function ResetPasswordForm({ onBackToLogin, onSuccess }: ResetPasswordFormProps) {
  const [phone, setPhone] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [sendingCode, setSendingCode] = useState(false)
  const [sliderCaptchaVisible, setSliderCaptchaVisible] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    }
    return () => clearTimeout(timer)
  }, [countdown])

  const handleCaptchaSuccess = async (token: string) => {
    const IS_DEV = process.env.NODE_ENV === 'development'
    setSendingCode(true)
    try {
      await smsService.sendVerificationCode({ 
        phoneNumber: phone, 
        captchaToken: token 
      })
      setCountdown(60)
      Taro.showToast({ title: IS_DEV ? '验证码已发送（开发环境：123456）' : '验证码已发送', icon: 'none' })
    } catch (error: any) {
      Taro.showToast({ title: error.message || '发送失败', icon: 'none' })
    } finally {
      setSendingCode(false)
    }
  }

  const sendVerificationCode = () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    setSliderCaptchaVisible(true)
  }

  const handleSubmit = async () => {
    if (!phone || !verificationCode || !newPassword || !confirmPassword) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    
    if (newPassword !== confirmPassword) {
      Taro.showToast({ title: '两次输入的密码不一致', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      await authService.resetPassword({
        phone: phone.trim(),
        verifyCode: verificationCode.trim(),
        newPassword: newPassword.trim(),
      })
      Taro.showToast({ title: '密码重置成功，请使用新密码登录', icon: 'success' })
      onSuccess()

    } catch (error: any) {
      Taro.showToast({ title: error.message || '重置失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <View className="reset-password-form">
        <View className="form-header">
          <Text className="form-title">重置密码</Text>
          <Text className="form-subtitle">通过手机验证码找回您的密码</Text>
        </View>

        <View className="form-content">
          {/* 手机号 */}
          <View className="form-item">
            <View className="form-label">
              <Icon component={Phone} size={18} className="label-icon" />
              <Text className="label-text">手机号码</Text>
            </View>
            <View className="input-wrapper">
              <Input
                className="form-input"
                placeholder="请输入手机号码"
                value={phone}
                onChange={(val) => setPhone(val)}
                type="tel"
              />
            </View>
          </View>

          {/* 验证码 */}
          <View className="form-item">
            <View className="form-label">
              <Icon component={ShieldCheck} size={18} className="label-icon" />
              <Text className="label-text">验证码</Text>
            </View>
            <View className="verification-wrapper">
              <View className="input-wrapper verification-input">
                <Input
                  className="form-input"
                  placeholder="6位验证码"
                  type="number"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(val) => setVerificationCode(val)}
                />
              </View>
              <Button
                className="send-code-btn"
                size="small"
                fill="outline"
                disabled={countdown > 0 || sendingCode || sliderCaptchaVisible || !phone}
                onClick={sendVerificationCode}
                loading={sendingCode}
              >
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </Button>
            </View>
          </View>

          {/* 新密码 */}
          <View className="form-item">
            <View className="form-label">
              <Icon component={Lock} size={18} className="label-icon" />
              <Text className="label-text">新密码</Text>
            </View>
            <View className="input-wrapper">
              <Input
                className="form-input"
                placeholder="请输入新密码"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(val) => setNewPassword(val)}
              />
            </View>
          </View>

          {/* 确认新密码 */}
          <View className="form-item">
            <View className="form-label">
              <Icon component={Lock} size={18} className="label-icon" />
              <Text className="label-text">确认新密码</Text>
            </View>
            <View className="input-wrapper">
              <Input
                className="form-input"
                placeholder="请再次输入新密码"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(val) => setConfirmPassword(val)}
              />
            </View>
          </View>
        </View>

        {/* 提交按钮 */}
        <View className="form-actions">
          <Button
            className="submit-button"
            size="large"
            block
            loading={loading}
            onClick={handleSubmit}
          >
            <View className="button-content">
              <Icon component={RotateCcw} size={20} />
              <Text className="button-text">重置密码</Text>
            </View>
          </Button>

          <Text className="back-link" onClick={onBackToLogin}>
            返回登录
          </Text>
        </View>
      </View>

      <SliderCaptcha
        visible={sliderCaptchaVisible}
        onHide={() => setSliderCaptchaVisible(false)}
        onSuccess={handleCaptchaSuccess}
      />
    </>
  )
}
