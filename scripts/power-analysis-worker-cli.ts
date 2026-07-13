import { getTaskQueueConfig } from "../src/lib/taskqueue/config";
import { createTaskQueue } from "../src/lib/taskqueue/factory";
import { runPowerAnalysisQueueWorker } from "./power-analysis-worker";

export async function runPowerAnalysisCliQueueWorker() {
  // The in-memory queue is process-local, so its documented default topic is
  // safe for local development. External Kafka workers still need an explicit
  // topic to avoid accidentally consuming an unintended queue.
  const driver = String(process.env.TASK_QUEUE_DRIVER || "memory").trim().toLowerCase();
  const config = getTaskQueueConfig(process.env, { requireTopic: driver === "kafka" });
  const queue = await createTaskQueue();
  await runPowerAnalysisQueueWorker({
    queue,
    queueTopic: config.topic,
    installSignalHandlers: true,
  });
}

runPowerAnalysisCliQueueWorker().catch((error) => {
  console.error("[power-worker] fatal:", error);
  process.exit(1);
});
