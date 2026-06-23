import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";
import supabase from "@/lib/supabaseClient";
import { hashPassword } from "@/app/api/auth/[...nextauth]/verify";
import { ApiData } from "@/types/api";
import { ResetPasswordDto, ResetPasswordResponseDto } from "./entity";
import redis from "@/lib/redisClient";

export async function POST(req: Request) {
    const session = await getServerSession();
    const authUser = session?.user?.id ? { userId: session.user.id } : await getAuthUser(req);

    if (!authUser.userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const {
        type,
        verifyCode,
        newPassword,
    } = await req.json() as ResetPasswordDto;

    const trimmedVerifyCode = verifyCode?.trim();
    const trimmedNewPassword = newPassword?.trim();

    if (!type || (type !== 'phone' && type !== 'email')) {
        return NextResponse.json({
            success: false,
            message: "验证类型不正确",
            data: null,
        }, { status: 200 });
    }

    if (!trimmedVerifyCode || !trimmedNewPassword) {
        return NextResponse.json({
            success: false,
            message: "验证码和新密码不能为空",
            data: null,
        }, { status: 200 });
    }

    // 获取用户信息，检查是否绑定了对应的联系方式
    const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, phone, email")
        .eq("id", authUser.userId)
        .single();

    if (userError || !user) {
        return NextResponse.json({
            success: false,
            message: "用户不存在",
            data: null,
        }, { status: 404 });
    }

    // 检查用户是否绑定了对应的联系方式
    const contactValue = type === 'phone' ? user.phone : user.email;
    if (!contactValue) {
        return NextResponse.json({
            success: false,
            message: type === 'phone' ? '您尚未绑定手机号，请先绑定手机号' : '您尚未绑定邮箱，请先绑定邮箱',
            data: null,
        }, { status: 200 });
    }

    // 验证验证码
    if (!redis) {
        return NextResponse.json({
            success: false,
            message: "验证服务不可用",
            data: null,
        }, { status: 500 });
    }

    // 开发模式下接受模拟验证码 123456
    const useMockCode = process.env.NODE_ENV === "development";
    const isMockCode = useMockCode && trimmedVerifyCode === "123456";

    if (!isMockCode) {
        const verificationKey = type === 'phone'
            ? `sms_verification_code:${contactValue}`
            : `email_verification_code:${contactValue}`;

        const storedCode = await redis.get(verificationKey);

        if (!storedCode) {
            return NextResponse.json({
                success: false,
                message: "验证码已过期或不存在",
                data: null,
            }, { status: 200 });
        }

        if (storedCode !== trimmedVerifyCode) {
            return NextResponse.json({
                success: false,
                message: "验证码错误",
                data: null,
            }, { status: 200 });
        }

        // 验证成功后删除验证码
        await redis.del(verificationKey);
    }

    // 生成新密码哈希
    const password_hash = hashPassword(trimmedNewPassword);

    // 更新数据库
    const { error: updateError } = await supabase
        .from("users")
        .update({
            password_hash,
            updated_at: new Date().toISOString(),
        })
        .eq("id", session.user.id);

    if (updateError) {
        return NextResponse.json({
            success: false,
            message: "密码重置失败，请重试",
            data: null,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<ResetPasswordResponseDto>>({
        success: true,
        message: "密码重置成功",
        data: { success: true },
    });
}
