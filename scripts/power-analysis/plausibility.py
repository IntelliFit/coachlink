"""Drops reps no human can produce (tracking jumps) and tiny partial reps.

The limits live in packages/core/src/powerAnalysisPlausibility.json so the server
leaderboard guard applies the same numbers.
"""
import json
import os
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

LIMITS_PATH = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "packages", "core", "src", "powerAnalysisPlausibility.json")
)
# Muscle-ups keep their own stricter startup filter; barbell reps are already bounded by bar travel.
PARTIAL_FILTER_MODES = {"pullup", "dip", "pushup", "squat"}
MIN_REPS_FOR_PARTIAL_FILTER = 3


def load_limits(path: str = LIMITS_PATH) -> Dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


LIMITS = load_limits()


def mode_limits(mode: str) -> Dict[str, Optional[float]]:
    return LIMITS["modes"].get(mode, {"maxPeakVelocityMps": None, "maxDisplacementHeightRatio": None})


def max_peak_velocity(mode: str) -> Optional[float]:
    value = mode_limits(mode).get("maxPeakVelocityMps")
    return float(value) if value else None


def _excluded(rep: Dict[str, Any], reason: str, reason_zh: str) -> Dict[str, Any]:
    return {
        "startTimeS": rep.get("startTimeS"),
        "endTimeS": rep.get("endTimeS"),
        "displacementM": rep.get("displacementM"),
        "maxVelocityMps": rep.get("maxVelocityMps"),
        "startFrame": rep.get("startFrame"),
        "endFrame": rep.get("endFrame"),
        "reason": reason,
        "reasonZh": reason_zh,
    }


def _impossible_reason(rep: Dict[str, Any], mode: str, height_cm: float) -> Optional[Tuple[str, str]]:
    limits = mode_limits(mode)
    velocity_cap = limits.get("maxPeakVelocityMps")
    ratio = limits.get("maxDisplacementHeightRatio")
    velocity = float(rep.get("maxVelocityMps") or 0)
    displacement = float(rep.get("displacementM") or 0)
    if ratio and height_cm > 0 and displacement > float(ratio) * height_cm / 100.0:
        return "displacement_beyond_body", f"位移 {displacement:.2f} m 超出人体可能范围"
    if velocity_cap and velocity > float(velocity_cap):
        return "velocity_beyond_body", f"峰值速度 {velocity:.1f} m/s 超出人体可能范围"
    return None


def split_reps(
    reps: List[Dict[str, Any]], mode: str, height_cm: float
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Returns (kept reps renumbered from 1, excluded reps with reasons)."""
    kept: List[Dict[str, Any]] = []
    excluded: List[Dict[str, Any]] = []
    for rep in reps:
        reason = _impossible_reason(rep, mode, height_cm)
        if reason:
            excluded.append(_excluded(rep, reason[0], reason[1]))
        else:
            kept.append(rep)

    if mode in PARTIAL_FILTER_MODES and len(kept) >= MIN_REPS_FOR_PARTIAL_FILTER:
        share = float(LIMITS.get("partialRepShareOfMedian") or 0)
        median = float(np.median([float(rep.get("displacementM") or 0) for rep in kept]))
        if share > 0 and median > 0:
            full = [rep for rep in kept if float(rep.get("displacementM") or 0) >= share * median]
            for rep in kept:
                if rep not in full:
                    excluded.append(_excluded(rep, "partial_rep", f"幅度不到本组常规次数的 {round(share * 100)}%，按半程动作处理"))
            kept = full

    excluded.sort(key=lambda item: float(item.get("startTimeS") or 0))
    for index, rep in enumerate(kept, start=1):
        rep["repIndex"] = index
    return kept, excluded


def exclusion_warnings_zh(excluded: List[Dict[str, Any]]) -> List[str]:
    impossible = [item for item in excluded if item["reason"] != "partial_rep"]
    partial = [item for item in excluded if item["reason"] == "partial_rep"]
    warnings: List[str] = []
    if impossible:
        times = "、".join(f"{float(item.get('startTimeS') or 0):.1f} 秒" for item in impossible[:4])
        warnings.append(
            f"有 {len(impossible)} 次（约 {times}处）{impossible[0]['reasonZh']}，判定为画面追踪跳变，未计入成绩"
        )
    if partial:
        warnings.append(f"有 {len(partial)} 次幅度明显小于本组其他次数，按半程动作处理，未计入次数和成绩")
    return warnings


def clean_series_velocity(velocity: float, mode: str) -> float:
    cap = max_peak_velocity(mode)
    return min(velocity, cap) if cap else velocity
