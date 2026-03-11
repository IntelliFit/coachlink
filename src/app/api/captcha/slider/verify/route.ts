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

    // 兼容 id/position 和旧版 id/percent 两种字段名
    const id = body?.id;
    if (!id) {
        return NextResponse.json<ApiData<SliderVerifyResponseDto>>({
            success: false,
            message: "缺少 id",
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

    // 滑到底即通过，不校验具体位置
    const token = randomUUID();
    await redis.setEx(`captcha:token:${token}`, TOKEN_TTL, "1");

    return NextResponse.json<ApiData<SliderVerifyResponseDto>>({
        success: true,
        message: "验证成功",
        data: { token },
    });
}
