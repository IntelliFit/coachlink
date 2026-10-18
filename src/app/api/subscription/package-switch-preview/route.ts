import { NextResponse } from 'next/server';
import { getApiUserId } from '@/lib/getApiUserId';
import { serviceRoleSupabase } from '@/lib/supabaseClient';
import { assertPackageQueueAvailable, getPackagePurchase, PACKAGE_SWITCH_POLICY } from '@/lib/subscriptionPackageQueue';

export async function POST(request: Request) {
  const userId = await getApiUserId(request);
  if (!userId) return NextResponse.json({ success: false, message: '请先登录', data: null }, { status: 401 });
  try {
    const { subscriptionId, coachId, productId, months } = await request.json();
    const { data: sub, error } = await serviceRoleSupabase.from('coach_subscriptions').select('student_id, coach_id, status')
      .eq('id', subscriptionId).maybeSingle();
    if (error || !sub || sub.student_id !== userId || sub.coach_id !== coachId) {
      return NextResponse.json({ success: false, message: '无权购买该订阅的接续套餐', data: null }, { status: 403 });
    }
    if (!['active', 'expired', 'near_expiry'].includes(String(sub.status))) throw new Error('请刷新订阅状态后重试');
    await assertPackageQueueAvailable();
    const purchase = await getPackagePurchase(coachId, productId, Number(months));
    return NextResponse.json({ success: true, message: '旧套餐用完后接续生效', data: { ...purchase, packageSwitchPolicy: PACKAGE_SWITCH_POLICY } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : '无法核对套餐', data: null }, { status: 400 });
  }
}
