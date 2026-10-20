import type {
  PowerAnalysisAssessment,
  PowerAnalysisCheck,
  PowerAnalysisCheckStatus,
  PowerAnalysisMeasurement,
  PowerAnalysisMetrics,
} from "@/app/api/toolbox/power-analysis/types";
import { getPowerAnalysisModeLabel, isBarbellPowerAnalysisMode } from "@coachlink/core/src/powerAnalysisModes";

const CHECK_STATUSES: PowerAnalysisCheckStatus[] = ["issue", "warn", "info", "good", "unavailable"];
const VIEWS = ["front", "side", "oblique", "unknown"] as const;
const MEASUREMENT_TARGETS = ["body_anchor", "barbell_plate", "barbell_body_proxy"] as const;
const SCALE_SOURCES = ["plate_diameter", "body_height", "torso_segment", "frame_fallback"] as const;
const CONFIDENCES = ["high", "medium", "low"] as const;
const MAX_CHECKS = 20;

function asObject(value: unknown): Record<string, any> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : null;
}

function finiteOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function numberList(value: unknown, limit: number): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, limit)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function normalizeCheck(value: unknown): PowerAnalysisCheck | null {
  const raw = asObject(value);
  if (!raw?.code || !raw?.titleZh) return null;
  return {
    code: String(raw.code).slice(0, 80),
    titleZh: String(raw.titleZh).slice(0, 40),
    status: pick(raw.status, CHECK_STATUSES, "unavailable"),
    detailZh: String(raw.detailZh ?? "").slice(0, 300),
    repIndexes: numberList(raw.repIndexes, 50),
    timesS: numberList(raw.timesS, 50),
    value: finiteOrNull(raw.value),
    unit: String(raw.unit ?? "").slice(0, 8),
  };
}

export function normalizePowerAnalysisAssessment(value: unknown): PowerAnalysisAssessment | undefined {
  const raw = asObject(value);
  if (!raw || !Array.isArray(raw.checks)) return undefined;
  const checks = raw.checks
    .slice(0, MAX_CHECKS)
    .map(normalizeCheck)
    .filter((item: PowerAnalysisCheck | null): item is PowerAnalysisCheck => item !== null);
  const counts = Object.fromEntries(
    CHECK_STATUSES.map((status) => [status, checks.filter((check) => check.status === status).length]),
  ) as Record<PowerAnalysisCheckStatus, number>;
  return {
    version: String(raw.version ?? ""),
    view: pick(raw.view, VIEWS, "unknown"),
    viewLabelZh: String(raw.viewLabelZh ?? "未识别"),
    recommendedViewZh: String(raw.recommendedViewZh ?? ""),
    counts,
    checks,
  };
}

export function normalizePowerAnalysisMeasurement(value: unknown): PowerAnalysisMeasurement | undefined {
  const raw = asObject(value);
  if (!raw?.target) return undefined;
  const plateDiameterCm = finiteOrNull(raw.plateDiameterCm);
  const trackingCoverage = finiteOrNull(raw.trackingCoverage);
  return {
    target: pick(raw.target, MEASUREMENT_TARGETS, "body_anchor"),
    anchorLabelZh: String(raw.anchorLabelZh ?? ""),
    scaleSource: pick(raw.scaleSource, SCALE_SOURCES, "body_height"),
    confidence: pick(raw.confidence, CONFIDENCES, "low"),
    ...(plateDiameterCm === null ? {} : { plateDiameterCm }),
    ...(trackingCoverage === null ? {} : { trackingCoverage }),
    warningsZh: Array.isArray(raw.warningsZh) ? raw.warningsZh.slice(0, 5).map(String) : [],
  };
}

export function describeMeasurementZh(measurement: PowerAnalysisMeasurement | undefined): string {
  if (!measurement) return "";
  if (measurement.target === "barbell_plate") {
    const coverage = measurement.trackingCoverage === undefined
      ? ""
      : `，追踪覆盖 ${Math.round(measurement.trackingCoverage * 100)}%`;
    return `测量对象：杠铃片中心（按直径 ${measurement.plateDiameterCm ?? 45} cm 换算${coverage}）`;
  }
  const scaleText = SCALE_SOURCE_ZH[measurement.scaleSource];
  if (measurement.target === "barbell_body_proxy") {
    return `测量对象：${measurement.anchorLabelZh || "身体"}位置估算（没有识别到杠铃片，${scaleText}，误差较大）`;
  }
  return `测量对象：${measurement.anchorLabelZh || "身体"}位置（${scaleText}）`;
}

const SCALE_SOURCE_ZH: Record<PowerAnalysisMeasurement["scaleSource"], string> = {
  plate_diameter: "按杠铃片直径换算",
  body_height: "按身高换算",
  torso_segment: "按躯干长度估算",
  frame_fallback: "人物没有完整入镜，按画面高度粗略估算",
};

function formatCheckForPrompt(check: PowerAnalysisCheck): string {
  const statusZh: Record<PowerAnalysisCheckStatus, string> = {
    issue: "明显问题",
    warn: "需注意",
    info: "信息",
    good: "良好",
    unavailable: "无法评估",
  };
  return `- [${statusZh[check.status]}] ${check.titleZh}：${check.detailZh}`;
}

/** Plain-text context for the LLM summary: only measured or explicitly abstained items. */
export function buildPowerAnalysisPromptContext(metrics: PowerAnalysisMetrics): string {
  const lines = [`动作类型: ${getPowerAnalysisModeLabel(metrics.mode)}`];
  const barbell = isBarbellPowerAnalysisMode(metrics.mode);
  if (barbell) {
    lines.push(`杠铃总重: ${metrics.mass?.externalLoadKg ?? 0} kg（功率只计算杠铃被抬起的部分）`);
  }
  const measurement = describeMeasurementZh(metrics.measurement);
  if (measurement) lines.push(measurement);
  const assessment = metrics.assessment;
  if (assessment) {
    lines.push(`拍摄机位: ${assessment.viewLabelZh}（推荐 ${assessment.recommendedViewZh}）`);
    lines.push("姿态检查结果:");
    lines.push(...assessment.checks.map(formatCheckForPrompt));
  }
  const { timeSeries: _omit, ...compact } = metrics;
  lines.push(`结构化指标 JSON: ${JSON.stringify({ ...compact, assessment: undefined })}`);
  return lines.join("\n");
}

export function buildFallbackAssessmentLines(metrics: PowerAnalysisMetrics): string[] {
  const checks = metrics.assessment?.checks ?? [];
  const flagged = checks.filter((check) => check.status === "issue" || check.status === "warn");
  const lines: string[] = [];
  if (flagged.length > 0) {
    lines.push(`动作评估：${flagged.map((check) => `${check.titleZh}，${check.detailZh}`).join("；")}。`);
  } else if (checks.some((check) => check.status === "good")) {
    lines.push("动作评估：已评估的项目都在正常范围内。");
  }
  const unavailable = checks.filter((check) => check.status === "unavailable");
  if (unavailable.length > 0) {
    lines.push(`以下项目这次无法评估：${unavailable.map((check) => check.titleZh).join("、")}。`);
  }
  return lines;
}
