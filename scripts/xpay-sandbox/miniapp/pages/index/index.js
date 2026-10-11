const products = require('../../catalog.js')
const payment = require('./payment.js')
const stage = require('../../stage.js')
const API = 'https://dev.coachlink.fit'
const LOGIN_API = stage.live ? 'https://coachlink.fit' : API
const BASE = '/api/payment/wechat/xpay/' + (stage.live ? 'live-test' : 'sandbox')
const AUTH_KEY = stage.live ? 'coachlink_xpay_live_test_auth_v1' : 'coachlink_xpay_sandbox_auth_v1'
const ORDER_KEY = stage.live ? 'coachlink_xpay_live_test_order_v1' : 'coachlink_xpay_sandbox_order_v1'
function request(path, data, token) {
  return new Promise((resolve, reject) => wx.request({
    url: (path === '/api/miniapp/wechat-login' ? LOGIN_API : API) + path, method: data === undefined ? 'GET' : 'POST', data,
    header: token ? { Authorization: 'Bearer ' + token } : {}, timeout: 15000,
    success: result => {
      if (result.statusCode !== 200 || result.data.success === false) reject(new Error(result.data.message || '沙箱接口暂不可用'))
      else resolve(result.data)
    }, fail: reject,
  }))
}
function loginCode() {
  return new Promise((resolve, reject) => wx.login({ success: result => result.code ? resolve(result.code) : reject(new Error('微信登录失败')), fail: reject }))
}
Page({
  data: { products, live: stage.live, selected: stage.live ? 0 : 2, ready: false, loggedIn: false, busy: false, orderId: '', status: '等待连接测试环境', deliveries: 0 },
  async onLoad() {
    this.setData({ loggedIn: !!wx.getStorageSync(AUTH_KEY) })
    if (stage.live) this.setData({ orderId: wx.getStorageSync(ORDER_KEY) || '' })
    try {
      const result = await request(BASE + '/health')
      if (result.sandbox !== !stage.live || result.env !== stage.env || result.realEntitlementsWritten !== false || (stage.live && result.cashTestOnly !== true)) throw new Error('测试环境不匹配，已停止')
      this.setData({ ready: true, status: stage.live ? '现网 env=0：会真实扣款，不发放实际权益' : '沙箱已连接，环境 env=1' })
    } catch (error) { this.setData({ status: payment.virtualPaymentErrorMessage(error) || '连接失败' }) }
  },
  choose(event) { if (!this.data.busy) this.setData({ selected: Number(event.detail.value) }) },
  async login() {
    this.setData({ busy: true })
    try {
      const result = await request('/api/miniapp/wechat-login', { code: await loginCode() })
      if (!result.data.user.is_admin) throw new Error('请使用平台管理员本人微信')
      wx.setStorageSync(AUTH_KEY, result.data.token)
      this.setData({ loggedIn: true, status: '本人微信已登录' })
    } catch (error) { this.setData({ status: payment.virtualPaymentErrorMessage(error) || '登录失败' }) }
    finally { this.setData({ busy: false }) }
  },
  async pay() {
    if (this.data.busy || !this.data.ready || !this.data.loggedIn) return
    this.setData({ busy: true, deliveries: 0, ...(stage.live ? {} : { orderId: '' }) })
    try {
      const platform = wx.getSystemInfoSync().platform
      if (!['android', 'devtools'].includes(platform)) throw new Error('本测试包仅用于安卓沙箱')
      const product = products[this.data.selected]
      if (stage.live) {
        const confirmed = await new Promise(resolve => wx.showModal({ title: '真实扣款测试', content: '将真实支付2元，仅验证付款／查单，不发放AI额度。继续？', success: result => resolve(result.confirm), fail: () => resolve(false) }))
        if (!confirmed) { this.setData({ status: '未创建订单，已取消' }); return }
      }
      const result = await request(BASE + '/create', { productId: product.id, loginCode: await loginCode(), confirmRealCharge: stage.live }, wx.getStorageSync(AUTH_KEY))
      const order = result.data
      const signed = JSON.parse(order.paymentParams.signData)
      if (signed.env !== stage.env || signed.productId !== product.id || signed.goodsPrice !== product.price ||
        signed.offerId !== '1450666974' || signed.buyQuantity !== 1 || signed.outTradeNo !== order.orderId || order.env !== stage.env) {
        throw new Error('支付参数不属于本沙箱，已阻止付款')
      }
      this.setData({ orderId: order.orderId, status: '等待微信支付结果' })
      if (stage.live) wx.setStorageSync(ORDER_KEY, order.orderId)
      await payment.requestVirtualPaymentAndWait(wx.requestVirtualPayment && wx.requestVirtualPayment.bind(wx), order.paymentParams)
      // Native success is not a receipt: only the server query may confirm it.
      await this.checkOrder()
    } catch (error) {
      this.setData({ status: payment.isVirtualPaymentCancellation(error) ? '已取消付款，未确认发货；可查单确认' : payment.virtualPaymentErrorMessage(error) || '支付失败' })
    } finally { this.setData({ busy: false }) }
  },
  async checkOrder() {
    if (!this.data.orderId) return
    const result = await request(BASE + '/query', { orderId: this.data.orderId }, wx.getStorageSync(AUTH_KEY))
    const order = result.data
    if (order.env !== stage.env || order.realEntitlementsWritten !== false || order.orderId !== this.data.orderId) throw new Error('查单结果不属于当前测试环境')
    const messages = { pending: '订单待支付，请稍后再查单', paid: '支付已确认，沙箱发货回执已记录', closed: '订单已关闭', refunded: '沙箱订单已退款', partially_refunded: '沙箱订单部分退款' }
    if (stage.live) Object.assign(messages, { paid: '现网真实收款已确认；未发放实际权益', refunded: '现网订单已退款', partially_refunded: '现网订单部分退款' })
    this.setData({ status: messages[order.status] || '订单状态待确认', deliveries: order.deliveries })
  },
  async query() {
    if (this.data.busy) return
    this.setData({ busy: true })
    try { await this.checkOrder() } catch (error) { this.setData({ status: payment.virtualPaymentErrorMessage(error) || '查单失败' }) }
    finally { this.setData({ busy: false }) }
  },
  logout() { wx.removeStorageSync(AUTH_KEY); this.setData({ loggedIn: false, orderId: '', deliveries: 0, status: '已退出测试登录' }) },
})
