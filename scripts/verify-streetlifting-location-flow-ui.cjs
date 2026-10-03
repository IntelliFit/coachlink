// Real local DevTools path. Reads the live API; never submits a bar or uploads photos.
const fs = require('node:fs/promises');
const path = require('node:path');
const automator = require(path.join(process.env.APPDATA, 'npm/node_modules/miniprogram-remote-control/node_modules/miniprogram-automator'));
const output = path.resolve(__dirname, '../artifacts/streetlifting-ux/2026-10-03');
const report = { project: 'D:\\files\\coachlink\\apps\\wechat', port: 9420, submitted: false, passed: false, screenshots: [] };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const bounded = (work, label, ms = 15000) => {
  let timer;
  return Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms); })]).finally(() => clearTimeout(timer));
};
let mini, userId, previous, originalRoute;
async function routeIs(route) {
  for (let i = 0; i < 25; i++) {
    const page = await bounded(mini.currentPage(), 'currentPage');
    if (page?.path === route) return page;
    await delay(300);
  }
  throw new Error(`Did not reach ${route}`);
}
async function element(page, selector) {
  for (let i = 0; i < 20; i++) {
    const el = await bounded(page.$(selector), selector);
    if (el) return el;
    await delay(300);
  }
  throw new Error(`Missing ${selector}`);
}
async function screenshot(name, route) {
  const page = await bounded(mini.currentPage(), 'screenshot route');
  if (page?.path !== route) throw new Error(`Wrong screenshot route ${page?.path}`);
  const file = path.join(output, name);
  await bounded(mini.screenshot({ path: file }), 'screenshot', 18000);
  const bytes = await fs.readFile(file);
  if (bytes.length < 2000 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid screenshot');
  report.screenshots.push({ file, route, bytes: bytes.length });
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  try {
    report.stage = 'connect';
    mini = await bounded(automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' }), 'connect');
    const identity = await bounded(mini.evaluate(() => ({ appId: wx.getAccountInfoSync().miniProgram.appId, userId: wx.getStorageSync('user')?.id || '', authenticated: Boolean(wx.getStorageSync('token')) })), 'identity');
    if (identity.appId !== 'wx316e39eb71c0e834') throw new Error('Wrong AppID');
    if (!identity.userId || !identity.authenticated) throw new Error('An existing logged-in session is required; auth will not be changed');
    userId = identity.userId;
    originalRoute = (await bounded(mini.currentPage(), 'original page'))?.path;
    const backup = await bounded(mini.evaluate(id => { const cache = wx.getStorageSync('streetlifting_location_cache_v1') || {}; return { draft: cache[`draft:${id}`] || null, location: cache[`last-user-location:${id}`] || null, pickerKeys: Object.keys(cache).filter(k => k.startsWith(`picker:${id}:`)) }; }, userId), 'preserve location cache');
    if (!backup || !Array.isArray(backup.pickerKeys)) throw new Error('Cannot back up user draft; no storage changes will be made');
    // Remove only the exact draft left by this script's earlier failed run.
    try {
      const prior = JSON.parse(await fs.readFile(path.join(output, 'runtime-draft-after-ui.json'), 'utf8'));
      if (prior.userId === userId && prior.draft && JSON.stringify(prior.draft) === JSON.stringify(backup.draft)) { backup.draft = null; report.clearedPriorTestDraft = true; }
    } catch {}
    previous = backup;
    await bounded(mini.evaluate(id => { const cache = wx.getStorageSync('streetlifting_location_cache_v1') || {}; delete cache[`draft:${id}`]; delete cache[`last-user-location:${id}`]; wx.setStorageSync('streetlifting_location_cache_v1', cache); }, userId), 'isolate draft');
    report.stage = 'browse initial map';
    await bounded(mini.reLaunch('/streetlifting/index/locations-map'), 'browse map');
    let page = await routeIs('streetlifting/index/locations-map');
    const map = await element(page, '.locations-map');
    await delay(1500);
    report.initialMap = { latitude: Number(await bounded(map.property('latitude'), 'latitude')), longitude: Number(await bounded(map.property('longitude'), 'longitude')), scale: Number(await bounded(map.property('scale'), 'scale')) };
    if (Math.abs(report.initialMap.longitude) < 25 && report.initialMap.latitude < 30) throw new Error('Map still defaults to Africa');
    await screenshot('01-browse-default.png', page.path);
    const hasLocationPermission = await bounded(mini.evaluate(() => new Promise(resolve => wx.getSetting({ success: res => resolve(Boolean(res.authSetting['scope.userFuzzyLocation'])), fail: () => resolve(false) }))), 'existing location permission');
    if (hasLocationPermission) {
      const toolbar = await bounded(page.$$('.locations-map-toolbar .locations-map-btn'), 'locate toolbar');
      await bounded(toolbar[1].tap(), 'locate nearby');
      await delay(2000);
      await bounded(toolbar[1].tap(), 'repeat locate nearby');
      await delay(750);
      report.locateScales = [];
      for (let i = 0; i < 5; i++) { report.locateScales.push(Number(await bounded(map.property('scale'), 'stable locate scale'))); await delay(1000); }
      if (report.locateScales.some(scale => scale !== 13)) throw new Error('Locate zoom did not remain stable at 13');
      await screenshot('01b-locate-stable.png', page.path);
    } else report.locateVerification = 'No existing fuzzy-location permission; no permission prompt or mock was used';
    report.stage = 'country facet and first step';
    await bounded(mini.reLaunch('/streetlifting/index/locations'), 'locations list');
    page = await routeIs('streetlifting/index/locations');
    await delay(1200);
    const pickers = await bounded(page.$$('picker'), 'country pickers');
    const ranges = await Promise.all(pickers.map(picker => bounded(picker.property('range'), 'picker range')));
    if (!ranges.some(range => Array.isArray(range) && range.includes('全部国家/地区') && range.includes('中国'))) throw new Error('China missing from filter');
    await bounded((await element(page, '.btn-share-my-bar')).tap(), 'share bar');
    await element(page, '.location-start');
    if (await bounded(page.$('.country-input'), 'no upfront country')) throw new Error('Country is still an upfront field');
    await screenshot('02-select-first.png', page.path);
    report.stage = 'search overseas';
    await bounded((await element(page, '.map-picker-entry')).tap(), 'open picker');
    page = await routeIs('streetlifting/index/locations-map');
    await bounded((await element(page, '.locations-map-search-input')).input('Yoyogi Park'), 'type place');
    await bounded((await element(page, '.search-places-btn')).tap(), 'search place');
    const result = await element(page, '.locations-map-search-result');
    await screenshot('03-overseas-results.png', page.path);
    await bounded(result.tap(), 'select place');
    await delay(3000);
    const pickerMap = await element(page, '.locations-map');
    report.selectedMap = { latitude: Number(await bounded(pickerMap.property('latitude'), 'selected latitude')), longitude: Number(await bounded(pickerMap.property('longitude'), 'selected longitude')) };
    if (Math.abs(report.selectedMap.latitude - 35.67) > 0.1 || Math.abs(report.selectedMap.longitude - 139.69) > 0.1) throw new Error('Did not reach Tokyo');
    await screenshot('04-picked-place.png', page.path);
    report.stage = 'return selected address';
    await bounded((await element(page, '.confirm-map-position')).tap(), 'confirm point');
    page = await routeIs('streetlifting/index/locations');
    const summary = await element(page, '.location-selected-address');
    report.returnedAddress = await bounded(summary.text(), 'returned address');
    if (!report.returnedAddress.includes('日本')) throw new Error('Japan not returned');
    await element(page, '.location-name-input');
    if (await bounded(page.$('.country-input'), 'collapsed country')) throw new Error('Successful auto-address still requires manual country');
    const draft = await bounded(mini.evaluate(id => wx.getStorageSync('streetlifting_location_cache_v1')?.[`draft:${id}`]?.value, userId), 'returned draft');
    if (draft?.country !== '日本' || draft.coordinate_system !== 'wgs84') throw new Error('Wrong returned metadata/source');
    if (Math.abs(draft.latitude - report.selectedMap.latitude) > 0.00001 || Math.abs(draft.longitude - report.selectedMap.longitude) > 0.00001) throw new Error('Saved draft moved from selected position');
    await screenshot('05-address-returned.png', page.path);
    // Reopening the same selected point must preserve its auto-filled address.
    await bounded((await element(page, '.map-picker-entry')).tap(), 'reopen selected position');
    page = await routeIs('streetlifting/index/locations-map');
    report.reopenedOptions = await bounded(mini.evaluate(() => { const pages = getCurrentPages(); return pages[pages.length - 1]?.options; }), 'picker page options');
    report.reopenedRequest = await bounded(mini.evaluate(id => { const cache = wx.getStorageSync('streetlifting_location_cache_v1') || {}; const keys = Object.keys(cache).filter(k => k.startsWith(`picker:${id}:`)); return keys.map(key => ({ key, value: cache[key]?.value })); }, userId), 'initial picker metadata');
    if (Object.keys(report.reopenedOptions || {}).some(key => !['mode', 'selectionKey'].includes(key)) || !report.reopenedRequest.some(request => request.value?.initial?.address === draft.address)) throw new Error('Runtime still uses stale picker code; inspect compile cache before changing source');
    await delay(800);
    report.reopenedAddress = await bounded((await element(page, '.locations-map-selected-address')).text(), 'reopened address');
    await bounded((await element(page, '.confirm-map-position')).tap(), 'confirm unchanged position');
    page = await routeIs('streetlifting/index/locations');
    await delay(800);
    const unchangedAddress = await bounded((await element(page, '.location-selected-address')).text(), 'unchanged address');
    report.unchangedAddress = unchangedAddress;
    if (unchangedAddress !== report.returnedAddress) throw new Error('Reconfirming the same position erased its address');
    report.samePositionPreservesAddress = true;
    report.passed = true;
    report.stage = 'completed';
  } catch (error) { report.error = error.message; report.errorStack = error.stack; process.exitCode = 1; }
  finally {
    if (mini && previous && userId) {
      try {
        await bounded(mini.evaluate((id, old) => {
          const cache = wx.getStorageSync('streetlifting_location_cache_v1') || {};
          for (const key of Object.keys(cache)) if (key.startsWith(`picker:${id}:`) && !old.pickerKeys.includes(key)) delete cache[key];
          if (old.draft) cache[`draft:${id}`] = old.draft; else delete cache[`draft:${id}`];
          if (old.location) cache[`last-user-location:${id}`] = old.location; else delete cache[`last-user-location:${id}`];
          wx.setStorageSync('streetlifting_location_cache_v1', cache);
        }, userId, previous), 'restore original draft');
        report.restoredDraft = true;
      } catch (error) { report.cleanupError = error.message; report.passed = false; process.exitCode = 1; }
    }
    if (mini) { if (originalRoute) { try { await bounded(mini.reLaunch(`/${originalRoute}`), 'return original page'); } catch {} } mini.disconnect(); }
    await fs.writeFile(path.join(output, 'ui-manifest.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    process.exit(process.exitCode || 0);
  }
})();
