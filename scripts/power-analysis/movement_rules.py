"""Posture checks per movement.

Every check reports one of: good, info, warn, issue, unavailable. A check that
needs a camera view, landmark or barbell track the video does not provide is
reported as unavailable with the reason, never guessed. Thresholds are first
estimates for coaching hints, not judging standards.
"""
from typing import Any, Callable, Dict, List, Optional, Sequence

import numpy as np

import pose_features as pf

STATUS_ORDER = {"issue": 0, "warn": 1, "info": 2, "good": 3, "unavailable": 4}
SIDE_VIEWS = ("side", "oblique")
RECOMMENDED_VIEW_ZH = {
    "pullup": "正面或斜侧面",
    "muscleup": "正面或斜侧面",
    "dip": "侧面或斜侧面",
    "pushup": "侧面",
    "squat": "侧面或斜侧面",
    "back_squat": "侧面",
    "bench_press": "侧面",
    "deadlift": "侧面",
}
KEY_JOINT = {
    "pullup": ("elbow", "elbow"),
    "muscleup": ("elbow", "elbow"),
    "dip": ("elbow", "elbow"),
    "pushup": ("elbow", "elbow"),
    "bench_press": ("elbow", "elbow"),
    "squat": ("knee", "knee"),
    "back_squat": ("knee", "knee"),
    "deadlift": ("hip", "hip"),
}


class RuleContext:
    """Per-video data the checks read; series are computed lazily and cached."""

    def __init__(
        self,
        mode: str,
        track: np.ndarray,
        reps: List[Dict[str, Any]],
        fps: float,
        scale_m_per_px: float,
        bar_points: Optional[np.ndarray] = None,
        bar_from_plate: bool = False,
        body_scale_m_per_px: Optional[float] = None,
    ) -> None:
        self.mode = mode
        # Plate and body sit at different distances from the camera; body checks use their own scale.
        self.body_scale = body_scale_m_per_px or scale_m_per_px
        self.track = track
        self.reps = reps
        self.fps = max(fps, 1.0)
        self.scale = scale_m_per_px
        self.bar_points = bar_points
        self.bar_from_plate = bar_from_plate
        self.view = pf.detect_view(track)
        self.side = pf.choose_side(track)
        self.angle_side = "both" if self.view == "front" else self.side
        self._cache: Dict[str, np.ndarray] = {}
        self.events: List[Dict[str, Any]] = []

    def series(self, key: str, build: Callable[[], np.ndarray]) -> np.ndarray:
        if key not in self._cache:
            self._cache[key] = pf.smooth(build(), max(1, int(round(self.fps * 0.08))))
        return self._cache[key]

    def angle(self, joint: str) -> np.ndarray:
        return self.series(f"angle:{joint}", lambda: pf.joint_angle(self.track, joint, self.angle_side))

    def side_angle(self, joint: str) -> np.ndarray:
        return self.series(f"side_angle:{joint}", lambda: pf.joint_angle(self.track, joint, self.side))

    def lean(self) -> np.ndarray:
        return self.series("lean", lambda: pf.trunk_lean(self.track, self.side))

    def thigh(self) -> np.ndarray:
        return self.series("thigh", lambda: pf.thigh_angle(self.track, self.side))

    def frames(self, rep: Dict[str, Any], key: str) -> int:
        return int(rep.get(key) or 0)

    def time_s(self, frame: int) -> float:
        return round(frame / self.fps, 2)

    def is_side_view(self) -> bool:
        return self.view in SIDE_VIEWS

    def add_event(self, frame: int, code: str, label_zh: str, label_en: str, severity: str, part: Optional[str]) -> None:
        self.events.append(
            {
                "frame": int(frame),
                "code": code,
                "labelZh": label_zh,
                "labelEn": label_en,
                "severity": severity,
                "part": part,
            }
        )


