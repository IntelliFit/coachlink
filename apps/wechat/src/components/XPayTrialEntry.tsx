import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { request } from '@/utils/request'
import { isXPayTrialClient } from '@/utils/xpayTrial'
import { WECHAT_FREE_RELEASE } from '@coachlink/core'

export function XPayTrialEntry({ userId }: { userId?: string | number }) {
  const [allowed, setAllowed] = useState(false)
  useEffect(() => {
    let active = true
    setAllowed(false)
    if (WECHAT_FREE_RELEASE && userId && isXPayTrialClient()) {
      void request({ url: '/api/payment/wechat/xpay/admin-trial', showErrorToast: false })
        .then(result => { if (active) setAllowed(result.success) })
    }
    return () => { active = false }
  }, [userId])
  return allowed ? <View style={{ padding: '24rpx', margin: '16rpx', background: '#FFFFFF', borderRadius: '16rpx' }}
    onClick={() => Taro.navigateTo({ url: '/me/payment-test/index' })}>
    <Text>支付测试（沙箱） ›</Text>
  </View> : null
}
