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

    if (!phone || !password) {
        return NextResponse.json({ message: "手机号和密码不能为空" }, {
            status: 200,
        });
    }

    if (!verifyCode) {
        return NextResponse.json({ message: "验证码不能为空" }, {
            status: 200,
        });
    }

    // 开发模式下接受模拟验证码 123456
    const useMockSms = process.env.NODE_ENV === "development";
    const isMockCode = useMockSms && verifyCode.trim() === "123456";

    if (!isMockCode) {
        // 生产模式：验证真实验证码
        if (!redis) {
            throw new Error("验证服务不可用");
        }

        const storedCode = await redis.get(
            `sms_verification_code:${phone.trim()}`,
        );
        if (!storedCode) {
            return NextResponse.json({ message: "验证码已过期或不存在" }, {
                status: 200,
            });
        }

        if (storedCode !== verifyCode.trim()) {
            return NextResponse.json({ message: "验证码错误" }, {
                status: 200,
            });
        }

        // 验证成功后删除验证码，防止重复使用
        await redis.del(`sms_verification_code:${phone.trim()}`);
    }

    const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("phone", phone)
        .single();

    if (existingUser) {
        return NextResponse.json({ message: "手机号已注册" }, { status: 200 });
    }

    const password_hash = hashPassword(password);

    const { data: user } = await supabase
        .from("users")
        .insert({
            phone,
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
