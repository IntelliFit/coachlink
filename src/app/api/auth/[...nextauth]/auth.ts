import { getServerSession as _getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { headers } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import supabase from '@/lib/supabaseClient';

/**
 * 统一的会话获取函数
 * 支持两种认证方式：
 * 1. next-auth session（网页端，通过 cookies）
 * 2. JWT Bearer token（小程序端，通过 Authorization header）
 */
export async function getServerSession() {
    // 1. 先尝试 next-auth session（网页端）
    const session = await _getServerSession(authOptions);
    if (session?.user?.id) {
        return session;
    }

    // 2. 如果没有 session，检查 Authorization header（小程序端）
    try {
        const headersList = await headers();
        const authorization = headersList.get('authorization');
        
        if (authorization?.startsWith('Bearer ')) {
            const token = authorization.substring(7);
            const decoded = verifyToken(token) as { userId?: string } | null;
            
            if (decoded?.userId) {
                // 从数据库获取用户信息构建 session
                const { data: user, error: userError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', decoded.userId)
                    .single();
                
                if (userError || !user) {
                    console.error('[auth] 无法获取用户信息:', userError);
                    return null;
                }
                
                // 检查是否是教练
                const { data: coachRow } = await supabase
                    .from('coaches')
                    .select('id, status')
                    .eq('user_id', user.id)
                    .eq('status', 'approved')
                    .maybeSingle();
                
                const isCoach = !!coachRow;
                
                // 获取用户档案
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();
                
                // 获取用户名称（优先使用 profile 中的名称）
                const userName = profile?.full_name || profile?.nickname || user.phone || user.email;
                
                // 构建与 next-auth session 兼容的对象
                const miniappSession = {
                    user: {
                        id: user.id,
                        name: userName,
                        email: user.email,
                        phone: user.phone,
                        is_coach: isCoach,
                        is_admin: user.is_admin ?? false,
                        coach_status: isCoach ? 'approved' : 'none',
                        primary_role: user.primary_role ?? (isCoach ? 'coach' : 'student'),
                    },
                    profile: profile || undefined,
                    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                };
                
                console.log('[auth] 小程序 JWT 认证成功:', { userId: user.id, name: userName });
                return miniappSession;
            }
        }
    } catch (error) {
        console.error('[auth] JWT 认证失败:', error);
    }

    return null;
}
