import React, { useState, useEffect, useRef } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { queryPaymentOrder, type PaymentStatus } from '@/services/paymentService'
import './index.scss'
import { ArrowRight } from '@nutui/icons-react-taro'
import { LoadingSpinner } from '@/components/LoadingSpinner'

const POLL_INTERVAL = 5000

export default function PaymentWaiting() {
  const router = useRouter()
  const [orderId, setOrderId] = useState('')
  const [amount, setAmount] = useState(0)
  const [status, setStatus] = useState<PaymentStatus>('pending')
  const [loading, setLoading] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const coachId = (router.params.coachId ?? router.params.coach_id ?? '') as string

  const fetchStatus = async (id?: string, isSilent = false) => {
    const oid = id ?? orderId
    if (!oid) return
    if (!isSilent) setLoading(true)
    try {
      const res = await queryPaymentOrder(oid)
      if (res.success && res.status) {
        setStatus(res.status)
        if (res.amount != null) setAmount(res.amount)
        if (res.status !== 'pending' && pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      }
    } catch (e) {
      if (!isSilent) {
        Taro.showToast({ title: '查询失败', icon: 'none' })
      }
    } finally {
      if (!isSilent) setLoading(false)
    }
  }

  useDidShow(() => {
    const params = router.params
    const id = (params.orderId ?? params.order_id ?? '') as string
    const amt = params.amount != null ? Number(params.amount) : 0
    if (id) {
      setOrderId(id)
      if (amt > 0) setAmount(amt)
      fetchStatus(id)
    } else {
      Taro.showToast({ title: '缺少订单号', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 1500)
    }
  })

  useEffect(() => {
    if (!orderId || status !== 'pending') return
    pollRef.current = setInterval(() => fetchStatus(orderId, true), POLL_INTERVAL)
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [orderId, status])

  const handleContinue = () => {
    if (coachId) {
      Taro.redirectTo({
        url: `/discovery/coach-profile?id=${coachId}&tab=1&paid=1`
      })
    } else {
      Taro.redirectTo({ url: '/me/my-coaches/index' })
    }
  }

  const handleRetry = () => {
    if (coachId) {
      Taro.redirectTo({ url: `/discovery/coach-profile?id=${coachId}&tab=1` })
    } else {
      Taro.redirectTo({ url: '/me/my-coaches/index' })
    }
  }

  const handleManualCheck = () => {
    setLoading(true)
    fetchStatus(orderId).finally(() => setLoading(false))
    Taro.showToast({ title: '正在查询…', icon: 'none', duration: 1500 })
  }

  if (!orderId) {
    return (
      <View className="payment-waiting-page">
        <View className="payment-waiting-card">
          <LoadingSpinner size={48} />
        </View>
      </View>
    )
  }

  return (
    <View className="payment-waiting-page">
      <View className="payment-waiting-header">
        <Text className="label">支付确认中</Text>
        <View className="amount-wrap">
          <Text className="amount-symbol">¥</Text>
          <Text className="amount-value">{amount.toFixed(2)}</Text>
        </View>
        <Text className="order-id">订单号: {orderId}</Text>
      </View>

      <View className="payment-waiting-card">
        {status === 'pending' ? (
          <>
            <View className="payment-waiting-spinner">
              <View className="icon"><ArrowRight /></View>
            </View>
            <Text className="payment-waiting-title">正在等待支付结果...</Text>
            <Text className="payment-waiting-hint">
              请到浏览器中完成支付宝支付后返回本页，系统将自动同步结果
            </Text>
          </>
        ) : (
          <View className="payment-waiting-result">
            <View
              className={`result-icon-wrap ${
                status === 'success' ? 'success' : status === 'cancelled' ? 'cancelled' : 'failed'
              }`}
            >
              <Text className="result-icon">
                {status === 'success' ? '' : status === 'cancelled' ? '−' : 'X'}
              </Text>
            </View>
            <Text className="result-title">
              {status === 'success'
                ? '支付已成功'
                : status === 'cancelled'
                  ? '您已取消支付'
                  : '支付未成功'}
            </Text>
          </View>
        )}
      </View>

      {status === 'pending' && (
        <View className="payment-waiting-tip">
          <Text className="tip-icon">!</Text>
          <View>
            <Text className="tip-label">安全提醒</Text>
            <Text className="tip-text">
              支付过程中请勿关闭本页，返回小程序后保持在本页，系统会每 5 秒自动同步支付结果。
            </Text>
          </View>
        </View>
      )}

      <View className="payment-waiting-actions">
        {status === 'pending' && (
          <View
            className="payment-waiting-btn primary"
            onClick={handleManualCheck}
          >
            <Text>我已完成支付</Text>
          </View>
        )}

        {status === 'success' && (
          <View className="payment-waiting-btn primary" onClick={handleContinue}>
            <Text>继续</Text>
          </View>
        )}

        {(status === 'failed' || status === 'cancelled') && (
          <View className="payment-waiting-btn warn" onClick={handleRetry}>
            <Text>{status === 'cancelled' ? '重新订阅' : '重新尝试'}</Text>
          </View>
        )}

        <View
          className="payment-waiting-back"
          onClick={() => Taro.navigateBack()}
        >
          <Text>返回</Text>
        </View>
      </View>
    </View>
  )
}
