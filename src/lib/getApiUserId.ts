import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { verifyToken } from "@/lib/jwt";

/**
 * 获取当前 API 请求的用户 ID。
 * 优先从 Authorization: Bearer <JWT> 解析（小程序等无 Cookie 场景），
 * 否则从 NextAuth session 获取（网页端）。
 * @returns 用户 ID，未登录时返回 null
 */
export async function getApiUserId(request: NextRequest): Promise<string | null> {
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7).trim();
        if (token) {
            const payload = verifyToken(token);
            if (payload && typeof payload === "object" && "userId" in payload) {
                const userId = (payload as { userId?: string }).userId;
                if (typeof userId === "string") return userId;
            }
        }
    }
    const session = await getServerSession(authOptions);
    return session?.user?.id ?? null;
}
