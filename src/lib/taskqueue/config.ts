import type { TaskQueueConfig } from "./types";

interface TaskQueueConfigOptions {
  requireTopic?: boolean;
}

function parseList(value: string | undefined) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDriver(value: string | undefined): TaskQueueConfig["driver"] {
  const driver = String(value || "memory").trim().toLowerCase();
  if (["memory", "local", "in_memory", "in-memory"].includes(driver)) {
    return "memory";
  }
  if (driver === "kafka") return "kafka";
  throw new Error(`Unsupported TASK_QUEUE_DRIVER=${JSON.stringify(value)}`);
}

export function getTaskQueueConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: TaskQueueConfigOptions = {},
): TaskQueueConfig {
  const driver = normalizeDriver(env.TASK_QUEUE_DRIVER);
  const topic = String(env.TASK_QUEUE_TOPIC || "").trim();
  if (options.requireTopic && !topic) {
    throw new Error("TASK_QUEUE_TOPIC must be set for power analysis queue ownership");
  }

  const config: TaskQueueConfig = {
    driver,
    bufferSize: Math.max(1, Number(env.TASK_QUEUE_BUFFER_SIZE || 1024)),
    brokers: parseList(env.TASK_QUEUE_BROKERS),
    topic: topic || "coachlink-power-analysis-tasks",
    consumerGroup: env.TASK_QUEUE_CONSUMER_GROUP || "coachlink-power-workers",
    clientId: env.TASK_QUEUE_CLIENT_ID || "coachlink-power-worker",
  };

  if (driver === "kafka" && config.brokers.length === 0) {
    throw new Error("TASK_QUEUE_BROKERS must be set when TASK_QUEUE_DRIVER=kafka");
  }

  return config;
}
