import { NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import type { SliderCreateResponseDto } from "./entity";
import redis from "@/lib/redisClient";
import { randomUUID } from "crypto";

const TRACK_WIDTH = 280;
const THUMB_SIZE = 40;
const CAPTCHA_TTL = 300; // 5 分钟
// 目标位置范围：缺口在轨道内且与左右边有一定距离，仅后端知晓
const TARGET_MIN = 50;
const TARGET_MAX = TRACK_WIDTH - THUMB_SIZE - 50;

export async function POST() {
    if (!redis) {
        return NextResponse.json<ApiData<SliderCreateResponseDto>>({
            success: false,
            message: "验证服务不可用",
            data: undefined,
        }, { status: 500 });
    }

    const id = randomUUID();
    const target = TARGET_MIN + Math.floor(Math.random() * (TARGET_MAX - TARGET_MIN + 1));
    const key = `captcha:slider:${id}`;
    await redis.setEx(key, CAPTCHA_TTL, String(target));

    const imageUrl = `/api/captcha/slider/image?id=${encodeURIComponent(id)}`;

    return NextResponse.json<ApiData<SliderCreateResponseDto>>({
        success: true,
        message: "ok",
        data: {
            id,
            trackWidth: TRACK_WIDTH,
            imageUrl,
            backgroundImage: "/coachlink.jpg",
        },
    });
}
