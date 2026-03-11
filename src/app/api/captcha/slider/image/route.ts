import { NextRequest, NextResponse } from "next/server";
import redis from "@/lib/redisClient";

const TRACK_WIDTH = 280;
const IMAGE_HEIGHT = 56;
/** 与前端滑块、虚影一致：缺口宽度 = 滑块宽度，用户对齐时左边缘对准缺口左边缘 */
const GAP_WIDTH = 40;

/**
 * 根据 challenge id 从 Redis 读取目标位置，返回带缺口标记的 SVG。
 * 缺口宽度与前端滑块一致，用户将滑块左边缘对准缺口左边缘即可通过。
 */
export async function GET(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
        return new NextResponse("Missing id", { status: 400 });
    }

    if (!redis) {
        return new NextResponse("Service unavailable", { status: 503 });
    }

    const key = `captcha:slider:${id}`;
    const stored = await redis.get(key);
    if (!stored) {
        return new NextResponse("Challenge expired or invalid", { status: 404 });
    }

    const target = Number(stored);
    if (Number.isNaN(target) || target < 0 || target > TRACK_WIDTH) {
        return new NextResponse("Invalid challenge", { status: 400 });
    }

    const gapLeft = Math.max(0, Math.min(target, TRACK_WIDTH - GAP_WIDTH));

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${TRACK_WIDTH}" height="${IMAGE_HEIGHT}" viewBox="0 0 ${TRACK_WIDTH} ${IMAGE_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f1f5f9"/>
      <stop offset="100%" style="stop-color:#e2e8f0"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" rx="8"/>
  <rect x="${gapLeft}" y="0" width="${GAP_WIDTH}" height="100%" fill="#0ea5e9" opacity="0.35" rx="6" stroke="#0ea5e9" stroke-width="1.5"/>
</svg>`;

    return new NextResponse(svg, {
        status: 200,
        headers: {
            "Content-Type": "image/svg+xml",
            "Cache-Control": "no-store, no-cache, must-revalidate",
        },
    });
}
