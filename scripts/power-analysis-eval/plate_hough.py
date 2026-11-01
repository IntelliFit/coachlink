"""Baseline for the plate evaluation: the current Hough tracker, with the reason it failed.

usage: python plate_hough.py
Writes vlm-eval/hough/results.json and <clip>.npy (plate centers per frame).
"""
import json
import os
import time
from typing import Any, Dict, List

import numpy as np

import clips as cl
import plate_tracker as pt


def describe_tracks(tracks: List[Any], expected: np.ndarray, total: int, head: np.ndarray) -> List[Dict[str, Any]]:
    rows = []
    for track in tracks:
        if len(track.points) < pt.MIN_TRACK_FRAMES:
            continue
        ys = pt._track_series(track, total)
        centre = np.nanmedian(ys, axis=0)
        correlation = pt._correlation(ys[:, 1], expected[:total, 1])
        rows.append(
            {
                "frames": len(track.points),
                "radiusPx": round(track.radius, 1),
                "centerPx": [round(float(centre[0])), round(float(centre[1]))],
                "yRangePx": round(float(np.nanmax(ys[:, 1]) - np.nanmin(ys[:, 1]))),
                "bodyCorrelation": None if correlation is None else round(correlation, 3),
                "onHead": pt._on_head(track, head),
            }
        )
    return sorted(rows, key=lambda row: -row["frames"])[:8]


def run_clip(clip: cl.Clip) -> Dict[str, Any]:
    fps, _, _, track = cl.pose_track(clip)
    expected, head = cl.expected_and_head(clip, track)
    diagnostics: Dict[str, Any] = {}
    original_pick, original_follow = pt._pick_track, pt.follow_plate

    def spy_pick(tracks, expected_points, total, head_points=None):
        diagnostics["candidates"] = describe_tracks(tracks, expected_points, total, head_points)
        diagnostics["circleTracks"] = len(tracks)
        picked = original_pick(tracks, expected_points, total, head_points)
        diagnostics["pickReason"] = picked[2]
        diagnostics["pickCorrelation"] = None if picked[1] is None else round(picked[1], 3)
        return picked

    def spy_follow(*args, **kwargs):
        followed, snapped = original_follow(*args, **kwargs)
        total = followed.shape[0]
        correlation = pt._correlation(followed[:, 1], expected[:total, 1])
        diagnostics["followCorrelation"] = None if correlation is None else round(correlation, 3)
        diagnostics["followSnappedShare"] = round(snapped, 3)
        diagnostics["seedFrame"] = int(args[1])
        return followed, snapped

    pt._pick_track, pt.follow_plate = spy_pick, spy_follow
    started = time.perf_counter()
    try:
        result = cl.measure(clip, pt.track_plate)
    finally:
        pt._pick_track, pt.follow_plate = original_pick, original_follow
    os.makedirs(os.path.join(cl.OUT, "hough"), exist_ok=True)
    if result["target"] == "barbell_plate":
        np.save(os.path.join(cl.OUT, "hough", f"{clip.name}.npy"), result["barPoints"])
    return {"clip": clip.name, "seconds": round(time.perf_counter() - started, 1), **cl.public_result(result), "diagnostics": diagnostics}


def main() -> None:
    results = []
    for clip in cl.barbell_clips():
        row = run_clip(clip)
        results.append(row)
        print(json.dumps(row, ensure_ascii=False), flush=True)
    with open(os.path.join(cl.OUT, "hough", "results.json"), "w", encoding="utf-8") as handle:
        json.dump(results, handle, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
