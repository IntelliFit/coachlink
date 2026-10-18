import { NextRequest, NextResponse } from "next/server";
import { verifyWechatXPayCallbackSignature } from "@/lib/wechatXPay";
import {
    findXPayOrderByOutTradeNo,
    markXPayOrderPaid,
    markXPayOrderRefunded,
    validateXPayOrderMatch,
} from "@/app/api/payment/wechat/xpayOrder";

export const runtime = "nodejs";

function callbackSignature(request: NextRequest) {
    return {
        timestamp: String(request.nextUrl.searchParams.get("timestamp") || ""),
        nonce: String(request.nextUrl.searchParams.get("nonce") || ""),
        signature: String(
            request.nextUrl.searchParams.get("signature") ||
            request.nextUrl.searchParams.get("msg_signature") ||
            "",
        ),
    };
}

function verifyRequest(request: NextRequest) {
    const values = callbackSignature(request);
    return Boolean(values.timestamp && values.nonce && values.signature) &&
        verifyWechatXPayCallbackSignature(values);
}

export async function GET(request: NextRequest) {
    try {
        if (!verifyRequest(request)) return new Response("", { status: 403 });
        return new Response(String(request.nextUrl.searchParams.get("echostr") || ""), {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=UTF-8" },
        });
    } catch (error) {
        console.error("[Wechat XPay Notify] GET verification failed:", error);
        return new Response("", { status: 503 });
    }
}

export async function POST(request: NextRequest) {
    try {
        if (!verifyRequest(request)) return new Response("", { status: 403 });
        const body = await request.json() as Record<string, any>;
        const event = String(body.Event || "").trim();

        if (event === "xpay_goods_deliver_notify") {
            const outTradeNo = String(body.OutTradeNo || "").trim();
            const order = await findXPayOrderByOutTradeNo(outTradeNo);
            if (!order) return new Response("", { status: 404 });
            const goods = body.GoodsInfo || {};
            const payment = body.WeChatPayInfo || body.WechatPayInfo || {};
            validateXPayOrderMatch(order, {
                outTradeNo,
                openId: String(body.openid || body.OpenId || ""),
                env: Number(body.Env ?? body.env),
                productId: String(goods.ProductId || ""),
                quantity: Number(goods.Quantity),
                originalPrice: Number(goods.OrigPrice),
                actualPrice: Number(goods.ActualPrice),
            });
            const paidAt = Number(payment.PaidTime) > 0
                ? new Date(Number(payment.PaidTime) * 1000)
                : new Date();
            await markXPayOrderPaid(order, {
                paidAt,
                transactionId: String(payment.TransactionId || ""),
            });
        } else if (event === "xpay_refund_notify") {
            if (Number(body.RetCode || 0) === 0) {
                const outTradeNo = String(body.MchOrderId || "").trim();
                const order = await findXPayOrderByOutTradeNo(outTradeNo);
                if (!order) return new Response("", { status: 404 });
                const refundedAt = Number(body.RefundSuccTimestamp) > 0
                    ? new Date(Number(body.RefundSuccTimestamp) * 1000)
                    : new Date();
                await markXPayOrderRefunded(order, {
                    refundedAt,
                    refundFee: Math.round(Number(body.RefundFee || 0)),
                    transactionId: String(body.WxpayRefundTransactionId || ""),
                });
            } else {
                console.error("[Wechat XPay Notify] refund failed:", {
                    outTradeNo: body.MchOrderId,
                    retCode: body.RetCode,
                    retMsg: body.RetMsg,
                });
            }
        } else {
            return new Response("", { status: 400 });
        }

        return NextResponse.json({ ErrCode: 0, ErrMsg: "success" });
    } catch (error) {
        console.error("[Wechat XPay Notify] processing failed:", error);
        return new Response("", { status: 500 });
    }
}
