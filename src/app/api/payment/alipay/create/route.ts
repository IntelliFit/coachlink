import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    CreateAlipayOrderDto,
    CreateAlipayOrderResponseDto,
} from "./entity";
import { AlipaySdk } from "alipay-sdk";

// 文档：https://opendocs.alipay.com/open/59da99d0_alipay.trade.page.pay?pathHash=e26b497f&scene=22
// 流程和博客：https://kirigaya.cn/blog/article?seq=361
export async function POST(req: Request) {
    const session = await getServerSession();

    if (!session?.user?.id) {
        return NextResponse.json(
            { success: false, message: "用户未登录", data: null },
            { status: 401 },
        );
    }

    const userId = session.user.id;

    // Build a public baseUrl for Alipay callbacks (ngrok/prod) from request headers.
    // This avoids relying on Alipay后台配置 when testing with ngrok.
    const xfProto = req.headers.get("x-forwarded-proto");
    const xfHost = req.headers.get("x-forwarded-host");
    const host = req.headers.get("host");
    const proto = xfProto || (host?.includes("localhost") ? "http" : "https");
    const baseUrl = `${proto}://${xfHost || host}`;

    // 读取参数
    const {
        subject,
        totalAmount,
        orderType,
        orderData = {},
        createMode = "common",
        isMobile = false,
    } = (await req.json()) as CreateAlipayOrderDto;

    if (!subject || !totalAmount) {
        return NextResponse.json(
            { success: false, message: "缺少必要参数", data: null },
            { status: 400 },
        );
    }

    // 读取支付宝配置
    const {
        ALIPAY_APP_ID,
        ALIPAY_PRIVATE_KEY,
        ALIPAY_PUBLIC_KEY,
        ALIPAY_GATEWAY,
    } = process.env;

    if (!ALIPAY_APP_ID || !ALIPAY_PRIVATE_KEY || !ALIPAY_PUBLIC_KEY) {
        return NextResponse.json(
            { success: false, message: "支付宝配置不完整", data: null },
            { status: 500 },
        );
    }

    // 初始化 alipay-sdk
    const alipaySdk = new AlipaySdk({
        appId: ALIPAY_APP_ID,
        privateKey: ALIPAY_PRIVATE_KEY,
        alipayPublicKey: ALIPAY_PUBLIC_KEY,
        gateway: ALIPAY_GATEWAY,
    });

    // 写入订单到数据库
    const { data: order, error: orderError } = await supabase
        .from("alipay_orders")
        .insert({
            subject,
            total_amount: totalAmount,
            order_type: orderType,
            order_data: orderData,
            user_id: userId,
            status: "pending",
            qr_code: "",
        })
        .select()
        .single();

    if (orderError) {
        return NextResponse.json({
            success: false,
            message: orderError.message,
            data: "创建支付订单失败",
        });
    }

    // Bind platform payment order to subscription (so notify can auto-confirm/renew)
    try {
        const od: any = orderData || {};
        const subscriptionId = od.subscriptionId as string | undefined;
        const coachId = od.coachId as string | undefined;

        if (
            subscriptionId &&
            (orderType === "subscription" || orderType === "subscription_renew")
        ) {
            const { data: sub, error: subErr } = await serviceRoleSupabase
                .from("coach_subscriptions")
                .select("id, student_id, coach_id")
                .eq("id", subscriptionId)
                .single();

            if (subErr || !sub) {
                return NextResponse.json(
                    { success: false, message: "订阅不存在，无法创建平台支付订单", data: null },
                    { status: 400 },
                );
            }

            if (sub.student_id !== userId) {
                return NextResponse.json(
                    { success: false, message: "无权为该订阅创建支付订单", data: null },
                    { status: 403 },
                );
            }

            if (coachId && sub.coach_id !== coachId) {
                return NextResponse.json(
                    { success: false, message: "订阅与教练不匹配，无法创建支付订单", data: null },
                    { status: 400 },
                );
            }

            await serviceRoleSupabase
                .from("coach_subscriptions")
                .update({
                    order_id: order.id,
                    payment_method: "platform_alipay",
                })
                .eq("id", subscriptionId);
        }
    } catch (e) {
        // Do not block payment creation, but log for investigation
        console.error("[Alipay Create] Bind subscription failed:", e);
    }

    // 根据设备类型选择支付方式
    let result: string;
    if (isMobile) {
        // 移动端使用 wap.pay，可以唤起支付宝APP
        result = alipaySdk.pageExec("alipay.trade.wap.pay", {
            notifyUrl: `${baseUrl}/api/payment/alipay/notify`,
            returnUrl: `${baseUrl}/api/payment/alipay/return`,
            bizContent: {
                out_trade_no: order.id,
                total_amount: totalAmount.toString(),
                subject,
                product_code: "QUICK_WAP_WAY",
            },
        });
    } else {
        // PC端使用 page.pay，显示二维码
        result = alipaySdk.pageExec("alipay.trade.page.pay", {
            notifyUrl: `${baseUrl}/api/payment/alipay/notify`,
            returnUrl: `${baseUrl}/api/payment/alipay/return`,
            bizContent: {
                out_trade_no: order.id,
                total_amount: totalAmount.toString(),
                subject,
                product_code: "FAST_INSTANT_TRADE_PAY",
                qr_pay_mode: "0",
            },
        });
    }

    if (!result) {
        await supabase
            .from("alipay_orders")
            .delete()
            .eq("id", order.id);

        return NextResponse.json({
            success: false,
            message: "无法创建订单",
            data: result,
        });
    } else if (createMode === "test") {
        await supabase
            .from("alipay_orders")
            .delete()
            .eq("id", order.id);
    }

    if (orderError) {
        return NextResponse.json(
            { success: false, message: "订单写入失败", data: null },
            { status: 500 },
        );
    }

    // 返回响应
    return NextResponse.json<ApiData<CreateAlipayOrderResponseDto>>({
        success: true,
        message: "订单创建成功",
        data: {
            order: {
                id: order.id.toString(),
                out_trade_no: order.out_trade_no,
                subject: order.subject,
                total_amount: order.total_amount,
                status: order.status,
                created_at: order.created_at,
            },
            paymentInfo: {
                formHtml: result,
                description: "支付宝扫码支付",
            },
        },
    });
}
