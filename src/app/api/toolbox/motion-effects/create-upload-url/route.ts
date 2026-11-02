import { rejectWechatPurchase } from '@/lib/wechatFreeRelease';
import { createMotionEffectUpload } from "../_createUpload";
import { getMotionEffectRequestIdentity } from "../_commerce";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
    const paused = rejectWechatPurchase(req);
    if (paused) return paused;
  return createMotionEffectUpload(req, await getMotionEffectRequestIdentity(req));
}
