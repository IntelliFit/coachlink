import { NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import type { SliderCreateResponseDto } from "./entity";
import redis from "@/lib/redisClient";
import { randomUUID } from "crypto";

const TRACK_WIDTH = 280;
const SLIDE_THRESHOLD = 250; // 滑动超过此位置即通过
const CAPTCHA_TTL = 300; // 5 分钟

export async function POST() {
    if (!redis) {
        return NextResponse.json<ApiData<SliderCreateResponseDto>>({
            success: false,
            message: "验证服务不可用",
            data: undefined,
        }, { status: 500 });
    }

    const id = randomUUID();
    const key = `captcha:slider:${id}`;
    await redis.setEx(key, CAPTCHA_TTL, String(SLIDE_THRESHOLD));

    return NextResponse.json<ApiData<SliderCreateResponseDto>>({
        success: true,
        message: "ok",
        data: {
            id,
            trackWidth: TRACK_WIDTH,
            backgroundImage: "/coachlink.jpg",
        },
    });
}
