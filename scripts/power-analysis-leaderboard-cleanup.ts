/**
 * Removes leaderboard bests that came from impossible results (tracking jumps beyond
 * human range) and puts back each user's best plausible result, if they have one.
 *
 * Dry run by default: prints every row it would change. --apply writes.
 *   npx tsx scripts/power-analysis-leaderboard-cleanup.ts [--env-file .env.apollo-local] [--apply]
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { isRankedPowerAnalysisMode, normalizePowerAnalysisSubject } from "@coachlink/core/src/powerAnalysisModes";
import { findPowerAnalysisRankingBlocker } from "../src/lib/powerAnalysisPlausibility";
import type { PowerAnalysisMode } from "../src/app/api/toolbox/power-analysis/types";

type Board = "power" | "velocity";

const BOARDS: Record<Board, { score: string; mode: string; job: string; achievedAt: string; summaryKey: string }> = {
  power: {
    score: "best_power_w",
    mode: "best_power_mode",
    job: "best_power_job_id",
    achievedAt: "best_power_achieved_at",
    summaryKey: "bestPowerW",
  },
  velocity: {
    score: "best_velocity_mps",
    mode: "best_velocity_mode",
    job: "best_velocity_job_id",
    achievedAt: "best_velocity_achieved_at",
    summaryKey: "bestVelocityMps",
  },
};

interface JobRow {
  id: string;
  user_id: string;
  mode: PowerAnalysisMode;
  height_cm: number;
  metadata: Record<string, unknown> | null;
  completed_at: string | null;
  updated_at: string | null;
  created_at: string;
  summary: Record<string, number> | null;
  reps: Array<{ displacementM: number; maxVelocityMps: number }> | null;
}

interface Change {
  userId: string;
  board: Board;
  from: { value: number; mode: string; jobId: string };
  to: { value: number; mode: string; jobId: string; achievedAt: string } | null;
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function isBlocked(job: JobRow): boolean {
  return findPowerAnalysisRankingBlocker(
    { summary: job.summary as any, reps: (job.reps || []) as any },
    job.mode,
    Number(job.height_cm),
  ) !== null;
}

function rankable(job: JobRow): boolean {
  return Boolean(job.summary) &&
    isRankedPowerAnalysisMode(job.mode) &&
    normalizePowerAnalysisSubject(job.metadata?.subject) === "self" &&
    !isBlocked(job);
}

function bestPlausible(jobs: JobRow[], board: Board): Change["to"] {
  const key = BOARDS[board].summaryKey;
  const best = jobs
    .filter((job) => rankable(job) && Number(job.summary?.[key]) > 0)
    .sort((a, b) => Number(b.summary?.[key]) - Number(a.summary?.[key]))[0];
  if (!best) return null;
  return {
    value: Number(best.summary?.[key]),
    mode: best.mode,
    jobId: best.id,
    achievedAt: best.completed_at || best.updated_at || best.created_at,
  };
}

async function main() {
  dotenv.config({ path: argValue("--env-file") || ".env.apollo-local" });
  const url = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase URL / service role key not found in the env file");
  const apply = process.argv.includes("--apply");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: bests, error } = await db.from("power_analysis_best_scores").select("*");
  if (error) throw error;
  const userIds = Array.from(new Set((bests || []).map((row: any) => row.user_id)));
  const jobsByUser = new Map<string, JobRow[]>();
  for (let i = 0; i < userIds.length; i += 50) {
    const { data, error: jobsError } = await db
      .from("tool_power_analysis_jobs")
      .select("id,user_id,mode,height_cm,metadata,completed_at,updated_at,created_at,summary:metrics_json->summary,reps:metrics_json->reps")
      .in("user_id", userIds.slice(i, i + 50))
      .in("status", ["done", "expired"]);
    if (jobsError) throw jobsError;
    for (const job of (data || []) as JobRow[]) {
      jobsByUser.set(job.user_id, [...(jobsByUser.get(job.user_id) || []), job]);
    }
  }

  const changes: Change[] = [];
  for (const row of (bests || []) as any[]) {
    const jobs = jobsByUser.get(row.user_id) || [];
    for (const board of Object.keys(BOARDS) as Board[]) {
      const columns = BOARDS[board];
      const current = jobs.find((job) => job.id === row[columns.job]);
      if (row[columns.score] === null || !current || !isBlocked(current)) continue;
      changes.push({
        userId: row.user_id,
        board,
        from: { value: Number(row[columns.score]), mode: row[columns.mode], jobId: row[columns.job] },
        to: bestPlausible(jobs, board),
      });
    }
  }

  for (const change of changes) {
    const to = change.to ? `${change.to.value.toFixed(2)} (${change.to.mode}, job ${change.to.jobId.slice(0, 8)})` : "清空";
    console.log(`${change.userId.slice(0, 8)}  ${change.board.padEnd(8)}  ${change.from.value.toFixed(2)} (${change.from.mode}, job ${change.from.jobId.slice(0, 8)})  ->  ${to}`);
  }
  console.log(`\n${changes.length} board entries from impossible results across ${new Set(changes.map((c) => c.userId)).size} users.`);
  if (!apply) {
    console.log("Dry run: nothing written. Re-run with --apply to write.");
    return;
  }

  for (const userId of new Set(changes.map((change) => change.userId))) {
    const row = (bests || []).find((item: any) => item.user_id === userId) as any;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const change of changes.filter((item) => item.userId === userId)) {
      const columns = BOARDS[change.board];
      patch[columns.score] = change.to?.value ?? null;
      patch[columns.mode] = change.to?.mode ?? null;
      patch[columns.job] = change.to?.jobId ?? null;
      patch[columns.achievedAt] = change.to?.achievedAt ?? null;
    }
    const next = { ...row, ...patch };
    const result = next.best_power_w === null && next.best_velocity_mps === null
      ? await db.from("power_analysis_best_scores").delete().eq("user_id", userId)
      : await db.from("power_analysis_best_scores").update(patch).eq("user_id", userId);
    if (result.error) throw new Error(`user ${userId.slice(0, 8)}: ${result.error.message}`);
  }
  console.log(`Applied ${changes.length} changes.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
