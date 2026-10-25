import { describe, expect, it } from "vitest";

import {
  buildCustomVlmFacts,
  buildCustomVlmMessages,
  collectMeasuredAngles,
  collectMeasuredNumbers,
  parseCustomVlmResponse,
  parseKeyframeManifest,
  stripMislabeledAngles,
  stripUnmeasuredNumbers,
} from "./powerAnalysisVlm";

/** Raw analyzer output for a bench press run as custom: shoulder is the main joint. */
const metrics = () => ({
  mode: "custom",
  repCount: 2,
  mass: { externalLoadKg: 110 },
  reps: [1, 2].map((repIndex) => ({
    repIndex,
    displacementM: 0.42,
    phase1TimeS: 1.1,
    phase2TimeS: 0.9,
    holdTimeS: 0.3,
    jointMinDeg: 18.4,
    jointMaxDeg: 66.2,
    startTimeS: repIndex * 3,
    endTimeS: repIndex * 3 + 2.3,
  })),
  custom: {
    primaryPartZh: "手腕",
    axis: "vertical",
    phaseLabelsZh: ["下降", "上升"],
    mainJoint: "shoulder",
    mainJointZh: "肩关节",
  },
  assessment: { viewLabelZh: "斜侧面", checks: [] },
});

/** Version 2 manifest: angles per keyframe and a resampled curve per rep. */
const manifestV2 = () => ({
  version: 2,
  faceBlurred: true,
  audio: false,
  mainJoint: "shoulder",
  frames: [
    { file: "rep1_start.jpg", repIndex: 1, phase: "start", phaseZh: "起始", timeS: 3.0, anglesDeg: { shoulder: 66, elbow: 171, trunk: 84 } },
    { file: "rep1_far.jpg", repIndex: 1, phase: "far", phaseZh: "最低点", timeS: 4.1, anglesDeg: { shoulder: 19, elbow: 88, knee: 102, trunk: 85 } },
  ],
  repAngles: [
    { repIndex: 1, anglesDeg: { shoulder: [66, 58, 40, 22, 19, 30, 52, 65], trunk: [84, 84, 85, 85, 85, 85, 84, 84] } },
    { repIndex: 2, anglesDeg: { shoulder: [65, 57, 41, 23, 18, 29, 50, 66] } },
  ],
});

describe("keyframe angles in the manifest", () => {
  it("keeps whitelisted angles in range, rounded to whole degrees", () => {
    const raw = manifestV2();
    raw.frames[0].anglesDeg = { shoulder: 66.4, elbow: 171, trunk: 84, wrist: 12, knee: 240, hip: "abc" } as any;
    const parsed = parseKeyframeManifest(raw)!;
    expect(parsed.frames[0].anglesDeg).toEqual({ shoulder: 66, elbow: 171, trunk: 84 });
    expect(parsed.repAngles.map((curve) => curve.repIndex)).toEqual([1, 2]);
    expect(parsed.repAngles[0].anglesDeg.trunk).toHaveLength(8);
  });

  it("drops curves with bad points and reps without any curve", () => {
    const raw = manifestV2();
    raw.repAngles[0].anglesDeg.trunk = [84, null, 85] as any;
    raw.repAngles.push({ repIndex: 0, anglesDeg: { shoulder: [1, 2] } }, { repIndex: 3, anglesDeg: {} } as any);
    const parsed = parseKeyframeManifest(raw)!;
    expect(parsed.repAngles[0].anglesDeg).toEqual({ shoulder: [66, 58, 40, 22, 19, 30, 52, 65] });
    expect(parsed.repAngles.map((curve) => curve.repIndex)).toEqual([1, 2]);
  });

  it("reads a version 1 manifest without angles", () => {
    const raw = manifestV2();
    const v1 = { version: 1, faceBlurred: true, audio: false, frames: raw.frames.map(({ anglesDeg, ...rest }) => rest) };
    const parsed = parseKeyframeManifest(v1)!;
    expect(parsed.frames.every((frame) => Object.keys(frame.anglesDeg ?? {}).length === 0)).toBe(true);
    expect(parsed.repAngles).toEqual([]);
  });
});

