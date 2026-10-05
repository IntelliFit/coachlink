import { createWebPaymentOrder } from "@/lib/webPaymentOrder";

export async function POST(req: Request) {
    return createWebPaymentOrder(req, "alipay");
}
