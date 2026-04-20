import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Button, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { coachService } from '@/services/coach/coachService'
import BottomNav from '@/components/BottomNav'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'

function CoachPaymentSettings() {
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<'wechat' | 'alipay' | null>(null)
  const [qrCodes, setQrCodes] = useState<Array<{ type: 'wechat' | 'alipay'; name: string; url: string }>>([])
  const [allowPersonalQrcode, setAllowPersonalQrcode] = useState(true)

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({
        url: '/auth/login?returnTo=' + encodeURIComponent('/coach/settings/payment')
      })
      return
    }
    loadQrCodes()
  }, [])

  async function loadQrCodes() {
    try {
      setLoading(true)
      const res = await coachService.getPaymentQrCodes()
      if (res) {
        setQrCodes(res.qrCodes || [])
        setAllowPersonalQrcode(res.allowPersonalQrcode !== false)
      }
    } catch (e) {
      console.error('[coach/settings/payment] load:', e)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  async function chooseImage(type: 'wechat' | 'alipay') {
    try {
      const res = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })
      
      const tempFilePath = res.tempFilePaths[0]
      setUploading(type)
      
      // 上传图片
      const uploadRes = await coachService.uploadQrcodeMiniApp(tempFilePath, type)
      
      if (uploadRes?.url) {
        const name = type === 'wechat' ? '微信支付' : '支付宝'
        const existingIndex = qrCodes.findIndex(qr => qr.type === type)
        
        let newQrCodes: Array<{ type: 'wechat' | 'alipay'; name: string; url: string }>
        if (existingIndex >= 0) {
          newQrCodes = [...qrCodes]
          newQrCodes[existingIndex] = { type, name, url: uploadRes.url }
        } else {
          newQrCodes = [...qrCodes, { type, name, url: uploadRes.url }]
        }
        
        setQrCodes(newQrCodes)
        
        // 保存到后端
        const saveRes = await coachService.updatePaymentQrCodes({ qrCodes: newQrCodes })
        if (saveRes) {
          Taro.showToast({ title: `${name}收款码上传成功`, icon: 'success' })
        } else {
          Taro.showToast({ title: '保存失败', icon: 'none' })
        }
      } else {
        Taro.showToast({ title: '上传失败', icon: 'none' })
      }
    } catch (e: any) {
      console.error('[coach/settings/payment] upload:', e)
      Taro.showToast({ title: e.message || '上传失败', icon: 'none' })
    } finally {
      setUploading(null)
    }
  }

  async function deleteQrCode(type: 'wechat' | 'alipay') {
    Taro.showModal({
      title: '确认删除',
      content: `确定要删除${type === 'wechat' ? '微信' : '支付宝'}收款码吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const newQrCodes = qrCodes.filter(qr => qr.type !== type)
            const updateRes = await coachService.updatePaymentQrCodes({ qrCodes: newQrCodes })
            if (updateRes) {
              setQrCodes(newQrCodes)
              Taro.showToast({ title: '删除成功', icon: 'success' })
            } else {
              Taro.showToast({ title: '删除失败', icon: 'none' })
            }
          } catch (e) {
            console.error('[coach/settings/payment] delete:', e)
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }

  if (loading) {
    return (
      <View className="payment-settings-page">
        <View className="loading-wrap"><LoadingSpinner size={48} /></View>
        <BottomNav />
      </View>
    )
  }

  if (!allowPersonalQrcode) {
    return (
      <View className="payment-settings-page">
        <ScrollView scrollY className="settings-scroll" style={{ paddingBottom: '70px' }}>
          <View className="settings-card">
            <Text className="card-title">功能访问受限</Text>
            <Text className="card-desc">管理员已禁止使用个人收款码。如有疑问请联系平台管理人员。</Text>
          </View>
        </ScrollView>
        <BottomNav />
      </View>
    )
  }

  const wechatQr = qrCodes.find(qr => qr.type === 'wechat')
  const alipayQr = qrCodes.find(qr => qr.type === 'alipay')

  return (
    <View className="payment-settings-page">
      <ScrollView scrollY className="settings-scroll" style={{ paddingBottom: '70px' }}>
        <View className="settings-card">
          <Text className="card-title">微信收款码</Text>
          {wechatQr ? (
            <View className="qrcode-section">
              <Image className="qrcode-image" src={wechatQr.url} mode="aspectFit" />
              <View className="qrcode-actions">
                <Button 
                  className="update-btn" 
                  onClick={() => chooseImage('wechat')}
                  loading={uploading === 'wechat'}
                  disabled={uploading !== null}
                >
                  {uploading === 'wechat' ? '上传中...' : '更新'}
                </Button>
                <Button className="delete-btn" onClick={() => deleteQrCode('wechat')}>删除</Button>
              </View>
            </View>
          ) : (
            <View className="empty-section">
              <Text className="empty-text">未设置微信收款码</Text>
              <Button 
                className="upload-btn" 
                onClick={() => chooseImage('wechat')}
                loading={uploading === 'wechat'}
                disabled={uploading !== null}
              >
                {uploading === 'wechat' ? '上传中...' : '上传收款码'}
              </Button>
            </View>
          )}
        </View>

        <View className="settings-card">
          <Text className="card-title">支付宝收款码</Text>
          {alipayQr ? (
            <View className="qrcode-section">
              <Image className="qrcode-image" src={alipayQr.url} mode="aspectFit" />
              <View className="qrcode-actions">
                <Button 
                  className="update-btn" 
                  onClick={() => chooseImage('alipay')}
                  loading={uploading === 'alipay'}
                  disabled={uploading !== null}
                >
                  {uploading === 'alipay' ? '上传中...' : '更新'}
                </Button>
                <Button className="delete-btn" onClick={() => deleteQrCode('alipay')}>删除</Button>
              </View>
            </View>
          ) : (
            <View className="empty-section">
              <Text className="empty-text">未设置支付宝收款码</Text>
              <Button 
                className="upload-btn" 
                onClick={() => chooseImage('alipay')}
                loading={uploading === 'alipay'}
                disabled={uploading !== null}
              >
                {uploading === 'alipay' ? '上传中...' : '上传收款码'}
              </Button>
            </View>
          )}
        </View>

        <View className="hint-card">
          <Text className="hint-title">注意事项</Text>
          <Text className="hint-text">• 支持 JPG、PNG 格式 (最大 5MB)</Text>
          <Text className="hint-text">• 建议使用清晰的原始二维码</Text>
          <Text className="hint-text">• 学员订阅时将通过此码进行结算</Text>
          <Text className="hint-text">• 建议双渠道配置以提升转化率</Text>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default CoachPaymentSettings
