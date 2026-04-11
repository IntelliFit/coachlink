import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { request } from '@/utils/request'
import { authService } from '@/services/authService'
import './index.scss'

function CoachSecuritySettings() {
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [verifyType, setVerifyType] = useState<'phone' | 'email' | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({
        url: '/auth/login?returnTo=' + encodeURIComponent('/coach/settings/security')
      })
      return
    }
    const currentUser = authService.getCurrentUser()
    setUser(currentUser)
    
    // 自动选择可用的验证方式
    if (currentUser?.phone) {
      setVerifyType('phone')
    } else if (currentUser?.email) {
      setVerifyType('email')
    }
  }, [])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  function maskPhone(phone: string) {
    if (!phone) return ''
    return phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
  }

  function maskEmail(email: string) {
    if (!email) return ''
    const [name, domain] = email.split('@')
    if (!domain) return email
    const maskedName = name.length <= 2 ? `${name[0] || ''}*` : `${name.slice(0, 2)}***`
    return `${maskedName}@${domain}`
  }

  async function sendVerifyCode() {
    if (!verifyType || !user) {
      Taro.showToast({ title: '请先选择验证方式', icon: 'none' })
      return
    }

    if (countdown > 0) return

    const contactValue = verifyType === 'phone' ? user.phone : user.email
    if (!contactValue) {
      Taro.showToast({ title: '未绑定' + (verifyType === 'phone' ? '手机号' : '邮箱'), icon: 'none' })
      return
    }

    try {
      setSending(true)
      const res = await request({
        url: `/api/${verifyType === 'phone' ? 'sms' : 'ses'}/send-verification-code`,
        method: 'POST',
        data: {
          [verifyType === 'phone' ? 'phoneNumber' : 'email']: contactValue
        }
      })

      if (res.success) {
        setCountdown(60)
        Taro.showToast({ title: '验证码已发送', icon: 'success' })
      } else {
        Taro.showToast({ title: res.message || '发送失败', icon: 'none' })
      }
    } catch (e: any) {
      console.error('[security] send code:', e)
      Taro.showToast({ title: e.message || '发送失败', icon: 'none' })
    } finally {
      setSending(false)
    }
  }

  async function handleSubmit() {
    if (!verifyType) {
      Taro.showToast({ title: '请选择验证方式', icon: 'none' })
      return
    }

    if (!verifyCode || !newPassword || !confirmPassword) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }

    if (newPassword !== confirmPassword) {
      Taro.showToast({ title: '两次输入的新密码不一致', icon: 'none' })
      return
    }

    if (newPassword.length < 6) {
      Taro.showToast({ title: '密码长度至少6位', icon: 'none' })
      return
    }

    try {
      setLoading(true)
      const res = await request({
        url: '/api/user/reset-password',
        method: 'POST',
        data: {
          type: verifyType,
          verifyCode: verifyCode.trim(),
          newPassword: newPassword.trim()
        }
      })

      if (res.success) {
        Taro.showToast({ title: '密码修改成功', icon: 'success' })
        // 清空表单
        setVerifyCode('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        Taro.showToast({ title: res.message || '修改失败', icon: 'none' })
      }
    } catch (e: any) {
      console.error('[security] reset password:', e)
      Taro.showToast({ title: e.message || '修改失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const availableTypes: Array<'phone' | 'email'> = []
  if (user?.phone) availableTypes.push('phone')
  if (user?.email) availableTypes.push('email')

  const currentContactValue = verifyType === 'phone' ? user?.phone : user?.email

  return (
    <View className="security-settings-page">
      <ScrollView scrollY className="settings-scroll" style={{ paddingBottom: '70px' }}>
        <View className="settings-card">
          <Text className="card-title">修改密码</Text>
          
          {availableTypes.length === 0 ? (
            <View className="empty-section">
              <Text className="empty-text">请先绑定手机号或邮箱，然后才能重置密码。</Text>
            </View>
          ) : (
            <>
              {/* 选择验证方式 */}
              {availableTypes.length > 1 && (
                <View className="form-section">
                  <Text className="form-label">验证方式</Text>
                  <View className="verify-type-buttons">
                    {availableTypes.map((type) => (
                      <Button
                        key={type}
                        className={`verify-type-btn ${verifyType === type ? 'active' : ''}`}
                        onClick={() => {
                          setVerifyType(type)
                          setVerifyCode('')
                        }}
                      >
                        {type === 'phone' ? '手机号' : '邮箱'}
                      </Button>
                    ))}
                  </View>
                </View>
              )}

              {/* 验证码 */}
              <View className="form-section">
                <Text className="form-label">
                  {verifyType === 'phone' ? '手机号验证码' : '邮箱验证码'}
                </Text>
                <View className="verify-code-row">
                  <Input
                    className="verify-code-input"
                    type="number"
                    value={verifyCode}
                    onInput={(e) => setVerifyCode(e.detail.value)}
                    placeholder="6位验证码"
                    maxlength={6}
                  />
                  <Button
                    className="send-code-btn"
                    onClick={sendVerifyCode}
                    disabled={sending || countdown > 0}
                  >
                    {sending ? '发送中...' : countdown > 0 ? `${countdown}s` : '发送验证码'}
                  </Button>
                </View>
                {currentContactValue && (
                  <Text className="form-hint">
                    将发送到：{verifyType === 'phone' ? maskPhone(currentContactValue) : maskEmail(currentContactValue)}
                  </Text>
                )}
              </View>

              {/* 新密码 */}
              <View className="form-section">
                <Text className="form-label">新密码</Text>
                <View className="password-input-wrapper">
                  <Input
                    className="password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onInput={(e) => setNewPassword(e.detail.value)}
                    placeholder="设置新密码（至少6位）"
                  />
                  <Text className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? '隐藏' : '显示'}
                  </Text>
                </View>
              </View>

              {/* 确认新密码 */}
              <View className="form-section">
                <Text className="form-label">确认新密码</Text>
                <View className="password-input-wrapper">
                  <Input
                    className="password-input"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onInput={(e) => setConfirmPassword(e.detail.value)}
                    placeholder="再次输入新密码"
                  />
                  <Text className="password-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                    {showConfirmPassword ? '隐藏' : '显示'}
                  </Text>
                </View>
              </View>

              {/* 提交按钮 */}
              <Button
                className="submit-btn"
                onClick={handleSubmit}
                loading={loading}
              >
                保存修改
              </Button>
            </>
          )}
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default CoachSecuritySettings
