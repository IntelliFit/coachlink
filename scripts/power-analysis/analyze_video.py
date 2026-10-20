#!/usr/bin/env python3
import argparse
import json
import math
import os
import sys
from collections import deque
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import cv2
import mediapipe as mp
import numpy as np

import generic_motion as gm
import pose_features as pf
from assessment import build_assessment
from barbell_reps import G, HP_WATT, refine_barbell_reps
from custom_checks import build_custom_assessment
from keyframes import export_keyframes
from mode_presets import SUPPORTED_MODES, get_mode_preset, is_barbell_mode, is_generic_mode
from movement_rules import RuleContext
from plate_tracker import track_plate
from render_overlay import render_output_video
from video_encoding import finalize_output_video


ANALYZER_VERSION = "2.0.0"
DEFAULT_PLATE_DIAMETER_CM = 45.0
# Torso (shoulder to hip joint) as a share of standing height, used when lying down.
TORSO_HEIGHT_RATIO = 0.288


def emit_progress(value: int) -> None:
    print(json.dumps({"progress": max(0, min(100, int(value)))}), flush=True)


def round_float(value: float, digits: int = 3) -> float:
    if not math.isfinite(value):
        return 0.0
    return round(float(value), digits)


def moving_average(values: List[Optional[float]], window: int = 5) -> List[Optional[float]]:
    buf: deque[float] = deque(maxlen=window)
    result: List[Optional[float]] = []
    for value in values:
        if value is None:
            result.append(None)
            continue
        buf.append(float(value))
        result.append(sum(buf) / len(buf))
    return result


def to_optional_list(values: np.ndarray) -> List[Optional[float]]:
    return [float(value) if math.isfinite(float(value)) else None for value in values]


