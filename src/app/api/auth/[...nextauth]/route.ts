import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import { verifyPassword } from "./verify";
import redis from "@/lib/redisClient";
import { getWhiteList } from "@/lib/devUsers";
import { getAdminCredentialByLoginIdentifier } from "@/lib/adminCredentials";
import { claimLegacyUserByVerifiedPhone } from "@/lib/legacyAccountIdentity";

async function getUserProfile(userId: string) {
    const { data: profile } = await serviceRoleSupabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    return profile || undefined;
}

async function getUserById(userId: string) {
    const { data: user, error } = await serviceRoleSupabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

    if (error || !user) {
        throw new Error("用户不存在");
    }

    (user as any).password_hash = undefined;
    return user;
}

async function getUserByPhoneOrEmail(phoneOrEmail: string) {
    const isPhone = /^1[3-9]\d{9}$/.test(phoneOrEmail);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(phoneOrEmail);

    if (!isPhone && !isEmail) {
        throw new Error("请输入正确的手机号或邮箱格式");
    }

    const query = isPhone
        ? supabase.from("users").select("*").eq("phone", phoneOrEmail).maybeSingle()
        : supabase.from("users").select("*").eq("email", phoneOrEmail).maybeSingle();

    const { data: user, error } = await query;
    if (error) {
        throw new Error("登录失败，请稍后重试");
    }

    return { user, isPhone, isEmail };
}

async function verifyLoginCode(phoneOrEmail: string, verifyCode: string, isPhone: boolean) {
    if (verifyCode.length !== 6) {
        throw new Error("验证码错误");
    }

    const whiteList = getWhiteList();
    const isInWhiteList = whiteList.some((u) => u.phone === phoneOrEmail);
    if (isInWhiteList) return;

    const useMockSms = process.env.NODE_ENV === "development";
    const isMockCode = useMockSms && verifyCode === "123456";
    if (isMockCode) return;

    if (!redis) {
        throw new Error("验证服务不可用");
    }

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

    await redis.del(verificationKey);
}

async function createUserFromPhoneOrEmail(phoneOrEmail: string, isPhone: boolean) {
    const { data: newUser, error: createError } = await serviceRoleSupabase
        .from("users")
        .insert({
            ...(isPhone ? { phone: phoneOrEmail } : { email: phoneOrEmail }),
            password_hash: "",
            is_admin: false,
            is_coach: false,
        })
        .select("*")
        .single();

    if (createError || !newUser) {
        throw new Error("注册失败，请稍后重试");
    }

    const nickname = isPhone
        ? `手机用户_${phoneOrEmail.slice(-4)}`
        : `邮箱用户_${(phoneOrEmail.split("@")[0] || "").slice(0, 8)}`;

    const { error: profileErr } = await serviceRoleSupabase
        .from("user_profiles")
        .insert({
            user_id: newUser.id,
            nickname,
            bio: "",
            onboarding_completed: false,
        })
        .select()
        .single();

    if (profileErr) {
        console.error("创建用户档案失败:", profileErr);
    }

    (newUser as any).password_hash = undefined;
    return newUser;
}

async function authorizeAdminLogin(adminLogin?: string, adminPassword?: string) {
    if (!adminLogin && !adminPassword) return null;
    if (!adminLogin || !adminPassword) {
        throw new Error("请输入管理员账号和密码");
    }

    const credential = await getAdminCredentialByLoginIdentifier(adminLogin);
    if (!credential || credential.is_active === false || !credential.password_hash) {
        throw new Error("管理员账号或密码错误");
    }

    if (!verifyPassword(adminPassword, credential.password_hash)) {
        throw new Error("管理员账号或密码错误");
    }

    if (!credential.user_id) {
        throw new Error("当前管理员凭证未绑定后台用户");
    }

    const user = await getUserById(credential.user_id);
    if (user.is_admin !== true) {
        throw new Error("当前管理员账号未绑定有效后台权限");
    }

    const profile = await getUserProfile(user.id);

    await serviceRoleSupabase
        .from("admin_users")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", credential.id);

    return {
        ...user,
        profile,
    };
}

