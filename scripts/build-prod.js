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

// Next.js 16 defaults to Turbopack, which is materially faster and lighter for our production builds.
// Keep an escape hatch for Webpack-only debugging on environments that explicitly request it.
const useWebpack = process.env.COACHLINK_BUILD_USE_WEBPACK === '1';
const nextBuildArgs = useWebpack ? ['next', 'build', '--webpack'] : ['next', 'build'];
console.log(`→ Running build command: npx ${nextBuildArgs.join(' ')}`);

const nextBuild = crossSpawn('npx', nextBuildArgs, {
    env: { ...process.env, NODE_ENV: 'production' }
});

nextBuild.on('error', (error) => {
    console.error('\n✗ Build process failed to start:', error);
    process.exit(1);
});

nextBuild.on('close', (code, signal) => {
    if (code === 0) {
        console.log('\n✓ Build completed successfully!');

        // --- 开始移动资源到 standalone ---
        console.log('→ Preparing standalone folders...');

        const standalonePath = path.join(__dirname, '..', '.next', 'standalone');
        const staticPath = path.join(__dirname, '..', '.next', 'static');
        const publicPath = path.join(__dirname, '..', 'public');
        const bodyMapAssetsPath = path.join(__dirname, '..', 'docs', 'assets');

        if (fs.existsSync(standalonePath)) {
            // 1. 拷贝 static 到 .next/standalone/.next/static
            const targetStaticPath = path.join(standalonePath, '.next', 'static');
            console.log('  - Copying .next/static to standalone...');
            copyFolderSync(staticPath, targetStaticPath);

            // 2. 拷贝 public 到 .next/standalone/public
            const targetPublicPath = path.join(standalonePath, 'public');
            console.log('  - Copying public to standalone...');
            copyFolderSync(publicPath, targetPublicPath);

            // 3. 拷贝人体地图 SVG 素材到 standalone/docs/assets
            const targetBodyMapAssetsPath = path.join(standalonePath, 'docs', 'assets');
            console.log('  - Copying docs/assets to standalone...');
            copyFolderSync(bodyMapAssetsPath, targetBodyMapAssetsPath);

            console.log('\n✅ Standalone is ready at: .next/standalone');
            console.log('🚀 Now you can just scp the EVERYTHING inside .next/standalone to your server.');
            process.exit(0);
        } else {
            console.error('✗ Error: standalone folder not found. Check next.config.js for output: "standalone"');
            process.exit(1);
        }
    } else {
        const signalLabel = signal ? `, signal ${signal}` : '';
        console.log(`\n✗ Build failed with code ${code}${signalLabel}`);
        process.exit(code ?? 1);
    }
});