def collect_landmarks(video_path: str) -> Tuple[float, int, int, np.ndarray]:
    """One MediaPipe pass; every later step (metrics, rules, overlay) reads this track."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError("Cannot open input video")

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0)
    if fps <= 0:
        fps = 30.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    if frame_width <= 0 or frame_height <= 0:
        raise RuntimeError("Cannot read video dimensions")

    rows: List[np.ndarray] = []
    missing = np.full((33, 3), np.nan, dtype=np.float64)
    with mp.solutions.pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        enable_segmentation=False,
        min_detection_confidence=0.45,
        min_tracking_confidence=0.45,
    ) as pose:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            result = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            if result.pose_landmarks:
                rows.append(pf.landmarks_to_row(result.pose_landmarks.landmark, frame_width, frame_height))
            else:
                rows.append(missing)
            if frame_count and len(rows) % max(1, frame_count // 20) == 0:
                emit_progress(10 + int(len(rows) / frame_count * 35))
    cap.release()

    track = np.stack(rows) if rows else pf.empty_track(0)
    if not np.any(np.isfinite(track[:, :, 0])):
        raise RuntimeError("No stable pose landmarks detected")
    return fps, frame_width, frame_height, track


def average_visible_y(track: np.ndarray, indexes: List[int], min_visibility: float) -> np.ndarray:
    ys = track[:, indexes, 1].astype(np.float64)
    visible = track[:, indexes, 2] >= min_visibility
    count = visible.sum(axis=1)
    total = np.where(visible, ys, 0.0).sum(axis=1)
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(count > 0, total / np.maximum(count, 1), np.nan)


def body_anchor_y(track: np.ndarray, anchor: str) -> np.ndarray:
    shoulder = average_visible_y(track, [11, 12], 0.35)
    hip = average_visible_y(track, [23, 24], 0.35)
    torso = average_visible_y(track, [11, 12, 23, 24], 0.3)
    if anchor == "hip":
        return np.where(np.isfinite(hip), hip, torso)
    if anchor == "torso":
        return np.where(np.isfinite(torso), torso, shoulder)
    return shoulder


def height_scale_m_per_px(
    track: np.ndarray, frame_height: int, height_cm: float, standing_only: bool = False
) -> Optional[float]:
    """Median of (height / head-to-foot pixels) over frames with head and feet visible.

    standing_only uses the tallest frames instead, for lifts where the lifter is bent over
    for most of the clip (deadlift setup, squat hole); the median would then halve the height.
    """
    head = track[:, [0, 2, 5], :]
    feet = track[:, [29, 30, 31, 32, 27, 28], :]
    top = np.where(head[:, :, 2] >= 0.35, head[:, :, 1], np.inf).min(axis=1)
    bottom = np.where(feet[:, :, 2] >= 0.25, feet[:, :, 1], -np.inf).max(axis=1)
    pixel_height = np.abs(bottom - top)
    valid = np.isfinite(pixel_height) & (pixel_height >= 80)
    if not np.any(valid):
        return None
    if standing_only:
        return float((height_cm / 100.0) / np.percentile(pixel_height[valid], 90))
    return float(np.median((height_cm / 100.0) / pixel_height[valid]))


def torso_scale_m_per_px(track: np.ndarray, height_cm: float) -> Optional[float]:
    lengths = pf.torso_length(track)
    lengths = lengths[np.isfinite(lengths) & (lengths >= 40)]
    if lengths.size < 5:
        return None
    return (height_cm / 100.0) * TORSO_HEIGHT_RATIO / float(np.median(lengths))


def frame_fallback_scale(frame_height: int, height_cm: float) -> float:
    # Assume the visible body occupies about 80% of frame height.
    return (height_cm / 100.0) / max(frame_height * 0.8, 1)


def expected_bar_points(track: np.ndarray, part: str, side: str) -> np.ndarray:
    """Rough bar position from the body, permissive on visibility because plates hide hands."""
    preferred = pf.side_points(track, side, part, 0.1)
    both = pf.side_points(track, "both", part, 0.05)
    return np.where(np.isfinite(preferred), preferred, both)


@dataclass
class Measured:
    """What the analyzer follows: y_track finds reps and draws curves; timing_y times barbell reps."""
    y_track: List[Optional[float]]
    scale: float
    measurement: Dict[str, Any]
    bar_points: Optional[np.ndarray] = None
    timing_y: Optional[np.ndarray] = None
    plate_radius: Optional[float] = None


def measure_body_anchor(track: np.ndarray, mode: str, frame_height: int, height_cm: float) -> Measured:
    preset = get_mode_preset(mode)
    scale = height_scale_m_per_px(track, frame_height, height_cm)
    source = "body_height"
    if scale is None:
        scale, source = frame_fallback_scale(frame_height, height_cm), "frame_fallback"
    anchor = body_anchor_y(track, str(preset["anchor"]))
    if not np.any(np.isfinite(anchor)):
        raise RuntimeError("No stable pose landmarks detected")
    y_track = moving_average(to_optional_list(anchor))
    measurement = {
        "target": "body_anchor",
        "anchorLabelZh": "髋部" if preset["anchor"] == "hip" else "肩部",
        "scaleSource": source,
        "confidence": "medium" if source == "body_height" else "low",
    }
    return Measured(y_track=y_track, scale=scale, measurement=measurement)


def measure_barbell(args: argparse.Namespace, track: np.ndarray, fps: float, frame_height: int) -> Measured:
    preset = get_mode_preset(args.mode)
    side = pf.choose_side(track)
    part = str(preset.get("bodyProxy") or "wrist")
    expected = expected_bar_points(track, part, side)
    plate, reason = track_plate(
        args.input,
        expected,
        fps,
        args.plate_diameter_cm,
        on_progress=lambda share: emit_progress(45 + int(share * 7)),
        head_points=pf.points(track, 0, 0.1),
    )
    body_scale = height_scale_m_per_px(track, frame_height, args.height_cm, standing_only=True)
    max_gap = int(fps * 0.2)
    if plate is not None:
        bar_points = plate.centers
        timing_y = plate.raw_centers[:, 1]
        scale = plate.scale_m_per_px
        warnings: List[str] = []
        if args.mode != "bench_press" and body_scale:
            ratio = scale / body_scale
            if ratio < 0.7 or ratio > 1.4:
                warnings.append("按杠铃片直径与按身高换算的尺寸相差较大，请确认杠铃片直径是否填写正确")
        measurement = {
            "target": "barbell_plate",
            "anchorLabelZh": "杠铃片中心",
            "scaleSource": "plate_diameter",
            "plateDiameterCm": round_float(args.plate_diameter_cm, 1),
            "trackingCoverage": round_float(plate.coverage, 3),
            "confidence": plate.confidence,
            "warningsZh": warnings,
        }
        radius = plate.radius_px
    else:
        bar_points = pf.smooth(expected[:, 0], max(1, int(round(fps * 0.1)))), pf.smooth(expected[:, 1], max(1, int(round(fps * 0.1))))
        bar_points = np.stack(bar_points, axis=1)
        timing_y = pf.interpolate_gaps(bar_points[:, 1], max_gap)
        if args.mode == "bench_press":
            scale, source = torso_scale_m_per_px(track, args.height_cm), "torso_segment"
        else:
            scale, source = body_scale, "body_height"
        if scale is None:
            scale, source = frame_fallback_scale(frame_height, args.height_cm), "frame_fallback"
        measurement = {
            "target": "barbell_body_proxy",
            "anchorLabelZh": "手腕" if part == "wrist" else "肩部",
            "scaleSource": source,
            "confidence": "low",
            "fallbackReason": reason,
            "warningsZh": ["没有识别到杠铃片，速度和功率按身体位置估算，误差较大；请侧面拍摄并让近侧杠铃片完整入镜"],
        }
        radius = None
    smoothed_y = pf.smooth(pf.interpolate_gaps(bar_points[:, 1], max_gap), max(1, int(round(fps * 0.12))))
    return Measured(
        y_track=to_optional_list(smoothed_y),
        scale=scale,
        measurement=measurement,
        bar_points=bar_points,
        timing_y=timing_y,
        plate_radius=radius,
    )


def body_scale_for_rules(args: argparse.Namespace, track: np.ndarray, frame_height: int, fallback: float) -> float:
    """Scale at the lifter's body (not the plate) for posture checks in barbell lifts."""
    if args.mode == "bench_press":
        scale = torso_scale_m_per_px(track, args.height_cm)
    else:
        scale = height_scale_m_per_px(track, frame_height, args.height_cm, standing_only=True)
    return scale or fallback


