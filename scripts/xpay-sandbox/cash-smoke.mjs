import { writeFileSync } from 'node:fs';
const base = 'https://dev.coachlink.fit/api/payment/wechat/xpay/live-test';
const checks = [];
const health = await fetch(base + '/health', { signal: AbortSignal.timeout(10000) });
const info = await health.json();
checks.push({ name: 'env0 live cash health', passed: health.status === 200 && info.env === 0 && info.sandbox === false && info.cashTestOnly === true && info.realEntitlementsWritten === false && info.enabledGoods.length === 1 && info.enabledGoods[0] === 'ai_pack_200' });
for (const route of ['create', 'query']) {
  const response = await fetch(base + '/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000) });
  checks.push({ name: 'unauthenticated ' + route + ' denied', passed: response.status === 400 && (await response.json()).success === false });
}
const notify = await fetch(base + '/notify', { signal: AbortSignal.timeout(10000) });
checks.push({ name: 'no fictional goods acknowledgment', passed: notify.status === 409 });
const previous = await fetch('https://dev.coachlink.fit/api/payment/wechat/xpay/sandbox/health', { signal: AbortSignal.timeout(10000) });
checks.push({ name: 'old sandbox client fails closed', passed: previous.status >= 400 });
const main = await fetch('https://coachlink.fit/api/payment/wechat/xpay/notify', { signal: AbortSignal.timeout(10000) });
checks.push({ name: 'main public callback still authenticates requests', passed: main.status === 403 });
const output = { checks, passed: checks.filter(p => p.passed).length, realOrdersCreated: 0, realPayments: 0, realEntitlementsWritten: false, timestamp: new Date().toISOString() };
writeFileSync('D:/cache/agent-tests/coachlink-xpay-20261011/cash-live-results.json', JSON.stringify(output, null, 2));
console.log(JSON.stringify(output));
if (checks.some(p => !p.passed)) process.exitCode = 1;
