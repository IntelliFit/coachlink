"""Assessment for custom movements built only from generic motion primitives.

No exercise standard is applied, so a check is never "good" or "issue": it is
info (a measured description), warn (a measured irregularity worth a look) or
unavailable (the camera view or landmarks do not support it). Thresholds are
coaching hints for comparing against the user's own reps.
"""
import sys
from typing import Any, Callable, Dict, List, Optional

import numpy as np

import generic_motion as gm
import pose_features as pf
from keyframes import far_label_zh
from movement_rules import RuleContext, make_check, rep_list_zh, unavailable

CUSTOM_ASSESSMENT_VERSION = "1.0.0"
CUSTOM_RECOMMENDED_VIEW_ZH = "正面（看左右）或侧面（看幅度）"
STATUS_ORDER = {"warn": 0, "info": 1, "unavailable": 2}
SHORT_REP_SHARE = 0.75
TEMPO_CV_WARN = 0.35
SLOWDOWN_WARN = 1.4
ASYMMETRY_WARN = 0.2
ONE_SIDED_SHARE = 0.35
SWAY_WARN = 0.35
PATH_SWAY_WARN = 0.35


def _median(values: List[float]) -> float:
    return float(np.median(values)) if values else 0.0


def _seconds(value: float) -> str:
    return f"{value:.1f} 秒"


def check_primary_motion(ctx: RuleContext, motion: gm.GenericMotion) -> Dict[str, Any]:
    signal = motion.signal
    assert signal is not None
    direction = gm.AXIS_LABELS_ZH.get(signal.axis_kind, "斜向")
    return make_check(
        "custom.primary_motion",
        "计次依据",
        "info",
        f"自动选取运动幅度最大的部位：{signal.label_zh}（{direction}方向），按它的往返周期计次，共 {len(ctx.reps)} 次",
    )


def check_rom(ctx: RuleContext, motion: gm.GenericMotion) -> Dict[str, Any]:
    code = "custom.rom"
    roms = [float(rep["displacementM"]) * 100 for rep in ctx.reps]
    median = _median(roms)
    signal = motion.signal
    detail = f"每次{signal.label_zh if signal else '主要部位'}移动中位约 {median:.0f} cm"
    joint_reps = [rep for rep in ctx.reps if "jointMinDeg" in rep]
    if motion.main_joint and joint_reps:
        low = _median([float(rep["jointMinDeg"]) for rep in joint_reps])
        high = _median([float(rep["jointMaxDeg"]) for rep in joint_reps])
        detail += f"，{gm.JOINT_LABELS_ZH[motion.main_joint]}约 {low:.0f}°～{high:.0f}°"
    if len(ctx.reps) < 3:
        return make_check(code, "动作幅度", "info", detail + "（少于 3 次，不比较每次差异）", value=median, unit="cm")
    short = [rep for rep, rom in zip(ctx.reps, roms) if rom < SHORT_REP_SHARE * median]
    if not short:
        return make_check(code, "动作幅度", "info", detail + "，每次幅度接近", value=median, unit="cm")
    part = signal.part if signal else None
    for rep in short:
        ctx.add_event(int(rep["peakFrame"]), code, "幅度变小", "Shorter rep", "warn", part)
    return make_check(
        code,
        "动作幅度",
        "warn",
        f"{detail}；第 {rep_list_zh([rep['repIndex'] for rep in short])} 次明显小于其他次（不到中位幅度的 75%）",
        [rep["repIndex"] for rep in short],
        [ctx.time_s(int(rep["startFrame"])) for rep in short],
        median,
        "cm",
    )


