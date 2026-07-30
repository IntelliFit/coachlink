import { createClient } from "@supabase/supabase-js";
import { getTaskQueueConfig } from "../src/lib/taskqueue/config";
import { getMemoryTaskQueue } from "../src/lib/taskqueue/memorySingleton";
import type { Delivery, TaskQueue } from "../src/lib/taskqueue/types";

const nodeRequire = eval("require") as NodeRequire;
const fs = nodeRequire("fs") as typeof import("fs");
const fsPromises = nodeRequire("fs/promises") as typeof import("fs/promises");
const os = nodeRequire("os") as typeof import("os");
const path = nodeRequire("path") as typeof import("path");
const stream = nodeRequire("stream") as typeof import("stream");
const streamPromises = nodeRequire("stream/promises") as typeof import("stream/promises");
const url = nodeRequire("url") as typeof import("url");

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const localPython = process.platform === "win32"
  ? path.join(repoRoot, ".venv-power-analysis", "Scripts", "python.exe")
  : path.join(repoRoot, ".venv-power-analysis", "bin", "python");
const pythonBin =
  process.env.MOTION_EFFECTS_PYTHON_BIN ||
  (fs.existsSync(localPython) ? localPython : process.platform === "win32" ? "python" : "python3");
const rendererPath = path.join(repoRoot, "scripts", "motion-effects", "render_video.py");
const bucketFallback = "videos";
const supabaseUrl = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("[motion-effects-worker] Missing Supabase URL/service key");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

