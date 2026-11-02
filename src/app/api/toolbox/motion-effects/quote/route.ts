import { NextResponse } from "next/server";
import { rejectWechatPurchase } from '@/lib/wechatFreeRelease';
import type { ApiData } from "@/types/api";
import {
  FREE_MOTION_EFFECT_PRICES,
  getMotionEffectRequestIdentity,
} from "../_commerce";

export const runtime = "nodejs";

/** 新版客户端不再调用；留给已安装的旧版 APP 和没刷新的网页读到 0 元。 */
export async function GET(req: Request) {
  const paused = rejectWechatPurchase(req, { message: '免费版暂不提供新的特效视频生成与导出' });
  if (paused) return paused;
  const identity = await getMotionEffectRequestIdentity(req);
  return NextResponse.json<
    ApiData<{
      signedIn: boolean;
      signupFreeAvailable: boolean;
      prices: typeof FREE_MOTION_EFFECT_PRICES;
      resourceNotice: string;
    }>
  >({
    success: true,
    data: {
      signedIn: Boolean(identity.userId),
      signupFreeAvailable: false,
      prices: FREE_MOTION_EFFECT_PRICES,
      resourceNotice: "手指光膜免费使用，原视频与成片最多保留 24 小时。",
    },
  });
}
