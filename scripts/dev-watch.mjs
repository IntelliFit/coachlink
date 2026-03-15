#!/usr/bin/env node
/**
 * 增强型 Next.js 开发服务器
 * - 增加内存限制
 * - 优化文件系统轮询
 * - 自动恢复崩溃
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// 环境变量配置
const env = {
  ...process.env,
  // 增加内存限制
  NODE_OPTIONS: '--max-old-space-size=4096',
  // 禁用 webpack 持久缓存（减少文件锁定问题）
  NEXT_PRIVATE_LOCAL_WEBPACK: 'true',
  // 使用轮询而非原生文件系统事件（更稳定）
  CHOKIDAR_USEPOLLING: 'true',
  CHOKIDAR_INTERVAL: '500',
  // 禁用 Next.js 遥测
  NEXT_TELEMETRY_DISABLED: '1',
};

async function cleanWebpackCache() {
  const cacheDir = path.join(projectRoot, '.next', 'cache', 'webpack');
  try {
    await fs.rm(cacheDir, { recursive: true, force: true });
    console.log('✓ 清理 webpack 缓存');
  } catch (e) {}
}

function startServer() {
  console.log('\n🚀 启动开发服务器 (增强模式)...\n');
  
  const child = spawn('npx', ['next', 'dev'], {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
    shell: true,
  });

  child.on('error', (err) => {
    console.error('启动错误:', err);
    setTimeout(startServer, 2000);
  });

  child.on('close', async (code) => {
    if (code !== 0) {
      console.log(`\n⚠️ 服务器崩溃 (code: ${code})，5秒后自动恢复...\n`);
      await cleanWebpackCache();
      setTimeout(startServer, 5000);
    }
  });

  return child;
}

// 初始清理
await cleanWebpackCache();
startServer();
