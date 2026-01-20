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
                    
                    // 同时获取用户档案，避免在 jwt/session callback 中访问数据库
                    const { data: profile } = await supabase
                        .from("user_profiles")
                        .select("*")
                        .eq("user_id", user.id)
                        .single();
                    
                    return {
                        ...user,
                        profile: profile || undefined,
                    };
                }

                // 方式 2：密码登录（手机号/邮箱 + 密码）
                if (password && !verifyCode) {
                    const isValid = verifyPassword(password, user.password_hash);
                    if (!isValid) {
                        throw new Error("密码错误");
                    }

                    (user as any).password_hash = undefined;
                    
                    // 同时获取用户档案，避免在 jwt/session callback 中访问数据库
                    const { data: profile } = await supabase
                        .from("user_profiles")
                        .select("*")
                        .eq("user_id", user.id)
                        .single();
                    
                    return {
                        ...user,
                        profile: profile || undefined,
                    };
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

                    // Create user profile (合并到一个 insert 操作)
                    const { data: UserProfile, error: createUserProfileError } = await supabase
                        .from("user_profiles")
                        .insert({
                            user_id: newUser.id,
                            nickname: user.name || `微信用户_${user.id.slice(-4) || 'unknown'}`,
                            avatar_url: user.image,
                            bio: "通过微信登录的用户",
                            is_active: true,
                        })
                        .select()
                        .single();

                    if (createUserProfileError) {
                        console.error("创建用户档案失败:", createUserProfileError);
                    }

                    // 将 profile 附加到 user 对象上，以便在 jwt callback 中使用
                    if (UserProfile) {
                        (user as any).profile = UserProfile;
                        (user as any).dbUserId = newUser.id; // 保存数据库中的 user id
                    }
                } else {
                    // 如果用户已存在，获取 profile 并附加到 user 对象上
                    const { data: existingProfile } = await supabase
                        .from("user_profiles")
                        .select("*")
                        .eq("user_id", existingUser.id)
                        .single();
                    
                    if (existingProfile) {
                        (user as any).profile = existingProfile;
                    }
                    (user as any).dbUserId = existingUser.id; // 保存数据库中的 user id
                }
            }

            return true;
        },
        async jwt({ token, user, account }) {            
            // 如果用户首次登录，将 user 和 profile 信息存储到 token 中
            if (user) {
                if (account?.provider === 'wechat' && user.id) {
                    // 微信登录：从 signIn callback 中已经获取了 user 和 profile
                    // 需要通过 dbUserId 或 wechat_openid 查找数据库中的用户
                    const dbUserId = (user as any).dbUserId;
                    if (dbUserId) {
                        // 从数据库获取完整的用户信息（仅在首次登录时）
                        const { data: dbUser } = await supabase
                            .from("users")
                            .select("*")
                            .eq("id", dbUserId)
                            .single();

                        if (dbUser) {
                            dbUser.password_hash = undefined;
                            token.user = dbUser;
                        }
                    } else {
                        // 如果 signIn callback 中没有设置 dbUserId，回退到原来的逻辑（向后兼容）
                        const { data: dbUser } = await supabase
                            .from("users")
                            .select("*")
                            .eq("wechat_openid", user.id)
                            .single();

                        if (dbUser) {
                            (dbUser as any).password_hash = undefined;
                            token.user = dbUser;
                        }
                    }
                } else {                                    
                    (token.user as any) = user;
                }
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
