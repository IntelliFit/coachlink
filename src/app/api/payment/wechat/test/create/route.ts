import { NextRequest, NextResponse } from "next/server";
import { rejectWechatPurchase } from '@/lib/wechatFreeRelease';
import { getApiUserId } from "@/lib/getApiUserId";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import {
    buildMiniProgramPaymentParams,
    createMiniProgramTestOrder,
    generateOutTradeNo,
} from "@/lib/wechatPay";

export const runtime = "nodejs";

interface CreateWechatTestPaymentResponse {
    amountFen: number;
    amountYuan: string;
    description: string;
    outTradeNo: string;
    paymentParams: {
        appId: string;
        timeStamp: string;
        nonceStr: string;
        package: string;
        signType: "RSA";
        paySign: string;
    };
}

export async function POST(request: NextRequest) {
    const paused = rejectWechatPurchase(request, { wechatOnly: true });
    if (paused) return paused;
    try {
        const userId = await getApiUserId(request);
        if (!userId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "请先登录后再发起支付", data: null },
                { status: 401 },
            );
        }

        const { data: user, error: userError } = await serviceRoleSupabase
            .from("users")
            .select("id, wechat_openid")
            .eq("id", userId)
            .maybeSingle();

        if (userError) {
            console.error("[Wechat Pay] query user failed:", userError);
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "查询用户失败", data: null },
                { status: 500 },
            );
        }

        if (!user?.wechat_openid) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "当前账号未绑定小程序 openid，请先使用微信快捷登录", data: null },
                { status: 400 },
            );
        }

        const amountFen = 1;
        const outTradeNo = generateOutTradeNo("CLWXT");
        const description = "CoachLink 微信支付测试 0.01 元";

        const order = await createMiniProgramTestOrder({
            description,
            out_trade_no: outTradeNo,
            amount: {
                total: amountFen,
                currency: "CNY",
            },
            payer: {
                openid: user.wechat_openid,
            },
        });

        const paymentParams = buildMiniProgramPaymentParams(order.prepay_id);

        return NextResponse.json<ApiData<CreateWechatTestPaymentResponse>>({
            success: true,
            message: "测试支付单创建成功",
            data: {
                amountFen,
                amountYuan: "0.01",
                description,
                outTradeNo,
                paymentParams,
            },
        });
    } catch (error: any) {
        console.error("[Wechat Pay] create test order failed:", {
            message: error?.message,
            stack: error?.stack,
        });
        return NextResponse.json<ApiData<null>>(
            { success: false, message: error?.message || "创建测试支付单失败", data: null },
            { status: 500 },
        );
    }
}
