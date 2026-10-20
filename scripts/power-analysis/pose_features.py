"""Per-frame pose geometry shared by every movement.

Landmarks are stored as a float array shaped (frames, 33, 3) holding the
MediaPipe BlazePose x/y in pixels and the landmark visibility. Frames without
a detected person are all NaN, so every helper here propagates NaN instead of
inventing values.
"""
import math
from typing import Dict, List, Optional, Tuple

import numpy as np

NOSE = 0
MOUTH_LEFT, MOUTH_RIGHT = 9, 10
SIDE_LANDMARKS: Dict[str, Dict[str, int]] = {
    "left": {"shoulder": 11, "elbow": 13, "wrist": 15, "hip": 23, "knee": 25, "ankle": 27, "heel": 29, "foot": 31},
    "right": {"shoulder": 12, "elbow": 14, "wrist": 16, "hip": 24, "knee": 26, "ankle": 28, "heel": 30, "foot": 32},
}
JOINT_TRIPLETS: Dict[str, Tuple[str, str, str]] = {
    "knee": ("hip", "knee", "ankle"),
    "hip": ("shoulder", "hip", "knee"),
    "elbow": ("shoulder", "elbow", "wrist"),
    "body_line": ("shoulder", "hip", "ankle"),
}
VIEW_LABELS_ZH = {"front": "正面", "side": "侧面", "oblique": "斜侧面", "unknown": "未识别"}
DEFAULT_VISIBILITY = 0.5


def empty_track(frame_count: int) -> np.ndarray:
    return np.full((frame_count, 33, 3), np.nan, dtype=np.float64)


def landmarks_to_row(landmarks, width: int, height: int) -> np.ndarray:
    row = np.empty((33, 3), dtype=np.float64)
    for index, lm in enumerate(landmarks):
        row[index] = (lm.x * width, lm.y * height, getattr(lm, "visibility", 1.0))
    return row


def points(track: np.ndarray, index: int, min_visibility: float = DEFAULT_VISIBILITY) -> np.ndarray:
    """(frames, 2) pixel positions; NaN where the landmark is missing or not visible enough."""
    result = track[:, index, :2].astype(np.float64)
    visible = track[:, index, 2] >= min_visibility
    result[~visible] = np.nan
    return result


def side_points(track: np.ndarray, side: str, part: str, min_visibility: float = DEFAULT_VISIBILITY) -> np.ndarray:
    if side == "both":
        left = points(track, SIDE_LANDMARKS["left"][part], min_visibility)
        right = points(track, SIDE_LANDMARKS["right"][part], min_visibility)
        return nan_mean_pair(left, right)
    return points(track, SIDE_LANDMARKS[side][part], min_visibility)


