"""Second arm of the plate evaluation: the model's box starts the existing optical-flow tracker.

Everything after the seed is production code and production gates (follow_plate,
_vertical_radius, coverage, body correlation, rep detection). Each repeat uses only the
answers of that repeat. Boxes are tried in time order; the first one that passes the
gates wins, the same way a retry would behave online.

Two switches test what the tracker would need beyond a seed. Neither changes the
production module on disk; they only patch it inside this process:
  --keep-following  does not give up after 3 s without a circle to snap to
  --ellipse-mask    seeds features inside an ellipse with the box's shape, not a circle
A third switch replaces the tracker altogether, as a candidate for what could ship:
  --template        template matching forward and backward from the seed; the plate size
                    is the median of the boxes that land on the track, and at least two
                    boxes must land on it, which also rejects a seed on the wrong object
  --moving-gate     with --template: body correlation only over frames where the plate moves,
                    since walking in and bending to the bar move the body but not the plate

usage: python plate_seeded.py [--variant <name>] [--keep-following] [--ellipse-mask] [--template] [--moving-gate] [--only <text>]
Reads vlm-eval/plate/{manifest,answers}.json, writes vlm-eval/plate/seeded[_variant]/.
"""
import argparse
import json
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

import clips as cl
import plate_follow as pf_follow
import plate_tracker as pt
from pose_features import interpolate_gaps, smooth

MIN_BOX_SHARE = 0.015
# Later boxes count as agreeing with the track when within this many plate radii.
AGREE_RADII = 0.6
ELLIPSE = {"enabled": False}
TEMPLATE = {"enabled": False, "movingGate": False}
TEMPLATE_SHARE = 0.35
# The plate counts as moving above this many radii over 0.2 s; each moving frame also keeps 0.3 s around it.
MOVING_RADII = 0.05
MOVING_MARGIN_S = 0.3
MIN_TEMPLATE_SCORE = 0.4
UPDATE_TEMPLATE_SCORE = 0.8
MIN_AGREEING_BOXES = 2
# A box this close to the crop edge may be cut off, so its height is not the plate's.
CLIPPED_EDGE = 5


def parse_box(text: Optional[str]) -> Optional[List[float]]:
    """The model's normalized box, or None for found=false, malformed or empty replies."""
    if not text:
        return None
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        return None
    try:
        reply = json.loads(match.group(0))
    except ValueError:
        return None
    box = reply.get("box")
    if not reply.get("found") or not isinstance(box, list) or len(box) != 4:
        return None
    if not all(isinstance(value, (int, float)) for value in box):
        return None
    x0, y0, x1, y1 = box
    if not (0 <= x0 < x1 <= 1000 and 0 <= y0 < y1 <= 1000):
        return None
    return [float(value) for value in box]


def to_video_box(box: List[float], crop: List[int], item: Dict[str, Any]) -> Tuple[float, float, float, float]:
    """Normalized box on the shrunk crop back to full-resolution video pixels."""
    width, height = item["imageSize"]
    ratio = item["ratio"]
    x0, y0, x1, y1 = box
    return (
        crop[0] + x0 / 1000 * width / ratio,
        crop[1] + y0 / 1000 * height / ratio,
        crop[0] + x1 / 1000 * width / ratio,
        crop[1] + y1 / 1000 * height / ratio,
    )


def seed_from_box(box: Tuple[float, float, float, float]) -> Tuple[Tuple[float, float], float]:
    """Center and radius. A tilted plate is narrower than tall and a clipped one shorter than wide, so the long side is the diameter."""
    x0, y0, x1, y1 = box
    return ((x0 + x1) / 2, (y0 + y1) / 2), max(x1 - x0, y1 - y0) / 2


def ellipse_features(aspect: float):
    """Replacement for plate_follow._seed_features: a mask with the plate's own width-to-height shape."""

    def seed(gray: np.ndarray, center: np.ndarray, radius: float) -> Optional[np.ndarray]:
        mask = np.zeros_like(gray)
        axes = (max(3, int(radius * 0.85 * aspect)), max(4, int(radius * 0.85)))
        cv2.ellipse(mask, (int(center[0]), int(center[1])), axes, 0, 0, 360, 255, -1)
        return cv2.goodFeaturesToTrack(gray, pf_follow.FEATURE_COUNT, 0.01, 5, mask=mask)

    return seed


