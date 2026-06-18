import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import { buildStreetliftingCalcSummary } from "@/lib/streetliftingCalcHistory";
import {
  getLatestStreetliftingCalcRecord,
  getPersonalBestStreetliftingCalcRecord,
  getStreetliftingCalcRecordById,
  listStreetliftingRankingRows,
} from "../_helpers";
import type { StreetliftingCalcSummaryRequestDto, StreetliftingCalcSummaryResponseDto } from "./entity";

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json<ApiData<StreetliftingCalcSummaryResponseDto>>(
        {
          success: false,
          message: "请先登录后再查看摘要",
          data: null,
        },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as StreetliftingCalcSummaryRequestDto;
    const targetRecord = body.recordId
      ? await getStreetliftingCalcRecordById({ userId, recordId: body.recordId })
      : await getLatestStreetliftingCalcRecord({ userId, exerciseType: body.exerciseType || null });

    if (!targetRecord) {
      return NextResponse.json<ApiData<StreetliftingCalcSummaryResponseDto>>({
        success: true,
        message: "暂无力量计算摘要",
        data: { summary: null },
      });
    }

    const [previousRecord, personalBestRecord, rankingRows] = await Promise.all([
      getLatestStreetliftingCalcRecord({
        userId,
        exerciseType: targetRecord.exercise_type,
        excludeRecordId: targetRecord.id,
      }),
      getPersonalBestStreetliftingCalcRecord({
        userId,
        exerciseType: targetRecord.exercise_type,
      }),
      targetRecord.is_ranking_eligible
        ? listStreetliftingRankingRows({
            exerciseType: targetRecord.exercise_type,
            gender: targetRecord.gender,
          })
        : Promise.resolve([]),
    ]);

    const summary = buildStreetliftingCalcSummary({
      latestRecord: targetRecord,
      previousRecord,
      personalBestRecord,
      rankingRows,
    });

    return NextResponse.json<ApiData<StreetliftingCalcSummaryResponseDto>>({
      success: true,
      message: "获取力量计算摘要成功",
      data: { summary },
    });
  } catch (error) {
    console.error("[streetlifting-index][calculator][summary] error:", error);
    return NextResponse.json<ApiData<StreetliftingCalcSummaryResponseDto>>(
      {
        success: false,
        message: error instanceof Error ? error.message : "获取力量计算摘要失败",
        data: null,
      },
      { status: 500 }
    );
  }
}
