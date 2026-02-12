import { NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import type { SliderVerifyDto, SliderVerifyResponseDto } from "./entity";
import redis from "@/lib/redisClient";
import { randomUUID } from "crypto";

const TOKEN_TTL = 120; // 2 分钟内可用

export async function POST(req: Request) {
    if (!redis) {
        return NextResponse.json<ApiData<SliderVerifyResponseDto>>({
            success: false,
            message: "验证服务不可用",
            data: undefined,
        }, { status: 500 });
    }

    let body: SliderVerifyDto;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json<ApiData<SliderVerifyResponseDto>>({
            success: false,
            message: "参数无效",
            data: undefined,
        }, { status: 400 });
    }

    const { id, position } = body;
    if (!id || typeof position !== "number") {
        return NextResponse.json<ApiData<SliderVerifyResponseDto>>({
            success: false,
            message: "缺少 id 或 position",
            data: undefined,
        }, { status: 400 });
    }

    const key = `captcha:slider:${id}`;
    const stored = await redis.get(key);
    await redis.del(key);

    if (!stored) {
        return NextResponse.json<ApiData<SliderVerifyResponseDto>>({
            success: false,
            message: "验证已过期，请重试",
            data: undefined,
        }, { status: 200 });
    }

    const target = Number(stored);
    const TOLERANCE = 8; // 滑块左边缘与缺口左边缘允许的像素误差（缺口与滑块同宽，对齐左边缘即可）
    const distance = Math.abs(position - target);
    if (distance > TOLERANCE) {
        return NextResponse.json<ApiData<SliderVerifyResponseDto>>({
            success: false,
            message: "请将滑块对齐缺口位置",
            data: undefined,
        }, { status: 200 });
    }

    const token = randomUUID();
    await redis.setEx(`captcha:token:${token}`, TOKEN_TTL, "1");

    return NextResponse.json<ApiData<SliderVerifyResponseDto>>({
        success: true,
        message: "验证成功",
        data: { token },
    });
}
