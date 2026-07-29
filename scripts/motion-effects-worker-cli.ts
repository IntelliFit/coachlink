import { getTaskQueueConfig } from "../src/lib/taskqueue/config";
import { createTaskQueue } from "../src/lib/taskqueue/factory";
import { runMotionEffectsQueueWorker } from "./motion-effects-worker";

const config = getTaskQueueConfig(process.env, { requireTopic: true });
const queue = await createTaskQueue(config);
runMotionEffectsQueueWorker({
  queue,
  queueTopic: config.topic,
  installSignalHandlers: true,
}).catch((error) => {
  console.error("[motion-effects-worker] fatal:", error);
  process.exit(1);
});
