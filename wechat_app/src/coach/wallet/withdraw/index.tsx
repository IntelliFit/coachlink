import React, { useEffect, useState } from 'react'
import { Button, Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { coachService } from '@/services/coach/coachService'
import './index.scss'

function CoachWalletWithdraw() {
  const [balance, setBalance] = useState(0)
  const [frozenAmount, setFrozenAmount] = useState(0)
  const [huifuStatus, setHuifuStatus] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadWallet()
  }, [])

  async function loadWallet() {
    try {
      setLoading(true)
      const data = await coachService.getWallet()
      setBalance(data?.balance ?? 0)
      setFrozenAmount(data?.frozen_amount ?? 0)
      setHuifuStatus(data?.huifu_open_status ?? null)
    } catch (error) {
      console.error('[wallet/withdraw] load failed:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  async function submit() {
    const value = Number(amount)
    if (!value || value <= 0) {
      Taro.showToast({ title: '请输入提现金额', icon: 'none' })
      return
    }
    if (value < 0.1) {
      Taro.showToast({ title: '单笔不能低于0.10元', icon: 'none' })
      return
    }
    if (value > balance) {
      Taro.showToast({ title: '可提现余额不足', icon: 'none' })
      return
    }
    if (huifuStatus !== 'opened') {
      Taro.showModal({
        title: '尚未开通',
        content: '请先开通汇付收款账户后再提现。',
        confirmText: '去开通',
        success: (res) => {
          if (res.confirm) Taro.redirectTo({ url: '/coach/wallet/merchant' })
        }
      })
      return
    }

    try {
      setSubmitting(true)
      const res = await coachService.withdrawHuifu(value)
      if (res.success) {
        Taro.showModal({
          title: '提现已提交',
          content: res.message || '预计 T+1 到账银行卡',
          showCancel: false,
          success: () => Taro.navigateBack(),
        })
      } else {
        Taro.showToast({ title: res.message || '提现失败', icon: 'none' })
      }
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '提现失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className="withdraw-page">
      <View className="balance-card">
        <Text className="label">可提现余额</Text>
        <Text className="amount">¥{loading ? '--' : balance.toFixed(2)}</Text>
        <Text className="desc">提现后预计 T+1 到账银行卡</Text>
        {frozenAmount > 0 && (
          <Text className="freeze">冻结金额：¥{frozenAmount.toFixed(2)}，7天退款保护期后释放</Text>
        )}
      </View>

      <View className="form-card">
        <Text className="field-label">提现金额</Text>
        <Input
          className="amount-input"
          type="digit"
          value={amount}
          placeholder="请输入金额，最低 0.10 元"
          onInput={e => setAmount(e.detail.value)}
        />
        <View className="quick-row">
          <Text className="quick-btn" onClick={() => setAmount('0.1')}>0.10</Text>
          <Text className="quick-btn" onClick={() => setAmount(balance.toFixed(2))}>全部</Text>
        </View>
        <Button className="submit-btn" loading={submitting} disabled={loading || submitting} onClick={submit}>确认提现</Button>
      </View>

      <View className="hint-card">
        <Text className="hint-title">到账说明</Text>
        <Text className="hint-text">实际到账金额可能扣除汇付取现手续费，具体以汇付和银行入账记录为准。</Text>
      </View>
    </View>
  )
}

export default CoachWalletWithdraw
