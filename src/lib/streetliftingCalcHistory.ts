import type { ExerciseType, Gender } from "@/app/streetlifting-index/_utils";
import { buildStreetliftingRankingBucketTitle } from "@/lib/streetliftingCalculator";

export type StreetliftingCalcRecordRow = {
  id: string;
  user_id: string;
  source_surface: "web" | "weapp";
  exercise_type: ExerciseType;
  calc_mode: string;
  gender: Gender;
  bodyweight_kg: number;
  reps: number | null;
  sets: number | null;
  rest_cat: string | null;
  day_first_type: string | null;
  day_first_value: number | null;
  day_last_type: string | null;
  day_last_value: number | null;
  form_quality: string | null;
  penalty_weight_kg: number | null;
  added_weight_kg: number | null;
  added_1rm_kg: number | null;
  working_added_weight_kg: number | null;
  lift_weight_kg: number | null;
  target_1rm_kg: number | null;
  working_lift_weight_kg: number | null;
  estimated_1rm_kg: number;
  final_score: number;
  coefficient: number;
  adjusted_used_weight_kg: number | null;
  computed_added_weight_kg: number | null;
  computed_reps: number | null;
  result_level: string | null;
  is_ranking_eligible: boolean;
  verified_level: string;
  input_snapshot: unknown;
  result_snapshot: unknown;
  created_at: string;
};

export type StreetliftingCalcRecordDto = {
  id: string;
  sourceSurface: "web" | "weapp";
  exerciseType: ExerciseType;
  calcMode: string;
  gender: Gender;
  bodyweightKg: number;
  reps: number | null;
  sets: number | null;
  restCat: string | null;
  formQuality: string | null;
  penaltyWeightKg: number | null;
  addedWeightKg: number | null;
  added1RMKg: number | null;
  workingAddedWeightKg: number | null;
  liftWeightKg: number | null;
  target1RMKg: number | null;
  workingLiftWeightKg: number | null;
  estimated1RMKg: number;
  finalScore: number;
  coefficient: number;
  adjustedUsedWeightKg: number | null;
  computedAddedWeightKg: number | null;
  computedReps: number | null;
  resultLevel: string | null;
  isRankingEligible: boolean;
  verifiedLevel: string;
  createdAt: string;
};

export type StreetliftingCalcRankingSummaryDto = {
  eligible: boolean;
  bucketTitle: string;
  rank: number | null;
  percentile: number | null;
  totalParticipants: number;
  userBestScore: number | null;
  userBestRecordId: string | null;
  notice?: string;
};

export type StreetliftingCalcSummaryDto = {
  latestRecord: StreetliftingCalcRecordDto | null;
  previousRecord: StreetliftingCalcRecordDto | null;
  personalBestRecord: StreetliftingCalcRecordDto | null;
  deltaScore: number | null;
  delta1RMKg: number | null;
  ranking: StreetliftingCalcRankingSummaryDto;
};

export function mapStreetliftingCalcRecord(row: StreetliftingCalcRecordRow): StreetliftingCalcRecordDto {
  return {
    id: row.id,
    sourceSurface: row.source_surface,
    exerciseType: row.exercise_type,
    calcMode: row.calc_mode,
    gender: row.gender,
    bodyweightKg: Number(row.bodyweight_kg || 0),
    reps: row.reps ?? null,
    sets: row.sets ?? null,
    restCat: row.rest_cat ?? null,
    formQuality: row.form_quality ?? null,
    penaltyWeightKg: row.penalty_weight_kg ?? null,
    addedWeightKg: row.added_weight_kg ?? null,
    added1RMKg: row.added_1rm_kg ?? null,
    workingAddedWeightKg: row.working_added_weight_kg ?? null,
    liftWeightKg: row.lift_weight_kg ?? null,
    target1RMKg: row.target_1rm_kg ?? null,
    workingLiftWeightKg: row.working_lift_weight_kg ?? null,
    estimated1RMKg: Number(row.estimated_1rm_kg || 0),
    finalScore: Number(row.final_score || 0),
    coefficient: Number(row.coefficient || 0),
    adjustedUsedWeightKg: row.adjusted_used_weight_kg ?? null,
    computedAddedWeightKg: row.computed_added_weight_kg ?? null,
    computedReps: row.computed_reps ?? null,
    resultLevel: row.result_level ?? null,
    isRankingEligible: Boolean(row.is_ranking_eligible),
    verifiedLevel: row.verified_level || "self_reported",
    createdAt: row.created_at,
  };
}

