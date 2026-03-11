import { NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import type { SliderCreateResponseDto } from "./entity";
import redis from "@/lib/redisClient";
import { randomUUID } from "crypto";

const TRACK_WIDTH = 280;
const THUMB_SIZE = 40;
const CAPTCHA_TTL = 300; // 5 分钟
// 缺口位置范围（像素），左右留出一定边距
const TARGET_MIN = 60;
const TARGET_MAX = TRACK_WIDTH - THUMB_SIZE - 60;

export async function POST() {
    if (!redis) {
        return NextResponse.json<ApiData<SliderCreateResponseDto>>({
            success: false,
            message: "验证服务不可用",
            data: undefined,
        }, { status: 500 });
    }

    const id = randomUUID();
    // 随机生成缺口目标位置（像素）
    const target = TARGET_MIN + Math.floor(Math.random() * (TARGET_MAX - TARGET_MIN + 1));
    // 同时计算百分比，供小程序端使用
    const targetPercent = Math.round((target / TRACK_WIDTH) * 100);

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
            targetPercent, // 兼容小程序端（百分比）
        },
    });
}
