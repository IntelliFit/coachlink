"""Assembles the per-movement posture assessment returned with the metrics."""
import sys
from typing import Any, Callable, Dict, List

import numpy as np

import barbell_checks as bc
import movement_checks as mc
import pose_features as pf
from movement_rules import RECOMMENDED_VIEW_ZH, STATUS_ORDER, RuleContext, make_check, rep_list_zh

ASSESSMENT_VERSION = "1.0.0"


def check_rom_consistency(ctx: RuleContext) -> Dict[str, Any]:
    code = f"{ctx.mode}.rom_consistency"
    if len(ctx.reps) < 3:
        return make_check(code, "每次幅度一致", "unavailable", "少于 3 次动作，无法比较幅度")
    displacements = np.array([float(rep.get("displacementM") or 0) for rep in ctx.reps])
    median = float(np.median(displacements))
    short = [rep for rep, value in zip(ctx.reps, displacements) if median > 0 and value < 0.8 * median]
    if not short:
        return make_check(code, "每次幅度一致", "good", f"每次动作幅度接近（中位约 {median * 100:.0f} cm）", value=median * 100, unit="cm")
    for rep in short:
        ctx.add_event(int(rep.get("startFrame") or 0), code, "幅度变小", "Partial rep", "warn", None)
    return make_check(
        code,
        "每次幅度一致",
        "warn",
        f"第 {rep_list_zh([rep['repIndex'] for rep in short])} 次幅度明显小于其他次（不到中位幅度的 80%）",
        [rep["repIndex"] for rep in short],
        [ctx.time_s(int(rep.get("startFrame") or 0)) for rep in short],
        median * 100,
        "cm",
    )


CHECKS: Dict[str, List[Callable[[RuleContext], Dict[str, Any]]]] = {
    "pullup": [
        mc.check_bottom_extension,
        mc.check_chin_over_bar,
        lambda ctx: mc.check_kipping(ctx, cap_warn=False),
        mc.check_shoulder_symmetry,
        check_rom_consistency,
    ],
    "muscleup": [
        mc.check_bottom_extension,
        lambda ctx: mc.check_lockout(ctx, "elbow", 150, 130, need_side=False),
        lambda ctx: mc.check_kipping(ctx, cap_warn=True),
        mc.check_shoulder_symmetry,
        check_rom_consistency,
    ],
    "dip": [
        lambda ctx: mc.check_depth_elbow(ctx, 95, 110),
        lambda ctx: mc.check_lockout(ctx, "elbow", 155, 140, need_side=True),
        mc.check_shoulder_symmetry,
        check_rom_consistency,
    ],
    "pushup": [
        lambda ctx: mc.check_depth_elbow(ctx, 100, 115),
        lambda ctx: mc.check_lockout(ctx, "elbow", 155, 140, need_side=True),
        mc.check_body_line,
        check_rom_consistency,
    ],
    "squat": [
        mc.check_squat_depth,
        lambda ctx: mc.check_trunk_lean(ctx, 50, 65),
        mc.check_knee_valgus,
        mc.check_heel_rise,
        mc.check_hip_shift,
        check_rom_consistency,
    ],
    "back_squat": [
        mc.check_squat_depth,
        lambda ctx: mc.check_trunk_lean(ctx, 55, 70),
        lambda ctx: bc.check_bar_path_drift(ctx, 0.05, 0.10),
        mc.check_knee_valgus,
        mc.check_heel_rise,
        mc.check_hip_shift,
        check_rom_consistency,
    ],
    "bench_press": [
        bc.check_bench_pause,
        lambda ctx: mc.check_lockout(ctx, "elbow", 155, 140, need_side=True),
        bc.check_bench_hips,
        bc.check_bench_bar_path,
        lambda ctx: bc.bench_symmetry_unavailable(),
        check_rom_consistency,
    ],
    "deadlift": [
        bc.check_deadlift_hips_first,
        lambda ctx: mc.check_lockout(ctx, "hip", 165, 150, need_side=True),
        lambda ctx: bc.check_bar_path_drift(ctx, 0.05, 0.10),
        bc.check_deadlift_hitch,
        bc.spine_unavailable,
        check_rom_consistency,
    ],
}


def build_assessment(ctx: RuleContext) -> Dict[str, Any]:
    checks: List[Dict[str, Any]] = []
    if ctx.reps:
        for check in CHECKS.get(ctx.mode, []):
            try:
                checks.append(check(ctx))
            except Exception as exc:  # one broken rule must not fail the whole analysis
                print(f"[assessment] rule failed: {exc!r}", file=sys.stderr, flush=True)
                checks.append(make_check(f"{ctx.mode}.error", "评估异常", "unavailable", "这一项暂时无法计算，已跳过"))
    checks.sort(key=lambda item: STATUS_ORDER.get(item["status"], 9))
    counts = {status: 0 for status in STATUS_ORDER}
    for item in checks:
        counts[item["status"]] = counts.get(item["status"], 0) + 1
    return {
        "version": ASSESSMENT_VERSION,
        "view": ctx.view,
        "viewLabelZh": pf.VIEW_LABELS_ZH.get(ctx.view, "未识别"),
        "recommendedViewZh": RECOMMENDED_VIEW_ZH.get(ctx.mode, "侧面"),
        "counts": counts,
        "checks": checks,
    }
