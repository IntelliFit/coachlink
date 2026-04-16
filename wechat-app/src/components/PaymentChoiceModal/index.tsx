/**
 * 支付方式选择弹窗
 * 小程序内订阅流程：优先调用 create 接口拿支付宝 URL 再复制；无 createParams 时复制备用链接
 */
import React, { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Check } from '@nutui/icons-react-taro'
import Taro from '@tarojs/taro'
import { Dialog } from '@nutui/nutui-react-taro'
import { createAlipayOrder } from '@/services/paymentService'
import './index.scss'

const WEB_BASE = 'https://coachlink.fit'

export interface PaymentCreateParams {
  subscriptionId: string
  coachId: string
  amount: number
  subject: string
  renew?: boolean
  renewAdditionalWeeks?: number
}

interface PaymentChoiceModalProps {
  visible: boolean
  onClose: () => void
  /** 有则点确认时调 create 接口拿支付宝 URL 并复制；无则复制 alipayUrl */
  createParams?: PaymentCreateParams | null
  /** 备用支付链接（无 createParams 或接口失败时使用） */
  alipayUrl: string
  amount?: number
}

export default function PaymentChoiceModal({
  visible,
  onClose,
  createParams,
  alipayUrl,
  amount = 0
}: PaymentChoiceModalProps) {
  const [copying, setCopying] = useState(false)

  const handleWechatPay = () => {
    Taro.showToast({ title: '微信支付暂不支持，敬请期待', icon: 'none' })
  }

  const copyAndClose = (
    url: string,
    options?: { orderId?: string; amount?: number; coachId?: string }
  ) => {
    Taro.setClipboardData({
      data: url,
      success: () => {
        Taro.showModal({
          title: '链接已复制',
          content: '请在浏览器中打开链接完成支付，返回后将自动同步支付结果',
          showCancel: false,
          success: () => {
            onClose()
            if (options?.orderId) {
              const q: Record<string, string> = {
                orderId: options.orderId,
                amount: String(options.amount ?? 0),
                coachId: options.coachId ?? ''
              }
              const query = Object.entries(q)
                .filter(([, v]) => v != null && v !== '')
                .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
                .join('&')
              Taro.navigateTo({
                url: `/me/payment-waiting/index?${query}`
              })
            }
          }
        })
      }
    })
  }

  const handleAlipayPay = async () => {
    if (copying) return
    if (createParams) {
      setCopying(true)
      try {
        const res = await createAlipayOrder({
          subject: createParams.subject,
          totalAmount: createParams.amount,
          orderType: createParams.renew ? 'subscription_renew' : 'subscription',
          orderData: {
            coachId: createParams.coachId,
            subscriptionId: createParams.subscriptionId,
            renewAdditionalWeeks: createParams.renewAdditionalWeeks
          },
          returnUrlOnly: true,
          isMobile: true,
          showErrorToast: false
        })
        if (res.success && res.paymentUrl) {
          copyAndClose(res.paymentUrl, {
            orderId: res.orderId,
            amount: createParams.amount,
            coachId: createParams.coachId
          })
        } else {
          Taro.showToast({ title: res.message || '获取支付链接失败', icon: 'none' })
        }
      } catch (e: any) {
        Taro.showToast({ title: e?.message || '获取支付链接失败', icon: 'none' })
      } finally {
        setCopying(false)
      }
    } else {
      copyAndClose(alipayUrl)
    }
  }

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title="选择支付方式"
      className="payment-choice-dialog"
      confirmText="确认"
      cancelText="取消"
      onConfirm={handleAlipayPay}
    >
      <View className="payment-choice-content">
        {amount > 0 && (
          <View className="payment-amount">
            <Text className="amount-label">支付金额</Text>
            <Text className="amount-value">¥{amount.toFixed(2)}</Text>
          </View>
        )}
        <View className="payment-options">
          <View className="payment-option wechat" onClick={handleWechatPay}>
            <View className="option-icon wechat-icon"><Check size={20} color="#fff" /></View>
            <Text className="option-name">微信支付</Text>
            <Text className="option-tag">暂不支持</Text>
          </View>
          <View className="payment-option alipay" onClick={handleAlipayPay}>
            <View className="option-icon alipay-icon"><Check size={20} color="#fff" /></View>
            <Text className="option-name">支付宝支付</Text>
            <Text className="option-desc">复制链接在浏览器打开</Text>
          </View>
        </View>
        <Text className="payment-hint">支付宝支付将跳转到浏览器完成，支付成功后订阅自动生效</Text>
      </View>
    </Dialog>
  )
}

/**
 * 构建「支付直达」链接：在浏览器打开后直接创建订单并跳转支付宝（不再经过教练主页）
 * 小程序复制此链接，用户打开即可支付。
 */
export function buildPaymentStartUrl(params: {
  coachId: string
  subscriptionId: string
  amount: number
  subject: string
  renew?: boolean
  renewAdditionalWeeks?: number
}): string {
  const search = new URLSearchParams()
  search.set('subscriptionId', params.subscriptionId)
  search.set('coachId', params.coachId)
  search.set('amount', String(params.amount))
  search.set('subject', params.subject)
  if (params.renew) {
    search.set('renew', 'true')
    if (params.renewAdditionalWeeks != null) {
      search.set('renewAdditionalWeeks', String(params.renewAdditionalWeeks))
    }
  }
  return `${WEB_BASE}/payment/start?${search.toString()}`
}

/**
 * 构建教练主页链接（含 tab/续费/自动选套餐），用于未提供订阅 ID 时的兜底
 * @deprecated 推荐使用 buildPaymentStartUrl 得到真正的支付直达链接
 */
export function buildAlipayUrl(
  coachId: string,
  productId?: string,
  months?: number,
  isRenew?: boolean
): string {
  const params = new URLSearchParams()
  params.set('tab', '1')
  if (isRenew) {
    params.set('renew', 'true')
  }
  if (productId && months) {
    params.set('autoSubscribe', '1')
    params.set('productId', productId)
    params.set('months', String(months))
  }
  return `${WEB_BASE}/coach/profile/${coachId}?${params.toString()}`
}
