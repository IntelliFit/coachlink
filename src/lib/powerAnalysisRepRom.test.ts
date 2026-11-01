import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({ serviceRoleSupabase: {} }));

import { normalizeMetrics } from "@/app/api/toolbox/power-analysis/_helpers";
import {
  normalizeRepRom,
  normalizeRomSummary,
  repRomDetail,
  repRomGradeLabel,
  romSummaryText,
} from "@coachlink/core/src/powerAnalysisRepRom";

const FULL = {
  grade: "full",
  bottomElbowDeg: 172.4,
  topElbowDeg: 36.2,
  clearanceMarginCm: 2.1,
  unreadable: false,
  reasonZh: "",
};

describe("normalizeRepRom", () => {
  it("drops values that are not a grade", () => {
    expect(normalizeRepRom(undefined)).toBeUndefined();
    expect(normalizeRepRom({ grade: "maybe" })).toBeUndefined();
  });

  it("keeps an unreadable end as null instead of zero", () => {
    const rom = normalizeRepRom({ grade: "partial", bottomElbowDeg: null, clearanceMarginCm: "", unreadable: true });
    expect(rom?.bottomElbowDeg).toBeNull();
    expect(rom?.clearanceMarginCm).toBeNull();
    expect(rom?.unreadable).toBe(true);
  });
});

describe("repRomDetail", () => {
  it("shows the bottom angle and the margin for a pull-up", () => {
    expect(repRomDetail(normalizeRepRom(FULL)!, "pullup")).toBe("底部肘角 172° · 过杠余量 +2 cm");
    expect(repRomGradeLabel(normalizeRepRom(FULL)!)).toBe("完整");
  });

  it("adds the lockout angle a muscle-up is graded on", () => {
    expect(repRomDetail(normalizeRepRom({ ...FULL, topElbowDeg: 173.6 })!, "muscleup")).toBe(
      "底部肘角 172° · 顶部肘角 174° · 过杠余量 +2 cm",
    );
  });

  it("gives a shortfall a minus sign and says when an end could not be read", () => {
    const rom = normalizeRepRom({ grade: "partial", bottomElbowDeg: null, clearanceMarginCm: -5.4, unreadable: true })!;
    expect(repRomGradeLabel(rom)).toBe("半程");
    expect(repRomDetail(rom, "pullup")).toBe("底部肘角看不清 · 过杠余量 −5 cm");
  });
});

describe("romSummaryText", () => {
  it("counts full and partial reps and calls out the unreadable ones", () => {
    expect(romSummaryText(normalizeRomSummary({ fullReps: 2, partialReps: 5, unreadableReps: 0 })!)).toBe("完整 2 次 · 半程 5 次");
    expect(romSummaryText(normalizeRomSummary({ fullReps: 0, partialReps: 3, unreadableReps: 3 })!)).toBe(
      "完整 0 次 · 半程 3 次（其中 3 次看不清）",
    );
  });

  it("ignores a missing summary", () => {
    expect(normalizeRomSummary(null)).toBeUndefined();
    expect(normalizeRomSummary({ fullReps: 1 })).toBeUndefined();
  });
});

describe("normalizeMetrics", () => {
  const metrics = {
    mode: "pullup",
    summary: {},
    romSummary: { fullReps: 1, partialReps: 0, unreadableReps: 0 },
    reps: [{ repIndex: 1, displacementM: 0.5, rom: FULL }],
  };

  it("passes the grade through to web and mini-program", () => {
    const normalized = normalizeMetrics(metrics);
    expect(normalized?.reps[0].rom).toEqual(FULL);
    expect(normalized?.romSummary).toEqual({ fullReps: 1, partialReps: 0, unreadableReps: 0 });
  });

  it("leaves results from older analyzers without a grade", () => {
    const normalized = normalizeMetrics({ mode: "pullup", summary: {}, reps: [{ repIndex: 1 }] });
    expect(normalized?.reps[0]).not.toHaveProperty("rom");
    expect(normalized).not.toHaveProperty("romSummary");
  });
});
