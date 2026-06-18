#!/usr/bin/env python3
import argparse
import json
import math
import os
import sys
from collections import deque
from typing import Any, Dict, List, Optional, Tuple

import cv2
import mediapipe as mp
import numpy as np


G = 9.80665
HP_WATT = 735.499


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


def infer_scale_m_per_px(landmarks: Any, frame_height: int, height_cm: float) -> Optional[float]:
    pose = mp.solutions.pose
    candidates = [
        pose.PoseLandmark.NOSE,
        pose.PoseLandmark.LEFT_EYE,
        pose.PoseLandmark.RIGHT_EYE,
    ]
    foot_candidates = [
        pose.PoseLandmark.LEFT_HEEL,
        pose.PoseLandmark.RIGHT_HEEL,
        pose.PoseLandmark.LEFT_FOOT_INDEX,
        pose.PoseLandmark.RIGHT_FOOT_INDEX,
        pose.PoseLandmark.LEFT_ANKLE,
        pose.PoseLandmark.RIGHT_ANKLE,
    ]

    top_y: Optional[float] = None
    bottom_y: Optional[float] = None
    for item in candidates:
        lm = landmarks[item]
        if getattr(lm, "visibility", 1.0) >= 0.35:
            y = lm.y * frame_height
            top_y = y if top_y is None else min(top_y, y)
    for item in foot_candidates:
        lm = landmarks[item]
        if getattr(lm, "visibility", 1.0) >= 0.25:
            y = lm.y * frame_height
            bottom_y = y if bottom_y is None else max(bottom_y, y)

    if top_y is None or bottom_y is None:
        return None
    pixel_height = abs(bottom_y - top_y)
    if pixel_height < 80:
        return None
    return (height_cm / 100.0) / pixel_height


def shoulder_y(landmarks: Any, frame_height: int) -> Optional[float]:
    pose = mp.solutions.pose
    items = [pose.PoseLandmark.LEFT_SHOULDER, pose.PoseLandmark.RIGHT_SHOULDER]
    ys: List[float] = []
    for item in items:
        lm = landmarks[item]
        if getattr(lm, "visibility", 1.0) >= 0.35:
            ys.append(lm.y * frame_height)
    if not ys:
        return None
    return sum(ys) / len(ys)


def collect_pose_track(video_path: str, height_cm: float) -> Tuple[float, int, int, float, List[Optional[float]]]:
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

    y_track: List[Optional[float]] = []
    scales: List[float] = []

    pose_mod = mp.solutions.pose
    with pose_mod.Pose(
        static_image_mode=False,
        model_complexity=1,
        enable_segmentation=False,
        min_detection_confidence=0.45,
        min_tracking_confidence=0.45,
    ) as pose:
        index = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = pose.process(rgb)
            if result.pose_landmarks:
                landmarks = result.pose_landmarks.landmark
                y_track.append(shoulder_y(landmarks, frame_height))
                scale = infer_scale_m_per_px(landmarks, frame_height, height_cm)
                if scale:
                    scales.append(scale)
            else:
                y_track.append(None)

            index += 1
            if frame_count and index % max(1, frame_count // 20) == 0:
                emit_progress(10 + int(index / frame_count * 35))

    cap.release()

    if not any(y is not None for y in y_track):
        raise RuntimeError("No stable pose landmarks detected")

    if scales:
        scale_m_per_px = float(np.median(np.array(scales)))
    else:
        # Fallback: assume the visible body occupies about 80% of frame height.
        scale_m_per_px = (height_cm / 100.0) / max(frame_height * 0.8, 1)

    return fps, frame_width, frame_height, scale_m_per_px, moving_average(y_track)


def detect_reps(
    y_track: List[Optional[float]],
    fps: float,
    scale_m_per_px: float,
    effective_mass_kg: float,
    mode: str,
) -> List[Dict[str, float]]:
    start_threshold = 0.22 if mode == "pullup" else 0.32
    end_threshold = 0.06
    min_displacement = 0.12 if mode == "pullup" else 0.18
    min_time = 0.12
    max_time = 5.5
    still_frames_needed = max(3, int(round(fps * 0.12)))

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


def build_mass_metrics(body_weight_kg: float, external_load_kg: float) -> Dict[str, float]:
    body_weight = max(0.0, float(body_weight_kg))
    external_load = max(0.0, float(external_load_kg))
    return {
        "bodyWeightKg": round_float(body_weight, 2),
        "externalLoadKg": round_float(external_load, 2),
        "effectiveMassKg": round_float(body_weight + external_load, 2),
    }


def build_metrics(
    mode: str,
    reps: List[Dict[str, float]],
    body_weight_kg: float,
    external_load_kg: float,
) -> Dict[str, Any]:
    mass = build_mass_metrics(body_weight_kg, external_load_kg)
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
            },
            "reps": [],
            "notes": [
                "No complete upward phase was detected. Try a clearer full-body video with less occlusion."
            ],
        }

    powers = [float(r["avgPowerW"]) for r in reps]
    velocities = [float(r["maxVelocityMps"]) for r in reps]
    times = [float(r["ascentTimeS"]) for r in reps]
    displacements = [float(r["displacementM"]) for r in reps]
    load_note = (
        "Power is estimated from body weight plus external load, vertical shoulder displacement, and ascent time."
        if mass["externalLoadKg"] > 0
        else "Power is estimated from body weight, vertical shoulder displacement, and ascent time."
    )
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
        },
        "reps": reps,
        "notes": [
            load_note,
            "Camera angle, occlusion, body landmark stability, and height calibration affect accuracy.",
        ],
    }


