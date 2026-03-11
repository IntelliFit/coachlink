import { NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import type { SliderVerifyDto, SliderVerifyResponseDto } from "./entity";
import redis from "@/lib/redisClient";
import { randomUUID } from "crypto";

const TOKEN_TTL = 120; // 2 分钟内可用
const TRACK_WIDTH = 280;

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

    const { id, position, percent } = body as any;
    if (!id || (typeof position !== "number" && typeof percent !== "number")) {
        return NextResponse.json<ApiData<SliderVerifyResponseDto>>({
            success: false,
            message: "缺少 id 或位置参数",
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

    // stored 是像素值
    const targetPx = Number(stored);

    // 兼容两种传值方式：
    // - 网页端传 position（像素）
    // - 小程序端传 percent（百分比，0-100）
    const userPx = typeof position === "number"
        ? position
        : Math.round((percent / 100) * TRACK_WIDTH);

    const TOLERANCE = 12; // 像素误差容忍
    const distance = Math.abs(userPx - targetPx);

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
