import { getTaskQueueConfig } from "./config";
import { getMemoryTaskQueue } from "./memorySingleton";
import type { TaskQueue } from "./types";

export async function createTaskQueue(): Promise<TaskQueue> {
  const config = getTaskQueueConfig();
  if (config.driver === "kafka") {
    const { KafkaTaskQueue } = await import("./kafka");
    return new KafkaTaskQueue(config);
  }
  return getMemoryTaskQueue();
}

export async function publishTask(message: { taskId: string; taskType: string }) {
  const config = getTaskQueueConfig();
  const queue = await createTaskQueue();
  try {
    await queue.publishTask(message);
  } finally {
    if (config.driver === "kafka") {
      await queue.close();
    }
  }
}
