// Real simulator interactions; no submitted points or changed business data.
const fs = require('node:fs/promises');
const path = require('node:path');
const automator = require(path.join(process.env.APPDATA, 'npm/node_modules/miniprogram-remote-control/node_modules/miniprogram-automator'));
const output = path.resolve(__dirname, '../artifacts/streetlifting-global/2026-10-03');
const manifest = { project: 'D:\\files\\coachlink\\apps\\wechat', port: 9420, submittedData: false, screenshots: [], passed: false };
let mini;
const bounded = (work, label, ms = 15000) => {
  let timer;
  return Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms); })]).finally(() => clearTimeout(timer));
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function element(page, selector) {
  const result = await bounded(page.$(selector), selector);
  if (!result) throw new Error(`${selector} is missing`);
  return result;
}
async function routeIs(route) {
  const deadline = Date.now() + 20000;
  let actual;
  do {
    const page = await bounded(mini.currentPage(), 'wait for route');
    actual = page?.path;
    if (actual === route) return page;
    await delay(300);
  } while (Date.now() < deadline);
  throw new Error(`Actual route ${actual} did not become ${route}`);
}
async function screenshot(filename, route) {
  const page = await bounded(mini.currentPage(), 'currentPage');
  if (page.path !== route) throw new Error(`Wrong screenshot route: ${page.path}`);
  const file = path.join(output, filename);
  await bounded(mini.screenshot({ path: file }), 'screenshot', 20000);
  const bytes = await fs.readFile(file);
  if (bytes.length < 2000 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid screenshot');
  manifest.screenshots.push({ file, route, bytes: bytes.length });
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  try {
    const projectConfig = JSON.parse(await fs.readFile(path.resolve(__dirname, '../apps/wechat/project.config.json'), 'utf8'));
    if (projectConfig.appid !== 'wx316e39eb71c0e834') throw new Error('Wrong project');
    mini = await bounded(automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' }), 'connect');
    await bounded(mini.reLaunch('/streetlifting/index/locations'), 'open locations');
    await delay(1600);
    let page = await routeIs('streetlifting/index/locations');
    await bounded((await element(page, '.btn-share-my-bar')).tap(), 'open form');
    await delay(500);
    await bounded((await element(page, '.country-input')).input('英国'), 'country input');
    const inputs = await bounded(page.$$('.dialog-box .input'), 'inputs');
    if (inputs.length < 5) throw new Error('Location form is incomplete');
    await bounded(inputs[1].input('London overseas preview'), 'name input');
    await bounded((await element(page, '.coordinate-action')).tap(), 'manual entry');
    await delay(300);
    await bounded((await element(page, '.latitude-input')).input('51.5074'), 'latitude');
    await bounded((await element(page, '.longitude-input')).input('-0.1278'), 'longitude');
    await bounded((await element(page, '.dialog-scroll')).scrollTo(0, 650), 'scroll coordinates');
    await screenshot('01-overseas-coordinate-form.png', page.path);
    const actions = await bounded(page.$$('.coordinate-action'), 'coordinate actions');
    await bounded(actions[1].tap(), 'preview map');
    await delay(2200);
    page = await routeIs('streetlifting/index/locations-map');
    const map = await element(page, '.locations-map');
    manifest.center = { latitude: Number(await bounded(map.property('latitude'), 'map latitude')), longitude: Number(await bounded(map.property('longitude'), 'map longitude')) };
    if (Math.abs(manifest.center.latitude - 51.5074) > 0.00001 || Math.abs(manifest.center.longitude + 0.1278) > 0.00001) throw new Error('Map does not center on the entered overseas coordinates');
    await screenshot('02-london-map-preview.png', page.path);
    await bounded((await element(page, '.locations-map-btn.primary')).tap(), 'world view');
    await delay(800);
    if (Number(await bounded(map.property('scale'), 'world scale')) !== 3) throw new Error('World view did not reset scale');
    await screenshot('03-world-view.png', page.path);
    await bounded(mini.navigateBack(), 'return form');
    page = await routeIs('streetlifting/index/locations');
    const longitude = await element(page, '.longitude-input');
    if (await bounded(longitude.property('value'), 'retained longitude') !== '-0.1278') throw new Error('Coordinate draft was lost on return');
    manifest.passed = true;
  } catch (error) { manifest.error = error.message; process.exitCode = 1; }
  finally {
    if (mini) { try { await bounded(mini.reLaunch('/pages/index/index'), 'restore home'); } catch {} mini.disconnect(); }
    await fs.writeFile(path.join(output, 'ui-manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify(manifest));
    process.exit(process.exitCode || 0);
  }
})();
