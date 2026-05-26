import { NextRequest, NextResponse } from 'next/server';
import { serviceRoleSupabase } from '@/lib/supabaseClient';
import { signToken } from '@/lib/jwt';
import { toPublicApiMessage } from '@/lib/publicApiError';

function isGeneratedNickname(value: any) {
    const nickname = String(value || '').trim();
    return /^手机用户_\d{4}$/.test(nickname)
        || /^邮箱用户_.+$/.test(nickname)
        || /^微信用户_.+$/.test(nickname)
        || /^CoachLink\s*学员$/.test(nickname)
        || /^鎵嬫満鐢ㄦ埛_\d{4}$/.test(nickname)
        || /^閭鐢ㄦ埛_.+$/.test(nickname)
        || /^寰俊鐢ㄦ埛_.+$/.test(nickname)
        || /^CoachLink\s*瀛﹀憳$/.test(nickname);
}

async function ensureUserProfile(user: any, phoneNumber: string | null, openid: string) {
    const { data: existingProfile, error: profileQueryError } = await serviceRoleSupabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

    if (profileQueryError) {
        console.error('⚠️ 查询用户档案失败:', profileQueryError);
        return null;
    }

    if (existingProfile) {
        if (isGeneratedNickname(existingProfile.nickname)) {
            const { data: cleanedProfile, error: cleanError } = await serviceRoleSupabase
                .from('user_profiles')
                .update({
                    nickname: '',
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', user.id)
                .select('*')
                .single();

            if (cleanError) {
                console.error('鈿狅笍 娓呯悊榛樿鏄电О澶辫触:', cleanError);
                return existingProfile;
            }

            return cleanedProfile;
        }

        return existingProfile;
    }

    const { data: profile, error: profileCreateError } = await serviceRoleSupabase
        .from('user_profiles')
        .insert({
            user_id: user.id,
            nickname: '',
            bio: '',
            onboarding_completed: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();

    if (profileCreateError) {
        console.error('⚠️ 创建用户档案失败:', profileCreateError);
        return null;
    }

    return profile;
}

/**
 * 小程序微信登录接口
 * 接收小程序传来的 code，调用微信 code2Session API 获取用户登录信息
 * 不需要鉴权，供小程序登录时调用
 * 
 * 文档：https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_code2session.html
 */
/**
 * 获取微信小程序 access_token
 * 文档：https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-access-token/api_getaccesstoken.html
 */
async function getAccessToken(appid: string, secret: string): Promise<string> {
    const tokenUrl = new URL('https://api.weixin.qq.com/cgi-bin/token');
    tokenUrl.searchParams.set('grant_type', 'client_credential');
    tokenUrl.searchParams.set('appid', appid);
    tokenUrl.searchParams.set('secret', secret);

    const response = await fetch(tokenUrl.toString(), {
        method: 'GET'
    });

    const result = await response.json();

    if (result.errcode) {
        throw new Error(`获取 access_token 失败: ${result.errmsg} (${result.errcode})`);
    }

    return result.access_token;
}

/**
 * 通过 phoneCode 和 access_token 获取用户手机号
 * 文档：https://developers.weixin.qq.com/miniprogram/dev/server/API/user-info/phone-number/api_getphonenumber.html
 */
async function getPhoneNumber(accessToken: string, phoneCode: string): Promise<string | null> {
    const phoneUrl = new URL('https://api.weixin.qq.com/wxa/business/getuserphonenumber');
    phoneUrl.searchParams.set('access_token', accessToken);

    const response = await fetch(phoneUrl.toString(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            code: phoneCode
        })
    });

    const result = await response.json();

    if (result.errcode) {
        console.error('❌ 获取手机号失败:', result.errcode, result.errmsg);
        // 获取手机号失败不影响登录流程，返回 null
        return null;
    }

    // 返回手机号（带国家码，如：+86 13800138000）
    return result.phone_info?.phoneNumber || null;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { code, phoneCode } = body;

        if (!code) {
            return NextResponse.json({
                success: false,
                message: "缺少 code 参数"
            }, { status: 400 });
        }

        // 获取小程序配置
        // 注意：这里需要小程序的 appid 和 secret，不是网站应用的
        // 小程序和网站应用的 appid/secret 是不同的
        const appid = process.env.WECHAT_MINIAPP_APPID || process.env.WECHAT_APP_ID || "";
        const secret = process.env.WECHAT_MINIAPP_SECRET || process.env.WECHAT_APP_SECRET || "";

        // 记录使用的环境变量来源
        const usingMiniAppAppId = !!process.env.WECHAT_MINIAPP_APPID;
        const usingMiniAppSecret = !!process.env.WECHAT_MINIAPP_SECRET;
        
        // 清理可能的空格和换行
        const cleanAppId = appid.trim();
        const cleanSecret = secret.trim();

        if (!appid || !secret) {
            console.error('❌ 微信小程序配置缺失:', {
                hasAppId: !!appid,
                hasSecret: !!secret,
                envKeys: Object.keys(process.env).filter(k => k.includes('WECHAT'))
            });
            return NextResponse.json({
                success: false,
                message: "微信小程序配置缺失（WECHAT_MINIAPP_APPID/WECHAT_MINIAPP_SECRET）"
            }, { status: 500 });
        }

        // 警告：如果使用的是网站应用的配置，提醒用户
        if (!usingMiniAppAppId || !usingMiniAppSecret) {
            console.warn('⚠️ 警告：检测到使用的是网站应用的配置（WECHAT_APP_ID/WECHAT_APP_SECRET）');
            console.warn('⚠️ 小程序登录需要使用小程序专用的 AppID 和 AppSecret');
            console.warn('⚠️ 请在 .env.development 中配置：');
            console.warn('   WECHAT_MINIAPP_APPID=你的小程序AppID');
            console.warn('   WECHAT_MINIAPP_SECRET=你的小程序AppSecret');
        }

        // 调用微信 code2Session API
        // 文档：https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_code2Session.html
        const code2SessionUrl = new URL('https://api.weixin.qq.com/sns/jscode2session');
        code2SessionUrl.searchParams.set('appid', cleanAppId);
        code2SessionUrl.searchParams.set('secret', cleanSecret);
        code2SessionUrl.searchParams.set('js_code', code);
        code2SessionUrl.searchParams.set('grant_type', 'authorization_code');

        const response = await fetch(code2SessionUrl.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        // 检查微信API返回的错误
        if (result.errcode) {
            console.error('❌ 微信 code2Session 错误:', result.errcode, result.errmsg);
            return NextResponse.json({
                success: false,
                message: result.errmsg || `微信登录失败 (${result.errcode})`,
                errorCode: result.errcode
            }, { status: 400 });
        }

        const { openid, session_key, unionid } = result;

        // 获取手机号（如果提供了 phoneCode）
        let phoneNumber: string | null = null;
        if (phoneCode) {
            try {
                console.log('📱 开始获取手机号...');
                const accessToken = await getAccessToken(cleanAppId, cleanSecret);
                phoneNumber = await getPhoneNumber(accessToken, phoneCode);
                
                if (phoneNumber) {
                    // 移除国家码前缀（如 +86 13800138000 -> 13800138000）
                    phoneNumber = phoneNumber.replace(/^\+86\s*/, '');
                    console.log('✅ 获取到手机号:', phoneNumber.substring(0, 3) + '****' + phoneNumber.substring(7));
                } else {
                    console.warn('⚠️ 未获取到手机号，将设置为 "null"');
                    phoneNumber = 'null'; // 设置为字符串 "null"
                }
            } catch (error: any) {
                console.error('❌ 获取手机号失败:', error);
                phoneNumber = 'null'; // 获取失败，设置为字符串 "null"
            }
        } else {
            console.log('ℹ️ 未提供 phoneCode，手机号将设置为 "null"');
            phoneNumber = 'null'; // 未提供 phoneCode，设置为字符串 "null"
        }

        // 检查用户是否已存在（通过 wechat_openid）
        const { data: existingUser, error: queryError } = await serviceRoleSupabase
            .from('users')
            .select('*')
            .eq('wechat_openid', openid)
            .maybeSingle();

        if (queryError) {
            console.error('❌ 查询用户失败:', queryError);
            return NextResponse.json({
                success: false,
                message: '查询用户信息失败'
            }, { status: 500 });
        }

        let user;
        if (existingUser) {
            // 用户已存在（通过 openid 匹配），更新手机号（如果获取到了新的手机号且原手机号为 null 或 "null"）
            if (phoneNumber && phoneNumber !== 'null' && (!existingUser.phone || existingUser.phone === 'null')) {
                const { data: updatedUser, error: updateError } = await serviceRoleSupabase
                    .from('users')
                    .update({ phone: phoneNumber })
                    .eq('id', existingUser.id)
                    .select()
                    .single();

                if (updateError) {
                    console.error('⚠️ 更新手机号失败:', updateError);
                    user = existingUser; // 更新失败，使用原用户信息
                } else {
                    user = updatedUser;
                    console.log('✅ 已更新用户手机号');
                }
            } else {
                user = existingUser;
            }
            console.log('✅ 用户已存在（通过 openid 匹配）');
        } else {
            if (!phoneNumber || phoneNumber === 'null') {
                return NextResponse.json({
                    success: false,
                    message: '首次快捷登录请先授权手机号',
                }, { status: 400 });
            }

            // 通过 openid 没有找到用户，检查手机号是否已存在
            // 场景：用户可能通过其他方式注册（如手机号注册），但尚未绑定小程序 openid
            let userByPhone = null;
            if (phoneNumber && phoneNumber !== 'null') {
                const { data: existingUserByPhone, error: phoneQueryError } = await serviceRoleSupabase
                    .from('users')
                    .select('*')
                    .eq('phone', phoneNumber)
                    .maybeSingle();

                if (phoneQueryError) {
                    console.error('⚠️ 通过手机号查询用户失败:', phoneQueryError);
                } else if (existingUserByPhone) {
                    userByPhone = existingUserByPhone;
                    console.log('📱 找到已存在的用户（通过手机号匹配）');
                }
            }

            if (userByPhone) {
                // 用户已存在（通过手机号匹配），绑定小程序 openid
                const { data: updatedUser, error: updateError } = await serviceRoleSupabase
                    .from('users')
                    .update({ wechat_openid: openid })
                    .eq('id', userByPhone.id)
                    .select()
                    .single();

                if (updateError) {
                    console.error('⚠️ 绑定 openid 失败:', updateError);
                    user = userByPhone; // 更新失败，使用原用户信息
                } else {
                    user = updatedUser;
                    console.log('✅ 已为现有用户绑定小程序 openid');
                }
            } else {
                // 用户确实不存在，创建新用户
                // password_hash 是 NOT NULL 字段，设置为字符串 "null"
                // phone 设置为获取到的手机号，如果未获取到则设置为字符串 "null"
                // 其他可以为空的字段都设置为 null
                const { data: newUser, error: createError } = await serviceRoleSupabase
                    .from('users')
                    .insert({
                        wechat_openid: openid,
                        password_hash: 'null', // NOT NULL 字段，设置为字符串 "null"
                        phone: phoneNumber, // 设置为获取到的手机号或字符串 "null"
                        email: null,
                        has_drawn: null,
                        last_login_at: new Date().toISOString(),
                        subscription_level: null,
                        subscription_expires_at: null,
                        is_admin: false,
                        admin_role: null,
                        admin_permissions: null,
                        is_coach: false,
                        coach_status: null,
                        primary_role: 'student',
                        invitation_coach_id: null,
                        // created_at 和 updated_at 使用数据库默认值
                    })
                    .select()
                    .single();

                if (createError || !newUser) {
                    console.error('❌ 创建用户失败:', createError);
                    return NextResponse.json({
                        success: false,
                        message: '创建用户失败'
                    }, { status: 500 });
                }

                user = newUser;
                console.log('✅ 已创建新用户');
            }
        }

        await ensureUserProfile(user, phoneNumber, openid);

        // 移除敏感信息
        const { password_hash, ...userWithoutPassword } = user;

        // 查询是否为教练（小程序端用于界面切换）
        const { data: coachRow } = await serviceRoleSupabase
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

        // 生成 JWT token 用于小程序鉴权
        // token 包含 userId，有效期 7 天
        const token = signToken({
            userId: user.id,
            phone: user.phone || null,
            email: user.email || null,
        });

        // 返回用户登录信息
        return NextResponse.json({
            success: true,
            message: "登录成功",
            data: {
                token: token, // JWT token，用于后续API请求鉴权
                openid: openid,
                session_key: session_key,
                unionid: unionid || null,
                user: payload,
                // 注意：session_key 是敏感信息，生产环境应该只在服务端使用
                // 这里为了测试先返回，后续应该移除
            }
        });

    } catch (error: unknown) {
        console.error('❌ 小程序微信登录错误:', error);
        return NextResponse.json({
            success: false,
            message: toPublicApiMessage(error, '登录失败，请稍后重试')
        }, { status: 500 });
    }
}