def make_check(
    code: str,
    title_zh: str,
    status: str,
    detail_zh: str,
    rep_indexes: Sequence[int] = (),
    times_s: Sequence[float] = (),
    value: Optional[float] = None,
    unit: str = "",
) -> Dict[str, Any]:
    return {
        "code": code,
        "titleZh": title_zh,
        "status": status,
        "detailZh": detail_zh,
        "repIndexes": [int(item) for item in rep_indexes],
        "timesS": [round(float(item), 2) for item in times_s],
        "value": None if value is None else round(float(value), 1),
        "unit": unit,
    }


def unavailable(code: str, title_zh: str, reason_zh: str) -> Dict[str, Any]:
    return make_check(code, title_zh, "unavailable", reason_zh)


def rep_list_zh(indexes: Sequence[int]) -> str:
    return "、".join(str(int(item)) for item in indexes)


def grade_reps(
    ctx: RuleContext,
    code: str,
    title_zh: str,
    measurements: List[Dict[str, Any]],
    describe: Callable[[str, List[Dict[str, Any]]], str],
    event_labels: Optional[Dict[str, Any]] = None,
    unit: str = "°",
) -> Dict[str, Any]:
    """Aggregate per-rep grades (good/warn/issue) into one check."""
    graded = [item for item in measurements if item.get("grade")]
    if not graded:
        return unavailable(code, title_zh, "这几次动作里相关关键点不够清楚，无法测量")
    flagged = [item for item in graded if item["grade"] in ("warn", "issue")]
    issue_count = sum(1 for item in graded if item["grade"] == "issue")
    if not flagged:
        status = "good"
    elif issue_count * 2 >= len(graded):
        status = "issue"
    else:
        status = "warn"
    if event_labels:
        for item in flagged:
            ctx.add_event(
                item["frame"],
                code,
                event_labels["zh"],
                event_labels["en"],
                item["grade"],
                event_labels.get("part"),
            )
    values = [item["value"] for item in (flagged or graded)]
    return make_check(
        code,
        title_zh,
        status,
        describe(status, flagged or graded),
        [item["rep"] for item in flagged],
        [ctx.time_s(item["frame"]) for item in flagged],
        float(np.median(values)) if values else None,
        unit,
    )


def grade_value(value: Optional[float], good: Callable[[float], bool], warn: Callable[[float], bool]) -> Optional[str]:
    if value is None:
        return None
    if good(value):
        return "good"
    return "warn" if warn(value) else "issue"


def bottom_frame(ctx: RuleContext, rep: Dict[str, Any]) -> int:
    return ctx.frames(rep, "bottomFrame") or ctx.frames(rep, "startFrame")


def top_frame(ctx: RuleContext, rep: Dict[str, Any]) -> int:
    return ctx.frames(rep, "topFrame") or ctx.frames(rep, "peakFrame") or ctx.frames(rep, "endFrame")


def per_rep_angle(
    ctx: RuleContext,
    series: np.ndarray,
    frame_of: Callable[[RuleContext, Dict[str, Any]], int],
    good: Callable[[float], bool],
    warn: Callable[[float], bool],
) -> List[Dict[str, Any]]:
    radius = max(1, int(round(ctx.fps * 0.12)))
    result = []
    for rep in ctx.reps:
        frame = frame_of(ctx, rep)
        value = pf.nearest_value(series, frame, radius)
        result.append(
            {
                "rep": rep["repIndex"],
                "frame": frame,
                "value": value,
                "grade": grade_value(value, good, warn),
            }
        )
    return result


def angle_detail(prefix: str, ok_text: str, bad_text: str) -> Callable[[str, List[Dict[str, Any]]], str]:
    def describe(status: str, items: List[Dict[str, Any]]) -> str:
        median = float(np.median([item["value"] for item in items]))
        if status == "good":
            return f"{ok_text}（{prefix}约 {median:.0f}°）"
        reps = rep_list_zh([item["rep"] for item in items])
        return f"第 {reps} 次{bad_text}（{prefix}约 {median:.0f}°）"

    return describe
