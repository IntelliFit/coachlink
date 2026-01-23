import { NextResponse } from "next/server";
import { ApiData } from "@/types/api";
import type {
    SendVerificationCodeDto,
    SendVerificationCodeResponseDto,
} from "./entity";
import { redis } from "@/lib/redisClient";
import * as TencentCloudSDK from "tencentcloud-sdk-nodejs";
import { SendSmsResponse } from "tencentcloud-sdk-nodejs/tencentcloud/services/ic/v20190307/ic_models";

const smsClient = TencentCloudSDK.sms.v20210111.Client;
const THROTTLE_TIME = 30;

export async function POST(req: Request) {
    try {
        const { phoneNumber, captchaToken } = await req
            .json() as SendVerificationCodeDto;

        if (!phoneNumber) {
            return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
                success: false,
                message: "手机号码不能为空",
                data: null,
            }, { status: 400 });
        }

        if (!redis) {
            return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
                success: false,
                message: "验证服务不可用",
                data: null,
            }, { status: 500 });
        }

        // 检查是否使用模拟短信（开发环境）
        const useMockSms = process.env.NEXT_PUBLIC_USE_MOCK_SMS === "true";

        // 生产环境需要验证 captchaToken
        if (!useMockSms) {
            if (!captchaToken) {
                return NextResponse.json<
                    ApiData<SendVerificationCodeResponseDto>
                >({
                    success: false,
                    message: "请先完成滑块验证",
                    data: null,
                }, { status: 400 });
            }
            const tokenKey = `captcha:token:${captchaToken}`;
            const tokenValid = await redis.get(tokenKey);
            await redis.del(tokenKey);
            if (!tokenValid) {
                return NextResponse.json<
                    ApiData<SendVerificationCodeResponseDto>
                >({
                    success: false,
                    message: "验证已过期，请重新完成滑块验证",
                    data: null,
                }, { status: 400 });
            }
        }

        const clientIp = (req.headers.get("x-forwarded-for") ?? "127.0.0.1")
            .split(",")[0].trim();

        // 检查手机号节流限制
        const phoneThrottleKey = `throttle:sms:${phoneNumber}`;
        const phoneLastSent = await redis.get(phoneThrottleKey);
        if (phoneLastSent) {
            return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
                success: false,
                message: "发送验证码过于频繁，请稍后再试",
                data: null,
            }, { status: 429 });
        }

        // 检查IP节流限制
        const ipThrottleKey = `throttle:sms:ip:${clientIp}`;
        const ipLastSent = await redis.get(ipThrottleKey);
        if (ipLastSent) {
            return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
                success: false,
                message: "发送验证码过于频繁，请稍后再试",
                data: null,
            }, { status: 429 });
        }

        const expireMinutes = 15;
        const verificationCode = useMockSms
            ? "123456"
            : Math.floor(100000 + Math.random() * 900000).toString();

        await redis.setEx(
            `sms_verification_code:${phoneNumber}`,
            expireMinutes * 60,
            verificationCode,
        );
        await redis.setEx(
            phoneThrottleKey,
            THROTTLE_TIME,
            Date.now().toString(),
        );
        await redis.setEx(ipThrottleKey, THROTTLE_TIME, Date.now().toString());

        if (useMockSms) {
            console.log(
                `[Mock SMS] 验证码已生成: ${verificationCode}，手机号: ${phoneNumber}`,
            );
            return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
                success: true,
                message: "验证码发送成功（开发环境模拟）",
                data: { requestId: "mock-request-id" },
            });
        }

        if (!TencentCloudSDK) {
            return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
                success: false,
                message: "SMS服务不可用",
                data: null,
            }, { status: 500 });
        }

        const client = new smsClient({
            credential: {
                secretId: process.env.TENCENTCLOUD_SECRET_ID,
                secretKey: process.env.TENCENTCLOUD_SECRET_KEY,
            },
            region: process.env.TENCENTCLOUD_REGION || "ap-guangzhou",
            profile: {
                signMethod: "HmacSHA256",
                httpProfile: {
                    reqMethod: "POST",
                    reqTimeout: 10,
                    endpoint: "sms.tencentcloudapi.com",
                },
            },
        });

        const params = {
            SmsSdkAppId: process.env.TENCENTCLOUD_SMS_SDK_APP_ID,
            SignName: process.env.TENCENTCLOUD_SMS_SIGN_NAME,
            TemplateId: process.env.TENCENTCLOUD_SMS_VERIFICATION_TEMPLATE_ID,
            TemplateParamSet: [verificationCode, expireMinutes.toString()],
            PhoneNumberSet: [`+86${phoneNumber.replace(/\D/g, "")}`],
            SessionContext: "",
            ExtendCode: "",
            SenderId: "",
        };

        if (
            !process.env.TENCENTCLOUD_SMS_SDK_APP_ID ||
            !process.env.TENCENTCLOUD_SMS_SIGN_NAME ||
            !process.env.TENCENTCLOUD_SMS_VERIFICATION_TEMPLATE_ID
        ) {
            return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
                success: false,
                message: "短信服务配置不完整",
                data: null,
            }, { status: 500 });
        }

        const response = await new Promise<SendSmsResponse>(
            (resolve, reject) => {
                client.SendSms(params, function (err, response) {
                    if (err) {
                        redis.del(phoneThrottleKey).catch(console.error);
                        reject(err);
                        return;
                    }
                    resolve(response);
                });
            },
        );

        console.log(response);
        const requestId = response.RequestId;
        if (!requestId) {
            await redis.del(phoneThrottleKey);
            return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
                success: false,
                message: "发送短信失败，未收到状态报告",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
            success: true,
            message: "验证码发送成功",
            data: { requestId },
        });
    } catch (error: any) {
        console.error("发送验证码异常:", error);
        return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
            success: false,
            message: `发送验证码异常: ${error.message || "未知错误"}`,
            data: null,
        }, { status: 500 });
    }
}
