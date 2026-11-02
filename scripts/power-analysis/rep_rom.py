"""Grades each pull-up and muscle-up rep full or partial from its own lowest and highest point.

Reading each rep at its own extremes, a straight arm calibrated on the set, and head
clearance in torso lengths come from jeremyipark/vision-demos (Apache-2.0,
pull_ups/how-it-works.md). This is our own implementation on MediaPipe landmarks. An end
the landmarks cannot show counts as not reached, with the reason stated, never as passed.

This is the one source of the grade: the bottom-extension, chin-over-bar, lockout and
over-bar checks and the partial-rep filter all read rep["rom"] rather than measuring again.
"""
from typing import Any, Dict, List, Optional

import numpy as np

import pose_features as pf
from bar_reference import hands_y, shoulders_y, torso_ruler_px

ROM_MODES = ("pullup", "muscleup")
HEAD_LANDMARKS = (0, 2, 5, 7, 8)  # nose, eyes, ears
# MediaPipe rarely reads a straight arm as 180 degrees, so the set's best few reps set the bar.
BOTTOM_REFERENCE_REPS = 3
BOTTOM_TOLERANCE_DEG = 15.0
BOTTOM_FLOOR_DEG = 150.0
# Head above wrists at which the chin reaches the bar from a low front camera (real clips, checked by eye).
PULLUP_CLEARANCE_TORSO = 0.15
# Shoulders above wrists: 0 is level with the bar, about 1.0 is locked out in support.
MUSCLEUP_CLEARANCE_TORSO = 0.5
LOCKOUT_DEG = 150.0
READ_RADIUS_SECONDS = 0.1
PEAK_RADIUS_SECONDS = 0.15


def head_y(track: np.ndarray) -> np.ndarray:
    """Confidence-weighted head height: from behind the ears carry it, from the front the face."""
    indexes = list(HEAD_LANDMARKS)
    ys = track[:, indexes, 1]
    weights = np.where(np.nan_to_num(track[:, indexes, 2]) >= 0.3, np.nan_to_num(track[:, indexes, 2]), 0.0)
    total = np.sum(weights, axis=1)
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(total > 0, np.nansum(ys * weights, axis=1) / total, np.nan)


def elbow_series(track: np.ndarray, fps: float) -> np.ndarray:
    side = "both" if pf.detect_view(track) == "front" else pf.choose_side(track)
    return pf.smooth(pf.joint_angle(track, "elbow", side), max(1, int(round(fps * 0.08))))


def _median_around(series: np.ndarray, frame: int, radius: int) -> Optional[float]:
    window = pf.window_values(series, frame - radius, frame + radius)
    return float(np.median(window)) if window.size else None


def _max_around(series: np.ndarray, frame: int, radius: int) -> Optional[float]:
    window = pf.window_values(series, frame - radius, frame + radius)
    return float(np.max(window)) if window.size else None


def _rounded(value: Optional[float], digits: int) -> Optional[float]:
    return None if value is None else round(value, digits)


def bottom_required_deg(bottoms: List[Optional[float]]) -> float:
    """The set's own straight arm, less a tolerance, never below the floor."""
    readable = sorted((value for value in bottoms if value is not None), reverse=True)
    if not readable:
        return BOTTOM_FLOOR_DEG
    count = min(BOTTOM_REFERENCE_REPS, max(1, round(len(readable) / 2)))
    return max(BOTTOM_FLOOR_DEG, float(np.mean(readable[:count])) - BOTTOM_TOLERANCE_DEG)


def _reasons_zh(mode: str, entry: Dict[str, Any], required: float) -> str:
    reasons: List[str] = []
    if entry["bottomElbowDeg"] is None:
        reasons.append("底部肘部看不清，无法确认手臂伸直")
    elif entry["bottomElbowDeg"] < required:
        reasons.append("底部手臂没有伸直")
    if entry["clearanceTorso"] is None:
        reasons.append("顶部肩部或手腕看不清，无法确认翻到杠上" if mode == "muscleup" else "顶部头部或手腕看不清，无法确认过杠")
    elif not entry["clearanceOk"]:
        reasons.append("没有翻到杠上" if mode == "muscleup" else "下巴没有过杠")
    if mode == "muscleup" and entry["clearanceOk"]:
        if entry["topElbowDeg"] is None:
            reasons.append("顶部肘部看不清，无法确认撑直")
        elif entry["topElbowDeg"] < LOCKOUT_DEG:
            reasons.append("顶端手臂没有撑直")
    return "；".join(reasons)


def grade_reps_rom(reps: List[Dict[str, Any]], track: np.ndarray, fps: float, scale: float, mode: str) -> None:
    """Adds rep["rom"] to each rep; needs bottomFrame and topFrame from annotate_body_reps."""
    ruler = torso_ruler_px(track)
    elbow = elbow_series(track, fps)
    hands = pf.smooth(hands_y(track), 3)
    point = pf.smooth(shoulders_y(track) if mode == "muscleup" else head_y(track), 3)
    clearance = (hands - point) / ruler if ruler else np.full(track.shape[0], np.nan)
    read = max(1, int(round(fps * READ_RADIUS_SECONDS)))
    peak = max(1, int(round(fps * PEAK_RADIUS_SECONDS)))
    needed = MUSCLEUP_CLEARANCE_TORSO if mode == "muscleup" else PULLUP_CLEARANCE_TORSO

    # Near straight the angle falls fast with 1 cm of rise, so the straightest frame around each end is the reading.
    bottoms = [_max_around(elbow, int(rep["bottomFrame"]), read) for rep in reps]
    required = bottom_required_deg(bottoms)
    for rep, bottom in zip(reps, bottoms):
        top_frame = int(rep["topFrame"])
        top_elbow = (_max_around if mode == "muscleup" else _median_around)(elbow, top_frame, read)
        over = _max_around(clearance, top_frame, peak)
        entry: Dict[str, Any] = {
            "bottomElbowDeg": _rounded(bottom, 1),
            "topElbowDeg": _rounded(top_elbow, 1),
            "clearanceTorso": _rounded(over, 3),
            "clearanceCm": None if over is None or not ruler else round(over * ruler * scale * 100, 1),
            "clearanceMarginCm": None if over is None or not ruler else round((over - needed) * ruler * scale * 100, 1),
            "clearanceOk": over is not None and over >= needed,
            "bottomOk": bottom is not None and bottom >= required,
            "bottomRequiredDeg": round(required, 1),
            "clearanceRequiredTorso": needed,
        }
        entry["topOk"] = entry["clearanceOk"] and (
            mode != "muscleup" or (top_elbow is not None and top_elbow >= LOCKOUT_DEG)
        )
        entry["grade"] = "full" if entry["bottomOk"] and entry["topOk"] else "partial"
        entry["unreadable"] = bottom is None or over is None or (mode == "muscleup" and entry["clearanceOk"] and top_elbow is None)
        entry["reasonZh"] = _reasons_zh(mode, entry, required)
        rep["rom"] = entry


def tally_rom(reps: List[Dict[str, Any]]) -> Dict[str, int]:
    graded = [rep["rom"] for rep in reps if rep.get("rom")]
    return {
        "fullReps": sum(1 for rom in graded if rom["grade"] == "full"),
        "partialReps": sum(1 for rom in graded if rom["grade"] == "partial"),
        "unreadableReps": sum(1 for rom in graded if rom["unreadable"]),
    }
