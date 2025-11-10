import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
    // 对于API路由、静态资源等不应用认证检查
    const publicPaths = ['/login', '/register', '/', '/api/auth'];
    const path = request.nextUrl.pathname;
    
    // 检查是否为公开路径
    const isPublicPath = publicPaths.some(publicPath => 
        path.startsWith(publicPath));
    
    // 检查认证状态
    const token = await getToken({ 
        req: request, 
        secret: process.env.NEXTAUTH_SECRET 
    });

    console.log(path);
    console.log(token);
    
    
    
    const isAuthenticated = !!token;

    // 如果访问受保护的路径但未认证，重定向到登录页
    if (!isPublicPath && !isAuthenticated) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 如果已认证用户访问登录或注册页面，重定向到仪表板
    if ((path === '/login' || path === '/register') && isAuthenticated) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    return response;
}

// 配置匹配路径
export const config = {
    matcher: [
        /*
         * 匹配所有请求路径，除了以特定扩展名结尾的文件和API路由
         */
        '/((?!_next/static|_next/image|favicon.ico|favicon.svg|themes).*)',
    ],
};