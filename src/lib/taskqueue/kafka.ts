import { Kafka, type Consumer, type EachMessagePayload, type Producer } from "kafkajs";
import type { Delivery, SubscribeOptions, TaskMessage, TaskQueue, TaskQueueConfig } from "./types";
import { normalizeTaskMessage } from "./types";

function decodeMessage(value: Buffer | null): TaskMessage | null {
  if (!value) return null;
  const parsed = JSON.parse(value.toString("utf8")) as TaskMessage;
  const message = normalizeTaskMessage(parsed);
  return message.taskId && message.taskType ? message : null;
}

function matchesOptions(message: TaskMessage, options: SubscribeOptions) {
  return !options.taskTypes?.length || options.taskTypes.includes(message.taskType);
}

export class KafkaTaskQueue implements TaskQueue {
  private readonly producer: Producer;
  private readonly consumers = new Set<Consumer>();
  private producerConnected = false;
  private closed = false;

  constructor(private readonly config: TaskQueueConfig) {
    const kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
    });
    this.producer = kafka.producer();
    this.createConsumer = () =>
      kafka.consumer({ groupId: config.consumerGroup, allowAutoTopicCreation: false });
  }

  private readonly createConsumer: () => Consumer;

  async publishTask(message: TaskMessage) {
    if (this.closed) throw new Error("Task queue is closed");
    const normalized = normalizeTaskMessage(message);
    if (!normalized.taskId) throw new Error("Task message taskId is required");
    if (!normalized.taskType) throw new Error("Task message taskType is required");
    if (!this.producerConnected) {
      await this.producer.connect();
      this.producerConnected = true;
    }

    await this.producer.send({
      topic: this.config.topic,
      messages: [
        {
          key: normalized.taskId,
          value: JSON.stringify(normalized),
        },
      ],
    });
  }

  async *subscribe(options: SubscribeOptions = {}): AsyncIterable<Delivery> {
    const consumer = this.createConsumer();
    this.consumers.add(consumer);
    const pending: Delivery[] = [];
    let wake: (() => void) | null = null;
    let failure: unknown = null;

    const notify = () => {
      const resolve = wake;
      wake = null;
      resolve?.();
    };

    await consumer.connect();
    await consumer.subscribe({ topic: this.config.topic, fromBeginning: false });
    await consumer.run({
      autoCommit: false,
      eachMessage: async (payload: EachMessagePayload) => {
        try {
          const message = decodeMessage(payload.message.value);
          if (!message || !matchesOptions(message, options)) {
            await consumer.commitOffsets([this.offsetToCommit(payload)]);
            return;
          }

          pending.push({
            message,
            ack: async () => {
              await consumer.commitOffsets([this.offsetToCommit(payload)]);
            },
            nack: async (error?: unknown) => {
              if (error) {
                console.warn("[taskqueue:kafka] nack without commit:", error);
              }
            },
          });
          notify();
        } catch (error) {
          failure = error;
          notify();
        }
      },
    });

    try {
      while (!this.closed) {
        if (failure) throw failure;
        const delivery = pending.shift();
        if (delivery) {
          yield delivery;
          continue;
        }
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    } finally {
      this.consumers.delete(consumer);
      await consumer.disconnect().catch(() => undefined);
    }
  }

  private offsetToCommit(payload: EachMessagePayload) {
    return {
      topic: payload.topic,
      partition: payload.partition,
      offset: (BigInt(payload.message.offset) + 1n).toString(),
    };
  }

  async close() {
    this.closed = true;
    for (const consumer of this.consumers) {
      await consumer.disconnect().catch(() => undefined);
    }
    if (this.producerConnected) {
      await this.producer.disconnect().catch(() => undefined);
      this.producerConnected = false;
    }
  }
}