def gated_track(
    clip: cl.Clip,
    seed_frame: int,
    center: Tuple[float, float],
    radius: float,
    expected: np.ndarray,
    fps: float,
    total: int,
) -> Tuple[Optional[pt.PlateTrack], str, Dict[str, Any]]:
    """track_plate's tail: same follow, same radius refinement, same gates."""
    followed, snapped = pf_follow.follow_plate(clip.path, seed_frame, center, radius, total, fps)
    refined = pt._vertical_radius(clip.path, followed, radius)
    coverage = float(np.mean(np.isfinite(followed[seed_frame:, 1])))
    correlation = pt._correlation(followed[:, 1], expected[:total, 1])
    info = {
        "seedRadiusPx": round(radius, 1),
        "refinedRadiusPx": round(refined, 1),
        "coverage": round(coverage, 3),
        "snappedShare": round(snapped, 3),
        "bodyCorrelation": None if correlation is None else round(correlation, 3),
        "yRangePx": round(float(np.nanmax(followed[:, 1]) - np.nanmin(followed[:, 1])), 1),
        "followed": followed,
    }
    if coverage < pt.MIN_COVERAGE:
        return None, "plate_tracking_lost", info
    if correlation is None or correlation < pt.MIN_BODY_CORRELATION:
        return None, "plate_not_following_lifter", info
    max_gap = max(1, int(round(fps * pt.GAP_FILL_S)))
    window = max(1, int(round(fps * 0.1)) | 1)
    raw = np.stack([interpolate_gaps(followed[:, axis], max_gap) for axis in (0, 1)], axis=1)
    centers = np.stack([smooth(raw[:, axis], window) for axis in (0, 1)], axis=1)
    confidence = "high" if coverage >= 0.8 and snapped >= 0.5 and correlation >= 0.85 else "medium"
    track = pt.PlateTrack(
        centers=centers,
        raw_centers=raw,
        radius_px=refined,
        lock_frame=seed_frame,
        coverage=coverage,
        scale_m_per_px=(cl.PLATE_DIAMETER_CM / 100.0) / max(2.0 * refined, 1.0),
        radius_spread=0.0,
        body_correlation=correlation,
        confidence=confidence,
    )
    return track, "ok", info


def agreement(followed: np.ndarray, boxes: List[Dict[str, Any]], radius: float) -> Dict[str, Any]:
    """How the model's other boxes sit against the track: an independent drift check."""
    distances = []
    for item in boxes:
        point = followed[item["frame"]] if item["frame"] < followed.shape[0] else None
        if point is None or not np.all(np.isfinite(point)):
            continue
        distances.append(float(np.hypot(point[0] - item["center"][0], point[1] - item["center"][1])) / max(radius, 1.0))
    return {
        "checkedBoxes": len(distances),
        "agreeingBoxes": sum(1 for value in distances if value <= AGREE_RADII),
        "distancesInRadii": [round(value, 2) for value in distances],
    }


def load_gray_frames(path: str, total: int) -> Tuple[List[np.ndarray], float]:
    cap = cv2.VideoCapture(path)
    frames: List[np.ndarray] = []
    scale = 1.0
    while len(frames) < total:
        ok, frame = cap.read()
        if not ok:
            break
        if not frames:
            scale = min(1.0, pf_follow.WORK_SIDE / max(1, min(frame.shape[:2])))
        frames.append(pf_follow._gray(frame, scale))
    cap.release()
    return frames, scale


def template_follow(frames: List[np.ndarray], scale: float, seed: int, center: Tuple[float, float], radius: float, fps: float) -> np.ndarray:
    """(frames, 2) plate centers from normalized template matching, both ways from the seed."""
    total = len(frames)
    out = np.full((total, 2), np.nan)
    height, width = frames[0].shape
    half = max(10, int(radius * scale * TEMPLATE_SHARE))
    cx, cy = center[0] * scale, center[1] * scale
    # Near the frame edge the template shifts inward and remembers how far it is from the center.
    tx, ty = int(np.clip(cx, half, width - half - 1)), int(np.clip(cy, half, height - half - 1))
    offset = (cx - tx, cy - ty)
    reach = half * 3

    def patch(index: int, x: int, y: int) -> np.ndarray:
        return frames[index][y - half:y + half, x - half:x + half].copy()

    def sweep(order: range) -> None:
        x, y, template, weak = tx, ty, patch(seed, tx, ty), 0
        for index in order:
            x0, y0 = max(0, x - reach), max(0, y - reach)
            roi = frames[index][y0:min(height, y + reach), x0:min(width, x + reach)]
            if roi.shape[0] < 2 * half or roi.shape[1] < 2 * half:
                return
            _, score, _, loc = cv2.minMaxLoc(cv2.matchTemplate(roi, template, cv2.TM_CCOEFF_NORMED))
            if score < MIN_TEMPLATE_SCORE:
                weak += 1
                if weak > fps:
                    return
                continue
            weak = 0
            x, y = x0 + loc[0] + half, y0 + loc[1] + half
            out[index] = ((x + offset[0]) / scale, (y + offset[1]) / scale)
            if score >= UPDATE_TEMPLATE_SCORE and half <= x < width - half and half <= y < height - half:
                template = patch(index, x, y)

    sweep(range(seed, total))
    sweep(range(seed - 1, -1, -1))
    return out


