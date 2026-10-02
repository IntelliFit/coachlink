// Real UI path with overseas search. Never submits or creates a business point.
const fs = require('node:fs/promises');
const path = require('node:path');
const automator = require(path.join(process.env.APPDATA, 'npm/node_modules/miniprogram-remote-control/node_modules/miniprogram-automator'));
const output = path.resolve(__dirname, '../artifacts/streetlifting-global/2026-10-03/picker');
const pickerOnly = process.argv.includes('--picker-only');
const manifest = { project: 'D:\\files\\coachlink\\apps\\wechat', port: 9420, submittedData: false, screenshots: [], passed: false };
manifest.scope = pickerOnly ? 'overseas search and map center; form return not verified' : 'search, map center and auto-filled form';
let mini, token, previousDraft, userId;
const bounded = (work, label, ms = 12000) => {
  let timer;
  return Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms); })]).finally(() => clearTimeout(timer));
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function element(page, selector) {
  const deadline = Date.now() + 8000;
  do {
    const result = await bounded(page.$(selector), selector);
    if (result) return result;
    await delay(250);
  } while (Date.now() < deadline);
  throw new Error(`${selector} is missing`);
}
async function routeIs(route) {
  const deadline = Date.now() + 15000;
  let actual;
  do {
    const page = await bounded(mini.currentPage(), 'currentPage');
    actual = page?.path;
    if (actual === route) return page;
    await delay(300);
  } while (Date.now() < deadline);
  throw new Error(`Actual route ${actual} did not become ${route}`);
}
async function screenshot(fileName, route) {
  const page = await bounded(mini.currentPage(), 'screenshot route');
  if (page.path !== route) throw new Error(`Wrong screenshot route: ${page.path}`);
  const file = path.join(output, fileName);
  await bounded(mini.screenshot({ path: file }), 'screenshot', 15000);
  const bytes = await fs.readFile(file);
  if (bytes.length < 2000 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid PNG');
  manifest.screenshots.push({ file, route, bytes: bytes.length });
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  try {
    manifest.stage = 'connect and verify existing runtime';
    mini = await bounded(automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' }), 'connect');
    const identity = await bounded(mini.evaluate(() => ({ appId: wx.getAccountInfoSync().miniProgram.appId, userId: wx.getStorageSync('user')?.id || '', token: wx.getStorageSync('token') || '' })), 'runtime identity');
    if (identity.appId !== 'wx316e39eb71c0e834') throw new Error('Wrong runtime AppID');
    token = identity.token; userId = identity.userId;
    if (!token || !userId) throw new Error('No existing authenticated mini-program session');
    // Keep credentials in memory only. Read-only local API evidence has no tokens.
    manifest.stage = 'read-only authenticated search API';
    const response = await fetch('http://127.0.0.1:3001/api/streetlifting-index/locations/search-places', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ query: 'Yoyogi Park' }), signal: AbortSignal.timeout(20000) });
    const body = await response.json();
    if (!response.ok || !body.success || !body.data?.length) throw new Error(`Local search API failed (${response.status})`);
    manifest.searchApi = { status: response.status, first: body.data[0] };
    previousDraft = await bounded(mini.evaluate((id) => wx.getStorageSync('streetlifting_location_cache_v1')?.[`draft:${id}`] || null, userId), 'read existing draft');
    manifest.stage = 'open location form';
    let page;
    if (pickerOnly) {
      manifest.stage = 'open picker directly';
      await bounded(mini.navigateTo('/streetlifting/index/locations-map?mode=pick'), 'open picker directly');
    } else {
      await bounded(mini.reLaunch('/streetlifting/index/locations'), 'open locations');
      await delay(1200);
      page = await routeIs('streetlifting/index/locations');
      await bounded((await element(page, '.btn-share-my-bar')).tap(), 'open form');
      const pickerEntry = await element(page, '.map-picker-entry');
      manifest.stage = 'open search/map picker';
      await screenshot('00-search-picker-form.png', page.path);
      await bounded(pickerEntry.tap(), 'open map picker');
    }
    page = await routeIs('streetlifting/index/locations-map');
    await bounded((await element(page, '.locations-map-search-input')).input('Yoyogi Park'), 'search input');
    await bounded((await element(page, '.search-places-btn')).tap(), 'search');
    manifest.stage = 'wait for visible overseas search candidates';
    const deadline = Date.now() + 16000;
    let result;
    do { result = await bounded(page.$('.locations-map-search-result'), 'search result'); if (result) break; await delay(300); } while (Date.now() < deadline);
    if (!result) throw new Error('No visible search result');
    await screenshot('01-overseas-search-results.png', page.path);
    await bounded(result.tap(), 'select searched place');
    manifest.stage = 'verify map center';
    await delay(750);
    const map = await element(page, '.locations-map');
    manifest.center = { latitude: Number(await bounded(map.property('latitude'), 'map latitude')), longitude: Number(await bounded(map.property('longitude'), 'map longitude')) };
    if (Math.abs(manifest.center.latitude - manifest.searchApi.first.latitude) > 0.0001 || Math.abs(manifest.center.longitude - manifest.searchApi.first.longitude) > 0.0001) throw new Error('Search selection did not position the map');
    await screenshot('02-search-map-position.png', page.path);
    await bounded((await element(page, '.select-map-center')).tap(), 'choose map center');
    await delay(300);
    if (pickerOnly) {
      const markers = await bounded(map.property('markers'), 'selected marker');
      if (markers?.length !== 1 || Math.abs(markers[0].latitude - manifest.center.latitude) > 0.0001 || Math.abs(markers[0].longitude - manifest.center.longitude) > 0.0001) throw new Error('Center selection marker does not match the searched location');
      await screenshot('03-map-center-selection.png', page.path);
      manifest.passed = true;
      manifest.stage = 'picker-only completed; form return pending';
      return;
    }
    await bounded((await element(page, '.confirm-map-position')).tap(), 'confirm point');
    manifest.stage = 'verify auto-filled form';
    page = await routeIs('streetlifting/index/locations');
    if (await bounded((await element(page, '.country-input')).property('value'), 'auto country') !== '日本') throw new Error('Country was not filled automatically');
    if (await bounded(page.$('.latitude-input'), 'manual input hidden')) throw new Error('Manual coordinates opened as the default flow');
    const selection = await bounded(mini.evaluate((id) => wx.getStorageSync('streetlifting_location_cache_v1')?.[`draft:${id}`]?.value, userId), 'selected draft');
    if (Math.abs(selection?.latitude - manifest.center.latitude) > 0.0001 || Math.abs(selection?.longitude - manifest.center.longitude) > 0.0001) throw new Error('Confirmed coordinates were not returned to the form');
    if (selection.coordinate_system !== 'gcj02') throw new Error('Map center selection was not recorded with its native coordinate source');
    manifest.returnedSelection = { latitude: selection.latitude, longitude: selection.longitude, country: selection.country, coordinate_system: selection.coordinate_system };
    await screenshot('03-auto-filled-form.png', page.path);
    manifest.passed = true;
    manifest.stage = 'completed';
  } catch (error) { manifest.error = error.message; process.exitCode = 1; }
  finally {
    if (mini) {
      if (!pickerOnly && userId && previousDraft !== undefined) {
        try { await bounded(mini.evaluate((id, draft) => { const cache = wx.getStorageSync('streetlifting_location_cache_v1') || {}; if (draft) cache[`draft:${id}`] = draft; else delete cache[`draft:${id}`]; wx.setStorageSync('streetlifting_location_cache_v1', cache); }, userId, previousDraft), 'restore original draft'); } catch (error) { manifest.cleanupError = error.message; manifest.passed = false; process.exitCode = 1; }
      }
      try { await bounded(mini.reLaunch('/pages/index/index'), 'return home'); } catch {}
      mini.disconnect();
    }
    token = null;
    await fs.writeFile(path.join(output, pickerOnly ? 'picker-only-manifest.json' : 'ui-manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify(manifest));
    process.exit(process.exitCode || 0);
  }
})();
