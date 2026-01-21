import { NextResponse } from "next/server";
import redis from "@/lib/redisClient";
import type { ApiData } from "@/types/api";
import { randomUUID } from "crypto";

type StartWechatLoginDto = {
  returnTo?: string;
};

type StartWechatLoginResponseDto = {
  appid: string;
  scope: "snsapi_login";
  redirectUri: string;
  state: string;
  // optional UI config
  stylelite?: number;
  fast_login?: string;
  self_redirect?: boolean;
};

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { returnTo } = (await req.json().catch(() => ({}))) as StartWechatLoginDto;
    const safeReturnTo =
      typeof returnTo === "string" && returnTo.startsWith("/") ? returnTo : "/today-training";

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

    // redirect_uri must be a whitelisted URL in WeChat Open Platform
    const baseUrl = process.env.NEXTAUTH_URL || new URL(req.url).origin;
    const redirectUri = `${baseUrl}/wechat-auth/login-bridge`;

    const state = randomUUID();
    await redis.setEx(
      `wechat_login_state:${state}`,
      10 * 60,
      JSON.stringify({ returnTo: safeReturnTo }),
    );

    const resp: StartWechatLoginResponseDto = {
      appid,
      scope: "snsapi_login",
      redirectUri,
      state,
      stylelite: 1,
      fast_login: "1",
      self_redirect: true,
    };

    return NextResponse.json<ApiData<StartWechatLoginResponseDto>>({
      success: true,
      message: "ok",
      data: resp,
    });
  } catch (e: any) {
    console.error("[wechat-login-start] error:", e);
    return NextResponse.json<ApiData<null>>(
      { success: false, message: e?.message || "服务器错误", data: null },
      { status: 500 },
    );
  }
}

