"""Synthetic full-body landmark tracks for the generic (custom-mode) motion tests."""
from typing import Dict, Iterable, Optional, Tuple

import numpy as np

# Front-view standing pose in pixels: (left x, right x, y). MediaPipe "left" is the person's left.
FRONT_POSE: Dict[str, Tuple[int, int, float]] = {
    "shoulder": (11, 12, 300.0),
    "elbow": (13, 14, 400.0),
    "wrist": (15, 16, 500.0),
    "hip": (23, 24, 520.0),
    "knee": (25, 26, 700.0),
    "ankle": (27, 28, 880.0),
    "heel": (29, 30, 895.0),
    "foot": (31, 32, 900.0),
}
FRONT_X = {"shoulder": (470, 250), "elbow": (490, 230), "wrist": (490, 230), "hip": (420, 300),
           "knee": (395, 325), "ankle": (390, 330), "heel": (385, 335), "foot": (400, 320)}
FACE_INDEXES = range(0, 11)


def standing_track(frames: int, view: str = "front", seed: int = 3) -> np.ndarray:
    """Still person; side view collapses the left/right x positions onto one line."""
    rng = np.random.default_rng(seed)
    track = np.zeros((frames, 33, 3), dtype=np.float64)
    for part, (left, right, y) in FRONT_POSE.items():
        lx, rx = FRONT_X[part]
        if view == "side":
            lx, rx = 360 + (lx - 360) * 0.1, 360 + (rx - 360) * 0.1
        track[:, left] = (lx, y, 0.95)
        track[:, right] = (rx, y, 0.95)
    for index in FACE_INDEXES:
        track[:, index] = (360 + (index % 3 - 1) * 8, 220 + (index % 4) * 6, 0.95)
    track[:, :, :2] += rng.normal(0, 0.6, size=(frames, 33, 2))
    return track


def move_parts(
    track: np.ndarray,
    parts: Iterable[str],
    offsets_y: np.ndarray,
    sides: Tuple[str, ...] = ("left", "right"),
    scale: float = 1.0,
) -> np.ndarray:
    """Shifts the named parts vertically by offsets_y (pixels, positive = up) times scale."""
    result = track.copy()
    for part in parts:
        if part == "head":
            result[:, list(FACE_INDEXES), 1] -= offsets_y[:, None] * scale
            continue
        left, right, _ = FRONT_POSE[part]
        for side in sides:
            index = left if side == "left" else right
            result[:, index, 1] -= offsets_y * scale
    return result


def cycles(
    fps: float,
    reps: int,
    rom_px: float,
    out_s: float = 1.0,
    back_s: float = 1.0,
    hold_s: float = 0.3,
    rest_s: float = 0.8,
    lead_s: float = 1.0,
    roms: Optional[Iterable[float]] = None,
) -> np.ndarray:
    """Offsets per frame: rest at 0, then out to rom, hold, back to 0, rest."""
    values = [0.0] * int(round(lead_s * fps))
    rom_list = list(roms) if roms is not None else [rom_px] * reps
    for rom in rom_list:
        for seconds, start, end in ((out_s, 0.0, rom), (back_s, rom, 0.0)):
            n = max(2, int(round(seconds * fps)))
            values.extend(start + (end - start) * (0.5 - 0.5 * np.cos(np.pi * i / (n - 1))) for i in range(n))
            if end == rom:
                values.extend([rom] * int(round(hold_s * fps)))
        values.extend([0.0] * int(round(rest_s * fps)))
    return np.array(values)
