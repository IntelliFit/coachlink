import { NextResponse } from "next/server";
import { ApiData } from "@/types/api";
import type {
    SendVerificationCodeDto,
    SendVerificationCodeResponseDto,
} from "./entity";
import { redis } from "@/lib/redisClient";
import * as TencentCloudSDK from "tencentcloud-sdk-nodejs";
import { SendSmsResponse } from "tencentcloud-sdk-nodejs/tencentcloud/services/ic/v20190307/ic_models";

// 导入对应产品模块的client models
const smsClient = TencentCloudSDK.sms.v20210111.Client;

// 节流时间（秒）
const THROTTLE_TIME = 30;

export async function POST(req: Request) {
    try {
        const {
            phoneNumber,
        } = await req.json() as SendVerificationCodeDto;

        // 参数校验
        if (!phoneNumber) {
            return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
                success: false,
                message: "手机号码不能为空",
                data: null,
            }, { status: 400 });
        }

        // 获取客户端IP地址
        const clientIp = (req.headers.get("x-forwarded-for") ?? "127.0.0.1")
            .split(",")[0].trim();

        // 检查Redis连接
        if (!redis) {
            return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
                success: false,
                message: "验证服务不可用",
                data: null,
            }, { status: 500 });
        }

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

        // 验证码有效期（分钟）
        const expireMinutes = 15;

        // 检查是否使用模拟短信（开发环境）
        const useMockSms = process.env.NEXT_PUBLIC_USE_MOCK_SMS === "true";

        // 生成6位验证码：模拟环境使用固定验证码 123456，生产环境使用随机验证码
        const verificationCode = useMockSms
            ? "123456"
            : Math.floor(100000 + Math.random() * 900000).toString();

        // 将验证码存入Redis，设置过期时间
        await redis.setEx(
            `sms_verification_code:${phoneNumber}`,
            expireMinutes * 60,
            verificationCode,
        );

        // 设置节流限制，半分钟内不能重复发送
        await redis.setEx(
            phoneThrottleKey,
            THROTTLE_TIME,
            Date.now().toString(),
        );
        await redis.setEx(ipThrottleKey, THROTTLE_TIME, Date.now().toString());

        // 模拟短信模式下直接返回成功，不发送真实短信
        if (useMockSms) {
            console.log(
                `[Mock SMS] 验证码已生成: ${verificationCode}，手机号: ${phoneNumber}`,
            );
            return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
                success: true,
                message: "验证码发送成功（开发环境模拟）",
                data: {
                    requestId: "mock-request-id",
                },
            });
        }

        // 生产环境发送短信
        if (!TencentCloudSDK) {
            return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
                success: false,
                message: "SMS服务不可用",
                data: null,
            }, { status: 500 });
        }

        // 实例化要请求产品(以sms为例)的client对象
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
            TemplateId: process.env.TENCENTCLOUD_SMS_VERIFICATION_TEMPLATE_ID, // 使用专门的验证码模板ID
            TemplateParamSet: [verificationCode, expireMinutes.toString()],
            PhoneNumberSet: [`+86${phoneNumber.replace(/\D/g, "")}`],
            SessionContext: "",
            ExtendCode: "",
            SenderId: "",
        };

        // 验证必要的环境变量
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

        // 发送短信
        const response = await new Promise<SendSmsResponse>(
            (resolve, reject) => {
                client.SendSms(params, function (err, response) {
                    if (err) {
                        // 发送失败时清除节流限制，允许重新发送
                        redis.del(phoneThrottleKey).catch(console.error);
                        reject(err);
                        return;
                    }
                    resolve(response);
                });
            },
        );

        console.log(response);

        // 检查发送结果
        const requestId = response.RequestId;
        if (!requestId) {
            // 发送失败时清除节流限制，允许重新发送
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
            data: {
                requestId,
            },
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
