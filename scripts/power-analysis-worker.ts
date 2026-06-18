import { createClient } from "@supabase/supabase-js";
import { getTaskQueueConfig } from "../src/lib/taskqueue/config";
import { getMemoryTaskQueue } from "../src/lib/taskqueue/memorySingleton";
import type { Delivery, TaskQueue } from "../src/lib/taskqueue/types";

const nodeRequire = eval("require") as NodeRequire;
const fs = nodeRequire("fs") as typeof import("fs");
const fsPromises = nodeRequire("fs/promises") as typeof import("fs/promises");
const os = nodeRequire("os") as typeof import("os");
const path = nodeRequire("path") as typeof import("path");
const url = nodeRequire("url") as typeof import("url");

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const bucketFallback = "videos";
const localVenvPython = process.platform === "win32"
  ? path.join(repoRoot, ".venv-power-analysis", "Scripts", "python.exe")
  : path.join(repoRoot, ".venv-power-analysis", "bin", "python");
const pythonBin =
  process.env.POWER_ANALYSIS_PYTHON_BIN ||
  (fs.existsSync(localVenvPython) ? localVenvPython : process.platform === "win32" ? "python" : "python3");
const analyzerPath = path.join(repoRoot, "scripts", "power-analysis", "analyze_video.py");

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

function spawnChildProcess(
  command: string,
  args: string[],
  options: {
    cwd: string;
    stdio: ["ignore", "pipe", "pipe"];
  },
) {
  // Keep child_process out of Next instrumentation's static bundle graph.
  const { spawn } = nodeRequire("child_process") as typeof import("child_process");
  return spawn(command, args, options);
}

function getArg(name: string, fallback: string | null = null) {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return fallback;
  return process.argv[idx + 1] || fallback;
}

function hasArg(name: string) {
  return process.argv.includes(name);
}

async function updateJob(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase
    .from("tool_power_analysis_jobs")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.warn("[power-worker] update failed:", id, error.message);
  }
}

