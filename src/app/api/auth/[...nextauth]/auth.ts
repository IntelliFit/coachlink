import { getServerSession as _getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { headers } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import supabase from "@/lib/supabaseClient";
import { getAdminCredentialByUserId } from "@/lib/adminCredentials";

export async function getServerSession() {
    const session = await _getServerSession(authOptions);
    if (session?.user?.id) {
        if ((session.user as any).is_admin) {
            const credential = await getAdminCredentialByUserId(session.user.id);
            (session.user as any).has_admin_credential = Boolean(
                credential?.is_active !== false &&
                credential?.login_identifier &&
                credential?.password_hash,
            );
        }
        return session;
    }

    try {
        const headersList = await headers();
        const authorization = headersList.get("authorization");

        if (authorization?.startsWith("Bearer ")) {
            const token = authorization.substring(7);
            const decoded = verifyToken(token) as { userId?: string } | null;

            if (decoded?.userId) {
                const { data: user, error: userError } = await supabase
                    .from("users")
                    .select("*")
                    .eq("id", decoded.userId)
                    .single();

                if (userError || !user) {
                    console.error("[auth] 无法获取用户信息:", userError);
                    return null;
                }

                const { data: coachRow } = await supabase
                    .from("coaches")
                    .select("id, status")
                    .eq("user_id", user.id)
                    .maybeSingle();

                const isCoach = coachRow?.status === "approved";

                const { data: profile } = await supabase
                    .from("user_profiles")
                    .select("*")
                    .eq("user_id", user.id)
                    .maybeSingle();

                const userName = profile?.full_name || profile?.nickname || user.phone || user.email;

                const miniappSession = {
                    user: {
                        id: user.id,
                        name: userName,
                        email: user.email,
                        phone: user.phone,
                        is_coach: isCoach,
                        is_admin: user.is_admin ?? false,
                        coach_status: isCoach ? "approved" : "none",
                        primary_role: user.primary_role ?? (isCoach ? "coach" : "student"),
                    },
                    profile: profile || undefined,
                    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                };

                if (miniappSession.user.is_admin) {
                    const credential = await getAdminCredentialByUserId(user.id);
                    (miniappSession.user as any).has_admin_credential = Boolean(
                        credential?.is_active !== false &&
                        credential?.login_identifier &&
                        credential?.password_hash,
                    );
                }

                return miniappSession;
            }
        }
    } catch (error) {
        console.error("[auth] JWT 认证失败:", error);
    }

    return null;
}
