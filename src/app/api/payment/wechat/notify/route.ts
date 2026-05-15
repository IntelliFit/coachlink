import { NextRequest } from "next/server";
import { processHuifuPaymentNotify } from "@/app/api/payment/huifuPaymentNotify";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    const rawBody = await request.text();

    try {
        let sign = "";
        let content = "";

        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("application/x-www-form-urlencoded")) {
            const params = new URLSearchParams(rawBody);
            sign = String(params.get("sign") || "").trim();
            content = String(params.get("resp_data") || "").trim();
        } else {
            const parsed = JSON.parse(rawBody) as { sign?: string; resp_data?: string; data?: string };
            sign = String(parsed.sign || "").trim();
            content = String(parsed.resp_data || parsed.data || "").trim();
        }

        if (!sign || !content) {
            return new Response("", { status: 400 });
        }

        const result = await processHuifuPaymentNotify({
            content,
            sign,
            defaultPaymentProvider: "wechat",
        });

        return new Response(`RECV_ORD_ID_${result.reqSeqId}`, {
            status: 200,
            headers: {
                "Content-Type": "text/plain; charset=UTF-8",
            },
        });
    } catch (error) {
        console.error("[Huifu Wechat Notify] failed:", error);
        return new Response("", { status: 500 });
    }
}
