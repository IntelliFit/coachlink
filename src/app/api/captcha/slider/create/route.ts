import { NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import type { SliderCreateResponseDto } from "./entity";
import redis from "@/lib/redisClient";
import { randomUUID } from "crypto";

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
    // 随机生成目标百分比，范围 30% - 90%（避免太靠左或太靠右）
    const targetPercent = 30 + Math.floor(Math.random() * 61);
    
    const key = `captcha:slider:${id}`;
    await redis.setEx(key, CAPTCHA_TTL, String(targetPercent));

    return NextResponse.json<ApiData<SliderCreateResponseDto>>({
        success: true,
        message: "ok",
        data: {
            id,
            targetPercent,
        },
    });
}