function spawnRenderer(command: string, args: string[]) {
  const { spawn } = nodeRequire("child_process") as typeof import("child_process");
  return spawn(command, args, {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function updateJob(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from("tool_video_render_jobs").update(patch).eq("id", id);
  if (error) console.warn("[motion-effects-worker] update failed:", id, error.message);
}

async function claimJob(jobId?: string, queueTopic?: string) {
  let query = supabase
    .from("tool_video_render_jobs")
    .select("*")
    .eq("status", "queued")
    .eq("effect_type", "finger_membrane")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(1);
  if (jobId) query = query.eq("id", jobId);
  if (queueTopic) query = query.eq("queue_topic", queueTopic);
  const { data, error } = await query;
  if (error) throw error;
  const candidate = data?.[0];
  if (!candidate) return null;

  let update = supabase
    .from("tool_video_render_jobs")
    .update({
      status: "processing",
      progress: 10,
      started_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", candidate.id)
    .eq("status", "queued");
  if (queueTopic) update = update.eq("queue_topic", queueTopic);
  const { data: claimed, error: claimError } = await update.select("*").maybeSingle();
  if (claimError) throw claimError;
  return claimed || null;
}

async function downloadObject(bucket: string, objectPath: string, target: string) {
  const { data, error } = await supabase.storage.from(bucket).download(objectPath).asStream();
  if (error || !data) throw new Error(error?.message || "无法下载输入视频");
  await streamPromises.pipeline(
    stream.Readable.fromWeb(data as any),
    fs.createWriteStream(target),
  );
}

async function uploadObject(bucket: string, objectPath: string, source: string) {
  const { error } = await supabase.storage.from(bucket).upload(
    objectPath,
    fs.createReadStream(source),
    { contentType: "video/mp4", upsert: true },
  );
  if (error) throw error;
}

async function runRenderer(job: any, directory: string) {
  const input = path.join(directory, `input${path.extname(job.input_storage_path || "") || ".mp4"}`);
  const output = path.join(directory, "output.mp4");
  const resultPath = path.join(directory, "result.json");
  await downloadObject(job.input_storage_bucket || bucketFallback, job.input_storage_path, input);
  const args = [
    rendererPath,
    "--input", input,
    "--output", output,
    "--result", resultPath,
    "--quality", job.export_quality === "hd" ? "hd" : "standard",
    "--style", String(job.style_key || "aurora"),
  ];
  await new Promise<void>((resolve, reject) => {
    const child = spawnRenderer(pythonBin, args);
    let stderr = "";
    let lastProgress = 10;
    child.stdout.on("data", (chunk) => {
      for (const line of chunk.toString("utf8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const payload = JSON.parse(trimmed);
          const progress = Math.max(10, Math.min(95, Number(payload.progress || 0)));
          if (progress >= lastProgress + 5 || progress >= 95) {
            lastProgress = progress;
            void updateJob(job.id, { progress: Math.round(progress) });
          }
        } catch {
          console.log(`[motion-effects-worker][${job.id}] ${trimmed}`);
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
      else reject(new Error(stderr.trim() || `renderer exited with code ${code}`));
    });
  });
  if (!fs.existsSync(output) || !fs.existsSync(resultPath)) {
    throw new Error("渲染器没有生成输出文件");
  }
  const result = JSON.parse(await fsPromises.readFile(resultPath, "utf8"));
  const outputPath =
    job.output_storage_path ||
    `toolbox/motion-effects/tmp/${job.user_id}/${job.id}/output.mp4`;
  await uploadObject(job.output_storage_bucket || bucketFallback, outputPath, output);
  return { result, outputPath };
}

export async function processMotionEffectJob(jobId?: string, queueTopic?: string) {
  const job = await claimJob(jobId, queueTopic);
  if (!job) return false;
  const directory = path.join(os.tmpdir(), "coachlink-motion-effects", job.id);
  await fsPromises.mkdir(directory, { recursive: true });
  try {
    const { result, outputPath } = await runRenderer(job, directory);
    if (job.entitlement_source === "signup_free") {
      const { error: consumeError } = await supabase
        .from("tool_motion_effect_free_exports")
        .update({
          status: "consumed",
          consumed_at: new Date().toISOString(),
        })
        .eq("job_id", job.id)
        .eq("status", "reserved");
      if (consumeError) {
        throw new Error(`注册赠送权益落账失败: ${consumeError.message}`);
      }
    }
    await updateJob(job.id, {
      status: "done",
      progress: 100,
      result_json: result,
      output_storage_path: outputPath,
      completed_at: new Date().toISOString(),
      error_message: null,
    });
    console.log(`[motion-effects-worker] done ${job.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateJob(job.id, {
      status: "failed",
      progress: 100,
      error_message: message.slice(0, 1000),
      completed_at: new Date().toISOString(),
    });
    if (job.entitlement_source === "signup_free") {
      await supabase
        .from("tool_motion_effect_free_exports")
        .delete()
        .eq("job_id", job.id)
        .eq("status", "reserved");
    }
    console.error(`[motion-effects-worker] failed ${job.id}: ${message}`);
  } finally {
    await fsPromises.rm(directory, { recursive: true, force: true }).catch(() => null);
  }
  return true;
}

async function cleanupExpired() {
  const { data, error } = await supabase
    .from("tool_video_render_jobs")
    .select("id,input_storage_bucket,input_storage_path,output_storage_bucket,output_storage_path")
    .neq("status", "expired")
    .lt("expires_at", new Date().toISOString())
    .limit(500);
  if (error) throw error;
  let removedFiles = 0;
  for (const job of data || []) {
    const paths = [job.input_storage_path, job.output_storage_path].filter(Boolean);
    if (!paths.length) continue;
    const { error: removeError } = await supabase.storage
      .from(job.input_storage_bucket || job.output_storage_bucket || bucketFallback)
      .remove(paths);
    if (!removeError) removedFiles += paths.length;
  }
  if (data?.length) {
    await supabase
      .from("tool_motion_effect_free_exports")
      .delete()
      .in("job_id", data.map((job) => job.id))
      .eq("status", "reserved");
    const { error: updateError } = await supabase
      .from("tool_video_render_jobs")
      .update({ status: "expired", progress: 100 })
      .in("id", data.map((job) => job.id));
    if (updateError) throw updateError;
  }
  console.log(
    `[motion-effects-worker] cleanup expiredJobs=${data?.length || 0} removedFiles=${removedFiles}`,
  );
}

async function recover(queue: TaskQueue, topic: string) {
  const { data, error } = await supabase
    .from("tool_video_render_jobs")
    .select("id")
    .eq("status", "queued")
    .eq("queue_topic", topic)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(Number(process.env.MOTION_EFFECTS_RECOVER_BATCH_SIZE || 50));
  if (error) {
    console.warn("[motion-effects-worker] recover failed:", error.message);
    return;
  }
  for (const row of data || []) {
    await queue.publishTask({ taskId: row.id, taskType: "motion_effects" });
  }
}

async function handleDelivery(delivery: Delivery, topic: string) {
  if (delivery.message.taskType !== "motion_effects") {
    await delivery.ack();
    return;
  }
  try {
    await processMotionEffectJob(delivery.message.taskId, topic);
    await delivery.ack();
  } catch (error) {
    await delivery.nack(error);
    throw error;
  }
}

export async function runMotionEffectsQueueWorker(options: {
  queue?: TaskQueue;
  queueTopic?: string;
  installSignalHandlers?: boolean;
} = {}) {
  const config = getTaskQueueConfig(process.env, { requireTopic: true });
  const topic = options.queueTopic || config.topic;
  const queue = options.queue || getMemoryTaskQueue();
  const timer = setInterval(() => { void recover(queue, topic); }, 60_000);
  if (options.installSignalHandlers ?? true) {
    const close = () => {
      clearInterval(timer);
      void queue.close();
    };
    process.once("SIGTERM", close);
    process.once("SIGINT", close);
  }
  await recover(queue, topic);
  for await (const delivery of queue.subscribe({ taskTypes: ["motion_effects"] })) {
    await handleDelivery(delivery, topic);
  }
}

async function main() {
  if (process.argv.includes("--cleanup")) {
    await cleanupExpired();
    return;
  }
  const idIndex = process.argv.indexOf("--job-id");
  const jobId = idIndex >= 0 ? process.argv[idIndex + 1] : undefined;
  await processMotionEffectJob(jobId);
}

if (import.meta.url === url.pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error("[motion-effects-worker] fatal:", error);
    process.exit(1);
  });
}
