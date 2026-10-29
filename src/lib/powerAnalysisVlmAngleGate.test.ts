import { describe, expect, it } from "vitest";

import {
  buildCustomVlmFacts,
  buildCustomVlmMessages,
  collectMeasuredAngles,
  collectMeasuredNumbers,
  parseCustomVlmResponse,
  parseKeyframeManifest,
} from "./powerAnalysisVlm";

/** Bench press filmed from the head side: elbow and shoulder are out of the image plane. */
const metrics = (unmeasurableAngles: unknown = ["elbow", "shoulder"]) => ({
  mode: "custom",
  repCount: 2,
  reps: [1, 2].map((repIndex) => ({ repIndex, displacementM: 0.42, phase1TimeS: 1.1, phase2TimeS: 0.9, holdTimeS: 0.3 })),
  custom: { primaryPartZh: "手腕", axis: "vertical", phaseLabelsZh: ["下降", "上升"], mainJoint: null, mainJointZh: null, unmeasurableAngles },
  assessment: { viewLabelZh: "斜侧面", checks: [] },
});

/** A stale manifest that still carries an elbow reading must not let it through. */
const manifest = () =>
  parseKeyframeManifest({
    version: 2,
    faceBlurred: true,
    audio: false,
    frames: [
      { file: "rep1_far.jpg", repIndex: 1, phase: "far", phaseZh: "最低点", timeS: 1.5, anglesDeg: { elbow: 33, knee: 159, trunk: 88 } },
    ],
    repAngles: [],
  });

describe("angles the camera position cannot measure", () => {
  it("are named in the facts and explained in the prompt", () => {
    const facts = buildCustomVlmFacts(metrics(), manifest());
    expect(facts.机位测不准的角度).toEqual(["肘关节", "肩关节"]);
    const [system] = buildCustomVlmMessages(metrics(), "卧推", [], manifest());
    expect(system.content).toContain("机位测不准的角度");
    expect(system.content).toContain("无法评估");
  });

  it("are left out of the facts when everything is measurable or the list is malformed", () => {
    expect(buildCustomVlmFacts(metrics([]), manifest())).not.toHaveProperty("机位测不准的角度");
    expect(buildCustomVlmFacts(metrics("elbow"), manifest())).not.toHaveProperty("机位测不准的角度");
    expect(buildCustomVlmFacts(metrics(["wrist", "trunk"]), manifest()).机位测不准的角度).toEqual(["躯干倾角"]);
  });

  it("never count as measured, even if a keyframe carries a value", () => {
    const angles = collectMeasuredAngles(metrics(), manifest());
    expect(angles.肘).toBeUndefined();
    expect(angles.膝).toEqual([159]);
    const reply = JSON.stringify({
      recognizedAction: "卧推",
      matchesUserLabel: true,
      observations: [{ level: "info", title: "下放较深", detail: "第1次最低点肘关节约33°，膝关节约159°，杠铃触胸", reps: [1] }],
      cameraNote: "",
    });
    const parsed = parseCustomVlmResponse(reply, collectMeasuredNumbers(metrics(), manifest()), 2, null, angles)!;
    expect(parsed.observations[0].detail).toBe("膝关节约159°，杠铃触胸");
  });
});
