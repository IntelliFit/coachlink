import { getTaskQueueConfig } from "../src/lib/taskqueue/config";
import { createTaskQueue } from "../src/lib/taskqueue/factory";
import { runMotionEffectsQueueWorker } from "./motion-effects-worker";

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const baseConfig = getTaskQueueConfig(process.env, { requireTopic: true });
  const config = {
    ...baseConfig,
    topic: argValue("--queue-topic") || baseConfig.topic,
    consumerGroup:
      argValue("--consumer-group") || baseConfig.consumerGroup,
    clientId: argValue("--client-id") || baseConfig.clientId,
  };
  const queue = await createTaskQueue(config);
  await runMotionEffectsQueueWorker({
    queue,
    queueTopic: config.topic,
    installSignalHandlers: true,
  });
}

main().catch((error) => {
  console.error("[motion-effects-worker] fatal:", error);
  process.exit(1);
});
