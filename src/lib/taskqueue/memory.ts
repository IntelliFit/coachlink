import type { Delivery, SubscribeOptions, TaskMessage, TaskQueue } from "./types";
import { normalizeTaskMessage } from "./types";

function createAsyncSignal() {
  let notify: (() => void) | null = null;
  return {
    wait() {
      return new Promise<void>((resolve) => {
        notify = resolve;
      });
    },
    notify() {
      const resolve = notify;
      notify = null;
      resolve?.();
    },
  };
}

export class MemoryTaskQueue implements TaskQueue {
  private readonly messages: TaskMessage[] = [];
  private readonly signal = createAsyncSignal();
  private closed = false;

  constructor(private readonly bufferSize: number) {}

  async publishTask(message: TaskMessage) {
    if (this.closed) throw new Error("Task queue is closed");
    if (this.messages.length >= this.bufferSize) {
      throw new Error(`Memory task queue is full (${this.bufferSize})`);
    }
    this.messages.push(normalizeTaskMessage(message));
    this.signal.notify();
  }

  async *subscribe(options: SubscribeOptions = {}): AsyncIterable<Delivery> {
    const allowedTypes = new Set(options.taskTypes || []);
    while (!this.closed) {
      const index = this.messages.findIndex(
        (message) => allowedTypes.size === 0 || allowedTypes.has(message.taskType),
      );
      if (index < 0) {
        await this.signal.wait();
        continue;
      }

      const [message] = this.messages.splice(index, 1);
      yield {
        message,
        ack: async () => undefined,
        nack: async () => {
          if (!this.closed) {
            this.messages.push(message);
            this.signal.notify();
          }
        },
      };
    }
  }

  async close() {
    this.closed = true;
    this.signal.notify();
  }
}