def detect_reps(
    y_track: List[Optional[float]],
    fps: float,
    scale_m_per_px: float,
    effective_mass_kg: float,
    mode: str,
    min_displacement: Optional[float] = None,
) -> List[Dict[str, float]]:
    preset = get_mode_preset(mode)
    start_threshold = float(preset["startThreshold"])
    end_threshold = float(preset["endThreshold"])
    min_displacement = float(preset["minDisplacement"] if min_displacement is None else min_displacement)
    min_time = float(preset["minTime"])
    max_time = float(preset["maxTime"])
    still_frames_needed = max(3, int(round(fps * float(preset["stillSeconds"]))))

    reps: List[Dict[str, float]] = []
    in_ascent = False
    start_frame = 0
    start_y = 0.0
    min_y = 0.0
    velocities: List[float] = []
    still_frames = 0

    prev_y: Optional[float] = None
    for idx, y in enumerate(y_track):
        if y is None:
            prev_y = None
            continue
        if prev_y is None:
            prev_y = y
            continue

        dt = 1.0 / fps
        upward_velocity = ((prev_y - y) * scale_m_per_px) / dt

        if not in_ascent and upward_velocity > start_threshold:
            in_ascent = True
            start_frame = idx - 1
            start_y = prev_y
            min_y = y
            velocities = [max(0.0, upward_velocity)]
            still_frames = 0
        elif in_ascent:
            min_y = min(min_y, y)
            velocities.append(max(0.0, upward_velocity))
            if upward_velocity < end_threshold:
                still_frames += 1
            else:
                still_frames = 0

            elapsed = (idx - start_frame) / fps
            should_end = still_frames >= still_frames_needed or elapsed > max_time
            if should_end:
                displacement_m = max(0.0, (start_y - min_y) * scale_m_per_px)
                ascent_time_s = max(dt, elapsed)
                if displacement_m >= min_displacement and min_time <= ascent_time_s <= max_time:
                    work_j = effective_mass_kg * G * displacement_m
                    avg_power_w = work_j / ascent_time_s
                    max_velocity_mps = max(velocities) if velocities else 0.0
                    reps.append(
                        {
                            "repIndex": len(reps) + 1,
                            "displacementM": round_float(displacement_m),
                            "ascentTimeS": round_float(ascent_time_s),
                            "avgPowerW": round_float(avg_power_w, 2),
                            "horsepowerHp": round_float(avg_power_w / HP_WATT, 3),
                            "maxVelocityMps": round_float(max_velocity_mps, 3),
                            "startFrame": int(start_frame),
                            "endFrame": int(idx),
                            "peakFrame": int(max(start_frame, idx - still_frames)),
                        }
                    )
                in_ascent = False
                velocities = []
                still_frames = 0

        prev_y = y

    return filter_partial_startup_reps(reps, mode)