def moving_correlation(y: np.ndarray, expected: np.ndarray, radius: float, fps: float) -> Optional[float]:
    """Body correlation restricted to the frames around the plate's own movement."""
    step = max(1, int(round(fps * 0.1)))
    change = np.full(y.size, np.nan)
    change[step:-step] = np.abs(y[2 * step:] - y[:-2 * step])
    with np.errstate(invalid="ignore"):
        moving = change > MOVING_RADII * radius
    margin = int(round(fps * MOVING_MARGIN_S))
    keep = np.zeros(y.size, dtype=bool)
    for index in np.flatnonzero(moving):
        keep[max(0, index - margin):index + margin + 1] = True
    if not keep.any():
        return None
    return pt._correlation(y[keep], expected[keep])


def template_track(
    clip: cl.Clip,
    frames: List[np.ndarray],
    scale: float,
    seed: Dict[str, Any],
    boxes: List[Dict[str, Any]],
    expected: np.ndarray,
    fps: float,
) -> Tuple[Optional[pt.PlateTrack], str, Dict[str, Any]]:
    total = len(frames)
    followed = template_follow(frames, scale, seed["frame"], seed["center"], seed["radius"], fps)
    on_track = []
    for item in boxes:
        point = followed[item["frame"]] if item["frame"] < total else None
        if point is not None and np.all(np.isfinite(point)):
            if np.hypot(point[0] - item["center"][0], point[1] - item["center"][1]) <= AGREE_RADII * item["radius"]:
                on_track.append(item)
    heights = [item["box"][3] - item["box"][1] for item in on_track if not item["clippedY"]]
    radius = float(np.median(heights)) / 2 if heights else float(np.median([item["radius"] for item in on_track] or [seed["radius"]]))
    refined = pt._vertical_radius(clip.path, followed, radius)
    coverage = float(np.mean(np.isfinite(followed[:, 1])))
    if TEMPLATE["movingGate"]:
        correlation = moving_correlation(followed[:, 1], expected[:total, 1], refined, fps)
    else:
        correlation = pt._correlation(followed[:, 1], expected[:total, 1])
    info = {
        "seedRadiusPx": round(radius, 1),
        "refinedRadiusPx": round(refined, 1),
        "coverage": round(coverage, 3),
        "snappedShare": 0.0,
        "bodyCorrelation": None if correlation is None else round(correlation, 3),
        "yRangePx": round(float(np.nanmax(followed[:, 1]) - np.nanmin(followed[:, 1])), 1) if np.any(np.isfinite(followed[:, 1])) else 0.0,
        "agreeingBoxes": len(on_track),
        "followed": followed,
    }
    if len(on_track) < MIN_AGREEING_BOXES:
        return None, "boxes_disagree_with_track", info
    if coverage < pt.MIN_COVERAGE:
        return None, "plate_tracking_lost", info
    if correlation is None or correlation < pt.MIN_BODY_CORRELATION:
        return None, "plate_not_following_lifter", info
    max_gap = max(1, int(round(fps * pt.GAP_FILL_S)))
    window = max(1, int(round(fps * 0.1)) | 1)
    raw = np.stack([interpolate_gaps(followed[:, axis], max_gap) for axis in (0, 1)], axis=1)
    centers = np.stack([smooth(raw[:, axis], window) for axis in (0, 1)], axis=1)
    track = pt.PlateTrack(
        centers=centers,
        raw_centers=raw,
        radius_px=refined,
        lock_frame=seed["frame"],
        coverage=coverage,
        scale_m_per_px=(cl.PLATE_DIAMETER_CM / 100.0) / max(2.0 * refined, 1.0),
        radius_spread=0.0,
        body_correlation=correlation,
        confidence="medium",
    )
    return track, "ok", info


