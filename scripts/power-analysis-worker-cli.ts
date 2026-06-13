import { getTaskQueueConfig } from "../src/lib/taskqueue/config";
import { createTaskQueue } from "../src/lib/taskqueue/factory";
import { runPowerAnalysisQueueWorker } from "./power-analysis-worker";

export async function runPowerAnalysisCliQueueWorker() {
  const queue = await createTaskQueue();
  const config = getTaskQueueConfig();
  await runPowerAnalysisQueueWorker({
    queue,
    enableRecover: config.driver === "memory",
    installSignalHandlers: true,
  });
}

runPowerAnalysisCliQueueWorker().catch((error) => {
  console.error("[power-worker] fatal:", error);
  process.exit(1);
});
