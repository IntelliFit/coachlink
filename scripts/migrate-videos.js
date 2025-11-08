#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
);

// 迁移日志
const migrationLog = {
  startTime: new Date().toISOString(),
  totalProcessed: 0,
  successful: 0,
  failed: 0,
  errors: []
};

// 日志函数
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
  console.log(logEntry);
  
  if (type === 'error') {
    migrationLog.errors.push({ message, timestamp });
  }
}

// 获取旧视频数据
async function getOldVideoData() {
  log('开始获取旧视频数据...');
  
  const oldVideos = [];
  
  try {
    // 1. 从 workout_logs 获取训练视频
    const { data: workoutLogs, error: logsError } = await supabase
      .from('workout_logs')
      .select('id, user_id, training_plan_id, video_urls, created_at, week_number, day_of_week')
      .not('video_urls', 'is', null)
      .neq('video_urls', '{}');
    
    if (logsError) throw logsError;
    
    for (const log of workoutLogs || []) {
      for (const videoUrl of log.video_urls || []) {
        oldVideos.push({
          source: 'workout_logs',
          source_id: log.id,
          user_id: log.user_id,
          training_plan_id: log.training_plan_id,
          video_url: videoUrl,
          type: 'training',
          week_number: log.week_number,
          day_of_week: log.day_of_week,
          created_at: log.created_at
        });
      }
    }
    
    log(`获取到 ${oldVideos.length} 条旧视频数据`);
    return oldVideos;
    
  } catch (error) {
    log(`获取旧视频数据失败: ${error.message}`, 'error');
    return [];
  }
}

// 转换旧数据到新格式
function transformVideoData(oldVideo) {
  return {
    user_id: oldVideo.user_id,
    coach_id: oldVideo.coach_id || null,
    type: oldVideo.type || 'training',
    training_plan_id: oldVideo.training_plan_id || null,
    training_session_id: oldVideo.training_session_id || null,
    workout_log_id: oldVideo.source === 'workout_logs' ? oldVideo.source_id : null,
    exercise_name: oldVideo.exercise_name || null,
    week_number: oldVideo.week_number || null,
    day_of_week: oldVideo.day_of_week || null,
    video_url: oldVideo.video_url,
    thumbnail_url: oldVideo.thumbnail_url || null,
    file_size: oldVideo.file_size || null,
    duration_seconds: oldVideo.duration_seconds || null,
    requires_review: oldVideo.requires_review !== undefined ? oldVideo.requires_review : false,
    review_status: oldVideo.review_status || 'not_required',
    coach_feedback: {},
    user_notes: oldVideo.user_notes || null,
    tags: [oldVideo.type],
    processing_status: 'ready',
    created_at: oldVideo.created_at || new Date().toISOString(),
    updated_at: oldVideo.updated_at || new Date().toISOString(),
    reviewed_at: oldVideo.reviewed_at || null
  };
}

// 分批插入数据
async function batchInsert(videos, batchSize = 50) {
  log(`开始批量插入 ${videos.length} 条视频数据...`);
  
  for (let i = 0; i < videos.length; i += batchSize) {
    const batch = videos.slice(i, i + batchSize);
    log(`处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(videos.length / batchSize)}`);
    
    try {
      const { data, error } = await supabase
        .from('training_videos')
        .insert(batch)
        .select();

      if (error) {
        log(`批次插入失败: ${error.message}`, 'error');
        migrationLog.failed += batch.length;
      } else {
        migrationLog.successful += batch.length;
        log(`批次插入成功: ${batch.length} 条数据`);
      }
    } catch (error) {
      log(`批次处理错误: ${error.message}`, 'error');
      migrationLog.failed += batch.length;
    }
  }
}

// 生成迁移报告
function generateReport() {
  const report = {
    ...migrationLog,
    endTime: new Date().toISOString(),
    duration: new Date() - new Date(migrationLog.startTime),
    summary: {
      totalProcessed: migrationLog.totalProcessed,
      successful: migrationLog.successful,
      failed: migrationLog.failed,
      successRate: ((migrationLog.successful / migrationLog.totalProcessed) * 100).toFixed(2) + '%'
    }
  };

  const reportPath = path.join(process.cwd(), 'video-migration-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  log(`迁移报告已生成: ${reportPath}`);
  return report;
}

// 主迁移函数
async function migrateVideos() {
  try {
    log('开始视频数据迁移...');
    
    // 1. 获取旧数据
    const oldVideos = await getOldVideoData();
    migrationLog.totalProcessed = oldVideos.length;
    
    if (oldVideos.length === 0) {
      log('没有找到需要迁移的视频数据');
      return;
    }

    // 2. 转换并插入数据
    const transformedVideos = oldVideos.map(transformVideoData);
    await batchInsert(transformedVideos);

    // 3. 生成报告
    const report = generateReport();
    
    log(`迁移完成: 成功 ${report.summary.successful}, 失败 ${report.summary.failed}, 成功率 ${report.summary.successRate}`);
    
  } catch (error) {
    log(`迁移过程发生错误: ${error.message}`, 'error');
    process.exit(1);
  }
}

// 回滚函数
async function rollbackMigration() {
  log('开始回滚迁移...');
  
  try {
    const { error } = await supabase
      .from('training_videos')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      log(`回滚失败: ${error.message}`, 'error');
    } else {
      log('回滚成功');
    }
  } catch (error) {
    log(`回滚错误: ${error.message}`, 'error');
  }
}

// 验证迁移结果
async function validateMigration() {
  log('开始验证迁移结果...');
  
  try {
    const { count, error } = await supabase
      .from('training_videos')
      .select('*', { count: 'exact', head: true });

    if (error) {
      log(`验证失败: ${error.message}`, 'error');
      return false;
    }

    log(`验证结果: 新表中共有 ${count} 条记录`);
    return true;
  } catch (error) {
    log(`验证错误: ${error.message}`, 'error');
    return false;
  }
}

// 命令行参数处理
const command = process.argv[2];

switch (command) {
  case 'migrate':
    migrateVideos().then(() => process.exit(0));
    break;
  case 'rollback':
    rollbackMigration().then(() => process.exit(0));
    break;
  case 'validate':
    validateMigration().then(() => process.exit(0));
    break;
  default:
    console.log('使用方法:');
    console.log('  node migrate-videos.js migrate    # 执行迁移');
    console.log('  node migrate-videos.js rollback   # 回滚迁移');
    console.log('  node migrate-videos.js validate   # 验证迁移结果');
    process.exit(1);
}