import { NextResponse } from "next/server";
import type { ApiData } from "@/types/api";

function resolveRedirectBaseUrl(req: Request) {
    const xfProto = req.headers.get("x-forwarded-proto");
    const xfHost = req.headers.get("x-forwarded-host");
    const host = req.headers.get("host");
    const proto = xfProto || (host?.includes("localhost") ? "http" : "https");
    if (xfHost || host) {
        return `${proto}://${xfHost || host}`;
    }
    return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

function redirectToPaymentPage(req: Request, orderId: string) {
    const redirectBaseUrl = resolveRedirectBaseUrl(req);
    return NextResponse.redirect(`${redirectBaseUrl}/payment/${encodeURIComponent(orderId)}`);
}

function getOutTradeNoFromSearch(req: Request) {
    const url = new URL(req.url);
    return String(url.searchParams.get("out_trade_no") || "").trim();
}

async function getOutTradeNoFromBody(req: Request) {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
        const body = await req.text();
        return String(new URLSearchParams(body).get("out_trade_no") || "").trim();
    }
    if (contentType.includes("application/json")) {
        const body = await req.json().catch(() => ({})) as { out_trade_no?: string };
        return String(body.out_trade_no || "").trim();
    }
    return "";
}

export async function GET(req: Request) {
    try {
        const outTradeNo = getOutTradeNoFromSearch(req);
        if (!outTradeNo) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "缺少订单号",
                data: null,
            }, { status: 400 });
        }

        return redirectToPaymentPage(req, outTradeNo);
    } catch (error) {
        console.error("[Alipay Return] redirect failed:", error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "支付回跳处理失败",
            data: null,
        }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const outTradeNo = await getOutTradeNoFromBody(req);
        if (!outTradeNo) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "缺少订单号",
                data: null,
            }, { status: 400 });
        }

        return redirectToPaymentPage(req, outTradeNo);
    } catch (error) {
        console.error("[Alipay Return] redirect failed:", error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "支付回跳处理失败",
            data: null,
        }, { status: 500 });
    }
}
