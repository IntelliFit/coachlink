import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, renameSync, openSync, fsyncSync, closeSync } from 'node:fs';
import jwt from 'jsonwebtoken';
import products from './catalog.json';
import { SandboxLedger } from './ledger.mjs';
import {
  assertWechatOpenId, createWechatXPayParams, exchangeWechatXPaySession,
  getWechatXPayConfig, queryWechatXPayOrder, verifyWechatXPayCallbackSignature,
} from '../../src/lib/wechatXPay';

const LIVE = process.env.XPAY_TEST_STAGE === 'live';
const ENV = LIVE ? 0 : 1;
const BASE = '/api/payment/wechat/xpay/' + (LIVE ? 'live-test' : 'sandbox');
const STATE = '/sandbox-state/orders.json';
const ledger = new SandboxLedger({ env: ENV });
// Only one low-value SKU is enabled for the first cash verification. This is
// NOT the platform's purchasing/fulfillment API and never changes entitlements.
const enabledProducts = LIVE ? products.filter(p => p.id === 'ai_pack_200' && p.price === 200) : products;
function persist() {
  mkdirSync('/sandbox-state', { recursive: true });
  if (!LIVE) { writeFileSync(STATE, JSON.stringify([...ledger.orders.values()]), { mode: 0o600 }); return; }
  const temporary = STATE + '.tmp';
  writeFileSync(temporary, JSON.stringify([...ledger.orders.values()]), { mode: 0o600 });
  const descriptor = openSync(temporary, 'r');
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
  renameSync(temporary, STATE);
  const directory = openSync('/sandbox-state', 'r');
  try { fsyncSync(directory); } finally { closeSync(directory); }
}
function send(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}
async function jsonBody(request) {
  let body = '';
  for await (const part of request) { body += part; if (Buffer.byteLength(body) > 8192) throw new Error('请求过大'); }
  return JSON.parse(body || '{}');
}
async function tester(request) {
  const token = String(request.headers.authorization || '').replace(/^Bearer /, '');
  const secret = String(process.env.NEXTAUTH_SECRET || '');
  if (!secret || !token || token.startsWith('cldev.')) throw new Error('请用本人微信账号登录');
  const claims = jwt.verify(token, secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
  if (!claims || typeof claims.userId !== 'string') throw new Error('登录凭证无效');
  const url = String(process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  const query = new URLSearchParams({ select: 'id,is_admin,wechat_openid', id: 'eq.' + claims.userId, limit: '1' });
  const response = await fetch(url + '/rest/v1/users?' + query, { headers: { apikey: key, Authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(10000) });
  const rows = await response.json();
  if (!response.ok || !Array.isArray(rows) || rows.length !== 1 || rows[0].is_admin !== true) throw new Error('仅平台管理员可运行沙箱联调');
  if (!rows[0].wechat_openid) throw new Error('当前账号未绑定微信');
  return rows[0];
}
async function notify(request, response, url) {
  if (LIVE) { send(response, 409, { success: false, message: '现网测试只查真实收款，不冒充商品发货通知' }); return; }
  const signature = url.searchParams.get('signature') || '';
  if (!url.searchParams.get('timestamp') || !url.searchParams.get('nonce') || !verifyWechatXPayCallbackSignature({ timestamp: url.searchParams.get('timestamp') || '', nonce: url.searchParams.get('nonce') || '', signature })) {
    response.writeHead(403); response.end(); return;
  }
  if (request.method === 'GET') { response.writeHead(200, { 'Content-Type': 'text/plain' }); response.end(url.searchParams.get('echostr') || ''); return; }
  const body = await jsonBody(request);
  if (body.Event === 'xpay_goods_deliver_notify') {
    const order = ledger.get(String(body.OutTradeNo || ''));
    ledger.match(order, { openId: String(body.openid || body.OpenId || ''), env: Number(body.Env ?? body.env),
      productId: String(body.GoodsInfo?.ProductId || ''), quantity: Number(body.GoodsInfo?.Quantity),
      originalPrice: Number(body.GoodsInfo?.OrigPrice), actualPrice: Number(body.GoodsInfo?.ActualPrice) });
    ledger.deliver(order);
  } else if (body.Event === 'xpay_refund_notify') {
    if (Number(body.RetCode || 0) !== 0) { send(response, 200, { ErrCode: 0, ErrMsg: 'refund failure noted' }); return; }
    const order = ledger.get(String(body.MchOrderId || ''));
    if ((body.Env !== undefined || body.env !== undefined) && Number(body.Env ?? body.env) !== 1) throw new Error('沙箱退款环境不一致');
    if (String(body.openid || body.OpenId || '') !== order.openId) throw new Error('沙箱退款身份不一致');
    ledger.refund(order, Number(body.RefundFee));
  } else throw new Error('不支持的沙箱通知');
  persist(); send(response, 200, { ErrCode: 0, ErrMsg: 'success' });
}
async function main() {
  const { bootstrapEnv } = await import('/app/scripts/config/bootstrap-env.mjs');
  const loaded = await bootstrapEnv({ mode: 'production', projectRoot: '/app' });
  const config = getWechatXPayConfig();
  if (loaded.apollo?.cluster !== (LIVE ? 'main' : 'dev') || config.env !== ENV || config.appId !== 'wx316e39eb71c0e834' || config.offerId !== '1450666974') throw new Error('Test stage/configuration mismatch');
  if (LIVE && process.env.XPAY_TEST_DURABLE_STATE !== 'true') throw new Error('Cash test requires durable state');
  try {
    const saved = JSON.parse(readFileSync(STATE, 'utf8'));
    if (!Array.isArray(saved) || saved.some(row => !ledger.acceptId(row.id) || row.env !== ENV)) throw new Error('Invalid persisted test state');
    for (const row of saved) ledger.orders.set(row.id, row);
    ledger.prune();
  } catch (error) {
    // A corrupted cash record must fail closed; never start with an empty book.
    if (LIVE && (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://sandbox.invalid');
    try {
      if (url.pathname === BASE + '/health') { send(response, 200, { sandbox: !LIVE, env: ENV, goods: products.length, enabledGoods: enabledProducts.map(p => p.id), cashTestOnly: LIVE, realEntitlementsWritten: false }); return; }
      if ([BASE + '/notify', '/api/payment/wechat/xpay/notify'].includes(url.pathname) && ['GET', 'POST'].includes(request.method || '')) { await notify(request, response, url); return; }
      if (request.method !== 'POST') { send(response, 405, { success: false }); return; }
      if (![BASE + '/create', BASE + '/query'].includes(url.pathname)) { send(response, 404, { success: false }); return; }
      const user = await tester(request);
      const body = await jsonBody(request);
      if (url.pathname === BASE + '/create') {
        const product = enabledProducts.find(item => item.id === body.productId);
        if (!product) throw new Error('无效的沙箱商品');
        if (LIVE && body.confirmRealCharge !== true) throw new Error('必须确认本次是真实扣款测试');
        const session = await exchangeWechatXPaySession(String(body.loginCode || ''));
        assertWechatOpenId(user.wechat_openid, session.openId);
        let order;
        if (LIVE) {
          const prior = [...ledger.orders.values()].find(row => row.userId === user.id);
          if (prior && prior.status !== 'pending') throw new Error('已完成首笔真实验证，请查询原单，勿重复购买');
          order = prior || ledger.create(user.id, session.openId, product);
        } else order = ledger.create(user.id, session.openId, product);
        const { params } = createWechatXPayParams({ sessionKey: session.sessionKey, productId: product.id,
          goodsPrice: product.price, outTradeNo: order.id, attach: LIVE ? 'coachlink-admin-cash-test-only' : 'coachlink-android-sandbox-v1' });
        persist(); send(response, 200, { success: true, data: { ...ledger.view(order), paymentParams: params } }); return;
      }
      if (url.pathname === BASE + '/query') {
        const order = ledger.get(String(body.orderId || ''), user.id);
        const upstream = await queryWechatXPayOrder({ openId: order.openId, outTradeNo: order.id });
        const status = Number(upstream?.status || 0);
        if (LIVE && upstream?.order_id !== order.id) throw new Error('现网查单返回订单号不一致');
        if ([2, 3, 4].includes(status)) {
          ledger.match(order, { openId: user.wechat_openid, env: ENV, actualPrice: Number(upstream?.paid_fee || 0) });
          if (LIVE) { ledger.confirmPayment(order); order.wxOrderId = String(upstream?.wx_order_id || upstream?.wxpay_order_id || ''); }
          else ledger.deliver(order);
        } else if ([5, 8].includes(status)) ledger.refund(order, Number(upstream?.refund_fee || 0));
        else if (status === 6 && order.status === 'pending') order.status = 'closed';
        persist(); send(response, 200, { success: true, data: ledger.view(order) }); return;
      }
      send(response, 404, { success: false });
    } catch (error) {
      // No request tokens, session keys, provider URLs or user rows in logs.
      send(response, 400, { success: false, message: error instanceof Error ? error.message : '沙箱请求失败' });
    }
  });
  server.listen(4109, '0.0.0.0', () => console.log('CoachLink Android test ready; stage=' + (LIVE ? 'live-cash-only' : 'sandbox') + '; no entitlement writes'));
}
main().catch(() => { console.error('Sandbox bootstrap failed'); process.exitCode = 1; });
