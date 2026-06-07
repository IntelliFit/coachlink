import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { coachService } from '@/services/coach/coachService'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'

type WalletData = {
  balance: number
  gross_balance?: number
  withdrawable_balance?: number
  total_income?: number
  frozen_amount?: number
  refund_protected_amount?: number
  pending_settlement_amount?: number
  refund_protection_days?: number
  huifu_open_status?: string | null
  huifu_open_msg?: string | null
  pending_settlements?: PendingSettlement[]
  transactions?: WalletTransaction[]
}

type PendingSettlement = {
  id: string
  amount: number
  platform_fee: number
  total_amount: number
  status: 'pending' | 'processing' | 'split_failed'
  eligible_at: string | null
  created_at: string
  alipay_order_id: string
  subject?: string | null
  student_name?: string | null
  error_message?: string | null
}

type WalletTransaction = {
  id: string
  amount: number
  type: 'income' | 'withdrawal' | 'refund'
  description?: string | null
  created_at: string
  subject?: string | null
  order_type?: string | null
  student_name?: string | null
  alipay_order_id?: string | null
  platform_fee?: number | null
}

function formatMoney(value?: number | null) {
  return Number(value ?? 0).toFixed(2)
}

function formatDateTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function isSettlementOverdue(settlement: PendingSettlement) {
  if (settlement.status !== 'pending' || !settlement.eligible_at) return false
  const eligibleAt = new Date(settlement.eligible_at).getTime()
  return Number.isFinite(eligibleAt) && eligibleAt <= Date.now()
}

function getSettlementStatusLabel(settlement: PendingSettlement) {
  if (isSettlementOverdue(settlement)) return '结算待处理'
  const status = settlement.status
  if (status === 'split_failed') return '待重试结算'
  if (status === 'processing') return '结算处理中'
  return '待结算'
}

function getTransactionTypeLabel(type: WalletTransaction['type']) {
  if (type === 'income') return '收入'
  if (type === 'withdrawal') return '提现'
  return '退款'
}

function CoachWallet() {
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
        gross_balance: res.gross_balance,
        withdrawable_balance: res.withdrawable_balance,
        total_income: res.total_income,
        frozen_amount: res.frozen_amount,
        refund_protected_amount: res.refund_protected_amount,
        pending_settlement_amount: res.pending_settlement_amount,
        refund_protection_days: res.refund_protection_days,
        huifu_open_status: res.huifu_open_status,
        huifu_open_msg: res.huifu_open_msg,
        pending_settlements: res.pending_settlements || [],
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
  const pendingSettlementAmount = walletData?.pending_settlement_amount ?? 0
  const frozenAmount = walletData?.frozen_amount ?? 0
  const hasPendingSettlements = Boolean(walletData?.pending_settlements?.length)
  const hasTransactions = Boolean(walletData?.transactions?.length)

  return (
    <View className="coach-wallet-page">
      {loading ? (
        <View className="loading-wrap"><LoadingSpinner size={48} /></View>
      ) : (
        <ScrollView scrollY className="wallet-scroll" style={{ paddingBottom: '70px' }}>
          <View className="balance-card">
            <Text className="label">可提现余额（元）</Text>
            <Text className="amount">¥{formatMoney(walletData?.balance)}</Text>
            <View className="wallet-metrics">
              <View className="wallet-metric">
                <Text className="metric-label">冻结金额</Text>
                <Text className="metric-value">¥{formatMoney(frozenAmount)}</Text>
              </View>
              <View className="wallet-metric">
                <Text className="metric-label">待结算收入</Text>
                <Text className="metric-value">¥{formatMoney(pendingSettlementAmount)}</Text>
              </View>
              <View className="wallet-metric">
                <Text className="metric-label">账户总余额</Text>
                <Text className="metric-value">¥{formatMoney(walletData?.gross_balance ?? walletData?.balance)}</Text>
              </View>
              <View className="wallet-metric">
                <Text className="metric-label">累计总收入</Text>
                <Text className="metric-value strong">¥{formatMoney(walletData?.total_income)}</Text>
              </View>
            </View>
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
            <Text className="hint-text">
              开户后，教练订阅和教练内容收入会按规则进入您的汇付收款账户；{walletData?.refund_protection_days ?? 7}天退款保护期内的收入会暂时冻结，待结算收入不会计入可提现余额。
            </Text>
          </View>

          {(hasPendingSettlements || hasTransactions) && (
            <View className="transactions-section">
              <Text className="section-title">收支明细</Text>
              {walletData?.pending_settlements?.map((settlement) => (
                <View key={settlement.id} className="transaction-item pending" onClick={() => settlement.alipay_order_id && goOrderDetail(settlement.alipay_order_id)}>
                  <View className="transaction-left">
                    <Text className="transaction-type pending">{getSettlementStatusLabel(settlement)}</Text>
                    <Text className="transaction-desc">来自{settlement.student_name || '学员'}的订阅</Text>
                    {settlement.subject && (
                      <Text className="transaction-subject">{settlement.subject}</Text>
                    )}
                    <Text className="transaction-time">{formatDateTime(settlement.created_at)}</Text>
                    {settlement.eligible_at && (
                      <Text className="transaction-eligible">
                        {isSettlementOverdue(settlement) ? '已到期，等待系统结算' : `预计可结算：${formatDateTime(settlement.eligible_at)}`}
                      </Text>
                    )}
                    {settlement.error_message && (
                      <Text className="transaction-error">{settlement.error_message}</Text>
                    )}
                    <Text className="transaction-link">查看订单详情</Text>
                  </View>
                  <View className="transaction-amount-wrap">
                    <Text className="transaction-amount pending">+¥{formatMoney(settlement.amount)}</Text>
                    {settlement.platform_fee > 0 && (
                      <Text className="transaction-platform-fee">平台服务费 -{formatMoney(settlement.platform_fee)}</Text>
                    )}
                  </View>
                </View>
              ))}
              {walletData?.transactions?.map((tx) => (
                <View key={tx.id} className="transaction-item" onClick={() => tx.alipay_order_id && goOrderDetail(tx.alipay_order_id)}>
                  <View className="transaction-left">
                    <Text className={`transaction-type ${tx.type === 'income' ? 'income' : tx.type === 'withdrawal' ? 'withdrawal' : 'refund'}`}>
                      {getTransactionTypeLabel(tx.type)}
                    </Text>
                    <Text className="transaction-desc">{tx.description || tx.subject || '交易'}</Text>
                    {tx.subject && tx.subject !== tx.description && (
                      <Text className="transaction-subject">{tx.subject}</Text>
                    )}
                    <Text className="transaction-time">
                      {formatDateTime(tx.created_at)}
                    </Text>
                    {tx.alipay_order_id && (
                      <Text className="transaction-link">查看订单详情</Text>
                    )}
                  </View>
                  <View className="transaction-amount-wrap">
                    <Text className={`transaction-amount ${tx.type === 'income' ? 'income' : 'outcome'}`}>
                      {tx.type === 'income' ? '+' : '-'}¥{formatMoney(Math.abs(tx.amount || 0))}
                    </Text>
                    {tx.platform_fee != null && tx.platform_fee > 0 && (
                      <Text className="transaction-platform-fee">平台服务费 -{formatMoney(tx.platform_fee)}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {!hasPendingSettlements && !hasTransactions && (
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
