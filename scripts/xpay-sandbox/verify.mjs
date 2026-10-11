import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { SandboxLedger } from './ledger.mjs';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const target = 'D:/cache/agent-tests/coachlink-xpay-20261011';
const checks = [];
async function check(name, fn) { await fn(); checks.push(name); }
const env = { WECHAT_XPAY_OFFER_ID: '1450666974', WECHAT_XPAY_APP_KEY: 'mock-sandbox-key', WECHAT_XPAY_SANDBOX: 'true', WECHAT_MINIAPP_APPID: 'wx316e39eb71c0e834', WECHAT_MINIAPP_SECRET: 'mock-secret', WECHAT_XPAY_MESSAGE_TOKEN: 'mock-message-token', NEXTAUTH_SECRET: 'mock-jwt-key', NEXT_SUPABASE_URL: 'https://mock.invalid', NEXT_SUPABASE_SERVICE_ROLE_KEY: 'mock-db-key' };
const products = JSON.parse(readFileSync('scripts/xpay-sandbox/catalog.json', 'utf8'));
let upstreamStatus = 2, upstreamFee = 200, stableCalls = 0, databaseWrites = 0;
const fakeFetch = async (url, options = {}) => {
  if (String(url).includes('/rest/v1/')) {
    if (options.method && options.method !== 'GET') databaseWrites++;
    return { ok: true, json: async () => [{ id: 'tester', is_admin: true, wechat_openid: 'mock-openid' }] };
  }
  if (String(url).includes('/sns/jscode2session')) return { ok: true, json: async () => ({ openid: 'mock-openid', session_key: 'mock-session' }) };
  if (String(url).endsWith('/cgi-bin/stable_token')) {
    assert.equal(options.method, 'POST'); assert.equal(JSON.parse(options.body).force_refresh, false); stableCalls++;
    return { ok: true, json: async () => ({ access_token: 'mock-access', expires_in: 7200 }) };
  }
  if (String(url).includes('/xpay/query_order')) return { ok: true, json: async () => ({ errcode: 0, order: { status: upstreamStatus, paid_fee: upstreamFee } }) };
  throw new Error('Unexpected network destination');
};
function load(source, dependencies, additions = {}) {
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true });
  assert.equal(output.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0);
  const module = { exports: {} };
  vm.runInNewContext(output.outputText, { module, exports: module.exports, require: id => dependencies[id] ?? require(id), process: { env: { ...env } }, Buffer, URL, URLSearchParams, AbortSignal, fetch: fakeFetch, console: { log() {}, error() {} }, ...additions });
  return module.exports;
}
const xpay = load(readFileSync('src/lib/wechatXPay.ts', 'utf8'), {});
for (const product of products) await check('签名商品 ' + product.id, () => {
  const { params, signData } = xpay.createWechatXPayParams({ sessionKey: 'mock-session', productId: product.id, goodsPrice: product.price, outTradeNo: 'xpaysbx_' + 'a'.repeat(24), attach: 'sandbox' });
  assert.equal(signData.env, 1); assert.equal(signData.goodsPrice, product.price);
  assert.equal(params.paySig, crypto.createHmac('sha256', env.WECHAT_XPAY_APP_KEY).update('requestVirtualPayment&' + params.signData).digest('hex'));
  assert.equal(params.signature, crypto.createHmac('sha256', 'mock-session').update(params.signData).digest('hex'));
});
await check('stable_token 非强刷与缓存', async () => {
  await xpay.queryWechatXPayOrder({ openId: 'mock-openid', outTradeNo: 'mock-order' });
  await xpay.queryWechatXPayOrder({ openId: 'mock-openid', outTradeNo: 'mock-order' }); assert.equal(stableCalls, 1);
});
let now = 0;
const ledger = new SandboxLedger({ now: () => now });
const order = ledger.create('tester', 'mock-openid', products[2]);
await check('未付/取消不发货', () => assert.equal(ledger.view(order).deliveries, 0));
await check('禁止跨账号查单', () => assert.throws(() => ledger.get(order.id, 'other')));
for (const mismatch of [{ env: 0 }, { openId: 'other' }, { productId: 'other' }, { quantity: 2 }, { actualPrice: 1 }]) await check('订单匹配拒绝 ' + Object.keys(mismatch)[0], () => assert.throws(() => ledger.match(order, { openId: order.openId, env: 1, productId: order.productId, quantity: 1, actualPrice: order.price, ...mismatch })));
await check('重复发货幂等', () => { ledger.deliver(order); ledger.deliver(order); assert.equal(order.deliveries, 1); });
await check('部分退款不被迟到发货覆盖', () => { ledger.refund(order, 100); ledger.deliver(order); assert.equal(order.status, 'partially_refunded'); });
await check('退款金额验证和不回退', () => { for (const fee of [0, -1, 201, 1.5, 50]) assert.throws(() => ledger.refund(order, fee)); });
await check('全额退款拒绝再发货', () => { ledger.refund(order, 200); assert.throws(() => ledger.deliver(order)); });
await check('24小时过期清理', () => { now = 86400001; assert.throws(() => ledger.get(order.id)); assert.equal(ledger.orders.size, 0); });
await check('单账号创建限频', () => { for (let i = 0; i < 4; i++) ledger.create('tester', 'mock-openid', products[2]); assert.throws(() => ledger.create('tester', 'mock-openid', products[2])); });
const payment = require(target + '/miniapp/pages/index/payment.js');
await check('原生支付按 success 回调等待', async () => assert.equal(await payment.requestVirtualPaymentAndWait(options => options.success('ok'), {}), 'ok'));
await check('原生 cancel 不视为成功', async () => { await assert.rejects(payment.requestVirtualPaymentAndWait(options => options.fail({ errCode: -2 }), {})); assert.equal(payment.isVirtualPaymentCancellation({ errCode: -2 }), true); });
await check('缺少原生API安全失败', async () => assert.rejects(payment.requestVirtualPaymentAndWait(undefined, {})));
let handler, persisted = '';
load(readFileSync(target + '/backend/server.cjs', 'utf8'), {
  'node:http': { createServer(fn) { handler = fn; return { listen() {} }; } },
  'node:fs': { readFileSync() { throw new Error('first run'); }, mkdirSync() {}, writeFileSync(path, text) { persisted = text; } },
  jsonwebtoken: { verify() { return { userId: 'tester' }; } },
  '/app/scripts/config/bootstrap-env.mjs': { bootstrapEnv: async () => ({ apollo: { cluster: 'dev' } }) },
});
await new Promise(resolve => setImmediate(resolve));
assert.ok(handler);
async function invoke(path, body, { signed = false, authenticated = true } = {}) {
  const query = signed ? '?' + new URLSearchParams({ timestamp: '123', nonce: 'mock', signature: crypto.createHash('sha1').update([env.WECHAT_XPAY_MESSAGE_TOKEN, '123', 'mock'].sort().join('')).digest('hex') }) : '';
  const jwtToken = require('jsonwebtoken').sign({ userId: 'tester' }, env.NEXTAUTH_SECRET, { algorithm: 'HS256' });
  const req = { url: '/api/payment/wechat/xpay/sandbox/' + path + query, method: 'POST', headers: { authorization: authenticated ? 'Bearer ' + jwtToken : '' }, async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(body)); } };
  const res = { writeHead(status) { this.status = status; }, end(value = '') { this.body = value ? JSON.parse(value) : null; } };
  await handler(req, res); return res;
}
let created;
await check('真实后端编译包沙箱建单/仅读数据库', async () => {
  const result = await invoke('create', { productId: 'ai_pack_200', loginCode: 'mock-code', price: 1 });
  assert.equal(result.status, 200); created = result.body.data;
  assert.equal(created.priceFen, 200); assert.equal(created.env, 1); assert.equal(created.realEntitlementsWritten, false);
});
await check('后端未登录拒绝建单', async () => assert.equal((await invoke('create', {}, { authenticated: false })).status, 400));
await check('客户端不能创建教练商品', async () => assert.equal((await invoke('create', { productId: 'coach' })).status, 400));
await check('后端查单拒绝金额不一致', async () => { upstreamFee = 1; assert.equal((await invoke('query', { orderId: created.orderId })).status, 400); upstreamFee = 200; });
await check('真实后端查单重复发货一次', async () => {
  for (let i = 0; i < 2; i++) { const result = await invoke('query', { orderId: created.orderId }); assert.equal(result.body.data.deliveries, 1); }
});
const delivered = { Event: 'xpay_goods_deliver_notify', OutTradeNo: created.orderId, openid: 'mock-openid', env: 1, GoodsInfo: { ProductId: 'ai_pack_200', Quantity: 1, OrigPrice: 200, ActualPrice: 200 } };
await check('回调验签拒绝伪造通知', async () => assert.equal((await invoke('notify', delivered)).status, 403));
await check('签名正确重复回调幂等', async () => {
  for (let i = 0; i < 2; i++) assert.equal((await invoke('notify', delivered, { signed: true })).status, 200);
  assert.equal(JSON.parse(persisted)[0].deliveries, 1);
});
await check('官方Env大写字段能正确发货', async () => {
  const { env: ignored, ...notification } = delivered;
  assert.equal((await invoke('notify', { ...notification, Env: 1 }, { signed: true })).status, 200);
});
await check('签名正确现网通知仍拒绝', async () => assert.equal((await invoke('notify', { ...delivered, env: 0 }, { signed: true })).status, 400));
await check('没有正式数据库写入', () => assert.equal(databaseWrites, 0));
await check('原业务发货路由接受官方Env/WeChatPayInfo', async () => {
  let grants = 0;
  const route = load(readFileSync('src/app/api/payment/wechat/xpay/notify/route.ts', 'utf8'), {
    'next/server': require('next/server'), '@/lib/wechatXPay': xpay,
    '@/app/api/payment/wechat/xpayOrder': {
      findXPayOrderByOutTradeNo: async () => ({ id: 'offline-only' }),
      validateXPayOrderMatch: (order, data) => { assert.equal(data.env, 1); assert.equal(data.openId, 'mock-openid'); },
      markXPayOrderPaid: async (order, data) => { grants++; assert.equal(data.transactionId, 'mock-transaction'); assert.equal(data.paidAt.getTime(), 1700000000000); },
      markXPayOrderRefunded: async () => { throw new Error('unexpected refund'); },
    },
  }, { Response });
  const values = { timestamp: '123', nonce: 'mock', signature: crypto.createHash('sha1').update([env.WECHAT_XPAY_MESSAGE_TOKEN, '123', 'mock'].sort().join('')).digest('hex') };
  const result = await route.POST({ nextUrl: new URL('https://mock.invalid/?' + new URLSearchParams(values)), json: async () => ({ ...delivered, OpenId: 'mock-openid', Env: 1, env: undefined, WeChatPayInfo: { PaidTime: 1700000000, TransactionId: 'mock-transaction' } }) });
  assert.equal(result.status, 200); assert.equal(grants, 1);
});
let page, nativeCalls = 0, pageEnv = 1, pageQueryStatus = 'paid';
const storage = new Map([['coachlink_xpay_sandbox_auth_v1', 'mocked-jwt']]);
const fakeWx = {
  getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key),
  getSystemInfoSync: () => ({ platform: 'android' }), login: options => options.success({ code: 'mock-code' }),
  requestVirtualPayment: options => { nativeCalls++; options.fail({ errCode: -2 }); },
  request(options) {
    let data;
    if (options.url.endsWith('/health')) data = { sandbox: true, realEntitlementsWritten: false };
    else if (options.url.endsWith('/create')) data = { success: true, data: { ...created, env: pageEnv, paymentParams: { ...created.paymentParams, signData: JSON.stringify({ ...JSON.parse(created.paymentParams.signData), env: pageEnv }) } } };
    else data = { success: true, data: { ...created, status: pageQueryStatus, deliveries: pageQueryStatus === 'paid' ? 1 : 0 } };
    options.success({ statusCode: 200, data });
  },
};
vm.runInNewContext(readFileSync('scripts/xpay-sandbox/miniapp/pages/index/index.js', 'utf8'), { require: id => id.includes('catalog') ? products : payment, wx: fakeWx, Page: definition => { page = definition; page.setData = data => Object.assign(page.data, data); } });
await page.onLoad();
await check('安卓页面取消状态和0发货', async () => { await page.pay(); assert.match(page.data.status, /已取消/); assert.equal(page.data.deliveries, 0); });
await check('安卓页面拒绝env=0进入收银台', async () => { const before = nativeCalls; pageEnv = 0; await page.pay(); assert.equal(nativeCalls, before); assert.match(page.data.status, /阻止付款/); pageEnv = 1; });
await check('原生success不等于付款成功', async () => { fakeWx.requestVirtualPayment = options => options.success({}); pageQueryStatus = 'pending'; await page.pay(); assert.match(page.data.status, /待支付/); assert.equal(page.data.deliveries, 0); });
await check('安卓页面查询确认发货1次', async () => { pageQueryStatus = 'paid'; await page.query(); assert.equal(page.data.deliveries, 1); assert.match(page.data.status, /已确认/); });
await check('测试登录退出清理独立storage', () => { page.logout(); assert.equal(storage.size, 0); });
writeFileSync(target + '/verification.json', JSON.stringify({ timestamp: new Date().toISOString(), passed: checks.length, checks, externalCalls: 0, realDatabaseWrites: databaseWrites, paymentSubmission: false, mode: 'offline mocks of real signing/backend/native callback code; not real phone payment' }, null, 2));
console.log(JSON.stringify({ passed: checks.length, realDatabaseWrites: databaseWrites, paymentSubmission: false }));
