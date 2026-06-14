/**
 * 站内购买页承接
 * 使用 web-view 打开 coachlink.fit 的购买页，尽量对齐网站版订阅与支付宝流程
 */
import { useState } from 'react'
import { View, Text, WebView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

const WEB_BASE = 'https://coachlink.fit'
const COACH_SUBSCRIBE_TAB_INDEX = '1'

export default function PaymentWebview() {
  const { effectiveTheme } = useTheme()
  const router = useRouter()
  const [webviewError, setWebviewError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const coachId = (router.params?.coachId ?? router.params?.id) as string
  const target = (router.params?.target ?? '') as string
  const tab = (router.params?.tab ?? '') as string
  const rawUrl = (router.params?.url ?? '') as string
  const productId = router.params?.productId as string
  const productKey = router.params?.productKey as string
  const months = router.params?.months as string
  const renew = (router.params?.renew ?? '') as string
  const autoPurchase = (router.params?.autoPurchase ?? '') as string

  const isTruthy = (value: string) => value === '1' || value === 'true'

  const decodeSafeUrl = (value: string) => {
    if (!value) return ''
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  const ensureSafeWebUrl = (value: string) => {
    if (!value) return ''
    return value.startsWith(`${WEB_BASE}/`) ? value : ''
  }

  const toQuery = (params: Record<string, string | undefined>) => {
    const query = Object.entries(params)
      .filter(([, value]) => value != null && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value!)}`)
      .join('&')
    return query
  }

  const buildUrl = () => {
    const customUrl = ensureSafeWebUrl(decodeSafeUrl(rawUrl))
    if (customUrl) return customUrl

    if (target === 'membership') {
      const query = toQuery({
        tab: tab === 'addon' ? 'addon' : undefined,
        productKey,
        autoPurchase: isTruthy(autoPurchase) ? '1' : undefined,
        from: 'wechat'
      })
      return `${WEB_BASE}/me/membership/subscribe${query ? `?${query}` : ''}`
    }

    if (!coachId) return `${WEB_BASE}/coach/profile`
    const query = toQuery({
      tab: COACH_SUBSCRIBE_TAB_INDEX, // 订阅价格 tab
      renew: isTruthy(renew) ? 'true' : undefined,
      autoSubscribe: productId && months ? '1' : undefined,
      productId: productId && months ? productId : undefined,
      months: productId && months ? months : undefined,
      from: 'wechat'
    })
    return `${WEB_BASE}/coach/profile/${coachId}${query ? `?${query}` : ''}`
  }

  const url = buildUrl()
  const missingRequiredParam = !url || (!coachId && target !== 'membership' && !rawUrl)

  const handleWebviewError = () => {
    setWebviewError(true)
  }

  const handleRetry = () => {
    if (!url) {
      Taro.showToast({ title: '购买信息缺失，请返回重试', icon: 'none' })
      return
    }
    setWebviewError(false)
    setReloadKey((value) => value + 1)
  }

  const handleBack = () => {
    Taro.navigateBack({
      fail: () => {
        Taro.reLaunch({ url: '/discovery/index' })
      }
    })
  }

  const fallbackTitle = missingRequiredParam ? '购买信息不完整' : '购买页加载失败'
  const fallbackDesc = missingRequiredParam
    ? '请返回上一页重新选择套餐后再试。'
    : '请重新打开购买页，继续在小程序内完成与网站一致的购买流程。'

  if (webviewError || missingRequiredParam) {
    return (
      <View className={`payment-webview-fallback theme-${effectiveTheme}`}>
        <View className='fallback-card'>
          <Text className='fallback-title'>{fallbackTitle}</Text>
          <Text className='fallback-desc'>{fallbackDesc}</Text>
          <View className='fallback-actions'>
            {!missingRequiredParam && (
              <View className='fallback-btn fallback-btn-primary' onClick={handleRetry}>
                <Text>重新打开购买页</Text>
              </View>
            )}
            <View className='fallback-btn fallback-btn-secondary' onClick={handleBack}>
              <Text>{missingRequiredParam ? '返回上一页' : '返回重新选择套餐'}</Text>
            </View>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className={`payment-webview-page theme-${effectiveTheme}`}>
      <WebView
        key={reloadKey}
        src={url}
        onError={handleWebviewError}
      />
    </View>
  )
}
