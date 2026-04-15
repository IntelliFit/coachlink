import React, { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { authService } from '@/services/authService'
import './index.scss'

function SettingsPage() {
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Taro.showToast({ title: '请输入新密码', icon: 'none' })
      return
    }
    if (newPassword !== confirmPassword) {
      Taro.showToast({ title: '两次密码不一致', icon: 'none' })
      return
    }
    if (newPassword.length < 6) {
      Taro.showToast({ title: '密码长度至少6位', icon: 'none' })
      return
    }

    try {
      // TODO: 调用修改密码API
      Taro.showToast({ title: '修改密码功能请在网页端完成', icon: 'none', duration: 3000 })
      setPasswordVisible(false)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      Taro.showToast({ title: '修改失败', icon: 'none' })
    }
  }

  const handleLogout = () => {
    Taro.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          authService.logout()
          Taro.reLaunch({ url: '/auth/login' })
        }
      }
    })
  }

  return (
    <View className='settings-page'>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          <View className='page-header'>
            <Text className='page-title'>账户设置</Text>
            <Text className='page-subtitle'>管理您的账户安全和偏好设置</Text>
          </View>

          {/* 安全设置 */}
          <View className='settings-section'>
            <Text className='section-title'>安全设置</Text>
            <View className='settings-list'>
              <View className='setting-item' onClick={() => setPasswordVisible(true)}>
                <View className='item-left'>
                  <Text className='item-icon'>🔒</Text>
                  <View>
                    <Text className='item-title'>修改密码</Text>
                    <Text className='item-desc'>定期更换密码保护账户安全</Text>
                  </View>
                </View>
                <Text className='item-arrow'>→</Text>
              </View>
            </View>
          </View>

          {/* 账户绑定 */}
          <View className='settings-section'>
            <Text className='section-title'>账户绑定</Text>
            <View className='settings-list'>
              <View className='setting-item'>
                <View className='item-left'>
                  <Text className='item-icon'>📱</Text>
                  <View>
                    <Text className='item-title'>微信绑定</Text>
                    <Text className='item-desc'>已绑定微信账号</Text>
                  </View>
                </View>
                <Text className='item-status'>已绑定</Text>
              </View>
            </View>
          </View>

          {/* 其他 */}
          <View className='settings-section'>
            <Text className='section-title'>其他</Text>
            <View className='settings-list'>
              <View className='setting-item' onClick={handleLogout}>
                <View className='item-left'>
                  <Text className='item-icon'>🚪</Text>
                  <Text className='item-title'>退出登录</Text>
                </View>
                <Text className='item-arrow'>→</Text>
              </View>
            </View>
          </View>

          {/* 修改密码弹窗 */}
          {passwordVisible && (
            <View className='password-modal'>
              <View className='modal-mask' onClick={() => setPasswordVisible(false)} />
              <View className='modal-content'>
                <Text className='modal-title'>修改密码</Text>
                <View className='form-group'>
                  <Text className='form-label'>原密码</Text>
                  <input
                    className='form-input'
                    type='password'
                    placeholder='请输入原密码'
                    value={oldPassword}
                    onInput={(e: any) => setOldPassword(e.detail.value)}
                  />
                </View>
                <View className='form-group'>
                  <Text className='form-label'>新密码</Text>
                  <input
                    className='form-input'
                    type='password'
                    placeholder='请输入新密码（至少6位）'
                    value={newPassword}
                    onInput={(e: any) => setNewPassword(e.detail.value)}
                  />
                </View>
                <View className='form-group'>
                  <Text className='form-label'>确认新密码</Text>
                  <input
                    className='form-input'
                    type='password'
                    placeholder='请再次输入新密码'
                    value={confirmPassword}
                    onInput={(e: any) => setConfirmPassword(e.detail.value)}
                  />
                </View>
                <View className='modal-actions'>
                  <View className='modal-btn cancel' onClick={() => setPasswordVisible(false)}>
                    <Text>取消</Text>
                  </View>
                  <View className='modal-btn confirm' onClick={handleChangePassword}>
                    <Text>确认</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default SettingsPage
