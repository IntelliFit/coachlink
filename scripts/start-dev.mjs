import gradient from 'gradient-string';
import os from 'os';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { bootstrapEnv, nextEnvForChild } from './config/bootstrap-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const explicitNextAuthUrl = process.env.NEXTAUTH_URL;
const proxyBootstrapPath = path.join(projectRoot, 'scripts', 'urllib-proxy-bootstrap.js');

const envBootstrap = await bootstrapEnv({ mode: 'development', projectRoot });

// 定义橙色系列渐变色
const orangeGradient = gradient(['#FFA500', '#FF8C00', '#FF6347', '#FF4500']);
const yellowOrangeGradient = gradient(['#FFD700', '#FFA500', '#FF8C00']);
const warmGradient = gradient(['#FFB347', '#FFCC33']);
const redGradient = gradient(['#FF6B6B', '#FF4444']);

// 如果配置了支付宝代理
if (process.env.ALIPAY_PROXY && !process.env.HTTPS_PROXY && !process.env.HTTP_PROXY) {
    process.env.HTTPS_PROXY = process.env.ALIPAY_PROXY;
    process.env.HTTP_PROXY = process.env.ALIPAY_PROXY;
    const maskedProxy = process.env.ALIPAY_PROXY.replace(/:[^:]*@/, ':****@');
    console.log(warmGradient(`🌐 支付宝代理已启用: ${maskedProxy}`));
}

// 创建分隔线
function createSeparator(length = 50) {
    return orangeGradient('═'.repeat(length));
}

console.log(createSeparator(60));
console.log(yellowOrangeGradient('🚀 COACHLINK DEVELOPMENT SERVER 🚀'));
console.log(createSeparator(60));
console.log(warmGradient('📋 Environment Configuration:'));
// 这里固定显示 development：dev 入口会强制给 `next dev` 子进程设 NODE_ENV=development
// （见下方 spawnEnv），与父进程从 shell/Apollo 继承到的值无关，避免横幅误导排查。
console.log(orangeGradient(`📍 NODE_ENV: development${process.env.NODE_ENV && process.env.NODE_ENV !== 'development' ? `（已忽略继承的 ${process.env.NODE_ENV}）` : ''}`));
console.log(orangeGradient(`📁 Config source: ${envBootstrap.source}`));
console.log(orangeGradient(`📄 Loaded files: ${envBootstrap.loadedFiles.join(', ')}`));
console.log(orangeGradient(`🔗 Supabase URL: ${process.env.NEXT_SUPABASE_URL ? '✅ [SET]' : '❌ [NOT SET]'}`));
console.log(createSeparator(60));

// 配置
const MAX_RESTARTS = 5;
const RESTART_DELAY = 3000;
let restartCount = 0;
let nextProcess = null;
let powerWorkerProcess = null;

// 清理缓存
async function cleanCache() {
    const cachePaths = [
        path.join(projectRoot, '.next', 'dev'),
        path.join(projectRoot, '.next', 'cache', 'webpack'),
    ];
    
    for (const cachePath of cachePaths) {
        try {
            await fs.rm(cachePath, { recursive: true, force: true });
            console.log(warmGradient(`✓ 清理缓存: ${path.relative(projectRoot, cachePath)}`));
        } catch (e) {}
    }
}

// 检查是否可恢复的错误
function isRecoverableError(data) {
    const errorStr = data.toLowerCase();
    const patterns = [
        'enoent',
        'routes-manifest.json',
        'webpack.cache',
        'packfilecachestrategy',
        'internal server error',
        'no such file or directory',
    ];
    return patterns.some(p => errorStr.includes(p));
}

function crossSpawn(command, args, options = {}) {
    const isWindows = os.platform() === 'win32';
    return spawn(
        isWindows ? 'cmd.exe' : 'sh',
        isWindows ? ['/c', command, ...args] : ['-c', `${command} ${args.join(' ')}`],
        { stdio: ['inherit', 'pipe', 'pipe'], ...options }
    );
}

function shouldStartLocalPowerWorker() {
    if (process.env.COACHLINK_DISABLE_LOCAL_POWER_WORKER === '1') {
        return false;
    }
    const driver = String(process.env.TASK_QUEUE_DRIVER || 'memory').trim().toLowerCase();
    return ['memory', 'local', 'in_memory', 'in-memory'].includes(driver);
}

function startLocalPowerWorker(spawnEnv) {
    if (!shouldStartLocalPowerWorker()) {
        console.log(warmGradient('[PowerAnalysisWorker] 本地内存 worker 未启用（TASK_QUEUE_DRIVER 非 memory）'));
        return;
    }
    if (powerWorkerProcess) return;
    console.log(warmGradient('[PowerAnalysisWorker] 启动本地 memory worker...'));
    powerWorkerProcess = crossSpawn('node', ['scripts/power-analysis-worker.mjs', '--queue'], {
        env: {
            ...spawnEnv,
            NODE_ENV: 'development',
        },
    });
    powerWorkerProcess.stdout.on('data', (data) => {
        process.stdout.write(data);
    });
    powerWorkerProcess.stderr.on('data', (data) => {
        process.stderr.write(data);
    });
    powerWorkerProcess.on('close', (code) => {
        console.log(warmGradient(`[PowerAnalysisWorker] 已退出 (code: ${code})`));
        powerWorkerProcess = null;
    });
}

