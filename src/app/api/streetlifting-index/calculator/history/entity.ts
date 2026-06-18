import type { ExerciseType } from "@/app/streetlifting-index/_utils";
import type { StreetliftingCalcRecordDto, StreetliftingCalcSummaryDto } from "@/lib/streetliftingCalcHistory";

export type StreetliftingCalcHistoryDto = {
  exerciseType?: ExerciseType | null;
  page?: number;
  limit?: number;
};

export type StreetliftingCalcHistoryResponseDto = {
  records: StreetliftingCalcRecordDto[];
  total: number;
  page: number;
  limit: number;
  summary: StreetliftingCalcSummaryDto | null;
};
