import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { coachService } from '@/services/coach/coachService'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'

function CoachWallet() {
  const [walletData, setWalletData] = useState<{
    balance: number
    total_income?: number
    frozen_amount?: number
    huifu_open_status?: string | null
    huifu_open_msg?: string | null
    transactions?: any[]
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({ url: '/auth/login?returnTo=' + encodeURIComponent('/coach/wallet') })
      return
    }
    loadWallet()
  }, [])

  async function loadWallet() {
    try {
      setLoading(true)
      const res = await coachService.getWallet()
      if (res) {
        setWalletData({
          balance: res.balance ?? 0,
          total_income: res.total_income,
          frozen_amount: res.frozen_amount,
          huifu_open_status: res.huifu_open_status,
          huifu_open_msg: res.huifu_open_msg,
          transactions: res.transactions
        })
      } else {
        setWalletData({ balance: 0 })
      }
    } catch (e) {
      console.error('[coach/wallet] load:', e)
      setWalletData({ balance: 0 })
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  function goOrderDetail(orderId: string) {
    Taro.navigateTo({ url: `/coach/wallet/order?orderId=${orderId}` })
  }

  return (
    <View className="coach-wallet-page">
      {loading ? (
        <View className="loading-wrap"><LoadingSpinner size={48} /></View>
      ) : (
        <ScrollView scrollY className="wallet-scroll" style={{ paddingBottom: '70px' }}>
          {/* 余额卡片 */}
          <View className="balance-card">
            <Text className="label">可提现余额（元）</Text>
            <Text className="amount">¥{(walletData?.balance ?? 0).toFixed(2)}</Text>
            {walletData?.frozen_amount !== undefined && walletData.frozen_amount > 0 && (
              <Text className="frozen-amount">冻结金额：¥{walletData.frozen_amount.toFixed(2)}</Text>
            )}
            {walletData?.total_income !== undefined && (
              <Text className="total-income">累计总收入：¥{walletData.total_income.toFixed(2)}</Text>
            )}
          </View>

          {/* 汇付账户状态 */}
          <View className="huifu-status-card">
            <Text className="huifu-status-title">汇付收款账户</Text>
            {walletData?.huifu_open_status === 'opened' ? (
              <View className="huifu-status opened">
                <Text className="huifu-status-text">已开通</Text>
                <Text className="huifu-status-desc">学员订阅付款自动分账到您的账户</Text>
              </View>
            ) : walletData?.huifu_open_status === 'failed' ? (
              <View className="huifu-status failed">
                <Text className="huifu-status-text">开通失败</Text>
                {walletData?.huifu_open_msg && (
                  <Text className="huifu-status-msg">{walletData.huifu_open_msg}</Text>
                )}
              </View>
            ) : (
              <View className="huifu-status pending">
                <Text className="huifu-status-text">未开通</Text>
                <Text className="huifu-status-desc">请在电脑端开通收款账户</Text>
              </View>
            )}
          </View>

          {/* 功能提示 */}
          <View className="hint-card">
            <Text className="hint-text">绑定收款方式、申请提现、收入明细等功能请到电脑端使用</Text>
          </View>

          {/* 交易流水 */}
          {walletData?.transactions && walletData.transactions.length > 0 && (
            <View className="transactions-section">
              <Text className="section-title">最近交易</Text>
              {walletData.transactions.map((tx: any) => (
                <View key={tx.id} className="transaction-item" onClick={() => tx.alipay_order_id && goOrderDetail(tx.alipay_order_id)}>
                  <View className="transaction-left">
                    <Text className={`transaction-type ${tx.type === 'income' ? 'income' : tx.type === 'withdrawal' ? 'withdrawal' : 'refund'}`}>
                      {tx.type === 'income' ? '收入' : tx.type === 'withdrawal' ? '提现' : '退款'}
                    </Text>
                    <Text className="transaction-desc">{tx.description || tx.subject || '交易'}</Text>
                    <Text className="transaction-time">
                      {tx.created_at ? new Date(tx.created_at).toLocaleString('zh-CN') : ''}
                    </Text>
                  </View>
                  <View className="transaction-amount-wrap">
                    <Text className={`transaction-amount ${tx.type === 'income' ? 'income' : 'outcome'}`}>
                      {tx.type === 'income' ? '+' : '-'}¥{Math.abs(tx.amount || 0).toFixed(2)}
                    </Text>
                    {tx.platform_fee != null && tx.platform_fee > 0 && (
                      <Text className="transaction-platform-fee">平台服务费: -{tx.platform_fee.toFixed(2)}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {(!walletData?.transactions || walletData.transactions.length === 0) && (
            <View className="empty-transactions">
              <Text className="empty-text">暂无交易记录</Text>
            </View>
          )}
        </ScrollView>
      )}
      <BottomNav />
    </View>
  )
}

export default CoachWallet
