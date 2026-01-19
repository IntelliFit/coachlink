// app/api/auth/[...nextauth]/route.ts
import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import OAuthProvider from "next-auth/providers/oauth";
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
        {
            id: "wechat",
            name: "WeChat",
            type: "oauth",
            wellKnown: undefined,
            clientId: process.env.WECHAT_APP_ID,
            clientSecret: process.env.WECHAT_APP_SECRET,
            authorization: {
                url: "https://open.weixin.qq.com/connect/qrconnect",
                params: {
                    appid: process.env.WECHAT_APP_ID,
                    response_type: "code",
                    scope: "snsapi_login",
                },
            },
            token: {
                url: "https://api.weixin.qq.com/sns/oauth2/access_token",
                async request({ params, provider }) {
                    // Construct the token request with required parameters
                    const url = new URL(provider.token?.toString() || "");
                    url.searchParams.set("appid", process.env.WECHAT_APP_ID || "");
                    url.searchParams.set("secret", process.env.WECHAT_APP_SECRET || "");
                    url.searchParams.set("code", params.code || "");
                    url.searchParams.set("grant_type", "authorization_code");

                    const response = await fetch(url, {
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        method: "POST",
                    });

                    return {
                        tokens: await response.json()
                    };
                },
            },
            userinfo: {
                url: "https://api.weixin.qq.com/sns/userinfo",
                async request(context) {
                    // Access token and openid are needed to get user info
                    const { access_token, openid } = context.tokens;

                    console.log(openid);

                    if (!access_token || !openid) {
                        throw new Error("Missing access_token or openid for WeChat userinfo request");
                    }

                    const userInfoUrl = new URL("https://api.weixin.qq.com/sns/userinfo");
                    userInfoUrl.searchParams.set("access_token", access_token);
                    userInfoUrl.searchParams.set("openid", openid);
                    userInfoUrl.searchParams.set("lang", "zh_CN");

                    const response = await fetch(userInfoUrl);
                    const userInfo = await response.json();

                    if (userInfo.errcode) {
                        throw new Error(`WeChat API error: ${userInfo.errmsg}`);
                    }

                    return userInfo;
                },
            },
            profile(profile) {
                // Map WeChat user data to NextAuth user object
                console.log(profile);

                return {
                    id: profile.openid,
                    name: profile.nickname,
                    email: null,
                    image: profile.headimgurl,
                };
            },
        },
    ],
    session: {
        strategy: "jwt",
        maxAge: 90 * 24 * 60 * 60,
    },
    callbacks: {
        async signIn({ user, account }) {
            // Handle WeChat OAuth user creation/linking

            if (account?.provider === 'wechat') {
                // Check if user already exists by their WeChat openid
                const { data: existingUser, error } = await supabase
                    .from("users")
                    .select("*")
                    .eq("wechat_openid", user.id)
                    .single();

                if (!existingUser) {
                    // Create new user
                    const { data: newUser, error: createUserError } = await supabase
                        .from("users")
                        .insert({
                            wechat_openid: user.id,
                            password_hash: '',
                            is_active: true,
                            is_admin: false,
                            admin_role: null,
                            is_coach: false,
                            phone: null,
                        })
                        .select()
                        .single();

                    if (createUserError) {
                        console.error("创建微信用户失败:", createUserError);
                        return false;
                    }

                    const { data: UserProfile, error: createUserProfileError } = await supabase
                        .from("user_profiles")
                        .insert({
                            user_id: newUser.id,
                            nickname: user.name || `微信用户_${user.id.slice(-4) || 'unknown'}`,
                            avatar_url: user.image,
                            is_active: true,
                        })
                        .select()
                        .single();

                    // Create user profile
                    await supabase
                        .from("user_profiles")
                        .insert({
                            user_id: newUser.id,
                            bio: "通过微信登录的用户",
                            created_at: new Date().toISOString(),
                        });
                }
            }

            return true;
        },
        async jwt({ token, user, account }) {
            // If signing in with WeChat, update token with user info from DB
            if (account?.provider === 'wechat' && user.id) {
                // Find user by WeChat openid
                const { data: dbUser, error } = await supabase
                    .from("users")
                    .select("*")
                    .eq("wechat_openid", user.id)
                    .single();

                if (dbUser) {
                    (dbUser as any).password_hash = undefined;
                    token.user = dbUser;
                }
            } else if (user) {
                token.user = {
                    ...user,
                    admin_permissions: user.admin_permissions || [],
                    admin_role: user.admin_role || '',
                    is_admin: user.is_admin ?? false,
                    is_coach: user.is_coach ?? false,
                    coach_status: user.coach_status || '',
                    created_at: user.created_at || '',
                    updated_at: user.updated_at || '',
                    email: user.email || '',
                    has_drawn: user.has_drawn ?? false,
                    invitation_coach_id: user.invitation_coach_id || null,
                    last_login_at: user.last_login_at || null,
                    password_hash: user.password_hash || '',
                    phone: user.phone || '',
                    primary_role: user.primary_role || 'student',
                    subscription_expires_at: user.subscription_expires_at || null,
                    subscription_level: user.subscription_level || null,
                    wechat_openid: user.wechat_openid || '',
                };
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

            // 统一以 coaches 表为教练资格真源；users 仅同��� is_admin / primary_role
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
