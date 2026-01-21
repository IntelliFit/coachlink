import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import redis from "@/lib/redisClient";
import type { ApiData } from "@/types/api";
import { randomUUID } from "crypto";

interface StartWechatBindDto {
  returnTo?: string;
}

interface StartWechatBindResponseDto {
  url: string;
}

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "用户未登录", data: null },
      { status: 401 },
    );
  }

  const { returnTo } = (await req.json().catch(() => ({}))) as StartWechatBindDto;
  const safeReturnTo = typeof returnTo === "string" && returnTo.startsWith("/") ? returnTo : "/me/profile";

  if (!redis) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "验证服务不可用", data: null },
      { status: 500 },
    );
  }

  const appid = process.env.WECHAT_APP_ID || "";
  if (!appid) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "微信配置缺失（WECHAT_APP_ID）", data: null },
      { status: 500 },
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL || new URL(req.url).origin;
  const redirectUri = `${baseUrl}/api/wechat/bind/callback`;

  const state = randomUUID();
  await redis.setEx(
    `wechat_bind_state:${state}`,
    10 * 60,
    JSON.stringify({ userId: session.user.id, returnTo: safeReturnTo }),
  );

  const authUrl = new URL("https://open.weixin.qq.com/connect/qrconnect");
  authUrl.searchParams.set("appid", appid);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "snsapi_login");
  authUrl.searchParams.set("state", state);
  // PC/Mac 微信客户端“快速登录”
  authUrl.searchParams.set("fast_login", "1");
  authUrl.searchParams.set("lang", "zh_CN");

  return NextResponse.json<ApiData<StartWechatBindResponseDto>>({
    success: true,
    message: "ok",
    data: { url: authUrl.toString() },
  });
}

