import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { hashPassword } from "../[...nextauth]/verify";
import { ResetPasswordDto, ResetPasswordResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import redis from "@/lib/redisClient";

export async function POST(req: NextRequest) {
    const {
        phone,
        verifyCode,
        newPassword,
    } = await req.json() as ResetPasswordDto;

    const trimmedPhone = phone?.trim();
    const trimmedVerifyCode = verifyCode?.trim();
    const trimmedNewPassword = newPassword?.trim();

    if (!trimmedPhone || !trimmedVerifyCode || !trimmedNewPassword) {
        return NextResponse.json({
            success: false,
            message: "手机号、验证码和新密码不能为空",
        }, { status: 200 });
    }

    // 验证验证码
    if (!redis) {
        return NextResponse.json({
            success: false,
            message: "验证服务不可用",
        }, { status: 500 });
    }

    // 开发模式下接受模拟验证码 123456
    const useMockSms = process.env.NODE_ENV === "development";
    const isMockCode = useMockSms && trimmedVerifyCode === "123456";

    if (!isMockCode) {
        const storedCode = await redis.get(
            `sms_verification_code:${trimmedPhone}`,
        );

        if (!storedCode) {
            return NextResponse.json({
                success: false,
                message: "验证码已过期或不存在",
            }, { status: 200 });
        }

        if (storedCode !== trimmedVerifyCode) {
            return NextResponse.json({
                success: false,
                message: "验证码错误",
            }, { status: 200 });
        }

        // 验证成功后删除验证码
        await redis.del(`sms_verification_code:${trimmedPhone}`);
    }

    // 检查用户是否存在
    const { data: user, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("phone", trimmedPhone)
        .single();

    if (userError || !user) {
        return NextResponse.json({
            success: false,
            message: "该手机号未注册",
        }, { status: 200 });
    }

    // 更新密码
    const password_hash = hashPassword(trimmedNewPassword);

    const { error: updateError } = await supabase
        .from("users")
        .update({
            password_hash,
            updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

    if (updateError) {
        return NextResponse.json({
            success: false,
            message: "密码重置失败，请重试",
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<ResetPasswordResponseDto>>({
        success: true,
        message: "密码重置成功，请使用新密码登录",
        data: { success: true },
    });
}
