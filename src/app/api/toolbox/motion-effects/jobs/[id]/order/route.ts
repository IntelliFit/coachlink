import { NextResponse } from "next/server";
import { rejectWechatPurchase } from '@/lib/wechatFreeRelease';
import type { ApiData } from "@/types/api";

export const runtime = "nodejs";

/** 手指光膜已全部免费，不再创建新订单。历史订单的查询、回调和退款不走这里。 */
export async function POST(
  req: Request,
  _context: { params: Promise<{ id: string }> },
) {
  const paused = rejectWechatPurchase(req);
  if (paused) return paused;
  return NextResponse.json<ApiData<null>>(
    { success: false, message: "手指光膜已免费，无需付款，请刷新页面后直接生成", data: null },
    { status: 410 },
  );
}
