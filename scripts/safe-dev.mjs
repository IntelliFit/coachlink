#!/usr/bin/env node
/**
 * 安全的 Next.js 开发服务器启动脚本
 * 自动清理缓存并在崩溃时重启
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const MAX_RESTARTS = 10;
const RESTART_DELAY = 2000;

let restartCount = 0;
let nextProcess = null;

// 清理缓存目录
async function cleanCache() {
  const cachePaths = [
    path.join(projectRoot, '.next', 'dev'),
    path.join(projectRoot, '.next', 'cache'),
  ];
  
  for (const cachePath of cachePaths) {
    try {
      await fs.rm(cachePath, { recursive: true, force: true });
      console.log(`✓ 清理缓存: ${cachePath}`);
    } catch (err) {
      // 忽略错误
    }
  }
}

// 检查错误是否可恢复
function isRecoverableError(data) {
  const errorStr = data.toString();
  const recoverablePatterns = [
    'ENOENT',
    'routes-manifest.json',
    'webpack.cache',
    'PackFileCacheStrategy',
    'Internal Server Error',
  ];
  return recoverablePatterns.some(pattern => errorStr.includes(pattern));
}

// 启动 Next.js 开发服务器
function startDev() {
  console.log('\n🚀 启动 Next.js 开发服务器...\n');
  
  nextProcess = spawn('npx', ['next', 'dev'], {
    cwd: projectRoot,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
  });

  // 处理标准输出
  nextProcess.stdout.on('data', (data) => {
    process.stdout.write(data);
  });

  // 处理错误输出
  nextProcess.stderr.on('data', async (data) => {
    process.stderr.write(data);
    
    if (isRecoverableError(data)) {
      console.log('\n⚠️ 检测到缓存错误，准备重启...\n');
      restart();
    }
  });

  // 处理进程退出
  nextProcess.on('close', async (code) => {
    if (code !== 0 && restartCount < MAX_RESTARTS) {
      console.log(`\n⚠️ 进程退出 (code: ${code})，准备重启...\n`);
      restart();
    } else if (restartCount >= MAX_RESTARTS) {
      console.log('\n❌ 达到最大重启次数，请检查代码错误\n');
      process.exit(1);
    }
  });
}

// 重启服务器
async function restart() {
  restartCount++;
  console.log(`🔄 重启中... (${restartCount}/${MAX_RESTARTS})`);
  
  // 杀死旧进程
  if (nextProcess) {
    nextProcess.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 清理缓存
  await cleanCache();
  
  // 等待一段时间后重启
  await new Promise(resolve => setTimeout(resolve, RESTART_DELAY));
  startDev();
}

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n\n👋 正在关闭开发服务器...');
  if (nextProcess) {
    nextProcess.kill('SIGTERM');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (nextProcess) {
    nextProcess.kill('SIGTERM');
  }
  process.exit(0);
});

// 初始启动
await cleanCache();
startDev();