def filter_partial_startup_reps(reps: List[Dict[str, float]], mode: str) -> List[Dict[str, float]]:
    if mode != "muscleup" or len(reps) < 3:
        return reps

    displacements = [float(rep.get("displacementM") or 0) for rep in reps]
    median_displacement = float(np.median(np.array(displacements)))
    if median_displacement <= 0:
        return reps

    min_full_rep_displacement = median_displacement * 0.55
    filtered = [
        rep
        for rep in reps
        if float(rep.get("displacementM") or 0) >= min_full_rep_displacement
    ]
    if not filtered or len(filtered) == len(reps):
        return reps

    for index, rep in enumerate(filtered, start=1):
        rep["repIndex"] = index
    return filtered



def locate_rep_extremes(rep: Dict[str, Any], y: np.ndarray, fps: float, tolerance_px: float) -> Tuple[int, int]:
    """Bottom = last frame at the lowest point before the ascent; top = first frame reaching the highest point."""
    start, end = int(rep["startFrame"]), int(rep["endFrame"])
    lo = max(0, start - int(fps * 0.6))
    hi = min(y.size - 1, start + int(fps * 0.2))
    before = y[lo:hi + 1]
    bottom = start
    if np.any(np.isfinite(before)):
        lowest = np.nanmax(before)
        candidates = np.flatnonzero(np.isfinite(before) & (before >= lowest - tolerance_px))
        bottom = lo + int(candidates[-1])
    ascent = y[bottom:end + 1]
    top = end
    if np.any(np.isfinite(ascent)):
        highest = np.nanmin(ascent)
        candidates = np.flatnonzero(np.isfinite(ascent) & (ascent <= highest + tolerance_px))
        top = bottom + int(candidates[0])
    return bottom, max(top, bottom + 1)


def annotate_body_reps(reps: List[Dict[str, Any]], y_track: List[Optional[float]], fps: float, scale: float) -> None:
    """Adds timing fields; keeps the original displacement/time/power values unchanged."""
    y = np.array([np.nan if value is None else value for value in y_track], dtype=np.float64)
    for rep in reps:
        bottom, top = locate_rep_extremes(rep, y, fps, 0.01 / max(scale, 1e-6))
        time_s = float(rep.get("ascentTimeS") or 0)
        rep["bottomFrame"] = bottom
        rep["topFrame"] = top
        rep["meanVelocityMps"] = round_float(float(rep.get("displacementM") or 0) / time_s if time_s > 0 else 0.0, 3)
        rep["startTimeS"] = round_float(int(rep["startFrame"]) / fps, 2)
        rep["endTimeS"] = round_float(int(rep["endFrame"]) / fps, 2)


def build_mass_metrics(
    body_weight_kg: float,
    external_load_kg: float,
    body_mass_factor: float = 1.0,
    barbell: bool = False,
) -> Dict[str, float]:
    body_weight = max(0.0, float(body_weight_kg))
    external_load = max(0.0, float(external_load_kg))
    if barbell:
        # Only the bar is lifted against gravity in this measurement.
        return {
            "bodyWeightKg": round_float(body_weight, 2),
            "externalLoadKg": round_float(external_load, 2),
            "bodyMassFactor": 0.0,
            "effectiveMassKg": round_float(external_load, 2),
        }
    factor = min(1.0, max(0.1, float(body_mass_factor)))
    return {
        "bodyWeightKg": round_float(body_weight, 2),
        "externalLoadKg": round_float(external_load, 2),
        "bodyMassFactor": round_float(factor, 2),
        "effectiveMassKg": round_float(body_weight * factor + external_load, 2),
    }


