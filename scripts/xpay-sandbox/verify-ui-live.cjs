const fs = require('node:fs');
const automator = require('C:/Users/29454/AppData/Roaming/npm/node_modules/miniprogram-remote-control/node_modules/miniprogram-automator');
const root = 'D:/cache/agent-tests/coachlink-xpay-20261011';
let mini;
const result = { project: root + '/miniapp', appId: 'wx316e39eb71c0e834', port: 9421, stage: 'live', uiVerified: false, newWindows: 0, paymentSubmitted: false, mockWrites: 0 };
(async () => {
  try {
    mini = await Promise.race([automator.connect({ wsEndpoint: 'ws://127.0.0.1:9421' }), new Promise((_, reject) => setTimeout(() => reject(new Error('connection timed out; no reusable matching automation window')), 4000))]);
    const page = await mini.currentPage();
    if (page.path !== 'pages/index/index' || await page.data('live') !== true) throw new Error('Not the live test project; no interaction performed');
    await mini.screenshot({ path: root + '/evidence/live-ready.png' });
    result.uiVerified = true;
  } catch (error) { result.reason = error.message; }
  finally {
    if (mini) await mini.disconnect();
    result.released = true;
    fs.writeFileSync(root + '/ui-verification-live.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    process.exit(0);
  }
})();
