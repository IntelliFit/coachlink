import React, { useState } from 'react'
import { View, Text, ScrollView, Button as TaroButton } from '@tarojs/components'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { authService } from '@/services/authService'
import { studentService } from '@/services/studentService'
import './index.scss'
import { Lock, Phone, Power } from '@nutui/icons-react-taro'
import { useTheme } from '@/hooks/useTheme'
import { clearLocalCache } from '@/utils/clearLocalCache'

const DELETE_ACCOUNT_CONFIRMATION_TEXT = '注销账号'

function maskPhone(phone: string) {
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
}

function SettingsPage() {
  const { effectiveTheme } = useTheme()
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [deleteAccountVisible, setDeleteAccountVisible] = useState(false)
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [accountUser, setAccountUser] = useState<any>(() => authService.getCurrentUser() || {})

  const boundPhone = typeof accountUser?.phone === 'string' && accountUser.phone !== 'null'
    ? accountUser.phone
    : ''
  const hasWechat = Boolean(accountUser?.wechat_openid)
  const isCrossPlatformSynced = Boolean(boundPhone && hasWechat)

  const handleAccountLinkRequired = () => {
    Taro.showModal({
      title: '发现两个已有账号',
      content: '这个手机号和当前微信分别已有账号。为保护会员、训练计划和记录，系统不会自动覆盖。请先使用手机号登录原账号；后续合并需要再次验证两边身份。',
      showCancel: false,
      confirmText: '我知道了'
    })
  }

  const handleSyncPhone = async (event: any) => {
    const phoneCode = event?.detail?.code
    if (!phoneCode) {
      Taro.showToast({ title: '未授权手机号，账号仍保持独立', icon: 'none' })
      return
    }

    try {
      Taro.showLoading({ title: '同步中...' })
      const result = await authService.loginWithWechat(phoneCode)
      setAccountUser(result.user)
      Taro.hideLoading()
      Taro.showToast({ title: '跨端账号已同步', icon: 'success' })
    } catch (error: any) {
      Taro.hideLoading()
      if (error?.code === 'ACCOUNT_LINK_REQUIRED') {
        handleAccountLinkRequired()
        return
      }
      Taro.showToast({ title: error?.message || '同步失败', icon: 'none' })
    }
  }

  const handleSyncWechat = async () => {
    const result = await authService.bindWechatOpenid()
    if (!result.success) {
      Taro.showToast({ title: result.message || '微信绑定失败', icon: 'none' })
      return
    }
    setAccountUser(authService.getCurrentUser() || {})
    Taro.showToast({ title: '跨端账号已同步', icon: 'success' })
  }

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
      Taro.showToast({ title: '修改密码功能请在网页端完成', icon: 'none', duration: 3000 })
      setPasswordVisible(false)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      Taro.showToast({ title: '修改失败', icon: 'none' })
    }
  }

  // Moved here from the 我的 page in the 2026-10 redesign ("账户设置: 密码、账号同步、清除缓存、退出登录").
  const handleClearCache = () => {
    Taro.showModal({
      title: '清除缓存',
      content: '将清除本地缓存和未保存草稿，不会退出登录。',
      confirmText: '清除',
      confirmColor: '#B4553A',
      success: (res) => {
        if (!res.confirm) return
        try {
          const { clearedCount } = clearLocalCache()
          Taro.showToast({ title: clearedCount > 0 ? '缓存已清除' : '暂无缓存可清除', icon: 'success' })
        } catch (error) {
          console.error('[settings] clear local cache:', error)
          Taro.showToast({ title: '清除缓存失败', icon: 'none' })
        }
      }
    })
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

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText.trim() !== DELETE_ACCOUNT_CONFIRMATION_TEXT) {
      Taro.showToast({
        title: `请输入“${DELETE_ACCOUNT_CONFIRMATION_TEXT}”`,
        icon: 'none'
      })
      return
    }

    try {
      setDeleteAccountLoading(true)
      await studentService.deleteAccount({
        confirmationText: deleteConfirmationText.trim()
      })
      await authService.logout()
      setDeleteAccountVisible(false)
      setDeleteConfirmationText('')
      Taro.showToast({ title: '账号已注销', icon: 'success' })
      setTimeout(() => {
        Taro.reLaunch({ url: '/auth/login' })
      }, 600)
    } catch (error: any) {
      Taro.showToast({
        title: error?.message || '注销失败',
        icon: 'none'
      })
    } finally {
      setDeleteAccountLoading(false)
    }
  }

  return (
    <View className={`settings-page theme-${effectiveTheme}`}>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          <View className='settings-section'>
            <Text className='section-title'>安全设置</Text>
            <View className='settings-list'>
              <View className='setting-item' onClick={() => setPasswordVisible(true)}>
                <View className='item-left'>
                  <View className='item-icon'><Lock /></View>
                  <View>
                    <Text className='item-title'>修改密码</Text>
                    <Text className='item-desc'>定期更换密码保护账号安全</Text>
                  </View>
                </View>
                <Text className='item-arrow'>›</Text>
              </View>
            </View>
          </View>

          <View className='settings-section'>
            <Text className='section-title'>账号绑定</Text>
            <View className='settings-list'>
              <View className='setting-item'>
                <View className='item-left'>
                  <View className='item-icon'><Phone /></View>
                  <View>
                    <Text className='item-title'>跨端账号同步</Text>
                    <Text className='item-desc'>
                      {isCrossPlatformSynced
                        ? `已同步至 ${maskPhone(boundPhone)}，网页与小程序共用数据`
                        : hasWechat
                          ? '当前仅微信账号；网页手机号登录会是独立账号'
                          : boundPhone
                            ? '当前手机号账号尚未绑定微信'
                            : '当前账号缺少手机号和微信绑定'}
                    </Text>
                  </View>
                </View>
                {isCrossPlatformSynced ? (
                  <Text className='item-status'>已同步</Text>
                ) : hasWechat ? (
                  <TaroButton
                    className='account-sync-action'
                    openType='getPhoneNumber'
                    onGetPhoneNumber={handleSyncPhone}
                  >
                    绑定手机号
                  </TaroButton>
                ) : boundPhone ? (
                  <TaroButton className='account-sync-action' onClick={handleSyncWechat}>
                    绑定微信
                  </TaroButton>
                ) : (
                  <Text className='item-status item-status--pending'>未同步</Text>
                )}
              </View>
            </View>
          </View>

          <View className='settings-section'>
            <Text className='section-title'>其他</Text>
            <View className='settings-list'>
              <View className='setting-item' onClick={handleClearCache}>
                <View className='item-left'>
                  <View className='item-icon'><Text>↺</Text></View>
                  <View className='item-content'>
                    <Text className='item-title'>清除缓存</Text>
                    <Text className='item-desc'>清除本地缓存和未保存草稿，不会退出登录</Text>
                  </View>
                </View>
                <Text className='item-arrow'>›</Text>
              </View>
              <View className='setting-item' onClick={handleLogout}>
                <View className='item-left'>
                  <View className='item-icon'><Power /></View>
                  <Text className='item-title'>退出登录</Text>
                </View>
                <Text className='item-arrow'>›</Text>
              </View>
            </View>
          </View>

          <View className='settings-section'>
            <Text className='section-title'>危险操作</Text>
            <View className='danger-card'>
              <Text className='danger-title'>注销账号</Text>
              <Text className='danger-desc'>
                注销后将禁用当前账号的登录凭据，后续无法再使用原手机号、邮箱或微信直接登录。
              </Text>
              <View className='danger-btn' onClick={() => setDeleteAccountVisible(true)}>
                <Text className='danger-btn-text'>立即注销</Text>
              </View>
            </View>
          </View>

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

          {deleteAccountVisible && (
            <View className='password-modal'>
              <View
                className='modal-mask'
                onClick={() => {
                  if (deleteAccountLoading) return
                  setDeleteAccountVisible(false)
                }}
              />
              <View className='modal-content'>
                <Text className='modal-title'>注销账号</Text>
                <View className='delete-warning'>
                  <Text>这是不可恢复操作。请输入</Text>
                  <Text className='delete-confirmation-token'>「{DELETE_ACCOUNT_CONFIRMATION_TEXT}」</Text>
                  <Text>后继续。</Text>
                </View>
                <View className='form-group'>
                  <Text className='form-label'>输入确认文案</Text>
                  <input
                    className='form-input'
                    type='text'
                    placeholder={`请输入“${DELETE_ACCOUNT_CONFIRMATION_TEXT}”`}
                    value={deleteConfirmationText}
                    onInput={(e: any) => setDeleteConfirmationText(e.detail.value)}
                  />
                </View>
                <View className='modal-actions'>
                  <View
                    className='modal-btn cancel'
                    onClick={() => {
                      if (deleteAccountLoading) return
                      setDeleteAccountVisible(false)
                    }}
                  >
                    <Text>取消</Text>
                  </View>
                  <View
                    className={`modal-btn danger${deleteAccountLoading ? ' is-disabled' : ''}`}
                    onClick={() => {
                      if (deleteAccountLoading) return
                      void handleDeleteAccount()
                    }}
                  >
                    <Text>{deleteAccountLoading ? '处理中...' : '确认注销'}</Text>
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