async function startDev() {
    console.log(warmGradient('\n🔄 Starting Next.js development server...'));
    
    if (restartCount > 0) {
        console.log(yellowOrangeGradient(`🔄 重启次数: ${restartCount}/${MAX_RESTARTS}`));
    }

    // COACHLINK_FAST_DEV=1 时：Turbopack + 更大内存
    const useFastDev = process.env.COACHLINK_FAST_DEV === '1';
    const nextArgs = useFastDev ? ['next', 'dev'] : ['next', 'dev', '--webpack'];
    
    const spawnEnv = {
        ...nextEnvForChild(),
        // 强制开发模式：必须放在 nextEnvForChild() 之后覆盖它。
        // 否则当 CONFIG_SOURCE=apollo 时，Apollo 的生产配置可能带 NODE_ENV=production
        // 并被写进进程环境，传给 `next dev` 后会按生产行为运行：
        //   - CSS loader 失效 → node_modules 里的 primeicons.css 报 "Module parse failed: Unexpected character '@'"
        //   - 去找生产产物 .next/dev/required-server-files.json → ENOENT → 启动脚本反复重启（崩溃循环）。
        NODE_ENV: 'development',
        // 增加内存限制
        NODE_OPTIONS: `--require=${proxyBootstrapPath} --max-old-space-size=4096`,
        // 使用轮询而非原生文件系统事件（更稳定）
        CHOKIDAR_USEPOLLING: 'true',
        CHOKIDAR_INTERVAL: '500',
        // 禁用遥测
        NEXT_TELEMETRY_DISABLED: '1',
        // Playwright and similar callers may intentionally run dev on a non-default port.
        // Apollo/local runtime config can provide a default NEXTAUTH_URL, but an explicit
        // process env from the caller must win so auth redirects stay on the test server.
        ...(explicitNextAuthUrl ? { NEXTAUTH_URL: explicitNextAuthUrl } : {}),
    };
    
    if (useFastDev) {
        spawnEnv.NODE_OPTIONS += ' --max-old-space-size=4096';
        console.log(warmGradient('⚡ 快速开发模式已启用'));
    }

    startLocalPowerWorker(spawnEnv);

    nextProcess = crossSpawn('npx', nextArgs, { env: spawnEnv });

    let errorBuffer = '';

    nextProcess.stdout.on('data', (data) => {
        process.stdout.write(data);
    });

    nextProcess.stderr.on('data', (data) => {
        process.stderr.write(data);
        errorBuffer += data.toString();
        
        // 检测可恢复错误
        if (isRecoverableError(errorBuffer) && restartCount < MAX_RESTARTS) {
            console.log(redGradient('\n⚠️ 检测到缓存错误，准备自动恢复...\n'));
            restart();
        }
    });

    nextProcess.on('close', async (code) => {
        if (code !== 0 && restartCount < MAX_RESTARTS) {
            console.log(redGradient(`\n⚠️ 服务器异常退出 (code: ${code})，准备自动恢复...\n`));
            restart();
        } else if (restartCount >= MAX_RESTARTS) {
            console.log(redGradient('\n❌ 达到最大重启次数，请检查代码错误\n'));
            process.exit(1);
        } else {
            console.log(orangeGradient('\n✅ 开发服务器已正常关闭'));
            process.exit(0);
        }
    });
}

async function restart() {
    restartCount++;
    
    // 杀死旧进程
    if (nextProcess) {
        nextProcess.kill('SIGTERM');
        await new Promise(r => setTimeout(r, 1500));
    }
    
    // 清理缓存
    await cleanCache();
    
    // 等待后重启
    console.log(yellowOrangeGradient(`\n⏳ ${RESTART_DELAY}ms 后重启...\n`));
    await new Promise(r => setTimeout(r, RESTART_DELAY));
    
    startDev();
}

// 进程退出处理
process.on('SIGINT', () => {
    console.log(warmGradient('\n👋 正在关闭开发服务器...'));
    if (powerWorkerProcess) powerWorkerProcess.kill('SIGINT');
    if (nextProcess) nextProcess.kill('SIGINT');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(orangeGradient('\n🔚 开发服务器已终止'));
    if (powerWorkerProcess) powerWorkerProcess.kill('SIGTERM');
    if (nextProcess) nextProcess.kill('SIGTERM');
    process.exit(0);
});

// 启动
startDev();
