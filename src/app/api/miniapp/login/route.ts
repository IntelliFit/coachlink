import { NextRequest, NextResponse } from 'next/server';
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import { verifyPassword } from "../../auth/[...nextauth]/verify";
import { signToken } from "@/lib/jwt";
import redis from "@/lib/redisClient";
import { toPublicApiMessage } from "@/lib/publicApiError";

function buildDefaultNickname(phoneOrEmail: string, isPhone: boolean) {
    return isPhone
        ? `手机用户_${phoneOrEmail.slice(-4)}`
        : `邮箱用户_${(phoneOrEmail.split("@")[0] || "").slice(0, 8)}`;
}

async function ensureUserProfile(user: any, phoneOrEmail: string, isPhone: boolean) {
    const { data: existingProfile, error: profileQueryError } = await serviceRoleSupabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

    if (profileQueryError) {
        console.error("查询用户档案失败:", profileQueryError);
        return null;
    }

    if (existingProfile) {
        return existingProfile;
    }

    const { data: profile, error: profileCreateError } = await serviceRoleSupabase
        .from("user_profiles")
        .insert({
            user_id: user.id,
            nickname: buildDefaultNickname(phoneOrEmail, isPhone),
            bio: "",
            onboarding_completed: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();

    if (profileCreateError) {
        console.error("创建用户档案失败:", profileCreateError);
        return null;
    }

    return profile;
}

/**
 * 小程序专用登录接口
 * 不依赖 Cookie 和 Session，直接返回用户信息和 token
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { phoneOrEmail, password, verifyCode } = body;

        if (!phoneOrEmail) {
            return NextResponse.json({
                success: false,
                message: "请输入手机号或邮箱"
            }, { status: 400 });
        }

        // 判断是手机号还是邮箱
        const isPhone = /^1[3-9]\d{9}$/.test(phoneOrEmail);
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(phoneOrEmail);

        if (!isPhone && !isEmail) {
            return NextResponse.json({
                success: false,
                message: "请输入正确的手机号或邮箱格式"
            }, { status: 400 });
        }

        // 方式1：密码登录
        if (password && !verifyCode) {
            let userQuery;
            if (isPhone) {
                userQuery = supabase.from("users").select("*").eq("phone", phoneOrEmail).single();
            } else {
                userQuery = supabase.from("users").select("*").eq("email", phoneOrEmail).single();
            }

            const { data: user, error: userError } = await userQuery;

            if (userError || !user) {
                return NextResponse.json({
                    success: false,
                    message: "该手机号/邮箱未注册"
                }, { status: 404 });
            }

            const isValid = verifyPassword(password, user.password_hash);
            if (!isValid) {
                return NextResponse.json({
                    success: false,
                    message: "密码错误"
                }, { status: 401 });
            }

            await ensureUserProfile(user, phoneOrEmail, isPhone);

            // 移除敏感信息
            const { password_hash, ...userWithoutPassword } = user;

            // 查询是否为教练（小程序端需用于界面切换）
            const { data: coachRow } = await supabase
                .from("coaches")
                .select("id, status")
                .eq("user_id", user.id)
                .eq("status", "approved")
                .maybeSingle();
            const isCoach = !!coachRow;

            const payload = {
                ...userWithoutPassword,
                is_coach: isCoach,
                primary_role: user.primary_role ?? (isCoach ? "coach" : "student"),
                is_admin: user.is_admin ?? false,
            };

            // 生成JWT token
            const token = signToken({
                userId: user.id,
                phone: user.phone,
                email: user.email
            });

            return NextResponse.json({
                success: true,
                message: "登录成功",
                data: {
                    user: payload,
                    token: token
                }
            });
        }

        // 方式2：验证码登录
        if (verifyCode && !password) {
            const trimmedVerifyCode = verifyCode.trim();

            // 检查 Redis 是否可用
            if (!redis) {
                return NextResponse.json({
                    success: false,
                    message: "验证服务不可用"
                }, { status: 500 });
            }

            // 开发模式下接受模拟验证码 123456
            const isDev = process.env.NODE_ENV === 'development';
            const isMockCode = isDev && trimmedVerifyCode === '123456';

            if (!isMockCode) {
                // 根据是手机号还是邮箱，使用对应的 Redis key
                const verificationKey = isPhone
                    ? `sms_verification_code:${phoneOrEmail}`
                    : `email_verification_code:${phoneOrEmail}`;

                const storedCode = await redis.get(verificationKey);

                if (!storedCode) {
                    return NextResponse.json({
                        success: false,
                        message: "验证码已过期或不存在"
                    }, { status: 400 });
                }

                if (storedCode !== trimmedVerifyCode) {
                    return NextResponse.json({
                        success: false,
                        message: "验证码错误"
                    }, { status: 400 });
                }

                // 验证成功后删除验证码，防止重复使用
                await redis.del(verificationKey);
            }

            let userQuery;
            if (isPhone) {
                userQuery = supabase.from("users").select("*").eq("phone", phoneOrEmail).maybeSingle();
            } else {
                userQuery = supabase.from("users").select("*").eq("email", phoneOrEmail).maybeSingle();
            }

            const { data: existingUser, error: userError } = await userQuery;
            if (userError) {
                return NextResponse.json({
                    success: false,
                    message: "登录失败，请稍后重试"
                }, { status: 500 });
            }

            let resolvedUser = existingUser;
            if (!resolvedUser) {
                const { data: createdUser, error: createUserError } = await serviceRoleSupabase
                    .from("users")
                    .insert({
                        ...(isPhone ? { phone: phoneOrEmail } : { email: phoneOrEmail }),
                        password_hash: "",
                        is_admin: false,
                        is_coach: false,
                        primary_role: "student",
                        last_login_at: new Date().toISOString(),
                    })
                    .select("*")
                    .single();

                if (createUserError || !createdUser) {
                    return NextResponse.json({
                        success: false,
                        message: "注册失败，请稍后重试"
                    }, { status: 500 });
                }

                resolvedUser = createdUser;
            }

            await ensureUserProfile(resolvedUser, phoneOrEmail, isPhone);

            // 验证码验证通过，返回登录信息
            const { password_hash, ...userWithoutPassword } = resolvedUser;

            const { data: coachRow } = await supabase
                .from("coaches")
                .select("id, status")
                .eq("user_id", resolvedUser.id)
                .eq("status", "approved")
                .maybeSingle();
            const isCoach = !!coachRow;

            const payload = {
                ...userWithoutPassword,
                is_coach: isCoach,
                primary_role: resolvedUser.primary_role ?? (isCoach ? "coach" : "student"),
                is_admin: resolvedUser.is_admin ?? false,
            };

            const token = signToken({
                userId: resolvedUser.id,
                phone: resolvedUser.phone,
                email: resolvedUser.email
            });

            return NextResponse.json({
                success: true,
                message: isMockCode ? "登录成功（开发模式）" : "登录成功",
                data: {
                    user: payload,
                    token: token
                }
            });
        }

        return NextResponse.json({
            success: false,
            message: "请提供密码或验证码"
        }, { status: 400 });

    } catch (error: unknown) {
        console.error('小程序登录错误:', error);
        return NextResponse.json({
            success: false,
            message: toPublicApiMessage(error, '登录失败，请稍后重试')
        }, { status: 500 });
    }
}

