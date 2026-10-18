import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { isLocalDebugRequest, matchesLocalDebugPairingCode, signLocalDebugToken, LOCAL_DEBUG_SESSION_SECONDS } from '@/lib/localDebugLogin';

export const runtime = 'nodejs';

const reply = (body: object, status = 200) => NextResponse.json(body, {
    status, headers: { 'Cache-Control': 'no-store' },
});

export async function POST(req: NextRequest) {
    if (!isLocalDebugRequest(req)) return reply({ success: false, message: '本地调试登录未开启' }, 404);
    if (!matchesLocalDebugPairingCode(req.headers.get('x-coachlink-debug-code'))) {
        return reply({ success: false, message: '配对码不正确，请使用本次本地启动终端中的配对码' }, 403);
    }
    let body: { userId?: unknown };
    try { body = await req.json(); } catch { return reply({ success: false, message: '无效请求' }, 400); }
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
        return reply({ success: false, message: '请输入完整的用户 UUID' }, 400);
    }
    try {
        // Import only after all local gates pass; login performs SELECT only.
        const { serviceRoleSupabase: db } = await import('@/lib/supabaseClient');
        const { data: user, error } = await db.from('users')
            .select('id,phone,email,primary_role,is_admin,coach_status,subscription_level,subscription_expires_at').eq('id', userId).maybeSingle();
        if (error) throw error;
        if (!user) return reply({ success: false, message: '用户不存在，不会自动创建账号' }, 404);
        if (user.is_admin || user.primary_role === 'admin') return reply({ success: false, message: '不允许模拟管理员账号' }, 403);
        const [profileResult, coachResult] = await Promise.all([
            db.from('user_profiles').select('nickname,full_name,avatar_url').eq('user_id', userId).maybeSingle(),
            db.from('coaches').select('id').eq('user_id', userId).eq('status', 'approved').maybeSingle(),
        ]);
        if (profileResult.error || coachResult.error) throw new Error('读取角色或档案失败');
        const name = profileResult.data?.full_name || profileResult.data?.nickname ||
            (user.phone ? `手机用户_${user.phone.slice(-4)}` : '调试用户');
        const expiresAt = Date.now() + LOCAL_DEBUG_SESSION_SECONDS * 1000;
        const databaseFingerprint = createHash('sha256').update(process.env.NEXT_SUPABASE_URL || '').digest('hex').slice(0, 12);
        return reply({ success: true, data: {
            user: { ...user, name, nickname: name, avatar_url: profileResult.data?.avatar_url, is_coach: !!coachResult.data },
            token: signLocalDebugToken(userId),
            debug: { userId, name, expiresAt, apiBaseUrl: new URL(req.url).origin, databaseFingerprint },
        } });
    } catch {
        return reply({ success: false, message: '读取账号失败，请检查本地后端的数据源配置' }, 500);
    }
}
