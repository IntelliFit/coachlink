// app/api/auth/[...nextauth]/route.ts
import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import OAuthProvider from "next-auth/providers/oauth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
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
                wechatLoginToken: { label: "wechatLoginToken", type: "text" },
                userId: { label: "UserId", type: "text" }, // 快速接入：通过用户 ID 直接登录
            },
            async authorize(credentials) {
                const phoneOrEmail = credentials?.phoneOrEmail?.trim();
                const password = credentials?.password?.trim();
                const verifyCode = credentials?.verifyCode?.trim();
                const wechatLoginToken = credentials?.wechatLoginToken?.trim();
                const userId = credentials?.userId?.trim();

                // 方式 0.5：快速接入 - 通过用户 ID 直接登录（无需密码或验证码）
                if (userId) {
                    const { data: user, error: userError } = await supabase
                        .from("users")
                        .select("*")
                        .eq("id", userId)
                        .single();

                    if (userError || !user) {
                        throw new Error("用户不存在");
                    }

                    (user as any).password_hash = undefined;
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

                // 方式 0：微信内嵌二维码登录（一次性 token）
                if (wechatLoginToken) {
                    if (!redis) {
                        throw new Error("验证服务不可用");
                    }
                    const key = `wechat_login_token:${wechatLoginToken}`;
                    const stored = await redis.get(key);
                    if (!stored) {
                        throw new Error("登录凭证已过期，请刷新二维码重试");
                    }
                    // One-time use
                    await redis.del(key);

                    let parsed: any = {};
                    try {
                        const raw = typeof stored === "string" ? stored : stored.toString("utf8");
                        parsed = JSON.parse(raw);
                    } catch { }
                    const userId = parsed?.userId as string | undefined;
                    if (!userId) {
                        throw new Error("登录凭证无效");
                    }

                    const { data: user, error: userError } = await supabase
                        .from("users")
                        .select("*")
                        .eq("id", userId)
                        .single();

                    if (userError || !user) {
                        throw new Error("用户不存在");
                    }

                    (user as any).password_hash = undefined;
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

                if (!phoneOrEmail) {
                    throw new Error("请输入手机号或邮箱");
                }

                // Determine if input is phone or email
                const isPhone = /^1[3-9]\d{9}$/.test(phoneOrEmail);
                const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(phoneOrEmail);

                if (!isPhone && !isEmail) {
                    throw new Error("请输入正确的手机号或邮箱格式");
                }

                // 方式 1：验证码登录（手机号/邮箱 + 验证码）；未注册则直接注册并登录
                if (verifyCode && !password) {
                    if (verifyCode.length !== 6) {
                        throw new Error("验证码错误");
                    }

                    // 先校验验证码（通过后再查用户，未注册则自动注册）
                    const whiteList = getWhiteList();
                    const isInWhiteList = whiteList.some((u) => u.phone === phoneOrEmail);
                    if (!isInWhiteList) {
                        const useMockSms = process.env.NODE_ENV === "development";
                        const isMockCode = useMockSms && verifyCode === "123456";
                        if (!isMockCode) {
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
                    }

                    let userQuery;
                    if (isPhone) {
                        userQuery = supabase.from("users").select("*").eq("phone", phoneOrEmail).maybeSingle();
                    } else {
                        userQuery = supabase.from("users").select("*").eq("email", phoneOrEmail).maybeSingle();
                    }
                    const { data: user, error: userError } = await userQuery;
                    if (userError) {
                        throw new Error("登录失败，请稍后重试");
                    }

                    let resolvedUser: any;
                    if (user) {
                        resolvedUser = user;
                    } else {
                        // 未注册：自动创建用户 + 档案（使用 service role 绕过 RLS）
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
                                onboarding_completed: false, // 明确设置为 false，确保触发问卷
                            })
                            .select()
                            .single();
                        if (profileErr) {
                            console.error("创建用户档案失败:", profileErr);
                        }
                        resolvedUser = newUser;
                    }

                    (resolvedUser as any).password_hash = undefined;
                    const { data: profile } = await serviceRoleSupabase
                        .from("user_profiles")
                        .select("*")
                        .eq("user_id", resolvedUser.id)
                        .single();
                    return {
                        ...resolvedUser,
                        profile: profile || undefined,
                    };
                }

                // 方式 2：密码登录（手机号/邮箱 + 密码）
                let userQuery;
                if (isPhone) {
                    userQuery = supabase.from("users").select("*").eq("phone", phoneOrEmail).maybeSingle();
                } else {
                    userQuery = supabase.from("users").select("*").eq("email", phoneOrEmail).maybeSingle();
                }
                const { data: user, error: userError } = await userQuery;
                if (userError) {
                    throw new Error("登录失败，请稍后重试");
                }
                if (!user) {
                    throw new Error("该手机号/邮箱未注册");
                }
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
                    fast_login: 1,
                    lang: "zh_CN",
                },
            },
            token: {
                url: "https://api.weixin.qq.com/sns/oauth2/access_token",
                async request({ params, provider }) {
                    // Construct the token request with required parameters
                    const tokenUrl =
                        typeof provider.token === "string"
                            ? provider.token
                            : provider.token?.url;
                    const url = new URL(tokenUrl || "");
                    url.searchParams.set("appid", process.env.WECHAT_APP_ID || "");
                    url.searchParams.set("secret", process.env.WECHAT_APP_SECRET || "");
                    url.searchParams.set("code", params.code || "");
                    url.searchParams.set("grant_type", "authorization_code");

                    // 微信文档为 GET 请求；这里按官方方式请求
                    const response = await fetch(url, { method: "GET" });

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
                console.log('wechat profile', profile);

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
        maxAge: 90 * 24 * 60 * 60, // 90 天
        updateAge: 24 * 60 * 60, // 每 24 小时更新一次
    },
    // 统一用兼容性更好的 Cookie：无 __Secure- / __Host- 前缀（微信 X5 会拒绝带前缀的）。
    // 使用 SameSite=Lax，Chrome 不会标 !；同站内跳转（含微信内打开你的域名）一般都会带 Cookie。
    // 老用户可能仍带着旧名 cookie，middleware 和 /api/auth/session 会同时认新旧两种名称，不会掉线。
    cookies: {
        sessionToken: {
            name: "next-auth.session-token",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production" || !!process.env.NEXTAUTH_URL?.startsWith("https://"),
                maxAge: 90 * 24 * 60 * 60,
            },
        },
        callbackUrl: {
            name: "next-auth.callback-url",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production" || !!process.env.NEXTAUTH_URL?.startsWith("https://"),
            },
        },
        csrfToken: {
            name: "next-auth.csrf-token",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production" || !!process.env.NEXTAUTH_URL?.startsWith("https://"),
            },
        },
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
                            bio: "",
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

        async jwt({ token, user, account, trigger }) {            
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

            // 如果调用 updateSession()，从数据库重新读取最新的用户信息
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
