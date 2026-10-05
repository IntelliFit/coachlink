import { NextResponse } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { withLocationEquipment } from '@coachlink/core';

import type { ApiData } from "@/types/api";
import type {
  StreetliftingGetLocationDto,
  StreetliftingGetLocationResponseDto,
} from "./entity";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as StreetliftingGetLocationDto;
    const locationId = String(body?.id || "").trim();

    if (!locationId) {
      return NextResponse.json<ApiData<StreetliftingGetLocationResponseDto>>(
        {
          success: false,
          message: "缺少点位 ID",
          data: null,
        },
        { status: 400 },
      );
    }

    const { data, error } = await serviceRoleSupabase
      .from("streetlifting_locations")
      .select("*")
      .eq("id", locationId)
      .maybeSingle();

    if (error) {
      console.error("[streetlifting-index][locations] get error:", error);
      return NextResponse.json<ApiData<StreetliftingGetLocationResponseDto>>(
        {
          success: false,
          message: error.message || "获取点位失败",
          data: null,
        },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json<ApiData<StreetliftingGetLocationResponseDto>>(
        {
          success: false,
          message: "未找到这个单杠点位",
          data: null,
        },
        { status: 404 },
      );
    }

    return NextResponse.json<ApiData<StreetliftingGetLocationResponseDto>>({
      success: true,
      message: "获取点位成功",
      data: {
        location: withLocationEquipment(data),
      },
    });
  } catch (error) {
    console.error("[streetlifting-index][locations] get error:", error);
    return NextResponse.json<ApiData<StreetliftingGetLocationResponseDto>>(
      {
        success: false,
        message: "服务器异常",
        data: null,
      },
      { status: 500 },
    );
  }
}
