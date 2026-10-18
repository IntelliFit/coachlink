import { randomBytes } from 'node:crypto';

export const SANDBOX_PREFIX = 'xpaysbx_';
export function isSandboxOrderId(value) {
  return /^xpaysbx_[a-f0-9]{24}$/.test(String(value || ''));
}
export function isLiveTestOrderId(value) {
  return /^xpaylive[a-f0-9]{24}$/.test(String(value || ''));
}

// Deliberately not a financial ledger: no database/entitlement/wallet writes.
export class SandboxLedger {
  constructor({ now = Date.now, records = [], env = 1 } = {}) {
    this.now = now;
    this.env = env;
    this.acceptId = env === 0 ? isLiveTestOrderId : isSandboxOrderId;
    this.orders = new Map(records.filter(row => this.acceptId(row.id)).map(row => [row.id, row]));
  }
  prune() {
    // Real payment evidence must survive restarts and cannot expire like mocks.
    if (this.env === 0) return;
    for (const [id, row] of this.orders) if (this.now() - row.createdAt > 86400000) this.orders.delete(id);
  }
  create(userId, openId, product) {
    this.prune();
    if (this.orders.size >= 64) throw new Error('沙箱订单数量已达上限');
    if ([...this.orders.values()].filter(row => row.userId === userId && this.now() - row.createdAt < 60000).length >= 4) {
      throw new Error('请稍后再创建测试订单');
    }
    const order = { id: (this.env === 0 ? 'xpaylive' : SANDBOX_PREFIX) + randomBytes(12).toString('hex'), userId, openId,
      productId: product.id, price: product.price, env: this.env, status: 'pending', deliveries: 0, createdAt: this.now() };
    this.orders.set(order.id, order);
    return order;
  }
  get(id, userId) {
    this.prune();
    const order = this.orders.get(id);
    if (!order || (userId !== undefined && order.userId !== userId)) throw new Error('沙箱订单不存在或不属于当前账号');
    return order;
  }
  match(order, { openId, env, productId, quantity, originalPrice, actualPrice }) {
    if (openId !== order.openId || env !== this.env ||
      (productId !== undefined && productId !== order.productId) ||
      (quantity !== undefined && quantity !== 1) ||
      (originalPrice !== undefined && originalPrice !== order.price) || actualPrice !== order.price) {
      throw new Error('沙箱支付结果与测试订单不一致');
    }
  }
  deliver(order) {
    if (order.status === 'refunded') throw new Error('沙箱订单已退款');
    if (!order.deliveries) { order.deliveries = 1; order.deliveredAt = this.now(); }
    if (order.status !== 'partially_refunded') order.status = 'paid';
  }
  confirmPayment(order) {
    if (!['refunded', 'partially_refunded'].includes(order.status)) order.status = 'paid';
    order.paymentConfirmedAt ||= this.now();
    // Cash verification is NOT product delivery. Do not acknowledge goods here.
  }
  refund(order, fee) {
    if (!Number.isSafeInteger(fee) || fee <= 0 || fee > order.price) throw new Error('沙箱退款金额不一致');
    if (fee < (order.refundFee || 0)) throw new Error('沙箱退款金额不能回退');
    order.status = fee === order.price ? 'refunded' : 'partially_refunded';
    order.refundFee = fee;
  }
  view(order) {
    return { orderId: order.id, productId: order.productId, priceFen: order.price, env: this.env,
      status: order.status, deliveries: order.deliveries, refundedFen: order.refundFee || 0,
      realEntitlementsWritten: false };
  }
}
