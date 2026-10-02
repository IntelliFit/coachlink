/** Capture real WeChat UI through the official SDK. No input injection or mocks. */
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const argv = process.argv.slice(2);
function option(name, fallback) {
  const i = argv.indexOf(name);
  if (i < 0) return fallback;
  if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Missing value for ${name}`);
  return argv[i + 1];
}
const project = path.resolve(option('--project', path.join(__dirname, '..', 'apps', 'wechat')));
const output = path.resolve(option('--output', path.join(__dirname, '..', 'artifacts', 'uiux-audit', new Date().toISOString().slice(0, 10), `run-${Date.now()}`)));
const cli = option('--cli', process.env.WECHAT_DEVTOOLS_CLI || 'D:/software/微信web开发者工具/cli.bat');
const port = Number(option('--port', '9420'));
const cycles = Number(option('--cycles', '2'));
const sdkLocation = option('--sdk', process.env.WEAPP_AUTOMATOR_PATH || path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', 'miniprogram-remote-control', 'node_modules', 'miniprogram-automator'));
const pages = [
  { route: 'pages/index/index', label: '训练', root: '.nav-item' },
  { route: 'discovery/index', label: '教练', root: '.discovery-page' },
  { route: 'content/knowledge', label: '知识', root: '.knowledge-page' },
  { route: 'toolbox/index', label: '工具箱', root: '.toolbox-page' },
  { route: 'me/profile/index', label: '我的', root: '.profile-page' },
];
const manifest = { startedAt: new Date().toISOString(), project, port, cycles, mode: argv.includes('--connect-only') ? 'connect' : 'launch', mockedData: false, steps: [], passed: false };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function timeout(work, name, ms = 15000) {
  let timer;
  return Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${name}: timeout after ${ms}ms`)), ms); })]).finally(() => clearTimeout(timer));
}
async function save() { await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2)); }
async function launch() {
  await fs.access(cli);
  // PowerShell argument binding passes paths as values. Windows CLI requires a
  // canonical backslash project path; forward slashes create a different context.
  const command = '& $env:COACHLINK_AUDIT_CLI auto --project $env:COACHLINK_AUDIT_PROJECT --auto-port $env:COACHLINK_AUDIT_PORT; exit $LASTEXITCODE';
  const child = process.platform === 'win32'
    ? spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, env: { ...process.env, COACHLINK_AUDIT_CLI: cli, COACHLINK_AUDIT_PROJECT: path.win32.normalize(project), COACHLINK_AUDIT_PORT: String(port) } })
    : spawn(cli, ['auto', '--project', project, '--auto-port', String(port)]);
  let text = '';
  child.stdout.on('data', b => { text += b; });
  child.stderr.on('data', b => { text += b; });
  try {
    await timeout(new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`CLI launch failed (${code})`))); }), 'CLI launch', 60000);
    await fs.writeFile(path.join(output, 'launch.log'), text);
  } catch (error) { child.kill(); await fs.writeFile(path.join(output, 'launch.log'), text); throw error; }
}
async function connectReady(automator) {
  const deadline = Date.now() + 60000;
  let latest = '';
  while (Date.now() < deadline) {
    let candidate;
    try {
      candidate = await timeout(automator.connect({ wsEndpoint: `ws://127.0.0.1:${port}` }), 'connect', 6000);
      const page = await timeout(candidate.currentPage(), 'startup currentPage', 6000);
      if (!page || !page.path) throw new Error('Mini-program has not rendered its first page');
      return candidate;
    } catch (error) { latest = error.message; if (candidate) candidate.disconnect(); await delay(600); }
  }
  throw new Error(`Runtime never became ready: ${latest}`);
}
async function routeIs(mini, expected) {
  const deadline = Date.now() + 12000;
  do {
    const page = await timeout(mini.currentPage(), 'currentPage');
    if (page && page.path === expected) return page;
    await delay(250);
  } while (Date.now() < deadline);
  throw new Error(`Actual route did not become ${expected}`);
}
async function ready(page, target) {
  const deadline = Date.now() + 45000;
  let stable = 0;
  const busySelectors = ['.skeleton-list', '.loading-spinner'];
  while (Date.now() < deadline) {
    const root = await timeout(page.$(target.root), 'page root');
    let busy = !root;
    for (const selector of busySelectors) {
      const nodes = await timeout(page.$$(selector), `check ${selector}`);
      if (nodes.length) busy = true;
    }
    stable = busy ? 0 : stable + 1;
    if (stable >= 3) { await delay(700); return; }
    await delay(600);
  }
  throw new Error(`Loading did not finish on ${target.route}; no normal-state screenshot accepted`);
}
async function capture(mini, target, action) {
  const page = await routeIs(mini, target.route);
  await ready(page, target);
  // The profile currently renders three zeroes before its async statistics have
  // returned, without a loading indicator. Give that state a bounded grace period;
  // zeroes can also be real, so record ambiguity rather than inventing counts.
  let statisticsState;
  if (target.route === 'me/profile/index') {
    const deadline = Date.now() + 20000;
    do {
      const values = await timeout(page.$$('.profile-stat-value'), 'profile statistics');
      const texts = [];
      for (const value of values) texts.push((await timeout(value.text(), 'statistic text')).trim());
      statisticsState = texts.length === 3 && texts.every(text => text === '0') ? 'zero values; data completion unconfirmed' : 'displayed values settled';
      if (!statisticsState.startsWith('zero')) break;
      await delay(700);
    } while (Date.now() < deadline);
  }
  const filename = `${String(manifest.steps.length + 1).padStart(2, '0')}-${target.route.replace(/\//g, '-')}.png`;
  const screenshot = path.join(output, filename);
  await timeout(mini.screenshot({ path: screenshot }), 'screenshot', 18000);
  const bytes = await fs.readFile(screenshot);
  if (bytes.length < 2000 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Capture did not produce a valid PNG');
  await routeIs(mini, target.route);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (width < 200 || height < 400) throw new Error(`Unexpected capture size ${width}x${height}`);
  const step = { number: manifest.steps.length + 1, label: target.label, action, actualRoute: target.route, screenshot, width, height, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), capturedAt: new Date().toISOString(), statisticsState, visualReview: 'pending' };
  manifest.steps.push(step);
  await save();
  console.log(JSON.stringify({ step: step.number, route: step.actualRoute, screenshot, size: `${width}x${height}` }));
}
(async () => {
  let mini;
  try {
    if (!Number.isInteger(port) || port < 1024 || port > 65535 || !Number.isInteger(cycles) || cycles < 1 || cycles > 5) throw new Error('Invalid port or cycles');
    const config = JSON.parse(await fs.readFile(path.join(project, 'project.config.json'), 'utf8'));
    if (config.appid !== 'wx316e39eb71c0e834') throw new Error('Project AppID does not identify CoachLink');
    await fs.mkdir(output, { recursive: true });
    await save();
    let automator;
    try { automator = require('miniprogram-automator'); } catch { automator = require(sdkLocation); }
    if (!argv.includes('--connect-only')) await launch();
    mini = await connectReady(automator);
    let current = await timeout(mini.currentPage(), 'initial page');
    if (current.path !== pages[0].route) await timeout(mini.reLaunch(`/${pages[0].route}`), 'home navigation');
    for (let cycle = 1; cycle <= cycles; cycle++) {
      for (let i = 0; i < pages.length; i++) {
        current = await timeout(mini.currentPage(), 'before tap');
        let action = 'already on target';
        if (current.path !== pages[i].route) {
          const selector = `.nav-item:nth-child(${i + 1})`;
          const control = await timeout(current.$(selector), 'find navigation');
          if (!control || await timeout(control.text(), 'navigation label') !== pages[i].label) throw new Error(`Navigation identity mismatch: ${selector}`);
          await timeout(control.tap(), 'tap navigation');
          action = `tap ${selector}`;
        }
        await capture(mini, pages[i], action);
      }
    }
    // Leave the preview on the user's training home without creating any data.
    await timeout(mini.reLaunch(`/${pages[0].route}`), 'return home');
    await routeIs(mini, pages[0].route);
    manifest.passed = manifest.steps.length === pages.length * cycles;
  } catch (error) { manifest.error = error.message; console.error(error.message); process.exitCode = 1; }
  finally {
    if (mini) mini.disconnect();
    manifest.finishedAt = new Date().toISOString();
    await fs.mkdir(output, { recursive: true });
    await save();
    // An SDK connection that timed out during startup can keep an orphan socket
    // alive. This standalone runner owns those connections; close the process
    // only after all captures and the final manifest have been fully written.
    process.stdout.write(`Manifest: ${path.join(output, 'manifest.json')}\n`, () => process.exit(process.exitCode || 0));
  }
})();
