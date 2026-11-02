"""Synthetic front-view lifter hanging from a bar, for pull-up and muscle-up tests.

One rep is (start, peak): how far the shoulders have risen, in pixels, at that rep's lowest
and highest point. Elbows come from arm length, so the elbow angle follows the shoulder.
"""
from typing import List, Sequence, Tuple

import numpy as np

FPS = 30.0
SCALE_M_PER_PX = 0.002
BAR_Y = 500.0
ARM_SEGMENT = 110.0
TORSO = 200.0
HANG_DY = 218.0  # wrists straight above the shoulders are 20 px further apart: about 176 degrees
HEAD_ABOVE_SHOULDER = 80.0
FULL_PULLUP_PEAK = 190.0  # head about 0.29 torso lengths above the wrists
SHORT_PULLUP_PEAK = 120.0  # head still below the wrists
GRIP_STEP = 30.0  # wrists rise this much once the hands are on top of the bar
FULL_MUSCLEUP_PEAK = 460.0

Rep = Tuple[float, float]


def rise_profile(reps: Sequence[Rep], rest_s: float = 0.7, up_s: float = 0.9, hold_s: float = 0.3, down_s: float = 0.9) -> np.ndarray:
    """Shoulder rise per frame: rest at each rep's start, up to its peak, hold, then down to the next start."""
    rest, up, hold, down = [max(2, int(round(value * FPS))) for value in (rest_s, up_s, hold_s, down_s)]
    chunks: List[np.ndarray] = [np.full(rest, reps[0][0])]
    for index, (start, peak) in enumerate(reps):
        following = reps[index + 1][0] if index + 1 < len(reps) else 0.0
        chunks.extend([
            np.linspace(start, peak, up),
            np.full(hold, peak),
            np.linspace(peak, following, down),
            np.full(rest, following),
        ])
    return np.concatenate(chunks)


def _elbow(shoulder: np.ndarray, wrist: np.ndarray, outward: float) -> np.ndarray:
    span = wrist - shoulder
    distance = float(np.linalg.norm(span))
    middle = (shoulder + wrist) / 2
    if distance >= 2 * ARM_SEGMENT:
        return middle
    offset = np.sqrt(ARM_SEGMENT ** 2 - (distance / 2) ** 2)
    normal = np.array([-span[1], span[0]]) / max(distance, 1e-6)
    if normal[0] * outward < 0:
        normal = -normal
    return middle + normal * offset


def hanging_track(rise: np.ndarray, grip_step: float = 0.0, x: float = 640.0, hang_dy: float = HANG_DY) -> np.ndarray:
    """(frames, 33, 3) landmarks with every point visible. grip_step lifts the wrists while in support."""
    track = np.zeros((rise.size, 33, 3), dtype=np.float64)
    track[:, :, 2] = 0.95
    for frame, value in enumerate(rise):
        shoulder_y = BAR_Y + hang_dy - value
        wrist_y = BAR_Y - (grip_step if shoulder_y < BAR_Y else 0.0)
        for side, (shoulder_i, elbow_i, wrist_i, hip_i, knee_i, ankle_i, heel_i, foot_i) in {
            -1.0: (11, 13, 15, 23, 25, 27, 29, 31),
            1.0: (12, 14, 16, 24, 26, 28, 30, 32),
        }.items():
            shoulder = np.array([x + side * 90, shoulder_y])
            wrist = np.array([x + side * 110, wrist_y])
            track[frame, shoulder_i, :2] = shoulder
            track[frame, wrist_i, :2] = wrist
            track[frame, elbow_i, :2] = _elbow(shoulder, wrist, side)
            track[frame, hip_i, :2] = (x + side * 50, shoulder_y + TORSO)
            track[frame, knee_i, :2] = (x + side * 50, shoulder_y + TORSO + 180)
            track[frame, ankle_i, :2] = (x + side * 50, shoulder_y + TORSO + 360)
            track[frame, heel_i, :2] = (x + side * 50, shoulder_y + TORSO + 380)
            track[frame, foot_i, :2] = (x + side * 70, shoulder_y + TORSO + 380)
        head_y = shoulder_y - HEAD_ABOVE_SHOULDER
        track[frame, 0, :2] = (x, head_y)
        track[frame, 2, :2] = (x - 15, head_y - 12)
        track[frame, 5, :2] = (x + 15, head_y - 12)
        track[frame, 7, :2] = (x - 30, head_y - 6)
        track[frame, 8, :2] = (x + 30, head_y - 6)
        track[frame, 9, :2] = (x - 10, head_y + 16)
        track[frame, 10, :2] = (x + 10, head_y + 16)
    return track


def sway(frames: int, amplitude_px: float, freq_hz: float = 0.8) -> np.ndarray:
    """A phone moving up and down, in pixels per frame."""
    return amplitude_px * np.sin(2 * np.pi * freq_hz * np.arange(frames) / FPS)


def with_camera_motion(track: np.ndarray, motion_y: np.ndarray) -> np.ndarray:
    moved = track.copy()
    moved[:, :, 1] += motion_y[:, None]
    return moved
