"""Shared helpers for the offline vision-model evaluations. Nothing here runs in production.

Paths default to the local evaluation folder and can be moved with POWER_EVAL_ROOT.
Clips named <sample>__prod are the samples re-encoded the way uploads actually arrive
(540p, 24 fps, about 700 kbps); the originals are 1080p at about 15 Mbps. Clips named
<sample>__ob60 and __ob45 are the same encode squeezed horizontally to 60% and 45%, which
turns plate circles into the ellipses of a camera standing about 53 and 63 degrees off
the plate axis while leaving every vertical distance and time unchanged. They are
synthetic, so their answers are known, and are always reported as synthetic.
"""
import argparse
import os
import sys
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "power-analysis"))

import analyze_video as av  # noqa: E402
import plausibility  # noqa: E402

ROOT = os.environ.get("POWER_EVAL_ROOT", r"D:\CodexWork\coachlink-motion-analysis")
OUT = os.path.join(ROOT, "vlm-eval")
SAMPLES = os.path.join(ROOT, "samples")
PROD_CLIPS = os.path.join(OUT, "clips")
TRACK_CACHE = os.path.join(OUT, "tracks")
PLATE_DIAMETER_CM = 45.0
HEIGHT_CM = 175.0
WEIGHT_KG = 75.0

av.emit_progress = lambda *_: None


@dataclass(frozen=True)
class Clip:
    name: str
    path: str
    mode: str
    load_kg: float
    expected_reps: int
    action_zh: str


BASE_CLIPS = [
    ("benchpress_110kg_4reps", "bench_press", 110.0, 4, "卧推"),
    ("squat_140kg_2reps", "back_squat", 140.0, 2, "杠铃深蹲"),
    ("deadlift_170kg_1rep", "deadlift", 170.0, 1, "硬拉"),
]
SYNTHETIC_SUFFIXES = ("__ob60", "__ob45")


def barbell_clips(include_synthetic: bool = True) -> List[Clip]:
    clips = []
    for name, mode, load, reps, action in BASE_CLIPS:
        clips.append(Clip(name, os.path.join(SAMPLES, f"{name}.mp4"), mode, load, reps, action))
        clips.append(Clip(f"{name}__prod", os.path.join(PROD_CLIPS, f"{name}__prod.mp4"), mode, load, reps, action))
        if include_synthetic:
            for suffix in SYNTHETIC_SUFFIXES:
                clips.append(Clip(f"{name}{suffix}", os.path.join(PROD_CLIPS, f"{name}{suffix}.mp4"), mode, load, reps, action))
    return clips


def pose_track(clip: Clip) -> Tuple[float, int, int, np.ndarray]:
    """MediaPipe track for the clip, computed once and cached on disk."""
    os.makedirs(TRACK_CACHE, exist_ok=True)
    cached = os.path.join(TRACK_CACHE, f"{clip.name}.npz")
    if os.path.exists(cached):
        data = np.load(cached)
        return float(data["fps"]), int(data["w"]), int(data["h"]), data["track"]
    fps, width, height, track = av.collect_landmarks(clip.path)
    np.savez_compressed(cached, fps=fps, w=width, h=height, track=track)
    return fps, width, height, track


def expected_and_head(clip: Clip, track: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """The same body proxy and head points measure_barbell gives the plate tracker."""
    preset = av.get_mode_preset(clip.mode)
    side = av.pf.choose_side(track)
    expected = av.expected_bar_points(track, str(preset.get("bodyProxy") or "wrist"), side)
    return expected, av.pf.points(track, 0, 0.1)


def measure(clip: Clip, tracker) -> Dict[str, Any]:
    """Runs the production measurement with the plate tracker swapped; no video is rendered."""
    fps, _, height, track = pose_track(clip)
    args = argparse.Namespace(
        input=clip.path,
        mode=clip.mode,
        plate_diameter_cm=PLATE_DIAMETER_CM,
        height_cm=HEIGHT_CM,
        weight_kg=WEIGHT_KG,
        external_load_kg=clip.load_kg,
    )
    original = av.track_plate
    av.track_plate = tracker
    try:
        measured = av.measure_barbell(args, track, fps, height)
    finally:
        av.track_plate = original
    preset = av.get_mode_preset(clip.mode)
    mass = float(av.build_mass_metrics(WEIGHT_KG, clip.load_kg, float(preset["bodyMassFactor"]), True)["effectiveMassKg"])
    raw = av.detect_reps(measured.y_track, fps, measured.scale, mass, clip.mode, min_displacement=0.05)
    reps = av.refine_barbell_reps(raw, measured.y_track, measured.timing_y, fps, measured.scale, mass, float(preset["minDisplacement"]))
    kept, excluded = plausibility.split_reps(reps, clip.mode, HEIGHT_CM)
    return {
        "target": measured.measurement.get("target"),
        "scaleSource": measured.measurement.get("scaleSource"),
        "confidence": measured.measurement.get("confidence"),
        "fallbackReason": measured.measurement.get("fallbackReason"),
        "scaleMPerPx": round(float(measured.scale), 6),
        "plateRadiusPx": None if measured.plate_radius is None else round(float(measured.plate_radius), 1),
        "repCount": len(kept),
        "expectedReps": clip.expected_reps,
        "excludedReps": len(excluded),
        "travelM": [rep["displacementM"] for rep in kept],
        "meanVelocityMps": [rep["meanVelocityMps"] for rep in kept],
        "barPoints": measured.bar_points,
    }


def public_result(result: Dict[str, Any]) -> Dict[str, Any]:
    return {key: value for key, value in result.items() if key != "barPoints"}
