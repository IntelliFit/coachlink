import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import { buildStreetliftingCalcSummary, mapStreetliftingCalcRecord } from "@/lib/streetliftingCalcHistory";
import {
  getLatestStreetliftingCalcRecord,
  getPersonalBestStreetliftingCalcRecord,
  listStreetliftingCalcHistory,
  listStreetliftingRankingRows,
} from "../_helpers";
import type { StreetliftingCalcHistoryDto, StreetliftingCalcHistoryResponseDto } from "./entity";

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json<ApiData<StreetliftingCalcHistoryResponseDto>>(
        {
          success: false,
          message: "请先登录后再查看历史",
          data: null,
        },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as StreetliftingCalcHistoryDto;
    const page = Math.max(1, Number(body.page || 1));
    const limit = Math.min(50, Math.max(1, Number(body.limit || 20)));
    const exerciseType = body.exerciseType || null;

    const [{ rows, total }, latestRecord] = await Promise.all([
      listStreetliftingCalcHistory({ userId, exerciseType, page, limit }),
      getLatestStreetliftingCalcRecord({ userId, exerciseType }),
    ]);

    let summary = null;
    if (latestRecord) {
      const [previousRecord, personalBestRecord, rankingRows] = await Promise.all([
        getLatestStreetliftingCalcRecord({
          userId,
          exerciseType: latestRecord.exercise_type,
          excludeRecordId: latestRecord.id,
        }),
        getPersonalBestStreetliftingCalcRecord({
          userId,
          exerciseType: latestRecord.exercise_type,
        }),
        latestRecord.is_ranking_eligible
          ? listStreetliftingRankingRows({
              exerciseType: latestRecord.exercise_type,
              gender: latestRecord.gender,
            })
          : Promise.resolve([]),
      ]);

      summary = buildStreetliftingCalcSummary({
        latestRecord,
        previousRecord,
        personalBestRecord,
        rankingRows,
      });
    }

    return NextResponse.json<ApiData<StreetliftingCalcHistoryResponseDto>>({
      success: true,
      message: "获取力量计算历史成功",
      data: {
        records: rows.map(mapStreetliftingCalcRecord),
        total,
        page,
        limit,
        summary,
      },
    });
  } catch (error) {
    console.error("[streetlifting-index][calculator][history] error:", error);
    return NextResponse.json<ApiData<StreetliftingCalcHistoryResponseDto>>(
      {
        success: false,
        message: error instanceof Error ? error.message : "获取力量计算历史失败",
        data: null,
      },
      { status: 500 }
    );
  }
}