function dedupeBestByUser(rows: StreetliftingCalcRecordRow[]) {
  const bestMap = new Map<string, StreetliftingCalcRecordRow>();
  for (const row of rows) {
    const current = bestMap.get(row.user_id);
    if (!current) {
      bestMap.set(row.user_id, row);
      continue;
    }
    if (row.final_score > current.final_score) {
      bestMap.set(row.user_id, row);
      continue;
    }
    if (row.final_score === current.final_score) {
      if (row.estimated_1rm_kg > current.estimated_1rm_kg) {
        bestMap.set(row.user_id, row);
        continue;
      }
      if (row.estimated_1rm_kg === current.estimated_1rm_kg && row.created_at < current.created_at) {
        bestMap.set(row.user_id, row);
      }
    }
  }
  return Array.from(bestMap.values()).sort((a, b) => {
    if (b.final_score !== a.final_score) return b.final_score - a.final_score;
    if (b.estimated_1rm_kg !== a.estimated_1rm_kg) return b.estimated_1rm_kg - a.estimated_1rm_kg;
    return a.created_at.localeCompare(b.created_at);
  });
}

export function buildStreetliftingCalcSummary(params: {
  latestRecord: StreetliftingCalcRecordRow;
  previousRecord: StreetliftingCalcRecordRow | null;
  personalBestRecord: StreetliftingCalcRecordRow | null;
  rankingRows: StreetliftingCalcRecordRow[];
}) {
  const { latestRecord, previousRecord, personalBestRecord, rankingRows } = params;

  const bucketTitle = buildStreetliftingRankingBucketTitle({
    exerciseType: latestRecord.exercise_type,
    gender: latestRecord.gender,
  });

  let ranking: StreetliftingCalcRankingSummaryDto;
  if (!latestRecord.is_ranking_eligible) {
    ranking = {
      eligible: false,
      bucketTitle,
      rank: null,
      percentile: null,
      totalParticipants: 0,
      userBestScore: null,
      userBestRecordId: null,
      notice: latestRecord.calc_mode === "day_max" ? "做组极限估算暂不参与趣味排名" : "仅正向计算参与趣味排名",
    };
  } else {
    const rankedBestRows = dedupeBestByUser(rankingRows.filter((row) => row.is_ranking_eligible));
    const rankIndex = rankedBestRows.findIndex((row) => row.user_id === latestRecord.user_id);
    const totalParticipants = rankedBestRows.length;
    const rank = rankIndex >= 0 ? rankIndex + 1 : null;
    const percentile =
      rank && totalParticipants > 0
        ? Number((((totalParticipants - rank) / totalParticipants) * 100).toFixed(1))
        : null;
    const userBest = rankIndex >= 0 ? rankedBestRows[rankIndex] : null;
    ranking = {
      eligible: true,
      bucketTitle,
      rank,
      percentile,
      totalParticipants,
      userBestScore: userBest ? Number(userBest.final_score || 0) : null,
      userBestRecordId: userBest?.id || null,
    };
  }

  const latestRecordDto = mapStreetliftingCalcRecord(latestRecord);
  const previousRecordDto = previousRecord ? mapStreetliftingCalcRecord(previousRecord) : null;
  const personalBestRecordDto = personalBestRecord ? mapStreetliftingCalcRecord(personalBestRecord) : null;

  return {
    latestRecord: latestRecordDto,
    previousRecord: previousRecordDto,
    personalBestRecord: personalBestRecordDto,
    deltaScore: previousRecord ? Number((latestRecord.final_score - previousRecord.final_score).toFixed(1)) : null,
    delta1RMKg: previousRecord ? Number((latestRecord.estimated_1rm_kg - previousRecord.estimated_1rm_kg).toFixed(1)) : null,
    ranking,
  } satisfies StreetliftingCalcSummaryDto;
}
