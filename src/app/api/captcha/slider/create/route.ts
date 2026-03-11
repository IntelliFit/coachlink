import { NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import type { SliderCreateResponseDto } from "./entity";
import redis from "@/lib/redisClient";
import { randomUUID } from "crypto";

const TRACK_WIDTH = 280;
const CAPTCHA_TTL = 300; // 5 分钟
// 缺口位置百分比范围，左右留出边距
const TARGET_MIN_PCT = 20;
const TARGET_MAX_PCT = 75;

export async function POST() {
    if (!redis) {
        return NextResponse.json<ApiData<SliderCreateResponseDto>>({
            success: false,
            message: "验证服务不可用",
            data: undefined,
        }, { status: 500 });
    }

    const id = randomUUID();
    // 随机生成缺口目标百分比
    const targetPercent = TARGET_MIN_PCT + Math.floor(Math.random() * (TARGET_MAX_PCT - TARGET_MIN_PCT + 1));

    const key = `captcha:slider:${id}`;
    await redis.setEx(key, CAPTCHA_TTL, String(targetPercent));

    const imageUrl = `/api/captcha/slider/image?id=${encodeURIComponent(id)}`;

    return NextResponse.json<ApiData<SliderCreateResponseDto>>({
        success: true,
        message: "ok",
        data: {
            id,
            trackWidth: TRACK_WIDTH,
            imageUrl,
            targetPercent,
        },
    });
}
