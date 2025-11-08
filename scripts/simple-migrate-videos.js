#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with local development defaults
const supabase = createClient(
  'http://localhost:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
);

// 日志函数
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// 主迁移函数
async function migrateVideos() {
  try {
    log('开始视频数据迁移...');
    
    // 1. 检查当前训练视频数量
    const { count: currentCount } = await supabase
      .from('training_videos')
      .select('*', { count: 'exact', head: true });
    
    log(`当前训练视频数量: ${currentCount || 0}`);
    
    // 2. 从 workout_logs 迁移视频URL
    const { data: workoutLogs, error: logsError } = await supabase
      .from('workout_logs')
      .select('id, user_id, training_plan_id, video_urls, created_at, week_number, day_of_week')
      .not('video_urls', 'is', null)
      .neq('video_urls', '{}');
    
    if (logsError) {
      log(`获取workout_logs失败: ${logsError.message}`);
      return;
    }
    
    if (!workoutLogs || workoutLogs.length === 0) {
      log('没有找到需要迁移的视频数据');
      return;
    }
    
    log(`找到 ${workoutLogs.length} 条workout_logs包含视频`);
    
    let totalInserted = 0;
    
    // 3. 转换并插入数据
    for (const log of workoutLogs) {
      const videoUrls = Array.isArray(log.video_urls) ? log.video_urls : [log.video_urls];
      
      for (const videoUrl of videoUrls) {
        if (!videoUrl) continue;
        
        const videoData = {
          user_id: log.user_id,
          type: 'completion',
          training_plan_id: log.training_plan_id,
          workout_log_id: log.id,
          video_url: videoUrl,
          requires_review: false,
          review_status: 'not_required',
          coach_feedback: {},
          tags: ['completion'],
          processing_status: 'ready',
          created_at: log.created_at || new Date().toISOString(),
          updated_at: log.created_at || new Date().toISOString()
        };
        
        const { error: insertError } = await supabase
          .from('training_videos')
          .insert(videoData);
        
        if (insertError) {
          log(`插入失败: ${insertError.message}`);
        } else {
          totalInserted++;
          log(`成功插入视频: ${videoUrl.substring(0, 50)}...`);
        }
      }
    }
    
    log(`迁移完成！共插入 ${totalInserted} 条训练视频`);
    
  } catch (error) {
    log(`迁移错误: ${error.message}`);
    process.exit(1);
  }
}

// 验证迁移结果
async function validateMigration() {
  try {
    const { count } = await supabase
      .from('training_videos')
      .select('*', { count: 'exact', head: true });
    
    log(`验证结果: 新表中共有 ${count || 0} 条记录`);
    return true;
  } catch (error) {
    log(`验证失败: ${error.message}`);
    return false;
  }
}

// 命令行处理
const command = process.argv[2];

switch (command) {
  case 'migrate':
    migrateVideos().then(() => process.exit(0));
    break;
  case 'validate':
    validateMigration().then(() => process.exit(0));
    break;
  default:
    console.log('使用方法:');
    console.log('  node simple-migrate-videos.js migrate');
    console.log('  node simple-migrate-videos.js validate');
    process.exit(1);
}