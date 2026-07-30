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
    if (!supabaseUrl || !serviceKey) return true;

    const headers: Record<string, string> = {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        accept: "application/json",
    };

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
    } catch {}

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
    "/toolbox",
    "/toolbox/motion-effects",
    "/toolbox/power-analysis",
    "/admin/login",
    "/wechat-auth/bridge",
    "/payment/start",
    "/api/auth",
    "/api/miniapp/login",
    "/api/miniapp/wechat-login",
    "/api/sms/send-verification-code",
    "/api/ses/send-verification-code",
    "/api/coach/get-all-coaches",
    "/api/coach/get-coach",
    "/api/coach/get-aggregated-info",
    "/api/coach/get-public-reviews",
    "/api/coach/get-pricing",
    "/api/coach/get-specialties",
    "/api/wechat/login/start",
    "/api/wechat/login/finish",
    "/api/trace",
    "/api/captcha/slider/create",
    "/api/captcha/slider/verify",
    "/api/captcha/slider/image",
    "/api/payment/alipay/notify",
    "/api/payment/alipay/return",
    "/api/payment/alipay/query",
    "/api/payment/alipay/guest/create",
    "/api/payment/wechat/notify",
    "/api/og/streetlifting-location",
    "/api/miniapp/qrcode/streetlifting-location",
    "/api/streetlifting-index/stats",
    "/api/streetlifting-index/formulas/list",
    "/api/streetlifting-index/submissions/list",
    "/api/streetlifting-index/locations/get",
    "/api/streetlifting-index/locations/list",
    "/api/streetlifting-index/locations/contributors",
    "/api/streetlifting-index/locations/map-pins",
    "/api/hello-world",
    "/api/system/version",
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
    "/sw.js",
    "/sitemap.xml",
    "/BingSiteAuth.xml",
    "/baidu_verify_codeva-xPfI6tYHyK.html",
    "/verify_b072dddc83ed42fbd335c928e5dfa002.html",
    "/fonts/AlibabaPuHuiTi-3-85-Bold.ttf",
    "/fonts/AlibabaPuHuiTi-3-55-Regular.ttf",
    "/84WgJbHMbX.txt",
]);

const AUTH_BASE_URL = "/api/auth";
const ADMIN_BASE_URL = "/admin";
const WECHAT_AUTH_BASE_URL = "/wechat-auth";
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET!;

// These internal jobs authenticate inside their Node route handlers with
// HUIFU_SETTLEMENT_CRON_SECRET / CRON_SECRET. The proxy runs before routes and
// can only validate user JWTs, so it must not turn a valid cron request into a
// generic "用户未登录" response before the route receives its x-cron-secret.
const ROUTE_AUTHENTICATED_CRON_PATHS = new Set([
    "/api/admin/coach-subscription-settlements/process-due",
    "/api/admin/coach-subscription-settlements/reconcile",
]);

function handleMiddleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const middlewares = [apiTrace];
    for (const mw of middlewares) {
        if (matches(pathname, mw.matcher)) {
            void mw.handle(request);
        }
    }
}

export async function proxy(request: NextRequest) {
    handleMiddleware(request);
    const { pathname, origin } = request.nextUrl;

    if (pathname.startsWith("/api/og/")) {
        const internalKey = process.env.INTERNAL_POSTER_KEY;
        const provided = request.headers.get("x-internal-poster-key");
        if (internalKey && provided && provided === internalKey) {
            return NextResponse.next();
        }
    }

    if (pathname.startsWith("/icons/")) {
        return NextResponse.next();
    }

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

    if (pathname.startsWith("/api/test/e2e/")) {
        if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
            const expected = process.env.E2E_SECRET;
            if (!expected) return NextResponse.next();
            const provided = request.headers.get("x-e2e-secret");
            if (provided && provided === expected) return NextResponse.next();
        }
    }

    if (
        PUBLIC_PATHS.has(pathname) ||
        pathname.startsWith("/api/healthy") ||
        pathname.startsWith("/api/health") ||
        ROUTE_AUTHENTICATED_CRON_PATHS.has(pathname) ||
        pathname.startsWith("/api/system/version") ||
        pathname.startsWith("/api/public/") ||
        pathname.startsWith("/api/public-action-lib/") ||
        pathname.startsWith("/api/toolbox/motion-effects/") ||
        pathname.startsWith("/articles/") ||
        pathname.startsWith("/coach/discovery") ||
        pathname.startsWith("/coach/profile") ||
        pathname.startsWith(AUTH_BASE_URL) ||
        pathname.startsWith(WECHAT_AUTH_BASE_URL)
    ) {
        return NextResponse.next();
    }

    if (pathname.startsWith("/api/")) {
        const authHeader = request.headers.get("authorization");
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.substring(7);
            const decoded = verifyToken(token);
            if (decoded) {
                return NextResponse.next();
            }
        }

        const token = await getToken({ req: request, secret: NEXTAUTH_SECRET });
        if (token) {
            return NextResponse.next();
        }

        return NextResponse.json(
            { success: false, message: "用户未登录", data: null },
            { status: 401 },
        );
    }

    const token = await getToken({ req: request, secret: NEXTAUTH_SECRET });
    const isAuthenticated = !!token;

    if (pathname === "/admin/login") {
        if (!isAuthenticated) {
            return NextResponse.next();
        }

        if (token?.user?.is_admin === true) {
            return NextResponse.redirect(`${origin}/admin/payments`);
        }

        return NextResponse.redirect(`${origin}/`);
    }

    if (!isAuthenticated) {
        if (pathname.startsWith(ADMIN_BASE_URL)) {
            return NextResponse.redirect(`${origin}/admin/login`);
        }
        return NextResponse.redirect(`${origin}/login`);
    }

    if ((pathname === "/login" || pathname === "/register") && isAuthenticated) {
        return NextResponse.redirect(`${origin}/`);
    }

    if (pathname.startsWith(ADMIN_BASE_URL)) {
        const isAdmin = token?.user?.is_admin === true;
        if (!isAdmin) {
            return NextResponse.redirect(`${origin}/admin/login`);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon\\.ico|favicon\\.jpg|themes|images|robots\\.txt|sitemap\\.xml|sitemap/.*|site\\.webmanifest).*)",
    ],
};

function matches(pathname: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
        if (pattern === pathname) return true;
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
