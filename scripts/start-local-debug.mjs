import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { bootstrapEnv, nextEnvForChild } from './config/bootstrap-env.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.includes('--help')) {
    console.log('npm run dev:debug-login -- --port 3003\n仅绑定 127.0.0.1，使用独立 .next-local-debug 产物。本地 API 仍读取 .env 选择的数据源。');
    process.exit(0);
}
if (args.length && !(args.length === 2 && args[0] === '--port') && !(args.length === 1 && /^\d+$/.test(args[0]))) throw new Error('只支持 --port 参数');
const port = Number(args[1] || args[0] || 3003);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('端口无效');
await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
});
const config = await bootstrapEnv({ mode: 'development', projectRoot: root });
const pairingCode = randomBytes(16).toString('hex');
const origin = `http://127.0.0.1:${port}`;
console.log(`[CoachLink 本地模拟] API ${origin}，配置来源 ${config.source}`);
console.log('注意：本地 API 可能连接真实数据库。训练填写/完成会保存，支付及管理操作禁止。');
console.log(`本次配对码（仅输入本地小程序，不要分享）：${pairingCode}`);
console.log(`小程序构建请设置 TARO_APP_API_URL=${origin}；一小时凭证，重启后失效。`);
const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: root, stdio: 'inherit', windowsHide: true,
    env: nextEnvForChild({
        NODE_ENV: 'development', NEXTAUTH_URL: origin, NEXT_TELEMETRY_DISABLED: '1',
        COACHLINK_LOCAL_DEBUG_LOGIN: '1', COACHLINK_LOCAL_DEBUG_PAIRING_CODE: pairingCode,
        COACHLINK_LOCAL_DEBUG_SIGNING_KEY: randomBytes(48).toString('hex'),
        COACHLINK_DISABLE_LOCAL_POWER_WORKER: '1',
        NODE_OPTIONS: `--require=${path.join(root, 'scripts/urllib-proxy-bootstrap.js')} --max-old-space-size=4096`,
    }),
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code || 0; });
