import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

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



    // 仅当访问受保护资源时才解码 token
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
