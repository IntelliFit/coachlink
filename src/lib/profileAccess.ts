import supabase from './supabaseClient';

/**
 * 读取他人 user_profiles 时的访问级别：
 * - full：本人、管理员、或该学员的教练（存在任意状态的 coach_subscriptions，含待确认付款）
 * - public：其他已登录用户，只能看到公开名片字段（不含手机号、地址、出生日期、真实姓名等）
 */
export type ProfileAccessLevel = 'full' | 'public';

// 其他用户可见的公开名片字段：聊天对象昵称头像、小程序用户主页（me/user）展示的健身档案
export const PUBLIC_PROFILE_COLUMNS =
    'id, user_id, nickname, avatar_url, bio, gender, age, height, weight, fitness_goal, fitness_level';

interface ResolveProfileAccessParams {
    viewerId: string;
    targetUserId: string;
    viewerIsAdmin?: boolean;
}

export async function isCoachOfStudent(coachUserId: string, studentUserId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('coach_subscriptions')
        .select('id, coaches!inner(user_id)')
        .eq('coaches.user_id', coachUserId)
        .eq('student_id', studentUserId)
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('[profileAccess] coach-student check failed:', error);
        return false;
    }
    return !!data;
}

export async function resolveProfileAccess({
    viewerId,
    targetUserId,
    viewerIsAdmin = false,
}: ResolveProfileAccessParams): Promise<ProfileAccessLevel> {
    if (viewerId === targetUserId || viewerIsAdmin) {
        return 'full';
    }
    return (await isCoachOfStudent(viewerId, targetUserId)) ? 'full' : 'public';
}
