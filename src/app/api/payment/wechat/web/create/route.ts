import { NextResponse } from "next/server";
import { createWebPaymentOrder } from "@/lib/webPaymentOrder";

export const runtime = "nodejs";

/** Native QR payments for signed-in Web students, using the existing Huifu settlement flow. */
export async function POST(req: Request) {
    try {
        return await createWebPaymentOrder(req, "wechat");
    } catch (error) {
        console.error("[Web Wechat Create] error:", error);
        return NextResponse.json(
            { success: false, message: "创建微信支付订单失败，请稍后重试", data: null },
            { status: 500 },
        );
    }
}
