import { createHash } from 'node:crypto';
import { bootstrapEnv } from '/app/scripts/config/bootstrap-env.mjs';
await bootstrapEnv({ mode: 'production', projectRoot: '/app' });
const base = 'https://dev.coachlink.fit/api/payment/wechat/xpay/sandbox';
const results = [];
const health = await fetch(base + '/health', { signal: AbortSignal.timeout(10000) });
const data = await health.json();
results.push({ check: 'live sandbox health', status: health.status, sandbox: data.sandbox, goods: data.goods, realEntitlementsWritten: data.realEntitlementsWritten });
for (const endpoint of ['create', 'query']) {
  const response = await fetch(base + '/' + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000) });
  results.push({ check: 'unauthenticated ' + endpoint + ' denied', status: response.status, success: (await response.json()).success });
}
const unsigned = await fetch(base + '/notify', { signal: AbortSignal.timeout(10000) });
results.push({ check: 'unsigned sandbox callback denied', status: unsigned.status });
const timestamp = String(Math.floor(Date.now() / 1000)), nonce = 'sandbox-smoke';
const signature = createHash('sha1').update([process.env.WECHAT_XPAY_MESSAGE_TOKEN, timestamp, nonce].sort().join('')).digest('hex');
for (const url of [base + '/notify', 'https://coachlink.fit/api/payment/wechat/xpay/notify']) {
  const response = await fetch(url + '?' + new URLSearchParams({ timestamp, nonce, signature, echostr: 'sandbox-live-echo' }), { signal: AbortSignal.timeout(10000) });
  results.push({ check: url.includes('/sandbox/') ? 'signed sandbox URL handshake' : 'main URL handshake preserved / dev token compatible', status: response.status, echoMatches: (await response.text()) === 'sandbox-live-echo' });
}
console.log(JSON.stringify({ results, realOrdersCreated: 0, databaseWrites: 0, paymentSubmitted: false }));
if (results.some(row => row.check.includes('health') ? row.status !== 200 || !row.sandbox : row.check.includes('handshake') ? row.status !== 200 || !row.echoMatches : row.status < 400)) process.exitCode = 1;
