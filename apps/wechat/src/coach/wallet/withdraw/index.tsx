import React, { useEffect, useState } from 'react'
import { Button, Text, View } from '@tarojs/components'
import { StableInput as Input } from '@/components/StableInput'
import Taro from '@tarojs/taro'
import { coachService } from '@/services/coach/coachService'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

type WithdrawalRules = {
  min_amount: number
  max_amount: number
  amount_description: string
  daily_count_description: string
  availability_description: string
  arrival_type: 'D0' | 'D1' | 'DM' | 'T1'
  arrival_description: string
  fee_description: string
  destination_description: string
}

const DEFAULT_WITHDRAWAL_RULES: WithdrawalRules = {
  min_amount: 0.1,
  max_amount: 0,
  amount_description: '单笔最低 0.10 元，最高为当前可提现余额',
  daily_count_description: '平台不限制每日申请次数，实际以汇付及银行卡风控为准',
  availability_description: '全天可申请（00:00–24:00），系统或银行维护期间除外',
  arrival_type: 'D1',
  arrival_description: '预计次自然日到账（D+1）',
  fee_description: '平台不额外收取提现服务费；汇付取现手续费按签约规则结算，实际扣费及到账金额以银行入账记录为准',
  destination_description: '提现至已绑定的本人结算银行卡',
}

function CoachWalletWithdraw() {
  const { effectiveTheme } = useTheme()
  const [balance, setBalance] = useState(0)
  const [frozenAmount, setFrozenAmount] = useState(0)
  const [huifuStatus, setHuifuStatus] = useState<string | null>(null)
  const [withdrawalRules, setWithdrawalRules] = useState<WithdrawalRules>(DEFAULT_WITHDRAWAL_RULES)
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
      setWithdrawalRules(data?.withdrawal_rules ?? {
        ...DEFAULT_WITHDRAWAL_RULES,
        max_amount: data?.balance ?? 0,
      })
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
    if (value < withdrawalRules.min_amount) {
      Taro.showToast({ title: `单笔不能低于${withdrawalRules.min_amount.toFixed(2)}元`, icon: 'none' })
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
          content: res.message || withdrawalRules.arrival_description,
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

  const numericAmount = Number(amount)
  const canSubmit = !loading
    && !submitting
    && Number.isFinite(numericAmount)
    && numericAmount >= withdrawalRules.min_amount
    && numericAmount <= balance

  return (
    <View className={`withdraw-page theme-${effectiveTheme}`}>
      <View className="balance-card">
        <Text className="label">可提现余额</Text>
        <Text className="amount">¥{loading ? '--' : balance.toFixed(2)}</Text>
        <Text className="desc">提现至银行卡，{withdrawalRules.arrival_description}</Text>
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
          placeholder={`请输入金额，最低 ${withdrawalRules.min_amount.toFixed(2)} 元`}
          onInput={e => setAmount(e.detail.value)}
        />
        <View className="quick-row">
          <Text className="quick-btn" onClick={() => setAmount(withdrawalRules.min_amount.toFixed(2))}>{withdrawalRules.min_amount.toFixed(2)}</Text>
          <Text className="quick-btn" onClick={() => setAmount(balance.toFixed(2))}>全部</Text>
        </View>
        <Button className="submit-btn" loading={submitting} disabled={!canSubmit} onClick={submit}>确认提现</Button>
      </View>

      <View className="hint-card withdrawal-rules-card">
        <Text className="hint-title">提现规则</Text>
        <View className="rule-row">
          <Text className="rule-label">可提现额度</Text>
          <Text className="rule-value">{withdrawalRules.amount_description}</Text>
        </View>
        <View className="rule-row">
          <Text className="rule-label">每日提现次数</Text>
          <Text className="rule-value">{withdrawalRules.daily_count_description}</Text>
        </View>
        <View className="rule-row">
          <Text className="rule-label">提现时间</Text>
          <Text className="rule-value">{withdrawalRules.availability_description}</Text>
        </View>
        <View className="rule-row">
          <Text className="rule-label">到账时间</Text>
          <Text className="rule-value">{withdrawalRules.arrival_description}，具体以银行处理时间为准</Text>
        </View>
        <View className="rule-row">
          <Text className="rule-label">到账账户</Text>
          <Text className="rule-value">{withdrawalRules.destination_description}</Text>
        </View>
        <View className="rule-row rule-row-last">
          <Text className="rule-label">手续费</Text>
          <Text className="rule-value">{withdrawalRules.fee_description}</Text>
        </View>
      </View>
    </View>
  )
}

export default CoachWalletWithdraw
