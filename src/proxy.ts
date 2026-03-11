import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as apiTrace from "@/app/api/middleware/api-trace";
import { getToken } from "next-auth/jwt";
import { verifyToken } from "./lib/jwt";

function getSupabaseRestConfig() {
    const supabaseUrl =
        process.env.NEXT_SUPABASE_URL ||
        process.env.SUPABASE_URL ||
        "";
    const serviceKey =
        process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        "";

    return { supabaseUrl: supabaseUrl.replace(/\/+$/, ""), serviceKey };
}

async function hasActivePlanInstanceForStudent(userId: string): Promise<boolean> {
    const { supabaseUrl, serviceKey } = getSupabaseRestConfig();
    if (!supabaseUrl || !serviceKey) {
        // If env is missing, we can't detect. Prefer conservative default: assume user has plan.
        return true;
    }

    const headers: Record<string, string> = {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        accept: "application/json",
    };

    // 1) Fast path: instances linked directly to student_id
    try {
        const u = new URL(`${supabaseUrl}/rest/v1/coach_plan_instances`);
        u.searchParams.set("select", "id");
        u.searchParams.set("student_id", `eq.${userId}`);
        u.searchParams.set("status", "in.(active,paused)");
        u.searchParams.set("limit", "1");
        const r = await fetch(u.toString(), { headers, cache: "no-store" as any });
        if (r.ok) {
            const json = (await r.json()) as any[];
            if (Array.isArray(json) && json.length > 0) return true;
        }
    } catch {
        // ignore
    }

    // 2) Fallback: old instances may only link to coach_subscription_id
    try {
        const su = new URL(`${supabaseUrl}/rest/v1/coach_subscriptions`);
        su.searchParams.set("select", "id");
        su.searchParams.set("student_id", `eq.${userId}`);
        su.searchParams.set("status", "eq.active");
        su.searchParams.set("limit", "20");
        const sr = await fetch(su.toString(), { headers, cache: "no-store" as any });
        if (!sr.ok) return false;
        const subs = (await sr.json()) as any[];
        const ids = (subs || []).map((s) => s?.id).filter(Boolean).slice(0, 20);
        if (ids.length === 0) return false;

        const iu = new URL(`${supabaseUrl}/rest/v1/coach_plan_instances`);
        iu.searchParams.set("select", "id");
        iu.searchParams.set("coach_subscription_id", `in.(${ids.join(",")})`);
        iu.searchParams.set("status", "in.(active,paused)");
        iu.searchParams.set("limit", "1");
        const ir = await fetch(iu.toString(), { headers, cache: "no-store" as any });
        if (!ir.ok) return false;
        const json = (await ir.json()) as any[];
        return Array.isArray(json) && json.length > 0;
    } catch {
        return false;
    }
}

const PUBLIC_PATHS = new Set([
    "/",
    "/market",
    "/about",
    "/articles",
    "/onboarding",
    "/login",
    "/register",
    "/wechat-auth/bridge",
    "/payment/start",
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
    '/api/captcha/slider/image',
    "/api/payment/alipay/notify", // Alipay callback - must be public
    "/api/payment/alipay/return", // Alipay return - browser redirect without session
    "/api/payment/alipay/query", // guest payment query
    "/api/payment/alipay/guest/create", // guest payment create (public)
    "/api/hello-world", // hello world test endpoint (public)
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
    '/verify_b072dddc83ed42fbd335c928e5dfa002.html',
    '/fonts/AlibabaPuHuiTi-3-85-Bold.ttf',
    '/fonts/AlibabaPuHuiTi-3-55-Regular.ttf',
    '/84WgJbHMbX.txt',
    '/api/captcha/slider/create'
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
    const fullPath = `${pathname}${request.nextUrl.search || ""}`;
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

    // Root entry routing:
    // - unauthenticated: go to Discover
    // - coach: go to coach dashboard
    // - student: if has active plan instance -> today-training, else discover
    if (pathname === "/") {
        const token = await getToken({ req: request, secret: NEXTAUTH_SECRET });
        const isAuthenticated = !!token;
        if (!isAuthenticated) {
            return NextResponse.redirect(`${origin}/coach/discovery`);
        }

        const isCoachView = token?.user?.is_coach && token?.user?.primary_role === "coach";
        if (isCoachView) {
            return NextResponse.redirect(`${origin}/dashboard/overview`);
        }

        const userId = token?.user?.id as string | undefined;
        if (!userId) {
            return NextResponse.redirect(`${origin}/today-training`);
        }

        const hasPlan = await hasActivePlanInstanceForStudent(userId);
        return NextResponse.redirect(hasPlan ? `${origin}/today-training` : `${origin}/coach/discovery`);
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
        // 公开 API（分享/公开文章等）
        pathname.startsWith("/api/public/") ||
        // 公共动作库（允许未登录访问）
        pathname.startsWith("/api/public-action-lib/") ||
        // 公开资讯文章详情（允许未登录预览与访客支付）
        pathname.startsWith("/articles/") ||
        // 公开可浏览：发现/教练主页（动作在页面内再做登录保护）
        pathname.startsWith("/coach/discovery") ||
        pathname.startsWith("/coach/profile") ||
        pathname.startsWith(AUTH_BASE_URL) ||
        pathname.startsWith(WECHAT_AUTH_BASE_URL)
    ) {
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
// 重要：sitemap.xml、robots.txt 必须排除，否则 Google Search Console 无法抓取
export const config = {
    matcher: [
        /*
         * 匹配所有请求路径，排除：
         * - 静态资源：_next/static, _next/image, favicon, themes, images
         * - SEO 文件：robots.txt, sitemap.xml, sitemap/*（Google 抓取必须不被 proxy 处理）
         * - site.webmanifest
         */
        "/((?!_next/static|_next/image|favicon\\.ico|favicon\\.jpg|themes|images|robots\\.txt|sitemap\\.xml|sitemap/.*|site\\.webmanifest).*)",
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
