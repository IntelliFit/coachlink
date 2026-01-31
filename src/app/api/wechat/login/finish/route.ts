import { NextResponse } from "next/server";
import redis from "@/lib/redisClient";
import type { ApiData } from "@/types/api";
import { randomUUID } from "crypto";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

type FinishWechatLoginDto = {
  code?: string;
  state?: string;
};

type FinishWechatLoginResponseDto = {
  loginToken: string;
  returnTo: string;
};

export const runtime = "nodejs";
export const maxDuration = 30;

async function exchangeCodeForToken(code: string) {
  const appid = process.env.WECHAT_APP_ID || "";
  const secret = process.env.WECHAT_APP_SECRET || "";
  if (!appid || !secret) {
    throw new Error("微信配置缺失（WECHAT_APP_ID/WECHAT_APP_SECRET）");
  }
  const url = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
  url.searchParams.set("appid", appid);
  url.searchParams.set("secret", secret);
  url.searchParams.set("code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const resp = await fetch(url, { method: "GET" });
  const json: any = await resp.json().catch(() => ({}));
  if (!resp.ok || json?.errcode) {
    throw new Error(json?.errmsg || `微信 access_token 获取失败（${resp.status}）`);
  }
  return json as {
    access_token: string;
    openid: string;
    unionid?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
}

async function fetchWechatUserInfo(accessToken: string, openid: string) {
  const url = new URL("https://api.weixin.qq.com/sns/userinfo");
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("openid", openid);
  url.searchParams.set("lang", "zh_CN");
  const resp = await fetch(url);
  const json: any = await resp.json().catch(() => ({}));
  if (!resp.ok || json?.errcode) return null;
  return json as { nickname?: string; headimgurl?: string; unionid?: string };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as FinishWechatLoginDto;
    const code = typeof body.code === "string" ? body.code : "";
    const state = typeof body.state === "string" ? body.state : "";

    if (!code || !state) {
      return NextResponse.json<ApiData<null>>(
        { success: false, message: "缺少 code/state", data: null },
        { status: 400 },
      );
    }

    if (!redis) {
      return NextResponse.json<ApiData<null>>(
        { success: false, message: "验证服务不可用", data: null },
        { status: 500 },
      );
    }

    const stateKey = `wechat_login_state:${state}`;
    const stored = await redis.get(stateKey);
    if (!stored) {
      return NextResponse.json<ApiData<null>>(
        { success: false, message: "state 已过期或无效，请刷新二维码重试", data: null },
        { status: 400 },
      );
    }
    await redis.del(stateKey);

    let parsed: any = {};
    try {
      parsed = JSON.parse(stored);
    } catch {}
    const returnTo =
      typeof parsed?.returnTo === "string" && parsed.returnTo.startsWith("/")
        ? parsed.returnTo
        : "/today-training";

    const tokens = await exchangeCodeForToken(code);
    const openid = tokens.openid;
    if (!openid) {
      return NextResponse.json<ApiData<null>>(
        { success: false, message: "未获取到 openid", data: null },
        { status: 500 },
      );
    }

    const userInfo = tokens.access_token
      ? await fetchWechatUserInfo(tokens.access_token, openid)
      : null;

    // Find or create user
    const { data: existingUser } = await serviceRoleSupabase
      .from("users")
      .select("*")
      .eq("wechat_openid", openid)
      .maybeSingle();

    let userId: string;
    if (!existingUser) {
      const { data: newUser, error: createUserError } = await serviceRoleSupabase
        .from("users")
        .insert({
          wechat_openid: openid,
          password_hash: "",
          is_admin: false,
          admin_role: null,
          is_coach: false,
          phone: null,
          email: null,
        } as any)
        .select()
        .single();
      if (createUserError || !newUser?.id) {
        console.error("[wechat-login-finish] create user error:", createUserError);
        return NextResponse.json<ApiData<null>>(
          { success: false, message: "创建微信用户失败", data: null },
          { status: 500 },
        );
      }
      userId = newUser.id;

      await serviceRoleSupabase
        .from("user_profiles")
        .insert({
          user_id: userId,
          nickname: userInfo?.nickname || `微信用户_${openid.slice(-4)}`,
          avatar_url: userInfo?.headimgurl || null,
          bio: "",
        } as any)
        .maybeSingle();
    } else {
      userId = (existingUser as any).id as string;
      // Best-effort update profile avatar/nickname
      if (userInfo?.nickname || userInfo?.headimgurl) {
        await serviceRoleSupabase
          .from("user_profiles")
          .update({
            nickname: userInfo?.nickname || undefined,
            avatar_url: userInfo?.headimgurl || undefined,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("user_id", userId);
      }
    }

    // Create one-time login token for Credentials sign-in
    const loginToken = randomUUID();
    await redis.setEx(
      `wechat_login_token:${loginToken}`,
      2 * 60,
      JSON.stringify({ userId }),
    );

    const resp: FinishWechatLoginResponseDto = { loginToken, returnTo };
    return NextResponse.json<ApiData<FinishWechatLoginResponseDto>>({
      success: true,
      message: "ok",
      data: resp,
    });
  } catch (e: any) {
    console.error("[wechat-login-finish] error:", e);
    return NextResponse.json<ApiData<null>>(
      { success: false, message: e?.message || "服务器错误", data: null },
      { status: 500 },
    );
  }
}

