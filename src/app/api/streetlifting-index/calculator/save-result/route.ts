import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import {
  computeStreetliftingCalculatorResult,
  type StreetliftingCalculatorRequest,
} from "@/lib/streetliftingCalculator";
import {
  buildStreetliftingCalcSummary,
  mapStreetliftingCalcRecord,
} from "@/lib/streetliftingCalcHistory";
import {
  getLatestStreetliftingCalcRecord,
  getPersonalBestStreetliftingCalcRecord,
  getStreetliftingFormulaByGender,
  insertStreetliftingCalcRecord,
  listStreetliftingRankingRows,
} from "../_helpers";
import type {
  SaveStreetliftingCalcResultDto,
  SaveStreetliftingCalcResultResponseDto,
} from "./entity";

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json<ApiData<SaveStreetliftingCalcResultResponseDto>>(
        {
          success: false,
          message: "请先登录后再保存计算结果",
          data: null,
        },
        { status: 401 }
      );
    }

    const body = (await req.json()) as SaveStreetliftingCalcResultDto;
    const normalizedRequest: StreetliftingCalculatorRequest = {
      ...body,
      sourceSurface: body.sourceSurface || "weapp",
      penaltyWeight: body.penaltyWeight ?? 0,
    };

    const formula =
      normalizedRequest.exerciseType === "weighted_pullup" ||
      normalizedRequest.exerciseType === "weighted_dips"
        ? await getStreetliftingFormulaByGender(normalizedRequest.gender)
        : null;

    const result = computeStreetliftingCalculatorResult(normalizedRequest, { formula });

    const inserted = await insertStreetliftingCalcRecord({
      user_id: userId,
      source_surface: normalizedRequest.sourceSurface,
      exercise_type: normalizedRequest.exerciseType,
      calc_mode: normalizedRequest.mode,
      gender: normalizedRequest.gender,
      bodyweight_kg: normalizedRequest.bodyweight,
      reps: normalizedRequest.reps ?? null,
      sets: normalizedRequest.sets ?? null,
      rest_cat: normalizedRequest.restCat ?? null,
      day_first_type: normalizedRequest.dayFirstType ?? null,
      day_first_value: normalizedRequest.dayFirstValue ?? null,
      day_last_type: normalizedRequest.dayLastType ?? null,
      day_last_value: normalizedRequest.dayLastValue ?? null,
      form_quality: normalizedRequest.formQuality,
      penalty_weight_kg: normalizedRequest.penaltyWeight ?? 0,
      added_weight_kg: normalizedRequest.addedWeight ?? null,
      added_1rm_kg: normalizedRequest.added1RM ?? null,
      working_added_weight_kg: normalizedRequest.workingAddedWeight ?? null,
      lift_weight_kg: normalizedRequest.liftWeight ?? null,
      target_1rm_kg: normalizedRequest.target1RM ?? null,
      working_lift_weight_kg: normalizedRequest.workingLiftWeight ?? null,
      estimated_1rm_kg: result.estimated1RMKg,
      final_score: result.finalScore,
      coefficient: result.coefficient,
      adjusted_used_weight_kg: result.adjustedUsedWeightKg ?? null,
      computed_added_weight_kg: result.computedAddedWeightKg ?? null,
      computed_reps: result.computedReps ?? null,
      result_level: result.resultLevel,
      is_ranking_eligible: result.isRankingEligible,
      verified_level: "self_reported",
      input_snapshot: normalizedRequest,
      result_snapshot: result,
    });

    const [previousRecord, personalBestRecord, rankingRows] = await Promise.all([
      getLatestStreetliftingCalcRecord({
        userId,
        exerciseType: inserted.exercise_type,
        excludeRecordId: inserted.id,
      }),
      getPersonalBestStreetliftingCalcRecord({
        userId,
        exerciseType: inserted.exercise_type,
      }),
      inserted.is_ranking_eligible
        ? listStreetliftingRankingRows({
            exerciseType: inserted.exercise_type,
            gender: inserted.gender,
          })
        : Promise.resolve([]),
    ]);

    const summary = buildStreetliftingCalcSummary({
      latestRecord: inserted,
      previousRecord,
      personalBestRecord,
      rankingRows,
    });

    return NextResponse.json<ApiData<SaveStreetliftingCalcResultResponseDto>>({
      success: true,
      message: "保存力量计算结果成功",
      data: {
        record: mapStreetliftingCalcRecord(inserted),
        summary,
      },
    });
  } catch (error) {
    console.error("[streetlifting-index][calculator][save-result] error:", error);
    return NextResponse.json<ApiData<SaveStreetliftingCalcResultResponseDto>>(
      {
        success: false,
        message: error instanceof Error ? error.message : "保存力量计算结果失败",
        data: null,
      },
      { status: 500 }
    );
  }
}
