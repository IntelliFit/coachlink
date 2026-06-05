const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function main() {
    console.log('='.repeat(50));
    console.log('COACHLINK BUILD & PREPARE PROCESS');
    console.log('='.repeat(50));

    const { bootstrapEnv, nextEnvForChild } = await import('./config/bootstrap-env.mjs');
    const envBootstrap = await bootstrapEnv({
        mode: 'production',
        projectRoot: path.join(__dirname, '..'),
    });
    console.log(`Loaded config source: ${envBootstrap.source}`);
    console.log(`Loaded files: ${envBootstrap.loadedFiles.join(', ')}`);

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
        env: nextEnvForChild({ NODE_ENV: 'production' })
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

            // 4. 拷贝配置启动包装脚本，保证 standalone 运行时也先执行本地/Apollo 二选一配置加载。
            console.log('  - Copying config bootstrap scripts to standalone...');
            copyFolderSync(path.join(__dirname, 'config'), path.join(standalonePath, 'scripts', 'config'));
            fs.copyFileSync(path.join(__dirname, 'start-prod.mjs'), path.join(standalonePath, 'scripts', 'start-prod.mjs'));
            const standalonePackagePath = path.join(standalonePath, 'package.json');
            if (fs.existsSync(standalonePackagePath)) {
                const standalonePackage = JSON.parse(fs.readFileSync(standalonePackagePath, 'utf8'));
                standalonePackage.scripts = {
                    ...(standalonePackage.scripts || {}),
                    start: 'node scripts/start-prod.mjs',
                };
                fs.writeFileSync(standalonePackagePath, `${JSON.stringify(standalonePackage, null, 2)}\n`);
            }

            console.log('\n✅ Standalone is ready at: .next/standalone');
            console.log('🚀 Now you can scp everything inside .next/standalone to your server and run npm start.');
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

main().catch((error) => {
    console.error(`\n✗ Build bootstrap failed: ${error.message}`);
    process.exit(1);
});
