import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as apiTrace from "@/app/api/middleware/api-trace";
import { getToken } from "next-auth/jwt";
import { verifyToken } from "./lib/jwt";

const PUBLIC_PATHS = new Set([
    "/",
    "/market",
    "/about",
    "/articles",
    "/onboarding",
    "/login",
    "/register",
    "/wechat-auth/bridge",
    "/api/auth",
    "/api/miniapp/login", // 小程序登录接口
    "/api/miniapp/wechat-login", // 小程序微信登录接口
    "/api/sms/send-verification-code",
    "/api/ses/send-verification-code",
    "/api/coach/get-all-coaches",
    "/api/coach/get-coach", // 公开获取教练信息（页面内再做动作级登录保护）
    "/api/coach/get-aggregated-info", // 公开展示教练聚合信息（接口内部会剔除敏感字段）
    "/api/coach/get-pricing", // 公开展示教练服务商品
    "/api/coach/get-specialties", // 获取专长列表（公开接口）
    "/api/wechat/login/start",
    "/api/wechat/login/finish",
    '/api/trace',
    '/api/captcha/slider/create',
    '/api/captcha/slider/verify',
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
    "/site.webmanifest",
    "/sw.js", // Service Worker，须可匿名拉取以便注册
    "/sitemap.xml",
    "/BingSiteAuth.xml",
    '/baidu_verify_codeva-xPfI6tYHyK.html',
    '/fonts/AlibabaPuHuiTi-3-85-Bold.ttf',
    '/fonts/AlibabaPuHuiTi-3-55-Regular.ttf',
    '/84WgJbHMbX.txt'
]);

// 需要仅匹配前缀的路径（如 /api/auth/...）
const AUTH_BASE_URL = "/api/auth";

// 管理员路径前缀
const ADMIN_BASE_URL = "/admin";
// 微信网页登录相关页面前缀（如 /wechat-auth/bridge）
const WECHAT_AUTH_BASE_URL = "/wechat-auth";

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET!;

function handleMiddleware(request: NextRequest) {
    // 运行聚合中间件
    const { pathname, origin } = request.nextUrl;

    const middlewares = [apiTrace];
    for (const mw of middlewares) {
        if (matches(pathname, mw.matcher)) {
            // fire-and-forget，避免阻塞主逻辑
            void mw.handle(request);
        }
    }
}

export async function proxy(request: NextRequest) {

    handleMiddleware(request);
    const { pathname, origin } = request.nextUrl;
    // Internal server-to-server calls (e.g. background poster rendering) can bypass auth for specific endpoints.
    // This prevents middleware from returning 401 when the caller is the backend itself (no browser session).
    if (pathname.startsWith("/api/og/")) {
        const internalKey = process.env.INTERNAL_POSTER_KEY;
        const provided = request.headers.get("x-internal-poster-key");
        if (internalKey && provided && provided === internalKey) {
            return NextResponse.next();
        }
    }

    // 如果是 /icons/ 开头的，直接放行
    if (pathname.startsWith("/icons/")) {
        return NextResponse.next();
    }

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

    // 先检查是否是公共路径（包括登录接口/微信回调桥接页），如果是则直接放行
    if (
        PUBLIC_PATHS.has(pathname) ||
        pathname.startsWith("/articles") ||
        // 公开 API（分享/公开文章等）
        pathname.startsWith("/api/public/") ||
        // 公开可浏览：发现教练/教练主页（动作在页面内再做登录保护）
        pathname.startsWith("/coach/discovery") ||
        pathname.startsWith("/coach/profile") ||
        pathname.startsWith(AUTH_BASE_URL) ||
        pathname.startsWith(WECHAT_AUTH_BASE_URL)
    ) {
        if (pathname === "/") {
            const token = await getToken({ req: request, secret: NEXTAUTH_SECRET });
            const isAuthenticated = !!token;
            if (isAuthenticated) {
                const isCoachView = token?.user?.is_coach && token?.user?.primary_role === "coach";
                return NextResponse.redirect(
                    isCoachView ? `${origin}/dashboard/overview` : `${origin}/today-training`
                );
            }
        }
        return NextResponse.next();
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

function matches(pathname: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
        if (pattern === pathname) return true;
        // 将 /api/:path* 转为正则
        const regex = new RegExp(
            "^" +
            pattern
                .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
                .replace(/:path\*/g, ".*") +
            "$",
        );
        return regex.test(pathname);
    });
}