def run_repeat(clip: cl.Clip, manifest: Dict[str, Any], answers: Dict[str, Any], repeat: int, out_dir: str) -> Dict[str, Any]:
    fps, _, _, track = cl.pose_track(clip)
    total = track.shape[0]
    expected, _ = cl.expected_and_head(clip, track)
    boxes: List[Dict[str, Any]] = []
    calls = latency = prompt_tokens = completion_tokens = 0
    for item in manifest["frames"]:
        answer = answers.get(f"{clip.name}/{item['frame']}/r{repeat}")
        if answer is None:
            continue
        calls += 1
        latency += answer["latencyMs"]
        prompt_tokens += answer["promptTokens"] or 0
        completion_tokens += answer["completionTokens"] or 0
        box = parse_box(answer["text"])
        if box is None:
            continue
        pixels = to_video_box(box, manifest["crop"], item)
        center, radius = seed_from_box(pixels)
        aspect = min(1.0, (pixels[2] - pixels[0]) / max(pixels[3] - pixels[1], 1.0))
        clipped_y = box[1] <= CLIPPED_EDGE or box[3] >= 1000 - CLIPPED_EDGE
        boxes.append({"frame": item["frame"], "box": [round(value, 1) for value in pixels], "center": center, "radius": radius, "aspect": aspect, "clippedY": clipped_y})

    base = {
        "clip": clip.name,
        "repeat": repeat,
        "modelCalls": calls,
        "validBoxes": len(boxes),
        "modelLatencyMs": latency,
        "promptTokens": prompt_tokens,
        "completionTokens": completion_tokens,
    }
    if not boxes:
        return {**base, "gate": "no_box", "attempts": []}

    attempts: List[Dict[str, Any]] = []
    chosen: Optional[Tuple[pt.PlateTrack, Dict[str, Any]]] = None
    started = time.perf_counter()
    last_reason = "no_box"
    original_features = pf_follow._seed_features
    gray_frames, gray_scale = load_gray_frames(clip.path, total) if TEMPLATE["enabled"] else ([], 1.0)
    for item in boxes:
        pf_follow._seed_features = ellipse_features(item["aspect"]) if ELLIPSE["enabled"] else original_features
        if TEMPLATE["enabled"]:
            plate, reason, info = template_track(clip, gray_frames, gray_scale, item, boxes, expected, fps)
        else:
            plate, reason, info = gated_track(clip, item["frame"], item["center"], item["radius"], expected, fps, total)
        pf_follow._seed_features = original_features
        last_reason = reason
        attempts.append({"seedFrame": item["frame"], "seedBoxPx": item["box"], "reason": reason, **{k: v for k, v in info.items() if k != "followed"}})
        if plate is not None:
            chosen = (plate, {**info, "seed": item})
            break
    follow_seconds = round(time.perf_counter() - started, 1)
    if chosen is None:
        return {**base, "gate": last_reason, "attempts": attempts, "followSeconds": follow_seconds}

    plate, info = chosen
    others = [item for item in boxes if item is not info["seed"]]
    result = cl.measure(clip, lambda *args, **kwargs: (plate, "ok"))
    np.save(os.path.join(out_dir, f"{clip.name}__r{repeat}.npy"), plate.centers)
    return {
        **base,
        "gate": "ok",
        "attempts": attempts,
        "followSeconds": follow_seconds,
        "seedFrame": info["seed"]["frame"],
        "agreement": agreement(info["followed"], others, plate.radius_px),
        **cl.public_result(result),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--variant", default="")
    parser.add_argument("--only", default="")
    parser.add_argument("--keep-following", action="store_true")
    parser.add_argument("--ellipse-mask", action="store_true")
    parser.add_argument("--template", action="store_true")
    parser.add_argument("--moving-gate", action="store_true")
    args = parser.parse_args()
    if args.keep_following:
        pf_follow.LOST_AFTER_S = 1e6
    ELLIPSE["enabled"] = args.ellipse_mask
    TEMPLATE["enabled"] = args.template
    TEMPLATE["movingGate"] = args.moving_gate
    base = os.path.join(cl.OUT, "plate")
    with open(os.path.join(base, "manifest.json"), encoding="utf-8") as handle:
        manifests = {item["clip"]: item for item in json.load(handle)}
    with open(os.path.join(base, "answers.json"), encoding="utf-8") as handle:
        answers = {item["id"]: item for item in json.load(handle)}
    out_dir = os.path.join(base, f"seeded_{args.variant}" if args.variant else "seeded")
    os.makedirs(out_dir, exist_ok=True)
    repeats = sorted({int(key.rsplit("/r", 1)[1]) for key in answers})
    results = []
    for clip in cl.barbell_clips():
        if clip.name not in manifests or (args.only and args.only not in clip.name):
            continue
        for repeat in repeats:
            row = run_repeat(clip, manifests[clip.name], answers, repeat, out_dir)
            results.append(row)
            print(json.dumps(row, ensure_ascii=False), flush=True)
    with open(os.path.join(out_dir, "results.json"), "w", encoding="utf-8") as handle:
        json.dump(results, handle, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