def check_tempo(ctx: RuleContext, motion: gm.GenericMotion) -> Dict[str, Any]:
    code = "custom.tempo"
    first, second = motion.phase_labels_zh
    phase1 = _median([float(rep["phase1TimeS"]) for rep in ctx.reps])
    phase2 = _median([float(rep["phase2TimeS"]) for rep in ctx.reps])
    hold = _median([float(rep["holdTimeS"]) for rep in ctx.reps])
    durations = np.array([float(rep["endFrame"] - rep["startFrame"]) / ctx.fps for rep in ctx.reps])
    detail = f"{first}约 {_seconds(phase1)}，{second}约 {_seconds(phase2)}"
    if hold >= 0.2 and motion.signal is not None:
        detail += f"，{far_label_zh(motion.signal.axis_kind, motion.rest)}停留约 {_seconds(hold)}"
    average = float(durations.mean())
    if len(ctx.reps) < 3:
        return make_check(code, "动作节奏", "info", detail, value=average, unit="s")
    cv = float(durations.std() / average) if average > 0 else 0.0
    early, late = float(durations[:2].mean()), float(durations[-2:].mean())
    if len(ctx.reps) >= 4 and early > 0 and late / early >= SLOWDOWN_WARN:
        slow = ctx.reps[-2:]
        return make_check(
            code,
            "动作节奏",
            "warn",
            f"{detail}；最后两次每次用时约 {_seconds(late)}，比前两次（约 {_seconds(early)}）明显变慢，可能接近疲劳",
            [rep["repIndex"] for rep in slow],
            [ctx.time_s(int(rep["startFrame"])) for rep in slow],
            average,
            "s",
        )
    if cv > TEMPO_CV_WARN:
        return make_check(code, "动作节奏", "warn", f"{detail}；每次用时差别较大，节奏不够稳定", value=average, unit="s")
    return make_check(code, "动作节奏", "info", f"{detail}，每次用时比较一致", value=average, unit="s")


def _rep_excursion(values: np.ndarray, rep: Dict[str, Any]) -> Optional[float]:
    chunk = pf.window_values(values, int(rep["startFrame"]), int(rep["endFrame"]))
    if chunk.size < 3:
        return None
    return float(chunk.max() - chunk.min())


