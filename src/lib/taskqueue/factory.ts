import { getTaskQueueConfig } from "./config";
import { getMemoryTaskQueue } from "./memorySingleton";
import type { TaskQueue, TaskQueueConfig } from "./types";

export async function createTaskQueue(
  suppliedConfig?: TaskQueueConfig,
): Promise<TaskQueue> {
  const config = suppliedConfig || getTaskQueueConfig();
  if (config.driver === "kafka") {
    const { KafkaTaskQueue } = await import("./kafka");
    return new KafkaTaskQueue(config);
  }
  return getMemoryTaskQueue();
}

export async function publishTask(
  message: { taskId: string; taskType: string },
  suppliedConfig?: TaskQueueConfig,
) {
  const config = suppliedConfig || getTaskQueueConfig();
  const queue = await createTaskQueue(config);
  try {
    await queue.publishTask(message);
  } finally {
    if (config.driver === "kafka") {
      await queue.close();
    }
  }
}
