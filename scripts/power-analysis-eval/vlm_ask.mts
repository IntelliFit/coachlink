// Sends de-identified frames to the configured vision model (getCoachlinkVisionLlm) and
// records the raw reply, token usage and latency. Answers already in the output are reused.
//
// usage (from the main checkout, which holds node_modules and the local config):
//   node node_modules/tsx/dist/cli.mjs <worktree>/scripts/power-analysis-eval/vlm_ask.mts <requests.json> <answers.json> [--concurrency=4]
//
// Keys come only from the normal config bootstrap and are never printed or written.
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

type EvalRequest = { id: string; images: string[]; system: string; prompt: string; maxTokens: number; logprobs?: boolean };
type EvalAnswer = {
  id: string;
  model: string;
  text: string | null;
  error: string | null;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  imageBytes: number;
  firstTokenLogprobs?: Array<{ token: string; logprob: number }> | null;
};

const IMAGE_SIZE_LIMIT = 400_000;
const projectRoot = process.env.COACHLINK_CONFIG_ROOT || process.cwd();
const { bootstrapEnv } = await import(pathToFileURL(path.join(projectRoot, "scripts/config/bootstrap-env.mjs")).href);
await bootstrapEnv({ mode: "development", projectRoot });
const { getCoachlinkVisionLlm } = await import(new URL("../../src/lib/coachlinkLlm.ts", import.meta.url).href);

const [requestsPath, answersPath, ...flags] = process.argv.slice(2);
const concurrencyFlag = flags.find((flag) => flag.startsWith("--concurrency="));
const concurrency = concurrencyFlag ? Number(concurrencyFlag.split("=")[1]) : 4;

const requests: EvalRequest[] = JSON.parse(await fs.readFile(requestsPath, "utf8"));
const previous: EvalAnswer[] = await fs
  .readFile(answersPath, "utf8")
  .then((text) => JSON.parse(text))
  .catch(() => []);
const answers = new Map(previous.filter((item) => !item.error).map((item) => [item.id, item]));
const pending = requests.filter((request) => !answers.has(request.id));
const { client, model } = getCoachlinkVisionLlm();
console.log(`model=${model} pending=${pending.length} reused=${answers.size}`);

async function ask(request: EvalRequest): Promise<EvalAnswer> {
  const buffers = await Promise.all(request.images.map((image) => fs.readFile(image)));
  const oversized = buffers.find((buffer) => buffer.length > IMAGE_SIZE_LIMIT);
  if (oversized) throw new Error(`image too large for an evaluation frame: ${oversized.length}`);
  const body = {
    model,
    temperature: 0,
    max_tokens: request.maxTokens,
    ...(/^qwen/i.test(model) ? { enable_thinking: false } : {}),
    ...(request.logprobs ? { logprobs: true, top_logprobs: 5 } : {}),
    messages: [
      { role: "system", content: request.system },
      {
        role: "user",
        content: [
          ...buffers.map((buffer) => ({
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${buffer.toString("base64")}` },
          })),
          { type: "text", text: request.prompt },
        ],
      },
    ],
  };
  const started = Date.now();
  const imageBytes = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
  try {
    const completion: any = await client.chat.completions.create(body as never);
    return {
      id: request.id,
      model,
      text: completion.choices?.[0]?.message?.content ?? null,
      error: null,
      latencyMs: Date.now() - started,
      promptTokens: completion.usage?.prompt_tokens ?? null,
      completionTokens: completion.usage?.completion_tokens ?? null,
      imageBytes,
      ...(request.logprobs
        ? {
            firstTokenLogprobs:
              completion.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs?.map((item: any) => ({
                token: item.token,
                logprob: item.logprob,
              })) ?? null,
          }
        : {}),
    };
  } catch (error) {
    return {
      id: request.id,
      model,
      text: null,
      error: error instanceof Error ? error.message : "unknown error",
      latencyMs: Date.now() - started,
      promptTokens: null,
      completionTokens: null,
      imageBytes,
    };
  }
}

let next = 0;
let done = 0;
async function worker() {
  while (next < pending.length) {
    const request = pending[next++];
    const answer = await ask(request);
    answers.set(answer.id, answer);
    done += 1;
    if (done % 10 === 0 || done === pending.length) console.log(`${done}/${pending.length}`);
    await fs.writeFile(answersPath, JSON.stringify([...answers.values()], null, 2));
  }
}
await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
const all = [...answers.values()];
console.log(`answers=${all.length} errors=${all.filter((item) => item.error).length}`);
