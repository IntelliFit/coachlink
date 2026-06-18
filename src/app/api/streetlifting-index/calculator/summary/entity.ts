import type { ExerciseType } from "@/app/streetlifting-index/_utils";
import type { StreetliftingCalcSummaryDto } from "@/lib/streetliftingCalcHistory";

export type StreetliftingCalcSummaryRequestDto = {
  recordId?: string | null;
  exerciseType?: ExerciseType | null;
};

export type StreetliftingCalcSummaryResponseDto = {
  summary: StreetliftingCalcSummaryDto | null;
};
