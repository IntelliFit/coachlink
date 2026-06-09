import { getTaskQueueConfig } from "./config";
import { MemoryTaskQueue } from "./memory";

let memoryQueue: MemoryTaskQueue | null = null;

export function getMemoryTaskQueue() {
  const config = getTaskQueueConfig();
  if (!memoryQueue) {
    memoryQueue = new MemoryTaskQueue(config.bufferSize);
  }
  return memoryQueue;
}
