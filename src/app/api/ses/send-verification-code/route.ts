import { NextResponse } from "next/server";
import { ApiData } from "@/types/api";
import type { SendVerificationCodeDto, SendVerificationCodeResponseDto } from "./entity";
import { redis } from "@/lib/redisClient";
import nodemailer from 'nodemailer';

// 节流时间（秒）
const THROTTLE_TIME = 30;

export async function POST(req: Request) {
    try {
        const {
            email
        } = await req.json() as SendVerificationCodeDto;

        // 参数校验
        if (!email) {
            return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
                success: false,
                message: "邮箱地址不能为空",
                data: null
            }, { status: 400 });
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
                success: false,
                message: "邮箱格式不正确",
                data: null
            }, { status: 400 });
        }

        // 获取客户端IP地址
        const clientIp = (req.headers.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();

        // 检查Redis连接
        if (!redis) {
            return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
                success: false,
                message: "验证服务不可用",
                data: null
            }, { status: 500 });
        }

        // 检查邮箱节流限制
        const emailThrottleKey = `throttle:email:${email}`;
        const emailLastSent = await redis.get(emailThrottleKey);
        if (emailLastSent) {
            return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
                success: false,
                message: "发送验证码过于频繁，请稍后再试",
                data: null
            }, { status: 429 });
        }

        // 检查IP节流限制
        const ipThrottleKey = `throttle:email:ip:${clientIp}`;
        const ipLastSent = await redis.get(ipThrottleKey);
        if (ipLastSent) {
            return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
                success: false,
                message: "发送验证码过于频繁，请稍后再试",
                data: null
            }, { status: 429 });
        }

        // 生成6位验证码
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        // 验证码有效期（分钟）
        const expireMinutes = 15;

        // 将验证码存入Redis，设置过期时间
        await redis.setEx(`email_verification_code:${email}`, expireMinutes * 60, verificationCode);

        // 设置节流限制，半分钟内不能重复发送
        await redis.setEx(emailThrottleKey, THROTTLE_TIME, Date.now().toString());
        await redis.setEx(ipThrottleKey, THROTTLE_TIME, Date.now().toString());

        // 创建邮件传输器
        const transporter = nodemailer.createTransport({
            host: process.env.TENCENTCLOUD_SMTP_HOST,
            port: parseInt(process.env.TENCENTCLOUD_SMTP_PORT || '465'),
            secure: true, // true for 465, false for other ports
            auth: {
                user: process.env.TENCENTCLOUD_SMTP_USER,
                pass: process.env.TENCENTCLOUD_SMTP_PASSWORD
            }
        });

        // 邮件内容
        const mailOptions = {
            from: `"noreply@healthymax.cn" <${process.env.TENCENTCLOUD_SMTP_USER}>`,
            to: email,
            subject: '邮箱验证 - 智健启能',
            html: `
<!DOCTYPE html>
<html lang="zh-CN">

<head>
    <meta charset="UTF-8">
    <style>
        /* 针对移动端优化 */
        @media only screen and (max-width: 600px) {
            .container {
                width: 100% !important;
                border-radius: 0 !important;
            }
        }
    </style>
</head>

<body
    style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table class="container" width="600" border="0" cellspacing="0" cellpadding="0"
                    style="background-color: #ffffff; border: 1px solid #F1F5F9; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">

                    <tr>
                        <td style="padding: 40px 40px 10px 40px;">
                            <table border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td style="vertical-align: middle; padding-right: 16px;">
                                        <img src="https://coachlink.fit/favicon.jpg" alt="CoachLink"
                                            height="48"
                                            style="border-radius: 12px; display: block; border: 1px solid #F1F5F9;">
                                    </td>
                                    <td style="vertical-align: middle;">
                                        <div
                                            style="font-size: 20px; font-weight: 500; color: #0F172A; letter-spacing: -0.025em; line-height: 1;">
                                            教<span style="color: #f6993b;">链</span>
                                        </div>
                                        <div
                                            style="font-size: 10px; color: #94A3B8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;">
                                            CoachLink
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 0 40px;">
                            <div style="height: 1px; background-color: #F1F5F9; margin: 20px 0;"></div>
                            <h2
                                style="font-size: 18px; font-weight: 700; color: #1E293B; margin: 0 0 16px 0; tracking-tight: -0.025em;">
                                安全验证</h2>
                            <p
                                style="font-size: 15px; line-height: 1.6; color: #64748B; margin: 0 0 24px 0; font-weight: 300;">
                                您好，正在进行账号关联或登录验证。请使用下方的验证码完成操作。为了您的账户安全，切勿将代码分享给他人。
                            </p>

                            <div
                                style="background-color: #F8FAFC; border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 24px;">
                                <div
                                    style="font-size: 20px; color: #94A3B8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px;">
                                    验证码</div>
                                <div
                                    style="font-size: 36px; font-weight: 800; color: #f6993b; letter-spacing: 0.2em; font-family: 'Monaco', 'Consolas', monospace;">
                                    ${verificationCode}
                                </div>
                            </div>

                            <p style="font-size: 13px; color: #94A3B8; text-align: center; margin: 0 0 30px 0;">
                                该验证码将在 <span style="color: #64748B; font-weight: 600;">${expireMinutes} 分钟</span> 后失效
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td
                            style="padding: 30px 40px; background-color: #FDFDFD; border-top: 1px solid #F8FAFC; text-align: center;">
                            <p style="font-size: 12px; color: #b6b2ad; margin: 0 0 8px 0; font-weight: 300;">
                                如果您没有请求此代码，请忽略此邮件。
                            </p>
                            <p
                                style="font-size: 11px; color: #b6b2ad; margin: 0; font-weight: 400; letter-spacing: 0.05em;">
                                &copy; 2025-2026 COACHLINK 智健启能. ALL RIGHTS RESERVED.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>

</html>
            `
        };

        // 发送邮件
        const info = await transporter.sendMail(mailOptions);

        console.log('邮件发送成功:', info.messageId);

        return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
            success: true,
            message: "验证码发送成功",
            data: {
                requestId: info.messageId
            }
        });

    } catch (error: any) {
        console.error("发送邮箱验证码异常:", error);
        return NextResponse.json<ApiData<SendVerificationCodeResponseDto>>({
            success: false,
            message: `发送邮箱验证码异常: ${error.message || '未知错误'}`,
            data: null
        }, { status: 500 });
    }
}