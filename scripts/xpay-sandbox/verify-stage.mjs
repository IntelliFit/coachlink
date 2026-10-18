import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { SandboxLedger, isLiveTestOrderId } from './ledger.mjs';
const require = createRequire(import.meta.url);
const target = 'D:/cache/agent-tests/coachlink-xpay-20261011';
const checks = [];
async function check(name, callback) { await callback(); checks.push(name); }
const env = { NEXTAUTH_SECRET: 'mock-jwt', NEXT_SUPABASE_URL: 'https://mock.invalid', NEXT_SUPABASE_SERVICE_ROLE_KEY: 'mock-only', WECHAT_XPAY_OFFER_ID: '1450666974', WECHAT_XPAY_APP_KEY: 'mock-live', WECHAT_XPAY_SANDBOX: 'false', WECHAT_MINIAPP_APPID: 'wx316e39eb71c0e834', WECHAT_MINIAPP_SECRET: 'mock-secret', XPAY_TEST_STAGE: 'live', XPAY_TEST_DURABLE_STATE: 'true' };
let handler, state, pendingState, syncs = 0, nativeCalls = 0, status = 2, paidFee = 200, admin = true, queryId;
const transformed = ts.transpileModule(readFileSync(target + '/backend/server.cjs', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const fakeFs = {
  readFileSync() { if (state) return state; const error = new Error('new state'); error.code = 'ENOENT'; throw error; },
  writeFileSync(path, value) { pendingState = value; }, mkdirSync() {},
  renameSync() { state = pendingState; }, openSync() { return 1; }, closeSync() {}, fsyncSync() { syncs++; },
};
const fakeFetch = async (url, options = {}) => {
  if (String(url).includes('/rest/v1/')) { assert.ok(!options.method || options.method === 'GET'); return { ok: true, json: async () => [{ id: 'tester', is_admin: admin, wechat_openid: 'mock-openid' }] }; }
  if (String(url).includes('jscode2session')) return { ok: true, json: async () => ({ openid: 'mock-openid', session_key: 'mock-session' }) };
  if (String(url).endsWith('/cgi-bin/stable_token')) { assert.equal(JSON.parse(options.body).force_refresh, false); return { ok: true, json: async () => ({ access_token: 'mock-token', expires_in: 7200 }) }; }
  if (String(url).includes('/xpay/query_order')) { const body = JSON.parse(options.body); assert.equal(body.env, 0); return { ok: true, json: async () => ({ errcode: 0, order: { order_id: queryId ?? body.order_id, status, paid_fee: paidFee, refund_fee: 200, wx_order_id: 'mock-wx-order' } }) }; }
  throw new Error('Unexpected network');
};
function boot(values = env, cluster = 'main') {
  let caught = false;
  vm.runInNewContext(transformed, { exports: {}, module: { exports: {} }, process: { env: { ...values }, exitCode: 0 }, Buffer, URL, URLSearchParams, AbortSignal, fetch: fakeFetch, console: { log() {}, error() { caught = true; } }, require(id) {
    if (id === 'node:http') return { createServer(fn) { handler = fn; return { listen() {} }; } };
    if (id === 'node:fs') return fakeFs;
    if (id === '/app/scripts/config/bootstrap-env.mjs') return { bootstrapEnv: async () => ({ apollo: { cluster } }) };
    return require(id);
  } });
  return async () => { await new Promise(resolve => setImmediate(resolve)); return caught; };
}
await boot()();
assert.ok(handler);
const token = require('jsonwebtoken').sign({ userId: 'tester' }, env.NEXTAUTH_SECRET, { algorithm: 'HS256' });
async function invoke(path, body = {}, auth = true) {
  const req = { url: '/api/payment/wechat/xpay/live-test/' + path, method: path === 'health' ? 'GET' : 'POST', headers: { authorization: auth ? 'Bearer ' + token : '' }, async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(body)); } };
  const res = { writeHead(code) { this.code = code; }, end(text) { this.body = JSON.parse(text || '{}'); } };
  await handler(req, res); return res;
}
await check('env0 health and low-value SKU only', async () => { const res = await invoke('health'); assert.equal(res.body.env, 0); assert.equal(res.body.sandbox, false); assert.equal(res.body.cashTestOnly, true); assert.deepEqual(Array.from(res.body.enabledGoods), ['ai_pack_200']); });
await check('unauthenticated cash creation denied', async () => assert.equal((await invoke('create', {}, false)).code, 400));
await check('non-admin denied', async () => { admin = false; assert.equal((await invoke('create')).code, 400); admin = true; });
await check('explicit cash confirmation required', async () => { assert.equal((await invoke('create', { productId: 'ai_pack_200', loginCode: 'mock' })).code, 400); assert.equal(state, undefined); });
await check('membership/coach SKU rejected', async () => { for (const productId of ['m_basic_1990', 'coach', 'motion_p_290']) assert.equal((await invoke('create', { productId, confirmRealCharge: true })).code, 400); });
let order;
await check('cash signature env0 + durable atomic evidence', async () => { const res = await invoke('create', { productId: 'ai_pack_200', loginCode: 'mock', confirmRealCharge: true, price: 1 }); assert.equal(res.code, 200); order = res.body.data; assert.ok(isLiveTestOrderId(order.orderId)); const data = JSON.parse(order.paymentParams.signData); assert.equal(data.env, 0); assert.equal(data.goodsPrice, 200); assert.equal(JSON.parse(state)[0].id, order.orderId); assert.ok(syncs >= 2); });
await check('wrong cash order/fee rejected', async () => { queryId = 'other-order'; assert.equal((await invoke('query', { orderId: order.orderId })).code, 400); queryId = undefined; paidFee = 1; assert.equal((await invoke('query', { orderId: order.orderId })).code, 400); paidFee = 200; });
await check('real query confirmation never pretends fulfillment', async () => { for (let i = 0; i < 2; i++) { const res = await invoke('query', { orderId: order.orderId }); assert.equal(res.code, 200); assert.equal(res.body.data.status, 'paid'); assert.equal(res.body.data.deliveries, 0); assert.equal(res.body.data.realEntitlementsWritten, false); } });
await check('already paid test cannot generate another charge', async () => assert.equal((await invoke('create', { productId: 'ai_pack_200', loginCode: 'mock', confirmRealCharge: true })).code, 400));
await check('state survives restart', async () => { await boot()(); assert.equal((await invoke('query', { orderId: order.orderId })).code, 200); });
await check('cash callback does not acknowledge fictional delivery', async () => assert.equal((await invoke('notify')).code, 409));
await check('cash history never TTL-pruned', () => { let now = 0; const ledger = new SandboxLedger({ env: 0, now: () => now }); const entry = ledger.create('tester', 'open', { id: 'ai_pack_200', price: 200 }); now = 864000000; ledger.prune(); assert.equal(ledger.get(entry.id), entry); });
await check('sandbox/live bootstrap mismatch fails closed', async () => assert.equal(await boot({ ...env, WECHAT_XPAY_SANDBOX: 'true' })(), true));
await check('missing durable state fails closed', async () => assert.equal(await boot({ ...env, XPAY_TEST_DURABLE_STATE: 'false' })(), true));
await check('corrupt real records fail closed', async () => { const saved = state; state = '{}'; assert.equal(await boot()(), true); state = saved; });
let page, modalConfirm = false, pageEnv = 0;
const storage = new Map([['coachlink_xpay_live_test_auth_v1', 'mock-jwt']]);
const payment = require(target + '/miniapp-live/pages/index/payment.js');
const fakeWx = {
  getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key),
  getSystemInfoSync: () => ({ platform: 'android' }), login: options => options.success({ code: 'mock' }),
  showModal: options => options.success({ confirm: modalConfirm }), requestVirtualPayment: options => { nativeCalls++; options.fail({ errCode: -2 }); },
  request(options) { let data; if (options.url.endsWith('/health')) data = { sandbox: false, env: 0, cashTestOnly: true, realEntitlementsWritten: false };
    else if (options.url.endsWith('/create')) { assert.equal(options.data.confirmRealCharge, true); data = { success: true, data: { ...order, env: pageEnv, paymentParams: { ...order.paymentParams, signData: JSON.stringify({ ...JSON.parse(order.paymentParams.signData), env: pageEnv }) } } }; }
    else data = { success: true, data: { ...order, status: 'paid', deliveries: 0 } }; options.success({ statusCode: 200, data }); },
};
vm.runInNewContext(readFileSync(target + '/miniapp-live/pages/index/index.js', 'utf8'), { require: id => id.includes('stage') ? { live: true, env: 0 } : id.includes('catalog') ? [{ id: 'ai_pack_200', price: 200 }] : payment, wx: fakeWx, Page: value => { page = value; page.setData = data => Object.assign(page.data, data); } });
await page.onLoad();
await check('user declines real-charge warning: no native call', async () => { await page.pay(); assert.equal(nativeCalls, 0); });
await check('real client rejects sandbox signatures', async () => { modalConfirm = true; pageEnv = 1; await page.pay(); assert.equal(nativeCalls, 0); pageEnv = 0; });
await check('real cash order retained after native cancellation', async () => { await page.pay(); assert.equal(nativeCalls, 1); assert.equal(storage.get('coachlink_xpay_live_test_order_v1'), order.orderId); });
await check('query distinguishes payment from fulfillment', async () => { await page.query(); assert.match(page.data.status, /未发放/); assert.equal(page.data.deliveries, 0); });
writeFileSync(target + '/verification-live.json', JSON.stringify({ checks, passed: checks.length, externalCalls: 0, realDatabaseWrites: 0, realPayments: 0, timestamp: new Date().toISOString() }, null, 2));
console.log(JSON.stringify({ passed: checks.length, realPayments: 0 }));