async function authorizeQuickUserLogin(userId?: string) {
    if (!userId) return null;
    const user = await getUserById(userId);
    const profile = await getUserProfile(user.id);
    return { ...user, profile };
}

async function authorizeWechatTokenLogin(wechatLoginToken?: string) {
    if (!wechatLoginToken) return null;
    if (!redis) {
        throw new Error("验证服务不可用");
    }

    const key = `wechat_login_token:${wechatLoginToken}`;
    const stored = await redis.get(key);
    if (!stored) {
        throw new Error("登录凭证已过期，请刷新二维码重试");
    }

    await redis.del(key);

    let parsed: any = {};
    try {
        const raw = typeof stored === "string" ? stored : stored.toString("utf8");
        parsed = JSON.parse(raw);
    } catch {
        parsed = {};
    }

    const userId = parsed?.userId as string | undefined;
    if (!userId) {
        throw new Error("登录凭证无效");
    }

    const user = await getUserById(userId);
    const profile = await getUserProfile(user.id);
    return { ...user, profile };
}

async function authorizeVerifyCodeLogin(phoneOrEmail?: string, verifyCode?: string, password?: string) {
    if (!phoneOrEmail || !verifyCode || password) return null;

    const { user, isPhone } = await getUserByPhoneOrEmail(phoneOrEmail);
    await verifyLoginCode(phoneOrEmail, verifyCode, isPhone);

    let resolvedUser = user;
    if (!resolvedUser && isPhone) {
        resolvedUser = await claimLegacyUserByVerifiedPhone(phoneOrEmail);
    }
    resolvedUser = resolvedUser || await createUserFromPhoneOrEmail(phoneOrEmail, isPhone);
    const profile = await getUserProfile(resolvedUser.id);

    return {
        ...resolvedUser,
        profile,
    };
}

async function authorizePasswordLogin(phoneOrEmail?: string, password?: string, verifyCode?: string) {
    if (!phoneOrEmail || !password || verifyCode) return null;

    const { user } = await getUserByPhoneOrEmail(phoneOrEmail);
    if (!user) {
        throw new Error("该手机号/邮箱未注册");
    }

    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
        throw new Error("密码错误");
    }

    (user as any).password_hash = undefined;
    const profile = await getUserProfile(user.id);
    return {
        ...user,
        profile,
    };
}

