/** Experimental route survey. Review target mount side effects before using it. */
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const argv = process.argv.slice(2);
const opt = (name, fallback) => argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback;
const output = path.resolve(opt('--output', 'artifacts/uiux-audit/2026-10-03/deep-pages'));
const port = Number(opt('--port', '9420'));
const sdk = opt('--sdk', 'C:/Users/29454/AppData/Roaming/npm/node_modules/miniprogram-remote-control/node_modules/miniprogram-automator');
const targetsFile = path.resolve(opt('--targets', 'artifacts/uiux-audit/2026-10-03/browse-targets.json'));
const wait = ms => new Promise(r => setTimeout(r, ms));
function bounded(p, label, ms = 18000) {
  let t; return Promise.race([p, new Promise((_, reject) => { t = setTimeout(() => reject(new Error(`${label} timeout`)), ms); })]).finally(() => clearTimeout(t));
}
const manifest = { project: 'D:\\files\\coachlink\\apps\\wechat', appid: 'wx316e39eb71c0e834', port, experimental: true, startedAt: new Date().toISOString(), mockedData: false, submittedForms: false, steps: [] };
async function save() { await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2)); }
(async () => {
  let mini;
  try {
    if (port !== 9420) throw new Error('Use the dedicated CoachLink port 9420');
    const config = JSON.parse(await fs.readFile(path.join(manifest.project, 'project.config.json'), 'utf8'));
    if (config.appid !== manifest.appid) throw new Error('CoachLink AppID mismatch');
    const targets = JSON.parse(await fs.readFile(targetsFile, 'utf8'));
    await fs.mkdir(output, { recursive: true }); await save();
    const automator = require(sdk);
    const readyDeadline = Date.now() + 60000;
    while (Date.now() < readyDeadline) {
      let candidate;
      try {
        candidate = await bounded(automator.connect({ wsEndpoint: `ws://127.0.0.1:${port}` }), 'connect', 6000);
        const initial = await bounded(candidate.currentPage(), 'runtime ready', 6000);
        if (!initial?.path) throw new Error('No rendered page');
        mini = candidate; break;
      } catch { if (candidate) candidate.disconnect(); await wait(600); }
    }
    if (!mini) throw new Error('Runtime not ready after 60 seconds');
    manifest.runtimeAppId = await bounded(mini.evaluate(() => wx.getAccountInfoSync().miniProgram.appId), 'runtime AppID');
    if (manifest.runtimeAppId !== manifest.appid) throw new Error('Automation runtime belongs to another project');
    async function navigate(url) {
      await bounded(mini.redirectTo(url), 'navigation');
    }
    for (const target of targets) {
      const step = { number: manifest.steps.length + 1, ...target, visualReview: 'pending' };
      try {
        let page;
        if (target.from && target.tap) {
          await navigate('/' + target.from); await wait(target.originWait || 2500);
          page = await bounded(mini.currentPage(), 'origin route');
          if (page.path !== target.from) throw new Error(`Origin redirected to ${page.path}`);
          const el = await bounded(page.$(target.tap), 'find control');
          if (!el) throw new Error(`Missing real control ${target.tap}`);
          step.controlText = await bounded(el.text(), 'control text');
          await bounded(el.tap(), 'tap'); await wait(2500);
        } else {
          await navigate('/' + target.route);
        }
        page = await bounded(mini.currentPage(), 'actual route');
        step.actualRoute = page.path;
        const deadline = Date.now() + 22000;
        let stable = 0;
        while (Date.now() < deadline) {
          const roots = await bounded(page.$$('view'), 'roots');
          let busy = roots.length === 0;
          for (const selector of ['.loading-spinner', '.skeleton-list', '.skeleton']) {
            if ((await bounded(page.$$(selector), selector)).length) busy = true;
          }
          stable = busy ? 0 : stable + 1;
          if (stable >= 3) break;
          await wait(500);
        }
        step.loadingSettled = stable >= 3;
        await wait(target.wait || 1200);
        if (target.scrollSelector) {
          const scroll = await bounded(page.$(target.scrollSelector), 'scroll container');
          if (!scroll) throw new Error(`Missing scroll container ${target.scrollSelector}`);
          await bounded(scroll.scrollTo(0, target.scroll || 900), 'scroll container');
          await wait(900);
        } else if (target.scroll) { await bounded(mini.pageScrollTo(target.scroll), 'page scroll'); await wait(900); }
        const filename = `${String(step.number).padStart(2, '0')}-${(target.name || step.actualRoute).replace(/[^\w-]/g, '-')}.png`;
        step.screenshot = path.join(output, filename);
        await bounded(mini.screenshot({ path: step.screenshot }), 'screenshot');
        const b = await fs.readFile(step.screenshot);
        if (b.length < 2000 || b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid PNG');
        step.width = b.readUInt32BE(16); step.height = b.readUInt32BE(20);
        step.sha256 = crypto.createHash('sha256').update(b).digest('hex');
        step.bytes = b.length;
        const after = await bounded(mini.currentPage(), 'route after screenshot');
        if (after.path !== step.actualRoute) throw new Error('Route changed during screenshot');
        step.status = step.actualRoute === target.route?.split('?')[0] || !target.route ? 'captured' : 'redirected';
      } catch (e) { step.status = 'blocked'; step.error = e.message; }
      step.capturedAt = new Date().toISOString(); manifest.steps.push(step); await save();
      console.log(JSON.stringify({ number: step.number, route: step.actualRoute || target.route, status: step.status, error: step.error, file: step.screenshot }));
      if (manifest.steps.slice(-3).length === 3 && manifest.steps.slice(-3).every(s => s.status === 'blocked')) throw new Error('Repeated runtime failures; stop rather than continue issuing navigation');
    }
    await navigate('/pages/index/index');
    manifest.finished = true;
  } catch (e) { manifest.error = e.message; process.exitCode = 1; }
  finally {
    if (mini) mini.disconnect(); manifest.finishedAt = new Date().toISOString();
    await fs.mkdir(output, { recursive: true }); await save();
    process.stdout.write(`Manifest: ${path.join(output, 'manifest.json')}\n`, () => process.exit(process.exitCode || 0));
  }
})();
