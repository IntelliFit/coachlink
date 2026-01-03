// app/api/auth/[...nextauth]/route.ts
import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import supabase from "@/lib/supabaseClient";
import { verifyPassword } from "./verify";
import redis from "@/lib/redisClient";
import { getWhiteList } from "@/lib/devUsers";

export const authOptions: AuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                phone: { label: "Phone", type: "text" },
                password: { label: "Password", type: "password" },
                verifyCode: { label: "verifyCode", type: "text" },
            },
            async authorize(credentials) {
                // 如果是开发者模式 获取白名单
                const whiteList = getWhiteList();
                if (
                    !whiteList.some((user) => user.phone === credentials?.phone)
                ) {
                    if (!credentials?.verifyCode) {
                        throw new Error("请输入验证码");
                    }

                    // 开发模式下接受模拟验证码 123456
                    const useMockSms = process.env.NODE_ENV === "development";
                    const isMockCode = useMockSms &&
                        credentials.verifyCode.trim() === "123456";

                    if (!isMockCode) {
                        // 验证验证码
                        if (!redis) {
                            throw new Error("验证服务不可用");
                        }

                        const storedCode = await redis.get(
                            `sms_verification_code:${credentials.phone.trim()}`,
                        );
                        if (!storedCode) {
                            throw new Error("验证码已过期或不存在");
                        }

                        if (storedCode !== credentials.verifyCode.trim()) {
                            throw new Error("验证码错误");
                        }

                        // 验证成功后删除验证码，防止重复使用
                        await redis.del(
                            `sms_verification_code:${credentials.phone.trim()}`,
                        );
                    }
                }

                if (!credentials?.phone || !credentials?.password) {
                    throw new Error("请输入手机号和密码");
                }

                // 查询用户
                const { data: user, error: userError } = await supabase
                    .from("users")
                    .select("*")
                    .eq("phone", credentials.phone.trim())
                    .single();

                if (userError || !user) {
                    throw new Error("用户不存在\n" + userError?.message);
                }

                const isValid = verifyPassword(
                    credentials.password.trim(),
                    user.password_hash,
                );
                if (!isValid) {
                    throw new Error("密码错误");
                }

                // 返回用户信息（会保存到 token / session）
                (user as any).password_hash = undefined;
                return user;
            },
        }),
    ],
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                (user as any).password_hash = undefined;
                token.user = user;
            }
            return token;
        },
        async session({ session, token }) {
            const user = token.user;
            if (!user) {
                // 说明此时没有登陆
                return session;
            }

            (user as any).password_hash = undefined;
            session.user = token.user;

            // 统一以 coaches 表为教练资格真源；users 仅同步 is_admin / primary_role
            // 有一条 coaches.status='approved' 且 user_id 匹配，则视为具备教练资格
            const { data: coachRow } = await supabase
                .from("coaches")
                .select("id, status")
                .eq("user_id", user.id)
                .eq("status", "approved")
                .maybeSingle();

            const isCoach = !!coachRow;

            // is_admin / primary_role 仍从 users 读取，避免影响后台权限与用户主动切换的角色偏好
            const { data: currentUser } = await supabase
                .from("users")
                .select("is_admin, primary_role")
                .eq("id", user.id)
                .single();

            session.user.is_coach = isCoach;
            session.user.is_admin = currentUser?.is_admin ?? false;
            session.user.coach_status = isCoach ? "approved" : "none";
            // 若用户已具备教练资格但主动切换到学员端，应尊重 users.primary_role
            // 默认优先使用 users.primary_role；缺省时才根据 isCoach 兜底
            session.user.primary_role = currentUser?.primary_role
                ?? (isCoach ? "coach" : "student");

            const { data: profile, error } = await supabase
                .from("user_profiles")
                .select("*")
                .eq("user_id", user.id)
                .single();

            if (error) {
                console.error("获取用户档案失败：", error);
            }

            if (profile) {
                session.profile = profile;
            }

            return session;
        },
    },
    pages: {
        signIn: "/login", // 可选，登录页路径
    },
    secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
