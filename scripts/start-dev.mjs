import dotenv from 'dotenv';
import gradient from 'gradient-string';
import os from 'os';
import { spawn } from 'child_process';

dotenv.config({
    path: `.env.${process.env.NODE_ENV || 'development'}`
});
// .env.local 覆盖（gitignore），用于本地配置如 COACHLINK_FAST_DEV
dotenv.config({ path: '.env.local' });

// 定义橙色系列渐变色
const orangeGradient = gradient(['#FFA500', '#FF8C00', '#FF6347', '#FF4500']);
const yellowOrangeGradient = gradient(['#FFD700', '#FFA500', '#FF8C00']);
const warmGradient = gradient(['#FFB347', '#FFCC33']);

// 如果配置了支付宝代理，设置全局代理环境变量
// 这样 alipay-sdk 内部的所有 HTTP 请求都会通过代理服务器
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
console.log(warmGradient('🔄 Starting Next.js development server...'));

function crossSpawn(command, args, options = {}) {
    const isWindows = os.platform() === 'win32';

    return spawn(isWindows ? 'cmd.exe' : 'sh',
        isWindows ? ['/c', command, ...args] : ['-c', `${command} ${args.join(' ')}`],
        {
            stdio: 'inherit',
            ...options
        }
    );
}

// COACHLINK_FAST_DEV=1 时：Turbopack + 更大内存，适合低配置机器（在 .env.local 中设置，不提交）
// 未设置时：保持原有 webpack，团队其他成员无影响
const useFastDev = process.env.COACHLINK_FAST_DEV === '1';
const nextArgs = useFastDev ? ['next', 'dev'] : ['next', 'dev', '--webpack'];
const spawnEnv = {
    ...process.env,
    HTTPS_PROXY: process.env.HTTPS_PROXY,
    HTTP_PROXY: process.env.HTTP_PROXY,
};
if (useFastDev) {
    spawnEnv.NODE_OPTIONS = [process.env.NODE_OPTIONS, '--max-old-space-size=4096'].filter(Boolean).join(' ');
    console.log(warmGradient('⚡ 快速开发模式已启用 (COACHLINK_FAST_DEV=1)'));
}
const nextDev = crossSpawn('npx', nextArgs, { env: spawnEnv });

nextDev.on('close', (code) => {
    const statusMessage = code === 0
        ? '✅ Next.js development server completed successfully'
        : `📤 Next.js development server exited with code ${code}`;

    console.log(orangeGradient(statusMessage));
});

// 添加进程退出处理
process.on('SIGINT', () => {
    console.log(warmGradient('\n👋 Shutting down development server...'));
    nextDev.kill('SIGINT');
});

process.on('SIGTERM', () => {
    console.log(orangeGradient('\n🔚 Development server terminated'));
    nextDev.kill('SIGTERM');
});