import { NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import type { SliderVerifyDto, SliderVerifyResponseDto } from "./entity";
import redis from "@/lib/redisClient";
import { randomUUID } from "crypto";

const TOKEN_TTL = 120; // 2 分钟内可用
const TOLERANCE = 5; // 百分比误差容忍（±5%）
const TRACK_WIDTH = 280;
const THUMB_SIZE = 40;
const GAP_WIDTH = 40; // 与 image 路由一致

export async function POST(req: Request) {
    if (!redis) {
        return NextResponse.json<ApiData<SliderVerifyResponseDto>>({
            success: false,
            message: "验证服务不可用",
            data: undefined,
        }, { status: 500 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json<ApiData<SliderVerifyResponseDto>>({
            success: false,
            message: "参数无效",
            data: undefined,
        }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
        return NextResponse.json<ApiData<SliderVerifyResponseDto>>({
            success: false,
            message: "缺少 id 或 percent",
            data: undefined,
        }, { status: 400 });
    }

    const { id, percent: percentRaw, position: positionRaw } = body as Record<string, unknown>;
    const idStr = typeof id === "string" ? id.trim() : "";

    // 支持 percent（0-100）或 position（像素 0~240），与 create 的 TRACK_WIDTH/THUMB_SIZE 一致
    let percent: number;
    if (typeof percentRaw === "number" && !Number.isNaN(percentRaw) && percentRaw >= 0 && percentRaw <= 100) {
        percent = percentRaw;
    } else if (typeof percentRaw === "string") {
        const p = parseFloat(percentRaw);
        percent = !Number.isNaN(p) && p >= 0 && p <= 100 ? p : NaN;
    } else if (typeof positionRaw === "number" && !Number.isNaN(positionRaw) && positionRaw >= 0 && positionRaw <= TRACK_WIDTH - THUMB_SIZE) {
        percent = Math.round(((positionRaw + THUMB_SIZE / 2) / TRACK_WIDTH) * 100);
    } else if (typeof positionRaw === "string") {
        const pos = parseFloat(positionRaw);
        if (!Number.isNaN(pos) && pos >= 0 && pos <= TRACK_WIDTH - THUMB_SIZE) {
            percent = Math.round(((pos + THUMB_SIZE / 2) / TRACK_WIDTH) * 100);
        } else {
            percent = NaN;
        }
    } else {
        percent = NaN;
    }

    if (!idStr || Number.isNaN(percent) || percent < 0 || percent > 100) {
        return NextResponse.json<ApiData<SliderVerifyResponseDto>>({
            success: false,
            message: "缺少 id 或 percent",
            data: undefined,
        }, { status: 400 });
    }

    const key = `captcha:slider:${idStr}`;
    const stored = await redis.get(key);
    await redis.del(key);

    if (!stored) {
        return NextResponse.json<ApiData<SliderVerifyResponseDto>>({
            success: false,
            message: "验证已过期，请重试",
            data: undefined,
        }, { status: 200 });
    }

    // stored 是缺口左边缘百分比（与 image 路由一致），用户发送的是滑块中心百分比
    // 需将缺口左边缘转为缺口中心再比较
    const gapLeftPercent = Number(stored);
    const targetCenterPercent = gapLeftPercent + (GAP_WIDTH / 2 / TRACK_WIDTH) * 100;

    const distance = Math.abs(percent - targetCenterPercent);

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