def velocity_summary(reps: List[Dict[str, Any]]) -> Dict[str, Any]:
    means = [float(rep.get("meanVelocityMps") or 0) for rep in reps]
    if not means:
        return {"bestMeanVelocityMps": 0, "avgMeanVelocityMps": 0, "lastMeanVelocityMps": 0, "velocityLossPct": None}
    best = max(means)
    loss = (best - means[-1]) / best * 100 if len(means) >= 2 and best > 0 else None
    return {
        "bestMeanVelocityMps": round_float(best, 3),
        "avgMeanVelocityMps": round_float(float(np.mean(means)), 3),
        "lastMeanVelocityMps": round_float(means[-1], 3),
        "velocityLossPct": None if loss is None else round_float(max(0.0, loss), 1),
    }


def build_metrics(
    mode: str,
    reps: List[Dict[str, Any]],
    body_weight_kg: float,
    external_load_kg: float,
) -> Dict[str, Any]:
    preset = get_mode_preset(mode)
    barbell = is_barbell_mode(mode)
    mass = build_mass_metrics(body_weight_kg, external_load_kg, float(preset["bodyMassFactor"]), barbell)
    if not reps:
        return {
            "mode": mode,
            "mass": mass,
            "repCount": 0,
            "summary": {
                "avgPowerW": 0,
                "bestPowerW": 0,
                "bestHorsepowerHp": 0,
                "bestVelocityMps": 0,
                "avgAscentTimeS": 0,
                "avgDisplacementM": 0,
                **velocity_summary([]),
            },
            "reps": [],
            "notes": [
                "No complete upward phase was detected. Try a clearer full-body video with less occlusion.",
                f"Recommended view: {preset['viewHint']}",
            ],
        }

    powers = [float(r["avgPowerW"]) for r in reps]
    velocities = [float(r["maxVelocityMps"]) for r in reps]
    times = [float(r["ascentTimeS"]) for r in reps]
    displacements = [float(r["displacementM"]) for r in reps]
    if barbell:
        load_note = "Power is the barbell lifting power: bar mass x g x vertical bar rise / concentric time."
    elif mass["externalLoadKg"] > 0:
        load_note = f"Power is estimated from effective mass, vertical {preset['anchorLabel']} displacement, and ascent time."
    else:
        load_note = f"Power is estimated from effective body mass, vertical {preset['anchorLabel']} displacement, and ascent time."
    return {
        "mode": mode,
        "mass": mass,
        "repCount": len(reps),
        "summary": {
            "avgPowerW": round_float(float(np.mean(powers)), 2),
            "bestPowerW": round_float(max(powers), 2),
            "bestHorsepowerHp": round_float(max(powers) / HP_WATT, 3),
            "bestVelocityMps": round_float(max(velocities), 3),
            "avgAscentTimeS": round_float(float(np.mean(times)), 3),
            "avgDisplacementM": round_float(float(np.mean(displacements)), 3),
            **velocity_summary(reps),
        },
        "reps": reps,
        "notes": [
            load_note,
            f"Recommended view: {preset['viewHint']}",
            "Camera angle, occlusion, body landmark stability, and scale calibration affect accuracy.",
        ],
    }