def check_symmetry(ctx: RuleContext, motion: gm.GenericMotion) -> Dict[str, Any]:
    code, title = "custom.symmetry", "左右对称"
    signal = motion.signal
    if signal is None or signal.part == "head":
        return unavailable(code, title, "计次部位在身体中线上，没有左右之分")
    if ctx.view != "front":
        return unavailable(code, title, "需要正面机位才能比较左右")
    sides: Dict[str, List[Optional[float]]] = {}
    for side in ("left", "right"):
        points = gm.part_points(ctx.track, signal.part, side)
        values = gm.project(points, signal.axis, np.nanmean(signal.points, axis=0))
        sides[side] = [_rep_excursion(values, rep) for rep in ctx.reps]
    pairs = [(left, right) for left, right in zip(sides["left"], sides["right"]) if left and right]
    if len(pairs) < max(1, len(ctx.reps) // 2):
        return unavailable(code, title, "左右两侧的关键点不够清楚，无法比较")
    left_total, right_total = sum(item[0] for item in pairs), sum(item[1] for item in pairs)
    if min(left_total, right_total) < ONE_SIDED_SHARE * max(left_total, right_total):
        moving = "左" if left_total > right_total else "右"
        return make_check(code, title, "info", f"主要是{moving}侧在动，看起来是单侧动作，不比较左右")
    gaps = [abs(left - right) / max(left, right) for left, right in pairs]
    gap = _median(gaps) * 100
    if gap / 100 < ASYMMETRY_WARN:
        return make_check(code, title, "info", f"左右{gm.PART_LABELS_ZH[signal.part]}幅度接近（相差约 {gap:.0f}%）", value=gap, unit="%")
    smaller = "左" if left_total < right_total else "右"
    flagged = [rep for rep, (left, right) in zip(ctx.reps, zip(sides["left"], sides["right"]))
               if left and right and abs(left - right) / max(left, right) >= ASYMMETRY_WARN]
    for rep in flagged:
        ctx.add_event(int(rep["peakFrame"]), code, "左右不平衡", "Uneven", "warn", signal.part)
    return make_check(
        code,
        title,
        "warn",
        f"{smaller}侧{gm.PART_LABELS_ZH[signal.part]}幅度比另一侧小约 {gap:.0f}%（按人物自身的左右）",
        [rep["repIndex"] for rep in flagged],
        [ctx.time_s(int(rep["peakFrame"])) for rep in flagged],
        gap,
        "%",
    )


def _trunk_points(track: np.ndarray) -> np.ndarray:
    shoulders = pf.side_points(track, "both", "shoulder", 0.3)
    hips = pf.side_points(track, "both", "hip", 0.3)
    return pf.nan_mean_pair(shoulders, hips)


def check_stability(ctx: RuleContext, motion: gm.GenericMotion) -> Dict[str, Any]:
    code, title = "custom.stability", "身体稳定"
    signal = motion.signal
    assert signal is not None
    if signal.part in gm.TRUNK_PARTS:
        # Whole-body movement: sway is travel across the main direction, relative to the rep's range.
        normal = np.array([-signal.axis[1], signal.axis[0]])
        across = gm.project(signal.points, normal, np.nanmean(signal.points, axis=0))
        label = "动作中横向晃动"
    else:
        trunk = _trunk_points(ctx.track)
        origin = np.nanmean(trunk, axis=0) if np.any(np.isfinite(trunk)) else np.zeros(2)
        across = np.linalg.norm(trunk - origin, axis=1)
        label = "躯干移动"
    ratios, sizes, flagged = [], [], []
    for rep in ctx.reps:
        sway = _rep_excursion(across, rep)
        excursion = float(rep["displacementM"]) / max(ctx.scale, 1e-9)
        if sway is None or excursion <= 0:
            continue
        ratios.append(sway / excursion)
        sizes.append(sway * ctx.scale * 100)
        if sway / excursion > SWAY_WARN:
            flagged.append(rep)
    if not ratios:
        return unavailable(code, title, "躯干关键点不够清楚，无法判断")
    share, size = _median(ratios) * 100, _median(sizes)
    if not flagged or len(flagged) * 2 < len(ratios):
        return make_check(code, title, "info", f"{label}约 {size:.0f} cm（约为主要幅度的 {share:.0f}%），基本稳定", value=size, unit="cm")
    for rep in flagged:
        ctx.add_event(int(rep["peakFrame"]), code, "晃动较大", "Swaying", "warn", None)
    return make_check(
        code,
        title,
        "warn",
        f"{label}约 {size:.0f} cm（约为主要幅度的 {share:.0f}%），借力或晃动较明显",
        [rep["repIndex"] for rep in flagged],
        [ctx.time_s(int(rep["peakFrame"])) for rep in flagged],
        size,
        "cm",
    )


def check_power(ctx: RuleContext, motion: gm.GenericMotion) -> Dict[str, Any]:
    return unavailable("custom.power", "功率", "其他动作无法确定实际承重和发力方向，不计算功率和评级")


def build_custom_assessment(ctx: RuleContext, motion: gm.GenericMotion) -> Dict[str, Any]:
    checks: List[Dict[str, Any]] = []
    if ctx.reps and motion.signal is not None:
        rules: List[Callable[[], Dict[str, Any]]] = [
            lambda: check_primary_motion(ctx, motion),
            lambda: check_rom(ctx, motion),
            lambda: check_tempo(ctx, motion),
            lambda: check_symmetry(ctx, motion),
            lambda: check_stability(ctx, motion),
            lambda: check_power(ctx, motion),
        ]
        for rule in rules:
            try:
                checks.append(rule())
            except Exception as exc:  # one broken rule must not fail the whole analysis
                print(f"[assessment] custom rule failed: {exc!r}", file=sys.stderr, flush=True)
                checks.append(make_check("custom.error", "评估异常", "unavailable", "这一项暂时无法计算，已跳过"))
    checks.sort(key=lambda item: STATUS_ORDER.get(item["status"], 9))
    counts = {status: 0 for status in ("issue", "warn", "info", "good", "unavailable")}
    for item in checks:
        counts[item["status"]] += 1
    return {
        "version": CUSTOM_ASSESSMENT_VERSION,
        "view": ctx.view,
        "viewLabelZh": pf.VIEW_LABELS_ZH.get(ctx.view, "未识别"),
        "recommendedViewZh": CUSTOM_RECOMMENDED_VIEW_ZH,
        "counts": counts,
        "checks": checks,
    }
