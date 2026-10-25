import {
  isCustomPowerAnalysisMode,
  normalizePowerAnalysisMode,
  normalizePowerAnalysisSubject,
  parsePowerAnalysisCustomActionName,
  parsePowerAnalysisLoadInput,
  type PowerAnalysisMode,
  type PowerAnalysisSubject,
} from "@coachlink/core/src/powerAnalysisModes";
import {
  normalizePowerAnalysisOverlayLanguage,
  type PowerAnalysisOverlayLanguage,
} from "@/lib/powerAnalysisEntitlements";

/**
 * Analysis settings that only matter when the worker runs, so they can change
 * between upload and enqueue. Quality is not here: it decides how the video is
 * compressed before upload and is fixed once the upload starts.
 */
export interface PowerAnalysisSettings {
  mode: PowerAnalysisMode;
  heightCm: number;
  weightKg: number;
  externalLoadKg: number;
  plateDiameterCm: number | null;
  customActionName: string | null;
  overlayLanguage: PowerAnalysisOverlayLanguage;
  subject: PowerAnalysisSubject;
}

export type PowerAnalysisSettingsResult =
  | { ok: true; settings: PowerAnalysisSettings }
  | { ok: false; message: string };

const HEIGHT_RANGE_CM = { min: 100, max: 250 };
const WEIGHT_RANGE_KG = { min: 30, max: 250 };

function numberInRange(value: unknown, range: { min: number; max: number }): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < range.min || n > range.max) return null;
  return n;
}

export function parsePowerAnalysisSettings(body: unknown): PowerAnalysisSettingsResult {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const mode = normalizePowerAnalysisMode(input.mode);
  const heightCm = numberInRange(input.heightCm, HEIGHT_RANGE_CM);
  const weightKg = numberInRange(input.weightKg, WEIGHT_RANGE_KG);
  if (!mode || heightCm === null || weightKg === null) {
    return { ok: false, message: "请填写有效的动作类型、身高和体重" };
  }

  const load = parsePowerAnalysisLoadInput(mode, input.externalLoadKg, input.plateDiameterCm);
  if (!load.ok) return { ok: false, message: load.message };

  let customActionName: string | null = null;
  if (isCustomPowerAnalysisMode(mode)) {
    const parsedName = parsePowerAnalysisCustomActionName(input.customActionName);
    if (parsedName.ok === false) return { ok: false, message: parsedName.message };
    customActionName = parsedName.name;
  }

  return {
    ok: true,
    settings: {
      mode,
      heightCm,
      weightKg,
      externalLoadKg: load.externalLoadKg,
      plateDiameterCm: load.plateDiameterCm,
      customActionName,
      overlayLanguage: normalizePowerAnalysisOverlayLanguage(input.overlayLanguage),
      subject: normalizePowerAnalysisSubject(input.subject),
    },
  };
}

/** True when a request body carries settings (older clients enqueue with an empty body). */
export function hasPowerAnalysisSettings(body: unknown): boolean {
  return Boolean(body && typeof body === "object" && "mode" in (body as Record<string, unknown>));
}

/** Job metadata keys written from settings; everything else in metadata is kept. */
export function settingsToJobMetadata(
  settings: PowerAnalysisSettings,
  metadata: Record<string, unknown> = {},
): Record<string, unknown> {
  const { plate_diameter_cm: _plate, custom_action_name: _name, ...rest } = metadata;
  return {
    ...rest,
    external_load_kg: settings.externalLoadKg,
    effective_weight_kg: settings.plateDiameterCm === null
      ? settings.weightKg + settings.externalLoadKg
      : settings.externalLoadKg,
    ...(settings.plateDiameterCm === null ? {} : { plate_diameter_cm: settings.plateDiameterCm }),
    ...(settings.customActionName === null ? {} : { custom_action_name: settings.customActionName }),
    subject: settings.subject,
    overlay_language: settings.overlayLanguage,
  };
}