def render_output_video(
    input_path: str,
    output_path: str,
    metrics: Dict[str, Any],
    y_track: List[Optional[float]],
    scale_m_per_px: float,
) -> None:
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise RuntimeError("Cannot reopen input video")

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 30)
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    out = cv2.VideoWriter(output_path, fourcc, fps, (frame_width, frame_height))

    pose_mod = mp.solutions.pose
    draw = mp.solutions.drawing_utils
    style = mp.solutions.drawing_styles
    summary = metrics.get("summary", {})
    mass = metrics.get("mass") if isinstance(metrics.get("mass"), dict) else {}
    effective_mass_kg = float(mass.get("effectiveMassKg") or 0)
    mode_label = "Muscle-up" if metrics.get("mode") == "muscleup" else "Pull-up"
    rep_count = int(metrics.get("repCount") or 0)
    reps = metrics.get("reps") if isinstance(metrics.get("reps"), list) else []
    hold_frames = max(1, int(round(fps * 1.4)))
    header_lines = [
        f"CoachLink {mode_label} Power Test",
        f"Reps: {rep_count}  Best: {summary.get('bestPowerW', 0):.0f} W / {summary.get('bestHorsepowerHp', 0):.2f} hp",
        f"Best velocity: {summary.get('bestVelocityMps', 0):.2f} m/s  Scale: {scale_m_per_px:.5f} m/px",
    ]

    def frame_y(frame_index: int) -> Optional[float]:
        if 0 <= frame_index < len(y_track):
            return y_track[frame_index]
        return None

    def velocity_at(frame_index: int) -> float:
        current_y = frame_y(frame_index)
        prev_y = frame_y(frame_index - 1)
        if current_y is None or prev_y is None:
            return 0.0
        return ((prev_y - current_y) * scale_m_per_px) * fps

    def rep_frame(rep: Dict[str, Any], key: str, default: int) -> int:
        value = rep.get(key)
        try:
            return int(value)
        except Exception:
            return default

    def active_rep_at(frame_index: int) -> Optional[Dict[str, Any]]:
        for rep in reps:
            if not isinstance(rep, dict):
                continue
            start = rep_frame(rep, "startFrame", -1)
            end = rep_frame(rep, "endFrame", -1)
            if start <= frame_index <= end:
                return rep
        return None

    def recent_rep_at(frame_index: int) -> Optional[Dict[str, Any]]:
        recent: Optional[Dict[str, Any]] = None
        recent_end = -1
        for rep in reps:
            if not isinstance(rep, dict):
                continue
            end = rep_frame(rep, "endFrame", -1)
            if end <= frame_index <= end + hold_frames and end > recent_end:
                recent = rep
                recent_end = end
        return recent

    def draw_panel(frame: Any, x: int, y: int, lines: List[str], color: Tuple[int, int, int]) -> None:
        if not lines:
            return
        font_scale = 0.72 if frame_width < 900 else 0.82
        line_h = 30 if frame_width < 900 else 34
        width = min(frame_width - x - 24, 560 if frame_width < 900 else 640)
        height = 24 + line_h * len(lines)
        overlay = frame.copy()
        cv2.rectangle(overlay, (x, y), (x + width, y + height), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.58, frame, 0.42, 0, frame)
        cv2.rectangle(frame, (x, y), (x + width, y + height), color, 2)
        for i, text in enumerate(lines):
            cv2.putText(
                frame,
                text,
                (x + 18, y + 32 + i * line_h),
                cv2.FONT_HERSHEY_SIMPLEX,
                font_scale,
                (255, 255, 255),
                2,
                cv2.LINE_AA,
            )

    def draw_pose_box(frame: Any, landmarks: Any) -> None:
        visible = [
            lm
            for lm in landmarks
            if getattr(lm, "visibility", 1.0) >= 0.25
        ]
        if not visible:
            return
        x_min = max(0, int(min(lm.x * frame_width for lm in visible) - 18))
        x_max = min(frame_width - 1, int(max(lm.x * frame_width for lm in visible) + 18))
        y_min = max(0, int(min(lm.y * frame_height for lm in visible) - 18))
        y_max = min(frame_height - 1, int(max(lm.y * frame_height for lm in visible) + 18))
        cv2.rectangle(frame, (x_min, y_min), (x_max, y_max), (0, 220, 255), 2)

    with pose_mod.Pose(
        static_image_mode=False,
        model_complexity=1,
        enable_segmentation=False,
        min_detection_confidence=0.45,
        min_tracking_confidence=0.45,
    ) as pose:
        index = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = pose.process(rgb)
            if result.pose_landmarks:
                draw_pose_box(frame, result.pose_landmarks.landmark)
                draw.draw_landmarks(
                    frame,
                    result.pose_landmarks,
                    pose_mod.POSE_CONNECTIONS,
                    landmark_drawing_spec=style.get_default_pose_landmarks_style(),
                )

            overlay = frame.copy()
            cv2.rectangle(overlay, (24, 24), (min(frame_width - 24, 760), 150), (0, 0, 0), -1)
            frame = cv2.addWeighted(overlay, 0.55, frame, 0.45, 0)
            for i, text in enumerate(header_lines):
                cv2.putText(
                    frame,
                    text,
                    (44, 62 + i * 34),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.78,
                    (255, 255, 255),
                    2,
                    cv2.LINE_AA,
                )

            current_velocity = velocity_at(index)
            active_rep = active_rep_at(index)
            recent_rep = None if active_rep else recent_rep_at(index)
            panel_y = max(168, min(max(168, frame_height - 210), 176))

            if active_rep:
                start = rep_frame(active_rep, "startFrame", index)
                start_y = frame_y(start)
                current_y = frame_y(index)
                elapsed = max((index - start) / fps, 1.0 / fps)
                displacement = 0.0
                if start_y is not None and current_y is not None:
                    displacement = max(0.0, (start_y - current_y) * scale_m_per_px)
                live_power = (effective_mass_kg * G * displacement / elapsed) if effective_mass_kg > 0 else 0.0
                panel_lines = [
                    f"LIVE REP #{int(active_rep.get('repIndex') or 0)}",
                    f"Velocity: {max(0.0, current_velocity):.2f} m/s",
                    f"Power: {live_power:.0f} W / {live_power / HP_WATT:.2f} hp",
                    f"Displacement: {displacement:.2f} m",
                    f"Time: {elapsed:.2f} s",
                ]
                draw_panel(frame, 28, panel_y, panel_lines, (0, 220, 255))
            elif recent_rep:
                panel_lines = [
                    f"REP #{int(recent_rep.get('repIndex') or 0)} RESULT",
                    f"Displacement: {float(recent_rep.get('displacementM') or 0):.2f} m",
                    f"Time: {float(recent_rep.get('ascentTimeS') or 0):.2f} s",
                    f"Power: {float(recent_rep.get('avgPowerW') or 0):.0f} W / {float(recent_rep.get('horsepowerHp') or 0):.2f} hp",
                    f"Max velocity: {float(recent_rep.get('maxVelocityMps') or 0):.2f} m/s",
                ]
                draw_panel(frame, 28, panel_y, panel_lines, (0, 180, 255))
            else:
                panel_lines = [
                    "LIVE TRACKING",
                    f"Velocity: {max(0.0, current_velocity):.2f} m/s",
                    "Waiting for upward phase",
                ]
                draw_panel(frame, 28, max(168, min(max(168, frame_height - 120), 176)), panel_lines, (80, 180, 80))

            if index < len(y_track) and y_track[index] is not None:
                y = int(y_track[index] or 0)
                cv2.circle(frame, (frame_width - 64, max(32, min(frame_height - 32, y))), 8, (0, 220, 255), -1)

            out.write(frame)
            index += 1
            if frame_count and index % max(1, frame_count // 20) == 0:
                emit_progress(55 + int(index / frame_count * 35))

    cap.release()
    out.release()


def run(args: argparse.Namespace) -> Dict[str, Any]:
    emit_progress(8)
    fps, width, height, scale, y_track = collect_pose_track(args.input, args.height_cm)
    emit_progress(48)
    external_load_kg = max(0.0, float(args.external_load_kg or 0))
    effective_mass_kg = max(0.0, float(args.weight_kg)) + external_load_kg
    reps = detect_reps(y_track, fps, scale, effective_mass_kg, args.mode)
    metrics = build_metrics(args.mode, reps, args.weight_kg, external_load_kg)
    metrics["video"] = {
        "fps": round_float(fps, 3),
        "width": width,
        "height": height,
        "scaleMPerPx": round_float(scale, 6),
    }
    emit_progress(55)
    render_output_video(args.input, args.output, metrics, y_track, scale)
    emit_progress(95)
    return metrics


def main() -> int:
    parser = argparse.ArgumentParser(description="CoachLink transient power analysis")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--metrics", required=True)
    parser.add_argument("--mode", choices=["pullup", "muscleup"], default="pullup")
    parser.add_argument("--height-cm", type=float, required=True)
    parser.add_argument("--weight-kg", type=float, required=True)
    parser.add_argument("--external-load-kg", type=float, default=0)
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
