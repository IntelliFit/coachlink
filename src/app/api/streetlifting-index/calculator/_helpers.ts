import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ExerciseType, Gender } from "@/app/streetlifting-index/_utils";
import type { StreetliftingFormulaLike } from "@/lib/streetliftingCalculator";
import type { StreetliftingCalcRecordRow } from "@/lib/streetliftingCalcHistory";

const db = serviceRoleSupabase as any;

export async function getStreetliftingFormulaByGender(gender: Gender): Promise<StreetliftingFormulaLike | null> {
  const { data, error } = await db
    .from("streetlifting_formulas")
    .select("coeff_a, coeff_b, coeff_c, coeff_d, coeff_e, coeff_f")
    .eq("gender", gender)
    .order("last_updated", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "加载公式失败");
  }

  return data || null;
}

export async function insertStreetliftingCalcRecord(payload: Record<string, unknown>) {
  const { data, error } = await db
    .from("streetlifting_calc_records")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "保存力量计算记录失败");
  }

  return data as StreetliftingCalcRecordRow;
}

export async function listStreetliftingCalcHistory(params: {
  userId: string;
  exerciseType?: ExerciseType | null;
  page: number;
  limit: number;
}) {
  const { userId, exerciseType, page, limit } = params;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = db
    .from("streetlifting_calc_records")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (exerciseType) {
    query = query.eq("exercise_type", exerciseType);
  }

  const { data, error, count } = await query;
  if (error) {
    throw new Error(error.message || "加载历史失败");
  }

  return {
    rows: (data || []) as StreetliftingCalcRecordRow[],
    total: Number(count || 0),
  };
}

export async function getLatestStreetliftingCalcRecord(params: {
  userId: string;
  exerciseType?: ExerciseType | null;
  excludeRecordId?: string | null;
}) {
  let query = db
    .from("streetlifting_calc_records")
    .select("*")
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (params.exerciseType) {
    query = query.eq("exercise_type", params.exerciseType);
  }
  if (params.excludeRecordId) {
    query = query.neq("id", params.excludeRecordId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(error.message || "加载最近记录失败");
  }
  return (data || null) as StreetliftingCalcRecordRow | null;
}

export async function getStreetliftingCalcRecordById(params: {
  userId: string;
  recordId: string;
}) {
  const { data, error } = await db
    .from("streetlifting_calc_records")
    .select("*")
    .eq("user_id", params.userId)
    .eq("id", params.recordId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "加载记录失败");
  }
  return (data || null) as StreetliftingCalcRecordRow | null;
}

export async function getPersonalBestStreetliftingCalcRecord(params: {
  userId: string;
  exerciseType: ExerciseType;
}) {
  const { data, error } = await db
    .from("streetlifting_calc_records")
    .select("*")
    .eq("user_id", params.userId)
    .eq("exercise_type", params.exerciseType)
    .order("final_score", { ascending: false })
    .order("estimated_1rm_kg", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "加载最佳记录失败");
  }
  return (data || null) as StreetliftingCalcRecordRow | null;
}

export async function listStreetliftingRankingRows(params: {
  exerciseType: ExerciseType;
  gender: Gender;
}) {
  const { data, error } = await db
    .from("streetlifting_calc_records")
    .select("*")
    .eq("exercise_type", params.exerciseType)
    .eq("gender", params.gender)
    .eq("is_ranking_eligible", true)
    .order("final_score", { ascending: false })
    .order("estimated_1rm_kg", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "加载趣味排名失败");
  }

  return (data || []) as StreetliftingCalcRecordRow[];
}
