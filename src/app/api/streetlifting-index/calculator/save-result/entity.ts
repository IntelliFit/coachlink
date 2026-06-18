import type { ExerciseType, CalcMode, Gender } from "@/app/streetlifting-index/_utils";
import type { RestCat, SetFeedbackType, FormQuality, SourceSurface } from "@/lib/streetliftingCalculator";
import type { StreetliftingCalcRecordDto, StreetliftingCalcSummaryDto } from "@/lib/streetliftingCalcHistory";

export type SaveStreetliftingCalcResultDto = {
  sourceSurface: SourceSurface;
  exerciseType: ExerciseType;
  mode: CalcMode;
  gender: Gender;
  bodyweight: number;
  addedWeight?: number | null;
  added1RM?: number | null;
  workingAddedWeight?: number | null;
  liftWeight?: number | null;
  target1RM?: number | null;
  workingLiftWeight?: number | null;
  reps?: number | null;
  sets?: number | null;
  restCat?: RestCat | null;
  dayFirstType?: SetFeedbackType | null;
  dayFirstValue?: number | null;
  dayLastType?: SetFeedbackType | null;
  dayLastValue?: number | null;
  formQuality: FormQuality;
  penaltyWeight?: number | null;
};

export type SaveStreetliftingCalcResultResponseDto = {
  record: StreetliftingCalcRecordDto;
  summary: StreetliftingCalcSummaryDto;
};
