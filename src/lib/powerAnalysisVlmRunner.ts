/**
 * Calls the configured vision model for a finished custom-mode analysis and merges its
 * observations into metrics.assessment. Never throws: any failure becomes one
 * "unavailable" item so the kinematic result is always delivered.
 *
 * Imported by the power-analysis worker through a relative path; no "@/" alias here.
 */
import { getCoachlinkVisionLlm } from "./coachlinkLlm";
import {
  buildCustomVlmMessages,
  buildVlmChecks,
  collectMeasuredAngles,
  collectMeasuredNumbers,
  mergeVlmChecks,
  parseCustomVlmResponse,
  parseKeyframeManifest,
  vlmUnavailableCheck,
  type KeyframeImage,
} from "./powerAnalysisVlm";

type AnyRecord = Record<string, any>;

export const KEYFRAME_MANIFEST_FILE = "keyframes.json";

export interface CustomVlmParams {
  metrics: AnyRecord;
  actionName: string;
  /** Reads a file the analyzer wrote into the keyframes folder (names are validated first). */
  readKeyframeFile: (name: string) => Promise<Buffer>;
  enabled: boolean;
  log?: (message: string) => void;
}

export function isCustomVlmEnabled(env: Record<string, string | undefined>): boolean {
  return String(env.POWER_ANALYSIS_CUSTOM_VLM ?? "on").trim().toLowerCase() !== "off";
}

async function readManifest(params: CustomVlmParams) {
  try {
    const text = (await params.readKeyframeFile(KEYFRAME_MANIFEST_FILE)).toString("utf8");
    return parseKeyframeManifest(JSON.parse(text));
  } catch {
    return null;
  }
}

export async function addCustomVlmObservations(params: CustomVlmParams): Promise<AnyRecord> {
  const { metrics, actionName, log } = params;
  if (!metrics?.assessment || !(Number(metrics.repCount) > 0)) return metrics;
  if (!params.enabled) {
    return mergeVlmChecks(metrics, [vlmUnavailableCheck("AI 观察暂未开启")]);
  }
  const manifest = await readManifest(params);
  if (!manifest) {
    return mergeVlmChecks(metrics, [vlmUnavailableCheck("没有可用的关键帧（人物没有被稳定识别），AI 观察已跳过")]);
  }
  try {
    const images: KeyframeImage[] = await Promise.all(
      manifest.frames.map(async (entry) => ({
        entry,
        dataUrl: `data:image/jpeg;base64,${(await params.readKeyframeFile(entry.file)).toString("base64")}`,
      })),
    );
    const { client, model } = getCoachlinkVisionLlm();
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 900,
      messages: buildCustomVlmMessages(metrics, actionName, images, manifest),
    });
    const text = completion.choices?.[0]?.message?.content ?? "";
    const allowed = collectMeasuredNumbers(metrics, manifest, actionName);
    const parsed = parseCustomVlmResponse(
      String(text),
      allowed,
      Number(metrics.repCount) || 0,
      metrics.custom?.mainJointZh,
      collectMeasuredAngles(metrics, manifest),
    );
    if (!parsed) {
      log?.("[power-analysis/vlm] reply was not valid JSON");
      return mergeVlmChecks(metrics, [vlmUnavailableCheck("AI 观察这次没有返回有效结果，可稍后重新分析")]);
    }
    log?.(`[power-analysis/vlm] ${model}: ${parsed.observations.length} observations from ${images.length} keyframes`);
    return mergeVlmChecks(metrics, buildVlmChecks(parsed, actionName, metrics));
  } catch (error) {
    log?.(`[power-analysis/vlm] failed: ${error instanceof Error ? error.message : String(error)}`);
    return mergeVlmChecks(metrics, [vlmUnavailableCheck("AI 观察暂时不可用，测量结果不受影响")]);
  }
}
