import { getTaskQueueConfig } from "../src/lib/taskqueue/config";
import { createTaskQueue } from "../src/lib/taskqueue/factory";
import { runPowerAnalysisQueueWorker } from "./power-analysis-worker";

export async function runPowerAnalysisCliQueueWorker() {
  const config = getTaskQueueConfig(process.env, { requireTopic: true });
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
