import { NextRequest, NextResponse } from "next/server";

let cachedAccessToken: string | null = null;
let cachedAccessTokenExpiresAt = 0;

async function getMiniappAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessTokenExpiresAt > now + 60_000) {
    return cachedAccessToken;
  }

  const appid = String(process.env.WECHAT_MINIAPP_APPID || "").trim();
  const secret = String(process.env.WECHAT_MINIAPP_SECRET || "").trim();
  if (!appid || !secret) {
    throw new Error("Missing WECHAT_MINIAPP_APPID or WECHAT_MINIAPP_SECRET");
  }

  const tokenUrl = new URL("https://api.weixin.qq.com/cgi-bin/token");
  tokenUrl.searchParams.set("grant_type", "client_credential");
  tokenUrl.searchParams.set("appid", appid);
  tokenUrl.searchParams.set("secret", secret);

  const tokenResp = await fetch(tokenUrl.toString(), { cache: "no-store" });
  const tokenJson = await tokenResp.json();
  if (!tokenResp.ok || !tokenJson?.access_token) {
    throw new Error(tokenJson?.errmsg || "Failed to get miniapp access token");
  }

  cachedAccessToken = tokenJson.access_token;
  cachedAccessTokenExpiresAt = now + Number(tokenJson.expires_in || 7200) * 1000;
  return cachedAccessToken;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const locationId = String(searchParams.get("locationId") || "").trim();
    const format = String(searchParams.get("format") || "").trim();

    if (!locationId) {
      return NextResponse.json(
        { success: false, message: "Missing locationId" },
        { status: 400 },
      );
    }

    const envVersion = String(
      process.env.WECHAT_MINIAPP_QRCODE_ENV ||
        (process.env.NODE_ENV === "production" ? "release" : "develop"),
    ).trim();

    const accessToken = await getMiniappAccessToken();
    const qrResp = await fetch(
      `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scene: locationId.replace(/-/g, ''),
          page: "streetlifting/index/location-share",
          check_path: false,
          env_version: envVersion,
          width: 280,
        }),
      },
    );

    const contentType = qrResp.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errJson = await qrResp.json().catch(() => null);
      return NextResponse.json(
        {
          success: false,
          message: errJson?.errmsg || "Failed to generate miniapp code",
          detail: errJson,
        },
        { status: 500 },
      );
    }

    const arrayBuffer = await qrResp.arrayBuffer();

    /* 小程序端若 downloadFile 受限，可通过 ?format=base64 用 Taro.request 获取 */
    if (format === "base64") {
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      return NextResponse.json({
        success: true,
        data: { base64: `data:image/png;base64,${base64}` },
      });
    }

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType || "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[miniapp][qrcode][streetlifting-location] failed", error);
    return NextResponse.json(
      { success: false, message: "Failed to generate miniapp code" },
      { status: 500 },
    );
  }
}
