import dotenv from 'dotenv';
import gradient from 'gradient-string';
import os from 'os';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });
dotenv.config({ path: '.env.local' });

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
console.log(orangeGradient(`📍 NODE_ENV: ${process.env.NODE_ENV || 'development'}`));
console.log(orangeGradient(`📁 Environment file: .env.${process.env.NODE_ENV || 'development'}`));
console.log(orangeGradient(`🔗 Supabase URL: ${process.env.NEXT_SUPABASE_URL ? '✅ [SET]' : '❌ [NOT SET]'}`));
console.log(createSeparator(60));

// 配置
const MAX_RESTARTS = 5;
const RESTART_DELAY = 3000;
let restartCount = 0;
let nextProcess = null;

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

async function startDev() {
    console.log(warmGradient('\n🔄 Starting Next.js development server...'));
    
    if (restartCount > 0) {
        console.log(yellowOrangeGradient(`🔄 重启次数: ${restartCount}/${MAX_RESTARTS}`));
    }

    // COACHLINK_FAST_DEV=1 时：Turbopack + 更大内存
    const useFastDev = process.env.COACHLINK_FAST_DEV === '1';
    const nextArgs = useFastDev ? ['next', 'dev'] : ['next', 'dev', '--webpack'];
    
    const spawnEnv = {
        ...process.env,
        // 增加内存限制
        NODE_OPTIONS: '--max-old-space-size=4096',
        // 使用轮询而非原生文件系统事件（更稳定）
        CHOKIDAR_USEPOLLING: 'true',
        CHOKIDAR_INTERVAL: '500',
        // 禁用遥测
        NEXT_TELEMETRY_DISABLED: '1',
    };
    
    if (useFastDev) {
        spawnEnv.NODE_OPTIONS += ' --max-old-space-size=4096';
        console.log(warmGradient('⚡ 快速开发模式已启用'));
    }

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
    if (nextProcess) nextProcess.kill('SIGINT');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(orangeGradient('\n🔚 开发服务器已终止'));
    if (nextProcess) nextProcess.kill('SIGTERM');
    process.exit(0);
});

// 启动
startDev();