describe("angle facts for the vision model", () => {
  it("labels keyframe angles by rep and phase with joint names", () => {
    const facts = buildCustomVlmFacts(metrics(), parseKeyframeManifest(manifestV2()));
    expect(facts.关键帧角度).toEqual({
      "第1次·起始": { 肩关节: 66, 肘关节: 171, 躯干倾角: 84 },
      "第1次·最低点": { 肩关节: 19, 肘关节: 88, 膝关节: 102, 躯干倾角: 85 },
    });
  });

  it("adds each rep's curves next to its summary", () => {
    const facts = buildCustomVlmFacts(metrics(), parseKeyframeManifest(manifestV2()));
    expect(facts.每次[0]).toMatchObject({ 次序: 1, 肩关节序列: [66, 58, 40, 22, 19, 30, 52, 65], 躯干倾角序列: [84, 84, 85, 85, 85, 85, 84, 84] });
    expect(facts.每次[1]).toMatchObject({ 次序: 2, 肩关节序列: [65, 57, 41, 23, 18, 29, 50, 66] });
    expect(facts.每次[1]).not.toHaveProperty("躯干倾角序列");
  });

  it("leaves the facts unchanged without a manifest", () => {
    const facts = buildCustomVlmFacts(metrics());
    expect(facts).not.toHaveProperty("关键帧角度");
    expect(Object.keys(facts.每次[0])).not.toContain("肩关节序列");
  });

  it("stays compact and explains the angle labels in the prompt", () => {
    const manifest = parseKeyframeManifest(manifestV2())!;
    const [system, user] = buildCustomVlmMessages(metrics(), "卧推", manifest.frames.map((entry) => ({ entry, dataUrl: "data:image/jpeg;base64,AAA" })), manifest);
    expect(system.content).toContain("躯干");
    const facts = (user.content as any[])[0].text as string;
    expect(facts).toContain('"肩关节序列":[66,58,40,22,19,30,52,65]');
    expect(facts).not.toMatch(/\d\.\d{2,}/);
  });
});

describe("measured numbers and angles", () => {
  it("lets every new angle through the invented-number filter", () => {
    const allowed = collectMeasuredNumbers(metrics(), parseKeyframeManifest(manifestV2()), "卧推");
    for (const value of [171, 84, 88, 102, 85, 58, 40, 22, 30, 52, 57, 41, 23, 29, 50]) expect(allowed).toContain(value);
    expect(stripUnmeasuredNumbers("最低点肘关节约88°，膝关节约102°。", allowed)).toBe("最低点肘关节约88°，膝关节约102°。");
  });

  it("groups measured angles by joint word", () => {
    const angles = collectMeasuredAngles(metrics(), parseKeyframeManifest(manifestV2()));
    expect(angles.肩).toEqual(expect.arrayContaining([18.4, 66.2, 66, 19, 40, 18]));
    expect(angles.肘).toEqual([171, 88]);
    expect(angles.膝).toEqual([102]);
    expect(angles.躯干).toEqual(expect.arrayContaining([84, 85]));
    expect(angles.髋).toBeUndefined();
  });

  it("keeps an angle only on the joint it was measured at", () => {
    const angles = collectMeasuredAngles(metrics(), parseKeyframeManifest(manifestV2()));
    // The bench mistake: a shoulder value written as an elbow angle.
    expect(stripMislabeledAngles("最低点肘关节约19°，杠铃触胸。", "肩关节", angles)).toBe("杠铃触胸。");
    expect(stripMislabeledAngles("最低点肘关节约88°，肩关节约19°", "肩关节", angles)).toBe("最低点肘关节约88°，肩关节约19°");
    expect(stripMislabeledAngles("躯干倾角约85°，基本平躺", "肩关节", angles)).toBe("躯干倾角约85°，基本平躺");
    expect(stripMislabeledAngles("髋关节约88°，臀部未离凳", "肩关节", angles)).toBe("臀部未离凳");
  });

  it("drops unmeasured joints in the parsed reply", () => {
    const manifest = parseKeyframeManifest(manifestV2());
    const reply = JSON.stringify({
      recognizedAction: "卧推",
      matchesUserLabel: true,
      observations: [{ level: "info", title: "触胸", detail: "第1次最低点肘关节约19°，杠铃触胸", reps: [1] }],
      cameraNote: "",
    });
    const parsed = parseCustomVlmResponse(
      reply,
      collectMeasuredNumbers(metrics(), manifest),
      2,
      "肩关节",
      collectMeasuredAngles(metrics(), manifest),
    )!;
    expect(parsed.observations[0].detail).toBe("杠铃触胸");
  });
});
