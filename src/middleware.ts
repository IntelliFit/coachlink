import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    });
                },
            },
        }
    );

    // 获取用户认证状态
    const { data } = await supabase.auth.getSession();
    const isAuthenticated = !!data.session;

    // 获取请求路径
    const path = request.nextUrl.pathname;

    // 公开路径（不需要认证）
    const publicPaths = ['/login', '/register', '/'];
    const isPublicPath = publicPaths.includes(path);

    // 如果访问受保护的路径但未认证，重定向到登录页
    if (!isPublicPath && !isAuthenticated) {
        console.log('enter');
        
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 如果已认证用户访问登录或注册页面，重定向到仪表板
    if ((path === '/login' || path === '/register') && isAuthenticated) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return response;
}

// 配置匹配路径
export const config = {
    matcher: [
        /*
         * 匹配所有请求路径，除了以特定扩展名结尾的文件
         */
        '/((?!_next/static|_next/image|favicon.ico|favicon.svg|themes).*)',
    ],
};