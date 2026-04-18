const automator = require('/Users/kirigaya/.nvm/versions/node/v24.14.0/lib/node_modules/miniprogram-remote-control/node_modules/miniprogram-automator');
const path = require('path');
const fs = require('fs');

async function main() {
  const outputDir = '/Users/kirigaya/project/coachlink/screenshots/weapp-verify';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  console.log('Connecting to ws://localhost:9420 ...');
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420', connectTimeout: 30000 });
  console.log('Connected!');

  // Mock network requests
  console.log('Mocking wx.request...');
  await mp.mockWxMethod('request', { data: {}, statusCode: 200, header: {} });

  // 1. Screenshot current page
  const page = await mp.currentPage();
  console.log('Current page:', page.path);
  await page.waitFor(3000);
  
  console.log('Taking screenshot 1...');
  const result1 = await mp.screenshot();
  const buf1 = Buffer.from(result1, 'base64');
  fs.writeFileSync(path.join(outputDir, '01-training-tab.png'), buf1);
  console.log('✅ 01-training-tab.png saved');

  // 2. Switch to profile tab
  console.log('Switching to profile tab...');
  await mp.switchTab('/me/profile/index');
  await page.waitFor(3000);
  console.log('Taking screenshot 2...');
  const result2 = await mp.screenshot();
  const buf2 = Buffer.from(result2, 'base64');
  fs.writeFileSync(path.join(outputDir, '02-profile-tab.png'), buf2);
  console.log('✅ 02-profile-tab.png saved');

  // 3. Switch to home tab
  console.log('Switching to home tab...');
  await mp.switchTab('/pages/index/index');
  await page.waitFor(3000);
  console.log('Taking screenshot 3...');
  const result3 = await mp.screenshot();
  const buf3 = Buffer.from(result3, 'base64');
  fs.writeFileSync(path.join(outputDir, '03-home-tab.png'), buf3);
  console.log('✅ 03-home-tab.png saved');

  // 4. Relaunch to login page
  console.log('Relaunching to login page...');
  await mp.reLaunch('/auth/login/index');
  await page.waitFor(3000);
  console.log('Taking screenshot 4...');
  const result4 = await mp.screenshot();
  const buf4 = Buffer.from(result4, 'base64');
  fs.writeFileSync(path.join(outputDir, '04-login-page.png'), buf4);
  console.log('✅ 04-login-page.png saved');

  await mp.disconnect();
  console.log('All screenshots saved to', outputDir);
}

main().catch(e => { console.error(e); process.exit(1); });
