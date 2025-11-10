import dotenv from 'dotenv';
import gradient from 'gradient-string';
import os from 'os';
import { spawn } from 'child_process';

dotenv.config({
    path: `.env.${process.env.NODE_ENV || 'development'}`
});


// 定义橙色系列渐变色
const orangeGradient = gradient(['#FFA500', '#FF8C00', '#FF6347', '#FF4500']);
const yellowOrangeGradient = gradient(['#FFD700', '#FFA500', '#FF8C00']);
const warmGradient = gradient(['#FFB347', '#FFCC33']);

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
console.log(orangeGradient(`🏷️  App Name: ${process.env.NEXT_PUBLIC_APP_NAME || 'Not set'}`));
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

// 在你的代码中使用
const nextDev = crossSpawn('npx', ['next', 'dev']);

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