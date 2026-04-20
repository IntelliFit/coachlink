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
                  <Text className={`transaction-amount ${tx.type === 'income' ? 'income' : 'outcome'}`}>
                    {tx.type === 'income' ? '+' : '-'}¥{Math.abs(tx.amount || 0).toFixed(2)}
                  </Text>
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
