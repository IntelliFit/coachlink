#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(repoRoot, ".env.local"), override: true });

const SUPABASE_URL = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("[power-worker] Missing Supabase URL/service key");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const bucketFallback = "videos";
const pythonBin = process.env.POWER_ANALYSIS_PYTHON_BIN || "python";
const analyzerPath = path.join(repoRoot, "scripts", "power-analysis", "analyze_video.py");

function getArg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return fallback;
  return process.argv[idx + 1] || fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

async function updateJob(id, patch) {
  const { error } = await supabase
    .from("tool_power_analysis_jobs")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.warn("[power-worker] update failed:", id, error.message);
  }
}

async function claimJob() {
  const now = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from("tool_power_analysis_jobs")
    .select("*")
    .eq("status", "queued")
    .gt("expires_at", now)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  const candidate = rows?.[0];
  if (!candidate) return null;

  const { data: claimed, error: updateError } = await supabase
    .from("tool_power_analysis_jobs")
    .update({
      status: "processing",
      progress: 10,
      started_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", candidate.id)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (updateError) throw updateError;
  return claimed || null;
}

async function downloadObject(bucket, objectPath, targetPath) {
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error || !data) {
    throw new Error(error?.message || `Cannot download ${bucket}/${objectPath}`);
  }
  const arrayBuffer = await data.arrayBuffer();
  await writeFile(targetPath, Buffer.from(arrayBuffer));
}

async function uploadObject(bucket, objectPath, sourcePath) {
  const body = await readFile(sourcePath);
  const { error } = await supabase.storage.from(bucket).upload(objectPath, body, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (error) throw error;
}

async function runAnalyzer(job, workDir) {
  const inputExt = path.extname(job.input_storage_path || "") || ".mp4";
  const inputPath = path.join(workDir, `input${inputExt}`);
  const outputPath = path.join(workDir, "output.mp4");
  const metricsPath = path.join(workDir, "metrics.json");

  await downloadObject(
    job.input_storage_bucket || bucketFallback,
    job.input_storage_path,
    inputPath,
  );

  const args = [
    analyzerPath,
    "--input",
    inputPath,
    "--output",
    outputPath,
    "--metrics",
    metricsPath,
    "--mode",
    job.mode,
    "--height-cm",
    String(job.height_cm),
    "--weight-kg",
    String(job.weight_kg),
  ];

  await new Promise((resolve, reject) => {
    const child = spawn(pythonBin, args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    let lastProgress = 10;

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const payload = JSON.parse(trimmed);
          if (Number.isFinite(payload.progress)) {
            const progress = Math.max(10, Math.min(95, Number(payload.progress)));
            if (progress >= lastProgress + 5 || progress >= 95) {
              lastProgress = progress;
              void updateJob(job.id, { progress: Math.round(progress) });
            }
          }
        } catch {
          console.log(`[power-worker][${job.id}] ${trimmed}`);
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
      process.stderr.write(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `Python analyzer exited with code ${code}`));
    });
  });

  if (!existsSync(outputPath) || !existsSync(metricsPath)) {
    throw new Error("Analyzer did not produce output files");
  }

  const metrics = JSON.parse(await readFile(metricsPath, "utf8"));
  const outputStoragePath =
    job.output_storage_path ||
    `toolbox/power-analysis/tmp/${job.user_id}/${job.id}/output.mp4`;

  await uploadObject(job.output_storage_bucket || bucketFallback, outputStoragePath, outputPath);
  return { metrics, outputStoragePath };
}

async function processOne() {
  const job = await claimJob();
  if (!job) {
    console.log("[power-worker] no queued jobs");
    return false;
  }

  console.log(`[power-worker] processing ${job.id}`);
  const workDir = path.join(os.tmpdir(), "coachlink-power-analysis", job.id);
  await mkdir(workDir, { recursive: true });

  try {
    const { metrics, outputStoragePath } = await runAnalyzer(job, workDir);
    await updateJob(job.id, {
      status: "done",
      progress: 100,
      metrics_json: metrics,
      output_storage_path: outputStoragePath,
      completed_at: new Date().toISOString(),
      error_message: null,
    });
    console.log(`[power-worker] done ${job.id}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateJob(job.id, {
      status: "failed",
      progress: 100,
      error_message: message.slice(0, 1000),
      completed_at: new Date().toISOString(),
    });
    console.error(`[power-worker] failed ${job.id}:`, message);
    return true;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => null);
  }
}

async function cleanupExpired() {
  const now = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from("tool_power_analysis_jobs")
    .select("id, input_storage_bucket, input_storage_path, output_storage_bucket, output_storage_path")
    .neq("status", "expired")
    .lt("expires_at", now)
    .limit(500);

  if (error) throw error;
  const jobs = rows || [];
  let removedFiles = 0;

  for (const job of jobs) {
    const pathsByBucket = new Map();
    const add = (bucket, objectPath) => {
      if (!objectPath) return;
      const key = bucket || bucketFallback;
      pathsByBucket.set(key, [...(pathsByBucket.get(key) || []), objectPath]);
    };
    add(job.input_storage_bucket, job.input_storage_path);
    add(job.output_storage_bucket, job.output_storage_path);

    for (const [bucket, paths] of pathsByBucket.entries()) {
      const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
      if (removeError) {
        console.warn(`[power-worker] cleanup remove failed ${job.id}:`, removeError.message);
      } else {
        removedFiles += paths.length;
      }
    }
  }

  if (jobs.length > 0) {
    const { error: updateError } = await supabase
      .from("tool_power_analysis_jobs")
      .update({ status: "expired", progress: 100 })
      .in(
        "id",
        jobs.map((job) => job.id),
      );
    if (updateError) throw updateError;
  }

  console.log(`[power-worker] cleanup expiredJobs=${jobs.length} removedFiles=${removedFiles}`);
}

async function main() {
  if (!existsSync(analyzerPath)) {
    throw new Error(`Analyzer script not found: ${analyzerPath}`);
  }

  if (hasArg("--cleanup")) {
    await cleanupExpired();
    return;
  }

  const poll = hasArg("--poll");
  const intervalMs = Number(getArg("--interval-ms", "5000"));
  const maxJobs = Number(getArg("--max-jobs", poll ? "0" : "1"));
  let processed = 0;

  do {
    const didWork = await processOne();
    if (didWork) processed += 1;
    if (!poll) break;
    if (maxJobs > 0 && processed >= maxJobs) break;
    if (!didWork) {
      await new Promise((resolve) => setTimeout(resolve, Number.isFinite(intervalMs) ? intervalMs : 5000));
    }
  } while (true);
}

main().catch((error) => {
  console.error("[power-worker] fatal:", error);
  process.exit(1);
});