def build_power_rating(metrics: Dict[str, Any]) -> Dict[str, Any]:
    summary = metrics.get("summary") if isinstance(metrics.get("summary"), dict) else {}
    mass = metrics.get("mass") if isinstance(metrics.get("mass"), dict) else {}
    best_power = max(0.0, float(summary.get("bestPowerW") or 0))
    effective_mass = max(0.0, float(mass.get("effectiveMassKg") or 0))
    normalized = best_power / effective_mass if effective_mass > 0 else 0.0

    if normalized >= 12.0:
        level, label_zh, label_en = "beast", "野兽", "BEAST"
        description_zh = "爆发功率非常突出，属于本次测试中的野兽级表现。"
        description_en = "Exceptional explosive power. This is a BEAST-level result."
    elif normalized >= 8.0:
        level, label_zh, label_en = "powerful", "强劲", "POWERFUL"
        description_zh = "功率表现很强，启动速度和向上输出都很突出。"
        description_en = "Strong power output with impressive upward acceleration."
    elif normalized >= 5.0:
        level, label_zh, label_en = "steady", "稳健", "SOLID"
        description_zh = "功率表现稳健，可以继续提高启动和后半程速度。"
        description_en = "Solid power output with room to improve acceleration and finish speed."
    else:
        level, label_zh, label_en = "low", "待提升", "BUILDING"
        description_zh = "当前功率偏小，建议先提高动作稳定性和主动加速能力。"
        description_en = "Power is currently modest. Focus on stable technique and intentional acceleration."

    return {
        "level": level,
        "normalizedPowerWPerKg": round_float(normalized, 3),
        "labelZh": label_zh,
        "labelEn": label_en,
        "descriptionZh": description_zh,
        "descriptionEn": description_en,
    }


def build_time_series(
    y_track: List[Optional[float]],
    reps: List[Dict[str, Any]],
    fps: float,
    scale_m_per_px: float,
    effective_mass_kg: float,
    max_points: int = 600,
) -> List[Dict[str, float]]:
    frame_count = len(y_track)
    if frame_count <= 0:
        return []

    velocities = [0.0] * frame_count
    for index in range(1, frame_count):
        current_y = y_track[index]
        previous_y = y_track[index - 1]
        if current_y is None or previous_y is None:
            continue
        velocities[index] = max(0.0, ((previous_y - current_y) * scale_m_per_px) * fps)

    velocity_window = max(3, int(round(fps * 0.12)))
    smoothed_velocity: List[float] = []
    velocity_queue: deque[float] = deque(maxlen=velocity_window)
    for value in velocities:
        velocity_queue.append(value)
        smoothed_velocity.append(float(sum(velocity_queue) / len(velocity_queue)))

    rep_by_frame: List[Optional[Dict[str, Any]]] = [None] * frame_count
    for rep in reps:
        start = max(0, int(rep.get("startFrame") or 0))
        end = min(frame_count - 1, int(rep.get("endFrame") or start))
        for frame_index in range(start, end + 1):
            rep_by_frame[frame_index] = rep

    step = max(1, int(math.ceil(frame_count / max(1, max_points))))
    points: List[Dict[str, float]] = []
    for index in range(0, frame_count, step):
        displacement = 0.0
        rep = rep_by_frame[index]
        if rep:
            start = max(0, int(rep.get("startFrame") or 0))
            start_y = y_track[start] if start < frame_count else None
            current_y = y_track[index]
            if start_y is not None and current_y is not None:
                displacement = max(0.0, (start_y - current_y) * scale_m_per_px)
        velocity = max(0.0, smoothed_velocity[index])
        power = effective_mass_kg * G * velocity if effective_mass_kg > 0 else 0.0
        points.append(
            {
                "timeS": round_float(index / max(fps, 1.0), 3),
                "displacementM": round_float(displacement, 4),
                "velocityMps": round_float(velocity, 4),
                "powerW": round_float(power, 2),
            }
        )
    return points


