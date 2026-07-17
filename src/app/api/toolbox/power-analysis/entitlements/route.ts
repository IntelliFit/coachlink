import { NextRequest, NextResponse } from "next/server";
import { getApiUserId } from "@/lib/getApiUserId";
import { getPowerAnalysisEntitlements } from "@/lib/powerAnalysisEntitlements";
import type { ApiData } from "@/types/api";
import type { PowerAnalysisEntitlementsDto } from "../types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const userId = await getApiUserId(request);
  if (!userId) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "用户未登录", data: null },
      { status: 401 },
    );
  }

  const entitlements = await getPowerAnalysisEntitlements(userId);
  return NextResponse.json<ApiData<PowerAnalysisEntitlementsDto>>({
    success: true,
    message: "获取功率分析权益成功",
    data: entitlements,
  });
}
