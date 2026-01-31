#!/usr/bin/env tsx
/**
 * 检查 VAPID 配置是否正确
 * 用法: tsx scripts/check-vapid.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// 加载环境变量
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
config({ path: resolve(process.cwd(), envFile) });

function checkVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  console.log('🔍 检查 VAPID 配置...\n');

  if (!publicKey || !publicKey.trim()) {
    console.error('❌ NEXT_PUBLIC_VAPID_PUBLIC_KEY 未配置');
    return false;
  } else {
    console.log('✅ NEXT_PUBLIC_VAPID_PUBLIC_KEY 已配置');
    console.log(`   长度: ${publicKey.length} 字符`);
  }

  if (!privateKey || !privateKey.trim()) {
    console.error('❌ VAPID_PRIVATE_KEY 未配置');
    return false;
  } else {
    console.log('✅ VAPID_PRIVATE_KEY 已配置');
    console.log(`   长度: ${privateKey.length} 字符`);
  }

  // 验证格式（VAPID 密钥通常是 base64url 编码，长度固定）
  if (publicKey.length < 80 || publicKey.length > 100) {
    console.warn('⚠️  NEXT_PUBLIC_VAPID_PUBLIC_KEY 长度异常，可能格式不正确');
  }

  if (privateKey.length < 40 || privateKey.length > 50) {
    console.warn('⚠️  VAPID_PRIVATE_KEY 长度异常，可能格式不正确');
  }

  console.log('\n✅ VAPID 配置检查通过！');
  console.log('\n💡 提示:');
  console.log('   - 开发环境: 确保 .env.development 中有这两个变量');
  console.log('   - 生产环境: 确保部署平台的环境变量中配置了这两个值');
  console.log('   - VAPID_PRIVATE_KEY 是敏感信息，不要提交到 Git');

  return true;
}

const isValid = checkVapidConfig();
process.exit(isValid ? 0 : 1);
