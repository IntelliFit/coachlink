import { NextResponse } from "next/server";
import redis from "@/lib/redisClient";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

type StatePayload = {
  userId: string;
  returnTo: string;
};

function buildBridgeUrl(baseUrl: string, params: Record<string, string>) {
  const url = new URL(`${baseUrl}/wechat-auth/bind-bridge`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";

  const baseUrl = process.env.NEXTAUTH_URL || url.origin;

  if (!code || !state) {
    const to = buildBridgeUrl(baseUrl, {
      status: "error",
      message: "缺少微信回调参数",
      returnTo: "/me/profile",
    });
    return NextResponse.redirect(to);
  }

  if (!redis) {
    const to = buildBridgeUrl(baseUrl, {
      status: "error",
      message: "验证服务不可用",
      returnTo: "/me/profile",
    });
    return NextResponse.redirect(to);
  }

  const raw = await redis.get(`wechat_bind_state:${state}`);
  if (!raw) {
    const to = buildBridgeUrl(baseUrl, {
      status: "error",
      message: "绑定请求已过期，请重新发起绑定",
      returnTo: "/me/profile",
    });
    return NextResponse.redirect(to);
  }

  let payload: StatePayload | null = null;
  try {
    payload = JSON.parse(raw) as StatePayload;
  } catch {
    payload = null;
  }

  const userId = payload?.userId;
  const returnTo = payload?.returnTo || "/me/profile";
  if (!userId) {
    const to = buildBridgeUrl(baseUrl, {
      status: "error",
      message: "绑定状态无效，请重新发起绑定",
      returnTo,
    });
    return NextResponse.redirect(to);
  }

  const appid = process.env.WECHAT_APP_ID || "";
  const secret = process.env.WECHAT_APP_SECRET || "";
  if (!appid || !secret) {
    const to = buildBridgeUrl(baseUrl, {
      status: "error",
      message: "微信配置缺失（WECHAT_APP_ID/WECHAT_APP_SECRET）",
      returnTo,
    });
    return NextResponse.redirect(to);
  }

  try {
    const tokenUrl = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
    tokenUrl.searchParams.set("appid", appid);
    tokenUrl.searchParams.set("secret", secret);
    tokenUrl.searchParams.set("code", code);
    tokenUrl.searchParams.set("grant_type", "authorization_code");

    const resp = await fetch(tokenUrl, { method: "GET" });
    const tokens: any = await resp.json();

    if (!resp.ok || tokens?.errcode) {
      const to = buildBridgeUrl(baseUrl, {
        status: "error",
        message: tokens?.errmsg ? `微信授权失败：${tokens.errmsg}` : "微信授权失败",
        returnTo,
      });
      return NextResponse.redirect(to);
    }

    const openid = tokens?.openid as string | undefined;
    if (!openid) {
      const to = buildBridgeUrl(baseUrl, {
        status: "error",
        message: "微信授权失败：未获取到 openid",
        returnTo,
      });
      return NextResponse.redirect(to);
    }

    // 检查是否已被其他账号绑定
    const { data: existing } = await serviceRoleSupabase
      .from("users")
      .select("id")
      .eq("wechat_openid", openid)
      .maybeSingle();

    if (existing?.id && existing.id !== userId) {
      const to = buildBridgeUrl(baseUrl, {
        status: "error",
        message: "该微信已被其他账号绑定",
        returnTo,
      });
      return NextResponse.redirect(to);
    }

    const { error: updateError } = await serviceRoleSupabase
      .from("users")
      .update({ wechat_openid: openid, updated_at: new Date().toISOString() } as any)
      .eq("id", userId);

    if (updateError) {
      const to = buildBridgeUrl(baseUrl, {
        status: "error",
        message: "绑定失败，请稍后重试",
        returnTo,
      });
      return NextResponse.redirect(to);
    }

    await redis.del(`wechat_bind_state:${state}`);

    const to = buildBridgeUrl(baseUrl, {
      status: "success",
      message: "绑定成功",
      returnTo,
    });
    return NextResponse.redirect(to);
  } catch (e: any) {
    const to = buildBridgeUrl(baseUrl, {
      status: "error",
      message: e?.message ? `绑定异常：${e.message}` : "绑定异常",
      returnTo: payload?.returnTo || "/me/profile",
    });
    return NextResponse.redirect(to);
  }
}

