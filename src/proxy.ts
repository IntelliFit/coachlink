import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { verifyToken } from "./lib/jwt";

const PUBLIC_PATHS = new Set([
    "/",
    "/login",
    "/register",
    "/api/auth",
    "/api/miniapp/login", // 小程序登录接口
    "/api/sms/send-verification-code",
    "/api/ses/send-verification-code",
    "/api/coach/get-all-coaches",
    "/api/payment/alipay/notify", // Alipay callback - must be public
    "/docs/agreement",
    "/docs/disclaimer",
    "/disclaimer",
    "/docs/disclaimer.md",
    "/privacy",
    "/terms",
    "/docs/terms.md",
    "/contact",
    "/docs/contact.md",
    '/fonts/AlibabaPuHuiTi-3-85-Bold.ttf',
    '/fonts/AlibabaPuHuiTi-3-55-Regular.ttf'
]);

// 需要仅匹配前缀的路径（如 /api/auth/...）
const AUTH_BASE_URL = "/api/auth";

// 管理员路径前缀
const ADMIN_BASE_URL = "/admin";

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET!;

export async function proxy(request: NextRequest) {
    const { pathname, origin } = request.nextUrl;

    // E2E test helper APIs: allow bypassing auth in dev/test when the secret matches.
    // This lets Playwright seed/cleanup data without being redirected to `/login`.
    if (pathname.startsWith("/api/test/e2e/")) {
        if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
            const expected = process.env.E2E_SECRET;
            // If E2E_SECRET is configured, require it. Otherwise allow (local dev convenience).
            if (!expected) return NextResponse.next();
            const provided = request.headers.get("x-e2e-secret");
            if (provided && provided === expected) return NextResponse.next();
        }
        // In non-dev/test, or with missing/invalid secret, fall through to normal auth checks.
    }

    // API 路由：支持 JWT token 和 NextAuth session 两种鉴权方式
    // API 路由自己会通过 getAuthUser 函数处理鉴权，middleware 只需要验证token是否有效
    if (pathname.startsWith("/api/")) {
        // 先尝试 JWT token（小程序）
        const authHeader = request.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = verifyToken(token);
            if (decoded) {
                // JWT token 有效，放行
                return NextResponse.next();
            }
        }

        // 再尝试 NextAuth session（网页端）
        const token = await getToken({ req: request, secret: NEXTAUTH_SECRET });
        if (token) {
            // NextAuth session 有效，放行
            return NextResponse.next();
        }

        // 两种方式都无效，返回 401 错误（注意：API 路由返回 JSON，不要重定向）
        return NextResponse.json(
            { success: false, message: '用户未登录', data: null },
            { status: 401 }
        );
    }

    // 页面路由：仅使用 NextAuth session
    const token = await getToken({ req: request, secret: NEXTAUTH_SECRET });
    const isAuthenticated = !!token;
    
    // 公共路由 或者 鉴权路由直接放行
    if (PUBLIC_PATHS.has(pathname) || pathname.startsWith(AUTH_BASE_URL)) {
        if (pathname === "/") {
            const token = await getToken({ req: request, secret: NEXTAUTH_SECRET });
            const isAuthenticated = !!token;
            if (isAuthenticated) {
                return NextResponse.redirect(`${origin}/today-training`);
            }
        }
        return NextResponse.next();
    }

    // 未认证访问受保护页面 → 重定向登录
    if (!isAuthenticated) {
        return NextResponse.redirect(`${origin}/login`);
    }

    // 已认证访问登录/注册 → 重定向首页
    if (
        (pathname === "/login" || pathname === "/register") && isAuthenticated
    ) {
        return NextResponse.redirect(`${origin}/`);
    }

    // 管理员路由访问控制
    if (pathname.startsWith(ADMIN_BASE_URL)) {
        console.log(token);

        // 检查用户是否为管理员
        const isAdmin = token?.user?.is_admin === true;

        // 非管理员访问管理员页面 → 重定向首页
        if (!isAdmin) {
            return NextResponse.redirect(`${origin}/`);
        }
    }

    return NextResponse.next();
}

// 配置匹配路径
export const config = {
    matcher: [
        /*
         * 匹配所有请求路径，除了以特定扩展名结尾的文件和API路由
         */
        "/((?!_next/static|_next/image|favicon.ico|favicon.jpg|themes|images).*)",
    ],
};
