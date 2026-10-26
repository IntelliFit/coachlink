import { describe, expect, it } from "vitest";
import {
  hasPowerAnalysisSettings,
  parsePowerAnalysisSettings,
  settingsToJobMetadata,
} from "./powerAnalysisSettings";

describe("parsePowerAnalysisSettings", () => {
  it("parses a bodyweight movement with extra load", () => {
    const result = parsePowerAnalysisSettings({
      mode: "pullup",
      heightCm: 180,
      weightKg: 70,
      externalLoadKg: 10,
      overlayLanguage: "en",
    });
    expect(result).toEqual({
      ok: true,
      settings: {
        mode: "pullup",
        heightCm: 180,
        weightKg: 70,
        externalLoadKg: 10,
        plateDiameterCm: null,
        customActionName: null,
        overlayLanguage: "en",
        subject: "self",
      },
    });
  });

  it("rejects missing height or weight", () => {
    expect(parsePowerAnalysisSettings({ mode: "pullup", heightCm: 180 })).toEqual({
      ok: false,
      message: "请填写有效的动作类型、身高和体重",
    });
  });

  it("requires a name for the custom mode", () => {
    const result = parsePowerAnalysisSettings({ mode: "custom", heightCm: 180, weightKg: 70 });
    expect(result.ok).toBe(false);
  });
});

describe("hasPowerAnalysisSettings", () => {
  it("treats an empty or missing body as no settings", () => {
    expect(hasPowerAnalysisSettings(null)).toBe(false);
    expect(hasPowerAnalysisSettings({})).toBe(false);
    expect(hasPowerAnalysisSettings({ mode: "pullup" })).toBe(true);
  });
});

describe("settingsToJobMetadata", () => {
  it("keeps unrelated metadata and drops stale barbell and custom fields", () => {
    const parsed = parsePowerAnalysisSettings({ mode: "pullup", heightCm: 180, weightKg: 70 });
    if (!parsed.ok) throw new Error(parsed.message);
    const previous = {
      quality: "original",
      content_type: "video/mp4",
      plate_diameter_cm: 45,
      custom_action_name: "壶铃摆",
      external_load_kg: 100,
    };
    const next = settingsToJobMetadata(parsed.settings, previous);
    expect(next).toEqual({
      quality: "original",
      content_type: "video/mp4",
      external_load_kg: 0,
      effective_weight_kg: 70,
      subject: "self",
      overlay_language: "zh",
    });
    expect(previous.plate_diameter_cm).toBe(45);
  });
});
