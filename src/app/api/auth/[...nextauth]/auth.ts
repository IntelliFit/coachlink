import { getServerSession as _getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { headers } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import supabase from "@/lib/supabaseClient";
import { getAdminCredentialByUserId } from "@/lib/adminCredentials";

// PostgREST 对 .single() 查不到行时返回的错误码
const NO_ROWS_ERROR_CODE = "PGRST116";

export interface GetServerSessionOptions {
    /**
     * Bearer token 被明确判定无效时回调：token 校验失败，或数据库里没有该用户。
     * getAuthUser 据此跳过对同一 token 的重复 users 查询。
     * 网络错误等不确定的失败不会触发。
     */
    onRejectedBearerToken?: (token: string) => void;
}

function hasActiveAdminCredential(credential: Awaited<ReturnType<typeof getAdminCredentialByUserId>>) {
    return Boolean(
        credential?.is_active !== false &&
        credential?.login_identifier &&
        credential?.password_hash,
    );
}

export async function getServerSession(options: GetServerSessionOptions = {}) {
    const session = await _getServerSession(authOptions);
    if (session?.user?.id) {
        if ((session.user as any).is_admin) {
            const credential = await getAdminCredentialByUserId(session.user.id);
            (session.user as any).has_admin_credential = hasActiveAdminCredential(credential);
        }
        return session;
    }

    try {
        const headersList = await headers();
        const authorization = headersList.get("authorization");

        if (authorization?.startsWith("Bearer ")) {
            const token = authorization.substring(7);
            const decoded = verifyToken(token) as { userId?: string } | null;

            if (!decoded?.userId) {
                options.onRejectedBearerToken?.(token);
                return null;
            }

            const { data: user, error: userError } = await supabase
                .from("users")
                .select("*")
                .eq("id", decoded.userId)
                .single();

            if (userError || !user) {
                console.error("[auth] 无法获取用户信息:", userError);
                if (!userError || userError.code === NO_ROWS_ERROR_CODE) {
                    options.onRejectedBearerToken?.(token);
                }
                return null;
            }

            const isAdmin = user.is_admin ?? false;
            // users 之后的三个查询互不依赖，并行发起以减少往返
            const [{ data: coachRow }, { data: profile }, adminCredential] = await Promise.all([
                supabase
                    .from("coaches")
                    .select("id, status")
                    .eq("user_id", user.id)
                    .maybeSingle(),
                supabase
                    .from("user_profiles")
                    .select("*")
                    .eq("user_id", user.id)
                    .maybeSingle(),
                isAdmin ? getAdminCredentialByUserId(user.id) : Promise.resolve(null),
            ]);

            const isCoach = coachRow?.status === "approved";
            const userName = profile?.full_name || profile?.nickname || user.phone || user.email;

            const miniappSession = {
                user: {
                    id: user.id,
                    name: userName,
                    email: user.email,
                    phone: user.phone,
                    is_coach: isCoach,
                    is_admin: isAdmin,
                    coach_status: isCoach ? "approved" : "none",
                    primary_role: user.primary_role ?? (isCoach ? "coach" : "student"),
                },
                profile: profile || undefined,
                expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            };

            if (isAdmin) {
                (miniappSession.user as any).has_admin_credential = hasActiveAdminCredential(adminCredential);
            }

            return miniappSession;
        }
    } catch (error) {
        console.error("[auth] JWT 认证失败:", error);
    }

    return null;
}
