import { getTaskQueueConfig } from "@/lib/taskqueue/config";

let started = false;

export function ensureEmbeddedPowerAnalysisWorker() {
  const config = getTaskQueueConfig();
  if (config.driver !== "memory") return false;
  if (started) return true;

  started = true;
  void import("../../../scripts/power-analysis-worker.ts").then(({ runPowerAnalysisQueueWorker }) => {
    console.log("[power-worker:embedded] starting memory queue worker");
    return runPowerAnalysisQueueWorker({
      enableRecover: true,
      installSignalHandlers: false,
    });
  }).catch((error) => {
    started = false;
    console.error("[power-worker:embedded] failed:", error);
  });

  return true;
}
