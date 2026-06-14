import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { coachService } from '@/services/coach/coachService'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useTheme } from '@/hooks/useTheme'

type WalletData = {
  balance: number
  total_income?: number
  frozen_amount?: number
  huifu_open_status?: string | null
  huifu_open_msg?: string | null
  transactions?: any[]
}

function CoachWallet() {
  const { effectiveTheme } = useTheme()
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({ url: '/auth/login?returnTo=' + encodeURIComponent('/coach/wallet') })
      return
    }
    loadWallet()
  }, [])

  useDidShow(() => {
    if (Taro.getStorageSync('token')) {
      loadWallet(false)
    }
  })

  async function loadWallet(showLoading = true) {
    try {
      if (showLoading) setLoading(true)
      const res = await coachService.getWallet()
      setWalletData(res ? {
        balance: res.balance ?? 0,
        total_income: res.total_income,
        frozen_amount: res.frozen_amount,
        huifu_open_status: res.huifu_open_status,
        huifu_open_msg: res.huifu_open_msg,
        transactions: res.transactions
      } : { balance: 0 })
    } catch (e) {
      console.error('[coach/wallet] load:', e)
      setWalletData({ balance: 0 })
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  function goOrderDetail(orderId: string) {
    Taro.navigateTo({ url: `/coach/wallet/order?orderId=${orderId}` })
  }

  function goHuifuAccount() {
    Taro.navigateTo({ url: '/coach/wallet/merchant' })
  }

  function goWithdraw() {
    Taro.navigateTo({ url: '/coach/wallet/withdraw' })
  }

  const isHuifuOpened = walletData?.huifu_open_status === 'opened'

  return (
    <View className={`coach-wallet-page theme-${effectiveTheme}`}>
      {loading ? (
        <View className="loading-wrap"><LoadingSpinner size={48} /></View>
      ) : (
        <ScrollView scrollY className="wallet-scroll" style={{ paddingBottom: '70px' }}>
          <View className="balance-card">
            <Text className="label">可提现余额（元）</Text>
            <Text className="amount">¥{(walletData?.balance ?? 0).toFixed(2)}</Text>
            {walletData?.frozen_amount !== undefined && walletData.frozen_amount > 0 && (
              <Text className="frozen-amount">冻结金额：¥{walletData.frozen_amount.toFixed(2)}</Text>
            )}
            {walletData?.total_income !== undefined && (
              <Text className="total-income">累计总收入：¥{walletData.total_income.toFixed(2)}</Text>
            )}
            <View className="balance-actions">
              {isHuifuOpened ? (
                <Text className="balance-action primary" onClick={goWithdraw}>申请提现</Text>
              ) : (
                <Text className="balance-action primary" onClick={goHuifuAccount}>
                  {walletData?.huifu_open_status === 'failed' ? '重新开通收款账户' : '开通收款账户'}
                </Text>
              )}
            </View>
          </View>

          <View className="huifu-status-card">
            <Text className="huifu-status-title">汇付收款账户</Text>
            {isHuifuOpened ? (
              <View className="huifu-status opened">
                <Text className="huifu-status-text">已开通</Text>
                <Text className="huifu-status-desc">学员订阅付款会按规则自动分账到您的账户</Text>
              </View>
            ) : walletData?.huifu_open_status === 'failed' ? (
              <View className="huifu-status failed">
                <Text className="huifu-status-text">开通失败</Text>
                {walletData?.huifu_open_msg && (
                  <Text className="huifu-status-msg">{walletData.huifu_open_msg}</Text>
                )}
              </View>
            ) : walletData?.huifu_open_status === 'business_pending' ? (
              <View className="huifu-status pending">
                <Text className="huifu-status-text">审核中</Text>
                <Text className="huifu-status-desc">汇付审核通过并返回取现卡序列号后，才能收款分账和提现</Text>
              </View>
            ) : (
              <View className="huifu-status pending">
                <Text className="huifu-status-text">未开通</Text>
                <Text className="huifu-status-desc">请先开通后再接收分账与提现</Text>
              </View>
            )}
            {!isHuifuOpened && (
              <Text className="huifu-action" onClick={goHuifuAccount}>
                {walletData?.huifu_open_status === 'failed' ? '重新提交开户资料' : '立即开通'}
              </Text>
            )}
          </View>

          <View className="hint-card">
            <Text className="hint-text">开户后，教练订阅和教练内容收入会按规则进入您的汇付收款账户；7天退款保护期内的收入会暂时冻结。</Text>
          </View>

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
                      <Text className="transaction-platform-fee">平台服务费 -{tx.platform_fee.toFixed(2)}</Text>
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
