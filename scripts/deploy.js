const { execSync } = require('child_process');
const path = require('path');

// 配置信息
const REMOTE_USER = 'root';
const REMOTE_IP = '154.8.205.78';
const REMOTE_DIR = '/www/wwwroot/coachlink';
const SSH_AUTH = `${REMOTE_USER}@${REMOTE_IP}`;

try {
    console.log('🚀 Starting Deployment Process...');

    // 1. 进入 standalone 目录并打包
    // 使用 -C 改变目录，确保压缩包内路径是从根开始的
    console.log('📦 Packaging standalone build...');
    execSync(`cd .next/standalone && tar -czf ../../deploy.tar.gz .`, { stdio: 'inherit' });

    // 2. 上传压缩包 (SCP 默认会覆盖同名文件)
    console.log('📤 Uploading to server...');
    execSync(`scp deploy.tar.gz ${SSH_AUTH}:${REMOTE_DIR}/`, { stdio: 'inherit' });

    // 3. 远程执行：清理旧静态资源、解压、删除压缩包、重启服务
    // 注意：这里先删除旧的 .next/static 确保没有残留文件干扰
    console.log('🔧 Remote executing: Cleanup and Unpack...');
    const remoteCommands = [
        `cd ${REMOTE_DIR}`,
        `rm -rf .next/static`, // 删除旧静态资源，防止缓存或Hash混乱
        `tar -xzf deploy.tar.gz`, // 解压
        `rm deploy.tar.gz`, // 删除压缩包
        `pm2 restart coachlink || npm run start`, // 重启项目
        `nginx -s reload` // 强制刷新 Nginx 状态，配合你之前的配置改动
    ].join(' && ');

    execSync(`ssh ${SSH_AUTH} "${remoteCommands}"`, { stdio: 'inherit' });

    console.log('\n✅ Deployment Successful!');
} catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
}