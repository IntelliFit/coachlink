import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';

/**
 * 测试推送 API（已废弃）
 * 推送通知现在完全由前端通过 Service Worker 处理
 * 请在前端使用 showNotification 函数进行测试
 */
export async function GET(req: Request) {
  return NextResponse.json({
    success: false,
    message: '此 API 已废弃。推送通知现在完全由前端通过 Service Worker 处理。请在前端使用 showNotification 函数进行测试。',
  }, { status: 410 }); // 410 Gone
}
