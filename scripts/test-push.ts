#!/usr/bin/env tsx
/**
 * 测试 Web Push 推送功能
 * 用法: tsx scripts/test-push.ts <userId> "标题" "内容"
 * 
 * 示例:
 *   tsx scripts/test-push.ts user-123 "测试通知" "这是一条测试推送消息"
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// 加载环境变量
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
config({ path: resolve(process.cwd(), envFile) });

import { sendPushToUser } from '../src/lib/pushNotify';

const userId = process.argv[2];
const title = process.argv[3] || 'CoachLink 测试通知';
const body = process.argv[4] || '这是一条测试推送消息';

if (!userId) {
  console.error('❌ 请提供用户 ID');
  console.log('用法: tsx scripts/test-push.ts <userId> [标题] [内容]');
  process.exit(1);
}

async function testPush() {
  try {
    console.log(`📤 向用户 ${userId} 发送推送...`);
    console.log(`   标题: ${title}`);
    console.log(`   内容: ${body}`);
    
    const result = await sendPushToUser(userId, {
      title,
      body,
      url: '/messages',
      tag: 'test',
    });

    if (result.sent > 0) {
      console.log(`✅ 成功发送 ${result.sent} 条推送`);
      if (result.failed > 0) {
        console.log(`⚠️  失败 ${result.failed} 条（可能是无效订阅）`);
      }
    } else {
      console.log(`⚠️  未找到该用户的推送订阅`);
      console.log(`   提示: 用户需要先在应用中开启通知权限`);
    }
  } catch (error: any) {
    console.error('❌ 推送失败:', error.message);
    if (error.message.includes('未配置 VAPID')) {
      console.log('\n💡 请确保已配置环境变量:');
      console.log('   NEXT_PUBLIC_VAPID_PUBLIC_KEY');
      console.log('   VAPID_PRIVATE_KEY');
    }
    process.exit(1);
  }
}

testPush();
