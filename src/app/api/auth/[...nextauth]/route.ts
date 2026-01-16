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
                phoneOrEmail: { label: "PhoneOrEmail", type: "text" },
                password: { label: "Password", type: "password" },
                verifyCode: { label: "verifyCode", type: "text" },
            },
            async authorize(credentials) {
                const phoneOrEmail = credentials?.phoneOrEmail?.trim();
                const password = credentials?.password?.trim();
                const verifyCode = credentials?.verifyCode?.trim();

                if (!phoneOrEmail) {
                    throw new Error("请输入手机号或邮箱");
                }

                // Determine if input is phone or email
                const isPhone = /^1[3-9]\d{9}$/.test(phoneOrEmail);
                const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(phoneOrEmail);

                if (!isPhone && !isEmail) {
                    throw new Error("请输入正确的手机号或邮箱格式");
                }

                // 查询用户（两种登录方式都需要）
                let userQuery;
                if (isPhone) {
                    userQuery = supabase.from("users").select("*").eq("phone", phoneOrEmail).single();
                } else {
                    userQuery = supabase.from("users").select("*").eq("email", phoneOrEmail).single();
                }

                const { data: user, error: userError } = await userQuery;

                if (userError) {
                    throw new Error("登录失败\n" + userError.message);
                }

                // 方式 1：验证码登录（手机号/邮箱 + 验证码）
                if (verifyCode && !password) {
                    // 如果是开发者模式 获取白名单（白名单跳过验证码校验）
                    const whiteList = getWhiteList();
                    const isInWhiteList = whiteList.some((u) => u.phone === phoneOrEmail);

                    if (!isInWhiteList) {
                        // 开发模式下接受模拟验证码 123456
                        const useMockSms = process.env.NODE_ENV === "development";
                        const isMockCode = useMockSms && verifyCode === "123456";

                        if (!isMockCode) {
                            if (!redis) {
                                throw new Error("验证服务不可用");
                            }

                            // 根据是手机号还是邮箱来查询验证码
                            const verificationKey = isPhone
                                ? `sms_verification_code:${phoneOrEmail}`
                                : `email_verification_code:${phoneOrEmail}`;

                            const storedCode = await redis.get(verificationKey);
                            if (!storedCode) {
                                throw new Error("验证码已过期或不存在");
                            }
                            if (storedCode !== verifyCode) {
                                throw new Error("验证码错误");
                            }

                            // 验证成功后删除验证码，防止重复使用
                            await redis.del(verificationKey);
                        }
                    }

                    (user as any).password_hash = undefined;
                    return user;
                }

                // 方式 2：密码登录（手机号/邮箱 + 密码）
                if (password && !verifyCode) {
                    const isValid = verifyPassword(password, user.password_hash);
                    if (!isValid) {
                        throw new Error("密码错误");
                    }

                    (user as any).password_hash = undefined;
                    return user;
                }

                // 不允许“什么都不填”或“两种都填”（避免歧义，前端也只会传一种）
                throw new Error("请选择“密码登录”或“验证码登录”");
            },
        }),
    ],
    session: {
        strategy: "jwt",
        maxAge: 90 * 24 * 60 * 60,
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