def nan_mean_pair(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    stacked = np.stack([a, b])
    count = np.sum(~np.isnan(stacked), axis=0)
    total = np.nansum(stacked, axis=0)
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(count > 0, total / np.maximum(count, 1), np.nan)


def angle_at(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> np.ndarray:
    """Angle ABC in degrees for each frame."""
    v1 = a - b
    v2 = c - b
    with np.errstate(invalid="ignore", divide="ignore"):
        cosine = np.sum(v1 * v2, axis=-1) / (np.linalg.norm(v1, axis=-1) * np.linalg.norm(v2, axis=-1))
        return np.degrees(np.arccos(np.clip(cosine, -1.0, 1.0)))


def joint_angle(track: np.ndarray, joint: str, side: str) -> np.ndarray:
    if side == "both":
        left = joint_angle(track, joint, "left")
        right = joint_angle(track, joint, "right")
        return nan_mean_pair(left[:, None], right[:, None])[:, 0]
    first, middle, last = JOINT_TRIPLETS[joint]
    return angle_at(
        side_points(track, side, first),
        side_points(track, side, middle),
        side_points(track, side, last),
    )


def trunk_lean(track: np.ndarray, side: str) -> np.ndarray:
    """Torso angle from vertical in degrees: 0 upright, 90 horizontal."""
    shoulder = side_points(track, side, "shoulder")
    hip = side_points(track, side, "hip")
    dx = shoulder[:, 0] - hip[:, 0]
    dy = hip[:, 1] - shoulder[:, 1]
    with np.errstate(invalid="ignore"):
        return np.degrees(np.arctan2(np.abs(dx), dy))


def thigh_angle(track: np.ndarray, side: str) -> np.ndarray:
    """Thigh angle above horizontal in degrees: positive while the hip is above the knee."""
    hip = side_points(track, side, "hip")
    knee = side_points(track, side, "knee")
    with np.errstate(invalid="ignore"):
        return np.degrees(np.arctan2(knee[:, 1] - hip[:, 1], np.abs(knee[:, 0] - hip[:, 0])))


def segment_length(track: np.ndarray, side: str, start: str, end: str) -> np.ndarray:
    return np.linalg.norm(side_points(track, side, start) - side_points(track, side, end), axis=-1)


def torso_length(track: np.ndarray) -> np.ndarray:
    shoulders = nan_mean_pair(points(track, 11, 0.3), points(track, 12, 0.3))
    hips = nan_mean_pair(points(track, 23, 0.3), points(track, 24, 0.3))
    return np.linalg.norm(shoulders - hips, axis=-1)


def choose_side(track: np.ndarray) -> str:
    """Side facing the camera: the one whose limbs are visible more often."""
    scores = {}
    for side, parts in SIDE_LANDMARKS.items():
        indexes = [parts[name] for name in ("shoulder", "elbow", "wrist", "hip", "knee", "ankle")]
        visibility = track[:, indexes, 2]
        scores[side] = float(np.nanmean(visibility)) if np.any(~np.isnan(visibility)) else 0.0
    return "left" if scores["left"] >= scores["right"] else "right"


def detect_view(track: np.ndarray) -> str:
    """front / side / oblique from shoulder width relative to torso length."""
    shoulder_width = np.linalg.norm(points(track, 11, 0.3) - points(track, 12, 0.3), axis=-1)
    ratio = shoulder_width / torso_length(track)
    ratio = ratio[np.isfinite(ratio)]
    if ratio.size < 5:
        return "unknown"
    median = float(np.median(ratio))
    if median < 0.35:
        return "side"
    if median > 0.7:
        return "front"
    return "oblique"


def smooth(values: np.ndarray, window: int) -> np.ndarray:
    """Centered NaN-aware moving average."""
    window = max(1, int(window))
    if window <= 1 or values.size == 0:
        return values.astype(np.float64)
    data = values.astype(np.float64)
    valid = np.isfinite(data)
    filled = np.where(valid, data, 0.0)
    kernel = np.ones(window)
    total = np.convolve(filled, kernel, mode="same")
    count = np.convolve(valid.astype(np.float64), kernel, mode="same")
    with np.errstate(invalid="ignore", divide="ignore"):
        result = total / count
    result[~valid] = np.nan
    return result


def interpolate_gaps(values: np.ndarray, max_gap: int) -> np.ndarray:
    """Linearly fill NaN runs no longer than max_gap that have data on both sides."""
    result = values.astype(np.float64).copy()
    valid = np.flatnonzero(np.isfinite(result))
    for left, right in zip(valid[:-1], valid[1:]):
        gap = right - left - 1
        if 0 < gap <= max_gap:
            result[left + 1:right] = np.linspace(result[left], result[right], gap + 2)[1:-1]
    return result


def value_at(values: np.ndarray, frame: int) -> Optional[float]:
    if 0 <= frame < values.size and math.isfinite(float(values[frame])):
        return float(values[frame])
    return None


def nearest_value(values: np.ndarray, frame: int, radius: int) -> Optional[float]:
    """Value at frame, or the closest finite value within radius frames."""
    for offset in range(0, max(0, radius) + 1):
        for candidate in (frame - offset, frame + offset):
            found = value_at(values, candidate)
            if found is not None:
                return found
    return None


def window_values(values: np.ndarray, start: int, end: int) -> np.ndarray:
    start = max(0, start)
    end = min(values.size, end + 1)
    if end <= start:
        return np.array([], dtype=np.float64)
    chunk = values[start:end]
    return chunk[np.isfinite(chunk)]


def body_proxy_y(track: np.ndarray, part: str, side: str) -> np.ndarray:
    preferred = side_points(track, side, part)[:, 1]
    both = side_points(track, "both", part, 0.3)[:, 1]
    return np.where(np.isfinite(preferred), preferred, both)


def body_proxy_points(track: np.ndarray, part: str, side: str) -> np.ndarray:
    preferred = side_points(track, side, part)
    both = side_points(track, "both", part, 0.3)
    return np.where(np.isfinite(preferred), preferred, both)


def midfoot_x(track: np.ndarray, side: str) -> np.ndarray:
    ankle = side_points(track, side, "ankle")[:, 0]
    foot = side_points(track, side, "foot")[:, 0]
    return nan_mean_pair(ankle[:, None], foot[:, None])[:, 0]


def frames_to_times(frames: List[int], fps: float) -> List[float]:
    return [round(frame / max(fps, 1.0), 2) for frame in frames]