async function claimJob(jobId?: string, queueTopic?: string) {
  const now = new Date().toISOString();
  let query = supabase
    .from("tool_power_analysis_jobs")
    .select("*")
    .eq("status", "queued")
    .gt("expires_at", now)
    .order("created_at", { ascending: true })
    .limit(1);

  if (jobId) query = query.eq("id", jobId);
  if (queueTopic) query = query.eq("queue_topic", queueTopic);

  const { data: rows, error } = await query;
  if (error) throw error;
  const candidate = rows?.[0];
  if (!candidate) return null;

  let updateQuery = supabase
    .from("tool_power_analysis_jobs")
    .update({
      status: "processing",
      progress: 10,
      started_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", candidate.id)
    .eq("status", "queued");

  if (queueTopic) updateQuery = updateQuery.eq("queue_topic", queueTopic);

  const { data: claimed, error: updateError } = await updateQuery
    .select("*")
    .maybeSingle();

  if (updateError) throw updateError;
  return claimed || null;
}

async function downloadObject(bucket: string, objectPath: string, targetPath: string) {
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error || !data) {
    throw new Error(error?.message || `Cannot download ${bucket}/${objectPath}`);
  }
  const arrayBuffer = await data.arrayBuffer();
  await fsPromises.writeFile(targetPath, Buffer.from(arrayBuffer));
}

async function uploadObject(bucket: string, objectPath: string, sourcePath: string) {
  const body = await fsPromises.readFile(sourcePath);
  const { error } = await supabase.storage.from(bucket).upload(objectPath, body, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (error) throw error;
}

function getExternalLoadKg(job: any) {
  const metadata = job?.metadata && typeof job.metadata === "object" ? job.metadata : {};
  const value = Number(metadata.external_load_kg ?? metadata.externalLoadKg ?? 0);
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

async function runAnalyzer(job: any, workDir: string) {
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
    "--external-load-kg",
    String(getExternalLoadKg(job)),
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawnChildProcess(pythonBin, args, {
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

  if (!fs.existsSync(outputPath) || !fs.existsSync(metricsPath)) {
    throw new Error("Analyzer did not produce output files");
  }

  const metrics = JSON.parse(await fsPromises.readFile(metricsPath, "utf8"));
  const outputStoragePath =
    job.output_storage_path ||
    `toolbox/power-analysis/tmp/${job.user_id}/${job.id}/output.mp4`;

  await uploadObject(job.output_storage_bucket || bucketFallback, outputStoragePath, outputPath);
  return { metrics, outputStoragePath };
}

async function processJob(jobId?: string, queueTopic?: string) {
  const job = await claimJob(jobId, queueTopic);
  if (!job) {
    if (jobId) console.log(`[power-worker] job not claimable ${jobId}`);
    else console.log("[power-worker] no queued jobs");
    return false;
  }

  console.log(`[power-worker] processing ${job.id}`);
  const workDir = path.join(os.tmpdir(), "coachlink-power-analysis", job.id);
  await fsPromises.mkdir(workDir, { recursive: true });

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
    await fsPromises.rm(workDir, { recursive: true, force: true }).catch(() => null);
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
    const pathsByBucket = new Map<string, string[]>();
    const add = (bucket: string | null, objectPath: string | null) => {
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

async function runOnceFallback() {
  return processJob();
}

async function recoverQueuedJobs(queue: TaskQueue, queueTopic: string) {
  const now = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from("tool_power_analysis_jobs")
    .select("id")
    .eq("status", "queued")
    .eq("queue_topic", queueTopic)
    .gt("expires_at", now)
    .order("created_at", { ascending: true })
    .limit(Number(process.env.POWER_ANALYSIS_RECOVER_BATCH_SIZE || 50));

  if (error) {
    console.warn("[power-worker] recover query failed:", error.message);
    return;
  }
  for (const row of rows || []) {
    await queue.publishTask({ taskId: row.id, taskType: "power_analysis" }).catch((error) => {
      console.warn(`[power-worker] recover publish failed ${row.id}:`, error);
    });
  }
  if (rows?.length) {
    console.log(`[power-worker] recovered queued jobs=${rows.length} topic=${queueTopic}`);
  }
}

function getRecoverIntervalMs() {
  const raw = Number(process.env.POWER_ANALYSIS_RECOVER_INTERVAL_MS || 60_000);
  if (!Number.isFinite(raw)) return 60_000;
  if (raw <= 0) return 0;
  return Math.max(1_000, raw);
}

async function handleDelivery(delivery: Delivery, queueTopic: string) {
  if (delivery.message.taskType !== "power_analysis") {
    await delivery.ack();
    return;
  }

  try {
    await processJob(delivery.message.taskId, queueTopic);
    await delivery.ack();
  } catch (error) {
    await delivery.nack(error);
    throw error;
  }
}

export async function runPowerAnalysisQueueWorker(options: {
  queue?: TaskQueue;
  queueTopic?: string;
  installSignalHandlers?: boolean;
} = {}) {
  const queueTopic = options.queueTopic || getTaskQueueConfig(process.env, { requireTopic: true }).topic;
  const queue = options.queue || getMemoryTaskQueue();
  const recoverIntervalMs = getRecoverIntervalMs();
  const recoverTimer = recoverIntervalMs > 0
    ? setInterval(() => {
        void recoverQueuedJobs(queue, queueTopic);
      }, recoverIntervalMs)
    : null;

  if (options.installSignalHandlers ?? true) {
    process.once("SIGTERM", () => {
      if (recoverTimer) clearInterval(recoverTimer);
      void queue.close();
    });
    process.once("SIGINT", () => {
      if (recoverTimer) clearInterval(recoverTimer);
      void queue.close();
    });
  }

  if (recoverIntervalMs > 0) {
    await recoverQueuedJobs(queue, queueTopic);
  }
  for await (const delivery of queue.subscribe({ taskTypes: ["power_analysis"] })) {
    await handleDelivery(delivery, queueTopic);
  }
}

async function runQueueWorker() {
  await runPowerAnalysisQueueWorker();
}

async function main() {
  if (!fs.existsSync(analyzerPath)) {
    throw new Error(`Analyzer script not found: ${analyzerPath}`);
  }

  if (hasArg("--cleanup")) {
    await cleanupExpired();
    return;
  }

  if (!hasArg("--poll") && !hasArg("--queue")) {
    await processJob(getArg("--job-id", null) || undefined);
    return;
  }

  if (hasArg("--queue")) {
    await runQueueWorker();
    return;
  }

  const intervalMs = Number(getArg("--interval-ms", "5000"));
  const maxJobs = Number(getArg("--max-jobs", "0"));
  let processed = 0;

  do {
    const didWork = await runOnceFallback();
    if (didWork) processed += 1;
    if (maxJobs > 0 && processed >= maxJobs) break;
    if (!didWork) {
      await new Promise((resolve) => setTimeout(resolve, Number.isFinite(intervalMs) ? intervalMs : 5000));
    }
  } while (true);
}

if (import.meta.url === url.pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error("[power-worker] fatal:", error);
    process.exit(1);
  });
}
