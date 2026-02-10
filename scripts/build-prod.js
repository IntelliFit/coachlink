const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('='.repeat(50));
console.log('COACHLINK BUILD & PREPARE PROCESS');
console.log('='.repeat(50));

const prodEnvPath = path.join(__dirname, '..', '.env.production');
if (fs.existsSync(prodEnvPath)) {
    require('dotenv').config({ path: prodEnvPath });
    console.log('Loaded .env.production');
} else {
    console.log('Note: .env.production not found, using existing env (e.g. Docker build args)');
}

// 跨平台执行命令的函数
function crossSpawn(command, args, options = {}) {
    const isWindows = os.platform() === 'win32';
    return spawn(
        isWindows ? 'cmd.exe' : 'sh',
        isWindows ? ['/c', command, ...args] : ['-c', `${command} ${args.join(' ')}`],
        { stdio: 'inherit', ...options }
    );
}

// 递归拷贝文件夹的函数
function copyFolderSync(from, to) {
    if (!fs.existsSync(from)) return;
    if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
    fs.readdirSync(from).forEach(element => {
        if (fs.lstatSync(path.join(from, element)).isDirectory()) {
            copyFolderSync(path.join(from, element), path.join(to, element));
        } else {
            fs.copyFileSync(path.join(from, element), path.join(to, element));
        }
    });
}

// 清理旧的构建产物，确保每次构建都是全新的
const nextDir = path.join(__dirname, '..', '.next');
if (fs.existsSync(nextDir)) {
    console.log('Cleaning .next directory...');
    fs.rmSync(nextDir, { recursive: true, force: true });
}

// Next.js 16 uses Turbopack by default. Force Webpack build to avoid Turbopack/font internal module
// resolution issues (e.g. next/font/google -> @vercel/turbopack-next/internal/...).
const nextBuild = crossSpawn('npx', ['next', 'build', '--webpack'], {
    env: { ...process.env, NODE_ENV: 'production' }
});

nextBuild.on('close', (code) => {
    if (code === 0) {
        console.log('\n✓ Build completed successfully!');

        // --- 开始移动资源到 standalone ---
        console.log('→ Preparing standalone folders...');

        const standalonePath = path.join(__dirname, '..', '.next', 'standalone');
        const staticPath = path.join(__dirname, '..', '.next', 'static');
        const publicPath = path.join(__dirname, '..', 'public');

        if (fs.existsSync(standalonePath)) {
            // 1. 拷贝 static 到 .next/standalone/.next/static
            const targetStaticPath = path.join(standalonePath, '.next', 'static');
            console.log('  - Copying .next/static to standalone...');
            copyFolderSync(staticPath, targetStaticPath);

            // 2. 拷贝 public 到 .next/standalone/public
            const targetPublicPath = path.join(standalonePath, 'public');
            console.log('  - Copying public to standalone...');
            copyFolderSync(publicPath, targetPublicPath);

            console.log('\n✅ Standalone is ready at: .next/standalone');
            console.log('🚀 Now you can just scp the EVERYTHING inside .next/standalone to your server.');
        } else {
            console.error('✗ Error: standalone folder not found. Check next.config.js for output: "standalone"');
        }
    } else {
        console.log(`\n✗ Build failed with code ${code}`);
    }
});