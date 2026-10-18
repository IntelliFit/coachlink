const fs = require('node:fs');
const assert = require('node:assert/strict');
const automator = require('C:/Users/29454/AppData/Roaming/npm/node_modules/miniprogram-remote-control/node_modules/miniprogram-automator');
const target = 'D:/cache/agent-tests/coachlink-xpay-20261011';
fs.mkdirSync(target + '/evidence', { recursive: true });
let mini, savedAuth, authRead = false;
const mocked = [];
const results = { project: target + '/miniapp', appId: 'wx316e39eb71c0e834', port: 9421, screenshots: [], checks: [], restored: false };
const deadline = (promise, name, ms = 18000) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(name + ' timed out')), ms); })]).finally(() => clearTimeout(timer));
};
async function mock(method, implementation) { await deadline(mini.mockWxMethod(method, implementation), 'mock ' + method); mocked.push(method); }
(async () => {
  try {
    mini = await deadline(automator.connect({ wsEndpoint: 'ws://127.0.0.1:9421' }), 'connect');
    const page = await deadline(mini.currentPage(), 'currentPage');
    assert.equal(page.path, 'pages/index/index');
    assert.equal((await deadline(page.data('products'), 'catalog')).length, 8);
    results.checks.push('rendered 8-item catalog on exact sandbox route');
    await deadline(mini.screenshot({ path: target + '/evidence/01-sandbox-ready.png' }), 'screenshot'); results.screenshots.push('01-sandbox-ready.png');
    savedAuth = await deadline(mini.callWxMethod('getStorageSync', 'coachlink_xpay_sandbox_auth_v1'), 'read own auth storage'); authRead = true;
    await deadline(mini.callWxMethod('setStorageSync', 'coachlink_xpay_sandbox_auth_v1', 'offline-ui-test'), 'set own test auth');
    await mock('login', { code: 'offline-ui-code' });
    await mock('request', options => {
      const product = options.data?.productId || 'ai_pack_200';
      const orderId = 'xpaysbx_' + 'a'.repeat(24);
      if (options.url.endsWith('/create')) return { statusCode: 200, data: { success: true, data: {
        orderId, env: 1, paymentParams: { mode: 'short_series_goods', paySig: 'offline-test', signature: 'offline-test',
          signData: JSON.stringify({ offerId: '1450666974', env: 1, productId: product, goodsPrice: 200, buyQuantity: 1, outTradeNo: orderId }) }
      } } };
      if (options.url.endsWith('/query')) return { statusCode: 200, data: { success: true, data: { orderId, env: 1, realEntitlementsWritten: false, status: 'paid', deliveries: 1 } } };
      return { statusCode: 200, data: { sandbox: true, realEntitlementsWritten: false } };
    });
    // Mock callback failure explicitly; no real payment is submitted by the agent.
    await mock('requestVirtualPayment', options => { options.fail({ errCode: -2, errMsg: 'requestVirtualPayment:fail cancel' }); });
    await deadline(page.setData({ loggedIn: true, ready: true, busy: false, selected: 2 }), 'test readiness');
    await deadline((await page.$('#pay')).tap(), 'tap sandbox pay');
    await deadline(page.waitFor(async () => /已取消/.test(await page.data('status'))), 'cancel state');
    assert.equal(await page.data('deliveries'), 0);
    results.checks.push('tap pay -> mocked native cancel -> no delivery');
    await deadline(mini.screenshot({ path: target + '/evidence/02-cancel-no-delivery.png' }), 'cancel screenshot'); results.screenshots.push('02-cancel-no-delivery.png');
    await deadline((await page.$('#query')).tap(), 'tap query');
    await deadline(page.waitFor(async () => (await page.data('deliveries')) === 1), 'query receipt');
    await deadline((await page.$('#query')).tap(), 'repeat query');
    assert.equal(await page.data('deliveries'), 1);
    results.checks.push('tap query twice -> mocked server paid -> one receipt');
    await deadline(mini.screenshot({ path: target + '/evidence/03-query-one-receipt.png' }), 'receipt screenshot'); results.screenshots.push('03-query-one-receipt.png');
    results.success = true;
  } catch (error) { results.error = error.message; process.exitCode = 1; }
  finally {
    if (mini) {
      try {
        for (const method of mocked.reverse()) await deadline(mini.restoreWxMethod(method), 'restore ' + method, 5000);
        if (authRead) {
          if (savedAuth) await deadline(mini.callWxMethod('setStorageSync', 'coachlink_xpay_sandbox_auth_v1', savedAuth), 'restore auth', 5000);
          else await deadline(mini.callWxMethod('removeStorageSync', 'coachlink_xpay_sandbox_auth_v1'), 'remove own test auth', 5000);
        }
        await deadline(mini.reLaunch('/pages/index/index'), 'restore live test page', 5000);
        results.restored = true;
      } catch (error) { results.cleanupError = error.message; }
      mini.disconnect();
    }
    fs.writeFileSync(target + '/ui-verification.json', JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
    // Close only this script, never the IDE or another project's processes.
    setTimeout(() => process.exit(process.exitCode || 0), 200);
  }
})();
