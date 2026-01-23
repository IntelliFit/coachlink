import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { sendPushToUser } from '@/lib/pushNotify';

/**
 * 测试推送 API
 * GET /api/push/test?title=标题&body=内容
 */
export async function GET(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: '请先登录' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') || '测试通知';
  const body = searchParams.get('body') || '这是一条测试推送消息';

  try {
    const result = await sendPushToUser(session.user.id, {
      title,
      body,
      url: '/messages',
      tag: 'test',
    });

    return NextResponse.json({
      success: true,
      message: `推送已发送：成功 ${result.sent} 条，失败 ${result.failed} 条`,
      result,
    });
  } catch (error: any) {
    console.error('[push/test] 发送失败:', error);
    return NextResponse.json(
      { success: false, message: error.message || '发送推送失败' },
      { status: 500 }
    );
  }
}
