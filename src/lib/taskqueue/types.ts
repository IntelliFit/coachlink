export interface TaskMessage {
  taskId: string;
  taskType: string;
  createdAt?: string;
}

export interface SubscribeOptions {
  taskTypes?: string[];
}

export interface Delivery {
  message: TaskMessage;
  ack(): Promise<void>;
  nack(error?: unknown): Promise<void>;
}

export interface TaskQueue {
  publishTask(message: TaskMessage): Promise<void>;
  subscribe(options?: SubscribeOptions): AsyncIterable<Delivery>;
  close(): Promise<void>;
}

export interface TaskQueueConfig {
  driver: "memory" | "kafka";
  bufferSize: number;
  brokers: string[];
  topic: string;
  consumerGroup: string;
  clientId: string;
}

export function normalizeTaskMessage(message: TaskMessage): TaskMessage {
  return {
    taskId: String(message.taskId || "").trim(),
    taskType: String(message.taskType || "").trim(),
    createdAt: message.createdAt || new Date().toISOString(),
  };
}
