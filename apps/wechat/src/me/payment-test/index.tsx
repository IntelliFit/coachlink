import { useEffect, useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { request } from '@/utils/request'
import { authService } from '@/services/authService'
import { isXPayTrialClient } from '@/utils/xpayTrial'
import { requestVirtualPaymentAndWait, isVirtualPaymentCancellation, virtualPaymentErrorMessage } from '@/utils/virtual-payment'
import './index.scss'

export default function PaymentTest() {
  const [state, setState] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [queryBusy, setQueryBusy] = useState(false)
  const [message, setMessage] = useState('正在检查登录状态与支付环境…')
  const load = async () => {
    if (!isXPayTrialClient()) { setMessage('请在体验版中进行支付测试'); return }
    const result = await request({ url: '/api/payment/wechat/xpay/admin-trial', showErrorToast: false })
    if (!result.success) { setMessage(result.message || '无联调权限'); return }
    setState(result.data)
    setMessage('沙箱联调：不扣真实款，使用真实业务订单，支付后增加 3 次 AI 额度。')
  }
  useEffect(() => { void load() }, [])
  const query = async (orderId = state?.order?.id) => {
    if (!orderId) return
    const result = await request<any>({ url: '/api/payment/wechat/query', method: 'POST', data: { orderId }, showErrorToast: false })
    if (!result.success) { setMessage(result.message || '查单失败，请重试查询，勿再次付款'); return }
    setState(result.data)
    setMessage(result.data.deliveryConfirmed
      ? '沙箱通路通过：额度已到账、发货已确认。本次未扣真实款。'
      : `订单状态：${result.data.status}。只有付款、额度与发货确认均完成才算通过。`)
  }
  const pay = async () => {
    if (!state || busy) return
    const confirmed = await Taro.showModal({ title: '沙箱支付验证', content: '使用 AI 加油包（标价 2 元），不会扣真实款。先取消一次，再用同一订单完成付款；联调期间不要使用 AI 导入。' })
    if (!confirmed.confirm) return
    setBusy(true)
    try {
      const binding = await authService.bindWechatOpenid()
      if (!binding.success) { setMessage(binding.message || '微信身份验证失败，请使用微信登录后重试'); return }
      const session = await Taro.login()
      const result = await request<any>({ url: '/api/payment/wechat/membership/create', method: 'POST',
        header: { 'x-coachlink-xpay-admin-trial': '1' }, data: { productKey: 'ai_pack_basic', loginCode: session.code }, showErrorToast: false })
      if (!result.success) { setMessage(result.message || '创建订单失败'); return }
      setState((old: any) => ({ ...old, order: { id: result.data.orderId, status: 'pending' } }))
      await requestVirtualPaymentAndWait((Taro as any).requestVirtualPayment, result.data.paymentParams)
      setMessage('微信支付回调已返回，正在核对服务器订单与额度…')
      await query(result.data.orderId)
    } catch (error) {
      setMessage(isVirtualPaymentCancellation(error) ? '已取消，未确认付款。可再次支付原订单或查询状态。' : virtualPaymentErrorMessage(error) || '支付失败，请查询原订单')
    } finally { setBusy(false) }
  }
  return <View className='xpay-trial-page'>
    <Text className='heading'>完整支付通路验证</Text>
    <Text className='message'>{message}</Text>
    {state && <>
      <Text>环境：沙箱（env=1）；商品：ai_pack_200；标价：¥2.00</Text>
      <Text>当前 AI 付费余额：{state.aiBalance} 次</Text>
      <Text>订单：{state.order?.id || '尚未创建'}</Text>
      <Text>状态：{state.order?.status || '无订单'}</Text>
      {state.order?.order_data && <Text>购买前：{state.order.order_data.xpay_trial_balance_before}；到账目标：{Number(state.order.order_data.xpay_trial_balance_before) + 3}</Text>}
      <Button className='primary' disabled={Boolean(busy || (state.order && state.order.status !== 'pending'))} onClick={pay}>支付验证（取消后可重试）</Button>
      <Button className='secondary' loading={queryBusy} onClick={async () => {
        if (queryBusy) return
        if (!state.order?.id) { setMessage('尚无订单，请先发起支付验证'); return }
        setQueryBusy(true)
        setMessage('正在查询订单与发货…')
        try { await query() } catch { setMessage('查询失败，请稍后重试，不要再次付款') } finally { setQueryBusy(false) }
      }}>查询订单与发货</Button>
    </>}
  </View>
}
