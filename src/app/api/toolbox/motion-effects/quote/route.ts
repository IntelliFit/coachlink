import { NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import {
  getMotionEffectPrices,
  getMotionEffectRequestIdentity,
  hasSignupFreeExport,
} from "../_commerce";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const identity = await getMotionEffectRequestIdentity(req);
  return NextResponse.json<
    ApiData<{
      signedIn: boolean;
      signupFreeAvailable: boolean;
      prices: ReturnType<typeof getMotionEffectPrices>;
      resourceNotice: string;
    }>
  >({
    success: true,
    data: {
      signedIn: Boolean(identity.userId),
      signupFreeAvailable: identity.userId
        ? await hasSignupFreeExport(identity.userId)
        : false,
      prices: getMotionEffectPrices(),
      resourceNotice:
        "视频导出会占用服务器计算、临时存储和下载带宽；预览免费，下载按所选规格计费。",
    },
  });
}
