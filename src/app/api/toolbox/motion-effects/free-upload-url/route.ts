import { NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import { createMotionEffectUpload } from "../_createUpload";
import { getMotionEffectRequestIdentity } from "../_commerce";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 小程序专用入口。create-upload-url 对免费版标识继续返回 403，已发布的旧版免费包行为不变；
 * 小程序上传接口只认登录账号，所以这里要求登录。
 */
export async function POST(req: Request) {
  const identity = await getMotionEffectRequestIdentity(req);
  if (!identity.userId) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "请先登录后再生成特效视频", data: null },
      { status: 401 },
    );
  }
  return createMotionEffectUpload(req, identity);
}