def run(args: argparse.Namespace) -> Dict[str, Any]:
    emit_progress(8)
    fps, width, height, track = collect_landmarks(args.input)
    emit_progress(45)
    if is_generic_mode(args.mode):
        return run_custom(args, fps, width, height, track)
    preset = get_mode_preset(args.mode)
    barbell = is_barbell_mode(args.mode)
    external_load_kg = max(0.0, float(args.external_load_kg or 0))
    measured = (
        measure_barbell(args, track, fps, height)
        if barbell
        else measure_body_anchor(track, args.mode, height, args.height_cm)
    )
    y_track, scale, bar_points, measurement = measured.y_track, measured.scale, measured.bar_points, measured.measurement
    emit_progress(52)

    effective_mass_kg = float(
        build_mass_metrics(args.weight_kg, external_load_kg, float(preset["bodyMassFactor"]), barbell)["effectiveMassKg"]
    )
    if barbell:
        raw_reps = detect_reps(y_track, fps, scale, effective_mass_kg, args.mode, min_displacement=0.05)
        reps = refine_barbell_reps(
            raw_reps, y_track, measured.timing_y, fps, scale, effective_mass_kg, float(preset["minDisplacement"])
        )
    else:
        reps = detect_reps(y_track, fps, scale, effective_mass_kg, args.mode)
        annotate_body_reps(reps, y_track, fps, scale)

    metrics = build_metrics(args.mode, reps, args.weight_kg, external_load_kg)
    metrics["analyzerVersion"] = ANALYZER_VERSION
    if not barbell:
        metrics["rating"] = build_power_rating(metrics)
    metrics["timeSeries"] = build_time_series(y_track, reps, fps, scale, effective_mass_kg)

    context = RuleContext(
        args.mode,
        track,
        reps,
        fps,
        scale,
        bar_points=bar_points,
        bar_from_plate=measurement.get("target") == "barbell_plate",
        body_scale_m_per_px=body_scale_for_rules(args, track, height, scale) if barbell else None,
    )
    metrics["assessment"] = build_assessment(context)
    metrics["measurement"] = measurement
    metrics["video"] = {
        "fps": round_float(fps, 3),
        "width": width,
        "height": height,
        "scaleMPerPx": round_float(scale, 6),
    }
    emit_progress(55)

    render_and_finalize(
        args,
        metrics,
        {
            "metrics": metrics,
            "preset": preset,
            "track": track,
            "y_track": y_track,
            "scale_m_per_px": scale,
            "fps": fps,
            "language": args.language,
            "bar_points": bar_points,
            "plate_radius_px": measured.plate_radius,
            "events": sorted(context.events, key=lambda event: event["frame"]),
            "side": context.angle_side,
        },
    )
    return metrics


def render_and_finalize(args: argparse.Namespace, metrics: Dict[str, Any], renderer_args: Dict[str, Any]) -> None:
    rendered_path = f"{args.output}.rendered.mp4"
    try:
        render_output_video(
            args.input,
            rendered_path,
            renderer_args,
            on_progress=lambda share: emit_progress(55 + int(share * 35)),
        )
        emit_progress(92)
        metrics["video"].update(
            finalize_output_video(args.input, rendered_path, args.output, args.quality)
        )
    finally:
        if os.path.exists(rendered_path):
            os.remove(rendered_path)
    emit_progress(97)


def custom_scale(track: np.ndarray, frame_height: int, height_cm: float) -> Tuple[float, str]:
    """Torso length works lying, bent or upright; head-to-foot height only when standing.

    Bending toward the camera only ever shortens the torso on screen, so the longest
    frames (90th percentile) are used instead of the median.
    """
    lengths = pf.torso_length(track)
    lengths = lengths[np.isfinite(lengths) & (lengths >= 40)]
    if lengths.size >= 5:
        return (height_cm / 100.0) * TORSO_HEIGHT_RATIO / float(np.percentile(lengths, 90)), "torso_segment"
    scale = height_scale_m_per_px(track, frame_height, height_cm)
    if scale is not None:
        return scale, "body_height"
    return frame_fallback_scale(frame_height, height_cm), "frame_fallback"


def build_custom_metrics(args: argparse.Namespace, motion: gm.GenericMotion, reps: List[Dict[str, Any]]) -> Dict[str, Any]:
    mass = build_mass_metrics(args.weight_kg, args.external_load_kg, 0.0, barbell=True)
    displacements = [float(rep["displacementM"]) for rep in reps]
    return {
        "mode": "custom",
        "mass": mass,
        "repCount": len(reps),
        "summary": {
            "avgPowerW": 0,
            "bestPowerW": 0,
            "bestHorsepowerHp": 0,
            "bestVelocityMps": round_float(max([float(rep["maxVelocityMps"]) for rep in reps] or [0.0]), 3),
            "avgAscentTimeS": round_float(float(np.mean([float(rep["ascentTimeS"]) for rep in reps])), 3) if reps else 0,
            "avgDisplacementM": round_float(float(np.mean(displacements)), 3) if reps else 0,
            "bestMeanVelocityMps": 0,
            "avgMeanVelocityMps": 0,
            "lastMeanVelocityMps": 0,
            "velocityLossPct": None,
        },
        "reps": reps,
        "custom": gm.custom_info(motion, args.action_name),
        "notes": [
            "Custom movement (trial): reps follow the body part that moves the most; no movement-specific standard is applied.",
            f"Recommended view: {get_mode_preset('custom')['viewHint']}",
        ],
    }


