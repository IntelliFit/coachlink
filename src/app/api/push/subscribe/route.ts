import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { serviceRoleSupabase } from '@/lib/supabaseClient';

interface SubscriptionKeys {
  p256dh: string;
  auth: string;
}

interface SubscriptionPayload {
  endpoint: string;
  keys: SubscriptionKeys;
  expirationTime?: number | null;
}

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: '请先登录' }, { status: 401 });
  }

  let body: { subscription?: SubscriptionPayload };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: '请求体无效' }, { status: 400 });
  }

  const sub = body?.subscription;
  if (
    !sub ||
    typeof sub.endpoint !== 'string' ||
    !sub.keys ||
    typeof sub.keys.p256dh !== 'string' ||
    typeof sub.keys.auth !== 'string'
  ) {
    return NextResponse.json({ success: false, message: '订阅数据不完整' }, { status: 400 });
  }

  const userAgent = req.headers.get('user-agent') ?? undefined;

  const { error } = await (serviceRoleSupabase as any)
    .from('push_subscriptions')
    .upsert(
      {
        user_id: session.user.id,
        endpoint: sub.endpoint,
        keys_p256dh: sub.keys.p256dh,
        keys_auth: sub.keys.auth,
        user_agent: userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' }
    );

  if (error) {
    console.error('[push/subscribe] 写入失败:', error);
    return NextResponse.json({ success: false, message: '保存订阅失败' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: '已开启通知' });
}
