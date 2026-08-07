import { NextRequest } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { verifyToken } from './jwt';
import supabase from './supabaseClient';

export interface AuthResult {
    userId: string | null;
    user: any | null;
    isAuthenticated: boolean;
}

/**
 * 统一的鉴权函数
 * 支持两种方式（按优先级）：
 * 1. 网页端：从Cookie中读取NextAuth session（优先，保持向后兼容）
 * 2. 小程序端：从Authorization header中读取JWT token（备用）
 * 
 * 这样既不影响现有的网页端功能，又支持小程序端
 */
export async function getAuthUser(req: NextRequest | Request): Promise<AuthResult> {
    // 方式1：优先尝试从Cookie中获取NextAuth session（网页端）
    // 这是原有的鉴权方式，保持向后兼容
    try {
        const session = await getServerSession();
        if (session?.user?.id) {
            return {
                userId: session.user.id,
                user: session.user,
                isAuthenticated: true
            };
        }
    } catch (error) {
        // 如果获取session失败，继续尝试token方式
        console.debug('Session auth failed, trying token auth:', error);
    }

    // 方式2：尝试从Authorization header中获取JWT token（小程序端）
    const authHeader = typeof req.headers?.get === 'function'
        ? req.headers.get('authorization')
        : null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decoded = verifyToken(token) as { userId?: string; phone?: string; email?: string } | null;
        
        if (decoded && decoded.userId) {
            // 从数据库获取完整的用户信息
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', decoded.userId)
                .single();

            if (user && !error) {
                const { password_hash, ...userWithoutPassword } = user;
                return {
                    userId: decoded.userId,
                    user: userWithoutPassword,
                    isAuthenticated: true
                };
            }
        }
    }

    // 两种方式都失败，返回未认证
    return {
        userId: null,
        user: null,
        isAuthenticated: false
    };
}

