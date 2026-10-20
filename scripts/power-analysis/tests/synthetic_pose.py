"""Synthetic side-view lifter skeletons that follow a known bar trajectory."""
from typing import Callable, Dict, Tuple

import numpy as np

Point = Tuple[float, float]
NEAR = {"shoulder": 11, "elbow": 13, "wrist": 15, "hip": 23, "knee": 25, "ankle": 27, "heel": 29, "foot": 31}
FAR = {"shoulder": 12, "elbow": 14, "wrist": 16, "hip": 24, "knee": 26, "ankle": 28, "heel": 30, "foot": 32}
FACE = {"nose": 0, "eye_l": 2, "eye_r": 5, "mouth_l": 9, "mouth_r": 10}

# Lifter facing +x; 1 px is about 3.2 mm with a 45 cm plate drawn at radius 70 px.
DEADLIFT = {
    "bottom": {"ankle": (600, 668), "heel": (580, 678), "foot": (650, 680), "knee": (650, 545),
               "hip": (530, 480), "shoulder": (650, 385), "elbow": (648, 495), "wrist": (640, 608), "nose": (700, 360)},
    "top": {"ankle": (600, 668), "heel": (580, 678), "foot": (650, 680), "knee": (605, 525),
            "hip": (600, 385), "shoulder": (605, 229), "elbow": (612, 315), "wrist": (640, 398), "nose": (640, 190)},
}
BACK_SQUAT = {
    "bottom": {"ankle": (600, 668), "heel": (580, 678), "foot": (650, 680), "knee": (690, 540),
               "hip": (540, 550), "shoulder": (610, 400), "elbow": (580, 430), "wrist": (600, 405), "nose": (660, 370)},
    "top": {"ankle": (600, 668), "heel": (580, 678), "foot": (650, 680), "knee": (605, 525),
            "hip": (600, 385), "shoulder": (600, 229), "elbow": (570, 260), "wrist": (590, 232), "nose": (630, 190)},
}


def _lerp(a: Point, b: Point, t: float) -> Point:
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def skeleton_track(
    bar_y: np.ndarray,
    poses: Dict[str, Dict[str, Point]],
    phase_for: Callable[[str, float], float] = lambda part, p: p,
) -> np.ndarray:
    """Interpolates bottom->top poses by how far the bar has risen in each frame."""
    bottom_y = float(np.max(bar_y))
    top_y = float(np.min(bar_y))
    track = np.zeros((bar_y.size, 33, 3), dtype=np.float32)
    track[:, :, 2] = 0.2
    for index, y in enumerate(bar_y):
        progress = float(np.clip((bottom_y - y) / max(bottom_y - top_y, 1e-6), 0, 1))
        for part, near_index in NEAR.items():
            x, py = _lerp(poses["bottom"][part], poses["top"][part], phase_for(part, progress))
            track[index, near_index] = (x, py, 0.95)
            track[index, FAR[part]] = (x + 4, py - 6, 0.7)
        nx, ny = _lerp(poses["bottom"]["nose"], poses["top"]["nose"], phase_for("nose", progress))
        track[index, FACE["nose"]] = (nx, ny, 0.9)
        track[index, FACE["eye_l"]] = (nx - 6, ny - 10, 0.9)
        track[index, FACE["eye_r"]] = (nx - 2, ny - 10, 0.6)
        track[index, FACE["mouth_l"]] = (nx - 4, ny + 14, 0.9)
        track[index, FACE["mouth_r"]] = (nx, ny + 14, 0.6)
    return track
