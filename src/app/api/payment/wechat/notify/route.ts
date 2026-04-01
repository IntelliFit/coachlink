import { NextRequest, NextResponse } from "next/server";
import {
    decryptCallbackBody,
    verifyCallbackSignature,
    type WechatPayNotificationResource,
} from "@/lib/wechatPay";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    const rawBody = await request.text();

    try {
        verifyCallbackSignature(request.headers, rawBody);
        const payload = JSON.parse(rawBody) as WechatPayNotificationResource;
        const decrypted = decryptCallbackBody(payload);

        console.log("[Wechat Pay Notify] verified callback received:", {
            eventType: payload.event_type,
            summary: payload.summary,
            outTradeNo: decrypted?.out_trade_no,
            transactionId: decrypted?.transaction_id,
            tradeState: decrypted?.trade_state,
            tradeType: decrypted?.trade_type,
            successTime: decrypted?.success_time,
            amountTotal: decrypted?.amount?.total,
            payerOpenid: decrypted?.payer?.openid,
        });

        return NextResponse.json({
            code: "SUCCESS",
            message: "成功",
        });
    } catch (error: any) {
        console.error("[Wechat Pay Notify] handle callback failed:", error);
        return NextResponse.json(
            {
                code: "FAIL",
                message: error?.message || "处理失败",
            },
            { status: 500 },
        );
    }
}