def run_custom(args: argparse.Namespace, fps: float, width: int, height: int, track: np.ndarray) -> Dict[str, Any]:
    scale, scale_source = custom_scale(track, height, args.height_cm)
    motion = gm.analyze_generic_motion(track, fps, height)
    signal = motion.signal
    reps = gm.build_generic_reps(motion, fps, scale)
    emit_progress(52)
    metrics = build_custom_metrics(args, motion, reps)
    metrics["analyzerVersion"] = ANALYZER_VERSION
    metrics["timeSeries"] = []
    context = RuleContext("custom", track, reps, fps, scale)
    metrics["assessment"] = build_custom_assessment(context, motion)
    metrics["measurement"] = {
        "target": "body_anchor",
        "anchorLabelZh": f"{signal.label_zh}（自动选取）" if signal else "身体",
        "scaleSource": scale_source,
        "confidence": "low" if scale_source == "frame_fallback" else "medium",
        "warningsZh": [] if reps else ["没有找到重复的动作周期，请固定手机、全身入镜，动作前后各停 1 秒"],
    }
    metrics["video"] = {
        "fps": round_float(fps, 3),
        "width": width,
        "height": height,
        "scaleMPerPx": round_float(scale, 6),
    }
    if args.keyframes_dir and reps and signal is not None:
        manifest = export_keyframes(
            args.input, track, reps, args.keyframes_dir, fps, motion.phase_labels_zh, signal.axis_kind, motion.rest
        )
        metrics["keyframeCount"] = len(manifest["frames"]) if manifest else 0
    emit_progress(55)
    joint_side = motion.joint_side
    render_and_finalize(
        args,
        metrics,
        {
            "metrics": metrics,
            "preset": {**get_mode_preset("custom"), "labelZh": args.action_name, "label": args.action_name},
            "track": track,
            "y_track": [None] * track.shape[0],
            "scale_m_per_px": scale,
            "fps": fps,
            "language": args.language,
            "bar_points": None,
            "plate_radius_px": None,
            "events": sorted(context.events, key=lambda event: event["frame"]),
            # Joint angles and tags are drawn on the side facing the camera.
            "side": joint_side,
            "custom_motion": motion,
        },
    )
    return metrics


def plate_diameter_arg(value: str) -> float:
    diameter = float(value)
    if not 20 <= diameter <= 50:
        raise argparse.ArgumentTypeError("plate diameter must be between 20 and 50 cm")
    return diameter


def action_name_arg(value: str) -> str:
    name = " ".join(str(value).split())[:20]
    return name or "其他动作"


def main() -> int:
    parser = argparse.ArgumentParser(description="CoachLink transient power analysis")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--metrics", required=True)
    parser.add_argument("--mode", choices=SUPPORTED_MODES, default="pullup")
    parser.add_argument("--height-cm", type=float, required=True)
    parser.add_argument("--weight-kg", type=float, required=True)
    parser.add_argument("--external-load-kg", type=float, default=0)
    parser.add_argument("--plate-diameter-cm", type=plate_diameter_arg, default=DEFAULT_PLATE_DIAMETER_CM)
    parser.add_argument("--language", choices=["zh", "en"], default="zh")
    parser.add_argument("--quality", choices=["compressed", "original"], default="compressed")
    parser.add_argument("--action-name", type=action_name_arg, default="其他动作")
    parser.add_argument("--keyframes-dir", default="", help="custom mode: write de-identified keyframes here")
    args = parser.parse_args()

    try:
        metrics = run(args)
        os.makedirs(os.path.dirname(os.path.abspath(args.metrics)), exist_ok=True)
        with open(args.metrics, "w", encoding="utf-8") as f:
            json.dump(metrics, f, ensure_ascii=False, indent=2)
        emit_progress(100)
        print(json.dumps({"done": True, "metrics": args.metrics}), flush=True)
        return 0
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
