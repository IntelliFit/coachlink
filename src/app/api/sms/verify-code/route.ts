import { NextResponse } from "next/server";
import { ApiData } from "@/types/api";
import type { VerifyCodeDto, VerifyCodeResponseDto } from "./entity";
import * as TencentCloudSDK from 'tencentcloud-sdk-nodejs';
import { redis } from "@/lib/redisClient";

export async function POST(req: Request) {
    try {
        const {
            phoneNumber,
            code
        } = await req.json() as VerifyCodeDto;

        // 参数校验
        if (!phoneNumber || !code) {
            return NextResponse.json<ApiData<VerifyCodeResponseDto>>({
                success: false,
                message: "手机号码和验证码不能为空",
                data: null
            }, { status: 400 });
        }

        const storedCode = await redis.get(`sms_verification_code:${phoneNumber}`);

        if (!storedCode) {
            return NextResponse.json<ApiData<VerifyCodeResponseDto>>({
                success: true,
                message: "验证码已过期或不存在",
                data: {
                    success: true,
                    message: "验证码已过期或不存在",
                    verified: false
                }
            });
        }

        // 验证验证码
        if (storedCode === code) {
            // 验证成功后删除验证码，防止重复使用
            await redis.del(`sms_verification_code:${phoneNumber}`);

            return NextResponse.json<ApiData<VerifyCodeResponseDto>>({
                success: true,
                message: "验证码验证成功",
                data: {
                    success: true,
                    message: "验证码验证成功",
                    verified: true
                }
            });
        } else {
            return NextResponse.json<ApiData<VerifyCodeResponseDto>>({
                success: true,
                message: "验证码错误",
                data: {
                    success: true,
                    message: "验证码错误",
                    verified: false
                }
            });
        }
    } catch (error: any) {
        console.error("验证验证码异常:", error);
        return NextResponse.json<ApiData<VerifyCodeResponseDto>>({
            success: false,
            message: `验证验证码异常: ${error.message || '未知错误'}`,
            data: null
        }, { status: 500 });
    }
}