export const authOptions: AuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                phoneOrEmail: { label: "PhoneOrEmail", type: "text" },
                password: { label: "Password", type: "password" },
                verifyCode: { label: "VerifyCode", type: "text" },
                wechatLoginToken: { label: "WechatLoginToken", type: "text" },
                userId: { label: "UserId", type: "text" },
                adminLogin: { label: "AdminLogin", type: "text" },
                adminPassword: { label: "AdminPassword", type: "password" },
            },
            async authorize(credentials) {
                const adminUser = await authorizeAdminLogin(
                    credentials?.adminLogin?.trim(),
                    credentials?.adminPassword?.trim(),
                );
                if (adminUser) return adminUser;

                const quickUser = await authorizeQuickUserLogin(credentials?.userId?.trim());
                if (quickUser) return quickUser;

                const wechatUser = await authorizeWechatTokenLogin(credentials?.wechatLoginToken?.trim());
                if (wechatUser) return wechatUser;

                const phoneOrEmail = credentials?.phoneOrEmail?.trim();
                if (!phoneOrEmail) {
                    throw new Error("请输入手机号或邮箱");
                }

                const verifyCodeUser = await authorizeVerifyCodeLogin(
                    phoneOrEmail,
                    credentials?.verifyCode?.trim(),
                    credentials?.password?.trim(),
                );
                if (verifyCodeUser) return verifyCodeUser;

                const passwordUser = await authorizePasswordLogin(
                    phoneOrEmail,
                    credentials?.password?.trim(),
                    credentials?.verifyCode?.trim(),
                );
                if (passwordUser) return passwordUser;

                throw new Error("请选择密码登录或验证码登录");
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
                    fast_login: 1,
                    lang: "zh_CN",
                },
            },
            token: {
                url: "https://api.weixin.qq.com/sns/oauth2/access_token",
                async request({ params, provider }) {
                    const tokenUrl =
                        typeof provider.token === "string"
                            ? provider.token
                            : provider.token?.url;
                    const url = new URL(tokenUrl || "");
                    url.searchParams.set("appid", process.env.WECHAT_APP_ID || "");
                    url.searchParams.set("secret", process.env.WECHAT_APP_SECRET || "");
                    url.searchParams.set("code", params.code || "");
                    url.searchParams.set("grant_type", "authorization_code");

                    const response = await fetch(url, { method: "GET" });
                    return { tokens: await response.json() };
                },
            },
            userinfo: {
                url: "https://api.weixin.qq.com/sns/userinfo",
                async request(context) {
                    const { access_token, openid } = context.tokens;
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
        updateAge: 24 * 60 * 60,
    },
    cookies: {
        sessionToken: {
            name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.session-token`,
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production" || process.env.NEXTAUTH_URL?.startsWith("https://"),
                maxAge: 90 * 24 * 60 * 60,
            },
        },
        callbackUrl: {
            name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.callback-url`,
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production" || process.env.NEXTAUTH_URL?.startsWith("https://"),
            },
        },
        csrfToken: {
            name: `${process.env.NODE_ENV === "production" ? "__Host-" : ""}next-auth.csrf-token`,
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production" || process.env.NEXTAUTH_URL?.startsWith("https://"),
            },
        },
    },
    callbacks: {
        async signIn({ user, account }) {
            if (account?.provider === "wechat") {
                const { data: existingUser } = await supabase
                    .from("users")
                    .select("*")
                    .eq("wechat_openid", user.id)
                    .single();

                if (!existingUser) {
                    const { data: newUser, error: createUserError } = await supabase
                        .from("users")
                        .insert({
                            wechat_openid: user.id,
                            password_hash: "",
                            is_admin: false,
                            admin_role: null,
                            is_coach: false,
                            phone: null,
                        })
                        .select()
                        .single();

                    if (createUserError || !newUser) {
                        console.error("创建微信用户失败:", createUserError);
                        return false;
                    }

                    const { data: userProfile, error: createUserProfileError } = await supabase
                        .from("user_profiles")
                        .insert({
                            user_id: newUser.id,
                            nickname: user.name || `微信用户_${user.id.slice(-4) || "unknown"}`,
                            avatar_url: user.image,
                            bio: "",
                            onboarding_completed: false,
                        })
                        .select()
                        .single();

                    if (createUserProfileError) {
                        console.error("创建用户档案失败:", createUserProfileError);
                    }

                    if (userProfile) {
                        (user as any).profile = userProfile;
                    }
                    (user as any).dbUserId = newUser.id;
                } else {
                    const { data: existingProfile } = await supabase
                        .from("user_profiles")
                        .select("*")
                        .eq("user_id", existingUser.id)
                        .single();

                    if (existingProfile) {
                        (user as any).profile = existingProfile;
                    }
                    (user as any).dbUserId = existingUser.id;
                }
            }

            return true;
        },
        async jwt({ token, user, account, trigger }) {
            if (user) {
                if (account?.provider === "wechat" && user.id) {
                    const dbUserId = (user as any).dbUserId;
                    const query = dbUserId
                        ? supabase.from("users").select("*").eq("id", dbUserId).single()
                        : supabase.from("users").select("*").eq("wechat_openid", user.id).single();

                    const { data: dbUser } = await query;
                    if (dbUser) {
                        (dbUser as any).password_hash = undefined;
                        token.user = dbUser;
                    }
                } else {
                    (token.user as any) = user;
                }
            }

            if (trigger === "update" && token.user?.id) {
                const { data: dbUser } = await supabase
                    .from("users")
                    .select("*")
                    .eq("id", token.user.id)
                    .single();

                if (dbUser) {
                    (dbUser as any).password_hash = undefined;
                    token.user = dbUser;
                }
            }

            return token;
        },
        async session({ session, token }) {
            const user = token.user;
            if (!user) return session;

            (user as any).password_hash = undefined;
            session.user = token.user;
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
    secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
