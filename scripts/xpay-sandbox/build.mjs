import { build } from 'esbuild';
import { mkdirSync, cpSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const target = 'D:/cache/agent-tests/coachlink-xpay-20261011';
const root = resolve('.');
if (!process.env.TEMP?.replaceAll('\\', '/').startsWith(target + '/')) throw new Error('Set task TEMP/TMP/TMPDIR first');
mkdirSync(target + '/backend', { recursive: true });
const backendOnly = process.argv.includes('--backend-only');
const live = process.argv.includes('--live');
const miniapp = target + (live && !process.argv.includes('--replace-sandbox') ? '/miniapp-live' : '/miniapp');
if (!backendOnly) cpSync(root + '/scripts/xpay-sandbox/miniapp', miniapp, { recursive: true });
await build({ entryPoints: ['scripts/xpay-sandbox/server.ts'], outfile: target + '/backend/server.cjs', bundle: true, platform: 'node', target: 'node22', format: 'cjs', external: ['/app/scripts/config/bootstrap-env.mjs'], logLevel: 'warning' });
if (!backendOnly) {
if (live) {
  const app = JSON.parse(readFileSync(miniapp + '/app.json', 'utf8'));
  app.window.navigationBarTitleText = 'CoachLink 现网支付验证';
  writeFileSync(miniapp + '/app.json', JSON.stringify(app, null, 2));
}
await build({ entryPoints: ['apps/wechat/src/utils/virtual-payment.ts'], outfile: miniapp + '/pages/index/payment.js', bundle: true, platform: 'neutral', target: 'es2018', format: 'cjs', logLevel: 'warning' });
const catalog = JSON.parse(readFileSync('scripts/xpay-sandbox/catalog.json', 'utf8'));
writeFileSync(miniapp + '/catalog.js', 'module.exports = ' + JSON.stringify((live ? catalog.filter(p => p.id === 'ai_pack_200') : catalog).map(p => ({ ...p, label: p.name + ' ¥' + (p.price / 100).toFixed(2) }))) + '\n');
writeFileSync(miniapp + '/stage.js', 'module.exports = ' + JSON.stringify({ live, env: live ? 0 : 1 }) + '\n');
writeFileSync(miniapp + '/project.config.json', JSON.stringify({ appid: 'wx316e39eb71c0e834', projectname: 'CoachLink-Android-XPay-' + (live ? 'LIVE' : 'Sandbox') + '-20261011', compileType: 'miniprogram', miniprogramRoot: './', libVersion: '3.15.2', setting: { urlCheck: true, es6: true, enhance: false, minified: true, compileHotReLoad: false } }, null, 2));
}
const catalog = JSON.parse(readFileSync('scripts/xpay-sandbox/catalog.json', 'utf8'));
const files = [];
function scan(dir) { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) scan(path); else files.push({ path: path.slice(target.length + 1), bytes: statSync(path).size, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }); } }
scan(target + '/backend'); scan(miniapp);
writeFileSync(target + (live ? '/build-manifest-live.json' : '/build-manifest.json'), JSON.stringify({ appId: 'wx316e39eb71c0e834', environment: live ? 0 : 1, cashTestOnly: live, source: root, generatedAt: new Date().toISOString(), files, bytes: files.reduce((sum, file) => sum + file.bytes, 0) }, null, 2));
console.log(JSON.stringify({ target, goods: catalog.length, files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) }));
