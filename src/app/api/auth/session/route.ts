import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET!;

// 与 proxy 里一致：新 cookie 名 + 旧 cookie 名都认，老用户不掉线
const SESSION_COOKIE_NAMES = [
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
] as const;

/**
 * GET /api/auth/session
 * 与 NextAuth 默认 session 接口兼容，但同时读取新旧两种 cookie 名，保证带旧 cookie 的老用户仍能拿到 session。
 */
export async function GET(request: NextRequest) {
    for (const name of SESSION_COOKIE_NAMES) {
        const token = await getToken({
            req: request,
            secret: NEXTAUTH_SECRET,
            cookieName: name,
        } as { req: NextRequest; secret: string; cookieName: string });
        if (token?.user) {
            return NextResponse.json({
                user: token.user,
                expires: token.exp ? new Date(token.exp * 1000).toISOString() : null,
            });
        }
    }
    return NextResponse.json({});
}
