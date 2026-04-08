import { NextRequest, NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import { getApiUserId } from "@/lib/getApiUserId";
import { queryOrderByOutTradeNo } from "@/lib/wechatPay";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

interface WechatTestOrderQueryResponse {
    outTradeNo: string;
    tradeState: string | null;
    tradeStateDesc: string | null;
    transactionId: string | null;
    payerOpenid: string | null;
    successTime: string | null;
    amountFen: number | null;
    amountYuan: string | null;
}

export async function GET(request: NextRequest) {
    try {
        const userId = await getApiUserId(request);
        if (!userId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "请先登录后再查询支付状态", data: null },
                { status: 401 },
            );
        }

        const outTradeNo = request.nextUrl.searchParams.get("outTradeNo")?.trim();
        if (!outTradeNo) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "缺少 outTradeNo 参数", data: null },
                { status: 400 },
            );
        }

        const { data: user, error: userError } = await serviceRoleSupabase
            .from("users")
            .select("wechat_openid")
            .eq("id", userId)
            .maybeSingle();

        if (userError) {
            console.error("[Wechat Pay] query user openid failed:", userError);
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "查询用户信息失败", data: null },
                { status: 500 },
            );
        }

        const result = await queryOrderByOutTradeNo(outTradeNo);
        if (user?.wechat_openid && result.payerOpenid && user.wechat_openid !== result.payerOpenid) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "该订单不属于当前用户", data: null },
                { status: 403 },
            );
        }

        return NextResponse.json<ApiData<WechatTestOrderQueryResponse>>({
            success: true,
            message: "查询支付状态成功",
            data: {
                outTradeNo,
                tradeState: result.tradeState,
                tradeStateDesc: result.tradeStateDesc,
                transactionId: result.transactionId,
                payerOpenid: result.payerOpenid,
                successTime: result.successTime,
                amountFen: result.amountTotal,
                amountYuan:
                    typeof result.amountTotal === "number"
                        ? (result.amountTotal / 100).toFixed(2)
                        : null,
            },
        });
    } catch (error: any) {
        console.error("[Wechat Pay] query order failed:", error);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: error?.message || "查询支付状态失败", data: null },
            { status: 500 },
        );
    }
}
