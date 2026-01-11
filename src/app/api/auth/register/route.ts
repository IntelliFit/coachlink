import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { hashPassword } from "../[...nextauth]/verify";
import { RegisterDto, RegisterResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import redis from "@/lib/redisClient";

export async function POST(req: NextRequest) {
    const {
        phone,
        password,
        verifyCode,
    } = await req.json() as RegisterDto;

    const trimmedPhone = phone?.trim();
    const trimmedPassword = password?.trim();
    const trimmedVerifyCode = verifyCode?.trim();

    if (!trimmedPhone || !trimmedPassword) {
        return NextResponse.json({ message: "手机号和密码不能为空" }, {
            status: 200,
        });
    }

    if (!trimmedVerifyCode) {
        return NextResponse.json({ message: "验证码不能为空" }, {
            status: 200,
        });
    }

    // 开发模式下接受模拟验证码 123456
    const useMockSms = process.env.NODE_ENV === "development";
    const isMockCode = useMockSms && trimmedVerifyCode === "123456";

    if (!isMockCode) {
        // 生产模式：验证真实验证码
        if (!redis) {
            throw new Error("验证服务不可用");
        }

        const storedCode = await redis.get(
            `sms_verification_code:${trimmedPhone}`,
        );
        if (!storedCode) {
            return NextResponse.json({ message: "验证码已过期或不存在" }, {
                status: 200,
            });
        }

        if (storedCode !== trimmedVerifyCode) {
            return NextResponse.json({ message: "验证码错误" }, {
                status: 200,
            });
        }

        // 验证成功后删除验证码，防止重复使用
        await redis.del(`sms_verification_code:${trimmedPhone}`);
    }

    const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("phone", trimmedPhone)
        .single();

    if (existingUser) {
        return NextResponse.json({ message: "手机号已注册" }, { status: 200 });
    }

    const password_hash = hashPassword(trimmedPassword);

    const { data: user } = await supabase
        .from("users")
        .insert({
            phone: trimmedPhone,
            password_hash,
            created_at: new Date().toISOString(),
            last_login_at: new Date().toISOString(),
        })
        .select("*")
        .single();

    return NextResponse.json<ApiData<RegisterResponseDto>>({
        message: "注册成功",
        success: true,
        data: {
            user,
        },
    });
}
