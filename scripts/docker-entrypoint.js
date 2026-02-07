#!/usr/bin/env node
/**
 * Docker 入口：运行时从挂载的 .env 文件加载环境变量，再启动 server
 * 用法：挂载 env 文件到 /app/.env.production 或 /app/.env
 */
const fs = require('fs');
const path = require('path');

const envPaths = [
  path.join(__dirname, '..', '.env.production'),
  path.join(__dirname, '..', '.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim();
          // 去掉首尾引号
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            process.env[key] = val.slice(1, -1);
          } else {
            process.env[key] = val;
          }
        }
      }
    });
    console.log(`Loaded env from ${path.basename(envPath)}`);
    break;
  }
}

require(path.join(__dirname, '..', 'server.js'));
